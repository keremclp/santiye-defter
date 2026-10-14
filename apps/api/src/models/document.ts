import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import {
  DOCUMENT_MIME_TYPES,
  DOCUMENT_OWNER_TYPES,
  DOCUMENT_STATUSES,
  type DocumentMimeType,
  type DocumentOwnerType,
  type DocumentStatus,
} from '@santiye/shared';
import { companyScopedPlugin, type CompanyScopedFields } from '../db/company-scope.js';

/** İşlem veya anlaşmaya bağlı belge (şartname 8.8). */
export interface StoredDocument extends CompanyScopedFields {
  _id: Types.ObjectId;
  ownerType: DocumentOwnerType;
  ownerId: Types.ObjectId;
  fileName: string;
  /** Yükleme niyetinde bildirilen; tamamlanınca dosya imzasından doğrulanmış tür */
  mimeType: DocumentMimeType;
  /** Sunucunun ölçtüğü gerçek boyut; tamamlanana kadar null */
  sizeBytes: number | null;
  /** Firmanın `storageUsedBytes` değerinde bu belge için sayılan bayt (rezervasyon veya orijinal + önizleme) */
  countedBytes: number;
  tempKey: string;
  /** Değiştirilemeyen nihai orijinal anahtarı */
  storageKey: string | null;
  previewKey: string | null;
  previewBytes: number;
  status: DocumentStatus;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date | null;
  /** Bu andan sonra hâlâ bekleyen yükleme süresi dolmuş sayılır (oluşturma + 1 saat) */
  expiresAt: Date;
  /** Süren tamamlamanın kilidi; temizlik bu süre dolmadan belgeye dokunmaz */
  completion: { token: string; until: Date } | null;
}

const documentSchema = new Schema<StoredDocument>({
  ownerType: { type: String, enum: DOCUMENT_OWNER_TYPES, required: true, immutable: true },
  ownerId: { type: Schema.Types.ObjectId, required: true, immutable: true },
  fileName: { type: String, required: true },
  mimeType: { type: String, enum: DOCUMENT_MIME_TYPES, required: true },
  sizeBytes: { type: Number, default: null },
  countedBytes: { type: Number, required: true },
  tempKey: { type: String, required: true },
  storageKey: { type: String, default: null },
  previewKey: { type: String, default: null },
  previewBytes: { type: Number, default: 0 },
  status: { type: String, enum: DOCUMENT_STATUSES, default: 'pending' },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true },
  completion: {
    type: new Schema({ token: String, until: Date }, { _id: false }),
    default: null,
  },
});
documentSchema.plugin(companyScopedPlugin);

documentSchema.index({ companyId: 1, ownerType: 1, ownerId: 1, deletedAt: 1 });
documentSchema.index({ companyId: 1, status: 1, expiresAt: 1 });

export const DocumentModel = model<StoredDocument>('Document', documentSchema);
export type DocumentRecord = HydratedDocument<StoredDocument>;
