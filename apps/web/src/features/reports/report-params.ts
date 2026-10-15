// Rapor ekranlarının parametreleri: URL'deki dönem seçimi ve toplam satırları.

import { monthRange, type CashTotals } from '@santiye/shared';

export const RANGE_DEFAULTS = { donem: 'tumu', baslangic: '', bitis: '' };
export type RangeFilters = typeof RANGE_DEFAULTS;

/** URL'deki dönem seçimi → API'nin `dateFrom` / `dateTo` parametreleri. */
export function rangeParams(filters: RangeFilters, today: string) {
  if (filters.donem === 'buay') {
    const range = monthRange(today);
    return { dateFrom: range.from, dateTo: range.to };
  }
  if (filters.donem === 'buyil') {
    const year = today.slice(0, 4);
    return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
  }
  if (filters.donem === 'aralik') {
    return {
      ...(filters.baslangic ? { dateFrom: filters.baslangic } : {}),
      ...(filters.bitis ? { dateTo: filters.bitis } : {}),
    };
  }
  return {};
}

export type TotalLine = { label: string; value: number };

export function cashLines(totals: CashTotals, side: 'both' | 'income' | 'expense'): TotalLine[] {
  const income = [
    { label: 'Tahsilat', value: totals.income },
    { label: 'Tahsilat iadesi', value: totals.incomeRefund },
    { label: 'Net tahsilat', value: totals.netIncome },
  ];
  const expense = [
    { label: 'Ödeme', value: totals.expense },
    { label: 'Ödeme iadesi', value: totals.expenseRefund },
    { label: 'Net ödeme', value: totals.netExpense },
  ];
  if (side === 'income') return income;
  if (side === 'expense') return expense;
  return [...income, ...expense, { label: 'Gelir − gider farkı', value: totals.difference }];
}
