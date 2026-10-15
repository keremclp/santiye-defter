// Standart raporlar ve "Bu sonuçları indir" verisi (şartname 7.10, 9.1, 10.9). Her rapor tek okuma
// görüntüsünden üretilir; toplamlar aynı satırlardan `packages/shared` fonksiyonlarıyla hesaplanır.
// Ekran bu veriyi gösterir, dosyalar aynı veriden yazılır.

import {
  cashTotalsOfRows,
  DIRECTIONS,
  dueStateOf,
  formatTl,
  isIsoDate,
  overdueDaysOf,
  REPORT_TITLES,
  type CashTotals,
  type DirectionSummary,
  type DueState,
  type ReportExportType,
  type TransactionKind,
} from '@santiye/shared';
import { Types, type ClientSession, type QueryFilter } from 'mongoose';
import { z } from 'zod';
import { forCompany } from '../db/company-scope.js';
import { withReadSnapshot } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { businessToday } from '../lib/clock.js';
import { AgreementModel, type Agreement } from '../models/agreement.js';
import { PartyModel } from '../models/party.js';
import { ProjectModel } from '../models/project.js';
import { TransactionModel, type Transaction } from '../models/transaction.js';
import type { CustomerContext } from './customer-auth.js';
import {
  agreementLabel,
  loadNameMaps,
  transactionRefs,
  type NameMaps,
} from './finance-presenters.js';
import { scopedAmount, type CashTarget } from './ledger.js';
import { summarizeObligations, type ObligationSummary } from './obligations.js';
import { queryList, toObjectId, validationError } from './records.js';
import {
  TRANSACTION_SORTS,
  transactionListQuerySchema,
  type TransactionService,
} from './transactions.js';

const NO_MATCH = new Types.ObjectId('ffffffffffffffffffffffff');
const filterId = (value: string) => toObjectId(value) ?? NO_MATCH;

const optionalDate = z
  .string()
  .optional()
  .refine((value) => value === undefined || isIsoDate(value), 'Tarih YYYY-AA-GG biçiminde olmalı.');
const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const projectIds = z
  .unknown()
  .optional()
  .transform((value) => queryList(value));

export const reportRangeQuerySchema = z.object({ dateFrom: optionalDate, dateTo: optionalDate });

export const periodReportQuerySchema = reportRangeQuerySchema.extend({
  projectId: projectIds,
  /** `company`: firma geneli kayıtlar */
  scope: z.enum(['company']).optional(),
  categoryId: z.string().optional(),
  uncategorized: flag,
});

export const openBalancesQuerySchema = z.object({
  direction: z.enum(['all', ...DIRECTIONS]).default('all'),
  projectId: projectIds,
  scope: z.enum(['company']).optional(),
});

/** "Bu sonuçları indir": işlem listesinin bütün filtreleri, sayfa olmadan. */
export const transactionsExportQuerySchema = transactionListQuerySchema;

type PeriodQuery = z.infer<typeof periodReportQuerySchema>;
type RangeQuery = z.infer<typeof reportRangeQuerySchema>;
type OpenBalancesQuery = z.infer<typeof openBalancesQuerySchema>;
type TransactionsQuery = z.infer<typeof transactionsExportQuerySchema>;

// ── Cevap biçimleri ──────────────────────────────────────────────────────────

export interface ReportHeader {
  type: ReportExportType;
  title: string;
  /** Şantiye veya kişi/firma adı */
  subject: string | null;
  companyName: string;
  scope: string;
  /** Kapsam seçildi: tutarlar seçili kapsama düşen paylardan */
  scoped: boolean;
  dateFrom: string | null;
  dateTo: string | null;
  generatedAt: string;
  /** Güncel kalan borç/alacağın hesaplandığı an */
  balancesAt: string;
  /** Kapsamdaki başlangıç kayıtlarının en erken takip başlangıç tarihi; yoksa null */
  trackingStart: string | null;
  /** Etkin filtrelerin açıklaması (kapsam ve tarih dışında) */
  filters: string[];
}

