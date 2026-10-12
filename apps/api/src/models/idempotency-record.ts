import { model, Schema, type Types } from 'mongoose';

/** Şartname 3 ve 8.10: kayıtlar 30 gün tutulur. */
export const IDEMPOTENCY_RETENTION_SECONDS = 30 * 24 * 60 * 60;

export interface IdempotencyResultRef {
  type: string;
  id: string;
  status: number;
}

export interface IdempotencyRecord {
  _id: Types.ObjectId;
  /** Ürün sahibi isteklerinde null */
  companyId: Types.ObjectId | null;
  /** Firma kullanıcısı veya ürün sahibi */
  userId: Types.ObjectId;
  key: string;
  requestHash: string;
  resultRef: IdempotencyResultRef | null;
  createdAt: Date;
}

const idempotencyRecordSchema = new Schema<IdempotencyRecord>({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
  userId: { type: Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  requestHash: { type: String, required: true },
  resultRef: {
    type: new Schema<IdempotencyResultRef>(
      { type: String, id: String, status: Number },
      { _id: false },
    ),
    default: null,
  },
  createdAt: { type: Date, required: true },
});

idempotencyRecordSchema.index({ companyId: 1, key: 1 }, { unique: true });
idempotencyRecordSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: IDEMPOTENCY_RETENTION_SECONDS },
);

export const IdempotencyRecordModel = model<IdempotencyRecord>(
  'IdempotencyRecord',
  idempotencyRecordSchema,
);
