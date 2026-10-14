// Belge testleri: örnek dosyalar ve tarayıcının yapacağı yüklemeyi taklit eden yardımcılar.

import sharp from 'sharp';
import type { Api } from './finance.js';

/** Gerçek, küçük bir PNG görsel. */
export function pngFile(width = 64, height = 48): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .png()
    .toBuffer();
}

/** İmzası PDF olan dosya; içerik doğrulanmaz, yalnız imza ve boyut. */
export function pdfFile(size = 2_000): Buffer {
  const body = Buffer.alloc(size, 0x20);
  body.write('%PDF-1.7\n', 0, 'latin1');
  return body;
}

/** HEIC `ftyp` kutusu taşıyan ama çözülemeyen dosya. */
export function brokenHeicFile(): Buffer {
  const body = Buffer.alloc(512, 0);
  body.writeUInt32BE(24, 0);
  body.write('ftypheic', 4, 'latin1');
  body.write('mif1heic', 16, 'latin1');
  return body;
}

/** İmzalı yükleme adresinden depo anahtarı (bellek içi depo adresi). */
export function keyOfUploadUrl(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

export interface OwnerRef {
  ownerType: 'transaction' | 'agreement';
  ownerId: string;
}

export function intentBody(
  owner: OwnerRef,
  file: Buffer,
  options: { fileName?: string; mimeType?: string; sizeBytes?: number } = {},
) {
  return {
    ...owner,
    fileName: options.fileName ?? 'fatura.png',
    mimeType: options.mimeType ?? 'image/png',
    sizeBytes: options.sizeBytes ?? file.length,
  };
}

/** Yükleme niyeti alır ve dosyayı imzalı adrese "yükler"; tamamlamaz. */
export async function startUpload(
  api: Api,
  owner: OwnerRef,
  file: Buffer,
  options: { fileName?: string; mimeType?: string; sizeBytes?: number } = {},
) {
  const intent = await api.ok(
    api.post('/documents/upload-intent', intentBody(owner, file, options)),
    201,
  );
  api.testApp.storage.upload(keyOfUploadUrl(intent.upload.url), file);
  return intent as { document: { id: string }; upload: { url: string } };
}

/** Yükle ve tamamla; tamamlanmış belgeyi döner. */
export async function addDocument(
  api: Api,
  owner: OwnerRef,
  file: Buffer,
  options: { fileName?: string; mimeType?: string; sizeBytes?: number } = {},
) {
  const intent = await startUpload(api, owner, file, options);
  return api.ok(api.post(`/documents/${intent.document.id}/complete`, {}, null));
}