export interface ReportTransactionRow {
  id: string;
  recordNo: number;
  date: string;
  kind: TransactionKind;
  party: string | null;
  category: string | null;
  /** Şantiye adları veya "Firma geneli" */
  scope: string;
  agreement: string | null;
  description: string;
  isSplit: boolean;
  /** Paylaştırılmış kayıtta paylar: "Kadıköy Villa: 25.000 TL; Firma geneli: 15.000 TL" */
  allocations: string;
  /** Hareketin toplam gerçek tutarı */
  amount: number;
  /** Seçili kapsama düşen pay; kapsam seçilmediyse toplam tutar */
  share: number;
  /** İadenin kaynak hareketinin işlem no'su */
  sourceRecordNo: number | null;
  linkedToAgreement: boolean;
  deleted: boolean;
  /** Sisteme girilme zamanı */
  createdAt: string;
}

export interface ReportAgreementRow {
  id: string;
  kind: Agreement['kind'];
  label: string;
  direction: Agreement['direction'];
  party: string | null;
  scope: string;
  currentAmount: number;
  netSettled: number;
  remaining: number;
  excess: number;
  agreementDate: string | null;
  trackingStartDate: string | null;
  dueDate: string | null;
  dueState: DueState | null;
  overdueDays: number;
  workStatus: Agreement['workStatus'];
  settlementPending: boolean;
}

export interface CategorySummaryRow {
  category: string;
  expense: number;
  expenseRefund: number;
  netExpense: number;
}

export interface PeriodReport {
  header: ReportHeader;
  totals: CashTotals;
  categories: CategorySummaryRow[];
  rows: ReportTransactionRow[];
  obligations: ObligationSummary;
}

export interface ProjectReport {
  header: ReportHeader;
  project: { id: string; name: string; status: string };
  cash: CashTotals;
  payable: DirectionSummary;
  receivable: DirectionSummary;
  openings: ObligationSummary['openings'];
  incomeRows: ReportTransactionRow[];
  expenseRows: ReportTransactionRow[];
}

export interface PartyReport {
  header: ReportHeader;
  party: { id: string; name: string };
  payable: DirectionSummary;
  receivable: DirectionSummary;
  openings: ObligationSummary['openings'];
  agreements: ReportAgreementRow[];
  linkedRows: ReportTransactionRow[];
  linkedTotals: CashTotals;
  directRows: ReportTransactionRow[];
  directTotals: CashTotals;
}

export interface OpenBalancesReport {
  header: ReportHeader;
  summary: ObligationSummary;
  groups: { state: DueState; rows: ReportAgreementRow[] }[];
}

export interface TransactionsReport {
  header: ReportHeader;
  rows: ReportTransactionRow[];
  totals: CashTotals;
}

export type AnyReport =
  | { type: 'period'; data: PeriodReport }
  | { type: 'project'; data: ProjectReport }
  | { type: 'party'; data: PartyReport }
  | { type: 'open-balances'; data: OpenBalancesReport }
  | { type: 'transactions'; data: TransactionsReport };

// ── Yardımcılar ──────────────────────────────────────────────────────────────

const ALL_SCOPE = 'Tüm firma: bütün şantiyeler ve firma geneli kayıtlar';
const COMPANY_SCOPE = 'Firma geneli kayıtlar (şantiyeye bağlı olmayan)';

function assertRange(query: RangeQuery) {
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    throw validationError([
      {
        code: 'DATE_RANGE_INVALID',
        message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
        path: ['dateTo'],
      },
    ]);
  }
}

function dateFilter(query: RangeQuery): QueryFilter<Transaction> {
  if (!query.dateFrom && !query.dateTo) return {};
  return {
    date: {
      ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
      ...(query.dateTo ? { $lte: query.dateTo } : {}),
    },
  };
}

function targetOf(query: {
  projectId: string[];
  scope?: 'company' | undefined;
}): CashTarget | null {
  if (query.projectId.length === 0 && !query.scope) return null;
  return { projectIds: query.projectId.map(filterId), company: query.scope === 'company' };
}

/** Hareket filtresi: seçili kapsamda payı olan hareketler (işlem listesiyle aynı). */
function transactionTargetFilter(target: CashTarget | null): QueryFilter<Transaction> {
  if (!target) return {};
  return {
    allocations: {
      $elemMatch: {
        $or: [
          ...(target.projectIds.length > 0
            ? [{ scope: 'project', projectId: { $in: target.projectIds } }]
            : []),
          ...(target.company ? [{ scope: 'company' }] : []),
        ],
      },
    },
  };
}

function agreementTargetFilter(target: CashTarget | null): QueryFilter<Agreement> {
  if (!target) return {};
  const conditions: QueryFilter<Agreement>[] = [];
  if (target.projectIds.length > 0)
    conditions.push({ scope: 'project', projectId: { $in: target.projectIds } });
  if (target.company) conditions.push({ scope: 'company' });
  return { $or: conditions };
}

