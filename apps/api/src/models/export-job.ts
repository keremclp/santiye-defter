import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import {
  EXPORT_JOB_STATUSES,
  EXPORT_JOB_TYPES,
  type ExportJobStatus,
  type ExportJobType,
} from '@santiye/shared';
import { companyScopedPlugin, type CompanyScopedFields } from '../db/company-scope.js';

/** Tam firma veri çıkışı işi (şartname 8.10). */
export interface ExportJob extends CompanyScopedFields {
  _id: Types.ObjectId;
  requestedBy: Types.ObjectId;
  type: ExportJobType;
  status: ExportJobStatus;
  /** 0–100 */
  progress: number;
  /** Hazır paketin depo anahtarı; paket silinince null */
  fileKey: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  /** Firmanın `storageUsedBytes` değerinde bu paket için sayılan bayt; paket silinince 0 */
  countedBytes: number;
  /** Hazır paketin silineceği an (hazır olma + 7 gün) */
  expiresAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  /** Kullanıcıya gösterilen hata metni */
  error: string | null;
  /** Bekleyen veya süren işte true; firma başına tek etkin iş (kısmi benzersiz indeks) */
  active: true | null;
  attempts: number;
  /** Süren işin kilidi; süresi dolarsa (ör. sunucu yeniden başladı) iş yeniden kuyruğa alınır */
  lease: { token: string; until: Date } | null;
}

const exportJobSchema = new Schema<ExportJob>({
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  type: { type: String, enum: EXPORT_JOB_TYPES, required: true, immutable: true },
  status: { type: String, enum: EXPORT_JOB_STATUSES, default: 'queued' },
  progress: { type: Number, default: 0 },
  fileKey: { type: String, default: null },
  fileName: { type: String, default: null },
  sizeBytes: { type: Number, default: null },
  countedBytes: { type: Number, default: 0 },
  expiresAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null },
  error: { type: String, default: null },
  active: { type: Boolean, default: true },
  attempts: { type: Number, default: 0 },
  lease: {
    type: new Schema({ token: String, until: Date }, { _id: false }),
    default: null,
  },
});
exportJobSchema.plugin(companyScopedPlugin);

exportJobSchema.index({ companyId: 1, createdAt: -1 });
exportJobSchema.index({ companyId: 1, status: 1, expiresAt: 1 });
exportJobSchema.index(
  { companyId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

export const ExportJobModel = model<ExportJob>('ExportJob', exportJobSchema);
export type ExportJobDocument = HydratedDocument<ExportJob>;
