import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { runResetTwoFactor } from '../src/cli/reset-2fa.js';
import { createDeps } from '../src/deps.js';
import { PlatformAdminModel } from '../src/models/platform-admin.js';
import { PlatformLogModel } from '../src/models/platform-log.js';
import { ensureBootstrapAdmin } from '../src/services/platform-auth.js';
import { buildTestApp, testConfig, useTestDatabase, type TestApp } from './helpers/app.js';
import {
  createCustomer,
  createPlatformAdmin,
  enrollPlatformAdmin,
  platformPassword,
  PLATFORM_PASSWORD,
  PLATFORM_USERNAME,
  totpCode,
} from './helpers/factories.js';

useTestDatabase();

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function verifyCode(testApp: TestApp, pendingToken: string, code: string) {
  return request(testApp.app)
    .post('/platform/auth/totp/verify')
    .set(bearer(pendingToken))
    .send({ code });
}

describe('bootstrap hesabı', () => {
  it('PLATFORM_BOOTSTRAP_* ile hesap bir kez oluşur, TOTP kurulumu zorunlu kalır', async () => {
    const deps = createDeps({
      config: testConfig({
        platformBootstrap: { username: 'Patron', password: PLATFORM_PASSWORD },
      }),
    });

    expect(await ensureBootstrapAdmin(deps)).toBe('created');
    expect(await ensureBootstrapAdmin(deps)).toBe('exists');

    const admins = await PlatformAdminModel.find();
    expect(admins).toHaveLength(1);
    expect(admins[0]).toMatchObject({ username: 'patron', totpConfirmedAt: null });
    expect(await PlatformLogModel.countDocuments({ action: 'admin.bootstrap' })).toBe(1);
  });

  it('değişkenler yoksa hesap oluşturmaz', async () => {
    expect(await ensureBootstrapAdmin(createDeps({ config: testConfig() }))).toBe('skipped');
    expect(await PlatformAdminModel.countDocuments()).toBe(0);
  });
});

describe('ilk giriş ve TOTP kurulumu', () => {
  it('şifre adımı yalnız ara token ve kurulum gerekliliği döner; access token vermez', async () => {
    const testApp = buildTestApp();
    await createPlatformAdmin();

    const res = await request(testApp.app)
      .post('/platform/auth/login')
      .send({ username: PLATFORM_USERNAME, password: PLATFORM_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ pendingToken: expect.any(String), totpSetupRequired: true });
    expect(
      (
        await request(testApp.app)
          .get('/platform/companies')
          .set(bearer(res.body.data.pendingToken))
      ).status,
    ).toBe(401);
  });

  it('hatalı şifre genel hata alır', async () => {
    const testApp = buildTestApp();
    await createPlatformAdmin();
    const res = await request(testApp.app)
      .post('/platform/auth/login')
      .send({ username: PLATFORM_USERNAME, password: 'yanlis' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Kullanıcı adı veya şifre hatalı');
  });

  it('kurulum: otpauth adresi, doğru kodla onay ve 10 kurtarma kodu bir kez', async () => {
    const testApp = buildTestApp();
    await createPlatformAdmin();
    const { pendingToken } = await platformPassword(testApp);

    const setup = await request(testApp.app)
      .post('/platform/auth/totp/setup')
      .set(bearer(pendingToken));
    expect(setup.status).toBe(200);
    expect(setup.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\/.+secret=/);
    expect(setup.body.data.otpauthUrl).toContain('patron');

    const wrong = await verifyCode(testApp, pendingToken, '000000');
    expect(wrong.status).toBe(401);

    const ok = await verifyCode(
      testApp,
      pendingToken,
      await totpCode(testApp, setup.body.data.secret),
    );
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
    expect(ok.body.data.recoveryCodes).toHaveLength(10);
    expect(new Set(ok.body.data.recoveryCodes).size).toBe(10);

    const admin = await PlatformAdminModel.findOne().select(
      '+totpSecretEncrypted +recoveryCodeHashes',
    );
    expect(admin?.totpConfirmedAt).toBeInstanceOf(Date);
    expect(admin?.totpSecretEncrypted).not.toContain(setup.body.data.secret);
    expect(admin?.recoveryCodeHashes).toHaveLength(10);
    expect(admin?.recoveryCodeHashes).not.toContain(ok.body.data.recoveryCodes[0]);

    expect(
      (await request(testApp.app).get('/platform/companies').set(bearer(ok.body.data.accessToken)))
        .status,
    ).toBe(200);

    const again = await request(testApp.app)
      .post('/platform/auth/totp/setup')
      .set(bearer(pendingToken));
    expect(again.status).toBe(409);
  });

  it('kurulum başlatılmadan kod doğrulanamaz', async () => {
    const testApp = buildTestApp();
    await createPlatformAdmin();
    const { pendingToken } = await platformPassword(testApp);
    expect((await verifyCode(testApp, pendingToken, '123456')).status).toBe(409);
  });

  it('ara token 5 dakika geçerli', async () => {
    const testApp = buildTestApp();
    await createPlatformAdmin();
    const { pendingToken } = await platformPassword(testApp);
    testApp.clock.advance(5 * 60 * 1000 + 1000);
    expect(
      (await request(testApp.app).post('/platform/auth/totp/setup').set(bearer(pendingToken)))
        .status,
    ).toBe(401);
  });
});

describe('TOTP ile giriş', () => {
  it('kurulu hesapta şifre + kodla giriş; ±1 zaman adımı kabul, aynı kod ikinci kez reddedilir', async () => {
    const testApp = buildTestApp();
    const { secret } = await enrollPlatformAdmin(testApp);

    const first = await platformPassword(testApp);
    expect(first.totpSetupRequired).toBe(false);

    // Kurulumda kullanılan adımdan uzaklaşılır; bir önceki zaman adımının kodu (30 sn tolerans) kabul edilir.
    testApp.clock.advance(60_000);
    testApp.clock.advance(-30_000);
    const previousStepCode = await totpCode(testApp, secret);
    testApp.clock.advance(30_000);
    const ok = await verifyCode(testApp, first.pendingToken, previousStepCode);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.data.recoveryCodes).toBeUndefined();

    const second = await platformPassword(testApp);
    expect((await verifyCode(testApp, second.pendingToken, previousStepCode)).status).toBe(401);

    testApp.clock.advance(90_000);
    expect((await verifyCode(testApp, second.pendingToken, previousStepCode)).status).toBe(401);
  });

  it('5 hatalı ikinci adımda 15 dakika kilit; doğru kod da reddedilir ve kayıt düşülür', async () => {
    const testApp = buildTestApp();
    const { secret } = await enrollPlatformAdmin(testApp);
    const { pendingToken } = await platformPassword(testApp);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await verifyCode(testApp, pendingToken, '000000')).status).toBe(401);
    }
    const locked = await verifyCode(testApp, pendingToken, await totpCode(testApp, secret));
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('RATE_LIMITED');
    expect(await PlatformLogModel.countDocuments({ action: 'admin.second_factor_locked' })).toBe(1);

    testApp.clock.advance(15 * 60 * 1000 + 1000);
    const fresh = await platformPassword(testApp);
    expect(
      (await verifyCode(testApp, fresh.pendingToken, await totpCode(testApp, secret))).status,
    ).toBe(200);
  });
});

