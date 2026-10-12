// Şartname 9.10 erişim tablosunun her satırı uçtan uca: giriş, okuma, kayıt değiştirme, kendi profili.

import { addDays } from '@santiye/shared';
import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { sendSuccess } from '../src/http/respond.js';
import { businessToday } from '../src/lib/clock.js';
import { customerAuth } from '../src/middleware/auth.js';
import { CompanyModel, type Company } from '../src/models/company.js';
import { UserModel } from '../src/models/user.js';
import { buildTestApp, useTestDatabase, type TestApp } from './helpers/app.js';
import { createCustomer, DEFAULT_PASSWORD } from './helpers/factories.js';

useTestDatabase();

/** Firma bağlamı ara katmanını gerçek haliyle kullanan örnek okuma ve yazma uçları. */
function setup(): TestApp {
  return buildTestApp({
    extraRoutes: ({ customerAuth: service }) => {
      const router = Router();
      router.get('/deneme/okuma', customerAuth(service, { access: 'auto' }), (_req, res) => {
        sendSuccess(res, { okundu: true });
      });
      router.post('/deneme/yazma', customerAuth(service, { access: 'auto' }), (_req, res) => {
        sendSuccess(res, { yazildi: true }, { status: 201 });
      });
      return router;
    },
  });
}

type Row =
  | 'active'
  | 'view_only'
  | 'suspended'
  | 'archived'
  | 'deletion_pending'
  | 'deleting'
  | 'user_inactive';

function companyFields(row: Row, today: string): Partial<Company> {
  const ended = (daysAgo: number) => {
    const serviceEndedAt = addDays(today, -daysAgo);
    return {
      serviceEndedAt,
      viewUntil: addDays(serviceEndedAt, 30),
      retainUntil: addDays(serviceEndedAt, 180),
    };
  };
  switch (row) {
    case 'view_only':
      return ended(5);
    case 'suspended':
      return { isSuspended: true };
    case 'archived':
      return ended(40);
    case 'deletion_pending':
      return ended(200);
    case 'deleting':
      return { deletionStatus: 'running' };
    default:
      return {};
  }
}

interface Cell {
  status: number;
  code?: string;
}

const OPEN: Cell = { status: 200 };
const CLOSED: Cell = { status: 403, code: 'ACCESS_CLOSED' };

const table: Record<Row, { login: Cell; read: Cell; write: Cell; self: Cell }> = {
  active: { login: OPEN, read: OPEN, write: { status: 201 }, self: OPEN },
  view_only: { login: OPEN, read: OPEN, write: { status: 403, code: 'READ_ONLY' }, self: OPEN },
  suspended: { login: CLOSED, read: CLOSED, write: CLOSED, self: CLOSED },
  archived: { login: CLOSED, read: CLOSED, write: CLOSED, self: CLOSED },
  deletion_pending: { login: CLOSED, read: CLOSED, write: CLOSED, self: CLOSED },
  deleting: { login: CLOSED, read: CLOSED, write: CLOSED, self: CLOSED },
  user_inactive: { login: CLOSED, read: CLOSED, write: CLOSED, self: CLOSED },
};

function expectCell(res: request.Response, cell: Cell) {
  expect(res.status, JSON.stringify(res.body)).toBe(cell.status);
  if (cell.code) expect(res.body).toMatchObject({ success: false, code: cell.code });
}

describe('hizmet durumu erişim tablosu', () => {
  it.each(Object.keys(table) as Row[])('%s', async (row) => {
    const testApp = setup();
    // Oturum hizmet aktifken açılır; durum sonradan değişir ve her istekte yeniden hesaplanır.
    const { company, user, accessToken } = await createCustomer(testApp);
    const today = businessToday(testApp.clock);
    await CompanyModel.updateOne({ _id: company._id }, { $set: companyFields(row, today) });
    if (row === 'user_inactive')
      await UserModel.updateOne({ _id: user._id }, { $set: { isActive: false } });
    const auth = { Authorization: `Bearer ${accessToken}` };
    const expected = table[row];

    const login = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: DEFAULT_PASSWORD });
    expectCell(login, expected.login);

    expectCell(await request(testApp.app).get('/deneme/okuma').set(auth), expected.read);
    expectCell(await request(testApp.app).post('/deneme/yazma').set(auth).send({}), expected.write);

    const current = await UserModel.findById(user._id);
    const self = await request(testApp.app)
      .patch('/auth/me')
      .set(auth)
      .send({ phone: '0555 111 22 33', expectedUpdatedAt: current?.updatedAt.toISOString() });
    expectCell(self, expected.self);
  });

  it('görüntüleme döneminde yazma reddi bitiş tarihini açıklar', async () => {
    const testApp = setup();
    const { company, accessToken } = await createCustomer(testApp);
    const today = businessToday(testApp.clock);
    const fields = companyFields('view_only', today);
    await CompanyModel.updateOne({ _id: company._id }, { $set: fields });

    const res = await request(testApp.app)
      .post('/deneme/yazma')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.body.message).toMatch(/yalnız görüntülenebilir ve dışa aktarılabilir/);
    expect(res.body.details).toEqual({ state: 'view_only', viewUntil: fields.viewUntil });

    const me = await request(testApp.app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(me.body.data.service).toMatchObject({ state: 'view_only', viewUntil: fields.viewUntil });
  });

  it('kapalı erişimde boş firma yerine durumu açıklayan mesaj döner; refresh de kapanır', async () => {
    const testApp = setup();
    const { company, refreshToken } = await createCustomer(testApp);
    await CompanyModel.updateOne({ _id: company._id }, { $set: { isSuspended: true } });

    const res = await request(testApp.app).post('/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'ACCESS_CLOSED', details: { state: 'suspended' } });
    expect(res.body.message).toMatch(/geçici olarak durduruldu/);
  });

  it('hizmet yeniden açılınca aynı kullanıcı geçmişiyle devam eder', async () => {
    const testApp = setup();
    const { company, user } = await createCustomer(testApp);
    await CompanyModel.updateOne({ _id: company._id }, { $set: { isSuspended: true } });
    await CompanyModel.updateOne({ _id: company._id }, { $set: { isSuspended: false } });

    const res = await request(testApp.app)
      .post('/auth/login')
      .send({ username: user.username, password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
  });
});
