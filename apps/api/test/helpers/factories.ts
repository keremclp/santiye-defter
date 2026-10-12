import { randomUUID } from 'node:crypto';
import { generate } from 'otplib';
import request from 'supertest';
import { expect } from 'vitest';
import { hashPassword } from '../../src/lib/passwords.js';
import { CompanyModel, type Company } from '../../src/models/company.js';
import { PlatformAdminModel } from '../../src/models/platform-admin.js';
import { UserModel, type User } from '../../src/models/user.js';
import type { TestApp } from './app.js';

let sequence = 0;
const next = () => {
  sequence += 1;
  return sequence;
};

export const DEFAULT_PASSWORD = 'Gizli-Sifre-1';

export async function createCompany(overrides: Partial<Company> = {}) {
  return CompanyModel.create({ name: `Örnek Firma ${next()}`, ...overrides });
}

export async function createUser(
  company: { _id: Company['_id'] },
  overrides: Partial<User> & { password?: string } = {},
) {
  const { password = DEFAULT_PASSWORD, ...fields } = overrides;
  const user = await UserModel.create({
    companyId: company._id,
    name: 'Deneme Kullanıcı',
    username: `kullanici${next()}`,
    passwordHash: await hashPassword(password, 4),
    mustChangePassword: false,
    ...fields,
  });
  return { user, password };
}

export interface CustomerSession {
  accessToken: string;
  refreshToken: string;
}

export async function loginCustomer(
  { app }: Pick<TestApp, 'app'>,
  username: string,
  password: string = DEFAULT_PASSWORD,
): Promise<CustomerSession> {
  const res = await request(app).post('/auth/login').send({ username, password });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { accessToken: res.body.data.accessToken, refreshToken: res.body.data.refreshToken };
}

/** Firma ve oturum açmış bir kullanıcı. */
export async function createCustomer(testApp: TestApp, companyOverrides: Partial<Company> = {}) {
  const company = await createCompany(companyOverrides);
  const { user, password } = await createUser(company);
  const session = await loginCustomer(testApp, user.username, password);
  return { company, user, password, ...session };
}

export const PLATFORM_USERNAME = 'patron';
export const PLATFORM_PASSWORD = 'Patron-Sifre-1';

export async function createPlatformAdmin() {
  return PlatformAdminModel.create({
    username: PLATFORM_USERNAME,
    passwordHash: await hashPassword(PLATFORM_PASSWORD, 4),
  });
}

/** Test saatine göre geçerli TOTP kodu. */
export function totpCode(testApp: TestApp, secret: string): Promise<string> {
  return generate({ secret, epoch: Math.floor(testApp.clock.now().getTime() / 1000) });
}

export async function platformPassword(testApp: TestApp) {
  const res = await request(testApp.app)
    .post('/platform/auth/login')
    .send({ username: PLATFORM_USERNAME, password: PLATFORM_PASSWORD });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.data as { pendingToken: string; totpSetupRequired: boolean };
}

/** Ürün sahibi hesabını açar, TOTP kurulumunu tamamlar ve oturum döner. */
export async function enrollPlatformAdmin(testApp: TestApp) {
  await createPlatformAdmin();
  const { pendingToken } = await platformPassword(testApp);
  const setup = await request(testApp.app)
    .post('/platform/auth/totp/setup')
    .set('Authorization', `Bearer ${pendingToken}`);
  expect(setup.status, JSON.stringify(setup.body)).toBe(200);
  const secret = setup.body.data.secret as string;

  const verify = await request(testApp.app)
    .post('/platform/auth/totp/verify')
    .set('Authorization', `Bearer ${pendingToken}`)
    .send({ code: await totpCode(testApp, secret) });
  expect(verify.status, JSON.stringify(verify.body)).toBe(200);
  // Aynı zaman adımındaki kod ikinci kez kabul edilmediği için saat ilerletilir.
  testApp.clock.advance(30_000);

  return {
    secret,
    accessToken: verify.body.data.accessToken as string,
    refreshToken: verify.body.data.refreshToken as string,
    recoveryCodes: verify.body.data.recoveryCodes as string[],
  };
}

export const idempotencyKey = () => randomUUID();
