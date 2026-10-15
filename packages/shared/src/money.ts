// Para kuruş cinsinden tamsayıdır (şartname bölüm 3). Bu dosyada kayan noktalı hesap yapılmaz.

export function isKurus(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertKurus(value: number, name = 'tutar'): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} kuruş cinsinden tamsayı olmalı: ${String(value)}`);
  }
}

export type ParseMoneyResult = { ok: true; value: number } | { ok: false; message: string };

// Tam kısım: binlik ayraçsız rakamlar veya nokta ile üçlü gruplar (12500 / 12.500).
const INTEGER_PART = /^(?:\d+|\d{1,3}(?:\.\d{3})+)$/;
const DOT_AS_DECIMAL = /^\d+\.\d{1,2}$/;
const MAX_KURUS = BigInt(Number.MAX_SAFE_INTEGER);

function invalid(message: string): ParseMoneyResult {
  return { ok: false, message };
}

/**
 * tr-TR biçimli TL metnini kuruşa çevirir: "12500" → 1250000, "12.500,50" → 1250050.
 * Nokta yalnız binlik ayracı, virgül ondalık ayracıdır; en fazla iki ondalık kabul edilir.
 * Negatif tutar ve başka biçimler reddedilir. Sıfır geçerlidir; pozitiflik şemada denetlenir.
 */
export function parseMoney(input: string): ParseMoneyResult {
  const text = input.trim();
  if (text === '') return invalid('Tutar girin.');

  const parts = text.split(',');
  if (parts.length > 2) return invalid('Tutar geçerli değil. Örnek: 12.500,50');
  const [integerPart = '', fractionPart] = parts;

  if (!INTEGER_PART.test(integerPart)) {
    if (fractionPart === undefined && DOT_AS_DECIMAL.test(integerPart)) {
      return invalid('Ondalık için virgül kullanın. Örnek: 12.500,50');
    }
    return invalid('Tutar geçerli değil. Örnek: 12.500,50');
  }

  if (fractionPart !== undefined) {
    if (/^\d{3,}$/.test(fractionPart)) return invalid('En fazla iki ondalık girilebilir.');
    if (!/^\d{1,2}$/.test(fractionPart)) return invalid('Tutar geçerli değil. Örnek: 12.500,50');
  }

  const kurus =
    BigInt(integerPart.replaceAll('.', '')) * 100n + BigInt((fractionPart ?? '').padEnd(2, '0'));
  if (kurus > MAX_KURUS) return invalid('Tutar çok büyük.');

  return { ok: true, value: Number(kurus) };
}

/**
 * Kuruşu ondalık metne çevirir: 1250050 → "12500.50", -500 → "-5.00". Intl'e ve dosya çıktılarına
 * sayı yerine bu metin verilir; böylece biçimleme de kayan noktaya düşmez.
 */
export function kurusToDecimalString(kurus: number): string {
  assertKurus(kurus);
  const sign = kurus < 0 ? '-' : '';
  const abs = Math.abs(kurus);
  const fraction = abs % 100;
  const lira = (abs - fraction) / 100;
  return `${sign}${lira}.${String(fraction).padStart(2, '0')}`;
}

const currencyFormat = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
const currencyWholeFormat = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const wholeFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
const fractionFormat = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Ekran gösterimi (şartname 4.4): 1250050 → "₺12.500,50". */
export function formatMoney(kurus: number): string {
  return currencyFormat.format(kurusToDecimalString(kurus) as Intl.StringNumericLiteral);
}

/** Özet kutularındaki kuruşsuz gösterim (şartname 4.4): 1250050 → "₺12.501" (yarım yukarı). */
export function formatMoneyWhole(kurus: number): string {
  return currencyWholeFormat.format(kurusToDecimalString(kurus) as Intl.StringNumericLiteral);
}

/** Mesaj metinlerindeki biçim (şartname 7.4, 7.5): 4000000 → "40.000 TL", 1250050 → "12.500,50 TL". */
export function formatTl(kurus: number): string {
  const value = kurusToDecimalString(kurus) as Intl.StringNumericLiteral;
  const text = kurus % 100 === 0 ? wholeFormat.format(value) : fractionFormat.format(value);
  return `${text} TL`;
}
