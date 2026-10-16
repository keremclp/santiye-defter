// Ekran etiketleri (şartname 7, 12). Kodlar API'deki gibi İngilizce, ekranda Türkçe.

import type { Direction, PaymentStatus, TransactionKind, WorkStatus } from '@santiye/shared';
import type { DueState, PartyKind, PartyTag, ProjectStatus, ServiceState } from '../api/types';

export const KIND_LABEL: Record<TransactionKind, string> = {
  income: 'Gelir',
  expense: 'Gider',
  expense_refund: 'Ödeme iadesi',
  income_refund: 'Tahsilat iadesi',
};

export const DIRECTION_LABEL: Record<Direction, string> = {
  payable: 'Ödenecek',
  receivable: 'Tahsil edilecek',
};

export const OPENING_LABEL: Record<Direction, string> = {
  payable: 'Başlangıç borcu',
  receivable: 'Başlangıç alacağı',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  open: 'Ödeme yok',
  partial: 'Kısmi',
  settled: 'Kapandı',
  overpaid: 'Fazla',
};

export function paymentStatusLabel(status: PaymentStatus, direction: Direction): string {
  if (status === 'open') return direction === 'payable' ? 'Ödeme yok' : 'Tahsilat yok';
  if (status === 'overpaid') return direction === 'payable' ? 'Fazla ödeme' : 'Fazla tahsilat';
  return PAYMENT_STATUS_LABEL[status];
}

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  ongoing: 'Devam ediyor',
  completed: 'İş tamamlandı',
  cancelled: 'İptal',
};

export const DUE_STATE_LABEL: Record<DueState, string> = {
  overdue: 'Gecikmiş',
  upcoming: 'Yaklaşan',
  later: 'Daha sonra',
  none: 'Vadesi belirlenmemiş',
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Aktif',
  completed: 'Tamamlandı',
  archived: 'Arşivlendi',
};

export const PARTY_KIND_LABEL: Record<PartyKind, string> = {
  person: 'Kişi',
  company: 'Firma',
};

export const PARTY_TAG_LABEL: Record<PartyTag, string> = {
  supplier: 'Tedarikçi',
  subcontractor: 'Taşeron',
  customer: 'Müşteri',
};

export const SERVICE_STATE_LABEL: Record<ServiceState, string> = {
  active: 'Aktif',
  view_only: 'Hizmet sona erdi — yalnız görüntüleme',
  suspended: 'Geçici olarak durduruldu',
  archived: 'Arşiv saklama',
  deletion_pending: 'Silme onayı bekliyor',
  deleting: 'Kapatılıyor',
};

// Geçmiş etiketleri tam veri çıkışıyla ortaktır.
export { FIELD_LABEL, HISTORY_ACTION_LABEL } from '@santiye/shared';
