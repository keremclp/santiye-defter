// Belge yükleme (şartname 9.6, 9.7, 10.8; karar 10.13):
// niyet (Idempotency-Key ile) → dosyayı imzalı adrese doğrudan PUT → tamamlama. Bir adım
// başarısız olursa yeniden deneme kaldığı yerden sürer; bağlı finansal kayıt tekrar oluşturulmaz.

import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  DOCUMENT_TOO_LARGE_MESSAGE,
  UNSUPPORTED_DOCUMENT_MESSAGE,
  type DocumentMimeType,
  type DocumentOwnerType,
} from '@santiye/shared';
import axios from 'axios';
import { apiPost, isApiError, NETWORK_ERROR_MESSAGE } from '../../api/client';
import { newIdempotencyKey } from '../../api/submission';
import type { DocumentInfo, UploadIntent } from '../../api/types';

/** İmzalı adrese yükleme; uygulama oturum başlığı bu isteğe eklenmez. */
export const storageHttp = axios.create({ timeout: 120_000 });

export interface DocumentOwner {
  ownerType: DocumentOwnerType;
  ownerId: string;
}

const EXTENSION_TYPES: Record<string, DocumentMimeType> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/**
 * Dosyanın bildirilecek türü. Tarayıcı türü vermezse (ör. bazı cihazlarda HEIC) uzantıya bakılır.
 * Asıl tür sunucuda dosyanın ilk baytlarından belirlenir.
 */
export function mimeTypeOf(file: File): DocumentMimeType | null {
  const type = file.type.toLowerCase();
  if ((DOCUMENT_MIME_TYPES as readonly string[]).includes(type)) return type as DocumentMimeType;
  if (type === 'image/jpg') return 'image/jpeg';
  if (type !== '' && type !== 'application/octet-stream') return null;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPES[extension] ?? null;
}

/** Göndermeden önce reddedilen dosyanın nedeni; uygunsa null. */
export function fileProblem(file: File, mimeType: DocumentMimeType | null): string | null {
  if (!mimeType) return UNSUPPORTED_DOCUMENT_MESSAGE;
  if (file.size === 0) return 'Dosya boş olamaz.';
  if (file.size > DOCUMENT_MAX_BYTES) return DOCUMENT_TOO_LARGE_MESSAGE;
  return null;
}

export class UploadFailure extends Error {
  constructor(
    message: string,
    /** Aynı dosyayla yeniden denemek anlamlı mı (ör. bağlantı hatası evet, desteklenmeyen tür hayır). */
    readonly retryable: boolean,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'UploadFailure';
  }
}

const PUT_FAILED_MESSAGE = 'Dosya yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.';

function toFailure(error: unknown, putStep: boolean): UploadFailure {
  if (error instanceof UploadFailure) return error;
  if (isApiError(error)) {
    if (error.isNetwork) return new UploadFailure(NETWORK_ERROR_MESSAGE, true);
    const final =
      error.message === UNSUPPORTED_DOCUMENT_MESSAGE ||
      error.message === DOCUMENT_TOO_LARGE_MESSAGE;
    return new UploadFailure(error.message, !final, error.code);
  }
  return new UploadFailure(putStep ? PUT_FAILED_MESSAGE : NETWORK_ERROR_MESSAGE, true);
}

export interface UploadCallbacks {
  /** Yükleme niyeti alındı; sunucudaki belge kimliği belli oldu. */
  onDocument?: (documentId: string) => void;
  /** Dosya gönderim oranı (0–1). */
  onProgress?: (ratio: number) => void;
}

export interface Uploader {
  readonly done: boolean;
  run: (owner: DocumentOwner, callbacks?: UploadCallbacks) => Promise<DocumentInfo>;
}

/**
 * Tek dosyanın yükleyicisi. Aynı niyetin tekrarında aynı anahtar kullanılır (sunucu aynı bekleyen
 * belgeyi ve yeni imzalı adresi döner, ikinci yer ayırmaz); kesin retten sonra yeni anahtar üretilir.
 */
export function createUploader(file: File, mimeType: DocumentMimeType): Uploader {
  let key = newIdempotencyKey();
  let stage: 'intent' | 'complete' | 'done' = 'intent';
  let documentId: string | null = null;

  const intent = async (owner: DocumentOwner) => {
    try {
      return await apiPost<UploadIntent>(
        '/documents/upload-intent',
        { ...owner, fileName: file.name, mimeType, sizeBytes: file.size },
        { idempotencyKey: key },
      );
    } catch (error) {
      if (isApiError(error) && !error.isNetwork) key = newIdempotencyKey();
      throw error;
    }
  };

  async function run(owner: DocumentOwner, callbacks: UploadCallbacks = {}) {
    let putStep = false;
    try {
      if (stage === 'intent') {
        let result = await intent(owner);
        if (result.document.status === 'uploaded') {
          stage = 'done';
          return result.document;
        }
        if (!result.upload) {
          // Önceki deneme süresi dolmuş veya başarısız olmuş: yeni bir yükleme açılır.
          key = newIdempotencyKey();
          result = await intent(owner);
        }
        if (!result.upload) throw new UploadFailure(PUT_FAILED_MESSAGE, true);
        documentId = result.document.id;
        callbacks.onDocument?.(documentId);
        putStep = true;
        await storageHttp.put(result.upload.url, file, {
          headers: result.upload.headers,
          onUploadProgress: (event) => {
            if (event.total) callbacks.onProgress?.(event.loaded / event.total);
          },
        });
        putStep = false;
        stage = 'complete';
      }
      const document = await apiPost<DocumentInfo>(`/documents/${documentId}/complete`);
      stage = 'done';
      return document;
    } catch (error) {
      // Tamamlama kesin cevapla reddedilirse sonraki deneme niyetten başlar: belge hâlâ
      // bekliyorsa aynı anahtar yeni adres verir; başarısız/süresi dolmuşsa yeni yükleme açılır.
      if (stage === 'complete' && isApiError(error) && !error.isNetwork) stage = 'intent';
      throw toFailure(error, putStep);
    }
  }

  return {
    get done() {
      return stage === 'done';
    },
    run,
  };
}

/** Görsel dosyalar için yerel küçük önizleme adresi (HEIC tarayıcıda gösterilemez). */
export function localPreviewUrl(file: File, mimeType: DocumentMimeType | null): string | null {
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') {
    return null;
  }
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
}
