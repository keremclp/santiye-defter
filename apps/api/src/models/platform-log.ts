import { model, Schema, type Types } from 'mongoose';

export interface PlatformLogChange {
  field: string;
  old: unknown;
  new: unknown;
}

/** Ürün sahibi işletim geçmişi. Şifre, token veya kod içermez. */
export interface PlatformLog {
  _id: Types.ObjectId;
  /** Sunucu komutunda işlem yapılan ürün sahibi hesabı */
  adminId: Types.ObjectId | null;
  companyId: Types.ObjectId | null;
  action: string;
  changes: PlatformLogChange[];
  reason: string | null;
  at: Date;
}

const platformLogSchema = new Schema<PlatformLog>({
  adminId: { type: Schema.Types.ObjectId, ref: 'PlatformAdmin', default: null },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
  action: { type: String, required: true },
  changes: {
    type: [{ _id: false, field: String, old: Schema.Types.Mixed, new: Schema.Types.Mixed }],
    default: [],
  },
  reason: { type: String, default: null },
  at: { type: Date, required: true },
});

platformLogSchema.index({ companyId: 1, at: -1 });
platformLogSchema.index({ adminId: 1, at: -1 });

export const PlatformLogModel = model<PlatformLog>('PlatformLog', platformLogSchema);
