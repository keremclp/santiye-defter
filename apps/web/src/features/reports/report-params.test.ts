import { describe, expect, it } from 'vitest';
import {
  TRANSACTION_FILTER_DEFAULTS,
  transactionExportQuery,
  transactionQuery,
} from '../transactions/transaction-filters';
import { cashLines, RANGE_DEFAULTS, rangeParams } from './report-params';

describe('rapor dönem parametreleri', () => {
  const today = '2026-10-15';

  it.each([
    ['buay', { dateFrom: '2026-10-01', dateTo: '2026-10-31' }],
    ['buyil', { dateFrom: '2026-01-01', dateTo: '2026-12-31' }],
    ['tumu', {}],
  ])('%s', (donem, expected) => {
    expect(rangeParams({ ...RANGE_DEFAULTS, donem }, today)).toEqual(expected);
  });

  it('aralıkta yalnız girilen uçlar gönderilir', () => {
    expect(rangeParams({ donem: 'aralik', baslangic: '2026-02-01', bitis: '' }, today)).toEqual({
      dateFrom: '2026-02-01',
    });
  });
});

describe('Bu sonuçları indir', () => {
  it('liste ile aynı filtreler, sayfa ve sayfa boyutu olmadan', () => {
    const filters = { ...TRANSACTION_FILTER_DEFAULTS, kapsam: 'p1', tur: 'expense', page: '3' };
    const list = transactionQuery(filters, '2026-10-15');
    const exported = transactionExportQuery(filters, '2026-10-15');
    expect(exported).not.toHaveProperty('page');
    expect(exported).not.toHaveProperty('limit');
    expect(exported).toEqual(
      Object.fromEntries(Object.entries(list).filter(([key]) => key !== 'page' && key !== 'limit')),
    );
  });
});

describe('toplam satırları', () => {
  it('gelir, gider ve fark ayrı; değerler API toplamlarından', () => {
    const totals = {
      income: 6_000_000,
      incomeRefund: 0,
      expense: 8_500_000,
      expenseRefund: 1_000_000,
      netIncome: 6_000_000,
      netExpense: 7_500_000,
      difference: -1_500_000,
    };
    expect(cashLines(totals, 'expense').map((line) => line.value)).toEqual([
      8_500_000, 1_000_000, 7_500_000,
    ]);
    expect(cashLines(totals, 'both').at(-1)).toEqual({
      label: 'Gelir − gider farkı',
      value: -1_500_000,
    });
  });
});
