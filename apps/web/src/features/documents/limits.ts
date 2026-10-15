// Belge ekleme sınırları ve metinleri (şartname 9.6, 12).

import { DOCUMENT_LIMIT_PER_RECORD } from '@santiye/shared';
import { useCompany } from '../../api/queries';
import { useWriteAccess } from '../../hooks/useWriteAccess';

export const STORAGE_FULL_TEXT =
  'Belge alanı doldu. Kayıt girmeye devam edebilirsiniz; yeni belge için ürün sahibiyle görüşün.';
export const RECORD_FULL_TEXT = `Bu kayda en fazla ${DOCUMENT_LIMIT_PER_RECORD} belge eklenebilir.`;

export function isImageType(mimeType: string | null): boolean {
  return Boolean(mimeType?.startsWith('image/'));
}

/**
 * Yeni belge eklenemiyorsa nedeni: değişiklik kapalı, belge alanı dolu veya kayıt başına sınır.
 * Kapasite bilgisi alınamazsa yükleme engellenmez; sınırları sunucu ayrıca uygular.
 */
export function useUploadBlock(
  slotsUsed: number,
  extraReason: string | null = null,
): string | null {
  const { canWrite, reason } = useWriteAccess();
  const company = useCompany();
  if (!canWrite) return reason;
  if (extraReason) return extraReason;
  const storage = company.data?.storage;
  if (storage && storage.usedBytes >= storage.quotaBytes) return STORAGE_FULL_TEXT;
  if (slotsUsed >= DOCUMENT_LIMIT_PER_RECORD) return RECORD_FULL_TEXT;
  return null;
}
