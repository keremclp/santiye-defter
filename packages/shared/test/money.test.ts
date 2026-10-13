import { describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyWhole, formatTl, isKurus, parseMoney } from '../src/index.js';

const MAX = Number.MAX_SAFE_INTEGER;

describe('parseMoney', () => {
  it.each([
    ['12500', 1_250_000],
    ['12.500,50', 1_250_050],
    ['12500,50', 1_250_050],
    ['12500,5', 1_250_050],
    ['12.500', 1_250_000],
    ['1.234.567,89', 123_456_789],
    ['0,01', 1],
    ['0,1', 10],
    ['0', 0],
    ['0,00', 0],
    ['  45.000  ', 4_500_000],
    ['90.071.992.547.409,91', MAX],
  ])('"%s" → %i kuruş', (input, expected) => {
    expect(parseMoney(input)).toEqual({ ok: true, value: expected });
  });

  it('virgülden sonra üç hane yuvarlanmaz, reddedilir', () => {
    expect(parseMoney('12,345')).toEqual({
      ok: false,
      message: 'En fazla iki ondalık girilebilir.',
    });
    expect(parseMoney('0,001')).toEqual({
      ok: false,
      message: 'En fazla iki ondalık girilebilir.',
    });
  });

  it.each(['12.5', '1.25', '0.50'])(
    'noktayı ondalık sanılan "%s" reddedilir ve virgül önerilir',
    (input) => {
      expect(parseMoney(input)).toEqual({
        ok: false,
        message: 'Ondalık için virgül kullanın. Örnek: 12.500,50',
      });
    },
  );

  it.each([
    'abc',
    '-5',
    '+5',
    '1,2,3',
    '12,',
    ',5',
    '12 500',
    '1e3',
    '12.500.5',
    '1.2345',
    '12.50,00',
    '1.00.000',
    '₺12',
  ])('"%s" geçersiz', (input) => {
    expect(parseMoney(input)).toEqual({
      ok: false,
      message: 'Tutar geçerli değil. Örnek: 12.500,50',
    });
  });

  it('boş girdi', () => {
    expect(parseMoney('   ')).toEqual({ ok: false, message: 'Tutar girin.' });
  });

  it('güvenli tamsayı sınırını aşan tutar reddedilir', () => {
    expect(parseMoney('90.071.992.547.409,92')).toEqual({ ok: false, message: 'Tutar çok büyük.' });
  });
});

describe('formatMoney', () => {
  it.each([
    [1_250_050, '₺12.500,50'],
    [0, '₺0,00'],
    [1, '₺0,01'],
    [99, '₺0,99'],
    [100, '₺1,00'],
    [1_999, '₺19,99'],
    [-39_000_000, '-₺390.000,00'],
    [MAX, '₺90.071.992.547.409,91'],
  ])('%i → %s', (kurus, expected) => {
    expect(formatMoney(kurus)).toBe(expected);
  });

  it('tamsayı olmayan kuruşu reddeder', () => {
    expect(() => formatMoney(12.5)).toThrow(RangeError);
    expect(() => formatMoney(MAX + 1)).toThrow(RangeError);
  });
});

describe('formatMoneyWhole', () => {
  it.each([
    [15_000_000, '₺150.000'],
    [1_250_049, '₺12.500'],
    [1_250_050, '₺12.501'],
    [0, '₺0'],
    [-3_450_000, '-₺34.500'],
  ])('%i → %s', (kurus, expected) => {
    expect(formatMoneyWhole(kurus)).toBe(expected);
  });

  it('tamsayı olmayan kuruşu reddeder', () => {
    expect(() => formatMoneyWhole(0.5)).toThrow(RangeError);
  });
});

describe('formatTl', () => {
  it.each([
    [4_000_000, '40.000 TL'],
    [1_250_050, '12.500,50 TL'],
    [1_250_005, '12.500,05 TL'],
    [1, '0,01 TL'],
    [0, '0 TL'],
    [-1_000_000, '-10.000 TL'],
  ])('%i → %s', (kurus, expected) => {
    expect(formatTl(kurus)).toBe(expected);
  });

  it.each([1, 99, 100, 1_250_050, 123_456_789, MAX])('%i biçimlenip geri okunur', (kurus) => {
    expect(parseMoney(formatTl(kurus).replace(' TL', ''))).toEqual({ ok: true, value: kurus });
  });
});

describe('isKurus', () => {
  it('yalnız güvenli tamsayıları kabul eder', () => {
    expect(isKurus(100)).toBe(true);
    expect(isKurus(-100)).toBe(true);
    expect(isKurus(1.5)).toBe(false);
    expect(isKurus(MAX + 1)).toBe(false);
    expect(isKurus('100')).toBe(false);
  });
});
