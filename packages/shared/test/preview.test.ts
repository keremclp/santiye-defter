import { describe, expect, it } from 'vitest';
import { previewAgreementBalance, previewCashTotals } from '../src/index.js';

const tl = (lira: number) => lira * 100;
const emptyTotals = { income: 0, incomeRefund: 0, expense: 0, expenseRefund: 0 };

describe('previewAgreementBalance', () => {
  it('120.000 anlaşmaya bağlı 45.000 ödeme silinirse kalan 75.000 → 120.000, durum open', () => {
    const agreement = { currentAmount: tl(120_000), netSettled: tl(45_000) };
    expect(previewAgreementBalance(agreement, { netDelta: -tl(45_000) })).toEqual({
      netSettled: 0,
      remaining: tl(120_000),
      excess: 0,
      paymentStatus: 'open',
    });
  });

  it('geri yüklemede kalan aşılırsa fazla görünür', () => {
    const agreement = { currentAmount: tl(40_000), netSettled: tl(30_000) };
    expect(previewAgreementBalance(agreement, { netDelta: tl(15_000) })).toMatchObject({
      remaining: 0,
      excess: tl(5_000),
      paymentStatus: 'overpaid',
    });
  });

  it('iptal: kesin bedel 30.000, ödenen 45.000 → fazla 15.000; 15.000 iade → net 30.000, fazla 0', () => {
    const cancelled = previewAgreementBalance(
      { currentAmount: tl(120_000), netSettled: tl(45_000) },
      { currentAmount: tl(30_000) },
    );
    expect(cancelled).toMatchObject({ remaining: 0, excess: tl(15_000) });

    const refunded = previewAgreementBalance(
      { currentAmount: tl(30_000), netSettled: tl(45_000) },
      { netDelta: -tl(15_000) },
    );
    expect(refunded).toEqual({
      netSettled: tl(30_000),
      remaining: 0,
      excess: 0,
      paymentStatus: 'settled',
    });
  });

  it('değişiklik yoksa mevcut bakiye; net negatife düşemez', () => {
    const agreement = { currentAmount: tl(120_000), netSettled: tl(45_000) };
    expect(previewAgreementBalance(agreement, {})).toMatchObject({ remaining: tl(75_000) });
    expect(() => previewAgreementBalance(agreement, { netDelta: -tl(45_001) })).toThrow(RangeError);
  });
});

describe('previewCashTotals', () => {
  it('ocak 40.000 ödeme + şubat 10.000 ödeme iadesi → net 30.000', () => {
    const afterPayment = previewCashTotals(emptyTotals, {
      kind: 'expense',
      amount: tl(40_000),
      sign: 1,
    });
    const afterRefund = previewCashTotals(afterPayment, {
      kind: 'expense_refund',
      amount: tl(10_000),
      sign: 1,
    });
    expect(afterRefund).toMatchObject({ netExpense: tl(30_000), difference: -tl(30_000) });
  });

  it('gelir silinirse net tahsilat ve fark azalır', () => {
    const totals = { ...emptyTotals, income: tl(100_000), expense: tl(40_000) };
    expect(previewCashTotals(totals, { kind: 'income', amount: tl(25_000), sign: -1 })).toEqual({
      income: tl(75_000),
      incomeRefund: 0,
      expense: tl(40_000),
      expenseRefund: 0,
      netIncome: tl(75_000),
      netExpense: tl(40_000),
      difference: tl(35_000),
    });
  });
});
