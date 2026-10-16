// Ürün sahibi yönetimi, kalan API (şartname 7.13, 8.1, 9.10, 10.10): firma listesi ve işletim özeti,
// firma ve kullanıcı düzenleme, kapasite, hizmet yaşam döngüsü (görüntüleme → arşiv → silme onayı) ve
// kalıcı silme. Bütün işlemler işletim geçmişinde; şifre hiçbir kayıtta yok.

import { randomUUID } from 'node:crypto';
import { addDays } from '@santiye/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { businessToday } from '../src/lib/clock.js';
import { CompanyModel } from '../src/models/company.js';
import { ExportJobModel } from '../src/models/export-job.js';
import { models } from '../src/models/index.js';
import { PlatformAdminModel } from '../src/models/platform-admin.js';
import { PlatformLogModel } from '../src/models/platform-log.js';
import { TransactionModel } from '../src/models/transaction.js';
import { UserModel } from '../src/models/user.js';
import { ExportService } from '../src/services/exports.js';
import { buildTestApp, createTestClock, useTestDatabase, type TestApp } from './helpers/app.js';
import { addDocument, pdfFile } from './helpers/documents.js';
import {
  createCompany,
  createCustomer,
  createUser,
  DEFAULT_PASSWORD,
  enrollPlatformAdmin,
  loginCustomer,
  PLATFORM_PASSWORD,
  platformPassword,
  totpCode,
} from './helpers/factories.js';
import { Api, financeSetup, tl } from './helpers/finance.js';

useTestDatabase();

/** İstanbul günü 2026-03-20. */
function setup() {
  return buildTestApp({ clock: createTestClock(new Date('2026-03-20T09:00:00Z')) });
}

type Body = Record<string, unknown>;

/** Ürün sahibi oturumu; saat ilerletilince yeniden giriş yapar. */
class Admin {
  private constructor(
    readonly testApp: TestApp,
    private token: string,
    private readonly secret: string,
  ) {}

  static async enroll(testApp: TestApp) {
    const { accessToken, secret } = await enrollPlatformAdmin(testApp);
    return new Admin(testApp, accessToken, secret);
  }

  async relogin() {
    const { pendingToken } = await platformPassword(this.testApp);
    const res = await request(this.testApp.app)
      .post('/platform/auth/totp/verify')
      .set('Authorization', `Bearer ${pendingToken}`)
      .send({ code: await totpCode(this.testApp, this.secret) });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    this.token = res.body.data.accessToken as string;
  }

  private auth() {
    return { Authorization: `Bearer ${this.token}` };
  }

  get(path: string, query: Record<string, unknown> = {}) {
    return request(this.testApp.app).get(path).query(query).set(this.auth());
  }

  post(path: string, body: Body = {}, key: string | null = null) {
    const req = request(this.testApp.app).post(path).set(this.auth());
    if (key) req.set('Idempotency-Key', key);
    return req.send(body);
  }

  patch(path: string, body: Body) {
    return request(this.testApp.app).patch(path).set(this.auth()).send(body);
  }

  async ok<T = any>(promise: PromiseLike<request.Response>, status = 200): Promise<T> {
    const res = await promise;
    expect(res.status, JSON.stringify(res.body)).toBe(status);
    return res.body.data as T;
  }

  async fails(promise: PromiseLike<request.Response>, status: number, code: string) {
    const res = await promise;
    expect(res.status, JSON.stringify(res.body)).toBe(status);
    expect(res.body.code).toBe(code);
    return res.body as { message: string; details?: unknown };
  }
}

const companyPath = (id: string, action = '') => `/platform/companies/${id}${action}`;

/** Firma verisi taşıyan koleksiyonlarda firmaya ait belge sayısı (işletim geçmişi hariç). */
async function remainingCompanyData(companyId: string) {
  const counts: Record<string, number> = {};
  for (const current of models) {
    if (current === PlatformLogModel || !('companyId' in current.schema.paths)) continue;
    counts[current.modelName] = await (
      current as unknown as typeof TransactionModel
    ).countDocuments({ companyId });
  }
  return counts;
}

function login(testApp: TestApp, username: string, password = DEFAULT_PASSWORD) {
  return request(testApp.app).post('/auth/login').send({ username, password });
}

