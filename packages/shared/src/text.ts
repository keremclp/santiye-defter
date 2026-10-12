// Arama için Türkçe karakter katlama (şartname 7.4, 7.8, 9.9).

const FOLD_MAP: Record<string, string> = {
  ı: 'i',
  ş: 's',
  ğ: 'g',
  ü: 'u',
  ö: 'o',
  ç: 'c',
};

/**
 * Türkçe kurallarla küçük harfe çevirir, Türkçe ve diğer aksanlı harfleri sadeleştirir,
 * boşlukları tekleştirir: "KADIKÖY  Villa" → "kadikoy villa". Arama hem kayıt hem sorguda aynı
 * katlamayla yapılır; böylece büyük/küçük harf ve ı/i, ş/s farkı eşleşmeyi engellemez.
 */
export function foldTurkish(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/[ışğüöç]/g, (char) => FOLD_MAP[char] ?? char)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
