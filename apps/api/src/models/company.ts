import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { historyEntrySchema, type HistoryEntry } from '../db/company-scope.js';

/** Şartname 6.2 ve 7.13: firma 20 GB belge alanıyla başlar. */
export const DEFAULT_STORAGE_QUOTA_BYTES = 20 * 1024 ** 3;

export const DELETION_STATUSES = ['none', 'pending', 'running', 'done', 'failed'] as const;
export type DeletionStatus = (typeof DELETION_STATUSES)[number];

export interface Company {
  _id: Types.ObjectId;
  name: string;
  displayName: string;
  contact: { person: string; phone: string; email: string };
  opsNote: string;
  storageQuotaBytes: number;
  storageUsedBytes: number;
  isSuspended: boolean;
  /** Hizmet sonu yürürlük tarihi (YYYY-MM-DD) */
  serviceEndedAt: string | null;
  viewUntil: string | null;
  retainUntil: string | null;
  deletionStatus: DeletionStatus;
  isDemo: boolean;
  demoLastActiveAt: Date | null;
  recordCounter: number;
  /** Firma kullanıcılarının görünen ad ve iletişim değişiklikleri (şartname 7.11) */
  history: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<Company>(
  {
    name: { type: String, required: true, trim: true },
    displayName: { type: String, default: '', trim: true },
    contact: {
      person: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    opsNote: { type: String, default: '' },
    storageQuotaBytes: { type: Number, default: DEFAULT_STORAGE_QUOTA_BYTES },
    storageUsedBytes: { type: Number, default: 0 },
    isSuspended: { type: Boolean, default: false },
    serviceEndedAt: { type: String, default: null },
    viewUntil: { type: String, default: null },
    retainUntil: { type: String, default: null },
    deletionStatus: { type: String, enum: DELETION_STATUSES, default: 'none' },
    isDemo: { type: Boolean, default: false },
    demoLastActiveAt: { type: Date, default: null },
    recordCounter: { type: Number, default: 0 },
    history: { type: [historyEntrySchema], default: [] },
  },
  { timestamps: true },
);

companySchema.index({ name: 1 });

export const CompanyModel = model<Company>('Company', companySchema);
export type CompanyDocument = HydratedDocument<Company>;