describe('firma listesi ve işletim özeti', () => {
  it('Türkçe harf farkı gözetmeden arar, beş durumla süzer ve dikkat isteyen firmaları özetler', async () => {
    const testApp = setup();
    const admin = await Admin.enroll(testApp);
    const today = businessToday(testApp.clock);
    const ended = (daysAgo: number) => {
      const serviceEndedAt = addDays(today, -daysAgo);
      return {
        serviceEndedAt,
        viewUntil: addDays(serviceEndedAt, 30),
        retainUntil: addDays(serviceEndedAt, 180),
      };
    };
    const full = await createCompany({
      name: 'İstanbul Yapı',
      storageQuotaBytes: 1_000,
      storageUsedBytes: 1_000,
    });
    const near = await createCompany({
      name: 'Ilgaz İnşaat',
      storageQuotaBytes: 1_000,
      storageUsedBytes: 900,
    });
    await createCompany({ name: 'Çınar Yapı', storageQuotaBytes: 1_000, storageUsedBytes: 899 });
    await createCompany({ name: 'Planlı Bitiş', ...ended(-5) });
    const viewEnding = await createCompany({ name: 'Görüntü Yapı', ...ended(25) });
    await createCompany({ name: 'Yeni Bitmiş', ...ended(10) });
    const retentionEnding = await createCompany({ name: 'Arşiv Yapı', ...ended(160) });
    await createCompany({ name: 'Uzun Arşiv', ...ended(40) });
    const pending = await createCompany({ name: 'Bekleyen Silme', ...ended(200) });
    await createCompany({ name: 'Durdurulmuş Yapı', isSuspended: true });
    await createCompany({
      name: 'Silinmiş Yapı',
      ...ended(400),
      deletionStatus: 'done',
      storageQuotaBytes: 1,
      storageUsedBytes: 1,
    });
    const deletionFailed = await createCompany({
      name: 'Başarısız Silme',
      ...ended(300),
      deletionStatus: 'failed',
      storageQuotaBytes: 1,
      storageUsedBytes: 1,
    });
    const deletionQueued = await createCompany({
      name: 'Kuyrukta Silme',
      ...ended(300),
      deletionStatus: 'pending',
    });
    const deletionRunning = await createCompany({
      name: 'Süren Silme',
      ...ended(300),
      deletionStatus: 'running',
    });
    await createUser(full);
    await createUser(full);

    const list = async (query: Record<string, unknown>) => {
      const data = await admin.ok(admin.get('/platform/companies', query));
      return data.items.map((item: { name: string }) => item.name) as string[];
    };
    expect(await list({ q: 'istanbul' })).toEqual(['İstanbul Yapı']);
    expect(await list({ q: 'ILGAZ insaat' })).toEqual(['Ilgaz İnşaat']);
    expect(await list({ q: 'cinar' })).toEqual(['Çınar Yapı']);
    expect(await list({ status: 'active' })).toEqual([
      'Çınar Yapı',
      'Ilgaz İnşaat',
      'İstanbul Yapı',
      'Planlı Bitiş',
    ]);
    expect(await list({ status: 'suspended' })).toEqual(['Durdurulmuş Yapı']);
    expect(await list({ status: 'view_only' })).toEqual(['Görüntü Yapı', 'Yeni Bitmiş']);
    expect(await list({ status: 'archived' })).toEqual(['Arşiv Yapı', 'Uzun Arşiv']);
    expect(await list({ status: 'deletion_pending' })).toEqual(['Bekleyen Silme']);
    expect((await admin.get('/platform/companies', { status: 'yok' })).status).toBe(400);

    const data = await admin.ok(admin.get('/platform/companies', { q: 'istanbul' }));
    expect(data.items[0]).toMatchObject({
      name: 'İstanbul Yapı',
      userCount: 2,
      storage: { usedBytes: 1_000, quotaBytes: 1_000 },
      service: { state: 'active', serviceEndedAt: null, viewUntil: null, retainUntil: null },
    });
    // Özet aramadan bağımsızdır; silmesi başlamış firmalar yalnız kendi grubundadır.
    const ids = (group: { id: string }[]) => group.map((item) => item.id);
    expect(Object.keys(data.summary)).toEqual([
      'storageFull',
      'storageNearFull',
      'viewEnding',
      'retentionEnding',
      'deletionPending',
      'deletionIncomplete',
    ]);
    expect(ids(data.summary.storageFull)).toEqual([full._id.toString()]);
    expect(ids(data.summary.storageNearFull)).toEqual([near._id.toString()]);
    expect(ids(data.summary.viewEnding)).toEqual([viewEnding._id.toString()]);
    expect(data.summary.viewEnding[0]).toMatchObject({
      name: 'Görüntü Yapı',
      state: 'view_only',
      viewUntil: addDays(today, 5),
    });
    expect(ids(data.summary.retentionEnding)).toEqual([retentionEnding._id.toString()]);
    expect(data.summary.retentionEnding[0]).toMatchObject({
      state: 'archived',
      retainUntil: addDays(today, 20),
    });
    expect(ids(data.summary.deletionPending)).toEqual([pending._id.toString()]);
    expect(data.summary.deletionPending[0]).toMatchObject({ deletionStatus: 'none' });

    // Silmesi bekleyen, süren veya başarısız olanlar; tamamlanmış silme girmez.
    expect(ids(data.summary.deletionIncomplete)).toEqual([
      deletionFailed._id.toString(),
      deletionQueued._id.toString(),
      deletionRunning._id.toString(),
    ]);
    expect(data.summary.deletionIncomplete[0]).toEqual({
      id: deletionFailed._id.toString(),
      name: 'Başarısız Silme',
      state: 'deleting',
      deletionStatus: 'failed',
      usedBytes: 1,
      quotaBytes: 1,
      viewUntil: addDays(today, -270),
      retainUntil: addDays(today, -120),
    });
    expect(data.summary.deletionIncomplete.map((item: Body) => item.deletionStatus)).toEqual([
      'failed',
      'pending',
      'running',
    ]);
    // Durum filtrelerine girmezler; listede silme durumlarıyla görünürler.
    for (const status of ['active', 'suspended', 'view_only', 'archived', 'deletion_pending']) {
      expect(await list({ status })).not.toContain('Başarısız Silme');
    }
    const deleting = await admin.ok(admin.get('/platform/companies', { q: 'silme' }));
    expect(deleting.items.map((item: Body) => [item.name, item.deletionStatus])).toEqual([
      ['Başarısız Silme', 'failed'],
      ['Bekleyen Silme', 'none'],
      ['Kuyrukta Silme', 'pending'],
      ['Süren Silme', 'running'],
    ]);
  });
});

