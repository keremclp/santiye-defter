// Gerçekleşen tahsilat/ödeme toplamları (şartname 9.1).

import { compareIsoDates, monthKey } from '../date.js';
import type { Scope, TransactionKind } from '../domain.js';
import { assertKurus } from '../money.js';

/** Silinmemiş bir para hareketi; silinen hareketler toplamlara verilmez. */
export interface CashTransaction {
  kind: TransactionKind;
  amount: number;
  date: string;
  allocations: readonly { scope: Scope; projectId?: string | null; amount: number }[];
}

export interface CashTotals {
  income: number;
  incomeRefund: number;
  expense: number;
  expenseRefund: number;
  /** Tahsilatlar − tahsilat iadeleri */
  netIncome: number;
  /** Ödemeler − ödeme iadeleri */
  netExpense: number;
  /** Tahsilat − ödeme; "kâr" veya "kasa" değildir */
  difference: number;
}

/**
 * Toplam kapsamı. Verilmezse firma toplamı hareket tutarından hesaplanır ve paylaştırılmış
 * hareket bir kez sayılır. Şantiye veya firma geneli seçilirse yalnız o kapsamın payları toplanır.
 */
export type TotalsTarget = { scope: 'project'; projectId: string } | { scope: 'company' };

export interface TotalsOptions {
  target?: TotalsTarget;
  /** İşlem tarihine göre, iki uç dahil */
  from?: string;
  to?: string;
}

function amountFor(transaction: CashTransaction, target: TotalsTarget | undefined): number {
  if (!target) return transaction.amount;
  return transaction.allocations
    .filter((allocation) =>
      target.scope === 'project'
        ? allocation.scope === 'project' && allocation.projectId === target.projectId
        : allocation.scope === 'company',
    )
    .reduce((sum, allocation) => sum + allocation.amount, 0);
}

function inRange(date: string, from?: string, to?: string): boolean {
  if (from && compareIsoDates(date, from) < 0) return false;
  if (to && compareIsoDates(date, to) > 0) return false;
  return true;
}

function emptyTotals(): CashTotals {
  return {
    income: 0,
    incomeRefund: 0,
    expense: 0,
    expenseRefund: 0,
    netIncome: 0,
    netExpense: 0,
    difference: 0,
  };
}

function add(totals: CashTotals, kind: TransactionKind, amount: number): void {
  if (kind === 'income') totals.income += amount;
  else if (kind === 'income_refund') totals.incomeRefund += amount;
  else if (kind === 'expense') totals.expense += amount;
  else totals.expenseRefund += amount;
  Object.assign(totals, cashTotalsFromSums(totals));
}

/**
 * Türe göre toplanmış tutarlardan net tahsilat, net ödeme ve farkı hesaplar. Veritabanında
 * türe göre toplanan tutarlar bu fonksiyondan geçer; formül API'de yeniden yazılmaz.
 */
export function cashTotalsFromSums(
  sums: Pick<CashTotals, 'income' | 'incomeRefund' | 'expense' | 'expenseRefund'>,
): CashTotals {
  for (const value of Object.values(sums)) assertKurus(value);
  const netIncome = sums.income - sums.incomeRefund;
  const netExpense = sums.expense - sums.expenseRefund;
  return {
    income: sums.income,
    incomeRefund: sums.incomeRefund,
    expense: sums.expense,
    expenseRefund: sums.expenseRefund,
    netIncome,
    netExpense,
    difference: netIncome - netExpense,
  };
}

/** Dönem toplamı: her hareket, iade de dahil, kendi işlem tarihinin dönemine yazılır. */
export function computeCashTotals(
  transactions: readonly CashTransaction[],
  options: TotalsOptions = {},
): CashTotals {
  const totals = emptyTotals();
  for (const transaction of transactions) {
    assertKurus(transaction.amount);
    if (!inRange(transaction.date, options.from, options.to)) continue;
    add(totals, transaction.kind, amountFor(transaction, options.target));
  }
  return totals;
}

/** Aylık toplamlar, ay anahtarına ("YYYY-MM") göre artan sırada. */
export function cashTotalsByMonth(
  transactions: readonly CashTransaction[],
  options: Pick<TotalsOptions, 'target'> = {},
): { month: string; totals: CashTotals }[] {
  const months = new Map<string, CashTotals>();
  for (const transaction of transactions) {
    assertKurus(transaction.amount);
    const key = monthKey(transaction.date);
    const totals = months.get(key) ?? emptyTotals();
    add(totals, transaction.kind, amountFor(transaction, options.target));
    months.set(key, totals);
  }
  return [...months]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, totals]) => ({ month, totals }));
}
