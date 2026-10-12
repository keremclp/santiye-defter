import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { SCOPES, TRANSACTION_KINDS, type Scope, type TransactionKind } from '@santiye/shared';
import { companyScopedPlugin, type CompanyScopedFields } from '../db/company-scope.js';

export interface Allocation {
  _id: Types.ObjectId;
  scope: Scope;
  projectId: Types.ObjectId | null;
  agreementId: Types.ObjectId | null;
  amount: number;
  /** Bu paya bağlı aktif iadelerin toplamı; aynı transaction'da güncellenir */
  refundedAmount: number;
}

export interface RefundOf {
  transactionId: Types.ObjectId;
  parts: { allocationId: Types.ObjectId; amount: number }[];
}

export interface Transaction extends CompanyScopedFields {
  _id: Types.ObjectId;
  recordNo: number;
  kind: TransactionKind;
  amount: number;
  date: string;
  partyId: Types.ObjectId | null;
  categoryId: Types.ObjectId | null;
  description: string;
  descriptionFolded: string;
  allocations: Allocation[];
  refundOf: RefundOf | null;
  excess: { amount: number; reason: string } | null;
  documentCount: number;
}

const allocationSchema = new Schema<Allocation>({
  scope: { type: String, enum: SCOPES, required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
  agreementId: { type: Schema.Types.ObjectId, ref: 'Agreement', default: null },
  amount: { type: Number, required: true },
  refundedAmount: { type: Number, default: 0 },
});

const transactionSchema = new Schema<Transaction>({
  recordNo: { type: Number, required: true },
  kind: { type: String, enum: TRANSACTION_KINDS, required: true },
  amount: { type: Number, required: true },
  date: { type: String, required: true },
  partyId: { type: Schema.Types.ObjectId, ref: 'Party', default: null },
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
  description: { type: String, default: '' },
  descriptionFolded: { type: String, default: '' },
  allocations: { type: [allocationSchema], required: true },
  refundOf: {
    type: new Schema<RefundOf>(
      {
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
        parts: [
          {
            _id: false,
            allocationId: { type: Schema.Types.ObjectId, required: true },
            amount: { type: Number, required: true },
          },
        ],
      },
      { _id: false },
    ),
    default: null,
  },
  excess: {
    type: new Schema({ amount: Number, reason: String }, { _id: false }),
    default: null,
  },
  documentCount: { type: Number, default: 0 },
});
transactionSchema.plugin(companyScopedPlugin);

transactionSchema.index({ companyId: 1, date: -1 });
transactionSchema.index({ companyId: 1, 'allocations.projectId': 1, date: -1 });
transactionSchema.index({ companyId: 1, 'allocations.agreementId': 1 });
transactionSchema.index({ companyId: 1, partyId: 1, deletedAt: 1 });
transactionSchema.index({ companyId: 1, kind: 1, date: -1 });
transactionSchema.index({ companyId: 1, recordNo: 1 }, { unique: true });
transactionSchema.index({ companyId: 1, createdBy: 1 });
transactionSchema.index({ companyId: 1, 'refundOf.transactionId': 1 });

export const TransactionModel = model<Transaction>('Transaction', transactionSchema);
export type TransactionDocument = HydratedDocument<Transaction>;
