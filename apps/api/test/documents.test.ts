import { randomUUID } from 'node:crypto';
import { addDays, DOCUMENT_MAX_BYTES } from '@santiye/shared';
import type { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { businessToday } from '../src/lib/clock.js';
import { contentDisposition } from '../src/lib/storage.js';
import { detectDocumentType } from '../src/lib/file-signature.js';
import { AgreementModel } from '../src/models/agreement.js';
import { CompanyModel } from '../src/models/company.js';
import { DocumentModel } from '../src/models/document.js';
import { TransactionModel } from '../src/models/transaction.js';
import { DocumentService } from '../src/services/documents.js';
import { buildTestApp, useTestDatabase, type TestApp } from './helpers/app.js';
import {
  addDocument,
  brokenHeicFile,
  intentBody,
  keyOfUploadUrl,
  pdfFile,
  pngFile,
  startUpload,
  type OwnerRef,
} from './helpers/documents.js';
import { financeSetup, tl, type Api } from './helpers/finance.js';

useTestDatabase();

const MINUTE = 60_000;

async function setup() {
  const testApp = buildTestApp();
  const customer = await financeSetup(testApp);
  const expense = await customer.api.ok(
    customer.api.record({ kind: 'expense', amount: tl(1_500) }),
    201,
  );
  const owner: OwnerRef = { ownerType: 'transaction', ownerId: expense.id };
  return { testApp, ...customer, expense, owner };
}

async function storageOf(companyId: Types.ObjectId) {
  const company = await CompanyModel.findById(companyId).lean();
  return { used: company!.storageUsedBytes, quota: company!.storageQuotaBytes };
}

async function documentCountOf(companyId: Types.ObjectId, transactionId: string) {
  const tx = await TransactionModel.findOne({ _id: transactionId, companyId }).lean();
  return tx!.documentCount;
}

/** Firmanın kullanım sayacı, belgelerde sayılan baytların toplamına eşit olmalı. */
async function expectStorageConsistent(companyId: Types.ObjectId) {
  const docs = await DocumentModel.find({ companyId }).lean();
  const counted = docs.reduce((sum, doc) => sum + doc.countedBytes, 0);
  expect((await storageOf(companyId)).used).toBe(counted);
}

describe('dosya imzası', () => {
  it('desteklenen türleri ilk baytlardan tanır; diğerlerini reddeder', async () => {
    expect(detectDocumentType(pdfFile(100))).toBe('application/pdf');
    expect(detectDocumentType(await pngFile())).toBe('image/png');
    expect(detectDocumentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    const webp = Buffer.alloc(16);
    webp.write('RIFF', 0, 'latin1');
    webp.write('WEBPVP8 ', 8, 'latin1');
    expect(detectDocumentType(webp)).toBe('image/webp');
    expect(detectDocumentType(brokenHeicFile())).toBe('image/heic');

    const heif = brokenHeicFile();
    heif.write('mif1', 8, 'latin1');
    heif.write('mif1miaf', 16, 'latin1');
    expect(detectDocumentType(heif)).toBe('image/heif');
    const avif = brokenHeicFile();
    avif.write('avif', 8, 'latin1');
    avif.write('mif1miaf', 16, 'latin1');
    expect(detectDocumentType(avif)).toBeNull();
    expect(detectDocumentType(Buffer.from('Merhaba, bu bir metin dosyası.'))).toBeNull();
    expect(detectDocumentType(Buffer.alloc(0))).toBeNull();
  });

  it('indirme adındaki Türkçe karakterler korunur', () => {
    expect(contentDisposition('Çelik faturası "Ekim".pdf', false)).toBe(
      `attachment; filename="_elik faturas_ _Ekim_.pdf"; filename*=UTF-8''${encodeURIComponent('Çelik faturası "Ekim".pdf')}`,
    );
    expect(contentDisposition('a.png', true)).toMatch(/^inline;/);
  });
});

describe('belge yükleme akışı', () => {
  it('niyet → yükleme → tamamlama: boyut ve tür sunucuda doğrulanır, orijinal nihai anahtara kopyalanır', async () => {
    const { testApp, api, company, owner, expense } = await setup();
    const file = await pngFile();

    const intent = await api.ok(
      api.post(
        '/documents/upload-intent',
        intentBody(owner, file, { fileName: 'Fiş/../çimento.png' }),
      ),
      201,
    );
    expect(intent.document).toMatchObject({
      status: 'pending',
      fileName: 'çimento.png',
      sizeBytes: null,
      ownerType: 'transaction',
      ownerId: expense.id,
    });
    expect(intent.upload).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
    });
    expect(new Date(intent.upload.expiresAt).getTime() - testApp.clock.now().getTime()).toBe(
      15 * MINUTE,
    );
    const tempKey = keyOfUploadUrl(intent.upload.url);
    expect(tempKey).toBe(`companies/${company._id.toString()}/uploads/${intent.document.id}`);
    expect((await storageOf(company._id)).used).toBe(file.length);
    expect(await documentCountOf(company._id, expense.id)).toBe(1);

    testApp.storage.upload(tempKey, file);
    const done = await api.ok(api.post(`/documents/${intent.document.id}/complete`, {}, null));
    expect(done).toMatchObject({
      status: 'uploaded',
      mimeType: 'image/png',
      sizeBytes: file.length,
      hasPreview: true,
    });

    const stored = await DocumentModel.findOne({ _id: done.id, companyId: company._id }).lean();
    expect(stored!.storageKey).toMatch(
      new RegExp(`^companies/${company._id.toString()}/documents/${done.id}/[0-9a-f-]+/original$`),
    );
    expect(testApp.storage.objects.has(tempKey)).toBe(false);
    expect(testApp.storage.objects.get(stored!.storageKey!)!.body.equals(file)).toBe(true);
    expect(stored!.previewBytes).toBeGreaterThan(0);
    expect(testApp.storage.objects.get(stored!.previewKey!)!.body.subarray(0, 3)).toEqual(
      Buffer.from([0xff, 0xd8, 0xff]),
    );
    expect((await storageOf(company._id)).used).toBe(file.length + stored!.previewBytes);
    await expectStorageConsistent(company._id);

    // Tekrar tamamlama aynı belgeyi döner; kapasite iki kez sayılmaz.
    const again = await api.ok(api.post(`/documents/${done.id}/complete`, {}, null));
    expect(again.id).toBe(done.id);
    await expectStorageConsistent(company._id);

    const detail = await api.transaction(expense.id);
    expect(detail.documentCount).toBe(1);
    expect(detail.documents).toEqual([
      expect.objectContaining({ id: done.id, status: 'uploaded', fileName: 'çimento.png' }),
    ]);
  });

  it('bildirilen tür yerine dosya imzası esas alınır; desteklenmeyen içerik reddedilir ve rezervasyon iade edilir', async () => {
    const { testApp, api, company, owner, expense } = await setup();
    const png = await pngFile();
    const asJpeg = await addDocument(api, owner, png, {
      fileName: 'foto.jpg',
      mimeType: 'image/jpeg',
    });
    expect(asJpeg.mimeType).toBe('image/png');

    const text = Buffer.from('Bu bir PDF değil, düz metin.');
    const intent = await startUpload(api, owner, text, {
      fileName: 'sahte.pdf',
      mimeType: 'application/pdf',
    });
    const res = await api.post(`/documents/${intent.document.id}/complete`, {}, null);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION',
      message: 'Bu dosya türü desteklenmiyor. PDF, JPEG, PNG, WEBP veya HEIC yükleyin.',
    });
    const failed = await DocumentModel.findOne({ _id: intent.document.id, companyId: company._id });
    expect(failed!.status).toBe('failed');
    expect(testApp.storage.objects.has(keyOfUploadUrl(intent.upload.url))).toBe(false);
    expect(await documentCountOf(company._id, expense.id)).toBe(1);
    await expectStorageConsistent(company._id);

    const bad = await api.post('/documents/upload-intent', {
      ...intentBody(owner, text),
      mimeType: 'text/plain',
    });
    expect(bad.status).toBe(400);
    expect(bad.body.details.issues).toContainEqual({
      path: 'mimeType',
      message: 'Bu dosya türü desteklenmiyor. PDF, JPEG, PNG, WEBP veya HEIC yükleyin.',
    });
  });

  it('aynı belge için eşzamanlı iki tamamlama tek kez sayılır ve yetim dosya bırakmaz', async () => {
    const { testApp, api, company, owner, expense } = await setup();
    const intent = await startUpload(api, owner, await pngFile());
    const results = await Promise.all([
      api.post(`/documents/${intent.document.id}/complete`, {}, null),
      api.post(`/documents/${intent.document.id}/complete`, {}, null),
    ]);
    expect(results.some((res) => res.status === 200)).toBe(true);
    for (const res of results) {
      if (res.status !== 200) {
        expect(res.body.message).toBe('Belge şu anda doğrulanıyor; birazdan yeniden deneyin.');
      }
    }
    const stored = await DocumentModel.findOne({ _id: intent.document.id, companyId: company._id });
    expect(stored!.status).toBe('uploaded');
    expect(testApp.storage.keys()).toEqual([stored!.storageKey, stored!.previewKey].sort());
    expect(await documentCountOf(company._id, expense.id)).toBe(1);
    await expectStorageConsistent(company._id);
  });

  it('dosya depoya ulaşmadıysa tamamlama reddedilir; yükleme sonra tamamlanabilir', async () => {
    const { testApp, api, owner } = await setup();
    const file = pdfFile();
    const intent = await api.ok(api.post('/documents/upload-intent', intentBody(owner, file)), 201);
    const early = await api.post(`/documents/${intent.document.id}/complete`, {}, null);
    expect(early.status).toBe(400);
    expect(early.body.message).toBe('Dosya depoya ulaşmadı. Dosyayı yeniden yükleyip deneyin.');

    testApp.storage.upload(keyOfUploadUrl(intent.upload.url), file);
    const done = await api.ok(api.post(`/documents/${intent.document.id}/complete`, {}, null));
    expect(done).toMatchObject({
      status: 'uploaded',
      mimeType: 'application/pdf',
      hasPreview: false,
    });
  });

  it('PDF için önizleme üretilmez; önizleme isteği orijinali tarayıcıda açar. Adresler 5 dk geçerli', async () => {
    const { testApp, api, owner } = await setup();
    const pdf = await addDocument(api, owner, pdfFile(), {
      fileName: 'sözleşme.pdf',
      mimeType: 'application/pdf',
    });
    const preview = await api.ok(api.get(`/documents/${pdf.id}/preview`));
    expect(preview).toMatchObject({ isPreview: false, mimeType: 'application/pdf' });
    expect(preview.url).toMatch(/\/original\?mode=inline&expires=300$/);
    expect(new Date(preview.expiresAt).getTime() - testApp.clock.now().getTime()).toBe(5 * MINUTE);

    const download = await api.ok(api.get(`/documents/${pdf.id}/download`));
    expect(download).toMatchObject({ isPreview: false, fileName: 'sözleşme.pdf' });
    expect(download.url).toMatch(/\/original\?mode=attachment&expires=300$/);

    const image = await addDocument(api, owner, await pngFile());
    const imagePreview = await api.ok(api.get(`/documents/${image.id}/preview`));
    expect(imagePreview).toMatchObject({ isPreview: true, mimeType: 'image/jpeg' });
    expect(imagePreview.url).toMatch(/\/preview\.jpg\?mode=inline&expires=300$/);
  });

  it('çözülemeyen HEIC yine yüklenir; önizleme olmadan orijinal açılır', async () => {
    const { api, company, owner } = await setup();
    const doc = await addDocument(api, owner, brokenHeicFile(), {
      fileName: 'IMG_0001.HEIC',
      mimeType: 'image/heic',
    });
    expect(doc).toMatchObject({ status: 'uploaded', mimeType: 'image/heic', hasPreview: false });
    await expectStorageConsistent(company._id);
  });

  it('anlaşmaya da belge eklenir; anlaşma detayı belgeleri listeler', async () => {
    const { api, company } = await setup();
    const party = await api.createParty('Demirci Ali');
    const agreement = await api.createAgreement({
      title: 'Demir işleri',
      scope: 'company',
      partyId: party.id,
      initialAmount: tl(10_000),
    });
    const doc = await addDocument(
      api,
      { ownerType: 'agreement', ownerId: agreement.id },
      pdfFile(),
      { fileName: 'sözleşme.pdf', mimeType: 'application/pdf' },
    );
    const detail = await api.agreement(agreement.id);
    expect(detail.documentCount).toBe(1);
    expect(detail.documents.map((d: { id: string }) => d.id)).toEqual([doc.id]);
    // Belge eklemek anlaşmanın sürümünü değiştirmez; açık bir düzenleme formu çakışmaz.
    expect(detail.updatedAt).toBe(agreement.updatedAt);
    const stored = await AgreementModel.findOne({ _id: agreement.id, companyId: company._id });
    expect(stored!.documentCount).toBe(1);
  });

  it('aynı Idempotency-Key ile tekrar aynı belgeyi döner; ikinci rezervasyon yapılmaz', async () => {
    const { api, company, owner, expense } = await setup();
    const file = pdfFile();
    const key = randomUUID();
    const body = intentBody(owner, file, { mimeType: 'application/pdf' });
    const first = await api.ok(api.post('/documents/upload-intent', body, key), 201);
    const second = await api.ok(api.post('/documents/upload-intent', body, key), 201);
    expect(second.document.id).toBe(first.document.id);
    expect(second.upload.url).toBeTruthy();
    expect((await storageOf(company._id)).used).toBe(file.length);
    expect(await documentCountOf(company._id, expense.id)).toBe(1);
  });
});

