import { addDays } from '@santiye/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { businessToday } from '../src/lib/clock.js';
import { CompanyModel } from '../src/models/company.js';
import { IdempotencyRecordModel } from '../src/models/idempotency-record.js';
import { PlatformLogModel } from '../src/models/platform-log.js';
import { UserModel } from '../src/models/user.js';
import { buildTestApp, useTestDatabase, type TestApp } from './helpers/app.js';
import {
  createCompany,
  createUser,
  enrollPlatformAdmin,
  idempotencyKey,
  loginCustomer,
  platformPassword,
  totpCode,
} from './helpers/factories.js';

useTestDatabase();

async function setup() {
  const testApp = buildTestApp();
  const { accessToken, secret } = await enrollPlatformAdmin(testApp);
  const auth = { Authorization: `Bearer ${accessToken}` };
  return { testApp, auth, secret };
}

function createCompanyRequest(
  testApp: TestApp,
  auth: Record<string, string>,
  body: object,
  key: string = idempotencyKey(),
) {
  return request(testApp.app)
    .post('/platform/companies')
    .set(auth)
    .set('Idempotency-Key', key)
    .send(body);
}

function createUserRequest(
  testApp: TestApp,
  auth: Record<string, string>,
  companyId: string,
  body: object,
  key: string = idempotencyKey(),
) {
  return request(testApp.app)
    .post(`/platform/companies/${companyId}/users`)
    .set(auth)
    .set('Idempotency-Key', key)
    .send(body);
}

describe('POST /platform/companies', () => {
  it('yeni firma aktif, boş ve 20 GB kapasiteyle başlar; işletim geçmişine yazılır', async () => {
    const { testApp, auth } = await setup();

    const res = await createCompanyRequest(testApp, auth, {
      name: 'Yıldız Yapı',
      contact: { person: 'Ali Kaya', phone: '0555 000 00 00', email: 'ali@example.com' },
      opsNote: 'Pilot müşteri',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: 'Yıldız Yapı',
      contact: { person: 'Ali Kaya' },
      opsNote: 'Pilot müşteri',
      storage: { usedBytes: 0, quotaBytes: 20 * 1024 ** 3 },
      service: { state: 'active' },
      userCount: 0,
    });
    expect(await PlatformLogModel.countDocuments({ action: 'company.create' })).toBe(1);
  });

  it('Idempotency-Key zorunlu ve UUID olmalı', async () => {
    const { testApp, auth } = await setup();
    const missing = await request(testApp.app)
      .post('/platform/companies')
      .set(auth)
      .send({ name: 'A' });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe('Idempotency-Key başlığı gerekli.');

    expect((await createCompanyRequest(testApp, auth, { name: 'A' }, 'abc')).status).toBe(400);
    expect(await CompanyModel.countDocuments()).toBe(0);
  });

  it('aynı anahtar ve gövde ilk sonucu döner, ikinci firma açmaz', async () => {
    const { testApp, auth } = await setup();
    const key = idempotencyKey();

    const first = await createCompanyRequest(
      testApp,
      auth,
      { name: 'Tekrar Yapı', opsNote: 'x' },
      key,
    );
    const second = await createCompanyRequest(
      testApp,
      auth,
      { opsNote: 'x', name: 'Tekrar Yapı' },
      key,
    );

    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(await CompanyModel.countDocuments()).toBe(1);
  });

  it('aynı anahtar ile eşzamanlı iki istek tek firma ve aynı sonucu üretir', async () => {
    const { testApp, auth } = await setup();
    const key = idempotencyKey();

    const results = await Promise.all([
      createCompanyRequest(testApp, auth, { name: 'Eşzamanlı Yapı' }, key),
      createCompanyRequest(testApp, auth, { name: 'Eşzamanlı Yapı' }, key),
    ]);

    expect(results.map((res) => res.status)).toEqual([201, 201]);
    expect(results[0].body.data.id).toBe(results[1].body.data.id);
    expect(await CompanyModel.countDocuments()).toBe(1);
    expect(await IdempotencyRecordModel.countDocuments()).toBe(1);
    expect(await PlatformLogModel.countDocuments({ action: 'company.create' })).toBe(1);
  });

  it('aynı anahtar farklı gövdeyle 422 IDEMPOTENCY_MISMATCH', async () => {
    const { testApp, auth } = await setup();
    const key = idempotencyKey();
    await createCompanyRequest(testApp, auth, { name: 'Bir' }, key);

    const res = await createCompanyRequest(testApp, auth, { name: 'İki' }, key);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IDEMPOTENCY_MISMATCH');
    expect(await CompanyModel.countDocuments()).toBe(1);
  });

  it('24 saatten eski anahtar 422 IDEMPOTENCY_EXPIRED', async () => {
    const { testApp, auth, secret } = await setup();
    const key = idempotencyKey();
    await createCompanyRequest(testApp, auth, { name: 'Eski Yapı' }, key);

    testApp.clock.advance(24 * 60 * 60 * 1000 + 1000);
    const freshAuth = await signInPlatformAgain(testApp, secret);
    const res = await createCompanyRequest(testApp, freshAuth, { name: 'Eski Yapı' }, key);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('IDEMPOTENCY_EXPIRED');
  });

  it('doğrulama hatası kayıt açmaz; düzeltilmiş istek yeni anahtarla gelir', async () => {
    const { testApp, auth } = await setup();
    const key = idempotencyKey();
    expect((await createCompanyRequest(testApp, auth, { name: ' ' }, key)).status).toBe(400);
    expect(await IdempotencyRecordModel.countDocuments()).toBe(0);
  });
});