describe('kurtarma kodları', () => {
  it('kurtarma koduyla giriş; kod tek kullanımlık', async () => {
    const testApp = buildTestApp();
    const { recoveryCodes } = await enrollPlatformAdmin(testApp);
    const code = recoveryCodes[3]!;

    const first = await platformPassword(testApp);
    const ok = await request(testApp.app)
      .post('/platform/auth/recovery')
      .set(bearer(first.pendingToken))
      .send({ recoveryCode: code.toLowerCase() });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({
      accessToken: expect.any(String),
      remainingRecoveryCodes: 9,
    });
    expect(await PlatformLogModel.countDocuments({ action: 'admin.recovery_code_used' })).toBe(1);

    const second = await platformPassword(testApp);
    const reused = await request(testApp.app)
      .post('/platform/auth/recovery')
      .set(bearer(second.pendingToken))
      .send({ recoveryCode: code });
    expect(reused.status).toBe(401);
  });

  it('yenileme geçerli TOTP kodu ister; yeni 10 kod verir, eskiler geçersiz olur', async () => {
    const testApp = buildTestApp();
    const { secret, accessToken, recoveryCodes } = await enrollPlatformAdmin(testApp);

    const wrong = await request(testApp.app)
      .post('/platform/auth/recovery-codes/regenerate')
      .set(bearer(accessToken))
      .send({ code: '000000' });
    expect(wrong.status).toBe(401);

    const res = await request(testApp.app)
      .post('/platform/auth/recovery-codes/regenerate')
      .set(bearer(accessToken))
      .send({ code: await totpCode(testApp, secret) });
    expect(res.status).toBe(200);
    expect(res.body.data.recoveryCodes).toHaveLength(10);

    const { pendingToken } = await platformPassword(testApp);
    const old = await request(testApp.app)
      .post('/platform/auth/recovery')
      .set(bearer(pendingToken))
      .send({ recoveryCode: recoveryCodes[0] });
    expect(old.status).toBe(401);
    const fresh = await request(testApp.app)
      .post('/platform/auth/recovery')
      .set(bearer(pendingToken))
      .send({ recoveryCode: res.body.data.recoveryCodes[0] });
    expect(fresh.status).toBe(200);
  });
});

