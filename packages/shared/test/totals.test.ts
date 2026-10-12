import { describe, expect, it } from 'vitest';
import { cashTotalsByMonth, computeCashTotals, type CashTransaction } from '../src/index.js';

const tl = (lira: number) => lira * 100;

const transactions: CashTransaction[] = [
  {
    kind: 'income',
    amount: tl(100_000),
    date: '2026-03-01',
    allocations: [{ scope: 'project', projectId: 'A', amount: tl(100_000) }],
  },
  {
    kind: 'expense',
    amount: tl(40_000),
    date: '2026-03-05',
    allocations: [
      { scope: 'project', projectId: 'A', amount: tl(25_000) },
      { scope: 'project', projectId: 'B', amount: tl(15_000) },
    ],
  },
  {
    kind: 'expense',
    amount: tl(5_000),
    date: '2026-03-31',
    allocations: [{ scope: 'company', amount: tl(5_000) }],
  },
  {
    kind: 'expense_refund',
    amount: tl(2_000),
    date: '2026-04-01',
    allocations: [{ scope: 'project', projectId: 'B', amount: tl(2_000) }],
  },
  {
    kind: 'income_refund',
    amount: tl(1_000),
    date: '2026-04-02',
    allocations: [{ scope: 'project', projectId: 'A', amount: tl(1_000) }],
  },
];

describe('computeCashTotals', () => {
  it('firma toplamı hareket tutarından; paylaştırılmış hareket bir kez', () => {
    expect(computeCashTotals(transactions)).toEqual({
      income: tl(100_000),
      incomeRefund: tl(1_000),
      expense: tl(45_000),
      expenseRefund: tl(2_000),
      netIncome: tl(99_000),
      netExpense: tl(43_000),
      difference: tl(56_000),
    });
  });

  it('şantiye toplamı yalnız o şantiyenin paylarından', () => {
    expect(
      computeCashTotals(transactions, { target: { scope: 'project', projectId: 'A' } }),
    ).toMatchObject({
      netIncome: tl(99_000),
      netExpense: tl(25_000),
      difference: tl(74_000),
    });
    expect(
      computeCashTotals(transactions, { target: { scope: 'project', projectId: 'B' } }),
    ).toMatchObject({
      netIncome: 0,
      netExpense: tl(13_000),
    });
  });

  it('firma geneli kayıtlar şantiyelere dağıtılmaz; şantiyeler + firma geneli = firma toplamı', () => {
    const company = computeCashTotals(transactions, { target: { scope: 'company' } });
    const a = computeCashTotals(transactions, { target: { scope: 'project', projectId: 'A' } });
    const b = computeCashTotals(transactions, { target: { scope: 'project', projectId: 'B' } });
    const all = computeCashTotals(transactions);

    expect(company.netExpense).toBe(tl(5_000));
    expect(a.netExpense + b.netExpense + company.netExpense).toBe(all.netExpense);
    expect(a.netIncome + b.netIncome + company.netIncome).toBe(all.netIncome);
  });

  it('tarih aralığı iki ucu da kapsar; iade kendi tarihine yazılır', () => {
    expect(computeCashTotals(transactions, { from: '2026-03-05', to: '2026-03-31' })).toMatchObject(
      {
        income: 0,
        netExpense: tl(45_000),
      },
    );
    expect(computeCashTotals(transactions, { from: '2026-04-01' })).toMatchObject({
      netIncome: -tl(1_000),
      netExpense: -tl(2_000),
      difference: tl(1_000),
    });
  });

  it('boş listede sıfırlar; fark negatif olabilir', () => {
    expect(computeCashTotals([]).difference).toBe(0);
    expect(
      computeCashTotals([
        {
          kind: 'expense',
          amount: 1,
          date: '2026-01-01',
          allocations: [{ scope: 'company', amount: 1 }],
        },
      ]).difference,
    ).toBe(-1);
  });

  it('kesirli tutarı reddeder', () => {
    expect(() =>
      computeCashTotals([
        {
          kind: 'income',
          amount: 0.5,
          date: '2026-01-01',
          allocations: [{ scope: 'company', amount: 0.5 }],
        },
      ]),
    ).toThrow(RangeError);
  });
});

describe('cashTotalsByMonth', () => {
  it('aylara ayırır ve artan sırada verir', () => {
    const months = cashTotalsByMonth([...transactions].reverse());
    expect(
      months.map((item) => [item.month, item.totals.netIncome, item.totals.netExpense]),
    ).toEqual([
      ['2026-03', tl(100_000), tl(45_000)],
      ['2026-04', -tl(1_000), -tl(2_000)],
    ]);
  });

  it('şantiye kapsamında payları kullanır', () => {
    expect(
      cashTotalsByMonth(transactions, { target: { scope: 'project', projectId: 'B' } }).map(
        (item) => item.totals.netExpense,
      ),
    ).toEqual([tl(15_000), -tl(2_000)]);
  });
});
