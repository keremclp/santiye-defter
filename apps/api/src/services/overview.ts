// Pano, vadeler, arama, silinenler ve güvenli tekrar sorgusu (şartname 7.1, 7.7–7.9, 9.7, 9.9, 10.6, 10.9).

import {
  addDays,
  DEFAULT_UPCOMING_DAYS,
  DIRECTIONS,
  dueStateOf,
  isIsoDate,
  monthRange,
  overdueDaysOf,
  parseMoney,
} from '@santiye/shared';
import type { QueryFilter } from 'mongoose';
import { z } from 'zod';
import type { AppDeps } from '../deps.js';
import { businessToday } from '../lib/clock.js';
import { AgreementModel, type Agreement } from '../models/agreement.js';
import { IdempotencyRecordModel } from '../models/idempotency-record.js';
import { PartyModel, type Party } from '../models/party.js';
import { ProjectModel, type Project } from '../models/project.js';
import { SearchHistoryModel } from '../models/search-history.js';
import { TransactionModel, type Transaction } from '../models/transaction.js';
import type { CustomerContext } from './customer-auth.js';
import {
  agreementLabel,
  loadNameMaps,
  presentAgreement,
  presentProject,
  presentTransaction,
  transactionRefs,
} from './finance-presenters.js';
import { cashTotals } from './ledger.js';
import { obligationSummary } from './obligations.js';
import { foldedContains } from './projects.js';
import { paginationSchema, toObjectId } from './records.js';
import type { TransactionService } from './transactions.js';

const LIST_LIMIT = 5;
const DASHBOARD_UPCOMING_DAYS = 14;
const SEARCH_GROUP_LIMIT = 20;
const SEARCH_HISTORY_SHOWN = 3;
const SEARCH_HISTORY_KEPT = 20;

const optionalDate = z
  .string()
  .optional()
  .refine((value) => value === undefined || isIsoDate(value), 'Tarih YYYY-AA-GG biçiminde olmalı.');

export const duesQuerySchema = paginationSchema.extend({
  direction: z.enum(DIRECTIONS).default('payable'),
  group: z.enum(['overdue', 'upcoming', 'later', 'none']).default('overdue'),
  from: optionalDate,
  to: optionalDate,
});

export const searchQuerySchema = z.object({
  q: z.string().trim().default(''),
  saveHistory: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  projectId: z.string().optional(),
  type: z.enum(['project', 'party', 'agreement', 'transaction']).optional(),
  dateFrom: optionalDate,
  dateTo: optionalDate,
});

export const deletedQuerySchema = paginationSchema.extend({
  type: z.enum(['transaction', 'agreement', 'project', 'party']).default('transaction'),
});

/** "12.500" tek tutar, "10.000-20.000" aralık (kuruşa çevrilmiş). */
function amountQuery(q: string): { $gte: number; $lte: number } | number | null {
  const range = /^(.+?)\s*-\s*(.+)$/.exec(q);
  if (range) {
    const min = parseMoney(range[1] ?? '');
    const max = parseMoney(range[2] ?? '');
    if (min.ok && max.ok && min.value <= max.value) return { $gte: min.value, $lte: max.value };
  }
  const single = parseMoney(q);
  return single.ok && single.value > 0 ? single.value : null;
}

export class OverviewService {
  constructor(
    private readonly deps: AppDeps,
    private readonly transactions: TransactionService,
  ) {}

  private today() {
    return businessToday(this.deps.clock);
  }