describe('belge sınırları', () => {
  it('20 MB üstü dosya: niyette ve gerçek boyutu büyük çıkan dosyada reddedilir', async () => {
    const { testApp, api, company, owner, expense } = await setup();
    const tooBig = await api.post('/documents/upload-intent', {
      ...intentBody(owner, pdfFile()),
      sizeBytes: DOCUMENT_MAX_BYTES + 1,
    });
    expect(tooBig.status).toBe(422);
    expect(tooBig.body).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      message: 'Dosya en fazla 20 MB olabilir.',
    });

    // Küçük bildirip büyük dosya yükleyen istemci tamamlamada yakalanır.
    const big = pdfFile(DOCUMENT_MAX_BYTES + 1);
    const intent = await startUpload(api, owner, big, {
      mimeType: 'application/pdf',
      sizeBytes: 1_000,
    });
    const res = await api.post(`/documents/${intent.document.id}/complete`, {}, null);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('LIMIT_EXCEEDED');
    expect(testApp.storage.keys()).toEqual([]);
    expect((await storageOf(company._id)).used).toBe(0);
    expect(await documentCountOf(company._id, expense.id)).toBe(0);
  });

  it('kayıt başına 10 belge sınırı eşzamanlı niyetlerde de aşılmaz', async () => {
    const { api, company, owner, expense } = await setup();
    const file = pdfFile(100);
    const responses = await Promise.all(
      Array.from({ length: 15 }, () =>
        api.post(
          '/documents/upload-intent',
          intentBody(owner, file, { mimeType: 'application/pdf' }),
        ),
      ),
    );
    const statuses = responses.map((res) => res.status).sort();
    expect(statuses.filter((status) => status === 201)).toHaveLength(10);
    expect(statuses.filter((status) => status === 422)).toHaveLength(5);
    const rejected = responses.find((res) => res.status === 422)!;
    expect(rejected.body).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      message: 'Bu kayda en fazla 10 belge eklenebilir.',
    });
    expect(await documentCountOf(company._id, expense.id)).toBe(10);
    expect(
      await DocumentModel.countDocuments({ companyId: company._id, ownerId: expense.id }),
    ).toBe(10);
    expect((await storageOf(company._id)).used).toBe(10 * file.length);
  });

  it('firma kapasitesi eşzamanlı niyetlerde de aşılmaz', async () => {
    const { api, company, owner } = await setup();
    await CompanyModel.updateOne({ _id: company._id }, { storageQuotaBytes: 5_000 });
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        api.post(
          '/documents/upload-intent',
          intentBody(owner, pdfFile(1_000), { mimeType: 'application/pdf' }),
        ),
      ),
    );
    expect(responses.filter((res) => res.status === 201)).toHaveLength(5);
    const full = responses.filter((res) => res.status === 409);
    expect(full).toHaveLength(3);
    expect(full[0]!.body).toMatchObject({
      code: 'STORAGE_FULL',
      message:
        'Belge alanı doldu. Kayıt girmeye devam edebilirsiniz; yeni belge için ürün sahibiyle görüşün.',
    });
    expect(await storageOf(company._id)).toEqual({ used: 5_000, quota: 5_000 });
    // Kapasite dolduğu için reddedilen niyet kayıt sayacını da artırmaz.
    expect(await documentCountOf(company._id, owner.ownerId)).toBe(5);
  });

  it('gerçek boyut bildirilenden büyükse fark kotaya sığmalı; eşzamanlı tamamlamalarda da', async () => {
    const { testApp, api, company, owner } = await setup();
    await CompanyModel.updateOne({ _id: company._id }, { storageQuotaBytes: 2_300 });
    const intents = [];
    for (let i = 0; i < 2; i++) {
      const file = pdfFile(1_200);
      const intent = await api.ok(
        api.post(
          '/documents/upload-intent',
          intentBody(owner, file, { mimeType: 'application/pdf', sizeBytes: 1_000 }),
        ),
        201,
      );
      testApp.storage.upload(keyOfUploadUrl(intent.upload.url), file);
      intents.push(intent);
    }
    const results = await Promise.all(
      intents.map((intent) => api.post(`/documents/${intent.document.id}/complete`, {}, null)),
    );
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(results.find((res) => res.status === 409)!.body.code).toBe('STORAGE_FULL');
    const { used, quota } = await storageOf(company._id);
    expect(used).toBe(1_200);
    expect(used).toBeLessThanOrEqual(quota);
    await expectStorageConsistent(company._id);
    expect(await documentCountOf(company._id, owner.ownerId)).toBe(1);
  });

  it('gerçek boyut küçükse fark iade edilir; önizleme kotaya sığmazsa üretilmez ve kota aşılmaz', async () => {
    const { api, company, owner } = await setup();
    const small = await addDocument(api, owner, pdfFile(800), {
      mimeType: 'application/pdf',
      sizeBytes: 1_000,
    });
    expect(small.sizeBytes).toBe(800);
    expect((await storageOf(company._id)).used).toBe(800);

    const image = await pngFile();
    await CompanyModel.updateOne({ _id: company._id }, { storageQuotaBytes: 800 + image.length });
    const doc = await addDocument(api, owner, image);
    expect(doc).toMatchObject({ status: 'uploaded', hasPreview: false });
    expect(await storageOf(company._id)).toEqual({
      used: 800 + image.length,
      quota: 800 + image.length,
    });
    await expectStorageConsistent(company._id);
  });

  it('hizmet sonu görüntüleme döneminde yükleme kapalı, indirme açık', async () => {
    const { testApp, api, company, owner } = await setup();
    const doc = await addDocument(api, owner, pdfFile(), { mimeType: 'application/pdf' });
    const serviceEndedAt = addDays(businessToday(testApp.clock), -5);
    await CompanyModel.updateOne(
      { _id: company._id },
      {
        serviceEndedAt,
        viewUntil: addDays(serviceEndedAt, 30),
        retainUntil: addDays(serviceEndedAt, 180),
      },
    );
    const blocked = await api.post(
      '/documents/upload-intent',
      intentBody(owner, pdfFile(), { mimeType: 'application/pdf' }),
    );
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('READ_ONLY');
    expect(
      (await api.delete(`/documents/${doc.id}`, { reason: 'r', expectedUpdatedAt: doc.updatedAt }))
        .status,
    ).toBe(403);
    expect((await api.get(`/documents/${doc.id}/download`)).status).toBe(200);
  });

  it('kapasite doluyken finansal kayıt oluşturma ve mevcut belgelere erişim devam eder', async () => {
    const { api, company, owner } = await setup();
    const existing = await addDocument(api, owner, pdfFile(), { mimeType: 'application/pdf' });
    await CompanyModel.updateOne(
      { _id: company._id },
      { $set: { storageQuotaBytes: 10_000, storageUsedBytes: 10_000 } },
    );

    const blocked = await api.post(
      '/documents/upload-intent',
      intentBody(owner, pdfFile(), { mimeType: 'application/pdf' }),
    );
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('STORAGE_FULL');

    const income = await api.record({ kind: 'income', amount: tl(2_000) });
    expect(income.status).toBe(201);
    const party = await api.createParty('Kalıpçı Veli');
    const agreement = await api.post('/agreements', {
      kind: 'agreement',
      direction: 'payable',
      title: 'Kalıp',
      scope: 'company',
      partyId: party.id,
      initialAmount: tl(5_000),
    });
    expect(agreement.status).toBe(201);
    expect((await api.get(`/documents/${existing.id}/download`)).status).toBe(200);
  });
});