describe('firma ve kullanıcı düzenleme', () => {
  it('ad, iletişim ve işletim notu değişir; eski sürümle 409; işletim geçmişine yazılır', async () => {
    const testApp = setup();
    const admin = await Admin.enroll(testApp);
    const company = await createCompany({ name: 'Eski Ad' });
    const id = company._id.toString();

    const updated = await admin.ok(
      admin.patch(companyPath(id), {
        name: 'Yeni Ad',
        contact: { person: 'Ali Kaya', phone: '0555 000 00 00', email: 'ali@example.com' },
        opsNote: 'Ödeme takibi',
        reason: 'Unvan değişti',
        expectedUpdatedAt: company.updatedAt.toISOString(),
      }),
    );
    expect(updated).toMatchObject({
      name: 'Yeni Ad',
      contact: { person: 'Ali Kaya' },
      opsNote: 'Ödeme takibi',
    });
    const log = await PlatformLogModel.findOne({ action: 'company.update' }).lean();
    expect(log).toMatchObject({ reason: 'Unvan değişti' });
    expect(log!.changes.map((change) => change.field)).toEqual(['name', 'contact', 'opsNote']);

    const stale = await admin.fails(
      admin.patch(companyPath(id), {
        name: 'Üçüncü Ad',
        expectedUpdatedAt: company.updatedAt.toISOString(),
      }),
      409,
      'CONFLICT',
    );
    expect(stale.details).toMatchObject({ current: { name: 'Yeni Ad' } });
  });

  it('kullanıcı adı değişir: yeni adla giriş yapılır, eskisiyle yapılamaz; çakışan ad 409', async () => {
    const testApp = setup();
    const admin = await Admin.enroll(testApp);
    const company = await createCompany();
    const { user } = await createUser(company, { username: 'mehmet' });
    await createUser(company, { username: 'zeynep' });

    const taken = await admin.fails(
      admin.patch(`/platform/users/${user._id.toString()}`, {
        username: 'ZEYNEP',
        expectedUpdatedAt: user.updatedAt.toISOString(),
      }),
      409,
      'USERNAME_EXISTS',
    );
    expect(taken.message).toBe('Bu kullanıcı adı kullanılıyor');

    const updated = await admin.ok(
      admin.patch(`/platform/users/${user._id.toString()}`, {
        name: 'Mehmet Yılmaz',
        username: ' Mehmet.Yılmaz ',
        expectedUpdatedAt: user.updatedAt.toISOString(),
      }),
    );
    expect(updated).toMatchObject({ name: 'Mehmet Yılmaz', username: 'mehmet.yılmaz' });
    expect((await login(testApp, 'mehmet.yılmaz')).status).toBe(200);
    expect((await login(testApp, 'mehmet')).status).toBe(401);

    const log = await PlatformLogModel.findOne({ action: 'user.update' }).lean();
    expect(log).toMatchObject({ reason: null, companyId: company._id });
    expect(log!.changes).toEqual([
      { field: 'userId', old: null, new: user._id.toString() },
      { field: 'name', old: 'Deneme Kullanıcı', new: 'Mehmet Yılmaz' },
      { field: 'username', old: 'mehmet', new: 'mehmet.yılmaz' },
    ]);

    // Aktiflik değişiminde gerekçe zorunlu.
    await admin.fails(
      admin.patch(`/platform/users/${user._id.toString()}`, {
        isActive: false,
        expectedUpdatedAt: updated.updatedAt,
      }),
      400,
      'VALIDATION',
    );
  });
});

