// Finansal önbelleklerin ve toplamların veritabanı tarafı. Formüller packages/shared'dedir;
// burada yalnız veriler toplanır ve paylaşılan fonksiyonlara verilir (şartname 3, 8.6, 8.7, 9.1).

import {
  cashTotalsFromSums,
  computeAgreementBalance,
  type CashTotals,
  type LinkedAllocation,
  type TransactionKind,
} from '@santiye/shared';
import type { ClientSession, PipelineStage, QueryFilter, Types } from 'mongoose';
import { AgreementModel } from '../models/agreement.js';
import { CompanyModel } from '../models/company.js';
import { TransactionModel, type Transaction } from '../models/transaction.js';

const CASH_KINDS: TransactionKind[] = ['income', 'expense'];

/** Firma içi artan kayıt numarası; aynı transaction'da atomik artırılır. */
export async function nextRecordNo(
  companyId: Types.ObjectId,
  session: ClientSession,
): Promise<number> {
  const company = await CompanyModel.findOneAndUpdate(
    { _id: companyId },
    { $inc: { recordCounter: 1 } },
    { returnDocument: 'after', session, timestamps: false },
  );
  if (!company) throw new Error('Firma bulunamadı.');
  return company.recordCounter;
}

/** Anlaşmalara bağlı, silinmemiş gelir/gider payları ve bu paylara yapılan aktif iadeler. */
export async function linkedAllocations(
  companyId: Types.ObjectId,
  agreementIds: Types.ObjectId[],
  session?: ClientSession | null,
  excludeTransactionId?: Types.ObjectId,
): Promise<Map<string, LinkedAllocation[]>> {
  const result = new Map<string, LinkedAllocation[]>(agreementIds.map((id) => [id.toString(), []]));
  if (agreementIds.length === 0) return result;

  const rows = await TransactionModel.aggregate<{
    agreementId: Types.ObjectId;
    amount: number;
    refundedAmount: number;
  }>([
    {
      $match: {
        companyId,
        deletedAt: null,
        kind: { $in: CASH_KINDS },
        'allocations.agreementId': { $in: agreementIds },
        ...(excludeTransactionId ? { _id: { $ne: excludeTransactionId } } : {}),
      },
    },
    { $unwind: '$allocations' },
    { $match: { 'allocations.agreementId': { $in: agreementIds } } },
    {
      $project: {
        _id: 0,
        agreementId: '$allocations.agreementId',
        amount: '$allocations.amount',
        refundedAmount: '$allocations.refundedAmount',
      },
    },
  ]).session(session ?? null);

  for (const row of rows) {
    result
      .get(row.agreementId.toString())
      ?.push({ amount: row.amount, refundedAmount: row.refundedAmount });
  }
  return result;
}

/**
 * Anlaşma önbelleklerini (net ödenen, kalan, fazla, ödeme durumu) bağlı hareketlerden yeniden
 * hesaplar; aynı transaction'da çağrılır.
 */
export async function recalculateAgreements(
  companyId: Types.ObjectId,
  agreementIds: (Types.ObjectId | null | undefined)[],
  session: ClientSession,
): Promise<void> {
  const unique = [
    ...new Map(agreementIds.filter(Boolean).map((id) => [id!.toString(), id!])).values(),
  ];
  if (unique.length === 0) return;

  const agreements = await AgreementModel.find({ companyId, _id: { $in: unique } }).session(
    session,
  );
  const linked = await linkedAllocations(companyId, unique, session);
  for (const agreement of agreements) {
    const balance = computeAgreementBalance(
      agreement.currentAmount,
      linked.get(agreement._id.toString()) ?? [],
    );
    if (
      balance.netSettled === agreement.netSettled &&
      balance.remaining === agreement.remaining &&
      balance.excess === agreement.excess &&
      balance.paymentStatus === agreement.paymentStatus
    ) {
      continue;
    }
    await AgreementModel.updateOne(
      { _id: agreement._id, companyId },
      { $set: balance },
      { session },
    );
  }
}

/** Anlaşmaların bu hareket hariç kalanı (fazla ödeme tespiti için). */
export async function remainingExcluding(
  companyId: Types.ObjectId,
  agreements: { _id: Types.ObjectId; currentAmount: number }[],
  excludeTransactionId: Types.ObjectId | undefined,
  session: ClientSession,
): Promise<Map<string, number>> {
  const linked = await linkedAllocations(
    companyId,
    agreements.map((agreement) => agreement._id),
    session,
    excludeTransactionId,
  );
  return new Map(
    agreements.map((agreement) => [
      agreement._id.toString(),
      computeAgreementBalance(agreement.currentAmount, linked.get(agreement._id.toString()) ?? [])
        .remaining,
    ]),
  );
}

