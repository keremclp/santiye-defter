import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { UserModel } from '../src/models/user.js';
import { buildTestApp, useTestDatabase, type TestApp } from './helpers/app.js';
import {
  createCompany,
  createCustomer,
  createUser,
  DEFAULT_PASSWORD,
  loginCustomer,
} from './helpers/factories.js';

useTestDatabase();

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

function setup(): TestApp {
  return buildTestApp();
}

describe('POST /auth/login', () => {
  it('kullanıcı adı ve şifreyle token çifti, kullanıcı ve mustChangePassword döner', async () => {
    const testApp = setup();
    const company = await createCompany({ displayName: 'Yıldız Yapı' });
    const { user } = await createUser(company, { name: 'Ayşe Demir' });

    const res = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      mustChangePassword: false,
      user: {
        id: user._id.toString(),
        name: 'Ayşe Demir',
        username: user.username,
        companyId: company._id.toString(),
        mustChangePassword: false,
      },
      company: { displayName: 'Yıldız Yapı' },
      service: { state: 'active' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|refreshTokens/);
  });

  it('kullanıcı adı Türkçe kurallarla küçük harfe çevrilerek aranır', async () => {
    const testApp = setup();
    const company = await createCompany();
    await createUser(company, { username: 'ışık.yapı' });

    const res = await request(testApp.app)
      .post('/auth/login')
      .send({ username: '  IŞIK.YAPI ', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('hatalı şifre ve bilinmeyen kullanıcı aynı genel hatayı alır', async () => {
    const testApp = setup();
    const { user } = await createUser(await createCompany());

    const wrongPassword = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: 'yanlis-sifre' });
    const unknownUser = await request(testApp.app)
      .post('/auth/login')
      .send({ username: 'olmayan', password: 'yanlis-sifre' });

    for (const res of [wrongPassword, unknownUser]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        success: false,
        message: 'Kullanıcı adı veya şifre hatalı',
        code: 'UNAUTHORIZED',
      });
    }
  });

  it('süresi dolmuş geçici şifreyle giriş yapılamaz', async () => {
    const testApp = setup();
    const { user } = await createUser(await createCompany(), {
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(testApp.clock.now().getTime() - 1000),
    });

    const res = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Geçici şifrenizin süresi doldu/);
  });

  it('eksik alanlarda 400 VALIDATION', async () => {
    const res = await request(setup().app).post('/auth/login').send({ username: 'a' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });
});

describe('deneme sınırı', () => {
  it('aynı kullanıcı adında 5 hatalı denemeden sonra doğru şifre de 429 alır; başka kullanıcı etkilenmez', async () => {
    const testApp = setup();
    const company = await createCompany();
    const { user } = await createUser(company);
    const { user: other } = await createUser(company);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const res = await request(testApp.app)
        .post('/auth/login')
        .send({ username: user.username, password: 'yanlis' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: DEFAULT_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ code: 'RATE_LIMITED' });
    expect(blocked.body.message).toMatch(/dakika sonra tekrar deneyin/);

    await loginCustomer(testApp, other.username);

    testApp.clock.advance(5 * 60 * 1000 + 1);
    await loginCustomer(testApp, user.username);
  });

  it('aynı IP’den çok sayıda hatalı deneme farklı kullanıcı adlarında da sınırlanır', async () => {
    const testApp = setup();
    const { user } = await createUser(await createCompany());

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await request(testApp.app)
        .post('/auth/login')
        .send({ username: `tahmin${attempt}`, password: 'yanlis' });
    }

    const res = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(429);
  });
});

