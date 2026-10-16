// Tam firma veri çıkışı (şartname 7.10, 8.10, 9.6, 10.9): arka plan işi ve ilerleme; paket içeriği
// firma kayıt sayılarıyla tutarlı; belge eşleme tablosu dosyalarla eşleşir; başka firma verisi, şifre
// veya token içermez; görüntüleme dönemindeki firma alabilir; 7 gün sonra silinir; hata finansal
// kayıtları etkilemez.

import { addDays, DELETED_STATUS_LABEL, EXPORT_RETENTION_DAYS } from '@santiye/shared';
import ExcelJS from 'exceljs';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { businessToday } from '../src/lib/clock.js';
import { AgreementModel } from '../src/models/agreement.js';
import { CategoryModel } from '../src/models/category.js';
import { CompanyModel } from '../src/models/company.js';
import { DocumentModel } from '../src/models/document.js';
import { ExportJobModel } from '../src/models/export-job.js';
import { PartyModel } from '../src/models/party.js';
import { ProjectModel } from '../src/models/project.js';
import { TransactionModel } from '../src/models/transaction.js';
import { UserModel } from '../src/models/user.js';
import { ExportService } from '../src/services/exports.js';
import { buildTestApp, createTestClock, useTestDatabase, type TestApp } from './helpers/app.js';
import { csvKurus, parseCsvRows, parseCsvTable } from './helpers/csv.js';
import { addDocument, keyOfUploadUrl, pdfFile, pngFile, startUpload } from './helpers/documents.js';
import { Api, financeSetup, tl } from './helpers/finance.js';
import { readZip } from './helpers/zip.js';

useTestDatabase();

function setup() {
  return buildTestApp({ clock: createTestClock(new Date('2026-03-20T09:00:00Z')) });
}

/**
 * Örnek firma: iki şantiye (biri silinmiş), kişiler, kategori, anlaşma (bedeli değişti), başlangıç
 * alacağı, anlaşma ödemesi ve iadesi, paylaştırılmış gider, silinmiş gider; işleme yüklenmiş görsel,
 * anlaşmaya yüklenip silinmiş PDF ve tamamlanmamış yükleme.
 */
async function seed(api: Api) {
  const villa = await api.createProject('Kadıköy Villa');
  const office = await api.createProject('Şişli Ofis');
  const empty = await api.createProject('Boş Şantiye');
  await api.ok(
    api.delete(`/projects/${empty.id}`, { reason: 'Açılmadı', expectedUpdatedAt: empty.updatedAt }),
  );
  const electric = await api.createParty('Yılmaz Elektrik', { phone: '0555 000 00 00' });
  const customer = await api.createParty('Çağlar İnşaat');
  const material = await api.ok(api.post('/categories', { name: 'Malzeme' }), 201);

  const agreement = await api.createAgreement({
    title: 'Elektrik tesisatı',
    scope: 'project',
    projectId: villa.id,
    partyId: electric.id,
    initialAmount: tl(100_000),
  });
  const current = await api.agreement(agreement.id);
  await api.ok(
    api.post(`/agreements/${agreement.id}/amount`, {
      newAmount: tl(120_000),
      reason: 'Ek iş',
      expectedUpdatedAt: current.updatedAt,
    }),
  );
  const opening = await api.ok(
    api.post('/agreements', {
      kind: 'opening',
      direction: 'receivable',
      scope: 'company',
      partyId: customer.id,
      initialAmount: tl(50_000),
      trackingStartDate: '2026-01-01',
    }),
    201,
  );
  const payment = await api.pay(agreement, tl(40_000), { date: '2026-01-15' });
  const refund = await api.ok(
    api.post(`/transactions/${payment.id}/refunds`, {
      amount: tl(10_000),
      date: '2026-02-20',
      reason: 'Fazla ödeme geri alındı',
      parts: [{ allocationId: payment.allocations[0].id, amount: tl(10_000) }],
    }),
    201,
  );
  const split = await api.ok(
    api.post('/transactions', {
      kind: 'expense',
      amount: tl(40_000),
      date: '2026-02-10',
      partyId: electric.id,
      categoryId: material.id,
      description: 'Kablo; "şalter"',
      allocations: [
        { scope: 'project', projectId: villa.id, amount: tl(25_000) },
        { scope: 'project', projectId: office.id, amount: tl(15_000) },
      ],
    }),
    201,
  );
  await api.ok(
    api.record({ kind: 'income', amount: tl(60_000), date: '2026-02-01', project: villa }),
    201,
  );
  const removed = await api.ok(
    api.record({ kind: 'expense', amount: tl(7_000), date: '2026-02-12', project: villa }),
    201,
  );
  await api.ok(
    api.delete(`/transactions/${removed.id}`, {
      reason: 'Yanlış kayıt',
      expectedUpdatedAt: removed.updatedAt,
    }),
  );

  const image = await pngFile();
  const pdf = pdfFile(3_000);
  const photo = await addDocument(api, { ownerType: 'transaction', ownerId: payment.id }, image, {
    fileName: 'Fatura Şubat.png',
  });
  const contract = await addDocument(api, { ownerType: 'agreement', ownerId: agreement.id }, pdf, {
    fileName: 'sözleşme.pdf',
    mimeType: 'application/pdf',
  });
  await api.ok(
    api.delete(`/documents/${contract.id}`, {
      reason: 'Yanlış dosya',
      expectedUpdatedAt: contract.updatedAt,
    }),
  );
  await startUpload(api, { ownerType: 'transaction', ownerId: split.id }, pdfFile(), {
    fileName: 'bekleyen.pdf',
    mimeType: 'application/pdf',
  });

  return {
    villa,
    office,
    empty,
    electric,
    customer,
    material,
    agreement,
    opening,
    payment,
    refund,
    split,
    removed,
    photo: { ...photo, body: image },
    contract: { ...contract, body: pdf },
  };
}