/** Access token 15 dk geçerli; uzun saat ilerletmelerinden sonra yeni ürün sahibi oturumu açılır. */
async function signInPlatformAgain(testApp: TestApp, secret: string) {
  const { pendingToken } = await platformPassword(testApp);
  const res = await request(testApp.app)
    .post('/platform/auth/totp/verify')
    .set('Authorization', `Bearer ${pendingToken}`)
    .send({ code: await totpCode(testApp, secret) });
  return { Authorization: `Bearer ${res.body.data.accessToken as string}` };
}

describe('GET /platform/companies ve /platform/companies/:id', () => {
  it('ada göre arar, duruma göre filtreler; kullanıcı sayısı ve tarihleri verir', async () => {
    const { testApp, auth } = await setup();
    const today = businessToday(testApp.clock);
    const active = await createCompany({ name: 'Aktif Yapı' });
    await createUser(active);
    await createUser(active);
    await createCompany({ name: 'Durdurulmuş Yapı', isSuspended: true });
    const ended = addDays(today, -3);
    await createCompany({
      name: 'Bitmiş Yapı',
      serviceEndedAt: ended,
      viewUntil: addDays(ended, 30),
      retainUntil: addDays(ended, 180),
    });

    const all = await request(testApp.app).get('/platform/companies').set(auth);
    expect(all.body.data).toMatchObject({ page: 1, limit: 50, total: 3 });

    const search = await request(testApp.app)
      .get('/platform/companies')
      .query({ q: 'aktif' })
      .set(auth);
    expect(search.body.data.items).toHaveLength(1);
    expect(search.body.data.items[0]).toMatchObject({ name: 'Aktif Yapı', userCount: 2 });

    const viewOnly = await request(testApp.app)
      .get('/platform/companies')
      .query({ status: 'view_only' })
      .set(auth);
    expect(viewOnly.body.data.items.map((item: { name: string }) => item.name)).toEqual([
      'Bitmiş Yapı',
    ]);
    expect(viewOnly.body.data.items[0].service).toEqual({
      state: 'view_only',
      serviceEndedAt: ended,
      viewUntil: addDays(ended, 30),
      retainUntil: addDays(ended, 180),
    });

    const suspended = await request(testApp.app)
      .get('/platform/companies')
      .query({ status: 'suspended' })
      .set(auth);
    expect(suspended.body.data.total).toBe(1);
  });

  it('detay: kullanıcılar ve işletim geçmişi; şifre bilgisi dönmez', async () => {
    const { testApp, auth } = await setup();
    const created = await createCompanyRequest(testApp, auth, { name: 'Detay Yapı' });
    await createUserRequest(testApp, auth, created.body.data.id, {
      name: 'Ayşe Demir',
      username: 'ayse',
    });

    const res = await request(testApp.app)
      .get(`/platform/companies/${created.body.data.id}`)
      .set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.company).toMatchObject({ name: 'Detay Yapı', userCount: 1 });
    expect(res.body.data.users).toEqual([
      expect.objectContaining({ username: 'ayse', isActive: true, mustChangePassword: true }),
    ]);
    expect(res.body.data.history.map((entry: { action: string }) => entry.action)).toEqual([
      'user.create',
      'company.create',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|refreshTokens|temporaryPassword/);
  });

  it('olmayan veya geçersiz kimlik 404', async () => {
    const { testApp, auth } = await setup();
    expect(
      (await request(testApp.app).get('/platform/companies/64b000000000000000000000').set(auth))
        .status,
    ).toBe(404);
    expect((await request(testApp.app).get('/platform/companies/gecersiz').set(auth)).status).toBe(
      404,
    );
  });
});

