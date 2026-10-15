// Standart raporlar ve filtreli dışa aktarma (şartname 7.10, 10.9). API ve web aynı adları kullanır.

/** `GET /reports/:type/export.{format}` içindeki rapor türleri; `transactions` "Bu sonuçları indir"dir. */
export const REPORT_EXPORT_TYPES = [
  'period',
  'project',
  'party',
  'open-balances',
  'transactions',
] as const;
export type ReportExportType = (typeof REPORT_EXPORT_TYPES)[number];

export const REPORT_FORMATS = ['xlsx', 'csv', 'pdf'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export const REPORT_TITLES: Record<ReportExportType, string> = {
  period: 'Dönem gelir/gider hareket dökümü',
  project: 'Şantiye özeti ve hareket dökümü',
  party: 'Kişi/firma hesap dökümü',
  'open-balances': 'Açık borç/alacak ve vade listesi',
  transactions: 'İşlemler — filtrelenmiş sonuçlar',
};

/** Kapsamda başlangıç kaydı varsa raporda ve dosyada gösterilen uyarı (şartname 7.10). */
export const TRACKING_START_WARNING =
  'Bu rapor takip başlangıç tarihinden itibaren kayıtlı hareketleri kapsar.';

/** Kapsamda başlangıç kaydı yoksa takip başlangıcı satırının değeri. */
export const NO_OPENING_TEXT = 'Başlangıç kaydı yok';

/** Toplam satırlarının etiketi (şartname 9.1). */
export const OBLIGATIONS_LABEL = 'Anlaşmalar ve başlangıç kayıtları';
