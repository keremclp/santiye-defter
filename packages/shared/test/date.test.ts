import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareIsoDates,
  daysBetween,
  isIsoDate,
  monthKey,
  monthRange,
  todayInIstanbul,
} from '../src/index.js';

describe('isIsoDate', () => {
  it.each(['2026-10-12', '2024-02-29', '2000-02-29', '2026-12-31'])('%s geçerli', (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each([
    '2026-02-29',
    '2100-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-1-01',
    '2026-10-12T00:00:00Z',
    ' 2026-10-12',
    '',
    20261012,
    null,
  ])('%s geçersiz', (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe('todayInIstanbul', () => {
  it.each([
    ['2026-10-11T20:59:59Z', '2026-10-11'],
    ['2026-10-11T21:00:00Z', '2026-10-12'],
    ['2026-12-31T21:30:00Z', '2027-01-01'],
    ['2026-03-01T00:00:00Z', '2026-03-01'],
  ])('%s anında İstanbul günü %s', (instant, expected) => {
    expect(todayInIstanbul(new Date(instant))).toBe(expected);
  });
});

describe('compareIsoDates', () => {
  it('takvim sırasına göre karşılaştırır', () => {
    expect(compareIsoDates('2026-01-31', '2026-02-01')).toBe(-1);
    expect(compareIsoDates('2026-02-01', '2026-02-01')).toBe(0);
    expect(compareIsoDates('2027-01-01', '2026-12-31')).toBe(1);
  });

  it('geçersiz tarihi reddeder', () => {
    expect(() => compareIsoDates('2026-02-30', '2026-03-01')).toThrow(RangeError);
  });
});

describe('addDays ve daysBetween', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-01'],
    ['2024-02-28', 1, '2024-02-29'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-10-12', 30, '2026-11-11'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-10-12', 0, '2026-10-12'],
  ])('%s + %i gün = %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
    expect(daysBetween(date, expected)).toBe(days);
  });

  it('kesirli gün sayısını reddeder', () => {
    expect(() => addDays('2026-10-12', 1.5)).toThrow(RangeError);
  });

  it('önceki gün için negatif fark verir', () => {
    expect(daysBetween('2026-10-12', '2026-10-01')).toBe(-11);
  });
});

describe('ay yardımcıları', () => {
  it('monthKey', () => {
    expect(monthKey('2026-01-15')).toBe('2026-01');
  });

  it.each([
    ['2024-02-10', '2024-02-01', '2024-02-29'],
    ['2026-02-10', '2026-02-01', '2026-02-28'],
    ['2026-12-05', '2026-12-01', '2026-12-31'],
    ['2026-04-30', '2026-04-01', '2026-04-30'],
  ])('%s ayı: %s – %s', (date, from, to) => {
    expect(monthRange(date)).toEqual({ from, to });
  });
});