describe('POST /platform/companies/:id/users', () => {
  it('geçici şifre bir kez gösterilir; kullanıcı onunla girer ve şifre değiştirmeden ilerleyemez', async () => {
    const { testApp, auth } = await setup();
    const company = await createCompany();

    const res = await createUserRequest(testApp, auth, company._id.toString(), {
      name: 'Mehmet Yılmaz',
      username: ' Mehmet.YILMAZ ',
      email: 'mehmet@example.com',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      username: 'mehmet.yılmaz',
      mustChangePassword: true,
      isActive: true,
    });
    expect(res.body.data.temporaryPassword).toMatch(/^[A-Za-z0-9]{12}$/);
    const expiresAt = new Date(res.body.data.tempPasswordExpiresAt).getTime();
    expect(expiresAt - testApp.clock.now().getTime()).toBe(72 * 60 * 60 * 1000);

    const login = await request(testApp.app)
      .post('/auth/login')
      .send({ username: 'mehmet.yılmaz', password: res.body.data.temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.mustChangePassword).toBe(true);

    const logs = await PlatformLogModel.find({ action: 'user.create' });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain(res.body.data.temporaryPassword);
  });

  it('tekrar gönderimde ikinci kullanıcı açılmaz ve geçici şifre yeniden gösterilmez', async () => {
    const { testApp, auth } = await setup();
    const company = await createCompany();
    const key = idempotencyKey();
    const body = { name: 'Zeynep Ak', username: 'zeynep' };

    const first = await createUserRequest(testApp, auth, company._id.toString(), body, key);
    const second = await createUserRequest(testApp, auth, company._id.toString(), body, key);

    expect(second.status).toBe(201);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(second.body.data.temporaryPassword).toBeNull();
    expect(second.body.message).toMatch(/yeniden gösterilemez/);
    expect(await UserModel.countDocuments()).toBe(1);
    expect(JSON.stringify(await IdempotencyRecordModel.find())).not.toContain(
      first.body.data.temporaryPassword,
    );
  });

  it('kullanıcı adı sistem genelinde tek: 409 "Bu kullanıcı adı kullanılıyor"', async () => {
    const { testApp, auth } = await setup();
    const a = await createCompany();
    const b = await createCompany();
    await createUserRequest(testApp, auth, a._id.toString(), { name: 'Ali Veli', username: 'ali' });

    const res = await createUserRequest(testApp, auth, b._id.toString(), {
      name: 'Ali Başka',
      username: 'ALİ',
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'USERNAME_EXISTS',
      message: 'Bu kullanıcı adı kullanılıyor',
    });
  });

  it('olmayan firmaya kullanıcı eklenemez; geçersiz alanlar 400', async () => {
    const { testApp, auth } = await setup();
    expect(
      (
        await createUserRequest(testApp, auth, '64b000000000000000000000', {
          name: 'Ali Veli',
          username: 'ali',
        })
      ).status,
    ).toBe(404);
    const company = await createCompany();
    expect(
      (
        await createUserRequest(testApp, auth, company._id.toString(), {
          name: 'A',
          username: 'a b',
        })
      ).status,
    ).toBe(400);
  });
});

describe('kullanıcı pasifleştirme ve şifre sıfırlama', () => {
  async function userWithSession(testApp: TestApp) {
    const company = await createCompany();
    const { user } = await createUser(company);
    const session = await loginCustomer(testApp, user.username);
    return { company, user, session };
  }

  it('pasifleştirme gerekçe ister, oturumları hemen kapatır ve kayıt düşer; aktifleştirme girişe açar', async () => {
    const { testApp, auth } = await setup();
    const { user, session } = await userWithSession(testApp);
    testApp.clock.advance(1000);

    const noReason = await request(testApp.app)
      .patch(`/platform/users/${user._id.toString()}`)
      .set(auth)
      .send({ isActive: false, expectedUpdatedAt: user.updatedAt.toISOString() });
    expect(noReason.status).toBe(400);

    const res = await request(testApp.app)
      .patch(`/platform/users/${user._id.toString()}`)
      .set(auth)
      .send({
        isActive: false,
        reason: 'İşten ayrıldı',
        expectedUpdatedAt: user.updatedAt.toISOString(),
      });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    expect(
      (
        await request(testApp.app)
          .get('/auth/me')
          .set('Authorization', `Bearer ${session.accessToken}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(testApp.app)
          .post('/auth/refresh')
          .send({ refreshToken: session.refreshToken })
      ).status,
    ).toBe(401);
    const login = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: 'Gizli-Sifre-1' });
    expect(login.status).toBe(403);
    expect(login.body).toMatchObject({
      code: 'ACCESS_CLOSED',
      details: { state: 'user_inactive' },
    });

    const log = await PlatformLogModel.findOne({ action: 'user.deactivate' });
    expect(log).toMatchObject({ reason: 'İşten ayrıldı' });

    const reactivated = await request(testApp.app)
      .patch(`/platform/users/${user._id.toString()}`)
      .set(auth)
      .send({ isActive: true, reason: 'Geri döndü', expectedUpdatedAt: res.body.data.updatedAt });
    expect(reactivated.status).toBe(200);
    await loginCustomer(testApp, user.username);
  });

  it('eski expectedUpdatedAt ile 409 ve güncel kayıt', async () => {
    const { testApp, auth } = await setup();
    const { user } = await userWithSession(testApp);
    await UserModel.updateOne({ _id: user._id }, { $set: { name: 'Başka Ad' } });

    const res = await request(testApp.app)
      .patch(`/platform/users/${user._id.toString()}`)
      .set(auth)
      .send({ isActive: false, reason: 'Deneme', expectedUpdatedAt: user.updatedAt.toISOString() });
    expect(res.status).toBe(409);
    expect(res.body.details.current).toMatchObject({ name: 'Başka Ad', isActive: true });
  });

  it('şifre sıfırlama yeni geçici şifre üretir, oturumları düşürür ve ilk girişte değişim ister', async () => {
    const { testApp, auth } = await setup();
    const { user, session } = await userWithSession(testApp);
    testApp.clock.advance(1000);

    expect(
      (
        await request(testApp.app)
          .post(`/platform/users/${user._id.toString()}/reset-password`)
          .set(auth)
          .send({})
      ).status,
    ).toBe(400);

    const res = await request(testApp.app)
      .post(`/platform/users/${user._id.toString()}/reset-password`)
      .set(auth)
      .send({ reason: 'Şifresini unuttu' });
    expect(res.status).toBe(200);
    expect(res.body.data.temporaryPassword).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(res.body.data.user.mustChangePassword).toBe(true);

    expect(
      (
        await request(testApp.app)
          .get('/auth/me')
          .set('Authorization', `Bearer ${session.accessToken}`)
      ).status,
    ).toBe(401);
    expect(
      (
        await request(testApp.app)
          .post('/auth/refresh')
          .send({ refreshToken: session.refreshToken })
      ).status,
    ).toBe(401);
    const old = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: 'Gizli-Sifre-1' });
    expect(old.status).toBe(401);

    const login = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: res.body.data.temporaryPassword });
    expect(login.body.data.mustChangePassword).toBe(true);

    const logs = await PlatformLogModel.find({ action: 'user.reset_password' });
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain(res.body.data.temporaryPassword);
  });

  it('müşteri firma ve kullanıcı hesabı açamaz', async () => {
    const { testApp } = await setup();
    const { session, company } = await userWithSession(testApp);
    const res = await request(testApp.app)
      .post(`/platform/companies/${company._id.toString()}/users`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('Idempotency-Key', idempotencyKey())
      .send({ name: 'Ali Veli', username: 'ali' });
    expect(res.status).toBe(401);
  });
});
