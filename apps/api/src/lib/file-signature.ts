// Dosya türü, istemcinin bildirdiği türe değil dosyanın ilk baytlarına (imza) göre belirlenir
// (şartname 8.8).

import type { DocumentMimeType } from '@santiye/shared';

/** İmzayı tanımak için okunan bayt sayısı. */
export const SIGNATURE_BYTES = 64;

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs']);
const HEIF_BRANDS = new Set(['mif1', 'msf1', 'heif']);
const AVIF_BRANDS = new Set(['avif', 'avis']);

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

const ascii = (bytes: Uint8Array, start: number, end: number) =>
  String.fromCharCode(...bytes.subarray(start, end));

/** ISO-BMFF `ftyp` kutusundaki ana ve uyumlu markalar. */
function ftypBrands(bytes: Uint8Array): string[] | null {
  if (bytes.length < 16 || ascii(bytes, 4, 8) !== 'ftyp') return null;
  const boxSize = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  const end = Math.min(boxSize, bytes.length);
  const brands = [ascii(bytes, 8, 12)];
  for (let offset = 16; offset + 4 <= end; offset += 4)
    brands.push(ascii(bytes, offset, offset + 4));
  return brands;
}

/** Desteklenen türlerden biriyse onun MIME türü; değilse null. */
export function detectDocumentType(bytes: Uint8Array): DocumentMimeType | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';

  const brands = ftypBrands(bytes);
  if (!brands || brands.some((brand) => AVIF_BRANDS.has(brand))) return null;
  if (brands.some((brand) => HEIC_BRANDS.has(brand))) return 'image/heic';
  if (brands.some((brand) => HEIF_BRANDS.has(brand))) return 'image/heif';
  return null;
}
