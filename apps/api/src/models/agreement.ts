import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import {
  AGREEMENT_KINDS,
  DIRECTIONS,
  PAYMENT_STATUSES,
  SCOPES,
  WORK_STATUSES,
  type AgreementKind,
  type Direction,
  type PaymentStatus,
  type Scope,
  type WorkStatus,
} from '@santiye/shared';
import { companyScopedPlugin, type CompanyScopedFields } from '../db/company-scope.js';

export interface ValueChange<T> {
  at: Date;
  by: Types.ObjectId;
  old: T;
  new: T;
  reason: string;
}

/** Anlaşmalar ve başlangıç borç/alacakları aynı koleksiyondadır (şartname 8.7). */
export interface Agreement extends CompanyScopedFields {
  _id: Types.ObjectId;
  kind: AgreementKind;
  direction: Direction;
  scope: Scope;
  projectId: Types.ObjectId | null;
  partyId: Types.ObjectId;
  title: string;
  titleFolded: string;
  description: string;
  descriptionFolded: string;
  initialAmount: number;
  currentAmount: number;
  amountHistory: ValueChange<number>[];
  agreementDate: string | null;
  trackingStartDate: string | null;
  dueDate: string | null;
  dueDateHistory: ValueChange<string | null>[];
  /** Yalnız anlaşmada; başlangıç kaydında null */
  workStatus: WorkStatus | null;
  settlementPending: boolean;
  // Önbellek: bağlı her harekette aynı transaction'da yeniden hesaplanır.
  netSettled: number;
  remaining: number;
  excess: number;
  paymentStatus: PaymentStatus;
}

const valueChange = (type: typeof Number | typeof String) =>
  new Schema(
    {
      at: { type: Date, required: true },
      by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
      old: { type, default: null },
      new: { type, default: null },
      reason: { type: String, required: true },
    },
    { _id: false },
  );

const agreementSchema = new Schema<Agreement>({
  kind: { type: String, enum: AGREEMENT_KINDS, required: true },
  direction: { type: String, enum: DIRECTIONS, required: true },
  scope: { type: String, enum: SCOPES, required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
  partyId: { type: Schema.Types.ObjectId, ref: 'Party', required: true },
  title: { type: String, default: '' },
  titleFolded: { type: String, default: '' },
  description: { type: String, default: '' },
  descriptionFolded: { type: String, default: '' },
  initialAmount: { type: Number, required: true },
  currentAmount: { type: Number, required: true },
  amountHistory: { type: [valueChange(Number)], default: [] },
  agreementDate: { type: String, default: null },
  trackingStartDate: { type: String, default: null },
  dueDate: { type: String, default: null },
  dueDateHistory: { type: [valueChange(String)], default: [] },
  workStatus: { type: String, enum: [...WORK_STATUSES, null], default: null },
  settlementPending: { type: Boolean, default: false },
  netSettled: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
  excess: { type: Number, default: 0 },
  paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'open' },
});
agreementSchema.plugin(companyScopedPlugin);

agreementSchema.index({ companyId: 1, projectId: 1, partyId: 1, deletedAt: 1 });
agreementSchema.index({ companyId: 1, direction: 1, remaining: 1 });
agreementSchema.index({ companyId: 1, dueDate: 1, remaining: 1 });
agreementSchema.index({ companyId: 1, paymentStatus: 1 });

export const AgreementModel = model<Agreement>('Agreement', agreementSchema);
export type AgreementDocument = HydratedDocument<Agreement>;
