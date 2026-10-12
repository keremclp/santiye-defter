import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { PARTY_KINDS, PARTY_TAGS } from '@santiye/shared';
import { companyScopedPlugin, type CompanyScopedFields } from '../db/company-scope.js';

export interface Party extends CompanyScopedFields {
  _id: Types.ObjectId;
  name: string;
  nameFolded: string;
  kind: (typeof PARTY_KINDS)[number];
  tags: (typeof PARTY_TAGS)[number][];
  phone: string;
  email: string;
  address: string;
  note: string;
  isActive: boolean;
  pinned: boolean;
  lastUsedAt: Date | null;
}

const partySchema = new Schema<Party>({
  name: { type: String, required: true, trim: true },
  nameFolded: { type: String, required: true },
  kind: { type: String, enum: PARTY_KINDS, default: 'company' },
  tags: { type: [{ type: String, enum: PARTY_TAGS }], default: [] },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  note: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  pinned: { type: Boolean, default: false },
  lastUsedAt: { type: Date, default: null },
});
partySchema.plugin(companyScopedPlugin);

partySchema.index({ companyId: 1, nameFolded: 1 });
partySchema.index({ companyId: 1, tags: 1, deletedAt: 1 });
partySchema.index({ companyId: 1, pinned: -1, lastUsedAt: -1 });

export const PartyModel = model<Party>('Party', partySchema);
export type PartyDocument = HydratedDocument<Party>;