describe('POST /auth/refresh', () => {
  it('yeni çift üretir; kullanılan refresh token geçersiz olur', async () => {
    const testApp = setup();
    const { refreshToken } = await createCustomer(testApp);

    const first = await request(testApp.app).post('/auth/refresh').send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.data.refreshToken).not.toBe(refreshToken);

    const reused = await request(testApp.app).post('/auth/refresh').send({ refreshToken });
    expect(reused.status).toBe(401);
    expect(reused.body.code).toBe('UNAUTHORIZED');

    const me = await request(testApp.app).get('/auth/me').set(bearer(first.body.data.accessToken));
    expect(me.status).toBe(200);
  });

  it('aynı refresh token ile eşzamanlı iki istekten yalnız biri başarılı olur', async () => {
    const testApp = setup();
    const { refreshToken } = await createCustomer(testApp);

    const results = await Promise.all([
      request(testApp.app).post('/auth/refresh').send({ refreshToken }),
      request(testApp.app).post('/auth/refresh').send({ refreshToken }),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 401]);
  });

  it('access token refresh olarak, süresi dolmuş refresh ise hiç kullanılamaz', async () => {
    const testApp = setup();
    const { accessToken, refreshToken } = await createCustomer(testApp);

    expect(
      (await request(testApp.app).post('/auth/refresh').send({ refreshToken: accessToken })).status,
    ).toBe(401);

    testApp.clock.advance(30 * 24 * 60 * 60 * 1000 + 1000);
    expect((await request(testApp.app).post('/auth/refresh').send({ refreshToken })).status).toBe(
      401,
    );
  });

  it('access token 15 dakika sonra geçersiz olur', async () => {
    const testApp = setup();
    const { accessToken } = await createCustomer(testApp);

    testApp.clock.advance(15 * 60 * 1000 + 1000);
    const res = await request(testApp.app).get('/auth/me').set(bearer(accessToken));
    expect(res.status).toBe(401);
  });

  it('kullanıcı başına en fazla son 10 refresh token saklanır', async () => {
    const testApp = setup();
    const { user } = await createUser(await createCompany());
    const sessions = [];
    for (let index = 0; index < 11; index += 1)
      sessions.push(await loginCustomer(testApp, user.username));

    const stored = await UserModel.findById(user._id).select('+refreshTokens');
    expect(stored?.refreshTokens).toHaveLength(10);
    expect(
      (
        await request(testApp.app)
          .post('/auth/refresh')
          .send({ refreshToken: sessions[0]!.refreshToken })
      ).status,
    ).toBe(401);
    expect(
      (
        await request(testApp.app)
          .post('/auth/refresh')
          .send({ refreshToken: sessions[10]!.refreshToken })
      ).status,
    ).toBe(200);
  });
});

describe('POST /auth/logout', () => {
  it('verilen refresh token silinir, diğer oturum açık kalır', async () => {
    const testApp = setup();
    const { user } = await createUser(await createCompany());
    const a = await loginCustomer(testApp, user.username);
    const b = await loginCustomer(testApp, user.username);

    const res = await request(testApp.app)
      .post('/auth/logout')
      .set(bearer(a.accessToken))
      .send({ refreshToken: a.refreshToken });
    expect(res.status).toBe(200);

    expect(
      (await request(testApp.app).post('/auth/refresh').send({ refreshToken: a.refreshToken }))
        .status,
    ).toBe(401);
    expect(
      (await request(testApp.app).post('/auth/refresh').send({ refreshToken: b.refreshToken }))
        .status,
    ).toBe(200);
  });

  it('refresh token verilmezse bütün refresh token’lar silinir', async () => {
    const testApp = setup();
    const { user } = await createUser(await createCompany());
    const a = await loginCustomer(testApp, user.username);
    const b = await loginCustomer(testApp, user.username);

    await request(testApp.app).post('/auth/logout').set(bearer(a.accessToken)).send({});

    for (const session of [a, b]) {
      expect(
        (
          await request(testApp.app)
            .post('/auth/refresh')
            .send({ refreshToken: session.refreshToken })
        ).status,
      ).toBe(401);
    }
  });

  it('oturumsuz çıkış 401', async () => {
    expect((await request(setup().app).post('/auth/logout').send({})).status).toBe(401);
  });
});

describe('GET/PATCH /auth/me', () => {
  it('kullanıcı, firma görünen adı ve etkin hizmet durumu döner', async () => {
    const testApp = setup();
    const { accessToken, user, company } = await createCustomer(testApp, { name: 'Resmi Ad' });

    const res = await request(testApp.app).get('/auth/me').set(bearer(accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      user: {
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        companyId: company._id.toString(),
        mustChangePassword: false,
        phone: '',
        email: '',
        updatedAt: user.updatedAt.toISOString(),
      },
      company: { displayName: 'Resmi Ad' },
      service: { state: 'active', serviceEndedAt: null, viewUntil: null, retainUntil: null },
    });
  });

  it('profil güncellenir; eski expectedUpdatedAt ile 409 ve güncel kayıt döner', async () => {
    const testApp = setup();
    const { accessToken, user } = await createCustomer(testApp);
    const original = user.updatedAt.toISOString();

    const updated = await request(testApp.app).patch('/auth/me').set(bearer(accessToken)).send({
      name: 'Yeni Ad',
      phone: '0555 000 00 00',
      email: 'yeni@example.com',
      expectedUpdatedAt: original,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      name: 'Yeni Ad',
      phone: '0555 000 00 00',
      email: 'yeni@example.com',
    });

    const stale = await request(testApp.app)
      .patch('/auth/me')
      .set(bearer(accessToken))
      .send({ name: 'Başka Ad', expectedUpdatedAt: original });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({
      success: false,
      code: 'CONFLICT',
      message: 'Kayıt başka bir yerde güncellendi',
      details: { current: { name: 'Yeni Ad' } },
    });
  });

  it('expectedUpdatedAt zorunlu; kullanıcı adı profilden değiştirilemez', async () => {
    const testApp = setup();
    const { accessToken, user } = await createCustomer(testApp);

    const missing = await request(testApp.app)
      .patch('/auth/me')
      .set(bearer(accessToken))
      .send({ name: 'Ad' });
    expect(missing.status).toBe(400);

    await request(testApp.app)
      .patch('/auth/me')
      .set(bearer(accessToken))
      .send({ username: 'baskasi', expectedUpdatedAt: user.updatedAt.toISOString() });
    expect((await UserModel.findById(user._id))?.username).toBe(user.username);
  });
});

