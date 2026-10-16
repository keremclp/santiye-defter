// Tam firma veri çıkışı (şartname 7.10, 8.10, 10.9). API ve web aynı adları kullanır.

export const EXPORT_JOB_STATUSES = ['queued', 'running', 'ready', 'failed'] as const;
export type ExportJobStatus = (typeof EXPORT_JOB_STATUSES)[number];

export const EXPORT_JOB_TYPES = ['full'] as const;
export type ExportJobType = (typeof EXPORT_JOB_TYPES)[number];

/** Hazır paket bu kadar gün sonra silinir. */
export const EXPORT_RETENTION_DAYS = 7;

/** Silinen ama geri alınabilir kayıtların dosyadaki durum etiketi. */
export const DELETED_STATUS_LABEL = 'Silindi (geri alınabilir)';
export const ACTIVE_STATUS_LABEL = 'Geçerli';