/**
 * Kaynak hareketin paylarındaki `refundedAmount` değerlerini aktif iadelerden yeniden yazar ve
 * bağlı anlaşma önbelleklerini günceller.
 */
export async function recalculateRefunds(
  companyId: Types.ObjectId,
  sourceId: Types.ObjectId,
  session: ClientSession,
): Promise<void> {
  const source = await TransactionModel.findOne({ _id: sourceId, companyId }).session(session);
  if (!source) return;
  const refunds = await TransactionModel.find({
    companyId,
    deletedAt: null,
    'refundOf.transactionId': sourceId,
  }).session(session);

  const sums = new Map<string, number>();
  for (const refund of refunds) {
    for (const part of refund.refundOf?.parts ?? []) {
      const key = part.allocationId.toString();
      sums.set(key, (sums.get(key) ?? 0) + part.amount);
    }
  }

  const allocations = source.allocations.map((allocation) => ({
    _id: allocation._id,
    scope: allocation.scope,
    projectId: allocation.projectId,
    agreementId: allocation.agreementId,
    amount: allocation.amount,
    refundedAmount: sums.get(allocation._id.toString()) ?? 0,
  }));
  const changed = allocations.some(
    (allocation, index) => allocation.refundedAmount !== source.allocations[index]?.refundedAmount,
  );
  if (changed) {
    await TransactionModel.updateOne(
      { _id: sourceId, companyId },
      { $set: { allocations } },
      { session },
    );
  }
  await recalculateAgreements(
    companyId,
    source.allocations.map((allocation) => allocation.agreementId),
    session,
  );
}

/** Toplamın kapsamı: verilmezse firma toplamı (hareket tutarı), verilirse yalnız seçili paylar. */
export interface CashTarget {
  projectIds: Types.ObjectId[];
  company: boolean;
}

/**
 * Filtreye uyan bütün silinmemiş hareketlerin toplamları. Tutarlar türe göre veritabanında
 * toplanır; net, fark ve iade etkisi `cashTotalsFromSums` ile hesaplanır.
 */
export async function cashTotals(
  companyId: Types.ObjectId,
  filter: QueryFilter<Transaction>,
  target: CashTarget | null,
  session?: ClientSession | null,
): Promise<CashTotals> {
  const pipeline: PipelineStage[] = [{ $match: { ...filter, companyId, deletedAt: null } }];
  if (target) {
    const conditions: Record<string, unknown>[] = [];
    if (target.projectIds.length > 0) {
      conditions.push({
        'allocations.scope': 'project',
        'allocations.projectId': { $in: target.projectIds },
      });
    }
    if (target.company) conditions.push({ 'allocations.scope': 'company' });
    pipeline.push(
      { $unwind: '$allocations' },
      { $match: conditions.length > 0 ? { $or: conditions } : { _id: null } },
      { $group: { _id: '$kind', total: { $sum: '$allocations.amount' } } },
    );
  } else {
    pipeline.push({ $group: { _id: '$kind', total: { $sum: '$amount' } } });
  }

  const rows = await TransactionModel.aggregate<{ _id: TransactionKind; total: number }>(
    pipeline,
  ).session(session ?? null);
  const byKind = new Map(rows.map((row) => [row._id, row.total]));
  return cashTotalsFromSums({
    income: byKind.get('income') ?? 0,
    incomeRefund: byKind.get('income_refund') ?? 0,
    expense: byKind.get('expense') ?? 0,
    expenseRefund: byKind.get('expense_refund') ?? 0,
  });
}

/** Paylardan seçili kapsama düşen tutar (liste satırında "bu şantiyeye düşen pay"). */
export function scopedAmount(
  transaction: Pick<Transaction, 'allocations'>,
  target: CashTarget,
): number {
  const projectIds = new Set(target.projectIds.map((id) => id.toString()));
  return transaction.allocations
    .filter((allocation) =>
      allocation.scope === 'company'
        ? target.company
        : allocation.projectId !== null && projectIds.has(allocation.projectId.toString()),
    )
    .reduce((sum, allocation) => sum + allocation.amount, 0);
}