describe('giriş sonrası TOTP yeniden kurulumu', () => {
  async function loginWith(testApp: TestApp, secret: string) {
    const { pendingToken } = await platformPassword(testApp);
    return verifyCode(testApp, pendingToken, await totpCode(testApp, secret));
  }

  it('mevcut kodla başlar; yeni anahtar onaylanana kadar eskisi geçerli; onaydan sonra yalnız yenisi', async () => {
    const testApp = buildTestApp();
    const { secret: oldSecret, accessToken, recoveryCodes } = await enrollPlatformAdmin(testApp);
    const reset = (path: string, body: Record<string, unknown>) =>
      request(testApp.app)
        .post(`/platform/auth/totp/reset${path}`)
        .set(bearer(accessToken))
        .send(body);

    // Kurulum başlatılmadan onay yok; hatalı mevcut kod denemeye sayılır.
    expect((await reset('/confirm', { code: '123456' })).status).toBe(409);
    expect((await reset('', { code: '000000' })).status).toBe(401);
    expect((await reset('', {})).status).toBe(400);
    expect((await reset('', { code: '123456', recoveryCode: 'X' })).status).toBe(400);

    const started = await reset('', { code: await totpCode(testApp, oldSecret) });
    expect(started.status, JSON.stringify(started.body)).toBe(200);
    expect(started.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    const newSecret = started.body.data.secret as string;
    expect(newSecret).not.toBe(oldSecret);

    // Onaylanmadan eski anahtarla giriş sürer.
    testApp.clock.advance(30_000);
    expect((await loginWith(testApp, oldSecret)).status).toBe(200);

    testApp.clock.advance(30_000);
    expect((await reset('/confirm', { code: '000000' })).status).toBe(401);
    const confirmed = await reset('/confirm', { code: await totpCode(testApp, newSecret) });
    expect(confirmed.status, JSON.stringify(confirmed.body)).toBe(200);
    expect(confirmed.body.message).toBe('İki aşamalı doğrulama yeniden kuruldu.');
    // Onayda kullanılan kod girişte ikinci kez kabul edilmez.
    expect((await loginWith(testApp, newSecret)).status).toBe(401);

    testApp.clock.advance(30_000);
    expect((await loginWith(testApp, oldSecret)).status).toBe(401);
    testApp.clock.advance(30_000);
    expect((await loginWith(testApp, newSecret)).status).toBe(200);
    expect((await reset('/confirm', { code: await totpCode(testApp, newSecret) })).status).toBe(
      409,
    );

    // Kurtarma kodları değişmez.
    const { pendingToken } = await platformPassword(testApp);
    const recovery = await request(testApp.app)
      .post('/platform/auth/recovery')
      .set(bearer(pendingToken))
      .send({ recoveryCode: recoveryCodes[0] });
    expect(recovery.status).toBe(200);

    const admin = await PlatformAdminModel.findOne().select('+pendingTotpSecretEncrypted');
    expect(admin!.pendingTotpSecretEncrypted).toBeNull();
    expect(await PlatformLogModel.countDocuments({ action: 'admin.totp_reset' })).toBe(1);
    expect(JSON.stringify(await PlatformLogModel.find().lean())).not.toContain(newSecret);
  });

  it('telefon kaybolunca kurtarma koduyla girilip kurtarma koduyla yeniden kurulur; kod tek kullanımlık', async () => {
    const testApp = buildTestApp();
    const { recoveryCodes } = await enrollPlatformAdmin(testApp);
    const { pendingToken } = await platformPassword(testApp);
    const signedIn = await request(testApp.app)
      .post('/platform/auth/recovery')
      .set(bearer(pendingToken))
      .send({ recoveryCode: recoveryCodes[0] });
    const auth = bearer(signedIn.body.data.accessToken as string);

    const reused = await request(testApp.app)
      .post('/platform/auth/totp/reset')
      .set(auth)
      .send({ recoveryCode: recoveryCodes[0] });
    expect(reused.status).toBe(401);

    const started = await request(testApp.app)
      .post('/platform/auth/totp/reset')
      .set(auth)
      .send({ recoveryCode: recoveryCodes[1] });
    expect(started.status, JSON.stringify(started.body)).toBe(200);
    const confirmed = await request(testApp.app)
      .post('/platform/auth/totp/reset/confirm')
      .set(auth)
      .send({ code: await totpCode(testApp, started.body.data.secret as string) });
    expect(confirmed.status).toBe(200);
    expect(await PlatformLogModel.countDocuments({ action: 'admin.recovery_code_used' })).toBe(2);
    const admin = await PlatformAdminModel.findOne().select('+recoveryCodeHashes');
    expect(admin!.recoveryCodeHashes).toHaveLength(8);
  });

  it('ara token ve müşteri token’ı yeniden kurulumu başlatamaz', async () => {
    const testApp = buildTestApp();
    await enrollPlatformAdmin(testApp);
    const { pendingToken } = await platformPassword(testApp);
    const customer = await createCustomer(testApp);
    for (const token of [pendingToken, customer.accessToken]) {
      const res = await request(testApp.app)
        .post('/platform/auth/totp/reset')
        .set(bearer(token))
        .send({ code: '123456' });
      expect(res.status).toBe(401);
    }
  });
});

describe('ürün sahibi oturumu', () => {
  it('refresh dönen çift üretir; logout refresh token’ı siler', async () => {
    const testApp = buildTestApp();
    const { accessToken, refreshToken } = await enrollPlatformAdmin(testApp);

    const refreshed = await request(testApp.app)
      .post('/platform/auth/refresh')
      .send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(
      (await request(testApp.app).post('/platform/auth/refresh').send({ refreshToken })).status,
    ).toBe(401);

    await request(testApp.app)
      .post('/platform/auth/logout')
      .set(bearer(accessToken))
      .send({ refreshToken: refreshed.body.data.refreshToken });
    expect(
      (
        await request(testApp.app)
          .post('/platform/auth/refresh')
          .send({ refreshToken: refreshed.body.data.refreshToken })
      ).status,
    ).toBe(401);
  });
});

describe('platform:reset-2fa komutu', () => {
  it('TOTP ve kurtarma kodlarını sıfırlar, oturumları düşürür, kayıt bırakır; sonraki girişte kurulum zorunlu', async () => {
    const testApp = buildTestApp();
    const { accessToken, refreshToken } = await enrollPlatformAdmin(testApp);
    testApp.clock.advance(1000);
    const lines: string[] = [];

    const exitCode = await runResetTwoFactor(
      ['--username', PLATFORM_USERNAME],
      { out: (line) => lines.push(line), err: (line) => lines.push(line) },
      testApp.clock,
    );

    expect(exitCode).toBe(0);
    expect(lines.join('\n')).toMatch(/sıfırlandı/);
    expect(
      (await request(testApp.app).get('/platform/companies').set(bearer(accessToken))).status,
    ).toBe(401);
    expect(
      (await request(testApp.app).post('/platform/auth/refresh').send({ refreshToken })).status,
    ).toBe(401);
    expect(await PlatformLogModel.countDocuments({ action: 'admin.two_factor_reset' })).toBe(1);

    const admin = await PlatformAdminModel.findOne().select(
      '+totpSecretEncrypted +recoveryCodeHashes',
    );
    expect(admin).toMatchObject({
      totpConfirmedAt: null,
      totpSecretEncrypted: null,
      recoveryCodeHashes: [],
    });
    expect((await platformPassword(testApp)).totpSetupRequired).toBe(true);
  });

  it('kullanıcı adı verilmezse veya hesap yoksa hata koduyla çıkar', async () => {
    const io = { out: () => undefined, err: () => undefined };
    expect(await runResetTwoFactor([], io)).toBe(2);
    expect(await runResetTwoFactor(['--username', 'olmayan'], io)).toBe(1);
  });
});

describe('token türleri birbirinin yerine kullanılamaz', () => {
  it('müşteri token’ı /platform uçlarına erişemez', async () => {
    const testApp = buildTestApp();
    const { accessToken } = await createCustomer(testApp);

    for (const res of [
      await request(testApp.app).get('/platform/companies').set(bearer(accessToken)),
      await request(testApp.app).post('/platform/auth/totp/setup').set(bearer(accessToken)),
      await request(testApp.app).post('/platform/auth/logout').set(bearer(accessToken)).send({}),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
  });

  it('ürün sahibi token’ı müşteri uçlarına erişemez', async () => {
    const testApp = buildTestApp();
    const { accessToken, refreshToken } = await enrollPlatformAdmin(testApp);

    expect((await request(testApp.app).get('/auth/me').set(bearer(accessToken))).status).toBe(401);
    expect(
      (await request(testApp.app).post('/auth/logout').set(bearer(accessToken)).send({})).status,
    ).toBe(401);
    expect((await request(testApp.app).post('/auth/refresh').send({ refreshToken })).status).toBe(
      401,
    );
  });

  it('müşteri refresh token’ı ürün sahibi refresh’inde geçmez', async () => {
    const testApp = buildTestApp();
    const { refreshToken } = await createCustomer(testApp);
    expect(
      (await request(testApp.app).post('/platform/auth/refresh').send({ refreshToken })).status,
    ).toBe(401);
  });
});
