// İşlem listesi filtreleri (şartname 7.4): URL sorgusundaki Türkçe anahtarlar → API parametreleri.

import { monthRange, parseMoney, todayInIstanbul } from '@santiye/shared';

export const TRANSACTION_FILTER_DEFAULTS = {
  q: '',
  donem: 'buay',
  baslangic: '',
  bitis: '',
  tur: 'all',
  kapsam: '',
  kisi: '',
  muhatapsiz: '',
  kategori: '',
  bag: '',
  olusturan: '',
  tutarMin: '',
  tutarMax: '',
  silinen: '',
  sirala: 'newest',
  page: '1',
};

export type TransactionFilters = typeof TRANSACTION_FILTER_DEFAULTS;

function kurus(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const parsed = parseMoney(text);
  return parsed.ok ? parsed.value : undefined;
}

export function periodRange(
  filters: Pick<TransactionFilters, 'donem' | 'baslangic' | 'bitis'>,
  today = todayInIstanbul(),
): { dateFrom?: string; dateTo?: string } {
  if (filters.donem === 'bugun') return { dateFrom: today, dateTo: today };
  if (filters.donem === 'buay') {
    const range = monthRange(today);
    return { dateFrom: range.from, dateTo: range.to };
  }
  if (filters.donem === 'aralik') {
    return {
      ...(filters.baslangic ? { dateFrom: filters.baslangic } : {}),
      ...(filters.bitis ? { dateTo: filters.bitis } : {}),
    };
  }
  return {};
}

/** `GET /transactions` sorgusu. */
export function transactionQuery(filters: TransactionFilters, today = todayInIstanbul()) {
  const scope =
    filters.kapsam === 'genel'
      ? { scope: 'company' }
      : filters.kapsam
        ? { projectId: filters.kapsam.split(',').filter(Boolean) }
        : {};
  return {
    ...periodRange(filters, today),
    kind: filters.tur,
    ...scope,
    ...(filters.muhatapsiz === '1'
      ? { noParty: 'true' }
      : filters.kisi
        ? { partyId: filters.kisi }
        : {}),
    ...(filters.kategori === 'yok'
      ? { uncategorized: 'true' }
      : filters.kategori
        ? { categoryId: filters.kategori }
        : {}),
    ...(filters.bag === 'bagli' ? { agreementLink: 'linked' } : {}),
    ...(filters.bag === 'bagsiz' ? { agreementLink: 'unlinked' } : {}),
    ...(filters.olusturan ? { createdBy: filters.olusturan } : {}),
    amountMin: kurus(filters.tutarMin),
    amountMax: kurus(filters.tutarMax),
    ...(filters.silinen === '1' ? { includeDeleted: 'true' } : {}),
    ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
    sort: filters.sirala,
    page: Number(filters.page) || 1,
    limit: 50,
  };
}