describe('ilk şifre (mustChangePassword)', () => {
  async function temporaryUser(testApp: TestApp) {
    const { user } = await createUser(await createCompany(), {
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(testApp.clock.now().getTime() + 60_000),
      password: 'GeciciSifre12',
    });
    const res = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: 'GeciciSifre12' });
    expect(res.body.data.mustChangePassword).toBe(true);
    return { user, ...res.body.data } as {
      user: typeof user;
      accessToken: string;
      refreshToken: string;
    };
  }

  it('şifre değişmeden yalnız /auth/password ve /auth/logout açık', async () => {
    const testApp = setup();
    const { accessToken } = await temporaryUser(testApp);

    const me = await request(testApp.app).get('/auth/me').set(bearer(accessToken));
    expect(me.status).toBe(403);
    expect(me.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const logout = await request(testApp.app)
      .post('/auth/logout')
      .set(bearer(accessToken))
      .send({});
    expect(logout.status).toBe(200);
  });

  it('kişisel şifre oluşturulunca yeni oturum verilir; eski oturumlar düşer', async () => {
    const testApp = setup();
    const { accessToken, refreshToken } = await temporaryUser(testApp);
    testApp.clock.advance(1000);

    const res = await request(testApp.app)
      .patch('/auth/password')
      .set(bearer(accessToken))
      .send({ currentPassword: 'GeciciSifre12', newPassword: 'Kisisel-Sifre-9' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.mustChangePassword).toBe(false);
    expect(res.body.data.accessToken).toEqual(expect.any(String));

    expect((await request(testApp.app).get('/auth/me').set(bearer(accessToken))).status).toBe(401);
    expect((await request(testApp.app).post('/auth/refresh').send({ refreshToken })).status).toBe(
      401,
    );
    expect(
      (await request(testApp.app).get('/auth/me').set(bearer(res.body.data.accessToken))).status,
    ).toBe(200);
  });
});

describe('PATCH /auth/password', () => {
  it('başarılı değişim bütün oturumları hemen düşürür ve yeni oturum vermez', async () => {
    const testApp = setup();
    const { user } = await createUser(await createCompany());
    const a = await loginCustomer(testApp, user.username);
    const b = await loginCustomer(testApp, user.username);
    testApp.clock.advance(1000);

    const res = await request(testApp.app)
      .patch('/auth/password')
      .set(bearer(a.accessToken))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'Yeni-Sifre-77' });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.message).toMatch(/yeni şifrenizle giriş yapın/);

    for (const session of [a, b]) {
      expect(
        (await request(testApp.app).get('/auth/me').set(bearer(session.accessToken))).status,
      ).toBe(401);
      expect(
        (
          await request(testApp.app)
            .post('/auth/refresh')
            .send({ refreshToken: session.refreshToken })
        ).status,
      ).toBe(401);
    }
    await loginCustomer(testApp, user.username, 'Yeni-Sifre-77');
    const old = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: DEFAULT_PASSWORD });
    expect(old.status).toBe(401);
  });

  it('mevcut şifre hatalıysa veya yeni şifre 8 karakterden kısaysa değişmez', async () => {
    const testApp = setup();
    const { accessToken } = await createCustomer(testApp);

    const wrong = await request(testApp.app)
      .patch('/auth/password')
      .set(bearer(accessToken))
      .send({ currentPassword: 'yanlis', newPassword: 'Yeni-Sifre-77' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toBe('Mevcut şifre hatalı.');

    const short = await request(testApp.app)
      .patch('/auth/password')
      .set(bearer(accessToken))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'kisa' });
    expect(short.status).toBe(400);
    expect(short.body.details.issues[0].message).toBe('Şifre en az 8 karakter olmalı.');

    expect((await request(testApp.app).get('/auth/me').set(bearer(accessToken))).status).toBe(200);
  });
});