/** Paketi başlatır, arka plan işini bekler ve hazır işi döner. */
async function exportNow(api: Api) {
  const started = await api.ok(api.post('/exports/full', {}), 201);
  expect(started).toMatchObject({ type: 'full', status: 'queued', progress: 0 });
  await api.testApp.deps.background.idle();
  const job = await api.ok(api.get(`/exports/${started.id}`));
  expect(job, JSON.stringify(job)).toMatchObject({
    status: 'ready',
    progress: 100,
    expired: false,
  });
  return job;
}

function packageOf(testApp: TestApp, job: { download: { url: string } }) {
  const object = testApp.storage.objects.get(keyOfUploadUrl(job.download.url));
  expect(object).toBeDefined();
  return { body: object!.body, entries: readZip(object!.body) };
}

/** Kök klasördeki dosya. */
function entry(entries: Map<string, Buffer>, root: string, path: string): Buffer {
  const body = entries.get(`${root}/${path}`);
  expect(body, `pakette yok: ${path}`).toBeDefined();
  return body!;
}

describe('tam firma veri çıkışı', () => {
  it('arka planda hazırlanır; içerik firma kayıt sayılarıyla tutarlı; eşleme tablosu dosyalarla eşleşir', async () => {
    const testApp = setup();
    const { api, company } = await financeSetup(testApp);
    const data = await seed(api);
    const companyId = company._id;
    const usedBefore = (await CompanyModel.findById(companyId))!.storageUsedBytes;

    const job = await exportNow(api);
    expect(job.fileName).toMatch(/^tum-firma-verisi-ornek-firma-\d+-2026-03-20\.zip$/);
    expect(job.download.url).toContain('mode=attachment');
    expect(job.requestedBy.name).toBe('Deneme Kullanıcı');
    const { body, entries } = packageOf(testApp, job);
    expect(job.sizeBytes).toBe(body.length);
    const root = job.fileName.replace(/\.zip$/, '');
    for (const name of entries.keys()) expect(name.startsWith(`${root}/`)).toBe(true);

    const csv = (file: string) => parseCsvTable(entry(entries, root, `csv/${file}`));
    const scope = { companyId };
    const transactions = await TransactionModel.find(scope).lean();
    const agreements = await AgreementModel.find(scope).lean();

    // Kayıt sayıları (silinmiş ama geri alınabilir kayıtlar dahil).
    const hareketler = csv('hareketler.csv');
    expect(hareketler).toHaveLength(transactions.length);
    expect(csv('paylar.csv')).toHaveLength(
      transactions.reduce((sum, t) => sum + t.allocations.length, 0),
    );
    expect(csv('iadeler.csv')).toHaveLength(
      transactions.reduce((sum, t) => sum + (t.refundOf?.parts.length ?? 0), 0),
    );
    expect(csv('anlasmalar.csv')).toHaveLength(
      agreements.filter((a) => a.kind === 'agreement').length,
    );
    expect(csv('baslangic-kayitlari.csv')).toHaveLength(
      agreements.filter((a) => a.kind === 'opening').length,
    );
    expect(csv('santiyeler.csv')).toHaveLength(await ProjectModel.countDocuments(scope));
    expect(csv('kisiler.csv')).toHaveLength(await PartyModel.countDocuments(scope));
    expect(csv('kategoriler.csv')).toHaveLength(await CategoryModel.countDocuments(scope));
    const uploaded = await DocumentModel.find({ ...scope, status: 'uploaded' }).lean();
    const belgeler = csv('belgeler.csv');
    expect(belgeler).toHaveLength(uploaded.length);
    expect(belgeler).toHaveLength(2);

    // Silinen kayıtlar durum etiketiyle.
    const statusOf = (rows: Record<string, string>[], id: string) =>
      rows.find((row) => row['Kimlik'] === id)?.['Durum'];
    expect(statusOf(hareketler, data.removed.id)).toBe(DELETED_STATUS_LABEL);
    expect(statusOf(hareketler, data.payment.id)).toBe('Geçerli');
    expect(statusOf(csv('santiyeler.csv'), data.empty.id)).toBe(DELETED_STATUS_LABEL);
    expect(statusOf(belgeler, data.contract.id)).toBe(DELETED_STATUS_LABEL);
    const removedRow = hareketler.find((row) => row['Kimlik'] === data.removed.id)!;
    expect(removedRow['Silme gerekçesi']).toBe('Yanlış kayıt');

    // İlişkiler: pay → hareket ve şantiye; iade → kaynak pay.
    const splitShares = csv('paylar.csv').filter((row) => row['İşlem kimliği'] === data.split.id);
    expect(
      splitShares.map((row) => [row['Şantiye kimliği'], csvKurus(row['Pay tutarı']!)]),
    ).toEqual([
      [data.villa.id, tl(25_000)],
      [data.office.id, tl(15_000)],
    ]);
    const [refundPart] = csv('iadeler.csv');
    expect(refundPart).toMatchObject({
      'İade işlem kimliği': data.refund.id,
      'Kaynak işlem kimliği': data.payment.id,
      'Kaynak pay kimliği': data.payment.allocations[0].id,
    });
    expect(csv('anlasmalar.csv')[0]).toMatchObject({
      Ad: 'Elektrik tesisatı',
      'Güncel bedel': '120000,00',
      Kalan: '90000,00',
    });
    const splitRow = hareketler.find((row) => row['Kimlik'] === data.split.id)!;
    expect(splitRow['Açıklama']).toBe('Kablo; "şalter"');

    // Belge eşleme tablosu ↔ paketteki dosyalar: aynı küme, aynı içerik.
    const documentEntries = [...entries.keys()].filter((name) =>
      name.startsWith(`${root}/belgeler/`),
    );
    expect(documentEntries.sort()).toEqual(
      belgeler.map((row) => `${root}/${row['Paketteki dosya']}`).sort(),
    );
    const fileOf = (id: string) => {
      const row = belgeler.find((r) => r['Kimlik'] === id)!;
      return { row, body: entry(entries, root, row['Paketteki dosya']!) };
    };
    const photo = fileOf(data.photo.id);
    expect(photo.body.equals(data.photo.body)).toBe(true);
    expect(photo.row).toMatchObject({
      'Bağlı kayıt türü': 'Hareket',
      'Bağlı kayıt kimliği': data.payment.id,
      'Dosya adı': 'Fatura Şubat.png',
      'Boyut (bayt)': String(data.photo.body.length),
    });
    const contract = fileOf(data.contract.id);
    expect(contract.body.equals(data.contract.body)).toBe(true);
    expect(contract.row).toMatchObject({
      'Bağlı kayıt türü': 'Anlaşma',
      'Bağlı kayıt kimliği': data.agreement.id,
      'Silme gerekçesi': 'Yanlış dosya',
    });

    // Değişiklik geçmişi: belgenin kendi geçmişi (ekleme, yükleme, silme) ve gerekçeli bedel değişikliği.
    const history = csv('degisiklik-gecmisi.csv');
    const contractHistory = history
      .filter((row) => row['Kayıt kimliği'] === data.contract.id)
      .map((row) => [row['İşlem'], row['Yapan'], row['Gerekçe']]);
    expect(contractHistory).toEqual([
      ['Oluşturuldu', 'Deneme Kullanıcı', ''],
      ['Yüklendi', 'Deneme Kullanıcı', ''],
      ['Silindi', 'Deneme Kullanıcı', 'Yanlış dosya'],
    ]);
    expect(
      history.some(
        (row) => row['Kayıt türü'] === 'Belge' && row['Kayıt']?.includes('bekleyen.pdf'),
      ),
    ).toBe(true);
    expect(
      history.find(
        (row) => row['Kayıt kimliği'] === data.agreement.id && row['İşlem'] === 'Bedel değişti',
      ),
    ).toMatchObject({
      Alan: 'Bedel',
      'Eski değer': '100.000 TL',
      'Yeni değer': '120.000 TL',
      Gerekçe: 'Ek iş',
    });

    // Toplamlar aynı satırlardan ve rapor API'siyle aynı.
    const ozet = parseCsvRows(entry(entries, root, 'csv/ozet.csv'));
    const ozetValue = (label: string) => ozet.find((row) => row[0] === label)?.[1];
    const activeRows = hareketler.filter((row) => row['Durum'] === 'Geçerli');
    const sum = (kind: string) =>
      activeRows
        .filter((row) => row['Tür'] === kind)
        .reduce((total, row) => total + csvKurus(row['Tutar']!), 0);
    const report = await api.ok(api.get('/reports/period'));
    expect(csvKurus(ozetValue('Ödeme')!)).toBe(sum('Gider'));
    expect(csvKurus(ozetValue('Net ödeme')!)).toBe(sum('Gider') - sum('Ödeme iadesi'));
    expect(csvKurus(ozetValue('Net ödeme')!)).toBe(report.totals.netExpense);
    expect(csvKurus(ozetValue('Gelir − gider farkı')!)).toBe(report.totals.difference);
    expect(csvKurus(ozetValue('Kalan borç')!)).toBe(report.obligations.payable.remaining);
    expect(ozetValue('Takip başlangıcı')).toBe('1 Oca 2026');
    const relations = ozet.slice(ozet.findIndex((row) => row[0] === 'Tablolar ve ilişkiler') + 1);
    const countRow = (table: string) => relations.find((row) => row[0] === table);
    expect(countRow('Hareketler')?.slice(1, 4)).toEqual([
      'csv/hareketler.csv',
      String(transactions.length),
      '1',
    ]);

    // Excel: aynı tablolar ayrı sayfalarda.
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(entry(entries, root, 'veri.xlsx') as unknown as ArrayBuffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Özet',
      'Tablolar ve ilişkiler',
      'Hareketler',
      'Paylar',
      'İadeler',
      'Anlaşmalar',
      'Başlangıç kayıtları',
      'Şantiyeler',
      'Kişiler ve firmalar',
      'Kategoriler',
      'Belgeler',
      'Değişiklik geçmişi',
    ]);
    expect(workbook.getWorksheet('Hareketler')!.rowCount).toBe(transactions.length + 1);
    expect(workbook.getWorksheet('Belgeler')!.rowCount).toBe(uploaded.length + 1);

    // Hazır paket kapasitede sayılır; döküm toplamı kullanılan alanla aynı.
    const info = await api.ok(api.get('/company'));
    expect(info.storage.usedBytes).toBe(usedBefore + body.length);
    const breakdown = info.storage.breakdown;
    expect(breakdown.exportBytes).toBe(body.length);
    expect(
      breakdown.originalBytes +
        breakdown.previewBytes +
        breakdown.deletedBytes +
        breakdown.pendingBytes +
        breakdown.exportBytes,
    ).toBe(info.storage.usedBytes);
  });

  it('başka firma verisi, şifre veya token içermez', async () => {
    const testApp = setup();
    const owner = await financeSetup(testApp);
    await seed(owner.api);
    await CompanyModel.updateOne(
      { _id: owner.company._id },
      { $set: { opsNote: 'Ürün sahibi notu Gizli-OPS-5520' } },
    );

    const other = await financeSetup(testApp);
    const SECRET = 'Yabancı-Gizli-8841';
    const otherProject = await other.api.createProject(`Şantiye ${SECRET}`);
    const otherParty = await other.api.createParty(`Kişi ${SECRET}`);
    const otherPayment = await other.api.ok(
      other.api.record({
        kind: 'expense',
        amount: tl(1_234),
        project: otherProject,
        party: otherParty,
      }),
      201,
    );
    const otherDoc = await addDocument(
      other.api,
      { ownerType: 'transaction', ownerId: otherPayment.id },
      pdfFile(1_500),
      { fileName: `Belge ${SECRET}.pdf`, mimeType: 'application/pdf' },
    );

    const job = await exportNow(owner.api);
    const { entries } = packageOf(testApp, job);
    // Excel de bir zip'tir; içindeki XML dosyaları da taranır.
    const texts: string[] = [];
    for (const [name, body] of entries) {
      if (name.endsWith('.xlsx')) {
        for (const inner of readZip(body).values()) texts.push(inner.toString('utf8'));
      } else if (name.endsWith('.csv')) {
        texts.push(body.toString('utf8'));
      }
    }
    expect(texts.length).toBeGreaterThan(10);
    const all = texts.join('\n');
    expect(all).toContain('Yılmaz Elektrik');

    const users = await UserModel.find({}).select('+passwordHash +refreshTokens').lean();
    const forbidden = [
      SECRET,
      otherProject.id,
      otherParty.id,
      otherPayment.id,
      otherDoc.id,
      other.company._id.toString(),
      'Gizli-OPS-5520',
      owner.accessToken,
      owner.refreshToken,
      other.accessToken,
      other.refreshToken,
      owner.password,
      ...users.flatMap((user) => [
        user.passwordHash,
        user.username,
        ...user.refreshTokens.map((token) => token.tokenHash),
      ]),
    ];
    for (const value of forbidden) {
      expect(value.length).toBeGreaterThan(3);
      expect(all, `pakette olmamalı: ${value.slice(0, 12)}…`).not.toContain(value);
    }
    expect(all).not.toMatch(/passwordHash|refreshToken|eyJ[A-Za-z0-9_-]{10,}/);
    // Başka firmanın belge dosyası pakette yok.
    expect([...entries.keys()].some((name) => name.includes(otherDoc.id))).toBe(false);

    // Başka firmanın işi görünmez.
    expect((await other.api.get(`/exports/${job.id}`)).status).toBe(404);
    expect(await other.api.ok(other.api.get('/exports'))).toEqual([]);
  });

  it('görüntüleme dönemindeki firma tam veri çıkışı alır; kayıt değiştiremez', async () => {
    const testApp = setup();
    const { api, company } = await financeSetup(testApp);
    await seed(api);
    const serviceEndedAt = addDays(businessToday(testApp.clock), -5);
    await CompanyModel.updateOne(
      { _id: company._id },
      {
        $set: {
          serviceEndedAt,
          viewUntil: addDays(serviceEndedAt, 30),
          retainUntil: addDays(serviceEndedAt, 180),
        },
      },
    );

    const job = await exportNow(api);
    const { entries } = packageOf(testApp, job);
    expect(entries.size).toBeGreaterThan(10);
    expect((await api.ok(api.get('/exports')))[0].id).toBe(job.id);

    const write = await api.record({ kind: 'expense', amount: tl(1_000) });
    expect(write.status).toBe(403);
    expect(write.body.code).toBe('READ_ONLY');
  });

  it('hazırlanan paket varken ikinci istek yeni iş açmaz; hazır olduktan sonra açar', async () => {
    const testApp = setup();
    const { api, company } = await financeSetup(testApp);
    await api.createProject();

    const [first, second] = await Promise.all([
      api.post('/exports/full', {}),
      api.post('/exports/full', {}),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 201]);
    expect(first.body.data.id).toBe(second.body.data.id);
    await testApp.deps.background.idle();
    expect(await ExportJobModel.countDocuments({ companyId: company._id })).toBe(1);

    const next = await api.ok(api.post('/exports/full', {}), 201);
    expect(next.id).not.toBe(first.body.data.id);
    await testApp.deps.background.idle();
    const list = await api.ok(api.get('/exports'));
    expect(list.map((job: { id: string; status: string }) => [job.id, job.status])).toEqual([
      [next.id, 'ready'],
      [first.body.data.id, 'ready'],
    ]);
  });

  it(`hazır paket ${EXPORT_RETENTION_DAYS} gün sonra silinir ve kapasite iade edilir`, async () => {
    const testApp = setup();
    const { api, company } = await financeSetup(testApp);
    await seed(api);
    const usedBefore = (await CompanyModel.findById(company._id))!.storageUsedBytes;
    const job = await exportNow(api);
    const key = keyOfUploadUrl(job.download.url);

    const service = new ExportService(testApp.deps);
    testApp.clock.advance((EXPORT_RETENTION_DAYS * 24 - 1) * 60 * 60 * 1000);
    await service.sweep();
    expect(testApp.storage.objects.has(key)).toBe(true);

    testApp.clock.advance(2 * 60 * 60 * 1000);
    const fresh = await api.relogin();
    // Tarama çalışmadan da süresi geçen paket indirilemez.
    const beforeSweep = await fresh.ok(fresh.get(`/exports/${job.id}`));
    expect(beforeSweep).toMatchObject({ expired: true, download: null });

    await service.sweep();
    await service.sweep();
    expect(testApp.storage.objects.has(key)).toBe(false);
    expect((await CompanyModel.findById(company._id))!.storageUsedBytes).toBe(usedBefore);
    const info = await fresh.ok(fresh.get('/company'));
    expect(info.storage.breakdown.exportBytes).toBe(0);
    expect(await fresh.ok(fresh.get(`/exports/${job.id}`))).toMatchObject({
      status: 'ready',
      expired: true,
      download: null,
    });
  });

  it('yeni paket hazır olunca önceki silinir; kapasite yalnız son paketi sayar', async () => {
    const testApp = setup();
    const { api, company } = await financeSetup(testApp);
    await seed(api);
    const usedBefore = (await CompanyModel.findById(company._id))!.storageUsedBytes;

    const first = await exportNow(api);
    const firstKey = keyOfUploadUrl(first.download.url);
    const second = await exportNow(api);
    const secondKey = keyOfUploadUrl(second.download.url);

    expect(testApp.storage.keys().filter((key) => key.includes('/exports/'))).toEqual([secondKey]);
    expect(firstKey).not.toBe(secondKey);
    expect((await CompanyModel.findById(company._id))!.storageUsedBytes).toBe(
      usedBefore + second.sizeBytes,
    );
    const info = await api.ok(api.get('/company'));
    expect(info.storage.breakdown.exportBytes).toBe(second.sizeBytes);
    expect(await api.ok(api.get(`/exports/${first.id}`))).toMatchObject({
      status: 'ready',
      expired: true,
      download: null,
    });
    expect(await api.ok(api.get(`/exports/${second.id}`))).toMatchObject({ expired: false });

    // Tarama tekrar iade etmez.
    await new ExportService(testApp.deps).sweep();
    expect((await CompanyModel.findById(company._id))!.storageUsedBytes).toBe(
      usedBefore + second.sizeBytes,
    );
  });

  it('yeni iş başarısız olursa önceki paket süresi dolana kadar indirilebilir kalır', async () => {
    const testApp = setup();
    const { api, company } = await financeSetup(testApp);
    await seed(api);
    const first = await exportNow(api);
    const firstKey = keyOfUploadUrl(first.download.url);
    const usedWithFirst = (await CompanyModel.findById(company._id))!.storageUsedBytes;

    testApp.storage.onStreamChunk = () => {
      throw new Error('Depo bağlantısı koptu');
    };
    const started = await api.ok(api.post('/exports/full', {}), 201);
    await testApp.deps.background.idle();
    expect(await api.ok(api.get(`/exports/${started.id}`))).toMatchObject({ status: 'failed' });
    await new ExportService(testApp.deps).sweep();

    const kept = await api.ok(api.get(`/exports/${first.id}`));
    expect(kept).toMatchObject({ status: 'ready', expired: false });
    expect(kept.download.url).toContain('mode=attachment');
    expect(testApp.storage.objects.has(firstKey)).toBe(true);
    expect((await CompanyModel.findById(company._id))!.storageUsedBytes).toBe(usedWithFirst);
  });

  it('tarama ile değiştirme aynı paketi silmeye çalışınca kapasite bir kez iade edilir', async () => {
    const testApp = setup();
    const { api, company } = await financeSetup(testApp);
    await seed(api);
    const usedBefore = (await CompanyModel.findById(company._id))!.storageUsedBytes;
    const first = await exportNow(api);
    const firstKey = keyOfUploadUrl(first.download.url);

    // Yeni paket hazır kaydedildi ama önceki henüz silinmedi (ör. sunucu tam bu anda durdu).
    const userId = (await UserModel.findOne({ companyId: company._id }))!._id;
    testApp.clock.advance(EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000 + 1000);
    const newerKey = `companies/${company._id.toString()}/exports/yeni/paket.zip`;
    testApp.storage.upload(newerKey, Buffer.alloc(5_000), 'application/zip');
    const now = testApp.clock.now();
    await ExportJobModel.create({
      companyId: company._id,
      requestedBy: userId,
      createdBy: userId,
      updatedBy: userId,
      type: 'full',
      status: 'ready',
      progress: 100,
      active: null,
      fileKey: newerKey,
      fileName: 'yeni.zip',
      sizeBytes: 5_000,
      countedBytes: 5_000,
      finishedAt: now,
      expiresAt: new Date(now.getTime() + EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    });
    await CompanyModel.updateOne({ _id: company._id }, { $inc: { storageUsedBytes: 5_000 } });

    // Önceki paket hem süresi dolmuş hem yenisiyle değişmiş: tarama ve değiştirme aynı anda siler.
    const service = new ExportService(testApp.deps);
    await Promise.all([
      service.sweep(),
      service.removeSuperseded(company._id),
      service.removeSuperseded(company._id),
      service.expireOne(company._id, { _id: new Types.ObjectId(first.id), fileKey: firstKey }),
    ]);

    expect(testApp.storage.objects.has(firstKey)).toBe(false);
    expect(testApp.storage.objects.has(newerKey)).toBe(true);
    expect((await CompanyModel.findById(company._id))!.storageUsedBytes).toBe(usedBefore + 5_000);
    expect(
      await ExportJobModel.find({ companyId: company._id, countedBytes: { $gt: 0 } }).lean(),
    ).toEqual([expect.objectContaining({ fileKey: newerKey })]);
  });

  it('hazırlama hatası yalnız işi başarısız yapar; finansal kayıtlar ve kapasite değişmez', async () => {
    const testApp = setup();
    const { api, company } = await financeSetup(testApp);
    await seed(api);
    const snapshot = async () => ({
      transactions: await TransactionModel.find({ companyId: company._id }).lean(),
      agreements: await AgreementModel.find({ companyId: company._id }).lean(),
      used: (await CompanyModel.findById(company._id))!.storageUsedBytes,
    });
    const before = await snapshot();

    testApp.storage.onStreamChunk = () => {
      throw new Error('Depo bağlantısı koptu');
    };
    const started = await api.ok(api.post('/exports/full', {}), 201);
    await testApp.deps.background.idle();
    const failed = await api.ok(api.get(`/exports/${started.id}`));
    expect(failed).toMatchObject({ status: 'failed', download: null });
    expect(failed.error).toMatch(/Finansal kayıtlarınız etkilenmedi/);
    expect(await snapshot()).toEqual(before);
    expect(testApp.storage.keys().some((key) => key.includes('/exports/'))).toBe(false);

    // Hata sonrası yeniden denenebilir.
    testApp.storage.onStreamChunk = null;
    const retried = await exportNow(api);
    expect(retried.id).not.toBe(started.id);
  });

  it('kilidi düşen iş (ör. sunucu yeniden başladı) taramada yeniden hazırlanır', async () => {
    const testApp = setup();
    const { api, company } = await financeSetup(testApp);
    await api.createProject();
    const userId = (await UserModel.findOne({ companyId: company._id }))!._id;
    const job = await ExportJobModel.create({
      companyId: company._id,
      requestedBy: userId,
      createdBy: userId,
      updatedBy: userId,
      type: 'full',
      status: 'running',
      progress: 40,
      attempts: 1,
      active: true,
      lease: { token: 'eski', until: new Date(testApp.clock.now().getTime() - 1_000) },
    });
    await new ExportService(testApp.deps).sweep();
    expect(await api.ok(api.get(`/exports/${job._id.toString()}`))).toMatchObject({
      status: 'ready',
      progress: 100,
    });
  });
});
