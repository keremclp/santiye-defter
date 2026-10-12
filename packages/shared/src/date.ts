// İş tarihleri `YYYY-MM-DD` metnidir; "bugün" Europe/Istanbul gününe göre hesaplanır (şartname bölüm 3).

export const BUSINESS_TIME_ZONE = 'Europe/Istanbul';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parts(date: string): [number, number, number] {
  const match = ISO_DATE.exec(date);
  if (!match || !isIsoDate(date)) throw new RangeError(`Geçersiz tarih: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Takvimde var olan bir günü gösteren `YYYY-MM-DD` metni mi? */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

const istanbulDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Verilen andaki İstanbul günü. */
export function todayInIstanbul(now: Date = new Date()): string {
  const values = Object.fromEntries(
    istanbulDateFormat.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function compareIsoDates(a: string, b: string): -1 | 0 | 1 {
  parts(a);
  parts(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

function toEpochDay(date: string): number {
  const [year, month, day] = parts(date);
  const utc = new Date(0);
  utc.setUTCFullYear(year, month - 1, day);
  return Math.round(utc.getTime() / MS_PER_DAY);
}

function fromEpochDay(epochDay: number): string {
  const utc = new Date(epochDay * MS_PER_DAY);
  const year = String(utc.getUTCFullYear()).padStart(4, '0');
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: string, days: number): string {
  if (!Number.isInteger(days)) throw new RangeError(`Gün sayısı tamsayı olmalı: ${days}`);
  return fromEpochDay(toEpochDay(date) + days);
}

/** `from` gününden `to` gününe kaç gün var; `to` önceyse negatif. */
export function daysBetween(from: string, to: string): number {
  return toEpochDay(to) - toEpochDay(from);
}

/** "2026-01-15" → "2026-01" */
export function monthKey(date: string): string {
  parts(date);
  return date.slice(0, 7);
}

/** Tarihin içinde bulunduğu ayın ilk ve son günü. */
export function monthRange(date: string): { from: string; to: string } {
  const [year, month] = parts(date);
  const prefix = date.slice(0, 7);
  return {
    from: `${prefix}-01`,
    to: `${prefix}-${String(daysInMonth(year, month)).padStart(2, '0')}`,
  };
}
