// Şantiyeler (şartname 7.2, 8.3, 9.5, 10.4).

import {
  cashTotalsFromSums,
  foldTurkish,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  type TransactionKind,
} from '@santiye/shared';
import type { ClientSession, QueryFilter, Types } from 'mongoose';
import { z } from 'zod';
import { forCompany, notFound } from '../db/company-scope.js';
import { withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { businessToday } from '../lib/clock.js';
import { AgreementModel } from '../models/agreement.js';
import { ProjectModel, type Project } from '../models/project.js';
import { TransactionModel } from '../models/transaction.js';
import type { CustomerContext } from './customer-auth.js';
import {
  emptyNameMaps,
  historyActors,
  loadNameMaps,
  presentHistory,
  presentProject,
} from './finance-presenters.js';
import type { IdempotentOutcome } from './idempotency.js';
import { cashTotals } from './ledger.js';
import { obligationSummary, summarizeObligations } from './obligations.js';
import {
  assertSameVersion,
  diffChanges,
  historyEntry,
  paginationSchema,
  toObjectId,
  updateScoped,
} from './records.js';

export const projectListQuerySchema = paginationSchema.extend({
  status: z.enum(['active', 'completed', 'archived', 'all']).default('active'),
  q: z.string().trim().optional(),
  sort: z.enum(['last_used', 'newest', 'oldest', 'name_asc', 'name_desc']).default('last_used'),
  pinnedFirst: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  includeDeleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const SORTS = {
  last_used: { lastUsedAt: -1, createdAt: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name_asc: { nameFolded: 1 },
  name_desc: { nameFolded: -1 },
} as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function foldedContains(query: string) {
  return { $regex: escapeRegex(foldTurkish(query)) };
}

/**
 * Liste ve pano için şantiye bazında net tahsilat/ödeme, fark ve kalan borç/alacak (paylardan).
 * Hesap `packages/shared` fonksiyonlarıyla; yalnız verilen firmanın kayıtları okunur.
 */
export async function projectCardSummaries(
  companyId: Types.ObjectId,
  projectIds: Types.ObjectId[],
  today: string,
) {
  if (projectIds.length === 0) return new Map<string, ProjectCardSummary>();
  const rows = await TransactionModel.aggregate<{
    _id: { projectId: Types.ObjectId; kind: TransactionKind };
    total: number;
  }>([
    {
      $match: {
        companyId,
        deletedAt: null,
        'allocations.projectId': { $in: projectIds },
      },
    },
    { $unwind: '$allocations' },
    { $match: { 'allocations.projectId': { $in: projectIds } } },
    {
      $group: {
        _id: { projectId: '$allocations.projectId', kind: '$kind' },
        total: { $sum: '$allocations.amount' },
      },
    },
  ]);
  const agreements = await AgreementModel.find(
    { companyId, deletedAt: null, projectId: { $in: projectIds } },
    {
      kind: 1,
      direction: 1,
      currentAmount: 1,
      netSettled: 1,
      remaining: 1,
      excess: 1,
      dueDate: 1,
      projectId: 1,
    },
  ).lean();

  return new Map(
    projectIds.map((projectId): [string, ProjectCardSummary] => {
      const key = projectId.toString();
      const sum = (kind: TransactionKind) =>
        rows.find((row) => row._id.projectId.toString() === key && row._id.kind === kind)?.total ??
        0;
      const cash = cashTotalsFromSums({
        income: sum('income'),
        incomeRefund: sum('income_refund'),
        expense: sum('expense'),
        expenseRefund: sum('expense_refund'),
      });
      const obligations = summarizeObligations(
        agreements.filter((agreement) => agreement.projectId?.toString() === key),
        today,
      );
      return [
        key,
        {
          netIncome: cash.netIncome,
          netExpense: cash.netExpense,
          difference: cash.difference,
          remainingPayable: obligations.payable.remaining,
          remainingReceivable: obligations.receivable.remaining,
          overdueReceivable: obligations.receivable.overdue,
        },
      ];
    }),
  );
}

export interface ProjectCardSummary {
  netIncome: number;
  netExpense: number;
  difference: number;
  remainingPayable: number;
  remainingReceivable: number;
  overdueReceivable: number;
}

export class ProjectService {
  constructor(private readonly deps: AppDeps) {}

  private today() {
    return businessToday(this.deps.clock);
  }

  private async present(context: CustomerContext, projects: Project[], withHistory = false) {
    const maps = await loadNameMaps(context.companyId, {
      users: [
        ...projects.flatMap((p) => [p.createdBy, p.updatedBy, p.deletedBy]),
        ...(withHistory ? historyActors(projects) : []),
      ],
    });
    return projects.map((project) => ({
      ...presentProject(project, maps),
      ...(withHistory ? { history: presentHistory(project.history, maps) } : {}),
    }));
  }

  async list(context: CustomerContext, query: z.infer<typeof projectListQuerySchema>) {
    const filter: QueryFilter<Project> = {};
    if (query.status !== 'all') filter.status = query.status;
    if (query.q) filter.nameFolded = foldedContains(query.q);
    const scope = forCompany(ProjectModel, context.companyId);
    const options = { includeDeleted: query.includeDeleted };
    const sort = { ...(query.pinnedFirst ? { pinned: -1 } : {}), ...SORTS[query.sort] } as Record<
      string,
      1 | -1
    >;

    const [projects, total] = await Promise.all([
      scope
        .find(filter, options)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      scope.countDocuments(filter, options),
    ]);
    const summaries = await projectCardSummaries(
      context.companyId,
      projects.map((project) => project._id),
      this.today(),
    );
    const items = (await this.present(context, projects)).map((item) => ({
      ...item,
      summary: summaries.get(item.id),
    }));
    return { items, page: query.page, limit: query.limit, total };
  }

  /** Benzer ad varsa uyarılır; kayıt engellenmez. */
  private async similarNames(context: CustomerContext, name: string, excludeId?: Types.ObjectId) {
    const folded = foldTurkish(name);
    const matches = await forCompany(ProjectModel, context.companyId)
      .find({
        nameFolded: { $regex: escapeRegex(folded) },
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      })
      .limit(5);
    return matches.map((project) => ({ id: project._id.toString(), name: project.name }));
  }

  async create(context: CustomerContext, input: ProjectCreateInput, session: ClientSession) {
    const similar = await this.similarNames(context, input.name);
    const project = await forCompany(ProjectModel, context.companyId).create(
      {
        ...input,
        nameFolded: foldTurkish(input.name),
        history: [
          historyEntry({ by: context.userId, action: 'create', at: this.deps.clock.now() }),
        ],
      },
      context.userId,
      session,
    );
    const [data] = await this.present(context, [project]);
    return {
      outcome: {
        status: 201,
        data: {
          ...data,
          warnings:
            similar.length > 0
              ? [{ code: 'SIMILAR_NAME', message: 'Benzer adlı şantiye var.', related: similar }]
              : [],
        },
      } satisfies IdempotentOutcome,
      ref: { type: 'project', id: project._id.toString() },
    };
  }

  async replay(context: CustomerContext, id: string, status: number): Promise<IdempotentOutcome> {
    return { status, data: await this.get(context, id) };
  }

  async get(context: CustomerContext, id: string) {
    const project = await forCompany(ProjectModel, context.companyId).findByIdOrThrow(id);
    const [data] = await this.present(context, [project], true);
    return data;
  }

  /** Şantiye özeti: tahsilat, ödeme ve fark yalnız bu şantiyenin paylarından; borç ve alacak ayrı. */
  async summary(context: CustomerContext, id: string) {
    const project = await forCompany(ProjectModel, context.companyId).findByIdOrThrow(id);
    const target = { projectIds: [project._id], company: false };
    const [cash, obligations] = await Promise.all([
      cashTotals(context.companyId, { 'allocations.projectId': project._id }, target),
      obligationSummary(context.companyId, { projectId: project._id }, this.today()),
    ]);
    return {
      projectId: project._id.toString(),
      cash,
      ...obligations,
      generatedAt: this.deps.clock.now().toISOString(),
    };
  }

  private async change(
    context: CustomerContext,
    id: string,
    expectedUpdatedAt: string,
    build: (project: Project) => { set: Partial<Project>; action: string; reason?: string },
  ) {
    const objectId = toObjectId(id);
    if (!objectId) throw notFound();
    const current = await forCompany(ProjectModel, context.companyId).findByIdOrThrow(id);
    assertSameVersion(current.updatedAt, expectedUpdatedAt, () =>
      presentProject(current, emptyNameMaps),
    );
    const { set, action, reason } = build(current);
    const changes = diffChanges(current.toObject() as unknown as Record<string, unknown>, set);
    const updated = await updateScoped({
      model: ProjectModel,
      context,
      id: objectId,
      expectedUpdatedAt,
      update: {
        $set: { ...set, updatedBy: context.userId },
        $push: {
          history: historyEntry({
            by: context.userId,
            action,
            changes,
            reason,
            at: this.deps.clock.now(),
          }),
        },
      },
      present: (doc) => presentProject(doc, emptyNameMaps),
    });
    const [data] = await this.present(context, [updated]);
    return data;
  }

  update(context: CustomerContext, id: string, input: ProjectUpdateInput) {
    const { expectedUpdatedAt, ...fields } = input;
    return this.change(context, id, expectedUpdatedAt, () => ({
      set: {
        ...fields,
        ...(fields.name !== undefined ? { nameFolded: foldTurkish(fields.name) } : {}),
      },
      action: 'update',
    }));
  }

  /**
   * Tamamlamak tutarları, vadeleri veya kalanları değiştirmez. Cevapta açık borç/alacak döner;
   * tamamlanan şantiyede ödeme, tahsilat, iade ve düzeltme sürer.
   */
  async complete(
    context: CustomerContext,
    id: string,
    input: { completedAt?: string | undefined; expectedUpdatedAt: string },
  ) {
    const project = await this.change(context, id, input.expectedUpdatedAt, (current) => {
      if (current.status !== 'active')
        throw new AppError('CONFLICT', 'Yalnız aktif şantiye tamamlanabilir.');
      return {
        set: { status: 'completed', completedAt: input.completedAt ?? this.today() },
        action: 'complete',
      };
    });
    const summary = await obligationSummary(
      context.companyId,
      { projectId: toObjectId(id) },
      this.today(),
    );
    return { project, openBalances: { payable: summary.payable, receivable: summary.receivable } };
  }

  reactivate(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    return this.change(context, id, input.expectedUpdatedAt, (current) => {
      if (current.status !== 'completed') {
        throw new AppError('CONFLICT', 'Yalnız tamamlanan şantiye yeniden aktifleştirilebilir.');
      }
      return {
        set: { status: 'active', completedAt: null },
        action: 'reactivate',
        reason: input.reason,
      };
    });
  }

  /** Arşiv yalnız günlük listeden kaldırır; arşivden çıkan şantiye önceki durumuna döner. */
  archive(
    context: CustomerContext,
    id: string,
    input: { archived: boolean; expectedUpdatedAt: string },
  ) {
    return this.change(context, id, input.expectedUpdatedAt, (current) => {
      if (input.archived) {
        if (current.status === 'archived') throw new AppError('CONFLICT', 'Şantiye zaten arşivde.');
        return { set: { status: 'archived' }, action: 'archive' };
      }
      if (current.status !== 'archived') throw new AppError('CONFLICT', 'Şantiye arşivde değil.');
      return { set: { status: current.completedAt ? 'completed' : 'active' }, action: 'unarchive' };
    });
  }

  async pin(context: CustomerContext, id: string, pinned: boolean) {
    const project = await forCompany(ProjectModel, context.companyId).findByIdOrThrow(id);
    project.pinned = pinned;
    project.updatedBy = context.userId;
    project.history.push(
      historyEntry({
        by: context.userId,
        action: pinned ? 'pin' : 'unpin',
        at: this.deps.clock.now(),
      }),
    );
    await project.save();
    const [data] = await this.present(context, [project]);
    return data;
  }

  /** Yalnız hiç aktif hareketi ve anlaşması olmayan şantiye silinir; aksi halde arşivlenir. */
  async remove(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    return withTransaction(async (session) => {
      const project = await forCompany(ProjectModel, context.companyId).findByIdOrThrow(id, {
        session,
      });
      assertSameVersion(project.updatedAt, input.expectedUpdatedAt, () =>
        presentProject(project, emptyNameMaps),
      );
      const [transactions, agreements] = await Promise.all([
        TransactionModel.countDocuments({
          companyId: context.companyId,
          deletedAt: null,
          'allocations.projectId': project._id,
        }).session(session),
        AgreementModel.countDocuments({
          companyId: context.companyId,
          deletedAt: null,
          projectId: project._id,
        }).session(session),
      ]);
      if (transactions + agreements > 0) {
        throw new AppError(
          'HAS_DEPENDENCIES',
          'Bu şantiyenin hareketleri veya anlaşmaları var; silmek yerine arşivleyin.',
          {
            transactions,
            agreements,
          },
        );
      }
      const now = this.deps.clock.now();
      await ProjectModel.updateOne(
        { _id: project._id, companyId: context.companyId },
        {
          $set: {
            deletedAt: now,
            deletedBy: context.userId,
            deleteReason: input.reason,
            updatedBy: context.userId,
          },
          $push: {
            history: historyEntry({
              by: context.userId,
              action: 'delete',
              reason: input.reason,
              at: now,
            }),
          },
        },
        { session },
      );
      return { id: project._id.toString(), deletedAt: now.toISOString() };
    });
  }

  async restore(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    const objectId = toObjectId(id);
    if (!objectId) throw notFound();
    const project = await forCompany(ProjectModel, context.companyId).findById(id, {
      includeDeleted: true,
    });
    if (!project) throw notFound();
    if (!project.deletedAt) throw new AppError('CONFLICT', 'Şantiye silinmiş değil.');
    const now = this.deps.clock.now();
    const restored = await updateScoped({
      model: ProjectModel,
      context,
      id: objectId,
      expectedUpdatedAt: input.expectedUpdatedAt,
      includeDeleted: true,
      update: {
        $set: { deletedAt: null, deletedBy: null, deleteReason: null, updatedBy: context.userId },
        $push: {
          history: historyEntry({
            by: context.userId,
            action: 'restore',
            reason: input.reason,
            at: now,
          }),
        },
      },
      present: (doc) => presentProject(doc, emptyNameMaps),
    });
    const [data] = await this.present(context, [restored]);
    return data;
  }
}
