// Etki önizlemeleri (şartname 4.4): silme, geri yükleme, iade ve düzeltme kaydedilmeden önce
// "önce → sonra" değerleri. Formüller burada kalır; web yeniden yazmaz.

import type { TransactionKind } from '../domain.js';
import { assertKurus } from '../money.js';
import { computeAgreementBalance, type AgreementBalance } from './agreement.js';
import { cashTotalsFromSums, type CashTotals } from './totals.js';

/**
 * Anlaşmanın net ödenen/tahsil edilen tutarı `netDelta` kadar değişirse (ve/veya bedeli
 * `currentAmount` olursa) yeni kalan, fazla ve ödeme durumu.
 */
export function previewAgreementBalance(
  agreement: { currentAmount: number; netSettled: number },
  change: { netDelta?: number; currentAmount?: number },
): AgreementBalance {
  const netDelta = change.netDelta ?? 0;
  assertKurus(netDelta, 'net değişim');
  const net = agreement.netSettled + netDelta;
  if (net < 0) throw new RangeError('Net ödenen/tahsil edilen negatif olamaz');
  return computeAgreementBalance(
    change.currentAmount ?? agreement.currentAmount,
    net > 0 ? [{ amount: net, refundedAmount: 0 }] : [],
  );
}

/** Bir hareket toplamlara eklenirse (`sign` 1) veya çıkarılırsa (−1) toplamların yeni hali. */
export function previewCashTotals(
  totals: Pick<CashTotals, 'income' | 'incomeRefund' | 'expense' | 'expenseRefund'>,
  change: { kind: TransactionKind; amount: number; sign: 1 | -1 },
): CashTotals {
  assertKurus(change.amount);
  const delta = change.amount * change.sign;
  return cashTotalsFromSums({
    income: totals.income + (change.kind === 'income' ? delta : 0),
    incomeRefund: totals.incomeRefund + (change.kind === 'income_refund' ? delta : 0),
    expense: totals.expense + (change.kind === 'expense' ? delta : 0),
    expenseRefund: totals.expenseRefund + (change.kind === 'expense_refund' ? delta : 0),
  });
}
