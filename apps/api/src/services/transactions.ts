// Gelir, gider ve iadeler (şartname 7.4, 7.5, 8.6, 9.1, 9.2, 9.4, 9.5, 10.6).

import {
  detectExcess,
  excessMessage,
  foldTurkish,
  isIsoDate,
  parseMoney,
  refundAllocationsFor,
  refundKindOf,
  validateAllocationChangesAgainstRefunds,
  validateRefund,
  validateTransactionAllocations,
  type AgreementRef,
  type AllocationInput,
  type CashKind,
  type RefundCreateInput,
  type RefundableAllocation,
  type TransactionCorrectionInput,
  type TransactionCreateInput,
  type ValidationIssue,
} from '@santiye/shared';
import { Types, type ClientSession, type QueryFilter } from 'mongoose';
import { z } from 'zod';
import { forCompany, notFound } from '../db/company-scope.js';
import { withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { businessToday } from '../lib/clock.js';
import { AgreementModel } from '../models/agreement.js';
import { CategoryModel } from '../models/category.js';
import { PartyModel } from '../models/party.js';
import { ProjectModel } from '../models/project.js';
import {
  TransactionModel,
  type Allocation,
  type Transaction,
  type TransactionDocument,
} from '../models/transaction.js';
import type { CustomerContext } from './customer-auth.js';
import { documentsOf } from './documents.js';
import {
  emptyNameMaps,
  historyActors,
  loadNameMaps,
  presentHistory,
  presentTransaction,
  transactionRefs,
} from './finance-presenters.js';
import type { IdempotentOutcome } from './idempotency.js';
import {
  cashTotals,
  nextRecordNo,
  recalculateAgreements,
  recalculateRefunds,
  remainingExcluding,
  scopedAmount,
  type CashTarget,
} from './ledger.js';
import { foldedContains } from './projects.js';
import {
  assertSameVersion,
  conflictWithIssues,
  historyEntry,
  paginationSchema,
  queryList,
  requireReason,
  toObjectId,
  validationError,
} from './records.js';

/** Hiçbir kayda uymayan kimlik (geçersiz filtre değerleri için). */
const NO_MATCH = new Types.ObjectId('ffffffffffffffffffffffff');
const filterId = (value: string | undefined) =>
  value ? (toObjectId(value) ?? NO_MATCH) : undefined;
const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');
const optionalDate = z
  .string()
  .optional()
  .refine((value) => value === undefined || isIsoDate(value), 'Tarih YYYY-AA-GG biçiminde olmalı.');

export const transactionListQuerySchema = paginationSchema.extend({
  dateFrom: optionalDate,
  dateTo: optionalDate,
  kind: z.enum(['all', 'income', 'expense', 'refund']).default('all'),
  projectId: z
    .unknown()
    .optional()
    .transform((value) => queryList(value)),
  /** `company`: firma geneli kayıtlar */
  scope: z.enum(['company']).optional(),
  partyId: z.string().optional(),
  categoryId: z.string().optional(),
  createdBy: z.string().optional(),
  agreementLink: z.enum(['linked', 'unlinked']).optional(),
  uncategorized: flag,
  noParty: flag,
  amountMin: z.coerce.number().int().min(0).optional(),
  amountMax: z.coerce.number().int().min(0).optional(),
  includeDeleted: flag,
  q: z.string().trim().optional(),
  sort: z.enum(['newest', 'oldest', 'amount_desc', 'amount_asc']).default('newest'),
});

type ListQuery = z.infer<typeof transactionListQuerySchema>;

export const TRANSACTION_SORTS = {
  newest: { date: -1, recordNo: -1 },
  oldest: { date: 1, recordNo: 1 },
  amount_desc: { amount: -1, recordNo: -1 },
  amount_asc: { amount: 1, recordNo: 1 },
} as const;

interface AllocationDraft {
  id?: Types.ObjectId;
  scope: Allocation['scope'];
  projectId: Types.ObjectId | null;
  agreementId: Types.ObjectId | null;
  amount: number;
}

function toDraft(input: {
  id?: string | undefined;
  scope: Allocation['scope'];
  projectId?: string | undefined;
  agreementId?: string | undefined;
  amount: number;
}): AllocationDraft {
  return {
    ...(input.id ? { id: new Types.ObjectId(input.id) } : {}),
    scope: input.scope,
    projectId: toObjectId(input.projectId),
    agreementId: toObjectId(input.agreementId),
    amount: input.amount,
  };
}

/** Paylaşılan doğrulama fonksiyonlarının beklediği metin kimlikli biçim. */
function asInput(allocation: AllocationDraft): AllocationInput & { id?: string } {
  return {
    ...(allocation.id ? { id: allocation.id.toString() } : {}),
    scope: allocation.scope,
    projectId: allocation.projectId?.toString() ?? null,
    agreementId: allocation.agreementId?.toString() ?? null,
    amount: allocation.amount,
  };
}

function asRefundable(
  allocation: Allocation,
  refundedAmount = allocation.refundedAmount,
): RefundableAllocation {
  return {
    id: allocation._id.toString(),
    scope: allocation.scope,
    projectId: allocation.projectId?.toString() ?? null,
    agreementId: allocation.agreementId?.toString() ?? null,
    amount: allocation.amount,
    refundedAmount,
  };
}

const targetKey = (allocation: {
  scope: string;
  projectId: Types.ObjectId | null;
  agreementId: Types.ObjectId | null;
  amount?: number;
}) =>
  `${allocation.scope}|${allocation.projectId?.toString() ?? ''}|${allocation.agreementId?.toString() ?? ''}|${allocation.amount ?? ''}`;

function refundIssuesError(issues: ValidationIssue[]): AppError {
  const limit = issues.find((issue) => issue.code === 'REFUND_LIMIT_EXCEEDED');
  if (!limit) return validationError(issues);
  return new AppError('LIMIT_EXCEEDED', limit.message, {
    issues: issues.map(({ code, message, path }) => ({ code, message, path: path.join('.') })),
  });
}

type ValidationMode = 'create' | 'correct' | 'restore';

export class TransactionService {
  constructor(private readonly deps: AppDeps) {}

  private today() {
    return businessToday(this.deps.clock);
  }

  private async present(
    context: CustomerContext,
    transactions: Transaction[],
    withHistory = false,
  ) {
    const refs = transactionRefs(transactions);
    const maps = await loadNameMaps(context.companyId, {
      ...refs,
      users: [...refs.users, ...(withHistory ? historyActors(transactions) : [])],
    });
    return transactions.map((transaction) => ({
      ...presentTransaction(transaction, maps),
      ...(withHistory ? { history: presentHistory(transaction.history, maps) } : {}),
    }));
  }

  // ── Doğrulama ────────────────────────────────────────────────────────────────

  /**
   * Gelir/gider: kayıtlar firmaya ait ve silinmemiş olmalı; paylaşılan pay doğrulaması (toplam,
   * yön, kapsam, kişi); tamamlanan veya arşivlenen şantiyeye anlaşmasız gider gerekçe ister.
   */
  private async validateCash(
    context: CustomerContext,
    input: {
      kind: CashKind;
      amount: number;
      partyId: Types.ObjectId | null;
      categoryId: Types.ObjectId | null;
      allocations: AllocationDraft[];
      reason?: string | undefined;
      checkCategoryActive: boolean;
    },
    mode: ValidationMode,
    session: ClientSession,
  ): Promise<ValidationIssue[]> {
    const { companyId } = context;
    const restoring = mode === 'restore';
    const issues: ValidationIssue[] = [];

    const projectIds = input.allocations
      .map((a) => a.projectId)
      .filter((id): id is Types.ObjectId => id !== null);
    const agreementIds = input.allocations
      .map((a) => a.agreementId)
      .filter((id): id is Types.ObjectId => id !== null);
    const [projects, agreements, party, category] = await Promise.all([
      ProjectModel.find({ companyId, deletedAt: null, _id: { $in: projectIds } }).session(session),
      AgreementModel.find({ companyId, deletedAt: null, _id: { $in: agreementIds } }).session(
        session,
      ),
      input.partyId
        ? PartyModel.findOne({ companyId, deletedAt: null, _id: input.partyId }).session(session)
        : null,
      input.categoryId
        ? CategoryModel.findOne({ companyId, deletedAt: null, _id: input.categoryId }).session(
            session,
          )
        : null,
    ]);
    const projectById = new Map(projects.map((p) => [p._id.toString(), p]));

    input.allocations.forEach((allocation, index) => {
      if (allocation.projectId && !projectById.has(allocation.projectId.toString())) {
        issues.push({
          code: 'PROJECT_NOT_FOUND',
          message: restoring
            ? 'Şantiye silinmiş. Önce şantiyeyi geri yükleyin.'
            : 'Şantiye bulunamadı.',
          path: ['allocations', index, 'projectId'],
        });
      }
    });
    if (input.partyId && !party) {
      issues.push({
        code: 'PARTY_NOT_FOUND',
        message: restoring
          ? 'Kişi/firma silinmiş. Önce kişiyi geri yükleyin.'
          : 'Kişi/firma bulunamadı.',
        path: ['partyId'],
      });
    }
    if (input.categoryId) {
      if (input.kind !== 'expense') {
        issues.push({
          code: 'CATEGORY_INVALID',
          message: 'Gider kategorisi yalnız giderde seçilebilir.',
          path: ['categoryId'],
        });
      } else if (!category) {
        issues.push({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Kategori bulunamadı.',
          path: ['categoryId'],
        });
      } else if (input.checkCategoryActive && !category.isActive) {
        issues.push({
          code: 'CATEGORY_INACTIVE',
          message: 'Pasif kategori seçilemez.',
          path: ['categoryId'],
        });
      }
    }

    const refs = new Map<string, AgreementRef>(
      agreements.map((agreement) => [
        agreement._id.toString(),
        {
          direction: agreement.direction,
          scope: agreement.scope,
          projectId: agreement.projectId?.toString() ?? null,
          partyId: agreement.partyId.toString(),
        },
      ]),
    );
    const shared = validateTransactionAllocations(
      {
        kind: input.kind,
        amount: input.amount,
        partyId: input.partyId?.toString() ?? null,
        allocations: input.allocations.map(asInput),
      },
      refs,
    );
    for (const issue of shared) {
      issues.push(
        restoring && issue.code === 'AGREEMENT_NOT_FOUND'
          ? { ...issue, message: 'Bağlı anlaşma silinmiş. Önce anlaşmayı geri yükleyin.' }
          : issue,
      );
    }

    if (mode === 'create' && input.kind === 'expense' && !input.reason?.trim()) {
      const closed = input.allocations.some((allocation) => {
        const project = allocation.projectId
          ? projectById.get(allocation.projectId.toString())
          : undefined;
        return !allocation.agreementId && project !== undefined && project.status !== 'active';
      });
      if (closed) {
        issues.push({
          code: 'REASON_REQUIRED',
          message:
            'Tamamlanan veya arşivlenen şantiyeye anlaşmaya bağlı olmayan gider için gerekçe girin.',
          path: ['reason'],
        });
      }
    }
    return issues;
  }

  /**
   * Fazla ödeme/tahsilat engellenmez ama onaysız kaydedilmez: kalan aşılıyorsa ve onay + gerekçe
   * yoksa 409 EXCESS_CONFIRMATION_REQUIRED ve aşan tutar döner.
   */
  private async checkExcess(
    context: CustomerContext,
    kind: CashKind,
    allocations: AllocationDraft[],
    excludeTransactionId: Types.ObjectId | undefined,
    confirmation: { confirmExcess?: boolean | undefined; excessReason?: string | undefined },
    session: ClientSession,
  ): Promise<{ amount: number; reason: string } | null> {
    const agreementIds = allocations
      .map((a) => a.agreementId)
      .filter((id): id is Types.ObjectId => id !== null);
    if (agreementIds.length === 0) return null;
    const agreements = await AgreementModel.find({
      companyId: context.companyId,
      _id: { $in: agreementIds },
    }).session(session);
    const remaining = await remainingExcluding(
      context.companyId,
      agreements,
      excludeTransactionId,
      session,
    );
    const excess = detectExcess(allocations.map(asInput), remaining);
    if (excess.total === 0) return null;

    const reason = confirmation.excessReason?.trim();
    if (!confirmation.confirmExcess || !reason) {
      throw new AppError('EXCESS_CONFIRMATION_REQUIRED', excessMessage(kind, excess.total), {
        excess: excess.total,
        byAgreement: excess.byAgreement,
      });
    }
    return { amount: excess.total, reason };
  }

  private async touch(context: CustomerContext, transaction: Transaction, session: ClientSession) {
    const now = this.deps.clock.now();
    const options = { session, timestamps: false };
    const projectIds = transaction.allocations.map((a) => a.projectId).filter(Boolean);
    if (projectIds.length > 0) {
      await ProjectModel.updateMany(
        { companyId: context.companyId, _id: { $in: projectIds } },
        { lastUsedAt: now },
        options,
      );
    }
    if (transaction.partyId) {
      await PartyModel.updateOne(
        { companyId: context.companyId, _id: transaction.partyId },
        { lastUsedAt: now },
        options,
      );
    }
  }

  /** Aynı gün, tutar, kişi ve kapsamda başka kayıt varsa uyarı; engellemez. */
  private async duplicateWarnings(
    context: CustomerContext,
    transaction: Transaction,
    session: ClientSession,
  ) {
    const candidates = await TransactionModel.find({
      companyId: context.companyId,
      deletedAt: null,
      _id: { $ne: transaction._id },
      kind: transaction.kind,
      date: transaction.date,
      amount: transaction.amount,
      partyId: transaction.partyId,
    }).session(session);
    const scopes = (t: Transaction) =>
      t.allocations
        .map((a) => `${a.scope}|${a.projectId?.toString() ?? ''}`)
        .sort()
        .join(',');
    const same = candidates.filter((candidate) => scopes(candidate) === scopes(transaction));
    if (same.length === 0) return [];
    return [
      {
        code: 'POSSIBLE_DUPLICATE',
        message:
          'Aynı gün, aynı tutar, kişi ve kapsamda başka kayıt var. Mükerrer olmadığından emin olun.',
        related: same.map((t) => ({ id: t._id.toString(), recordNo: t.recordNo })),
      },
    ];
  }

  // ── Oluşturma ────────────────────────────────────────────────────────────────

  /** Para hareketi, payları, anlaşma önbellekleri ve geçmiş tek transaction'da yazılır. */
  async create(context: CustomerContext, input: TransactionCreateInput, session: ClientSession) {
    const allocations = input.allocations.map(toDraft);
    const partyId = toObjectId(input.partyId);
    const categoryId = toObjectId(input.categoryId);
    const issues = await this.validateCash(
      context,
      {
        kind: input.kind,
        amount: input.amount,
        partyId,
        categoryId,
        allocations,
        reason: input.reason,
        checkCategoryActive: true,
      },
      'create',
      session,
    );
    if (issues.length > 0) throw validationError(issues);
    const excess = await this.checkExcess(
      context,
      input.kind,
      allocations,
      undefined,
      input,
      session,
    );

    const transaction = new TransactionModel({
      companyId: context.companyId,
      recordNo: await nextRecordNo(context.companyId, session),
      kind: input.kind,
      amount: input.amount,
      date: input.date,
      partyId,
      categoryId,
      description: input.description,
      descriptionFolded: foldTurkish(input.description),
      allocations: allocations.map((allocation) => ({ ...allocation, refundedAmount: 0 })),
      excess,
      createdBy: context.userId,
      updatedBy: context.userId,
      history: [
        historyEntry({
          by: context.userId,
          action: 'create',
          reason: input.reason ?? excess?.reason,
          at: this.deps.clock.now(),
        }),
      ],
    });
    await transaction.save({ session });
    await recalculateAgreements(
      context.companyId,
      allocations.map((a) => a.agreementId),
      session,
    );
    await this.touch(context, transaction, session);

    const [data] = await this.present(context, [transaction]);
    return {
      outcome: {
        status: 201,
        data: { ...data, warnings: await this.duplicateWarnings(context, transaction, session) },
        ...(excess
          ? {
              message:
                input.kind === 'expense' ? 'Fazla ödeme kaydedildi' : 'Fazla tahsilat kaydedildi',
            }
          : {}),
      } satisfies IdempotentOutcome,
      ref: { type: 'transaction', id: transaction._id.toString() },
    };
  }

  async replay(context: CustomerContext, id: string, status: number): Promise<IdempotentOutcome> {
    const transaction = await forCompany(TransactionModel, context.companyId).findByIdOrThrow(id, {
      includeDeleted: true,
    });
    const [data] = await this.present(context, [transaction]);
    return { status, data };
  }

  // ── Okuma ────────────────────────────────────────────────────────────────────

  async get(context: CustomerContext, id: string) {
    const transaction = await forCompany(TransactionModel, context.companyId).findByIdOrThrow(id, {
      includeDeleted: true,
    });
    const refunds = transaction.refundOf
      ? []
      : await TransactionModel.find({
          companyId: context.companyId,
          'refundOf.transactionId': transaction._id,
        }).sort({ date: 1, recordNo: 1 });
    const [data] = await this.present(context, [transaction], true);
    return {
      ...data,
      refunds: await this.present(context, refunds),
      refundable: transaction.refundOf
        ? null
        : transaction.allocations.reduce(
            (sum, a) => sum + Math.max(a.amount - a.refundedAmount, 0),
            0,
          ),
      documents: await documentsOf(context.companyId, 'transaction', transaction._id),
    };
  }

  /** Liste filtresi ve toplam kapsamı; "Bu sonuçları indir" de aynı filtreyi kullanır. */
  async listFilter(context: CustomerContext, query: Omit<ListQuery, 'page' | 'limit'>) {
    const filter: QueryFilter<Transaction> = {};
    if (query.dateFrom || query.dateTo) {
      filter.date = {
        ...(query.dateFrom ? { $gte: query.dateFrom } : {}),
        ...(query.dateTo ? { $lte: query.dateTo } : {}),
      };
    }
    if (query.kind === 'income' || query.kind === 'expense') filter.kind = query.kind;
    if (query.kind === 'refund') filter.kind = { $in: ['expense_refund', 'income_refund'] };

    const projectIds = query.projectId.map((id) => toObjectId(id) ?? NO_MATCH);
    const target: CashTarget | null =
      projectIds.length > 0 || query.scope
        ? { projectIds, company: query.scope === 'company' }
        : null;
    if (target) {
      filter.allocations = {
        $elemMatch: {
          $or: [
            ...(projectIds.length > 0
              ? [{ scope: 'project', projectId: { $in: projectIds } }]
              : []),
            ...(target.company ? [{ scope: 'company' }] : []),
          ],
        },
      };
    }

    if (query.noParty) filter.partyId = null;
    else if (query.partyId) filter.partyId = filterId(query.partyId);
    if (query.uncategorized) Object.assign(filter, { kind: 'expense', categoryId: null });
    else if (query.categoryId) filter.categoryId = filterId(query.categoryId);
    if (query.createdBy) filter.createdBy = filterId(query.createdBy);
    if (query.agreementLink === 'linked') filter['allocations.agreementId'] = { $ne: null };
    if (query.agreementLink === 'unlinked') {
      filter.$and = [
        ...(filter.$and ?? []),
        { allocations: { $not: { $elemMatch: { agreementId: { $ne: null } } } } },
      ];
    }
    if (query.amountMin !== undefined || query.amountMax !== undefined) {
      filter.amount = {
        ...(query.amountMin !== undefined ? { $gte: query.amountMin } : {}),
        ...(query.amountMax !== undefined ? { $lte: query.amountMax } : {}),
      };
    }
    if (query.q)
      filter.$and = [...(filter.$and ?? []), await this.searchCondition(context, query.q)];
    return { filter, target };
  }

  /** Açıklama, kişi adı, şantiye/anlaşma adı, kayıt numarası ve tutar; Türkçe katlamalı. */
  async searchCondition(context: CustomerContext, q: string): Promise<QueryFilter<Transaction>> {
    const { companyId } = context;
    const folded = foldedContains(q);
    const [parties, projects, agreements] = await Promise.all([
      PartyModel.find({ companyId, nameFolded: folded }, { _id: 1 }).lean(),
      ProjectModel.find({ companyId, nameFolded: folded }, { _id: 1 }).lean(),
      AgreementModel.find({ companyId, titleFolded: folded }, { _id: 1 }).lean(),
    ]);
    const conditions: QueryFilter<Transaction>[] = [{ descriptionFolded: folded }];
    if (parties.length > 0) conditions.push({ partyId: { $in: parties.map((p) => p._id) } });
    if (projects.length > 0)
      conditions.push({ 'allocations.projectId': { $in: projects.map((p) => p._id) } });
    if (agreements.length > 0)
      conditions.push({ 'allocations.agreementId': { $in: agreements.map((a) => a._id) } });
    const text = q.replace(/\s/g, '').replace(/^#/, '');
    if (/^\d+$/.test(text)) conditions.push({ recordNo: Number(text) });
    const money = parseMoney(q);
    if (money.ok && money.value > 0) conditions.push({ amount: money.value });
    return { $or: conditions };
  }

  /** Sayfalı liste; `totals` bütün filtrelenmiş sonuçları kapsar, şantiye filtresinde paylardan. */
  async list(context: CustomerContext, query: ListQuery) {
    const { filter, target } = await this.listFilter(context, query);
    const scope = forCompany(TransactionModel, context.companyId);
    const options = { includeDeleted: query.includeDeleted };
    const [transactions, total, totals] = await Promise.all([
      scope
        .find(filter, options)
        .sort(TRANSACTION_SORTS[query.sort])
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      scope.countDocuments(filter, options),
      cashTotals(context.companyId, filter, target),
    ]);
    const items = (await this.present(context, transactions)).map((item, index) => ({
      ...item,
      scopedAmount: target ? scopedAmount(transactions[index]!, target) : item.amount,
    }));
    return { items, page: query.page, limit: query.limit, total, totals };
  }

  /** Son açıklama önerileri. */
  async suggestions(context: CustomerContext, kind: CashKind | undefined) {
    const rows = await TransactionModel.aggregate<{ _id: string }>([
      {
        $match: {
          companyId: context.companyId,
          deletedAt: null,
          description: { $ne: '' },
          ...(kind ? { kind } : {}),
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      { $group: { _id: '$description', last: { $max: '$createdAt' } } },
      { $sort: { last: -1 } },
      { $limit: 10 },
    ]);
    return rows.map((row) => row._id);
  }

  /** Kopya taslağı: aynı alanlar, tarih bugün; kaydedilmez, anlaşma bağlantısı yeniden onaylanır. */
  async duplicateDraft(context: CustomerContext, id: string) {
    const source = await forCompany(TransactionModel, context.companyId).findByIdOrThrow(id);
    if (source.kind !== 'income' && source.kind !== 'expense') {
      throw new AppError('CONFLICT', 'İade kaydı kopyalanamaz.');
    }
    return {
      sourceTransactionId: source._id.toString(),
      kind: source.kind,
      amount: source.amount,
      date: this.today(),
      partyId: source.partyId?.toString() ?? null,
      categoryId: source.categoryId?.toString() ?? null,
      description: source.description,
      allocations: source.allocations.map((allocation) => ({
        scope: allocation.scope,
        projectId: allocation.projectId?.toString() ?? null,
        agreementId: allocation.agreementId?.toString() ?? null,
        amount: allocation.amount,
      })),
      agreementConfirmationRequired: source.allocations.some(
        (allocation) => allocation.agreementId !== null,
      ),
    };
  }

  // ── Düzeltme ─────────────────────────────────────────────────────────────────

  private async loadForChange(
    context: CustomerContext,
    id: string,
    expectedUpdatedAt: string,
    session: ClientSession,
    includeDeleted = false,
  ) {
    const transaction = await forCompany(TransactionModel, context.companyId).findById(id, {
      includeDeleted,
      session,
    });
    if (!transaction) throw notFound();
    assertSameVersion(transaction.updatedAt, expectedUpdatedAt, () =>
      presentTransaction(transaction, emptyNameMaps),
    );
    return transaction;
  }

  /**
   * Finansal düzeltme: tutar, tarih, kapsam, kişi, anlaşma veya paylar değişirse gerekçe zorunlu;
   * eski ve yeni anlaşma bakiyeleri aynı transaction'da güncellenir. Bağlı iadeyi tutarsız
   * bırakan değişiklik engellenir.
   */
  async correct(context: CustomerContext, id: string, input: TransactionCorrectionInput) {
    return withTransaction(async (session) => {
      const transaction = await this.loadForChange(context, id, input.expectedUpdatedAt, session);
      if (transaction.refundOf) return this.correctRefund(context, transaction, input, session);
      if (input.parts) {
        throw validationError([
          {
            code: 'PARTS_NOT_ALLOWED',
            message: 'İade payları yalnız iade kaydında değiştirilebilir.',
            path: ['parts'],
          },
        ]);
      }
      const kind = transaction.kind as CashKind;
      const existingIds = new Set(transaction.allocations.map((a) => a._id.toString()));
      const unknownAllocation =
        input.allocations?.findIndex((a) => a.id !== undefined && !existingIds.has(a.id)) ?? -1;
      if (unknownAllocation >= 0) {
        throw validationError([
          {
            code: 'ALLOCATION_NOT_FOUND',
            message: 'Pay bulunamadı.',
            path: ['allocations', unknownAllocation, 'id'],
          },
        ]);
      }

      const amount = input.amount ?? transaction.amount;
      const current: AllocationDraft[] = transaction.allocations.map((a) => ({
        id: a._id,
        scope: a.scope,
        projectId: a.projectId,
        agreementId: a.agreementId,
        amount: a.amount,
      }));
      const allocations: AllocationDraft[] = input.allocations
        ? input.allocations.map(toDraft)
        : input.amount !== undefined && current.length === 1
          ? [{ ...current[0]!, amount }]
          : current;
      const next = {
        amount,
        date: input.date ?? transaction.date,
        partyId: input.partyId === undefined ? transaction.partyId : toObjectId(input.partyId),
        categoryId:
          input.categoryId === undefined ? transaction.categoryId : toObjectId(input.categoryId),
        description: input.description ?? transaction.description,
      };

      const allocationsChanged =
        current.map(targetKey).join(';') !== allocations.map(targetKey).join(';');
      const financialChanged =
        next.amount !== transaction.amount ||
        next.date !== transaction.date ||
        next.partyId?.toString() !== transaction.partyId?.toString() ||
        allocationsChanged;
      if (financialChanged) requireReason(input.reason, 'Finansal düzeltme için gerekçe girin.');

      const issues = await this.validateCash(
        context,
        {
          kind,
          amount: next.amount,
          partyId: next.partyId,
          categoryId: next.categoryId,
          allocations,
          checkCategoryActive: next.categoryId?.toString() !== transaction.categoryId?.toString(),
        },
        'correct',
        session,
      );
      const refundable = transaction.allocations.map((a) => asRefundable(a));
      issues.push(...validateAllocationChangesAgainstRefunds(refundable, allocations.map(asInput)));
      const hasRefunds = transaction.allocations.some((a) => a.refundedAmount > 0);
      if (hasRefunds && next.partyId?.toString() !== transaction.partyId?.toString()) {
        issues.push({
          code: 'REFUNDED_PARTY_CHANGE',
          message: 'Bağlı iadesi olan kaydın kişisi değiştirilemez.',
          path: ['partyId'],
        });
      }
      if (issues.length > 0) throw validationError(issues);

      const excess = financialChanged
        ? await this.checkExcess(context, kind, allocations, transaction._id, input, session)
        : transaction.excess;

      const before = {
        amount: transaction.amount,
        date: transaction.date,
        partyId: transaction.partyId,
        categoryId: transaction.categoryId,
        description: transaction.description,
        allocations: transaction.allocations.map((a) => targetKey(a)),
      };
      const after = { ...next, allocations: allocations.map(targetKey) };
      const changes = Object.keys(after)
        .filter(
          (field) =>
            JSON.stringify(before[field as keyof typeof before]) !==
            JSON.stringify(after[field as keyof typeof after]),
        )
        .map((field) => ({
          field,
          old: before[field as keyof typeof before],
          new: after[field as keyof typeof after],
        }));

      const oldAgreementIds = transaction.allocations.map((a) => a.agreementId);
      const refundedById = new Map(
        transaction.allocations.map((a) => [a._id.toString(), a.refundedAmount]),
      );
      transaction.set({
        ...next,
        descriptionFolded: foldTurkish(next.description),
        allocations: allocations.map((allocation) => ({
          _id: allocation.id ?? new Types.ObjectId(),
          scope: allocation.scope,
          projectId: allocation.projectId,
          agreementId: allocation.agreementId,
          amount: allocation.amount,
          refundedAmount: allocation.id ? (refundedById.get(allocation.id.toString()) ?? 0) : 0,
        })),
        excess,
        updatedBy: context.userId,
      });
      if (changes.length > 0) {
        transaction.history.push(
          historyEntry({
            by: context.userId,
            action: financialChanged ? 'correct' : 'update',
            changes,
            reason: input.reason,
            at: this.deps.clock.now(),
          }),
        );
      }
      await transaction.save({ session });
      await recalculateAgreements(
        context.companyId,
        [...oldAgreementIds, ...allocations.map((a) => a.agreementId)],
        session,
      );
      const [data] = await this.present(context, [transaction]);
      return data;
    });
  }

  private async activeSource(
    context: CustomerContext,
    sourceId: Types.ObjectId,
    session: ClientSession,
  ) {
    return TransactionModel.findOne({
      companyId: context.companyId,
      deletedAt: null,
      _id: sourceId,
    }).session(session);
  }

  /** İade düzeltme: kaynak payın refundedAmount değeri ve bağlı anlaşma önbelleği birlikte güncellenir. */
  private async correctRefund(
    context: CustomerContext,
    refund: TransactionDocument,
    input: TransactionCorrectionInput,
    session: ClientSession,
  ) {
    if (input.allocations || input.partyId !== undefined || input.categoryId !== undefined) {
      throw validationError([
        {
          code: 'FIELD_NOT_ALLOWED',
          message: 'İade kaydında yalnız tutar, tarih, açıklama ve iade payları değiştirilebilir.',
          path: [],
        },
      ]);
    }
    const refundOf = refund.refundOf!;
    const source = await this.activeSource(context, refundOf.transactionId, session);
    if (!source) throw conflictWithIssues('Kaynak kayıt silinmiş; iade düzeltilemez.', []);

    const ownParts = refundOf.parts.map((p) => ({
      allocationId: p.allocationId.toString(),
      amount: p.amount,
    }));
    const parts =
      input.parts ??
      (input.amount !== undefined && ownParts.length === 1
        ? [{ ...ownParts[0]!, amount: input.amount }]
        : ownParts);
    const amount = input.amount ?? refund.amount;
    const date = input.date ?? refund.date;
    const description = input.description ?? refund.description;
    const financialChanged =
      amount !== refund.amount ||
      date !== refund.date ||
      JSON.stringify(parts) !== JSON.stringify(ownParts);
    if (financialChanged) requireReason(input.reason, 'İade düzeltmesi için gerekçe girin.');

    // Bu iadenin kendi payları sınır hesabında sayılmaz.
    const own = new Map<string, number>();
    for (const part of ownParts)
      own.set(part.allocationId, (own.get(part.allocationId) ?? 0) + part.amount);
    const refundable = source.allocations.map((a) =>
      asRefundable(a, a.refundedAmount - (own.get(a._id.toString()) ?? 0)),
    );
    const issues = validateRefund(
      { kind: source.kind, allocations: refundable },
      { amount, parts },
    );
    if (issues.length > 0) throw refundIssuesError(issues);

    const changes = [
      ...(amount !== refund.amount ? [{ field: 'amount', old: refund.amount, new: amount }] : []),
      ...(date !== refund.date ? [{ field: 'date', old: refund.date, new: date }] : []),
      ...(description !== refund.description
        ? [{ field: 'description', old: refund.description, new: description }]
        : []),
      ...(JSON.stringify(parts) !== JSON.stringify(ownParts)
        ? [{ field: 'parts', old: ownParts, new: parts }]
        : []),
    ];
    refund.set({
      amount,
      date,
      description,
      descriptionFolded: foldTurkish(description),
      refundOf: {
        transactionId: refundOf.transactionId,
        parts: parts.map((p) => ({
          allocationId: new Types.ObjectId(p.allocationId),
          amount: p.amount,
        })),
      },
      allocations: refundAllocationsFor(refundable, parts).map((a) => ({
        scope: a.scope,
        projectId: toObjectId(a.projectId),
        agreementId: toObjectId(a.agreementId),
        amount: a.amount,
        refundedAmount: 0,
      })),
      updatedBy: context.userId,
    });
    if (changes.length > 0) {
      refund.history.push(
        historyEntry({
          by: context.userId,
          action: financialChanged ? 'correct' : 'update',
          changes,
          reason: input.reason,
          at: this.deps.clock.now(),
        }),
      );
    }
    await refund.save({ session });
    await recalculateRefunds(context.companyId, source._id, session);
    const [data] = await this.present(context, [refund]);
    return data;
  }

  // ── İade ─────────────────────────────────────────────────────────────────────

  /**
   * Ödemeden geri gelen para (ödeme iadesi) veya müşteriye geri verilen tahsilat (tahsilat iadesi).
   * Pay bazında iade, payın kalan iade edilebilir tutarını aşamaz; kaynak hareket değişmez.
   */
  async refund(
    context: CustomerContext,
    sourceId: string,
    input: RefundCreateInput,
    session: ClientSession,
  ) {
    const source = await forCompany(TransactionModel, context.companyId).findByIdOrThrow(sourceId, {
      session,
    });
    if (source.kind !== 'income' && source.kind !== 'expense') {
      throw new AppError('CONFLICT', 'İade kaydına iade yapılamaz.');
    }
    const refundable = source.allocations.map((a) => asRefundable(a));
    const issues = validateRefund({ kind: source.kind, allocations: refundable }, input);
    if (issues.length > 0) throw refundIssuesError(issues);

    const refund = new TransactionModel({
      companyId: context.companyId,
      recordNo: await nextRecordNo(context.companyId, session),
      kind: refundKindOf(source.kind),
      amount: input.amount,
      date: input.date,
      partyId: source.partyId,
      categoryId: source.categoryId,
      description: input.reason,
      descriptionFolded: foldTurkish(input.reason),
      allocations: refundAllocationsFor(refundable, input.parts).map((a) => ({
        scope: a.scope,
        projectId: toObjectId(a.projectId),
        agreementId: toObjectId(a.agreementId),
        amount: a.amount,
        refundedAmount: 0,
      })),
      refundOf: {
        transactionId: source._id,
        parts: input.parts.map((p) => ({
          allocationId: new Types.ObjectId(p.allocationId),
          amount: p.amount,
        })),
      },
      createdBy: context.userId,
      updatedBy: context.userId,
      history: [
        historyEntry({
          by: context.userId,
          action: 'create',
          reason: input.reason,
          at: this.deps.clock.now(),
        }),
      ],
    });
    await refund.save({ session });
    await recalculateRefunds(context.companyId, source._id, session);

    const [data] = await this.present(context, [refund]);
    return {
      outcome: { status: 201, data } satisfies IdempotentOutcome,
      ref: { type: 'transaction', id: refund._id.toString() },
    };
  }

  // ── Silme ve geri yükleme ────────────────────────────────────────────────────

  /** Yumuşak silme; bağlı aktif iadesi olan hareket silinemez. Paylaştırılmışın bütün payları birlikte kalkar. */
  async remove(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    return withTransaction(async (session) => {
      const transaction = await this.loadForChange(context, id, input.expectedUpdatedAt, session);
      if (!transaction.refundOf) {
        const refunds = await TransactionModel.find(
          {
            companyId: context.companyId,
            deletedAt: null,
            'refundOf.transactionId': transaction._id,
          },
          { recordNo: 1 },
        ).session(session);
        if (refunds.length > 0) {
          throw new AppError('HAS_DEPENDENCIES', 'Bu kayda bağlı iade var; önce iadeyi silin.', {
            refunds: refunds.map((refund) => ({
              id: refund._id.toString(),
              recordNo: refund.recordNo,
            })),
          });
        }
      }
      const now = this.deps.clock.now();
      transaction.set({
        deletedAt: now,
        deletedBy: context.userId,
        deleteReason: input.reason,
        updatedBy: context.userId,
      });
      transaction.history.push(
        historyEntry({ by: context.userId, action: 'delete', reason: input.reason, at: now }),
      );
      await transaction.save({ session });
      await this.recalculateAfter(context, transaction, session);
      return { id: transaction._id.toString(), deletedAt: now.toISOString() };
    });
  }

  private async recalculateAfter(
    context: CustomerContext,
    transaction: Transaction,
    session: ClientSession,
  ) {
    if (transaction.refundOf)
      await recalculateRefunds(context.companyId, transaction.refundOf.transactionId, session);
    else
      await recalculateAgreements(
        context.companyId,
        transaction.allocations.map((a) => a.agreementId),
        session,
      );
  }

  /**
   * Geri yükleme: güncel ilişkiler ve iade sınırı yeniden doğrulanır; geçersizse neden ve çözüm
   * yoluyla 409. Kalan aşılıyorsa fazla onayı istenir. Finansal etki bir kez uygulanır.
   */
  async restore(
    context: CustomerContext,
    id: string,
    input: {
      reason: string;
      expectedUpdatedAt: string;
      confirmExcess?: boolean | undefined;
      excessReason?: string | undefined;
    },
  ) {
    return withTransaction(async (session) => {
      const transaction = await this.loadForChange(
        context,
        id,
        input.expectedUpdatedAt,
        session,
        true,
      );
      if (!transaction.deletedAt) throw new AppError('CONFLICT', 'Kayıt silinmiş değil.');
      let excess = transaction.excess;

      if (transaction.refundOf) {
        const source = await this.activeSource(
          context,
          transaction.refundOf.transactionId,
          session,
        );
        if (!source) {
          throw conflictWithIssues('İade geri yüklenemiyor.', [
            {
              code: 'SOURCE_DELETED',
              message: 'Kaynak kayıt silinmiş. Önce kaynak kaydı geri yükleyin.',
              path: [],
            },
          ]);
        }
        const issues = validateRefund(
          { kind: source.kind, allocations: source.allocations.map((a) => asRefundable(a)) },
          {
            amount: transaction.amount,
            parts: transaction.refundOf.parts.map((p) => ({
              allocationId: p.allocationId.toString(),
              amount: p.amount,
            })),
          },
        );
        if (issues.length > 0)
          throw conflictWithIssues('İade geri yüklenemiyor; iade sınırı aşılıyor.', issues);
      } else {
        const allocations: AllocationDraft[] = transaction.allocations.map((a) => ({
          id: a._id,
          scope: a.scope,
          projectId: a.projectId,
          agreementId: a.agreementId,
          amount: a.amount,
        }));
        const issues = await this.validateCash(
          context,
          {
            kind: transaction.kind as CashKind,
            amount: transaction.amount,
            partyId: transaction.partyId,
            categoryId: transaction.categoryId,
            allocations,
            checkCategoryActive: false,
          },
          'restore',
          session,
        );
        if (issues.length > 0) throw conflictWithIssues('Kayıt geri yüklenemiyor.', issues);
        excess = await this.checkExcess(
          context,
          transaction.kind as CashKind,
          allocations,
          transaction._id,
          input,
          session,
        );
      }

      transaction.set({
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        excess,
        updatedBy: context.userId,
      });
      transaction.history.push(
        historyEntry({
          by: context.userId,
          action: 'restore',
          reason: input.reason,
          at: this.deps.clock.now(),
        }),
      );
      await transaction.save({ session });
      await this.recalculateAfter(context, transaction, session);
      const [data] = await this.present(context, [transaction]);
      return data;
    });
  }
}