describe('süresi geçen yüklemelerin temizliği', () => {
  const cleanup = (testApp: TestApp) => new DocumentService(testApp.deps).expireStale();

  it('1 saati geçen bekleyen yükleme expired olur; rezervasyon ve sayaç bir kez iade edilir', async () => {
    const { testApp, api, company, owner, expense } = await setup();
    const intent = await startUpload(api, owner, pdfFile(), { mimeType: 'application/pdf' });

    testApp.clock.advance(59 * MINUTE);
    expect(await cleanup(testApp)).toBe(0);
    testApp.clock.advance(2 * MINUTE);
    expect(await cleanup(testApp)).toBe(1);
    expect(await cleanup(testApp)).toBe(0);

    const doc = await DocumentModel.findOne({ _id: intent.document.id, companyId: company._id });
    expect(doc!.status).toBe('expired');
    expect(testApp.storage.keys()).toEqual([]);
    expect((await storageOf(company._id)).used).toBe(0);
    expect(await documentCountOf(company._id, expense.id)).toBe(0);

    const fresh = await api.relogin();
    const late = await fresh.post(`/documents/${intent.document.id}/complete`, {}, null);
    expect(late.status).toBe(409);
    expect(late.body.details).toEqual({ status: 'expired' });
  });

  it('temizlikten önce gelen geç tamamlama da süresi geçmiş yüklemeyi kabul etmez', async () => {
    const { testApp, api, company, owner } = await setup();
    const intent = await startUpload(api, owner, pdfFile(), { mimeType: 'application/pdf' });
    testApp.clock.advance(61 * MINUTE);
    const fresh = await api.relogin();
    const late = await fresh.post(`/documents/${intent.document.id}/complete`, {}, null);
    expect(late.status).toBe(409);
    expect((await storageOf(company._id)).used).toBe(0);
    expect(await documentCountOf(company._id, owner.ownerId)).toBe(0);
  });

  it('temizlik, tamamlanmakta olan belgeye dokunmaz; tamamlanan belge sonradan da silinmez', async () => {
    const { testApp, api, company, owner, expense } = await setup();
    const file = await pngFile();
    const intent = await startUpload(api, owner, file);
    testApp.clock.advance(59 * MINUTE);
    const fresh = await api.relogin();

    let cleaned = -1;
    testApp.storage.beforeCopy = async () => {
      // Tamamlama ortadayken yüklemenin 1 saati dolar ve temizlik çalışır.
      testApp.clock.advance(2 * MINUTE);
      cleaned = await cleanup(testApp);
    };
    const done = await fresh.ok(fresh.post(`/documents/${intent.document.id}/complete`, {}, null));
    testApp.storage.beforeCopy = null;
    expect(cleaned).toBe(0);
    expect(done.status).toBe('uploaded');

    testApp.clock.advance(3 * 60 * MINUTE);
    expect(await cleanup(testApp)).toBe(0);
    const stored = await DocumentModel.findOne({ _id: done.id, companyId: company._id }).lean();
    expect(stored!.status).toBe('uploaded');
    expect(testApp.storage.objects.get(stored!.storageKey!)!.body.equals(file)).toBe(true);
    expect(await documentCountOf(company._id, expense.id)).toBe(1);
    await expectStorageConsistent(company._id);
  });

  it('kilit süresi dolup temizlik kazanırsa tamamlama yarım kopya bırakmaz ve sayaçlar bir kez iade edilir', async () => {
    const { testApp, api, company, owner, expense } = await setup();
    const intent = await startUpload(api, owner, await pngFile());
    testApp.clock.advance(59 * MINUTE);
    const fresh = await api.relogin();

    let cleaned = -1;
    testApp.storage.beforeCopy = async () => {
      // Tamamlama kilidi (5 dk) dolacak kadar takılır; temizlik yüklemeyi kapatır.
      testApp.clock.advance(10 * MINUTE);
      cleaned = await cleanup(testApp);
    };
    const res = await fresh.post(`/documents/${intent.document.id}/complete`, {}, null);
    testApp.storage.beforeCopy = null;
    expect(cleaned).toBe(1);
    expect(res.status).toBe(409);
    expect(res.body.details).toEqual({ status: 'expired' });

    const doc = await DocumentModel.findOne({ _id: intent.document.id, companyId: company._id });
    expect(doc!.status).toBe('expired');
    expect(testApp.storage.keys()).toEqual([]);
    expect((await storageOf(company._id)).used).toBe(0);
    expect(await documentCountOf(company._id, expense.id)).toBe(0);
  });

  it('temizlik, kopyalama bittikten sonra kazanırsa nihai dosya da geri alınır', async () => {
    const { testApp, api, company, owner } = await setup();
    const intent = await startUpload(api, owner, pdfFile(), { mimeType: 'application/pdf' });
    testApp.clock.advance(59 * MINUTE);
    const fresh = await api.relogin();

    // Kopyalama gerçekleşir, ardından kilit dolar ve temizlik çalışır (son geçiş kaybedilir).
    const original = testApp.storage.copy.bind(testApp.storage);
    testApp.storage.copy = async (source, target) => {
      await original(source, target);
      testApp.clock.advance(10 * MINUTE);
      await cleanup(testApp);
    };
    const res = await fresh.post(`/documents/${intent.document.id}/complete`, {}, null);
    expect(res.status).toBe(409);
    expect(testApp.storage.keys()).toEqual([]);
    expect((await storageOf(company._id)).used).toBe(0);
    await expectStorageConsistent(company._id);
  });
});