async function scopeLabel(companyId: Types.ObjectId, target: CashTarget | null) {
  if (!target) return ALL_SCOPE;
  const projects = await ProjectModel.find(
    { companyId, _id: { $in: target.projectIds } },
    { name: 1 },
  ).lean();
  const names = projects.map((project) => project.name);
  if (names.length === 0) return COMPANY_SCOPE;
  return `Şantiye: ${names.join(', ')}${target.company ? ' ve firma geneli kayıtlar' : ''}`;
}

/** Kapsamdaki başlangıç kayıtlarının en erken takip başlangıcı. */
function trackingStartOf(agreements: Pick<Agreement, 'kind' | 'trackingStartDate'>[]) {
  const dates = agreements
    .filter((agreement) => agreement.kind === 'opening' && agreement.trackingStartDate)
    .map((agreement) => agreement.trackingStartDate!)
    .sort();
  return dates[0] ?? null;
}

const isIncomeSide = (kind: TransactionKind) => kind === 'income' || kind === 'income_refund';

async function transactionRows(
  companyId: Types.ObjectId,
  transactions: Transaction[],
  target: CashTarget | null,
  session: ClientSession,
): Promise<ReportTransactionRow[]> {
  const sourceIds = transactions
    .map((transaction) => transaction.refundOf?.transactionId)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const sources =
    sourceIds.length > 0
      ? await TransactionModel.find({ companyId, _id: { $in: sourceIds } }, { recordNo: 1 })
          .session(session)
          .lean()
      : [];
  const sourceNo = new Map(sources.map((source) => [source._id.toString(), source.recordNo]));
  const maps = await loadNameMaps(companyId, transactionRefs(transactions));

  return transactions.map((transaction) => {
    const scopeName = (allocation: Transaction['allocations'][number]) =>
      allocation.scope === 'company'
        ? 'Firma geneli'
        : (maps.project(allocation.projectId)?.name ?? 'Şantiye');
    const agreements = [
      ...new Set(
        transaction.allocations
          .map((allocation) => maps.agreement(allocation.agreementId)?.name)
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    const isSplit = transaction.allocations.length > 1;
    return {
      id: transaction._id.toString(),
      recordNo: transaction.recordNo,
      date: transaction.date,
      kind: transaction.kind,
      party: maps.party(transaction.partyId)?.name ?? null,
      category: maps.category(transaction.categoryId)?.name ?? null,
      scope: [...new Set(transaction.allocations.map(scopeName))].join(', '),
      agreement: agreements.length > 0 ? agreements.join(', ') : null,
      description: transaction.description,
      isSplit,
      allocations: isSplit
        ? transaction.allocations
            .map((allocation) => `${scopeName(allocation)}: ${formatTl(allocation.amount)}`)
            .join('; ')
        : '',
      amount: transaction.amount,
      share: target ? scopedAmount(transaction, target) : transaction.amount,
      sourceRecordNo: transaction.refundOf
        ? (sourceNo.get(transaction.refundOf.transactionId.toString()) ?? null)
        : null,
      linkedToAgreement: transaction.allocations.some(
        (allocation) => allocation.agreementId !== null,
      ),
      deleted: transaction.deletedAt !== null,
      createdAt: transaction.createdAt.toISOString(),
    };
  });
}

/** Silinmemiş satırların seçili kapsama düşen paylarından toplam. */
function totalsOf(rows: readonly ReportTransactionRow[]): CashTotals {
  return cashTotalsOfRows(
    rows.filter((row) => !row.deleted).map((row) => ({ kind: row.kind, amount: row.share })),
  );
}

function agreementRows(
  agreements: Agreement[],
  maps: NameMaps,
  today: string,
): ReportAgreementRow[] {
  return agreements.map((agreement) => ({
    id: agreement._id.toString(),
    kind: agreement.kind,
    label: agreementLabel(agreement),
    direction: agreement.direction,
    party: maps.party(agreement.partyId)?.name ?? null,
    scope:
      agreement.scope === 'company'
        ? 'Firma geneli'
        : (maps.project(agreement.projectId)?.name ?? 'Şantiye'),
    currentAmount: agreement.currentAmount,
    netSettled: agreement.netSettled,
    remaining: agreement.remaining,
    excess: agreement.excess,
    agreementDate: agreement.agreementDate,
    trackingStartDate: agreement.trackingStartDate,
    dueDate: agreement.dueDate,
    dueState: dueStateOf(agreement, today),
    overdueDays: agreement.dueDate ? overdueDaysOf(agreement.dueDate, today) : 0,
    workStatus: agreement.workStatus,
    settlementPending: agreement.settlementPending,
  }));
}

function agreementMaps(companyId: Types.ObjectId, agreements: Agreement[]) {
  return loadNameMaps(companyId, {
    projects: agreements.map((agreement) => agreement.projectId),
    parties: agreements.map((agreement) => agreement.partyId),
  });
}

const DUE_ORDER: DueState[] = ['overdue', 'upcoming', 'later', 'none'];

// ── Servis ───────────────────────────────────────────────────────────────────

export class ReportService {
  constructor(
    private readonly deps: AppDeps,
    private readonly transactions: TransactionService,
  ) {}

  private header(
    context: CustomerContext,
    type: ReportExportType,
    fields: Pick<ReportHeader, 'scope' | 'trackingStart'> &
      Partial<Pick<ReportHeader, 'subject' | 'filters' | 'scoped'>> & { range?: RangeQuery },
  ): ReportHeader {
    const now = this.deps.clock.now().toISOString();
    return {
      type,
      title: REPORT_TITLES[type],
      subject: fields.subject ?? null,
      companyName: context.company.displayName || context.company.name,
      scope: fields.scope,
      scoped: fields.scoped ?? false,
      dateFrom: fields.range?.dateFrom ?? null,
      dateTo: fields.range?.dateTo ?? null,
      generatedAt: now,
      balancesAt: now,
      trackingStart: fields.trackingStart,
      filters: fields.filters ?? [],
    };
  }

  private today() {
    return businessToday(this.deps.clock);
  }

  /** Dönem dökümü: tarih aralığı, kapsam ve kategori filtreleri; kategori özeti; güncel kalanlar. */
  async period(context: CustomerContext, query: PeriodQuery): Promise<PeriodReport> {
    assertRange(query);
    const { companyId } = context;
    const target = targetOf(query);
    const filter: QueryFilter<Transaction> = {
      companyId,
      deletedAt: null,
      ...dateFilter(query),
      ...transactionTargetFilter(target),
    };
    const filters: string[] = [];
    if (query.uncategorized) {
      Object.assign(filter, { kind: { $in: ['expense', 'expense_refund'] }, categoryId: null });
      filters.push('Kategori: Kategorisiz giderler');
    } else if (query.categoryId) {
      filter.categoryId = filterId(query.categoryId);
    }

    return withReadSnapshot(async (session) => {
      const transactions = await TransactionModel.find(filter)
        .sort({ date: 1, recordNo: 1 })
        .session(session);
      const agreements = await AgreementModel.find({
        companyId,
        deletedAt: null,
        ...agreementTargetFilter(target),
      }).session(session);
      const rows = await transactionRows(companyId, transactions, target, session);

      if (query.categoryId && !query.uncategorized) {
        const maps = await loadNameMaps(companyId, { categories: [filterId(query.categoryId)] });
        filters.push(`Kategori: ${maps.category(filterId(query.categoryId))?.name ?? '—'}`);
      }
      const groups = new Map<string, ReportTransactionRow[]>();
      for (const row of rows) {
        if (row.kind !== 'expense' && row.kind !== 'expense_refund') continue;
        const key = row.category ?? 'Kategorisiz';
        groups.set(key, [...(groups.get(key) ?? []), row]);
      }
      const categories = [...groups]
        .map(([category, items]) => {
          const totals = totalsOf(items);
          return {
            category,
            expense: totals.expense,
            expenseRefund: totals.expenseRefund,
            netExpense: totals.netExpense,
          };
        })
        .sort((a, b) => b.netExpense - a.netExpense || a.category.localeCompare(b.category, 'tr'));

      return {
        header: this.header(context, 'period', {
          scope: await scopeLabel(companyId, target),
          scoped: target !== null,
          trackingStart: trackingStartOf(agreements),
          range: query,
          filters,
        }),
        totals: totalsOf(rows),
        categories,
        rows,
        obligations: summarizeObligations(agreements, this.today()),
      };
    });
  }

  /** Şantiye raporu: tahsilat, ödeme ve fark yalnız bu şantiyenin paylarından; listeler tarihe göre artan. */
  async project(context: CustomerContext, id: string, query: RangeQuery): Promise<ProjectReport> {
    assertRange(query);
    const { companyId } = context;
    const project = await forCompany(ProjectModel, companyId).findByIdOrThrow(id);
    const target: CashTarget = { projectIds: [project._id], company: false };

    return withReadSnapshot(async (session) => {
      const transactions = await TransactionModel.find({
        companyId,
        deletedAt: null,
        ...dateFilter(query),
        ...transactionTargetFilter(target),
      })
        .sort({ date: 1, recordNo: 1 })
        .session(session);
      const agreements = await AgreementModel.find({
        companyId,
        deletedAt: null,
        projectId: project._id,
      }).session(session);
      const rows = await transactionRows(companyId, transactions, target, session);
      const obligations = summarizeObligations(agreements, this.today());
      return {
        header: this.header(context, 'project', {
          subject: project.name,
          scope: `Şantiye: ${project.name} (yalnız bu şantiyeye düşen paylar)`,
          scoped: true,
          trackingStart: trackingStartOf(agreements),
          range: query,
        }),
        project: { id: project._id.toString(), name: project.name, status: project.status },
        cash: totalsOf(rows),
        payable: obligations.payable,
        receivable: obligations.receivable,
        openings: obligations.openings,
        incomeRows: rows.filter((row) => isIncomeSide(row.kind)),
        expenseRows: rows.filter((row) => !isIncomeSide(row.kind)),
      };
    });
  }

  /**
   * Hesap dökümü: borç, alacak, fazla ödeme/tahsilat ve anlaşmaya bağlanmamış doğrudan hareketler
   * ayrı; mahsup yok. Tarih aralığı yalnız hareketleri daraltır, kalanlar günceldir.
   */
  async party(context: CustomerContext, id: string, query: RangeQuery): Promise<PartyReport> {
    assertRange(query);
    const { companyId } = context;
    const party = await forCompany(PartyModel, companyId).findByIdOrThrow(id);

    return withReadSnapshot(async (session) => {
      const agreements = await AgreementModel.find({
        companyId,
        deletedAt: null,
        partyId: party._id,
      })
        .sort({ createdAt: 1 })
        .session(session);
      const transactions = await TransactionModel.find({
        companyId,
        deletedAt: null,
        partyId: party._id,
        ...dateFilter(query),
      })
        .sort({ date: 1, recordNo: 1 })
        .session(session);
      const rows = await transactionRows(companyId, transactions, null, session);
      const today = this.today();
      const obligations = summarizeObligations(agreements, today);
      const linkedRows = rows.filter((row) => row.linkedToAgreement);
      const directRows = rows.filter((row) => !row.linkedToAgreement);
      return {
        header: this.header(context, 'party', {
          subject: party.name,
          scope: `Kişi/firma: ${party.name} (bütün şantiyeler ve firma geneli)`,
          trackingStart: trackingStartOf(agreements),
          range: query,
        }),
        party: { id: party._id.toString(), name: party.name },
        payable: obligations.payable,
        receivable: obligations.receivable,
        openings: obligations.openings,
        agreements: agreementRows(agreements, await agreementMaps(companyId, agreements), today),
        linkedRows,
        linkedTotals: totalsOf(linkedRows),
        directRows,
        directTotals: totalsOf(directRows),
      };
    });
  }

  /** Açık borç/alacak ve vade listesi: başlangıç kayıtları dahil; tamamlanan/arşivlenen şantiyeler dahil. */
  async openBalances(
    context: CustomerContext,
    query: OpenBalancesQuery,
  ): Promise<OpenBalancesReport> {
    const { companyId } = context;
    const target = targetOf(query);
    const today = this.today();

    return withReadSnapshot(async (session) => {
      const scoped = {
        companyId,
        deletedAt: null,
        ...agreementTargetFilter(target),
        ...(query.direction !== 'all' ? { direction: query.direction } : {}),
      };
      const open = await AgreementModel.find({ ...scoped, remaining: { $gt: 0 } })
        .sort({ dueDate: 1, createdAt: 1 })
        .session(session);
      const openings = await AgreementModel.find(
        { ...scoped, kind: 'opening' },
        {
          kind: 1,
          trackingStartDate: 1,
        },
      )
        .session(session)
        .lean();
      const rows = agreementRows(open, await agreementMaps(companyId, open), today);
      const filters =
        query.direction === 'all'
          ? []
          : [
              query.direction === 'payable'
                ? 'Yön: Borç (ödenecek)'
                : 'Yön: Alacak (tahsil edilecek)',
            ];
      return {
        header: this.header(context, 'open-balances', {
          scope: await scopeLabel(companyId, target),
          trackingStart: trackingStartOf(openings),
          filters,
        }),
        summary: summarizeObligations(open, today),
        groups: DUE_ORDER.map((state) => ({
          state,
          rows: rows.filter((row) => row.dueState === state),
        })),
      };
    });
  }

  /**
   * "Bu sonuçları indir": işlem listesinin etkin filtrelerinin bütün sonuçları. Paylaştırılmış
   * kayıtta toplam tutar ve seçili kapsama düşen pay ayrı; toplamlar paylardan.
   */
  async transactionsExport(
    context: CustomerContext,
    query: TransactionsQuery,
  ): Promise<TransactionsReport> {
    assertRange(query);
    const { companyId } = context;
    const { filter, target } = await this.transactions.listFilter(context, query);

    return withReadSnapshot(async (session) => {
      const transactions = await forCompany(TransactionModel, companyId)
        .find(filter, { includeDeleted: query.includeDeleted, session })
        .sort({ ...TRANSACTION_SORTS[query.sort], _id: 1 });
      const openings = await AgreementModel.find(
        {
          companyId,
          deletedAt: null,
          kind: 'opening',
          ...agreementTargetFilter(target),
          ...(query.partyId ? { partyId: filterId(query.partyId) } : {}),
        },
        { kind: 1, trackingStartDate: 1 },
      )
        .session(session)
        .lean();
      const rows = await transactionRows(companyId, transactions, target, session);
      return {
        header: this.header(context, 'transactions', {
          scope: await scopeLabel(companyId, target),
          scoped: target !== null,
          trackingStart: trackingStartOf(openings),
          range: query,
          filters: await this.describeFilters(context, query),
        }),
        rows,
        totals: totalsOf(rows),
      };
    });
  }

  private async describeFilters(context: CustomerContext, query: TransactionsQuery) {
    const id = (value: string | undefined) => (value ? filterId(value) : null);
    const maps = await loadNameMaps(context.companyId, {
      parties: [id(query.partyId)],
      categories: [id(query.categoryId)],
      users: [id(query.createdBy)],
    });
    const filters: string[] = [];
    if (query.kind !== 'all') {
      const label = { income: 'Gelir', expense: 'Gider', refund: 'İade' }[query.kind];
      filters.push(`Tür: ${label}`);
    }
    if (query.noParty) filters.push('Muhatapsız kayıtlar');
    else if (query.partyId)
      filters.push(`Kişi/firma: ${maps.party(id(query.partyId))?.name ?? '—'}`);
    if (query.uncategorized) filters.push('Kategorisiz giderler');
    else if (query.categoryId)
      filters.push(`Kategori: ${maps.category(id(query.categoryId))?.name ?? '—'}`);
    if (query.agreementLink === 'linked') filters.push('Anlaşmaya bağlı');
    if (query.agreementLink === 'unlinked') filters.push('Anlaşmaya bağlı değil');
    if (query.createdBy)
      filters.push(`Kaydı oluşturan: ${maps.actor(id(query.createdBy))?.name ?? '—'}`);
    if (query.amountMin !== undefined) filters.push(`En az ${formatTl(query.amountMin)}`);
    if (query.amountMax !== undefined) filters.push(`En çok ${formatTl(query.amountMax)}`);
    if (query.q) filters.push(`Arama: ${query.q}`);
    if (query.includeDeleted) filters.push('Silinenler dahil (toplamlara katılmaz)');
    return filters;
  }

  /** Dışa aktarma ucu için türüne göre rapor verisi. */
  async build(
    context: CustomerContext,
    type: ReportExportType,
    query: Record<string, unknown>,
  ): Promise<AnyReport> {
    const id = typeof query.id === 'string' ? query.id : '';
    switch (type) {
      case 'period':
        return { type, data: await this.period(context, periodReportQuerySchema.parse(query)) };
      case 'project':
        return {
          type,
          data: await this.project(context, id, reportRangeQuerySchema.parse(query)),
        };
      case 'party':
        return { type, data: await this.party(context, id, reportRangeQuerySchema.parse(query)) };
      case 'open-balances':
        return {
          type,
          data: await this.openBalances(context, openBalancesQuerySchema.parse(query)),
        };
      case 'transactions':
        return {
          type,
          data: await this.transactionsExport(context, transactionsExportQuerySchema.parse(query)),
        };
    }
  }
}