  /**
   * Firma geneli özet: tamamlanan ve arşivlenen şantiyeler dahil. Toplamlar hareket tutarından,
   * kalan ve gecikmiş tutarlar anlaşma önbelleklerinden paylaşılan fonksiyonlarla.
   */
  async dashboard(context: CustomerContext) {
    const { companyId } = context;
    const today = this.today();
    const month = monthRange(today);
    const [
      totals,
      monthly,
      obligations,
      activeProjectCount,
      recent,
      openAgreements,
      recentProjects,
    ] = await Promise.all([
      cashTotals(companyId, {}, null),
      cashTotals(companyId, { date: { $gte: month.from, $lte: month.to } }, null),
      obligationSummary(companyId, {}, today),
      ProjectModel.countDocuments({ companyId, deletedAt: null, status: 'active' }),
      TransactionModel.find({ companyId, deletedAt: null })
        .sort({ date: -1, recordNo: -1 })
        .limit(LIST_LIMIT),
      AgreementModel.find({ companyId, deletedAt: null, remaining: { $gt: 0 } }).sort({
        dueDate: 1,
        createdAt: 1,
      }),
      ProjectModel.find({ companyId, deletedAt: null, lastUsedAt: { $ne: null } })
        .sort({ lastUsedAt: -1 })
        .limit(LIST_LIMIT),
    ]);

    const dueSoon = openAgreements
      .filter((agreement) => {
        const state = dueStateOf(agreement, today, DASHBOARD_UPCOMING_DAYS);
        return state === 'overdue' || state === 'upcoming';
      })
      .slice(0, LIST_LIMIT);
    const shownAgreements = [
      ...new Map(
        [...dueSoon, ...openAgreements.slice(0, LIST_LIMIT)].map((a) => [a._id.toString(), a]),
      ).values(),
    ];
    const maps = await loadNameMaps(companyId, {
      ...transactionRefs(recent),
      projects: [...transactionRefs(recent).projects, ...shownAgreements.map((a) => a.projectId)],
      parties: [...transactionRefs(recent).parties, ...shownAgreements.map((a) => a.partyId)],
    });
    const presentDue = (agreement: Agreement) => ({
      ...presentAgreement(agreement, maps),
      dueState: dueStateOf(agreement, today, DASHBOARD_UPCOMING_DAYS),
      overdueDays: agreement.dueDate ? overdueDaysOf(agreement.dueDate, today) : 0,
    });

    return {
      scope: 'Firma geneli — tüm şantiyeler',
      totals: {
        netIncome: totals.netIncome,
        netExpense: totals.netExpense,
        difference: totals.difference,
        remainingPayable: obligations.payable.remaining,
        remainingReceivable: obligations.receivable.remaining,
        overduePayable: obligations.payable.overdue,
        overdueReceivable: obligations.receivable.overdue,
        excessPayable: obligations.payable.excess,
        excessReceivable: obligations.receivable.excess,
      },
      activeProjectCount,
      monthly: {
        month: today.slice(0, 7),
        netIncome: monthly.netIncome,
        netExpense: monthly.netExpense,
        difference: monthly.difference,
      },
      recentTransactions: recent.map((transaction) => presentTransaction(transaction, maps)),
      dueSoon: dueSoon.map(presentDue),
      openAgreements: openAgreements.slice(0, LIST_LIMIT).map(presentDue),
      recentProjects: recentProjects.map((project) => presentProject(project, maps)),
      generatedAt: this.deps.clock.now().toISOString(),
    };
  }

  /**
   * Gecikmiş, yaklaşan, daha sonra ve vadesiz açık tutarlar; tamamlanan/arşivlenen şantiyeler dahil.
   * "Daha sonra" yaklaşan penceresinin (`to`) ötesindeki vadelerdir.
   */
  async dues(context: CustomerContext, query: z.infer<typeof duesQuerySchema>) {
    const today = this.today();
    const from = query.from ?? today;
    const to = query.to ?? addDays(today, DEFAULT_UPCOMING_DAYS);
    const open = await AgreementModel.find({
      companyId: context.companyId,
      deletedAt: null,
      direction: query.direction,
      remaining: { $gt: 0 },
    }).sort({ dueDate: 1, createdAt: 1 });

    const matching = open.filter((agreement) => {
      const state = dueStateOf(agreement, today);
      if (query.group === 'overdue') return state === 'overdue';
      if (query.group === 'none') return state === 'none';
      if (state === 'overdue' || state === 'none') return false;
      if (query.group === 'later') return agreement.dueDate! > to;
      return agreement.dueDate! >= from && agreement.dueDate! <= to;
    });
    const page = matching.slice((query.page - 1) * query.limit, query.page * query.limit);
    const maps = await loadNameMaps(context.companyId, {
      projects: page.map((a) => a.projectId),
      parties: page.map((a) => a.partyId),
      users: page.flatMap((a) => [a.createdBy, a.updatedBy]),
    });
    return {
      items: page.map((agreement) => ({
        ...presentAgreement(agreement, maps),
        overdueDays: agreement.dueDate ? overdueDaysOf(agreement.dueDate, today) : 0,
      })),
      page: query.page,
      limit: query.limit,
      total: matching.length,
      range: query.group === 'upcoming' || query.group === 'later' ? { from, to } : null,
    };
  }