describe('kapasite', () => {
  it('gerekçeyle artırılır ve azaltılır; kullanımın altına inmez; önceki/yeni değer kaydedilir', async () => {
    const testApp = setup();
    const admin = await Admin.enroll(testApp);
    const company = await createCompany({ storageUsedBytes: 5_000_000 });
    const id = company._id.toString();
    const gb = 1024 ** 3;

    await admin.fails(
      admin.post(companyPath(id, '/quota'), { quotaBytes: 30 * gb }),
      400,
      'VALIDATION',
    );
    await admin.fails(
      admin.post(companyPath(id, '/quota'), { quotaBytes: 1.5, reason: 'x' }),
      400,
      'VALIDATION',
    );

    const raised = await admin.ok(
      admin.post(companyPath(id, '/quota'), { quotaBytes: 30 * gb, reason: 'Ek paket' }),
    );
    expect(raised.storage).toEqual({ usedBytes: 5_000_000, quotaBytes: 30 * gb });

    const below = await admin.fails(
      admin.post(companyPath(id, '/quota'), { quotaBytes: 4_999_999, reason: 'Küçült' }),
      409,
      'CONFLICT',
    );
    expect(below.message).toBe('Kapasite mevcut kullanımın altına indirilemez.');
    expect((await CompanyModel.findById(company._id))!.storageQuotaBytes).toBe(30 * gb);

    const lowered = await admin.ok(
      admin.post(companyPath(id, '/quota'), { quotaBytes: 5_000_000, reason: 'Paket bitti' }),
    );
    expect(lowered.storage.quotaBytes).toBe(5_000_000);

    const logs = await PlatformLogModel.find({ action: 'company.quota' })
      .sort({ at: 1, _id: 1 })
      .lean();
    expect(logs.map((log) => [log.changes[0], log.reason])).toEqual([
      [{ field: 'storageQuotaBytes', old: 20 * gb, new: 30 * gb }, 'Ek paket'],
      [{ field: 'storageQuotaBytes', old: 30 * gb, new: 5_000_000 }, 'Paket bitti'],
    ]);
  });
});

