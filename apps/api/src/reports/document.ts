// Rapor verisinden biçimden bağımsız belge modeli (şartname 7.10). CSV, Excel ve PDF aynı belgeden
// yazılır; toplamlar rapor verisinde aynı satırlardan hesaplanmıştır, burada yeniden hesaplanmaz.

import {
  BUSINESS_TIME_ZONE,
  foldTurkish,
  NO_OPENING_TEXT,
  OBLIGATIONS_LABEL,
  todayInIstanbul,
  TRACKING_START_WARNING,
  type CashTotals,
  type DirectionSummary,
  type DueState,
  type TransactionKind,
} from '@santiye/shared';
import type {
  AnyReport,
  OpenBalancesReport,
  PartyReport,
  PeriodReport,
  ProjectReport,
  ReportAgreementRow,
  ReportHeader,
  ReportTransactionRow,
  TransactionsReport,
} from '../services/reports.js';

export type ColumnType = 'text' | 'date' | 'money' | 'integer';
export type CellValue = string | number | null;
export type Tone = 'income' | 'expense';

export interface Column {
  key: string;
  header: string;
  type: ColumnType;
  /** Göreli genişlik (yaklaşık karakter) */
  width: number;
  /** PDF okunabilir döküm olduğu için bazı ayrıntı sütunları yalnız Excel/CSV'de */
  pdf?: boolean;
}

export interface TableRow {
  cells: Record<string, CellValue>;
  tone?: Tone | undefined;
}

export interface TableSection {
  kind: 'table';
  title: string;
  columns: Column[];
  rows: TableRow[];
  /** Toplam satırları: etiket ilk sütuna, tutarlar ilgili sütunlara */
  totals: { label: string; values: Record<string, number> }[];
  empty: string;
}

export interface SummarySection {
  kind: 'summary';
  title: string;
  items: { label: string; value: number; tone?: Tone | undefined }[];
}

export type Section = TableSection | SummarySection;

export interface ReportDocument {
  title: string;
  subject: string | null;
  fileBase: string;
  meta: { label: string; value: string }[];
  warning: string | null;
  sections: Section[];
}

// ── Biçimler ─────────────────────────────────────────────────────────────────

const shortDate = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateTime = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: BUSINESS_TIME_ZONE,
});

/** "2026-10-13" → "13 Eki 2026" (ekrandaki biçim, şartname 4.4). */
export function displayDate(date: string): string {
  return shortDate.format(new Date(`${date}T00:00:00Z`));
}

