// Tam kısım binlik gruplarına uyuyorsa (veya hiç nokta yoksa) yazarken yeniden gruplanır.
const GROUPED_PREFIX = /^\d{1,3}(?:\.\d{3})*\d*$/;

/**
 * Yazarken binlik ayracı ekler: "12500" → "12.500", "12500,5" → "12.500,5".
 * Binlik grubuna uymayan noktalı girdi ("12.5") olduğu gibi bırakılır; doğrulama
 * "Ondalık için virgül kullanın" der (şartname 3 "Para", 11).
 */
export function formatMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const parts = cleaned.split(',');
  if (parts.length > 2) return cleaned;
  const [integerPart = '', fraction] = parts;
  if (integerPart !== '' && !GROUPED_PREFIX.test(integerPart)) return cleaned;
  const digits = integerPart.replaceAll('.', '').replace(/^0+(?=\d)/, '');
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}