describe('hizmet yaşam döngüsü', () => {
  it('geçici durdurma erişimi hemen kapatır, hizmet sonu sayacını başlatmaz; kaldırınca açılır', async () => {
    const testApp = setup();
    const admin = await Admin.enroll(testApp);
    const customer = await createCustomer(testApp);
    const id = customer.company._id.toString();
    const auth = { Authorization: `Bearer ${customer.accessToken}` };

    await admin.fails(
      admin.post(companyPath(id, '/suspend'), { suspended: true }),
      400,
      'VALIDATION',
    );
    const suspended = await admin.ok(
      admin.post(companyPath(id, '/suspend'), { suspended: true, reason: 'Ödeme gecikti' }),
    );
    expect(suspended.service).toEqual({
      state: 'suspended',
      serviceEndedAt: null,
      viewUntil: null,
      retainUntil: null,
    });
    const closed = await request(testApp.app).get('/projects').set(auth);
    expect(closed.status).toBe(403);
    expect(closed.body).toMatchObject({ code: 'ACCESS_CLOSED', details: { state: 'suspended' } });

    // Aynı durum tekrar istenirse kayıt düşmez.
    await admin.ok(admin.post(companyPath(id, '/suspend'), { suspended: true, reason: 'Tekrar' }));
    const resumed = await admin.ok(
      admin.post(companyPath(id, '/suspend'), { suspended: false, reason: 'Ödendi' }),
    );
    expect(resumed.service.state).toBe('active');
    expect((await request(testApp.app).get('/projects').set(auth)).status).toBe(200);
    expect(
      (await PlatformLogModel.find().sort({ at: 1, _id: 1 }))
        .filter((log) => log.action.startsWith('company.'))
        .map((log) => [log.action, log.reason]),
    ).toEqual([
      ['company.suspend', 'Ödeme gecikti'],
      ['company.unsuspend', 'Ödendi'],
    ]);
  });

  it('hizmet sonu: önizleme yazmaz, geçmişe çekilemez, süreler yeniden başlatılamaz; yeniden açılınca devam eder', async () => {
    const testApp = setup();
    const admin = await Admin.enroll(testApp);
    const { api, company } = await financeSetup(testApp);
    const id = company._id.toString();
    const today = businessToday(testApp.clock);
    expect(today).toBe('2026-03-20');

    await admin.fails(
      admin.post(companyPath(id, '/end-service?preview=1'), { effectiveDate: '2026-03-19' }),
      400,
      'VALIDATION',
    );
    const preview = await admin.ok(
      admin.post(companyPath(id, '/end-service?preview=1'), { effectiveDate: '2026-04-01' }),
    );
    expect(preview).toEqual({
      preview: true,
      name: company.name,
      effectiveDate: '2026-04-01',
      serviceEndedAt: '2026-04-01',
      viewUntil: '2026-05-01',
      retainUntil: '2026-09-28',
    });
    expect((await CompanyModel.findById(company._id))!.serviceEndedAt).toBeNull();
    expect(await PlatformLogModel.countDocuments({ action: 'company.end_service' })).toBe(0);

    // Gerçek işlemde gerekçe zorunlu.
    await admin.fails(
      admin.post(companyPath(id, '/end-service'), { effectiveDate: today }),
      400,
      'VALIDATION',
    );
    const ended = await admin.ok(
      admin.post(companyPath(id, '/end-service'), {
        effectiveDate: today,
        reason: 'Sözleşme bitti',
      }),
    );
    expect(ended.service).toEqual({
      state: 'view_only',
      serviceEndedAt: '2026-03-20',
      viewUntil: '2026-04-19',
      retainUntil: '2026-09-16',
    });
    const again = await admin.fails(
      admin.post(companyPath(id, '/end-service'), { effectiveDate: '2026-05-01', reason: 'x' }),
      409,
      'CONFLICT',
    );
    expect(again.message).toMatch(/yeniden başlatılamaz/);
    const write = await api.record({ kind: 'expense', amount: tl(1_000) });
    expect(write.body.code).toBe('READ_ONLY');

    // Arşiv uzatma: yalnız ileri ve bugünden sonra; erişimi açmaz.
    await admin.fails(
      admin.post(companyPath(id, '/extend-retention'), { retainUntil: '2026-09-16', reason: 'x' }),
      400,
      'VALIDATION',
    );
    const extended = await admin.ok(
      admin.post(companyPath(id, '/extend-retention'), {
        retainUntil: '2027-03-20',
        reason: 'Müşteri talebi',
      }),
    );
    expect(extended.service).toMatchObject({
      state: 'view_only',
      viewUntil: '2026-04-19',
      retainUntil: '2027-03-20',
    });

    const reopened = await admin.ok(
      admin.post(companyPath(id, '/reopen'), { reason: 'Yeni sözleşme' }),
    );
    expect(reopened.service).toEqual({
      state: 'active',
      serviceEndedAt: null,
      viewUntil: null,
      retainUntil: null,
    });
    // Firma geçmişiyle devam eder; eski tarihler işletim geçmişinde kalır.
    await api.ok(api.record({ kind: 'expense', amount: tl(1_000) }), 201);
    const reopenLog = await PlatformLogModel.findOne({ action: 'company.reopen' }).lean();
    expect(reopenLog).toMatchObject({
      reason: 'Yeni sözleşme',
      changes: [
        { field: 'serviceEndedAt', old: '2026-03-20', new: null },
        { field: 'viewUntil', old: '2026-04-19', new: null },
        { field: 'retainUntil', old: '2027-03-20', new: null },
      ],
    });
    await admin.fails(admin.post(companyPath(id, '/reopen'), { reason: 'x' }), 409, 'CONFLICT');
    await admin.fails(
      admin.post(companyPath(id, '/extend-retention'), { retainUntil: '2027-12-31', reason: 'x' }),
      409,
      'CONFLICT',
    );

    // İleri tarihli sonlandırma: yürürlük gününe kadar firma aktif kalır.
    const scheduled = await admin.ok(
      admin.post(companyPath(id, '/end-service'), { effectiveDate: '2026-04-01', reason: 'Plan' }),
    );
    expect(scheduled.service).toMatchObject({ state: 'active', serviceEndedAt: '2026-04-01' });
  });
});

