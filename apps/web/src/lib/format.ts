// Gösterim biçimleri (şartname 3, 4.4). Para kuruştan `packages/shared` fonksiyonlarıyla biçimlenir.

import { BUSINESS_TIME_ZONE, formatMoney, formatMoneyWhole, formatTl } from '@santiye/shared';

export { formatMoney, formatMoneyWhole, formatTl };

/**
 * Bakiye ve fark gösterimi: negatifse "−" (eksi işareti) önekli, rengi `ink` (şartname 4.1).
 * `whole` özet kutularında kuruşsuz biçimdir.
 */
export function formatSigned(kurus: number, whole = false): string {
  const text = (whole ? formatMoneyWhole : formatMoney)(Math.abs(kurus));
  return kurus < 0 ? `−${text}` : text;
}

const shortDate = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const longDate = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const dateTime = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: BUSINESS_TIME_ZONE,
});

/** İş tarihi (YYYY-MM-DD) → "13 Eki 2026"; saat dilimi kayması olmaz. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return shortDate.format(new Date(`${date}T00:00:00Z`));
}

/** İş tarihi → "13 Ekim 2026". */
export function formatLongDate(date: string | null | undefined): string {
  if (!date) return '—';
  return longDate.format(new Date(`${date}T00:00:00Z`));
}

/** Sistem zamanı (ISO UTC) → İstanbul saatiyle "13 Eki 2026 14:05". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return dateTime.format(new Date(iso));
}

const bytesFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${bytesFormat.format(value)} ${units[unit]}`;
}
