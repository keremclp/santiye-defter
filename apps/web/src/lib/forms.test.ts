import { describe, expect, it } from 'vitest';
import { kurusToInput, moneyText, toKurus } from './forms';
import { formatMoneyInput } from './money-input';

describe('formatMoneyInput: yazarken binlik ayracı', () => {
  it.each([
    ['12500', '12.500'],
    ['1250000', '1.250.000'],
    ['12500,5', '12.500,5'],
    ['1.2500', '12.500'],
    ['0012', '12'],
    ['12.500,50', '12.500,50'],
    ['₺ 40000', '40.000'],
  ])('%s → %s', (input, expected) => {
    expect(formatMoneyInput(input)).toBe(expected);
  });

  it('binlik grubuna uymayan noktalı girdiyi değiştirmez; doğrulama uyarır', () => {
    expect(formatMoneyInput('12.5')).toBe('12.5');
    const result = moneyText().safeParse('12.5');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('Ondalık için virgül kullanın');
  });
});

describe('moneyText ve kuruş dönüşümü', () => {
  it('kuruşa kayan nokta olmadan çevrilir', () => {
    expect(toKurus('12.500,50')).toBe(1_250_050);
    expect(toKurus('12500')).toBe(1_250_000);
    expect(toKurus('')).toBeNull();
  });

  it('boş, sıfır ve üç ondalık reddedilir', () => {
    expect(moneyText().safeParse('').error?.issues[0]?.message).toBe('Tutar girin.');
    expect(moneyText().safeParse('0').error?.issues[0]?.message).toBe('Tutar 0’dan büyük olmalı.');
    expect(moneyText().safeParse('1,555').success).toBe(false);
    expect(moneyText({ allowZero: true }).safeParse('0').success).toBe(true);
  });

  it('kuruştan form metnine', () => {
    expect(kurusToInput(1_250_050)).toBe('12.500,50');
    expect(kurusToInput(4_000_000)).toBe('40.000');
  });
});
