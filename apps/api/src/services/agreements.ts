// Anlaşmalar ve başlangıç borç/alacakları (şartname 7.6, 8.7, 9.2, 9.3, 9.5, 10.7).

import {
  computeAgreementBalance,
  DIRECTIONS,
  dueStateOf,
  foldTurkish,
  PAYMENT_STATUSES,
  SCOPES,
  type AgreementCreateInput,
  type ValidationIssue,
} from '@santiye/shared';
import type { ClientSession, QueryFilter, Types } from 'mongoose';
import { z } from 'zod';
import { forCompany, notFound, type HistoryChange } from '../db/company-scope.js';
import { withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { businessToday } from '../lib/clock.js';
import {
  AgreementModel,
  type Agreement,
  type AgreementDocument,
  type ValueChange,
} from '../models/agreement.js';
import { PartyModel } from '../models/party.js';
import { ProjectModel } from '../models/project.js';
import { TransactionModel } from '../models/transaction.js';
import type { CustomerContext } from './customer-auth.js';
import {
  emptyNameMaps,
  historyActors,
  loadNameMaps,
  presentAgreement,
  type NameMaps,
  presentHistory,
  presentTransaction,
  transactionRefs,
} from './finance-presenters.js';
import type { IdempotentOutcome } from './idempotency.js';
import { linkedAllocations } from './ledger.js';
import { summarizeObligations } from './obligations.js';
import { foldedContains } from './projects.js';
import {
  assertSameVersion,
  conflictWithIssues,
  historyEntry,
  paginationSchema,
  queryList,
  toObjectId,
  validationError,
} from './records.js';

const optionalId = z
  .string()
  .optional()
  .transform((value) => toObjectId(value) ?? (value ? 'invalid' : undefined));

export const agreementListQuerySchema = paginationSchema.extend({
  kind: z.enum(['agreement', 'opening']).optional(),
  direction: z.enum(DIRECTIONS).optional(),
  scope: z.enum(SCOPES).optional(),
  projectId: optionalId,
  partyId: optionalId,
  workStatus: z.enum(['ongoing', 'completed', 'cancelled']).optional(),
  paymentStatus: z
    .unknown()
    .optional()
    .transform((value) => queryList(value))
    .pipe(z.array(z.enum(PAYMENT_STATUSES))),
  dueState: z.enum(['overdue', 'upcoming', 'later', 'none']).optional(),
  remainingOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  q: z.string().trim().optional(),
  includeDeleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

type AgreementListQuery = z.infer<typeof agreementListQuerySchema>;

function presentChange<T>(change: ValueChange<T>, maps: { actor: NameMaps['actor'] }) {
  return {
    at: change.at.toISOString(),
    by: maps.actor(change.by),
    old: change.old,
    new: change.new,
    reason: change.reason,
  };
}

export class AgreementService {
  constructor(private readonly deps: AppDeps) {}

  private today() {
    return businessToday(this.deps.clock);
  }

  private async present(context: CustomerContext, agreements: Agreement[], withHistory = false) {
    const maps = await loadNameMaps(context.companyId, {
      projects: agreements.map((a) => a.projectId),
      parties: agreements.map((a) => a.partyId),
      users: [
        ...agreements.flatMap((a) => [a.createdBy, a.updatedBy, a.deletedBy]),
        ...(withHistory
          ? [
              ...historyActors(agreements),
              ...agreements.flatMap((a) =>
                [...a.amountHistory, ...a.dueDateHistory].map((h) => h.by),
              ),
            ]
          : []),
      ],
    });
    const today = this.today();
    return agreements.map((agreement) => ({
      ...presentAgreement(agreement, maps),
      dueState: dueStateOf(agreement, today),
      ...(withHistory
        ? {
            history: presentHistory(agreement.history, maps),
            amountHistory: agreement.amountHistory.map((h) => presentChange(h, maps)),
            dueDateHistory: agreement.dueDateHistory.map((h) => presentChange(h, maps)),
          }
        : {}),
    }));
  }

  private buildFilter(query: AgreementListQuery): QueryFilter<Agreement> {
    const filter: QueryFilter<Agreement> = {};
    if (query.kind) filter.kind = query.kind;
    if (query.direction) filter.direction = query.direction;
    if (query.scope) filter.scope = query.scope;
    if (query.projectId) filter.projectId = query.projectId === 'invalid' ? null : query.projectId;
    if (query.partyId) filter.partyId = query.partyId === 'invalid' ? null : query.partyId;
    if (query.workStatus) filter.workStatus = query.workStatus;
    if (query.paymentStatus.length > 0) filter.paymentStatus = { $in: query.paymentStatus };
    if (query.remainingOnly || query.dueState) filter.remaining = { $gt: 0 };
    if (query.q)
      filter.$or = [
        { titleFolded: foldedContains(query.q) },
        { descriptionFolded: foldedContains(query.q) },
      ];
    return filter;
  }

  /** Liste ve bütün filtrelenmiş sonuçların borç/alacak özeti; vade grubu paylaşılan kuralla. */
  async list(context: CustomerContext, query: AgreementListQuery) {
    const scope = forCompany(AgreementModel, context.companyId);
    const filter = this.buildFilter(query);
    const today = this.today();
    let matching = await scope
      .find(filter, { includeDeleted: query.includeDeleted })
      .sort({ createdAt: -1 });
    if (query.dueState)
      matching = matching.filter((agreement) => dueStateOf(agreement, today) === query.dueState);

    const page = matching.slice((query.page - 1) * query.limit, query.page * query.limit);
    const totals = summarizeObligations(
      matching.filter((agreement) => agreement.deletedAt === null),
      today,
    );
    return {
      items: await this.present(context, page),
      page: query.page,
      limit: query.limit,
      total: matching.length,
      totals,
    };
  }

  private async checkTargets(
    context: CustomerContext,
    target: {
      scope: Agreement['scope'];
      projectId: Types.ObjectId | null;
      partyId: Types.ObjectId;
    },
    mode: 'create' | 'restore',
    session?: ClientSession,
  ): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    if (target.projectId) {
      const project = await forCompany(ProjectModel, context.companyId).findById(
        target.projectId.toString(),
        { session },
      );
      if (!project) {
        issues.push({
          code: 'PROJECT_NOT_FOUND',
          message:
            mode === 'restore'
              ? 'Şantiye silinmiş. Önce şantiyeyi geri yükleyin.'
              : 'Şantiye bulunamadı.',
          path: ['projectId'],
        });
      } else if (mode === 'create' && project.status !== 'active') {
        issues.push({
          code: 'PROJECT_NOT_ACTIVE',
          message:
            'Tamamlanan veya arşivlenen şantiyeye yeni anlaşma için önce şantiyeyi yeniden aktifleştirin.',
          path: ['projectId'],
        });
      }
    }
    const party = await forCompany(PartyModel, context.companyId).findById(
      target.partyId.toString(),
      { session },
    );
    if (!party) {
      issues.push({
        code: 'PARTY_NOT_FOUND',
        message:
          mode === 'restore'
            ? 'Kişi/firma silinmiş. Önce kişiyi geri yükleyin.'
            : 'Kişi/firma bulunamadı.',
        path: ['partyId'],
      });
    }
    return issues;
  }

  /** Anlaşma veya başlangıç kaydı oluşturmak gelir/gider hareketi yazmaz. */
  async create(context: CustomerContext, input: AgreementCreateInput, session: ClientSession) {
    const projectId = toObjectId(input.projectId);
    const partyId = toObjectId(input.partyId)!;
    const issues = await this.checkTargets(
      context,
      { scope: input.scope, projectId, partyId },
      'create',
      session,
    );
    if (issues.length > 0) throw validationError(issues);

    const now = this.deps.clock.now();
    const balance = computeAgreementBalance(input.initialAmount, []);
    const agreement = await forCompany(AgreementModel, context.companyId).create(
      {
        kind: input.kind,
        direction: input.direction,
        scope: input.scope,
        projectId,
        partyId,
        title: input.kind === 'agreement' ? input.title : '',
        titleFolded: input.kind === 'agreement' ? foldTurkish(input.title) : '',
        description: input.description,
        descriptionFolded: foldTurkish(input.description),
        initialAmount: input.initialAmount,
        currentAmount: input.initialAmount,
        agreementDate: input.kind === 'agreement' ? (input.agreementDate ?? null) : null,
        trackingStartDate: input.kind === 'opening' ? input.trackingStartDate : null,
        dueDate: input.dueDate ?? null,
        workStatus: input.kind === 'agreement' ? 'ongoing' : null,
        ...balance,
        history: [historyEntry({ by: context.userId, action: 'create', at: now })],
      },
      context.userId,
      session,
    );
    await this.touch(context, agreement, session);
    const [data] = await this.present(context, [agreement]);
    return {
      outcome: { status: 201, data } satisfies IdempotentOutcome,
      ref: { type: 'agreement', id: agreement._id.toString() },
    };
  }

  private async touch(context: CustomerContext, agreement: Agreement, session: ClientSession) {
    const now = this.deps.clock.now();
    const options = { session, timestamps: false };
    if (agreement.projectId) {
      await ProjectModel.updateOne(
        { _id: agreement.projectId, companyId: context.companyId },
        { lastUsedAt: now },
        options,
      );
    }
    await PartyModel.updateOne(
      { _id: agreement.partyId, companyId: context.companyId },
      { lastUsedAt: now },
      options,
    );
  }

  async replay(context: CustomerContext, id: string, status: number): Promise<IdempotentOutcome> {
    const agreement = await forCompany(AgreementModel, context.companyId).findByIdOrThrow(id);
    const [data] = await this.present(context, [agreement]);
    return { status, data };
  }

  /** Detay: güncel bedel ve değişiklikleri, net, kalan, fazla, bağlı hareketler ve iadeler, geçmiş. */
  async get(context: CustomerContext, id: string) {
    const agreement = await forCompany(AgreementModel, context.companyId).findByIdOrThrow(id);
    const linked = await TransactionModel.find({
      companyId: context.companyId,
      deletedAt: null,
      'allocations.agreementId': agreement._id,
    }).sort({ date: 1, recordNo: 1 });
    const maps = await loadNameMaps(context.companyId, transactionRefs(linked));
    const [data] = await this.present(context, [agreement], true);
    return {
      ...data,
      transactions: linked.map((transaction) => ({
        ...presentTransaction(transaction, maps),
        agreementShare: transaction.allocations
          .filter((allocation) => allocation.agreementId?.equals(agreement._id))
          .reduce((sum, allocation) => sum + allocation.amount, 0),
      })),
    };
  }

  private async load(
    context: CustomerContext,
    id: string,
    expectedUpdatedAt: string,
    session?: ClientSession,
  ) {
    const agreement = await forCompany(AgreementModel, context.companyId).findByIdOrThrow(id, {
      session,
    });
    assertSameVersion(agreement.updatedAt, expectedUpdatedAt, () =>
      presentAgreement(agreement, emptyNameMaps),
    );
    return agreement;
  }

  private async save(
    context: CustomerContext,
    agreement: AgreementDocument,
    session?: ClientSession,
  ) {
    agreement.updatedBy = context.userId;
    await agreement.save({ session: session ?? null });
    const [data] = await this.present(context, [agreement]);
    return data;
  }

  /** Ad, açıklama ve anlaşma tarihi; finansal değildir, gerekçe istemez. */
  async update(
    context: CustomerContext,
    id: string,
    input: {
      title?: string | undefined;
      description?: string | undefined;
      agreementDate?: string | null | undefined;
      expectedUpdatedAt: string;
    },
  ) {
    const agreement = await this.load(context, id, input.expectedUpdatedAt);
    const changes = [];
    if (
      input.title !== undefined &&
      agreement.kind === 'agreement' &&
      input.title !== agreement.title
    ) {
      changes.push({ field: 'title', old: agreement.title, new: input.title });
      agreement.title = input.title;
      agreement.titleFolded = foldTurkish(input.title);
    }
    if (input.description !== undefined && input.description !== agreement.description) {
      changes.push({ field: 'description', old: agreement.description, new: input.description });
      agreement.description = input.description;
      agreement.descriptionFolded = foldTurkish(input.description);
    }
    if (
      input.agreementDate !== undefined &&
      agreement.kind === 'agreement' &&
      input.agreementDate !== agreement.agreementDate
    ) {
      changes.push({
        field: 'agreementDate',
        old: agreement.agreementDate,
        new: input.agreementDate,
      });
      agreement.agreementDate = input.agreementDate;
    }
    if (changes.length > 0) {
      agreement.history.push(
        historyEntry({ by: context.userId, action: 'update', changes, at: this.deps.clock.now() }),
      );
    }
    return this.save(context, agreement);
  }

  /** Yeni bedelle kalan, fazla ve ödeme durumu; kaydetmeden önizleme için de kullanılır. */
  private async balanceFor(
    context: CustomerContext,
    agreement: Agreement,
    amount: number,
    session?: ClientSession,
  ) {
    const linked = await linkedAllocations(context.companyId, [agreement._id], session);
    return computeAgreementBalance(amount, linked.get(agreement._id.toString()) ?? []);
  }

  /**
   * Bedel değişikliği gider/gelir oluşturmaz. Bedel ödenenin altına düşerse geçmiş ödemeler
   * değişmez; kalan 0, aşan tutar fazla olur. Hesabı kesinleşmemiş iptalde kesin bedeli kaydeder.
   */
  async changeAmount(
    context: CustomerContext,
    id: string,
    input: { newAmount: number; reason: string; expectedUpdatedAt: string },
    preview: boolean,
  ) {
    if (preview) {
      const agreement = await forCompany(AgreementModel, context.companyId).findByIdOrThrow(id);
      const after = await this.balanceFor(context, agreement, input.newAmount);
      return {
        preview: true,
        before: {
          currentAmount: agreement.currentAmount,
          netSettled: agreement.netSettled,
          remaining: agreement.remaining,
          excess: agreement.excess,
          paymentStatus: agreement.paymentStatus,
        },
        after: { currentAmount: input.newAmount, ...after },
        updatedAt: agreement.updatedAt.toISOString(),
      };
    }
    return withTransaction(async (session) => {
      const agreement = await this.load(context, id, input.expectedUpdatedAt, session);
      if (agreement.workStatus === 'cancelled' && !agreement.settlementPending) {
        throw new AppError(
          'CONFLICT',
          'İptal edilen anlaşmanın kesin bedeli kayıtlı; bedel değiştirilemez.',
        );
      }
      const now = this.deps.clock.now();
      const balance = await this.balanceFor(context, agreement, input.newAmount, session);
      agreement.amountHistory.push({
        at: now,
        by: context.userId,
        old: agreement.currentAmount,
        new: input.newAmount,
        reason: input.reason,
      });
      agreement.history.push(
        historyEntry({
          by: context.userId,
          action: agreement.settlementPending ? 'settle' : 'amount_change',
          changes: [{ field: 'currentAmount', old: agreement.currentAmount, new: input.newAmount }],
          reason: input.reason,
          at: now,
        }),
      );
      agreement.currentAmount = input.newAmount;
      agreement.settlementPending = false;
      Object.assign(agreement, balance);
      return this.save(context, agreement, session);
    });
  }

  /** Vade değişikliği gerekçe, eski/yeni tarih, kullanıcı ve zamanla saklanır; null vadeyi kaldırır. */
  async changeDueDate(
    context: CustomerContext,
    id: string,
    input: { dueDate: string | null; reason: string; expectedUpdatedAt: string },
  ) {
    const agreement = await this.load(context, id, input.expectedUpdatedAt);
    const now = this.deps.clock.now();
    agreement.dueDateHistory.push({
      at: now,
      by: context.userId,
      old: agreement.dueDate,
      new: input.dueDate,
      reason: input.reason,
    });
    agreement.history.push(
      historyEntry({
        by: context.userId,
        action: 'due_date_change',
        changes: [{ field: 'dueDate', old: agreement.dueDate, new: input.dueDate }],
        reason: input.reason,
        at: now,
      }),
    );
    agreement.dueDate = input.dueDate;
    return this.save(context, agreement);
  }

  /** İş durumu ödeme durumundan ayrıdır; işi tamamlamak borcu sıfırlamaz. */
  async setWorkStatus(
    context: CustomerContext,
    id: string,
    input: { workStatus: 'ongoing' | 'completed'; expectedUpdatedAt: string },
  ) {
    const agreement = await this.load(context, id, input.expectedUpdatedAt);
    if (agreement.kind !== 'agreement')
      throw new AppError('CONFLICT', 'Başlangıç kaydının iş durumu yoktur.');
    if (agreement.workStatus === 'cancelled')
      throw new AppError('CONFLICT', 'İptal edilen anlaşmanın iş durumu değiştirilemez.');
    if (agreement.workStatus !== input.workStatus) {
      agreement.history.push(
        historyEntry({
          by: context.userId,
          action: 'work_status',
          changes: [{ field: 'workStatus', old: agreement.workStatus, new: input.workStatus }],
          at: this.deps.clock.now(),
        }),
      );
      agreement.workStatus = input.workStatus;
    }
    return this.save(context, agreement);
  }

  /**
   * İptal geçmiş hareketleri silmez ve para iadesi oluşturmaz. Kesin bedel verilirse güncel bedel
   * olur; verilmezse "İptal — hesap kesinleşmedi" kalır ve kalan gizlenmez.
   */
  async cancel(
    context: CustomerContext,
    id: string,
    input: { finalAmount?: number | undefined; reason: string; expectedUpdatedAt: string },
  ) {
    return withTransaction(async (session) => {
      const agreement = await this.load(context, id, input.expectedUpdatedAt, session);
      if (agreement.kind !== 'agreement')
        throw new AppError('CONFLICT', 'Başlangıç kaydı iptal edilemez.');
      if (agreement.workStatus === 'cancelled')
        throw new AppError('CONFLICT', 'Anlaşma zaten iptal edilmiş.');
      const now = this.deps.clock.now();
      const changes: HistoryChange[] = [
        { field: 'workStatus', old: agreement.workStatus, new: 'cancelled' },
      ];
      agreement.workStatus = 'cancelled';
      if (input.finalAmount !== undefined) {
        const balance = await this.balanceFor(context, agreement, input.finalAmount, session);
        changes.push({
          field: 'currentAmount',
          old: agreement.currentAmount,
          new: input.finalAmount,
        });
        agreement.amountHistory.push({
          at: now,
          by: context.userId,
          old: agreement.currentAmount,
          new: input.finalAmount,
          reason: input.reason,
        });
        agreement.currentAmount = input.finalAmount;
        agreement.settlementPending = false;
        Object.assign(agreement, balance);
      } else {
        agreement.settlementPending = true;
      }
      agreement.history.push(
        historyEntry({
          by: context.userId,
          action: 'cancel',
          changes,
          reason: input.reason,
          at: now,
        }),
      );
      return this.save(context, agreement, session);
    });
  }

  /** Yalnız aktif bağlı hareketi olmayan anlaşma silinir; aksi halde iptal veya bedel değişikliği. */
  async remove(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    return withTransaction(async (session) => {
      const agreement = await this.load(context, id, input.expectedUpdatedAt, session);
      const linked = await TransactionModel.countDocuments({
        companyId: context.companyId,
        deletedAt: null,
        'allocations.agreementId': agreement._id,
      }).session(session);
      if (linked > 0) {
        throw new AppError(
          'HAS_DEPENDENCIES',
          'Bu anlaşmaya bağlı hareketler var; silmek yerine iptal edin veya bedelini değiştirin.',
          { transactions: linked },
        );
      }
      const now = this.deps.clock.now();
      agreement.deletedAt = now;
      agreement.deletedBy = context.userId;
      agreement.deleteReason = input.reason;
      agreement.history.push(
        historyEntry({ by: context.userId, action: 'delete', reason: input.reason, at: now }),
      );
      agreement.updatedBy = context.userId;
      await agreement.save({ session });
      return { id: agreement._id.toString(), deletedAt: now.toISOString() };
    });
  }

  /** Geri yüklemede şantiye ve kişi hâlâ geçerli olmalı; geçersizse neden ve çözüm yolu döner. */
  async restore(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    return withTransaction(async (session) => {
      const agreement = await forCompany(AgreementModel, context.companyId).findById(id, {
        includeDeleted: true,
        session,
      });
      if (!agreement) throw notFound();
      if (!agreement.deletedAt) throw new AppError('CONFLICT', 'Anlaşma silinmiş değil.');
      assertSameVersion(agreement.updatedAt, input.expectedUpdatedAt, () =>
        presentAgreement(agreement, emptyNameMaps),
      );
      const issues = await this.checkTargets(context, agreement, 'restore', session);
      if (issues.length > 0) throw conflictWithIssues('Anlaşma geri yüklenemiyor.', issues);

      agreement.deletedAt = null;
      agreement.deletedBy = null;
      agreement.deleteReason = null;
      agreement.history.push(
        historyEntry({
          by: context.userId,
          action: 'restore',
          reason: input.reason,
          at: this.deps.clock.now(),
        }),
      );
      return this.save(context, agreement, session);
    });
  }
}
