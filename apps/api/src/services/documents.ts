// Belgeler (şartname 8.8, 9.6, 10.8):
// - Yükleme niyeti kayıt başına sayacı (documentCount) ve firma kapasitesini (storageUsedBytes) aynı
//   transaction'da koşullu $inc ile ayırır; eşzamanlı isteklerde de sınır aşılmaz.
// - Tamamlama belgeyi kısa süreli bir kilitle sahiplenir, dosyayı sunucuda doğrular, değiştirilemeyen
//   nihai anahtara kopyalar ve durumu koşullu olarak `pending → uploaded` geçirir.
// - Temizlik süresi geçmiş bekleyen yüklemeleri `expired` yapar; kilitli (tamamlanmakta olan) belgeye
//   dokunmaz. Kilit süresi dolup temizlik kazanırsa tamamlama kendi kopyasını geri alır.
// - Kapasitede orijinal, önizleme ve geri alınabilir silinmiş belgeler sayılır; silme alanı boşaltmaz.

import { randomUUID } from 'node:crypto';
import {
  DOCUMENT_LIMIT_PER_RECORD,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_TOO_LARGE_MESSAGE,
  UNSUPPORTED_DOCUMENT_MESSAGE,
  type DocumentOwnerType,
  type DocumentUploadIntentInput,
} from '@santiye/shared';
import { Types, type ClientSession } from 'mongoose';
import { forCompany, notFound } from '../db/company-scope.js';
import { withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { detectDocumentType, SIGNATURE_BYTES } from '../lib/file-signature.js';
import { createPreview, hasPreview, PREVIEW_MIME_TYPE } from '../lib/preview.js';
import { AgreementModel } from '../models/agreement.js';
import { CompanyModel } from '../models/company.js';
import { DocumentModel, type StoredDocument } from '../models/document.js';
import { TransactionModel } from '../models/transaction.js';
import type { CustomerContext } from './customer-auth.js';
import type { IdempotentOutcome } from './idempotency.js';
import {
  actorNames,
  assertSameVersion,
  type ActorRef,
  historyEntry,
  SYSTEM_ACTOR_ID,
  toObjectId,
  updateScoped,
} from './records.js';

/** İmzalı yükleme adresi 15 dakika geçerli. */
export const UPLOAD_URL_TTL_SECONDS = 15 * 60;
/** İndirme ve önizleme adresleri 5 dakika geçerli. */
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
/** 1 saati geçen ve hâlâ bekleyen yükleme süresi dolmuş sayılır. */
export const PENDING_UPLOAD_TTL_MS = 60 * 60 * 1000;
/** Tamamlama kilidi; bu süre içinde temizlik belgeye dokunmaz. */
export const COMPLETION_LEASE_MS = 5 * 60 * 1000;
/** Temizlik aralığı. */
export const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

export const STORAGE_FULL_MESSAGE =
  'Belge alanı doldu. Kayıt girmeye devam edebilirsiniz; yeni belge için ürün sahibiyle görüşün.';
const RECORD_FULL_MESSAGE = `Bu kayda en fazla ${DOCUMENT_LIMIT_PER_RECORD} belge eklenebilir.`;
const OWNER_DELETED_MESSAGE = 'Kayıt silinmiş. Belge işlemi için önce kaydı geri yükleyin.';
const UPLOAD_GONE_MESSAGE =
  'Bu yüklemenin süresi doldu veya yükleme başarısız oldu. Belgeyi yeniden ekleyin.';

const keyPrefix = (companyId: Types.ObjectId) => `companies/${companyId.toString()}`;
const tempKeyOf = (companyId: Types.ObjectId, id: Types.ObjectId) =>
  `${keyPrefix(companyId)}/uploads/${id.toString()}`;
// Nihai anahtarlar tamamlama denemesine özgüdür; bir kez yazılır, hiç üzerine yazılmaz.
const finalKeyOf = (companyId: Types.ObjectId, id: Types.ObjectId, token: string) =>
  `${keyPrefix(companyId)}/documents/${id.toString()}/${token}`;

/** Sahibin (işlem/anlaşma) belge sayacı. Sahip kaydın sürümü (updatedAt) değişmez. */
async function changeOwnerCount(
  companyId: Types.ObjectId,
  ownerType: DocumentOwnerType,
  ownerId: Types.ObjectId,
  delta: 1 | -1,
  session: ClientSession,
): Promise<boolean> {
  const filter = {
    _id: ownerId,
    companyId,
    documentCount: delta > 0 ? { $lt: DOCUMENT_LIMIT_PER_RECORD } : { $gt: 0 },
  };
  const update = { $inc: { documentCount: delta } };
  const options = { session, timestamps: false };
  const result =
    ownerType === 'transaction'
      ? await TransactionModel.updateOne(filter, update, options)
      : await AgreementModel.updateOne(filter, update, options);
  return result.matchedCount === 1;
}

/** Kapasite ayırır; firmanın kotası aşılacaksa hiçbir şey değişmez ve false döner. */
async function reserveStorage(
  companyId: Types.ObjectId,
  bytes: number,
  session: ClientSession,
): Promise<boolean> {
  if (bytes <= 0) {
    await adjustStorage(companyId, bytes, session);
    return true;
  }
  const result = await CompanyModel.updateOne(
    {
      _id: companyId,
      $expr: { $lte: [{ $add: ['$storageUsedBytes', bytes] }, '$storageQuotaBytes'] },
    },
    { $inc: { storageUsedBytes: bytes } },
    { session, timestamps: false },
  );
  return result.matchedCount === 1;
}

async function adjustStorage(companyId: Types.ObjectId, delta: number, session: ClientSession) {
  if (delta === 0) return;
  await CompanyModel.updateOne(
    { _id: companyId },
    { $inc: { storageUsedBytes: delta } },
    { session, timestamps: false },
  );
}

async function loadOwner(
  companyId: Types.ObjectId,
  ownerType: DocumentOwnerType,
  ownerId: Types.ObjectId,
  session?: ClientSession,
): Promise<{ deletedAt: Date | null } | null> {
  const options = { includeDeleted: true, session };
  return ownerType === 'transaction'
    ? forCompany(TransactionModel, companyId).findById(ownerId.toString(), options)
    : forCompany(AgreementModel, companyId).findById(ownerId.toString(), options);
}

/** Yükleme, silme ve geri yükleme yalnız silinmemiş kayıtta (silinmiş kaydın belgeleri okunabilir). */
async function requireActiveOwner(
  companyId: Types.ObjectId,
  ownerType: DocumentOwnerType,
  ownerId: Types.ObjectId,
  session?: ClientSession,
) {
  const owner = await loadOwner(companyId, ownerType, ownerId, session);
  if (!owner) throw notFound();
  if (owner.deletedAt) throw new AppError('CONFLICT', OWNER_DELETED_MESSAGE);
}

type ActorLookup = (id: Types.ObjectId | null | undefined) => ActorRef | null;

/** Çakışma cevabındaki güncel belge için; adlar yüklenmez. */
const idOnlyActor: ActorLookup = (id) => (id ? { id: id.toString(), name: '' } : null);

function presentDocument(doc: StoredDocument, actor: ActorLookup) {
  return {
    id: doc._id.toString(),
    ownerType: doc.ownerType,
    ownerId: doc.ownerId.toString(),
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    hasPreview: doc.previewKey !== null,
    uploadedBy: actor(doc.uploadedBy),
    uploadedAt: doc.uploadedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    deletedAt: doc.deletedAt?.toISOString() ?? null,
    deletedBy: actor(doc.deletedBy),
    deleteReason: doc.deleteReason,
  };
}

export async function presentDocuments(companyId: Types.ObjectId, docs: StoredDocument[]) {
  const actor = await actorNames(
    companyId,
    docs.flatMap((doc) => [doc.uploadedBy, doc.deletedBy]),
  );
  return docs.map((doc) => presentDocument(doc, actor));
}

/**
 * Kayıt detayındaki belgeler: yüklenmiş ve yüklenmekte olanlar; silinmiş ama geri alınabilir
 * belgeler `deletedAt` dolu olarak gelir. Başarısız ve süresi geçmiş yüklemeler listelenmez.
 */
export async function documentsOf(
  companyId: Types.ObjectId,
  ownerType: DocumentOwnerType,
  ownerId: Types.ObjectId,
) {
  const docs = await DocumentModel.find({
    companyId,
    ownerType,
    ownerId,
    status: { $in: ['pending', 'uploaded'] },
  }).sort({ createdAt: 1, _id: 1 });
  return presentDocuments(companyId, docs);
}

/** Firma bilgisindeki kullanım dökümü (şartname 7.11, 9.6). Toplamı `storageUsedBytes` ile aynıdır. */
export async function storageBreakdown(companyId: Types.ObjectId) {
  const [row] = await DocumentModel.aggregate<{
    originalBytes: number;
    previewBytes: number;
    deletedBytes: number;
    pendingBytes: number;
    documentCount: number;
    deletedDocumentCount: number;
  }>([
    { $match: { companyId, status: { $in: ['pending', 'uploaded'] } } },
    {
      $group: {
        _id: null,
        originalBytes: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'uploaded'] }, { $eq: ['$deletedAt', null] }] },
              '$sizeBytes',
              0,
            ],
          },
        },
        previewBytes: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'uploaded'] }, { $eq: ['$deletedAt', null] }] },
              '$previewBytes',
              0,
            ],
          },
        },
        deletedBytes: {
          $sum: { $cond: [{ $ne: ['$deletedAt', null] }, '$countedBytes', 0] },
        },
        pendingBytes: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$countedBytes', 0] },
        },
        documentCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$status', 'uploaded'] }, { $eq: ['$deletedAt', null] }] },
              1,
              0,
            ],
          },
        },
        deletedDocumentCount: { $sum: { $cond: [{ $ne: ['$deletedAt', null] }, 1, 0] } },
      },
    },
  ]);
  return {
    originalBytes: row?.originalBytes ?? 0,
    previewBytes: row?.previewBytes ?? 0,
    deletedBytes: row?.deletedBytes ?? 0,
    /** Yüklenmekte olan dosyalar için ayrılan alan */
    pendingBytes: row?.pendingBytes ?? 0,
    /** Hazır dışa aktarma paketleri (Adım 6) */
    exportBytes: 0,
    documentCount: row?.documentCount ?? 0,
    deletedDocumentCount: row?.deletedDocumentCount ?? 0,
  };
}

