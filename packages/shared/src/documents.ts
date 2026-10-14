// Belge sınırları ve yükleme niyeti şeması (şartname 8.8, 9.6, 10.8).

import { z } from 'zod';
import { objectIdSchema } from './schemas.js';

/** Dosya başına üst sınır: 20 MB. */
export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
/** İşlem veya anlaşma başına en fazla belge. */
export const DOCUMENT_LIMIT_PER_RECORD = 10;

export const DOCUMENT_OWNER_TYPES = ['transaction', 'agreement'] as const;
export type DocumentOwnerType = (typeof DOCUMENT_OWNER_TYPES)[number];

export const DOCUMENT_STATUSES = ['pending', 'uploaded', 'failed', 'expired'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Desteklenen türler: PDF, JPEG, PNG, WEBP, HEIC/HEIF. */
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_TYPES)[number];

export const UNSUPPORTED_DOCUMENT_MESSAGE =
  'Bu dosya türü desteklenmiyor. PDF, JPEG, PNG, WEBP veya HEIC yükleyin.';
export const DOCUMENT_TOO_LARGE_MESSAGE = 'Dosya en fazla 20 MB olabilir.';

/** Dosya adı yol ve kontrol karakterlerinden arındırılır. */
export function cleanFileName(value: string): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .split(/[\\/]/)
      .pop()!
      .trim()
      .slice(0, 200)
  );
}

export const documentUploadIntentSchema = z.object({
  ownerType: z.enum(DOCUMENT_OWNER_TYPES, 'Belgenin bağlanacağı kayıt türü geçersiz.'),
  ownerId: objectIdSchema,
  fileName: z.string().transform(cleanFileName).pipe(z.string().min(1, 'Dosya adı gerekli.')),
  mimeType: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(DOCUMENT_MIME_TYPES, UNSUPPORTED_DOCUMENT_MESSAGE)),
  sizeBytes: z.number().int('Dosya boyutu geçersiz.').positive('Dosya boş olamaz.'),
});

export type DocumentUploadIntentInput = z.infer<typeof documentUploadIntentSchema>;
