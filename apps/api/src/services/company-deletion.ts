// Firma kalıcı silme (şartname 7.13, 8.1, 8.10). Ürün sahibi onayı `deletionStatus`'u `pending` yapar;
// iş arka planda `running` olur, açık dışa aktarma işlerini iptal eder, depodaki bütün dosyaları
// (belgeler, önizlemeler, yarım yüklemeler, paketler) ve firma verisini siler. Firma kaydında yalnız
// asgari iz (ad, hizmet tarihleri, `done`) kalır; kalıcı silinen firma yeniden açılamaz. İşletim
// geçmişinde asgari kayıt (firma adı, tarihler, işlem yapan, gerekçe) kalır, kişi verisi taşıyan
// değişiklik ayrıntıları temizlenir. Hata `failed` yapar; ürün sahibi silmeyi yeniden başlatabilir.

import type { Model, Types } from 'mongoose';
import { withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { CompanyModel } from '../models/company.js';
import { ExportJobModel } from '../models/export-job.js';
import { models } from '../models/index.js';
import { PlatformLogModel, type PlatformLogChange } from '../models/platform-log.js';
import { writePlatformLog } from './platform-log.js';

export const DELETION_CANCELLED_EXPORT_MESSAGE =
  'Firma hesabı kapatıldığı için paket hazırlanmadı.';

/** Bekleyen silmeler için tarama aralığı. */
export const DELETION_SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Silme sonrası değişiklik ayrıntısı korunan işletim kayıtları: yalnız firma adı, tarih, kapasite ve
 * durum içerirler. Diğerlerinde (kullanıcı adları, iletişim, işletim notu) ayrıntı temizlenir.
 */
const MINIMAL_LOG_ACTIONS = [
  'company.create',
  'company.quota',
  'company.suspend',
  'company.unsuspend',
  'company.end_service',
  'company.reopen',
  'company.extend_retention',
  'company.delete',
  'company.delete_failed',
  'company.delete_completed',
];

/** Firma verisi taşıyan koleksiyonlar: `companyId` alanı olan her model (işletim geçmişi hariç). */
function companyDataModels() {
  return models
    .filter((current) => current !== PlatformLogModel && 'companyId' in current.schema.paths)
    .map((current) => current as unknown as Model<{ companyId: Types.ObjectId }>);
}

export const companyStoragePrefix = (companyId: Types.ObjectId) =>
  `companies/${companyId.toString()}/`;

export class CompanyDeletionService {
  constructor(private readonly deps: AppDeps) {}

  schedule(companyId: Types.ObjectId): void {
    this.deps.background.run('company-deletion', () => this.run(companyId));
  }

  /** Bekleyen silmeyi üstlenir ve yürütür; başka çalıştırıcı üstlendiyse hiçbir şey yapmaz. */
  async run(companyId: Types.ObjectId): Promise<void> {
    const { deps } = this;
    const company = await CompanyModel.findOneAndUpdate(
      { _id: companyId, deletionStatus: 'pending' },
      { $set: { deletionStatus: 'running' } },
      { returnDocument: 'after', timestamps: false },
    ).lean();
    if (!company) return;

    const request = await PlatformLogModel.findOne({ companyId, action: 'company.delete' })
      .sort({ at: -1, _id: -1 })
      .lean();
    const adminId = request?.adminId ?? null;
    const reason = request?.reason ?? null;

    try {
      const removed = await this.purge(companyId);
      await withTransaction(async (session) => {
        await CompanyModel.updateOne(
          { _id: companyId, deletionStatus: 'running' },
          {
            $set: {
              deletionStatus: 'done',
              displayName: '',
              contact: { person: '', phone: '', email: '' },
              opsNote: '',
              history: [],
              storageUsedBytes: 0,
              recordCounter: 0,
            },
          },
          { session, timestamps: false },
        );
        await PlatformLogModel.updateMany(
          { companyId, action: { $nin: MINIMAL_LOG_ACTIONS } },
          { $set: { changes: [] } },
          { session },
        );
        await writePlatformLog(
          {
            adminId,
            companyId,
            action: 'company.delete_completed',
            changes: [
              { field: 'name', old: company.name, new: null },
              { field: 'deletionStatus', old: 'running', new: 'done' },
              ...removed,
            ],
            reason,
            at: deps.clock.now(),
          },
          session,
        );
      });
    } catch (error) {
      deps.logger.error('Firma kalıcı silinemedi', {
        companyId: companyId.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      await CompanyModel.updateOne(
        { _id: companyId, deletionStatus: 'running' },
        { $set: { deletionStatus: 'failed' } },
        { timestamps: false },
      );
      await writePlatformLog({
        adminId,
        companyId,
        action: 'company.delete_failed',
        changes: [{ field: 'deletionStatus', old: 'running', new: 'failed' }],
        reason,
        at: deps.clock.now(),
      });
    }
  }

  /**
   * Açık dışa aktarma işlerini iptal eder, depodaki dosyaları ve firma verisini siler. Her adım tekrar
   * çalıştırılabilir; yarıda kalan silme yeniden denendiğinde kaldığı yerden tamamlanır.
   */
  private async purge(companyId: Types.ObjectId): Promise<PlatformLogChange[]> {
    const { storage } = this.deps;
    await ExportJobModel.updateMany(
      { companyId, active: true },
      {
        $set: {
          status: 'failed',
          error: DELETION_CANCELLED_EXPORT_MESSAGE,
          active: null,
          lease: null,
          finishedAt: this.deps.clock.now(),
        },
      },
    );

    const prefix = companyStoragePrefix(companyId);
    let files = await storage.removePrefix(prefix);
    const counts: PlatformLogChange[] = [];
    for (const current of companyDataModels()) {
      const { deletedCount } = await current.deleteMany({ companyId });
      counts.push({ field: current.collection.collectionName, old: deletedCount, new: 0 });
    }
    // Silme başlarken sürmekte olan bir istek (ör. belge tamamlama) dosya yazmış olabilir.
    files += await storage.removePrefix(prefix);
    return [{ field: 'files', old: files, new: 0 }, ...counts];
  }

  /** Bekleyen silmeleri yürütür. */
  async sweep(): Promise<void> {
    const pending = await CompanyModel.find({ deletionStatus: 'pending' }, { _id: 1 }).lean();
    for (const { _id } of pending) await this.run(_id);
  }
}

/**
 * Açılışta yarıda kalmış silmeleri (`running`) yeniden kuyruğa alır ve bekleyenleri düzenli yürütür.
 * API tek süreçte çalışır (şartname 7.10); birden fazla sunucuya geçilirse bu adım kilitle korunmalıdır.
 */
export function startCompanyDeletions(deps: AppDeps): () => void {
  const service = new CompanyDeletionService(deps);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await service.sweep();
    } catch (error) {
      deps.logger.error('Firma silme taraması başarısız', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  };
  void CompanyModel.updateMany(
    { deletionStatus: 'running' },
    { $set: { deletionStatus: 'pending' } },
    { timestamps: false },
  ).then(run, (error: unknown) =>
    deps.logger.error('Yarıda kalan firma silmeleri kuyruğa alınamadı', {
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  const timer = setInterval(() => void run(), DELETION_SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
