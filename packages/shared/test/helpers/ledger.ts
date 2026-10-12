// Senaryo testleri için bellek içi hareket defteri. Adım 3'te veritabanının tutacağı
// önbellekleri (refundedAmount, anlaşma bakiyesi) yalnız saf fonksiyonlarla türetir.

import {
  computeAgreementBalance,
  refundAllocationsFor,
  refundKindOf,
  validateAllocationChangesAgainstRefunds,
  validateRefund,
  type AgreementBalance,
  type CashKind,
  type CashTransaction,
  type RefundPart,
  type Scope,
  type TransactionKind,
} from '../../src/index.js';

export const tl = (lira: number) => lira * 100;

export interface LedgerAllocation {
  id: string;
  scope: Scope;
  projectId?: string | null;
  agreementId?: string | null;
  amount: number;
}

export interface LedgerTransaction extends CashTransaction {
  id: string;
  kind: TransactionKind;
  allocations: LedgerAllocation[];
  refundOf?: { transactionId: string; parts: RefundPart[] };
  deleted?: boolean;
}

export class Ledger {
  private readonly transactions: LedgerTransaction[] = [];
  private sequence = 0;

  private nextId(prefix: string) {
    this.sequence += 1;
    return `${prefix}${this.sequence}`;
  }

  /** Paylar `[{ ... amount }]`; tek pay verilirse basit kayıttır. */
  add(
    kind: CashKind,
    date: string,
    allocations: Omit<LedgerAllocation, 'id'>[],
  ): LedgerTransaction {
    const transaction: LedgerTransaction = {
      id: this.nextId('t'),
      kind,
      date,
      amount: allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
      allocations: allocations.map((allocation) => ({ ...allocation, id: this.nextId('a') })),
    };
    this.transactions.push(transaction);
    return transaction;
  }

  refund(sourceId: string, date: string, parts: RefundPart[]): LedgerTransaction {
    const source = this.get(sourceId);
    if (source.kind !== 'income' && source.kind !== 'expense') throw new Error('kaynak geçersiz');
    const amount = parts.reduce((sum, part) => sum + part.amount, 0);
    const refundable = this.refundableAllocations(source);
    const issues = validateRefund(
      { kind: source.kind, allocations: refundable },
      { amount, parts },
    );
    if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(' '));

    const transaction: LedgerTransaction = {
      id: this.nextId('t'),
      kind: refundKindOf(source.kind),
      date,
      amount,
      allocations: refundAllocationsFor(refundable, parts).map((allocation) => ({
        ...allocation,
        id: this.nextId('a'),
      })),
      refundOf: { transactionId: sourceId, parts },
    };
    this.transactions.push(transaction);
    return transaction;
  }

  /** Finansal düzeltme: payları değiştirir; iadeli payların korunmasını denetler. */
  correct(id: string, allocations: (Omit<LedgerAllocation, 'id'> & { id?: string })[]): void {
    const transaction = this.get(id);
    const issues = validateAllocationChangesAgainstRefunds(
      this.refundableAllocations(transaction),
      allocations,
    );
    if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join(' '));
    transaction.allocations = allocations.map((allocation) => ({
      ...allocation,
      id: allocation.id ?? this.nextId('a'),
    }));
    transaction.amount = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  }

  get(id: string): LedgerTransaction {
    const transaction = this.transactions.find((candidate) => candidate.id === id);
    if (!transaction) throw new Error(`hareket yok: ${id}`);
    return transaction;
  }

  active(): LedgerTransaction[] {
    return this.transactions.filter((transaction) => !transaction.deleted);
  }

  refundedAmount(allocationId: string): number {
    return this.active()
      .flatMap((transaction) => transaction.refundOf?.parts ?? [])
      .filter((part) => part.allocationId === allocationId)
      .reduce((sum, part) => sum + part.amount, 0);
  }

  refundableAllocations(source: LedgerTransaction) {
    return source.allocations.map((allocation) => ({
      ...allocation,
      refundedAmount: this.refundedAmount(allocation.id),
    }));
  }

  /** Anlaşmaya bağlı aktif gelir/gider payları ve onların aktif iade toplamları. */
  balance(agreementId: string, currentAmount: number): AgreementBalance {
    const linked = this.active()
      .filter((transaction) => transaction.kind === 'income' || transaction.kind === 'expense')
      .flatMap((transaction) => transaction.allocations)
      .filter((allocation) => allocation.agreementId === agreementId)
      .map((allocation) => ({
        amount: allocation.amount,
        refundedAmount: this.refundedAmount(allocation.id),
      }));
    return computeAgreementBalance(currentAmount, linked);
  }
}
