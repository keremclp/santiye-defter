// Yönetim ekranı etiketleri (şartname 7.13, 8.10): işletim geçmişi işlem adlarının Türkçe karşılıkları.

import type { DeletionStatus } from '../api/admin-types';
import type { ServiceState } from '../api/types';

export const PLATFORM_ACTION_LABEL: Record<string, string> = {
  'company.create': 'Firma oluşturuldu',
  'company.update': 'Firma bilgileri düzenlendi',
  'company.quota': 'Kapasite değiştirildi',
  'company.suspend': 'Geçici olarak durduruldu',
  'company.unsuspend': 'Geçici durdurma kaldırıldı',
  'company.end_service': 'Hizmet sonlandırıldı',
  'company.reopen': 'Hizmet yeniden açıldı',
  'company.extend_retention': 'Arşiv saklaması uzatıldı',
  'company.delete': 'Kalıcı silme başlatıldı',
  'company.delete_completed': 'Kalıcı silme tamamlandı',
  'company.delete_failed': 'Kalıcı silme başarısız oldu',
  'user.create': 'Kullanıcı eklendi',
  'user.update': 'Kullanıcı düzenlendi',
  'user.reset_password': 'Şifre sıfırlandı',
  'user.activate': 'Kullanıcı aktifleştirildi',
  'user.deactivate': 'Kullanıcı pasifleştirildi',
  'admin.bootstrap': 'Ürün sahibi hesabı oluşturuldu',
  'admin.totp_confirmed': 'İki aşamalı doğrulama kuruldu',
  'admin.totp_reset': 'İki aşamalı doğrulama yeniden kuruldu',
  'admin.recovery_code_used': 'Kurtarma kodu kullanıldı',
  'admin.recovery_codes_regenerated': 'Kurtarma kodları yenilendi',
  'admin.second_factor_locked': 'Hatalı kod denemeleri nedeniyle geçici kilit',
  'admin.two_factor_reset': 'İki aşamalı doğrulama sunucu komutuyla sıfırlandı',
};

export function platformActionLabel(action: string): string {
  return PLATFORM_ACTION_LABEL[action] ?? action;
}

/** Değişiklik satırlarındaki alan adları; kalıcı silmede silinen koleksiyonlar da burada. */
export const PLATFORM_FIELD_LABEL: Record<string, string> = {
  name: 'Ad',
  username: 'Kullanıcı adı',
  contact: 'İletişim',
  opsNote: 'İşletim notu',
  storageQuotaBytes: 'Kapasite',
  isSuspended: 'Geçici durdurma',
  isActive: 'Aktif',
  serviceEndedAt: 'Hizmet sonu',
  viewUntil: 'Son görüntüleme günü',
  retainUntil: 'Saklama bitişi',
  deletionStatus: 'Silme durumu',
  files: 'Depodaki dosyalar',
  users: 'Kullanıcılar',
  transactions: 'Hareketler',
  agreements: 'Anlaşmalar',
  projects: 'Şantiyeler',
  parties: 'Kişiler',
  documents: 'Belgeler',
  categories: 'Kategoriler',
  exportjobs: 'Dışa aktarma işleri',
  idempotencyrecords: 'Güvenli tekrar kayıtları',
  searchhistories: 'Arama geçmişi',
};

/** Ürün sahibinin firma listesindeki durum adları; müşteri ekranındakinden kısa ve işletime yönelik. */
export const PLATFORM_STATE_LABEL: Record<ServiceState, string> = {
  active: 'Aktif',
  suspended: 'Geçici durdurulmuş',
  view_only: 'Hizmet sonu görüntüleme',
  archived: 'Arşiv saklama',
  deletion_pending: 'Silme onayı bekliyor',
  deleting: 'Kalıcı silme',
};

export const DELETION_STATUS_LABEL: Record<DeletionStatus, string> = {
  none: 'Başlamadı',
  pending: 'Silme bekliyor',
  running: 'Silme sürüyor',
  done: 'Silindi',
  failed: 'Silme başarısız',
};

/** Durum filtresi (şartname 7.13): beş durum; silmesi başlamış firmalar hiçbirine girmez. */
export const STATUS_FILTERS: { value: ServiceState; label: string }[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'suspended', label: 'Geçici durdurulmuş' },
  { value: 'view_only', label: 'Hizmet sonu görüntüleme' },
  { value: 'archived', label: 'Arşiv saklama' },
  { value: 'deletion_pending', label: 'Silme onayı bekleyen' },
];