describe('firma açılışından kalıcı silmeye', () => {
  it('görüntüleme dönemi → arşiv → silme onayı → kalıcı silme; hiçbir veri ve belge kalmaz, yeniden açılamaz', async () => {
    const testApp = setup();
    const admin = await Admin.enroll(testApp);
    const adminId = (await PlatformAdminModel.findOne())!._id;
    const { storage } = testApp;

    // Firma ve kullanıcı ürün sahibi tarafından açılır; kullanıcı kişisel şifresini oluşturur.
    const company = await admin.ok(
      admin.post(
        '/platform/companies',
        {
          name: 'Yıldız Yapı',
          contact: { person: 'Ali Kaya', phone: '0555 111 22 33', email: 'ali@example.com' },
          opsNote: 'Pilot müşteri',
          reason: 'Yeni müşteri',
        },
        randomUUID(),
      ),
      201,
    );
    const id = company.id as string;
    const created = await admin.ok(
      admin.post(
        companyPath(id, '/users'),
        { name: 'Ayşe Demir', username: 'ayse.demir', reason: 'Firma yetkilisi' },
        randomUUID(),
      ),
      201,
    );
    const temporaryPassword = created.temporaryPassword as string;
    const first = await login(testApp, 'ayse.demir', temporaryPassword);
    const personal = await request(testApp.app)
      .patch('/auth/password')
      .set('Authorization', `Bearer ${first.body.data.accessToken}`)
      .send({ currentPassword: temporaryPassword, newPassword: DEFAULT_PASSWORD });
    expect(personal.status, JSON.stringify(personal.body)).toBe(200);
    let api = new Api(testApp, personal.body.data.accessToken, 'ayse.demir');

    // Firma kullanılır: şantiye, hareket, belge, hazır dışa aktarma paketi.
    const project = await api.createProject('Kadıköy Villa');
    const payment = await api.ok(api.record({ kind: 'expense', amount: tl(5_000), project }), 201);
    await addDocument(api, { ownerType: 'transaction', ownerId: payment.id }, pdfFile(3_000), {
      fileName: 'fatura.pdf',
      mimeType: 'application/pdf',
    });
    await api.ok(api.post('/exports/full', {}), 201);
    await testApp.deps.background.idle();
    const prefix = `companies/${id}/`;
    const ownKeys = () => storage.keys().filter((key) => key.startsWith(prefix));
    expect(ownKeys().some((key) => key.includes('/exports/'))).toBe(true);
    expect(ownKeys().length).toBeGreaterThanOrEqual(2);

    // Başka bir firma kalıcı silmeden etkilenmemeli.
    const other = await financeSetup(testApp);
    const otherProject = await other.api.createProject('Başka Şantiye');
    const otherPayment = await other.api.ok(
      other.api.record({ kind: 'expense', amount: tl(700), project: otherProject }),
      201,
    );
    await addDocument(
      other.api,
      { ownerType: 'transaction', ownerId: otherPayment.id },
      pdfFile(1_000),
      { fileName: 'baska.pdf', mimeType: 'application/pdf' },
    );
    const otherKeys = storage.keys().filter((key) => !key.startsWith(prefix));
    expect(otherKeys.length).toBeGreaterThan(0);

    // Saklama süresi dolmadan kalıcı silme yok.
    const deleteBody = { confirmName: 'Yıldız Yapı', reason: 'Saklama süresi doldu' };
    await admin.fails(admin.post(companyPath(id, '/delete'), deleteBody), 409, 'CONFLICT');

    // Hizmet sonu: görüntüleme dönemi; okuma ve dışa aktarma açık, değişiklik kapalı.
    await admin.ok(
      admin.post(companyPath(id, '/end-service'), {
        effectiveDate: '2026-03-20',
        reason: 'Sözleşme bitti',
      }),
    );
    expect((await api.ok(api.get('/projects'))).items).toHaveLength(1);
    expect((await api.record({ kind: 'expense', amount: tl(100) })).body.code).toBe('READ_ONLY');
    await admin.fails(admin.post(companyPath(id, '/delete'), deleteBody), 409, 'CONFLICT');

    // viewUntil (2026-04-19) dahil görüntülenir; ertesi gün arşiv saklama başlar.
    testApp.clock.set('2026-04-19T20:00:00Z');
    api = await api.relogin();
    await api.ok(api.get('/projects'));
    testApp.clock.set('2026-04-19T21:30:00Z');
    const archivedLogin = await login(testApp, 'ayse.demir');
    expect(archivedLogin.status).toBe(403);
    expect(archivedLogin.body).toMatchObject({
      code: 'ACCESS_CLOSED',
      details: { state: 'archived' },
    });
    await admin.relogin();
    await admin.fails(admin.post(companyPath(id, '/delete'), deleteBody), 409, 'CONFLICT');

    // Arşiv uzatma erişimi açmaz.
    const extended = await admin.ok(
      admin.post(companyPath(id, '/extend-retention'), {
        retainUntil: '2026-12-31',
        reason: 'Muhasebe denetimi',
      }),
    );
    expect(extended.service).toMatchObject({ state: 'archived', retainUntil: '2026-12-31' });
    expect((await login(testApp, 'ayse.demir')).status).toBe(403);

    // Saklama bitişinden sonra silme onayı bekler; veri kendiliğinden silinmez.
    testApp.clock.set('2027-01-01T09:00:00Z');
    await admin.relogin();
    const pendingList = await admin.ok(
      admin.get('/platform/companies', { status: 'deletion_pending' }),
    );
    expect(pendingList.items.map((item: { id: string }) => item.id)).toEqual([id]);
    expect(pendingList.summary.deletionPending.map((item: { id: string }) => item.id)).toEqual([
      id,
    ]);
    expect(await TransactionModel.countDocuments({ companyId: company.id })).toBe(1);
    const before = await admin.ok(admin.get(companyPath(id)));
    expect(before.contents).toEqual({
      transactions: 1,
      agreements: 0,
      projects: 1,
      parties: 0,
      documents: 1,
    });

    // Firma adı yazılarak onaylanır.
    await admin.fails(
      admin.post(companyPath(id, '/delete'), { ...deleteBody, confirmName: 'Yildiz Yapi' }),
      400,
      'VALIDATION',
    );
    await admin.fails(
      admin.post(companyPath(id, '/delete'), { confirmName: 'Yıldız Yapı' }),
      400,
      'VALIDATION',
    );
    expect((await CompanyModel.findById(id))!.deletionStatus).toBe('none');

    const accepted = await admin.ok(admin.post(companyPath(id, '/delete'), deleteBody), 202);
    expect(['pending', 'running', 'done']).toContain(accepted.deletionStatus);
    await testApp.deps.background.idle();

    // Asgari iz kaydı: ad, hizmet tarihleri ve "tamamlandı".
    const detail = await admin.ok(admin.get(companyPath(id)));
    expect(detail.company).toMatchObject({
      name: 'Yıldız Yapı',
      displayName: '',
      contact: { person: '', phone: '', email: '' },
      opsNote: '',
      deletionStatus: 'done',
      userCount: 0,
      storage: { usedBytes: 0 },
      service: { state: 'deleting', serviceEndedAt: '2026-03-20', retainUntil: '2026-12-31' },
    });
    expect(detail.users).toEqual([]);
    expect(detail.contents).toEqual({
      transactions: 0,
      agreements: 0,
      projects: 0,
      parties: 0,
      documents: 0,
    });
    const tombstone = await CompanyModel.findById(id).lean();
    expect(tombstone!.history).toEqual([]);

    // Hiçbir veri ve belge kalmaz.
    const remaining = await remainingCompanyData(id);
    expect(Object.keys(remaining)).toEqual(
      expect.arrayContaining(['User', 'Transaction', 'Document', 'ExportJob', 'Category']),
    );
    for (const [name, count] of Object.entries(remaining)) expect(count, name).toBe(0);
    expect(ownKeys()).toEqual([]);
    expect((await login(testApp, 'ayse.demir')).status).toBe(401);

    // Yeniden açılamaz, değiştirilemez, yeniden silinemez.
    const reopen = await admin.fails(
      admin.post(companyPath(id, '/reopen'), { reason: 'Müşteri döndü' }),
      409,
      'CONFLICT',
    );
    expect(reopen.message).toMatch(/kalıcı olarak silindi; yeniden açılamaz/);
    await admin.fails(
      admin.post(companyPath(id, '/extend-retention'), { retainUntil: '2027-06-01', reason: 'x' }),
      409,
      'CONFLICT',
    );
    await admin.fails(
      admin.post(companyPath(id, '/quota'), { quotaBytes: 1_000, reason: 'x' }),
      409,
      'CONFLICT',
    );
    await admin.fails(
      admin.post(companyPath(id, '/suspend'), { suspended: true, reason: 'x' }),
      409,
      'CONFLICT',
    );
    await admin.fails(
      admin.patch(companyPath(id), { name: 'X', expectedUpdatedAt: detail.company.updatedAt }),
      409,
      'CONFLICT',
    );
    await admin.fails(
      admin.post(companyPath(id, '/users'), { name: 'Yeni Kişi', username: 'yeni' }, randomUUID()),
      409,
      'CONFLICT',
    );
    await admin.fails(admin.post(companyPath(id, '/delete'), deleteBody), 409, 'CONFLICT');

    // Başka firma etkilenmez.
    for (const key of otherKeys) expect(storage.objects.has(key), key).toBe(true);
    const otherApi = await other.api.relogin();
    expect((await otherApi.ok(otherApi.get('/projects'))).items).toHaveLength(1);
    expect(await TransactionModel.countDocuments({ companyId: other.company._id })).toBe(1);

    // İşletim geçmişi: her işlem kim, ne zaman, gerekçeyle; asgari kayıt kalır.
    const logs = await PlatformLogModel.find({ companyId: id }).sort({ at: 1, _id: 1 }).lean();
    expect(logs.map((log) => [log.action, log.reason])).toEqual([
      ['company.create', 'Yeni müşteri'],
      ['user.create', 'Firma yetkilisi'],
      ['company.end_service', 'Sözleşme bitti'],
      ['company.extend_retention', 'Muhasebe denetimi'],
      ['company.delete', 'Saklama süresi doldu'],
      ['company.delete_completed', 'Saklama süresi doldu'],
    ]);
    for (const log of logs) {
      expect(log.adminId?.toString(), log.action).toBe(adminId.toString());
      expect(log.at).toBeInstanceOf(Date);
    }
    // Kişi verisi taşıyan ayrıntılar temizlenir; firma adı ve tarihler kalır.
    expect(logs.find((log) => log.action === 'user.create')!.changes).toEqual([]);
    expect(logs.find((log) => log.action === 'company.end_service')!.changes).toContainEqual({
      field: 'retainUntil',
      old: null,
      new: '2026-09-16',
    });
    const completed = logs.find((log) => log.action === 'company.delete_completed')!;
    expect(completed.changes).toContainEqual({ field: 'name', old: 'Yıldız Yapı', new: null });
    expect(completed.at.toISOString()).toBe('2027-01-01T09:00:00.000Z');
    const allLogs = JSON.stringify(await PlatformLogModel.find().lean());
    expect(allLogs).not.toContain('ayse.demir');
    expect(allLogs).not.toContain('ali@example.com');

    // Şifre hiçbir logda yok.
    for (const secret of [temporaryPassword, DEFAULT_PASSWORD, PLATFORM_PASSWORD]) {
      expect(allLogs).not.toContain(secret);
    }
    expect(allLogs).not.toMatch(/passwordHash|refreshToken|temporaryPassword/);
  });

  it('silme başarısız olursa durum "başarısız" olur, firma açılamaz; yeniden başlatılınca tamamlanır', async () => {
    const testApp = setup();
    const admin = await Admin.enroll(testApp);
    const { api, company } = await financeSetup(testApp);
    const id = company._id.toString();
    const project = await api.createProject();
    const payment = await api.ok(api.record({ kind: 'expense', amount: tl(500), project }), 201);
    await addDocument(api, { ownerType: 'transaction', ownerId: payment.id }, pdfFile(), {
      fileName: 'belge.pdf',
      mimeType: 'application/pdf',
    });
    await CompanyModel.updateOne(
      { _id: company._id },
      {
        $set: { serviceEndedAt: '2025-01-01', viewUntil: '2025-01-31', retainUntil: '2025-06-30' },
      },
    );
    // Silme başlarken kuyrukta bekleyen dışa aktarma işi (ör. görüntüleme döneminden kalan).
    const userId = (await UserModel.findOne({ companyId: company._id }))!._id;
    await ExportJobModel.create({
      companyId: company._id,
      requestedBy: userId,
      createdBy: userId,
      updatedBy: userId,
      type: 'full',
      status: 'queued',
      active: true,
    });

    testApp.storage.beforeRemovePrefix = () => {
      throw new Error('Depo erişilemiyor');
    };
    const body = { confirmName: company.name, reason: 'Saklama doldu' };
    await admin.ok(admin.post(companyPath(id, '/delete'), body), 202);
    await testApp.deps.background.idle();

    const failed = await admin.ok(admin.get(companyPath(id)));
    expect(failed.company).toMatchObject({
      deletionStatus: 'failed',
      service: { state: 'deleting' },
    });
    expect((await api.get('/projects')).body.code).toBe('ACCESS_CLOSED');
    await admin.fails(admin.post(companyPath(id, '/reopen'), { reason: 'x' }), 409, 'CONFLICT');
    expect(await PlatformLogModel.countDocuments({ action: 'company.delete_failed' })).toBe(1);
    // Başarısız silme işletim özetinde kendi grubunda görünür; silme onayı bekleyenlerde değil.
    const failedSummary = (await admin.ok(admin.get('/platform/companies'))).summary;
    expect(failedSummary.deletionIncomplete).toEqual([
      expect.objectContaining({ id, deletionStatus: 'failed', state: 'deleting' }),
    ]);
    expect(failedSummary.deletionPending).toEqual([]);

    testApp.storage.beforeRemovePrefix = null;
    await admin.ok(admin.post(companyPath(id, '/delete'), body), 202);
    await testApp.deps.background.idle();
    expect((await admin.ok(admin.get(companyPath(id)))).company.deletionStatus).toBe('done');
    expect((await admin.ok(admin.get('/platform/companies'))).summary.deletionIncomplete).toEqual(
      [],
    );
    for (const [name, count] of Object.entries(await remainingCompanyData(id))) {
      expect(count, name).toBe(0);
    }
    expect(testApp.storage.keys().filter((key) => key.startsWith(`companies/${id}/`))).toEqual([]);

    // İptal edilen dışa aktarma işi sonradan paket yazmaz.
    await new ExportService(testApp.deps).processCompany(company._id);
    expect(testApp.storage.keys()).toEqual([]);
  });

  it('müşteri oturumu yönetim uçlarını kullanamaz', async () => {
    const testApp = setup();
    await Admin.enroll(testApp);
    const customer = await createCustomer(testApp);
    const id = customer.company._id.toString();
    const auth = { Authorization: `Bearer ${customer.accessToken}` };
    const calls = [
      request(testApp.app).get('/platform/companies').set(auth),
      request(testApp.app).patch(companyPath(id)).set(auth).send({}),
      request(testApp.app).post(companyPath(id, '/quota')).set(auth).send({}),
      request(testApp.app).post(companyPath(id, '/suspend')).set(auth).send({}),
      request(testApp.app).post(companyPath(id, '/end-service')).set(auth).send({}),
      request(testApp.app).post(companyPath(id, '/reopen')).set(auth).send({}),
      request(testApp.app).post(companyPath(id, '/extend-retention')).set(auth).send({}),
      request(testApp.app).post(companyPath(id, '/delete')).set(auth).send({}),
      request(testApp.app)
        .patch(`/platform/users/${customer.user._id.toString()}`)
        .set(auth)
        .send({}),
    ];
    for (const res of await Promise.all(calls)) expect(res.status).toBe(401);
    expect((await loginCustomer(testApp, customer.user.username)).accessToken).toBeTruthy();
  });
});
