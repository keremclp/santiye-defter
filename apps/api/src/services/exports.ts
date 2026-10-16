// Tam firma veri çıkışı (şartname 7.10, 8.10, 9.6, 10.9):
// - `POST /exports/full` firmada bekleyen veya süren iş varsa onu döner; yoksa kuyruğa iş açar ve
//   arka planda hazırlar. Firma başına tek etkin iş kısmi benzersiz indeksle korunur.
// - Firma verisi tek tutarlı okumadan (snapshot) alınır; tablolar, toplamlar ve belge eşleme tablosu
//   aynı satırlardan üretilir. Paket zip olarak depoya akışla yazılır; bellekte tamamı tutulmaz.
// - Hazır paket kapasitede sayılır (kota aşılabilir; yeni belge yükleme o zaman reddedilir) ve 7 gün
//   sonra silinir. Firmada en fazla bir hazır paket bulunur: yeni paket hazır olunca önceki silinir.
//   Hazırlama yalnız okur; hata yalnız işi `failed` yapar, finansal kayıtlara dokunmaz.
// - Süren işin kilidi vardır; sunucu yeniden başlarsa süresi dolan iş yeniden kuyruğa alınır.

import { randomUUID } from 'node:crypto';
import { ZipArchive } from 'archiver';
import { EXPORT_RETENTION_DAYS } from '@santiye/shared';
import type { Types } from 'mongoose';
import { forCompany } from '../db/company-scope.js';
import { isDuplicateKeyError, withReadSnapshot, withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { businessToday } from '../lib/clock.js';
import { AgreementModel, type Agreement } from '../models/agreement.js';
import { CategoryModel, type Category } from '../models/category.js';
import { CompanyModel } from '../models/company.js';
import { DocumentModel, type StoredDocument } from '../models/document.js';
import { ExportJobModel, type ExportJob } from '../models/export-job.js';
import { PartyModel, type Party } from '../models/party.js';
import { ProjectModel, type Project } from '../models/project.js';
import { TransactionModel, type Transaction } from '../models/transaction.js';
import { UserModel } from '../models/user.js';
import {
  buildFullExport,
  renderFullExportFiles,
  type FullExportContent,
} from '../reports/full-export.js';
import type { CustomerContext } from './customer-auth.js';
import type { IdempotentOutcome } from './idempotency.js';
import { actorNames, historyEntry, type ActorRef } from './records.js';

/** İndirme adresi 5 dakika geçerli; her istekte yeniden üretilir. */
export const EXPORT_DOWNLOAD_TTL_SECONDS = 5 * 60;
/** Süren işin kilidi; ilerledikçe uzatılır. */
export const EXPORT_LEASE_MS = 10 * 60 * 1000;
/** Kilidi düşen iş en fazla bu kadar denenir. */
export const EXPORT_MAX_ATTEMPTS = 3;
/** Bekleyen işler, düşen kilitler ve süresi dolan paketler için tarama aralığı. */
export const EXPORT_SWEEP_INTERVAL_MS = 60 * 1000;
const RETENTION_MS = EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 5;

export const EXPORT_FAILED_MESSAGE =
  'Paket hazırlanamadı. Finansal kayıtlarınız etkilenmedi; yeniden deneyebilirsiniz.';
const ALREADY_RUNNING_MESSAGE = 'Hazırlanmakta olan bir paket var; ilerlemesi gösteriliyor.';

const exportKeyOf = (companyId: Types.ObjectId, jobId: Types.ObjectId, token: string) =>
  `companies/${companyId.toString()}/exports/${jobId.toString()}/${token}.zip`;

/** İşi başka bir çalıştırıcı devraldı veya iş kapatıldı. */
class LeaseLost extends Error {}

function presentJob(
  job: ExportJob,
  actor: (id: Types.ObjectId) => ActorRef | null,
  now: Date,
  download: { url: string; expiresAt: string } | null = null,
) {
  return {
    id: job._id.toString(),
    type: job.type,
    status: job.status,
    progress: job.progress,
    requestedBy: actor(job.requestedBy),
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    expiresAt: job.expiresAt?.toISOString() ?? null,
    /** Hazır paket 7 gün sonra silindi (veya silinmek üzere) */
    expired: isExpired(job, now),
    fileName: job.fileName,
    sizeBytes: job.sizeBytes,
    error: job.error,
    download,
  };
}

function isExpired(job: ExportJob, now: Date): boolean {
  return (
    job.status === 'ready' &&
    (job.fileKey === null || (job.expiresAt !== null && job.expiresAt <= now))
  );
}

export class ExportService {
  constructor(private readonly deps: AppDeps) {}

  private now() {
    return this.deps.clock.now();
  }

  private async present(context: CustomerContext, jobs: ExportJob[]) {
    const actor = await actorNames(
      context.companyId,
      jobs.map((job) => job.requestedBy),
    );
    return jobs.map((job) => presentJob(job, actor, this.now()));
  }

  // ── Uçlar ────────────────────────────────────────────────────────────────────

  /** Yeni iş açar; bekleyen veya süren iş varsa onu döner (çift tıklama ve ikinci cihaz). */
  async start(context: CustomerContext): Promise<IdempotentOutcome> {
    const scoped = forCompany(ExportJobModel, context.companyId);
    const activeJob = () =>
      ExportJobModel.findOne({ companyId: context.companyId, deletedAt: null, active: true });
    const existing = await activeJob();
    if (existing) {
      const [data] = await this.present(context, [existing]);
      return { status: 200, data, message: ALREADY_RUNNING_MESSAGE };
    }
    let job: ExportJob;
    try {
      job = await scoped.create(
        {
          requestedBy: context.userId,
          type: 'full',
          status: 'queued',
          progress: 0,
          active: true,
          history: [historyEntry({ by: context.userId, action: 'create', at: this.now() })],
        },
        context.userId,
      );
    } catch (error) {
      if (!isDuplicateKeyError(error, 'active')) throw error;
      const running = await activeJob();
      if (!running) throw error;
      const [data] = await this.present(context, [running]);
      return { status: 200, data, message: ALREADY_RUNNING_MESSAGE };
    }
    this.schedule(context.companyId);
    const [data] = await this.present(context, [job]);
    return { status: 201, data };
  }

  /** Firmanın son işleri, yeniden eskiye. */
  async list(context: CustomerContext) {
    const jobs = await forCompany(ExportJobModel, context.companyId)
      .find()
      .sort({ createdAt: -1, _id: -1 })
      .limit(RECENT_LIMIT);
    return this.present(context, jobs);
  }

  /** Durum ve ilerleme; paket hazırsa 5 dakika geçerli indirme adresi. */
  async get(context: CustomerContext, id: string) {
    const job = await forCompany(ExportJobModel, context.companyId).findByIdOrThrow(id);
    const now = this.now();
    let download: { url: string; expiresAt: string } | null = null;
    if (job.status === 'ready' && job.fileKey && !isExpired(job, now)) {
      download = {
        url: await this.deps.storage.presignDownload(job.fileKey, {
          expiresInSeconds: EXPORT_DOWNLOAD_TTL_SECONDS,
          fileName: job.fileName ?? 'tum-firma-verisi.zip',
          contentType: 'application/zip',
          inline: false,
        }),
        expiresAt: new Date(now.getTime() + EXPORT_DOWNLOAD_TTL_SECONDS * 1000).toISOString(),
      };
    }
    const actor = await actorNames(context.companyId, [job.requestedBy]);
    return presentJob(job, actor, now, download);
  }

  // ── Hazırlama ────────────────────────────────────────────────────────────────

  schedule(companyId: Types.ObjectId): void {
    this.deps.background.run('export', () => this.processCompany(companyId));
  }

  /** Firmanın bekleyen işlerini sırayla hazırlar. */
  async processCompany(companyId: Types.ObjectId): Promise<void> {
    for (;;) {
      const job = await this.claim(companyId);
      if (!job) return;
      await this.run(job);
    }
  }

  private async claim(companyId: Types.ObjectId) {
    const now = this.now();
    return ExportJobModel.findOneAndUpdate(
      { companyId, deletedAt: null, status: 'queued' },
      {
        $set: {
          status: 'running',
          progress: 0,
          error: null,
          startedAt: now,
          lease: { token: randomUUID(), until: new Date(now.getTime() + EXPORT_LEASE_MS) },
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, returnDocument: 'after', timestamps: false },
    );
  }

  private async run(job: ExportJob) {
    const { companyId } = job;
    const token = job.lease!.token;
    const key = exportKeyOf(companyId, job._id, token);
    let lastProgress = 0;
    const progress = async (value: number) => {
      const rounded = Math.min(99, Math.floor(value));
      if (rounded <= lastProgress) return;
      lastProgress = rounded;
      const result = await ExportJobModel.updateOne(
        { _id: job._id, companyId, status: 'running', 'lease.token': token },
        {
          $set: {
            progress: rounded,
            'lease.until': new Date(this.now().getTime() + EXPORT_LEASE_MS),
          },
        },
        { timestamps: false },
      );
      if (result.matchedCount === 0) throw new LeaseLost();
    };

    try {
      const content = await this.collect(companyId);
      await progress(10);
      const tables = await renderFullExportFiles(content);
      await progress(15);
      const size = await this.writeZip(key, content, tables, (share) => progress(15 + share * 84));
      await this.finish(job, token, key, `${content.fileBase}.zip`, size);
    } catch (error) {
      await this.removeObject(key);
      if (error instanceof LeaseLost) return;
      await this.fail(job, token, error);
      return;
    }
    // Yeni paket hazır; önceki hazır paket silinir. Burada kalan olursa tarama tamamlar.
    try {
      await this.removeSuperseded(companyId);
    } catch (error) {
      this.deps.logger.error('Önceki dışa aktarma paketi silinemedi', {
        exportId: job._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Hata yalnız işi `failed` yapar; önceki hazır paket süresi dolana kadar indirilebilir kalır. */
  private async fail(job: ExportJob, token: string, error: unknown) {
    this.deps.logger.error('Tam veri çıkışı hazırlanamadı', {
      exportId: job._id.toString(),
      error: error instanceof Error ? error.message : String(error),
    });
    await ExportJobModel.updateOne(
      { _id: job._id, companyId: job.companyId, status: 'running', 'lease.token': token },
      {
        $set: {
          status: 'failed',
          error: error instanceof AppError ? error.message : EXPORT_FAILED_MESSAGE,
          active: null,
          lease: null,
          finishedAt: this.now(),
        },
      },
    );
  }

  /** Firma verisinin tamamı tek tutarlı okumadan; silinmiş (geri alınabilir) kayıtlar dahil. */
  private async collect(companyId: Types.ObjectId): Promise<FullExportContent> {
    const generatedAt = this.now().toISOString();
    const data = await withReadSnapshot(async (session) => {
      const filter = { companyId };
      const company = await CompanyModel.findById(companyId, {
        name: 1,
        displayName: 1,
        history: 1,
      })
        .session(session)
        .lean();
      if (!company) throw new AppError('NOT_FOUND', 'Firma bulunamadı.');
      const projects = await ProjectModel.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .session(session)
        .lean<Project[]>();
      const parties = await PartyModel.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .session(session)
        .lean<Party[]>();
      const categories = await CategoryModel.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .session(session)
        .lean<Category[]>();
      const agreements = await AgreementModel.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .session(session)
        .lean<Agreement[]>();
      const transactions = await TransactionModel.find(filter)
        .sort({ recordNo: 1 })
        .session(session)
        .lean<Transaction[]>();
      const documents = await DocumentModel.find(filter)
        .sort({ createdAt: 1, _id: 1 })
        .session(session)
        .lean<StoredDocument[]>();
      // Yalnız ad; kullanıcı adı, şifre ve token alanları okunmaz.
      const users = await UserModel.find(filter, { name: 1 }).session(session).lean();
      return { company, projects, parties, categories, agreements, transactions, documents, users };
    });

    const missingFiles = new Set<string>();
    for (const doc of data.documents) {
      if (doc.status !== 'uploaded' || !doc.storageKey) continue;
      if ((await this.deps.storage.size(doc.storageKey)) === null) {
        missingFiles.add(doc._id.toString());
      }
    }

    return buildFullExport({
      companyName: data.company.displayName || data.company.name,
      generatedAt,
      today: businessToday(this.deps.clock),
      projects: data.projects,
      parties: data.parties,
      categories: data.categories,
      agreements: data.agreements,
      transactions: data.transactions,
      documents: data.documents,
      companyHistory: data.company.history ?? [],
      userNames: new Map(data.users.map((user) => [user._id.toString(), user.name])),
      missingFiles,
    });
  }

  /**
   * Zip'i depoya akışla yazar. Belgeler tek tek okunur; arşiv bir sonrakine ancak öncekini işledikten
   * sonra geçer, böylece bellekte en fazla bir belge bulunur. Paketin bayt boyutunu döner.
   */
  private async writeZip(
    key: string,
    content: FullExportContent,
    tables: { path: string; body: Buffer }[],
    onProgress: (share: number) => Promise<void>,
  ): Promise<number> {
    const archive = new ZipArchive({ zlib: { level: 6 } });
    let fail: (error: unknown) => void = () => undefined;
    const failure = new Promise<never>((_, reject) => {
      fail = reject;
    });
    failure.catch(() => undefined);
    archive.on('error', (error) => fail(error));
    const upload = this.deps.storage.putStream(key, archive, 'application/zip');
    upload.catch((error: unknown) => fail(error));
    const step = <T>(promise: Promise<T>) => Promise.race([promise, failure]);
    const append = async (body: Buffer, path: string) => {
      const entered = new Promise((resolve) => archive.once('entry', resolve));
      archive.append(body, { name: `${content.fileBase}/${path}` });
      await step(entered);
    };

    try {
      for (const file of tables) await append(file.body, file.path);
      const totalBytes = content.documents.reduce((sum, doc) => sum + doc.sizeBytes, 0);
      let doneBytes = 0;
      for (const doc of content.documents) {
        await append(await step(this.deps.storage.read(doc.storageKey)), doc.path);
        doneBytes += doc.sizeBytes;
        await onProgress(totalBytes > 0 ? doneBytes / totalBytes : 1);
      }
      await step(archive.finalize());
      await step(upload);
      return archive.pointer();
    } catch (error) {
      archive.abort();
      throw error;
    }
  }

  /** Hazır: paket kapasitede sayılır (kota aşılabilir) ve 7 gün sonra silinir. */
  private async finish(job: ExportJob, token: string, key: string, fileName: string, size: number) {
    const now = this.now();
    await withTransaction(async (session) => {
      const updated = await ExportJobModel.updateOne(
        { _id: job._id, companyId: job.companyId, status: 'running', 'lease.token': token },
        {
          $set: {
            status: 'ready',
            progress: 100,
            fileKey: key,
            fileName,
            sizeBytes: size,
            countedBytes: size,
            expiresAt: new Date(now.getTime() + RETENTION_MS),
            finishedAt: now,
            active: null,
            lease: null,
          },
        },
        { session },
      );
      if (updated.matchedCount === 0) throw new LeaseLost();
      await CompanyModel.updateOne(
        { _id: job.companyId },
        { $inc: { storageUsedBytes: size } },
        { session, timestamps: false },
      );
    });
  }

  // ── Tarama ve temizlik ───────────────────────────────────────────────────────

  /**
   * Firmada en fazla bir hazır paket bulunur (şartname 7.10, 9.6): en son hazırlanan dışındaki hazır
   * paketler süre dolumuyla aynı yoldan silinir; kapasite yalnız bir kez iade edilir.
   */
  async removeSuperseded(companyId: Types.ObjectId): Promise<void> {
    const ready = await ExportJobModel.find(
      { companyId, status: 'ready', fileKey: { $ne: null } },
      { fileKey: 1 },
    )
      .sort({ finishedAt: -1, _id: -1 })
      .lean();
    for (const job of ready.slice(1)) await this.expireOne(companyId, job);
  }

  /** Süresi dolan veya yenisiyle değişen paketi siler; kapasite yalnız bir kez iade edilir. */
  async expireOne(companyId: Types.ObjectId, job: Pick<ExportJob, '_id' | 'fileKey'>) {
    if (!job.fileKey) return false;
    try {
      await this.deps.storage.remove(job.fileKey);
    } catch (error) {
      // Dosya silinemezse kapasite düşülmez; sonraki taramada yeniden denenir.
      this.deps.logger.error('Dışa aktarma paketi silinemedi', {
        exportId: job._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
    return withTransaction(async (session) => {
      const before = await ExportJobModel.findOneAndUpdate(
        { _id: job._id, companyId, status: 'ready', fileKey: job.fileKey },
        { $set: { fileKey: null, countedBytes: 0 } },
        { session },
      );
      if (!before) return false;
      await CompanyModel.updateOne(
        { _id: companyId },
        { $inc: { storageUsedBytes: -before.countedBytes } },
        { session, timestamps: false },
      );
      return true;
    });
  }

  /**
   * Bütün firmalarda: kilidi düşen işleri yeniden kuyruğa alır (deneme sınırında başarısız sayar),
   * süresi dolan paketleri siler ve bekleyen işleri hazırlar. Sorgular firma bazında yapılır.
   */
  async sweep(): Promise<void> {
    const now = this.now();
    const companies = await CompanyModel.find({}, { _id: 1 }).lean();
    for (const { _id: companyId } of companies) {
      const stale = await ExportJobModel.find(
        { companyId, status: 'running', 'lease.until': { $lte: now } },
        { attempts: 1, lease: 1 },
      ).lean();
      for (const job of stale) {
        const giveUp = job.attempts >= EXPORT_MAX_ATTEMPTS;
        await ExportJobModel.updateOne(
          { _id: job._id, companyId, status: 'running', 'lease.token': job.lease?.token },
          {
            $set: giveUp
              ? {
                  status: 'failed',
                  error: EXPORT_FAILED_MESSAGE,
                  active: null,
                  lease: null,
                  finishedAt: now,
                }
              : { status: 'queued', progress: 0, lease: null },
          },
        );
      }

      const expired = await ExportJobModel.find(
        { companyId, status: 'ready', fileKey: { $ne: null }, expiresAt: { $lte: now } },
        { fileKey: 1 },
      ).lean();
      for (const job of expired) await this.expireOne(companyId, job);
      await this.removeSuperseded(companyId);

      if (await ExportJobModel.exists({ companyId, status: 'queued', deletedAt: null })) {
        await this.processCompany(companyId);
      }
    }
  }

  private async removeObject(key: string) {
    try {
      await this.deps.storage.remove(key);
    } catch {
      // Yarım paket yoksa veya depo erişilemiyorsa yapılacak bir şey yok; anahtar her denemeye özgü.
    }
  }
}

/** Hazır dışa aktarma paketlerinin kapasitede sayılan baytı (şartname 9.6). */
export async function exportBytesOf(companyId: Types.ObjectId): Promise<number> {
  const [row] = await ExportJobModel.aggregate<{ bytes: number }>([
    { $match: { companyId, countedBytes: { $gt: 0 } } },
    { $group: { _id: null, bytes: { $sum: '$countedBytes' } } },
  ]);
  return row?.bytes ?? 0;
}

/** Tarama zamanlayıcısı; dönen işlev durdurur. */
export function startExportJobs(deps: AppDeps): () => void {
  const service = new ExportService(deps);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await service.sweep();
    } catch (error) {
      deps.logger.error('Dışa aktarma taraması başarısız', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), EXPORT_SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