/** Tamamlama, temizliğin aldığı belgeyi tamamlamaya çalışırsa. */
class CompletionLost extends Error {}

export class DocumentService {
  constructor(private readonly deps: AppDeps) {}

  private now() {
    return this.deps.clock.now();
  }

  private async presentOne(context: CustomerContext, doc: StoredDocument) {
    const [data] = await presentDocuments(context.companyId, [doc]);
    return data!;
  }

  private async withUpload(context: CustomerContext, doc: StoredDocument) {
    const document = await this.presentOne(context, doc);
    if (doc.status !== 'pending' || doc.expiresAt <= this.now()) {
      return { document, upload: null };
    }
    const url = await this.deps.storage.presignUpload(doc.tempKey, {
      contentType: doc.mimeType,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });
    return {
      document,
      upload: {
        method: 'PUT' as const,
        url,
        headers: { 'Content-Type': doc.mimeType },
        expiresAt: new Date(this.now().getTime() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      },
    };
  }

  // ── Yükleme niyeti ───────────────────────────────────────────────────────────

  async uploadIntent(
    context: CustomerContext,
    input: DocumentUploadIntentInput,
    session: ClientSession,
  ) {
    if (input.sizeBytes > DOCUMENT_MAX_BYTES) {
      throw new AppError('LIMIT_EXCEEDED', DOCUMENT_TOO_LARGE_MESSAGE, {
        maxBytes: DOCUMENT_MAX_BYTES,
      });
    }
    const ownerId = new Types.ObjectId(input.ownerId);
    await requireActiveOwner(context.companyId, input.ownerType, ownerId, session);
    if (!(await changeOwnerCount(context.companyId, input.ownerType, ownerId, 1, session))) {
      throw new AppError('LIMIT_EXCEEDED', RECORD_FULL_MESSAGE, {
        limit: DOCUMENT_LIMIT_PER_RECORD,
      });
    }
    if (!(await reserveStorage(context.companyId, input.sizeBytes, session))) {
      throw new AppError('STORAGE_FULL', STORAGE_FULL_MESSAGE);
    }

    const now = this.now();
    const id = new Types.ObjectId();
    const doc = await forCompany(DocumentModel, context.companyId).create(
      {
        _id: id,
        ownerType: input.ownerType,
        ownerId,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: null,
        countedBytes: input.sizeBytes,
        tempKey: tempKeyOf(context.companyId, id),
        status: 'pending',
        uploadedBy: context.userId,
        expiresAt: new Date(now.getTime() + PENDING_UPLOAD_TTL_MS),
        history: [historyEntry({ by: context.userId, action: 'create', at: now })],
      },
      context.userId,
      session,
    );
    return {
      outcome: {
        status: 201,
        data: await this.withUpload(context, doc),
      } satisfies IdempotentOutcome,
      ref: { type: 'document', id: id.toString() },
    };
  }

  /** Aynı anahtarla tekrar: aynı belge; hâlâ bekliyorsa yeni imzalı adres. */
  async replay(context: CustomerContext, id: string, status: number): Promise<IdempotentOutcome> {
    const doc = await forCompany(DocumentModel, context.companyId).findByIdOrThrow(id, {
      includeDeleted: true,
    });
    return { status, data: await this.withUpload(context, doc) };
  }

  // ── Tamamlama ────────────────────────────────────────────────────────────────

  async complete(context: CustomerContext, id: string) {
    const { companyId } = context;
    const doc = await forCompany(DocumentModel, companyId).findByIdOrThrow(id);
    if (doc.status === 'uploaded') return this.presentOne(context, doc);
    if (doc.status !== 'pending') {
      throw new AppError('CONFLICT', UPLOAD_GONE_MESSAGE, { status: doc.status });
    }

    const now = this.now();
    const token = randomUUID();
    const claimed = await DocumentModel.findOneAndUpdate(
      {
        _id: doc._id,
        companyId,
        status: 'pending',
        expiresAt: { $gt: now },
        $or: [{ completion: null }, { 'completion.until': { $lte: now } }],
      },
      { $set: { completion: { token, until: new Date(now.getTime() + COMPLETION_LEASE_MS) } } },
      { returnDocument: 'after', timestamps: false },
    );
    if (!claimed) {
      const current = await forCompany(DocumentModel, companyId).findByIdOrThrow(id);
      if (current.status === 'uploaded') return this.presentOne(context, current);
      // Süresi geçmişse temizliği beklemeden kapatılır; başka bir tamamlama sürüyorsa dokunulmaz.
      if (current.status === 'pending' && current.expiresAt <= now) {
        await this.expireOne(companyId, current._id);
      }
      const latest = await forCompany(DocumentModel, companyId).findByIdOrThrow(id);
      if (latest.status === 'uploaded') return this.presentOne(context, latest);
      if (latest.status === 'pending') {
        throw new AppError('CONFLICT', 'Belge şu anda doğrulanıyor; birazdan yeniden deneyin.');
      }
      throw new AppError('CONFLICT', UPLOAD_GONE_MESSAGE, { status: latest.status });
    }

    return this.finishUpload(context, claimed, token);
  }

  private async finishUpload(context: CustomerContext, doc: StoredDocument, token: string) {
    const { companyId } = context;
    const base = finalKeyOf(companyId, doc._id, token);
    const storageKey = `${base}/original`;
    const previewKey = `${base}/preview.jpg`;

    let checked: Awaited<ReturnType<DocumentService['checkAndCopy']>>;
    try {
      checked = await this.checkAndCopy(companyId, doc, token, storageKey, previewKey);
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Depo hatası: kilit hâlâ bizdeyse bırakılır ve tamamlama yeniden denenebilir. Temizlik
      // yüklemeyi bu arada kapattıysa (geçici dosya silinmiş olabilir) yükleme artık geçersizdir.
      await this.removeObjects([storageKey, previewKey]);
      const released = await DocumentModel.updateOne(
        { _id: doc._id, companyId, status: 'pending', 'completion.token': token },
        { $set: { completion: null } },
        { timestamps: false },
      );
      if (released.matchedCount === 0) {
        throw new AppError('CONFLICT', UPLOAD_GONE_MESSAGE, { status: 'expired' });
      }
      throw error;
    }
    const { size, mimeType, preview } = checked;

    let result: { updated: StoredDocument; previewKept: boolean } | 'storage_full';
    try {
      result = await withTransaction(async (session) => {
        // Gerçek boyut bildirilenden büyükse fark da kotaya sığmalı; küçükse fark iade edilir.
        if (!(await reserveStorage(companyId, size - doc.countedBytes, session))) {
          return 'storage_full' as const;
        }
        const previewKept =
          preview !== null && (await reserveStorage(companyId, preview.bytes, session));
        const previewBytes = previewKept ? preview.bytes : 0;
        const updated = await DocumentModel.findOneAndUpdate(
          { _id: doc._id, companyId, status: 'pending', 'completion.token': token },
          {
            $set: {
              status: 'uploaded',
              mimeType,
              sizeBytes: size,
              storageKey,
              previewKey: previewKept ? preview.key : null,
              previewBytes,
              countedBytes: size + previewBytes,
              uploadedAt: this.now(),
              completion: null,
              updatedBy: context.userId,
            },
            $push: {
              history: historyEntry({ by: context.userId, action: 'upload', at: this.now() }),
            },
          },
          { session, returnDocument: 'after' },
        );
        if (!updated) throw new CompletionLost();
        return { updated, previewKept };
      });
    } catch (error) {
      if (!(error instanceof CompletionLost)) throw error;
      // Kilit süresi içinde bitmedi ve temizlik yüklemeyi kapattı: yarım kopya bırakılmaz.
      await this.removeObjects([storageKey, preview?.key]);
      throw new AppError('CONFLICT', UPLOAD_GONE_MESSAGE, { status: 'expired' });
    }

    if (result === 'storage_full') {
      await this.fail(companyId, doc, token, 'Belge alanı yetersiz.');
      await this.removeObjects([storageKey, preview?.key]);
      throw new AppError('STORAGE_FULL', STORAGE_FULL_MESSAGE);
    }
    if (preview && !result.previewKept) await this.removeObjects([preview.key]);
    await this.removeObjects([doc.tempKey]);
    return this.presentOne(context, result.updated);
  }

  /**
   * Geçici dosyanın gerçek boyutunu ve imzasını doğrular, nihai anahtara kopyalar ve görsellerde
   * önizleme üretir. Doğrulanamayan dosyada yükleme `failed` olur.
   */
  private async checkAndCopy(
    companyId: Types.ObjectId,
    doc: StoredDocument,
    token: string,
    storageKey: string,
    previewKey: string,
  ) {
    const { storage, logger } = this.deps;
    const size = await storage.size(doc.tempKey);
    if (size === null) {
      // Dosya henüz depoya ulaşmamış; yükleme adresi geçerliyken yeniden denenebilir.
      await DocumentModel.updateOne(
        { _id: doc._id, companyId, 'completion.token': token },
        { $set: { completion: null } },
        { timestamps: false },
      );
      throw new AppError('VALIDATION', 'Dosya depoya ulaşmadı. Dosyayı yeniden yükleyip deneyin.');
    }
    if (size > DOCUMENT_MAX_BYTES) {
      await this.fail(companyId, doc, token, 'Dosya 20 MB sınırını aşıyor.');
      throw new AppError('LIMIT_EXCEEDED', DOCUMENT_TOO_LARGE_MESSAGE, {
        maxBytes: DOCUMENT_MAX_BYTES,
      });
    }
    const mimeType =
      size > 0 ? detectDocumentType(await storage.read(doc.tempKey, SIGNATURE_BYTES)) : null;
    if (!mimeType) {
      await this.fail(companyId, doc, token, 'Dosya türü desteklenmiyor.');
      throw new AppError('VALIDATION', UNSUPPORTED_DOCUMENT_MESSAGE);
    }

    await storage.copy(doc.tempKey, storageKey);

    let preview: { key: string; bytes: number } | null = null;
    if (hasPreview(mimeType)) {
      let body: Buffer | null = null;
      try {
        body = await createPreview(await storage.read(storageKey), mimeType);
      } catch (error) {
        // Görsel çözülemezse belge yine yüklenir; açarken orijinal kullanılır.
        logger.error('Belge önizlemesi üretilemedi', {
          documentId: doc._id.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if (body) {
        await storage.put(previewKey, body, PREVIEW_MIME_TYPE);
        preview = { key: previewKey, bytes: body.length };
      }
    }
    return { size, mimeType, storageKey, preview };
  }

  /** Doğrulanamayan yükleme: rezervasyon ve sayaç iade edilir, geçici dosya silinir. */
  private async fail(
    companyId: Types.ObjectId,
    doc: StoredDocument,
    token: string,
    reason: string,
  ) {
    await withTransaction(async (session) => {
      const failed = await DocumentModel.findOneAndUpdate(
        { _id: doc._id, companyId, status: 'pending', 'completion.token': token },
        {
          $set: { status: 'failed', countedBytes: 0, completion: null },
          $push: {
            history: historyEntry({
              by: SYSTEM_ACTOR_ID,
              action: 'fail',
              at: this.now(),
              reason,
            }),
          },
        },
        { session },
      );
      if (!failed) return;
      await adjustStorage(companyId, -failed.countedBytes, session);
      await changeOwnerCount(companyId, failed.ownerType, failed.ownerId, -1, session);
    });
    await this.removeObjects([doc.tempKey]);
  }

  private async removeObjects(keys: (string | null | undefined)[]) {
    for (const key of keys) {
      if (!key) continue;
      try {
        await this.deps.storage.remove(key);
      } catch (error) {
        this.deps.logger.error('Depodaki dosya silinemedi', {
          key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // ── Temizlik ─────────────────────────────────────────────────────────────────

  /**
   * Süresi geçmiş bekleyen yüklemeyi kapatır. Tamamlanmakta olan (kilidi süren) veya tamamlanmış
   * belgeye dokunmaz; rezervasyon ve sayaç yalnız bir kez iade edilir.
   */
  async expireOne(companyId: Types.ObjectId, id: Types.ObjectId): Promise<boolean> {
    const now = this.now();
    const expired = await withTransaction(async (session) => {
      const before = await DocumentModel.findOneAndUpdate(
        {
          _id: id,
          companyId,
          status: 'pending',
          expiresAt: { $lte: now },
          $or: [{ completion: null }, { 'completion.until': { $lte: now } }],
        },
        {
          $set: { status: 'expired', countedBytes: 0, completion: null },
          $push: { history: historyEntry({ by: SYSTEM_ACTOR_ID, action: 'expire', at: now }) },
        },
        { session },
      );
      if (!before) return null;
      await adjustStorage(companyId, -before.countedBytes, session);
      await changeOwnerCount(companyId, before.ownerType, before.ownerId, -1, session);
      return before;
    });
    if (!expired) return false;
    await this.removeObjects([expired.tempKey]);
    return true;
  }

  /** Bütün firmalarda süresi geçmiş bekleyen yüklemeler; sorgular firma bazında yapılır. */
  async expireStale(): Promise<number> {
    const now = this.now();
    const companies = await CompanyModel.find({}, { _id: 1 }).lean();
    let count = 0;
    for (const { _id: companyId } of companies) {
      const stale = await DocumentModel.find(
        { companyId, status: 'pending', expiresAt: { $lte: now } },
        { _id: 1 },
      ).lean();
      for (const doc of stale) {
        if (await this.expireOne(companyId, doc._id)) count += 1;
      }
    }
    return count;
  }

  // ── İndirme ve önizleme ──────────────────────────────────────────────────────

  /** 5 dk geçerli adres. Silinmiş kaydın ve geri alınabilir silinmiş belgenin dosyası da okunabilir. */
  async download(context: CustomerContext, id: string, mode: 'download' | 'preview') {
    const doc = await forCompany(DocumentModel, context.companyId).findByIdOrThrow(id, {
      includeDeleted: true,
    });
    if (doc.status !== 'uploaded' || !doc.storageKey) {
      throw new AppError('CONFLICT', 'Belge henüz yüklenmedi.', { status: doc.status });
    }
    const usePreview = mode === 'preview' && doc.previewKey !== null;
    const url = await this.deps.storage.presignDownload(
      usePreview ? doc.previewKey! : doc.storageKey,
      {
        expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
        fileName: usePreview
          ? `${doc.fileName.replace(/\.[^.]*$/, '')}-onizleme.jpg`
          : doc.fileName,
        contentType: usePreview ? PREVIEW_MIME_TYPE : doc.mimeType,
        // Önizleme isteğinde önizleme yoksa orijinal tarayıcıda açılır.
        inline: mode === 'preview',
      },
    );
    return {
      url,
      expiresAt: new Date(this.now().getTime() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      isPreview: usePreview,
      fileName: doc.fileName,
      mimeType: usePreview ? PREVIEW_MIME_TYPE : doc.mimeType,
    };
  }

  // ── Silme ve geri yükleme ────────────────────────────────────────────────────

  /** Yumuşak silme: belge kayıttaki 10 sınırından düşer; dosya ve kapasitedeki yeri korunur. */
  async remove(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    const updated = await withTransaction(async (session) => {
      const doc = await forCompany(DocumentModel, context.companyId).findByIdOrThrow(id, {
        session,
      });
      if (doc.status !== 'uploaded') {
        throw new AppError('CONFLICT', 'Yalnız yüklenmiş belge silinebilir.', {
          status: doc.status,
        });
      }
      assertSameVersion(doc.updatedAt, input.expectedUpdatedAt, () =>
        presentDocument(doc, idOnlyActor),
      );
      await requireActiveOwner(context.companyId, doc.ownerType, doc.ownerId, session);
      const now = this.now();
      const result = await updateScoped({
        model: DocumentModel,
        context,
        id: doc._id,
        expectedUpdatedAt: input.expectedUpdatedAt,
        session,
        update: {
          $set: {
            deletedAt: now,
            deletedBy: context.userId,
            deleteReason: input.reason,
            updatedBy: context.userId,
          },
          $push: {
            history: historyEntry({
              by: context.userId,
              action: 'delete',
              reason: input.reason,
              at: now,
            }),
          },
        },
        present: (current) => presentDocument(current, idOnlyActor),
      });
      await changeOwnerCount(context.companyId, doc.ownerType, doc.ownerId, -1, session);
      return result;
    });
    return this.presentOne(context, updated);
  }

  /** Geri yükleme: kayıt silinmemiş olmalı ve kayıtta 10'dan az belge olmalı. */
  async restore(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    const objectId = toObjectId(id);
    if (!objectId) throw notFound();
    const updated = await withTransaction(async (session) => {
      const doc = await forCompany(DocumentModel, context.companyId).findByIdOrThrow(id, {
        includeDeleted: true,
        session,
      });
      if (!doc.deletedAt) throw new AppError('CONFLICT', 'Belge silinmiş değil.');
      assertSameVersion(doc.updatedAt, input.expectedUpdatedAt, () =>
        presentDocument(doc, idOnlyActor),
      );
      await requireActiveOwner(context.companyId, doc.ownerType, doc.ownerId, session);
      if (!(await changeOwnerCount(context.companyId, doc.ownerType, doc.ownerId, 1, session))) {
        throw new AppError(
          'LIMIT_EXCEEDED',
          `Bu kayıtta ${DOCUMENT_LIMIT_PER_RECORD} belge var; geri yüklemek için önce birini silin.`,
          { limit: DOCUMENT_LIMIT_PER_RECORD },
        );
      }
      const now = this.now();
      return updateScoped({
        model: DocumentModel,
        context,
        id: objectId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        includeDeleted: true,
        session,
        update: {
          $set: { deletedAt: null, deletedBy: null, deleteReason: null, updatedBy: context.userId },
          $push: {
            history: historyEntry({
              by: context.userId,
              action: 'restore',
              reason: input.reason,
              at: now,
            }),
          },
        },
        present: (current) => presentDocument(current, idOnlyActor),
      });
    });
    return this.presentOne(context, updated);
  }
}

/** Süresi geçmiş yüklemeleri düzenli aralıkla temizler; dönen işlev zamanlayıcıyı durdurur. */
export function startDocumentCleanup(deps: AppDeps): () => void {
  const service = new DocumentService(deps);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const expired = await service.expireStale();
      if (expired > 0) deps.logger.info('Süresi geçen belge yüklemeleri kapatıldı', { expired });
    } catch (error) {
      deps.logger.error('Belge temizliği başarısız', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), CLEANUP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