  /** Dört grupta arama; firmanın bütün kayıtlarında, silinmişler hariç. */
  async search(context: CustomerContext, query: z.infer<typeof searchQuerySchema>) {
    const { companyId } = context;
    if (!query.q)
      return {
        query: '',
        projects: [],
        parties: [],
        agreements: [],
        transactions: [],
        history: await this.history(context),
      };

    const folded = foldedContains(query.q);
    const amount = amountQuery(query.q);
    const projectId = query.projectId ? (toObjectId(query.projectId) ?? undefined) : undefined;
    const wants = (type: string) => !query.type || query.type === type;
    const dateRange =
      query.dateFrom || query.dateTo
        ? {
            ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
            ...(query.dateTo ? { $lte: query.dateTo } : {}),
          }
        : null;

    const projectFilter: QueryFilter<Project> = {
      companyId,
      deletedAt: null,
      nameFolded: folded,
      ...(projectId ? { _id: projectId } : {}),
    };
    const digits = query.q.replace(/\D/g, '');
    const partyFilter: QueryFilter<Party> = {
      companyId,
      deletedAt: null,
      $or: [
        { nameFolded: folded },
        ...(digits.length >= 3 ? [{ phone: { $regex: digits.split('').join('\\D*') } }] : []),
      ],
    };
    const agreementFilter: QueryFilter<Agreement> = {
      companyId,
      deletedAt: null,
      $or: [
        { titleFolded: folded },
        { descriptionFolded: folded },
        ...(amount !== null ? [{ currentAmount: amount }, { initialAmount: amount }] : []),
      ],
      ...(projectId ? { projectId } : {}),
      ...(dateRange
        ? { $and: [{ $or: [{ agreementDate: dateRange }, { trackingStartDate: dateRange }] }] }
        : {}),
    };
    const transactionFilter: QueryFilter<Transaction> = {
      companyId,
      deletedAt: null,
      ...(await this.transactions.searchCondition(context, query.q)),
      ...(projectId ? { 'allocations.projectId': projectId } : {}),
      ...(dateRange ? { date: dateRange } : {}),
    };
    if (amount !== null && typeof amount !== 'number') {
      (transactionFilter.$or as object[]).push({ amount });
    }

    const [projects, parties, agreements, transactions, counts] = await Promise.all([
      wants('project')
        ? ProjectModel.find(projectFilter).sort({ lastUsedAt: -1 }).limit(SEARCH_GROUP_LIMIT)
        : [],
      wants('party')
        ? PartyModel.find(partyFilter).sort({ lastUsedAt: -1 }).limit(SEARCH_GROUP_LIMIT)
        : [],
      wants('agreement')
        ? AgreementModel.find(agreementFilter).sort({ createdAt: -1 }).limit(SEARCH_GROUP_LIMIT)
        : [],
      wants('transaction')
        ? TransactionModel.find(transactionFilter)
            .sort({ date: -1, recordNo: -1 })
            .limit(SEARCH_GROUP_LIMIT)
        : [],
      Promise.all([
        wants('project') ? ProjectModel.countDocuments(projectFilter) : 0,
        wants('party') ? PartyModel.countDocuments(partyFilter) : 0,
        wants('agreement') ? AgreementModel.countDocuments(agreementFilter) : 0,
        wants('transaction') ? TransactionModel.countDocuments(transactionFilter) : 0,
      ]),
    ]);

    if (query.saveHistory) await this.saveHistory(context, query.q);
    const maps = await loadNameMaps(companyId, {
      ...transactionRefs(transactions),
      projects: [...transactionRefs(transactions).projects, ...agreements.map((a) => a.projectId)],
      parties: [...transactionRefs(transactions).parties, ...agreements.map((a) => a.partyId)],
    });
    return {
      query: query.q,
      projects: projects.map((p) => ({ id: p._id.toString(), name: p.name, status: p.status })),
      parties: parties.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        kind: p.kind,
        phone: p.phone,
        isActive: p.isActive,
      })),
      agreements: agreements.map((a) => ({
        id: a._id.toString(),
        label: agreementLabel(a),
        kind: a.kind,
        direction: a.direction,
        party: maps.party(a.partyId),
        project: maps.project(a.projectId),
        currentAmount: a.currentAmount,
        remaining: a.remaining,
      })),
      transactions: transactions.map((t) => presentTransaction(t, maps)),
      totals: {
        projects: counts[0],
        parties: counts[1],
        agreements: counts[2],
        transactions: counts[3],
      },
    };
  }

  private async saveHistory(context: CustomerContext, query: string) {
    await SearchHistoryModel.deleteMany({
      companyId: context.companyId,
      userId: context.userId,
      query,
    });
    await SearchHistoryModel.create({
      companyId: context.companyId,
      userId: context.userId,
      query,
    });
    const stale = await SearchHistoryModel.find({
      companyId: context.companyId,
      userId: context.userId,
    })
      .sort({ createdAt: -1, _id: -1 })
      .skip(SEARCH_HISTORY_KEPT)
      .select({ _id: 1 });
    if (stale.length > 0)
      await SearchHistoryModel.deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  }

  /** Yalnız bu kullanıcının son üç araması. */
  async history(context: CustomerContext) {
    const items = await SearchHistoryModel.find({
      companyId: context.companyId,
      userId: context.userId,
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(SEARCH_HISTORY_SHOWN);
    return items.map((item) => ({ query: item.query, createdAt: item.createdAt.toISOString() }));
  }

  async clearHistory(context: CustomerContext) {
    await SearchHistoryModel.deleteMany({ companyId: context.companyId, userId: context.userId });
  }

  /** Silinen kayıtlar; silen kişi, zaman ve gerekçeyle. */
  async deleted(context: CustomerContext, query: z.infer<typeof deletedQuerySchema>) {
    const { companyId } = context;
    const filter = { companyId, deletedAt: { $ne: null } };
    const skip = (query.page - 1) * query.limit;
    const sort = { deletedAt: -1 } as const;

    const load = async () => {
      switch (query.type) {
        case 'transaction': {
          const [rows, total] = await Promise.all([
            TransactionModel.find(filter).sort(sort).skip(skip).limit(query.limit),
            TransactionModel.countDocuments(filter),
          ]);
          return {
            rows,
            total,
            label: (t: Transaction) => `#${t.recordNo} ${t.description}`.trim(),
            amount: (t: Transaction) => t.amount,
          };
        }
        case 'agreement': {
          const [rows, total] = await Promise.all([
            AgreementModel.find(filter).sort(sort).skip(skip).limit(query.limit),
            AgreementModel.countDocuments(filter),
          ]);
          return {
            rows,
            total,
            label: (a: Agreement) => agreementLabel(a),
            amount: (a: Agreement) => a.currentAmount,
          };
        }
        case 'project': {
          const [rows, total] = await Promise.all([
            ProjectModel.find(filter).sort(sort).skip(skip).limit(query.limit),
            ProjectModel.countDocuments(filter),
          ]);
          return { rows, total, label: (p: Project) => p.name, amount: () => null };
        }
        default: {
          const [rows, total] = await Promise.all([
            PartyModel.find(filter).sort(sort).skip(skip).limit(query.limit),
            PartyModel.countDocuments(filter),
          ]);
          return { rows, total, label: (p: Party) => p.name, amount: () => null };
        }
      }
    };

    const { rows, total, label, amount } = (await load()) as {
      rows: (Transaction | Agreement | Project | Party)[];
      total: number;
      label: (row: never) => string;
      amount: (row: never) => number | null;
    };
    const maps = await loadNameMaps(companyId, { users: rows.map((row) => row.deletedBy) });
    return {
      items: rows.map((row) => ({
        type: query.type,
        id: row._id.toString(),
        label: label(row as never),
        amount: amount(row as never),
        deletedAt: row.deletedAt?.toISOString() ?? null,
        deletedBy: maps.actor(row.deletedBy),
        deleteReason: row.deleteReason,
        updatedAt: row.updatedAt.toISOString(),
      })),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  /** "Kaydın durumu doğrulanıyor": aynı anahtarla gönderilen isteğin sonucu (yalnız bu firma). */
  async idempotencyStatus(context: CustomerContext, key: string) {
    const record = await IdempotencyRecordModel.findOne({
      companyId: context.companyId,
      key: key.toLowerCase(),
    });
    if (!record?.resultRef) return { status: 'not_found' as const };
    return {
      status: 'done' as const,
      resultRef: { type: record.resultRef.type, id: record.resultRef.id },
    };
  }
}
