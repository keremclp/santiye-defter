// Görsel belgeler için küçük önizleme (şartname 2 ve 9.6). Orijinal dosya hiç değişmez; önizleme
// ayrı bir JPEG olarak saklanır. PDF için önizleme üretilmez; orijinal açılır.

import type { DocumentMimeType } from '@santiye/shared';
import convertHeic from 'heic-convert';
import sharp from 'sharp';

export const PREVIEW_MAX_SIDE = 1600;
export const PREVIEW_MIME_TYPE = 'image/jpeg';

const WHITE = { r: 255, g: 255, b: 255 };

export function hasPreview(mimeType: DocumentMimeType): boolean {
  return mimeType !== 'application/pdf';
}

/** Önizleme JPEG'i; dosya bozuksa hata atar. */
export async function createPreview(original: Buffer, mimeType: DocumentMimeType): Promise<Buffer> {
  // sharp'ın hazır derlemesi HEIC çözemez; önce JPEG'e çevrilir.
  const input =
    mimeType === 'image/heic' || mimeType === 'image/heif'
      ? Buffer.from(await convertHeic({ buffer: original, format: 'JPEG', quality: 0.92 }))
      : original;
  return sharp(input)
    .rotate()
    .resize({
      width: PREVIEW_MAX_SIDE,
      height: PREVIEW_MAX_SIDE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: WHITE })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
}