/** ISO an → İstanbul saatiyle "13 Eki 2026 14:05". */
export function displayDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** Dosya adı parçası: Türkçe harfler sadeleşir, yalnız a-z, 0-9 ve tire. */
export function slug(text: string): string {
  return foldTurkish(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export const KIND_LABEL: Record<TransactionKind, string> = {
  income: 'Gelir',
  expense: 'Gider',
  expense_refund: 'Ödeme iadesi',
  income_refund: 'Tahsilat iadesi',
};

const DUE_TITLE: Record<DueState, string> = {
  overdue: 'Gecikmiş',
  upcoming: 'Yaklaşan (30 gün)',
  later: 'Daha sonra',
  none: 'Vadesi belirlenmemiş',
};

const toneOf = (kind: TransactionKind): Tone =>
  kind === 'income' || kind === 'income_refund' ? 'income' : 'expense';

// ── Ortak parçalar ───────────────────────────────────────────────────────────

function metaOf(header: ReportHeader, options: { dated: boolean }) {
  const range = !options.dated
    ? 'Tarih filtresi yok (güncel açık tutarlar)'
    : header.dateFrom || header.dateTo
      ? `${header.dateFrom ? displayDate(header.dateFrom) : 'İlk kayıt'} – ${
          header.dateTo ? displayDate(header.dateTo) : 'Son kayıt'
        }`
      : 'Tüm tarihler';
  return [
    { label: 'Firma', value: header.companyName },
    {
      label: 'Rapor',
      value: header.subject ? `${header.title} — ${header.subject}` : header.title,
    },
    { label: 'Kapsam', value: header.scope },
    { label: 'İşlem tarihi aralığı', value: range },
    ...(header.filters.length > 0
      ? [{ label: 'Filtreler', value: header.filters.join(' · ') }]
      : []),
    { label: 'Üretim tarihi/saati', value: displayDateTime(header.generatedAt) },
    { label: 'Güncel kalan — hesaplandığı', value: displayDateTime(header.balancesAt) },
    {
      label: 'Takip başlangıcı',
      value: header.trackingStart ? displayDate(header.trackingStart) : NO_OPENING_TEXT,
    },
  ];
}

function base(header: ReportHeader, fileBase: string, dated = true) {
  return {
    title: header.title,
    subject: header.subject,
    fileBase: `${fileBase}-${todayInIstanbul(new Date(header.generatedAt))}`,
    meta: metaOf(header, { dated }),
    warning: header.trackingStart ? TRACKING_START_WARNING : null,
  };
}

export function cashSummary(title: string, totals: CashTotals): SummarySection {
  return {
    kind: 'summary',
    title,
    items: [
      { label: 'Tahsilat', value: totals.income, tone: 'income' },
      { label: 'Tahsilat iadesi', value: totals.incomeRefund, tone: 'income' },
      { label: 'Net tahsilat', value: totals.netIncome, tone: 'income' },
      { label: 'Ödeme', value: totals.expense, tone: 'expense' },
      { label: 'Ödeme iadesi', value: totals.expenseRefund, tone: 'expense' },
      { label: 'Net ödeme', value: totals.netExpense, tone: 'expense' },
      { label: 'Gelir − gider farkı', value: totals.difference },
    ],
  };
}

function directionItems(summary: DirectionSummary, opening: DirectionSummary, payable: boolean) {
  return [
    { label: payable ? 'Ödenecek toplam' : 'Tahsil edilecek toplam', value: summary.totalAmount },
    { label: payable ? 'Ödenen' : 'Tahsil edilen', value: summary.netSettled },
    { label: payable ? 'Kalan borç' : 'Kalan alacak', value: summary.remaining },
    { label: payable ? 'Gecikmiş borç' : 'Gecikmiş alacak', value: summary.overdue },
    { label: payable ? 'Fazla ödeme' : 'Fazla tahsilat', value: summary.excess },
    {
      label: payable
        ? 'Başlangıç kayıtlarından kalan borç'
        : 'Başlangıç kayıtlarından kalan alacak',
      value: opening.remaining,
    },
  ];
}

export function obligationSections(
  payable: DirectionSummary,
  receivable: DirectionSummary,
  openings: { payable: DirectionSummary; receivable: DirectionSummary },
  prefix = 'Güncel',
): SummarySection[] {
  return [
    {
      kind: 'summary',
      title: `${prefix} borç (ödenecek) — ${OBLIGATIONS_LABEL}`,
      items: directionItems(payable, openings.payable, true),
    },
    {
      kind: 'summary',
      title: `${prefix} alacak (tahsil edilecek) — ${OBLIGATIONS_LABEL}`,
      items: directionItems(receivable, openings.receivable, false),
    },
  ];
}

function transactionColumns(options: { share: boolean; status?: boolean }): Column[] {
  return [
    { key: 'recordNo', header: 'İşlem no', type: 'integer', width: 8 },
    { key: 'date', header: 'Tarih', type: 'date', width: 11 },
    { key: 'kind', header: 'Tür', type: 'text', width: 17 },
    { key: 'party', header: 'Kişi/firma', type: 'text', width: 18 },
    { key: 'scope', header: 'Kapsam', type: 'text', width: 18 },
    { key: 'agreement', header: 'Anlaşma', type: 'text', width: 16 },
    { key: 'category', header: 'Kategori', type: 'text', width: 12 },
    { key: 'description', header: 'Açıklama', type: 'text', width: 22 },
    { key: 'allocations', header: 'Paylar', type: 'text', width: 30, pdf: false },
    { key: 'sourceRecordNo', header: 'Kaynak işlem no', type: 'integer', width: 10, pdf: false },
    ...(options.status
      ? [{ key: 'status', header: 'Durum', type: 'text' as const, width: 9 }]
      : []),
    { key: 'amount', header: 'Toplam tutar', type: 'money', width: 14 },
    ...(options.share
      ? [{ key: 'share', header: 'Kapsama düşen pay', type: 'money' as const, width: 18 }]
      : []),
    { key: 'createdAt', header: 'Sisteme girildiği', type: 'text', width: 17, pdf: false },
  ];
}

function transactionRow(row: ReportTransactionRow): TableRow {
  return {
    tone: toneOf(row.kind),
    cells: {
      recordNo: row.recordNo,
      date: row.date,
      kind: row.isSplit ? `${KIND_LABEL[row.kind]} (paylaştırıldı)` : KIND_LABEL[row.kind],
      party: row.party ?? 'Muhatapsız',
      scope: row.scope,
      agreement: row.agreement ?? '',
      category: row.category ?? '',
      description: row.description,
      allocations: row.allocations,
      sourceRecordNo: row.sourceRecordNo,
      status: row.deleted ? 'Silindi' : 'Geçerli',
      amount: row.amount,
      share: row.share,
      createdAt: displayDateTime(row.createdAt),
    },
  };
}

function cashTotalRows(totals: CashTotals, key: string, side: 'both' | 'income' | 'expense') {
  const income = [
    { label: 'Tahsilat', values: { [key]: totals.income } },
    { label: 'Tahsilat iadesi', values: { [key]: totals.incomeRefund } },
    { label: 'Net tahsilat', values: { [key]: totals.netIncome } },
  ];
  const expense = [
    { label: 'Ödeme', values: { [key]: totals.expense } },
    { label: 'Ödeme iadesi', values: { [key]: totals.expenseRefund } },
    { label: 'Net ödeme', values: { [key]: totals.netExpense } },
  ];
  if (side === 'income') return income;
  if (side === 'expense') return expense;
  return [
    ...income,
    ...expense,
    { label: 'Gelir − gider farkı', values: { [key]: totals.difference } },
  ];
}

function transactionTable(
  title: string,
  rows: ReportTransactionRow[],
  totals: CashTotals,
  options: { share: boolean; status?: boolean; side?: 'both' | 'income' | 'expense' },
): TableSection {
  return {
    kind: 'table',
    title,
    columns: transactionColumns(options),
    rows: rows.map(transactionRow),
    totals: cashTotalRows(totals, options.share ? 'share' : 'amount', options.side ?? 'both'),
    empty: 'Bu kapsamda hareket yok.',
  };
}

const agreementColumns: Column[] = [
  { key: 'kind', header: 'Tür', type: 'text', width: 13 },
  { key: 'label', header: 'Ad', type: 'text', width: 20 },
  { key: 'direction', header: 'Yön', type: 'text', width: 13 },
  { key: 'party', header: 'Kişi/firma', type: 'text', width: 18 },
  { key: 'scope', header: 'Kapsam', type: 'text', width: 16 },
  { key: 'currentAmount', header: 'Bedel', type: 'money', width: 13 },
  { key: 'netSettled', header: 'Ödenen / tahsil edilen', type: 'money', width: 20 },
  { key: 'remaining', header: 'Kalan', type: 'money', width: 13 },
  { key: 'excess', header: 'Fazla', type: 'money', width: 11 },
  { key: 'dueDate', header: 'Vade', type: 'date', width: 11 },
  { key: 'due', header: 'Vade durumu', type: 'text', width: 19 },
  { key: 'trackingStartDate', header: 'Takip başlangıcı', type: 'date', width: 11, pdf: false },
];

function dueText(row: ReportAgreementRow): string {
  if (row.dueState === 'overdue') return `${row.overdueDays} gün gecikti`;
  if (row.dueState === null) return row.remaining > 0 ? '' : 'Kapandı';
  return DUE_TITLE[row.dueState];
}

/** Kalan borç/alacak bakiyedir; `ink` renginde, yön yazıyla (şartname 4.1). */
function agreementRow(row: ReportAgreementRow): TableRow {
  return {
    cells: {
      kind: row.kind === 'opening' ? 'Başlangıç kaydı' : 'Anlaşma',
      label: row.label,
      direction: row.direction === 'payable' ? 'Ödenecek' : 'Tahsil edilecek',
      party: row.party ?? '',
      scope: row.scope,
      currentAmount: row.currentAmount,
      netSettled: row.netSettled,
      remaining: row.remaining,
      excess: row.excess,
      dueDate: row.dueDate,
      due: dueText(row),
      trackingStartDate: row.trackingStartDate,
    },
  };
}

/** Borç ve alacak ayrı toplanır; birbirinden düşülmez (şartname 9.1). */
function agreementTotals(payable: DirectionSummary, receivable: DirectionSummary) {
  const values = (summary: DirectionSummary) => ({
    currentAmount: summary.totalAmount,
    netSettled: summary.netSettled,
    remaining: summary.remaining,
    excess: summary.excess,
  });
  return [
    { label: 'Ödenecek toplam', values: values(payable) },
    { label: 'Tahsil edilecek toplam', values: values(receivable) },
  ];
}

// ── Rapor türleri ────────────────────────────────────────────────────────────

function periodDocument(report: PeriodReport): ReportDocument {
  const share = report.header.scoped;
  return {
    ...base(report.header, 'donem-dokumu'),
    sections: [
      cashSummary('Gerçekleşen hareketler', report.totals),
      {
        kind: 'table',
        title: 'Kategori özeti (giderler)',
        columns: [
          { key: 'category', header: 'Kategori', type: 'text', width: 30 },
          { key: 'expense', header: 'Ödeme', type: 'money', width: 16 },
          { key: 'expenseRefund', header: 'Ödeme iadesi', type: 'money', width: 16 },
          { key: 'netExpense', header: 'Net ödeme', type: 'money', width: 16 },
        ],
        rows: report.categories.map((row) => ({
          tone: 'expense',
          cells: { ...row },
        })),
        totals: [
          {
            label: 'Toplam',
            values: {
              expense: report.totals.expense,
              expenseRefund: report.totals.expenseRefund,
              netExpense: report.totals.netExpense,
            },
          },
        ],
        empty: 'Bu dönemde gider yok.',
      },
      transactionTable('Hareketler (tarihe göre artan)', report.rows, report.totals, { share }),
      ...obligationSections(
        report.obligations.payable,
        report.obligations.receivable,
        report.obligations.openings,
      ),
    ],
  };
}

function projectDocument(report: ProjectReport): ReportDocument {
  return {
    ...base(report.header, `santiye-raporu-${slug(report.project.name)}`),
    sections: [
      cashSummary('Şantiye özeti — gerçekleşen hareketler (paylardan)', report.cash),
      ...obligationSections(report.payable, report.receivable, report.openings),
      transactionTable('Gelirler (tarihe göre artan)', report.incomeRows, report.cash, {
        share: true,
        side: 'income',
      }),
      transactionTable('Giderler (tarihe göre artan)', report.expenseRows, report.cash, {
        share: true,
        side: 'expense',
      }),
    ],
  };
}

function partyDocument(report: PartyReport): ReportDocument {
  return {
    ...base(report.header, `hesap-dokumu-${slug(report.party.name)}`),
    sections: [
      ...obligationSections(report.payable, report.receivable, report.openings),
      {
        kind: 'table',
        title: OBLIGATIONS_LABEL,
        columns: agreementColumns,
        rows: report.agreements.map(agreementRow),
        totals: agreementTotals(report.payable, report.receivable),
        empty: 'Bu kişiyle anlaşma veya başlangıç kaydı yok.',
      },
      transactionTable('Anlaşmaya bağlı hareketler', report.linkedRows, report.linkedTotals, {
        share: false,
      }),
      transactionTable(
        'Doğrudan hareketler (anlaşmaya bağlanmamış; borcu azaltmaz)',
        report.directRows,
        report.directTotals,
        { share: false },
      ),
    ],
  };
}

function openBalancesDocument(report: OpenBalancesReport): ReportDocument {
  const { summary } = report;
  return {
    ...base(report.header, 'acik-borc-alacak', false),
    sections: [
      {
        kind: 'summary',
        title: `Açık tutarlar — ${OBLIGATIONS_LABEL}`,
        items: [
          { label: 'Kalan borç', value: summary.payable.remaining },
          { label: 'Gecikmiş borç', value: summary.payable.overdue },
          {
            label: 'Başlangıç kayıtlarından kalan borç',
            value: summary.openings.payable.remaining,
          },
          { label: 'Kalan alacak', value: summary.receivable.remaining },
          { label: 'Gecikmiş alacak', value: summary.receivable.overdue },
          {
            label: 'Başlangıç kayıtlarından kalan alacak',
            value: summary.openings.receivable.remaining,
          },
        ],
      },
      ...report.groups.map((group): TableSection => ({
        kind: 'table',
        title: DUE_TITLE[group.state],
        columns: agreementColumns.filter((column) => column.key !== 'excess'),
        rows: group.rows.map(agreementRow),
        totals: (['payable', 'receivable'] as const).map((direction) => ({
          label: direction === 'payable' ? 'Kalan borç' : 'Kalan alacak',
          values: {
            remaining: group.rows
              .filter((row) => row.direction === direction)
              .reduce((sum, row) => sum + row.remaining, 0),
          },
        })),
        empty: 'Bu grupta açık tutar yok.',
      })),
    ],
  };
}

function transactionsDocument(report: TransactionsReport): ReportDocument {
  const share = report.header.scoped;
  const status = report.rows.some((row) => row.deleted);
  return {
    ...base(report.header, 'islemler'),
    sections: [
      cashSummary('Toplamlar (silinmemiş kayıtlar)', report.totals),
      transactionTable('İşlemler', report.rows, report.totals, { share, status }),
    ],
  };
}

export function toDocument(report: AnyReport): ReportDocument {
  switch (report.type) {
    case 'period':
      return periodDocument(report.data);
    case 'project':
      return projectDocument(report.data);
    case 'party':
      return partyDocument(report.data);
    case 'open-balances':
      return openBalancesDocument(report.data);
    case 'transactions':
      return transactionsDocument(report.data);
  }
}