describe('belge silme ve geri yükleme', () => {
  async function remove(api: Api, doc: { id: string; updatedAt: string }) {
    return api.delete(`/documents/${doc.id}`, {
      reason: 'Yanlış fiş',
      expectedUpdatedAt: doc.updatedAt,
    });
  }

  it('silme gerekçe ister, 10 sınırından düşer, kapasitede kalır; geri yükleme sayacı geri alır', async () => {
    const { api, company, owner, expense } = await setup();
    const doc = await addDocument(api, owner, pdfFile(), { mimeType: 'application/pdf' });
    const { used } = await storageOf(company._id);

    const noReason = await api.delete(`/documents/${doc.id}`, { expectedUpdatedAt: doc.updatedAt });
    expect(noReason.status).toBe(400);

    const deleted = await api.ok(remove(api, doc));
    expect(deleted).toMatchObject({ deleteReason: 'Yanlış fiş' });
    expect(deleted.deletedAt).not.toBeNull();
    expect(await documentCountOf(company._id, expense.id)).toBe(0);
    expect((await storageOf(company._id)).used).toBe(used);

    const info = await api.ok(api.get('/company'));
    expect(info.storage.usedBytes).toBe(used);
    expect(info.storage.breakdown).toMatchObject({
      originalBytes: 0,
      previewBytes: 0,
      deletedBytes: used,
      pendingBytes: 0,
      exportBytes: 0,
      deletedDocumentCount: 1,
    });

    // Silinmiş belge geri yükleme için okunabilir; detayda silinmiş olarak görünür.
    expect((await api.get(`/documents/${doc.id}/download`)).status).toBe(200);
    const detail = await api.transaction(expense.id);
    expect(detail.documents[0]).toMatchObject({ id: doc.id, deleteReason: 'Yanlış fiş' });

    // Eski sürümle geri yükleme çakışır.
    const stale = await api.post(
      `/documents/${doc.id}/restore`,
      { reason: 'Doğru fiş', expectedUpdatedAt: doc.updatedAt },
      null,
    );
    expect(stale.status).toBe(409);
    expect(stale.body.details.current).toMatchObject({ id: doc.id });

    const restored = await api.ok(
      api.post(
        `/documents/${doc.id}/restore`,
        { reason: 'Doğru fiş', expectedUpdatedAt: deleted.updatedAt },
        null,
      ),
    );
    expect(restored.deletedAt).toBeNull();
    expect(await documentCountOf(company._id, expense.id)).toBe(1);
    const history = await DocumentModel.findOne({ _id: doc.id, companyId: company._id }).lean();
    expect(history!.history.map((entry) => entry.action)).toEqual([
      'create',
      'upload',
      'delete',
      'restore',
    ]);
  });

  it('kayıtta 10 belge varken silinmiş belge geri yüklenemez', async () => {
    const { api, owner } = await setup();
    const first = await addDocument(api, owner, pdfFile(100), { mimeType: 'application/pdf' });
    const deleted = await api.ok(remove(api, first));
    for (let i = 0; i < 10; i++) {
      await startUpload(api, owner, pdfFile(100), { mimeType: 'application/pdf' });
    }

    const res = await api.post(
      `/documents/${first.id}/restore`,
      { reason: 'Geri', expectedUpdatedAt: deleted.updatedAt },
      null,
    );
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      message: 'Bu kayıtta 10 belge var; geri yüklemek için önce birini silin.',
    });
  });

  it('silinmiş kayda belge eklenemez, belgesi silinip geri yüklenemez; belgeleri okunabilir', async () => {
    const { api, owner, expense } = await setup();
    const doc = await addDocument(api, owner, pdfFile(), { mimeType: 'application/pdf' });
    await api.ok(
      api.delete(`/transactions/${expense.id}`, {
        reason: 'Mükerrer',
        expectedUpdatedAt: (await api.transaction(expense.id)).updatedAt,
      }),
    );

    const add = await api.post(
      '/documents/upload-intent',
      intentBody(owner, pdfFile(), { mimeType: 'application/pdf' }),
    );
    expect(add.status).toBe(409);
    expect(add.body.message).toBe('Kayıt silinmiş. Belge işlemi için önce kaydı geri yükleyin.');
    expect((await remove(api, doc)).status).toBe(409);
    expect((await api.get(`/documents/${doc.id}/preview`)).status).toBe(200);
    expect((await api.transaction(expense.id)).documents).toHaveLength(1);
  });

  it('yüklenmemiş belge silinemez ve indirilemez', async () => {
    const { api, owner } = await setup();
    const intent = await startUpload(api, owner, pdfFile(), { mimeType: 'application/pdf' });
    const pending = (await api.transaction(owner.ownerId)).documents[0];
    expect(pending.status).toBe('pending');
    expect((await api.get(`/documents/${intent.document.id}/download`)).status).toBe(409);
    expect((await remove(api, pending)).status).toBe(409);
  });
});
