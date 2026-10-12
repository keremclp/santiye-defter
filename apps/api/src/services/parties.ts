// Kişi / firma kayıtları ve hesap durumu (şartname 7.3, 8.4, 9.1, 9.5, 10.5).

import {
  foldTurkish,
  PARTY_KINDS,
  PARTY_TAGS,
  type PartyCreateInput,
  type PartyUpdateInput,
} from '@santiye/shared';
import type { ClientSession, QueryFilter, Types } from 'mongoose';
import { z } from 'zod';
import { forCompany, notFound } from '../db/company-scope.js';
import { withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { businessToday } from '../lib/clock.js';
import { AgreementModel } from '../models/agreement.js';
import { PartyModel, type Party } from '../models/party.js';
import { TransactionModel } from '../models/transaction.js';
import type { CustomerContext } from './customer-auth.js';
import {
  emptyNameMaps,
  historyActors,
  loadNameMaps,
  presentAgreement,
  presentHistory,
  presentParty,
  presentTransaction,
  transactionRefs,
} from './finance-presenters.js';
import type { IdempotentOutcome } from './idempotency.js';
import { cashTotals } from './ledger.js';
import { summarizeObligations } from './obligations.js';
import { foldedContains } from './projects.js';
import {
  assertSameVersion,
  diffChanges,
  historyEntry,
  paginationSchema,
  toObjectId,
  updateScoped,
} from './records.js';

export const partyListQuerySchema = paginationSchema.extend({
  q: z.string().trim().optional(),
  tag: z.enum(PARTY_TAGS).optional(),
  kind: z.enum(PARTY_KINDS).optional(),
  active: z.enum(['true', 'false', 'all']).default('all'),
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

/** Ad veya telefonla arama. */
function searchFilter(q: string): QueryFilter<Party> {
  const digits = q.replace(/\D/g, '');
  return {
    $or: [
      { nameFolded: foldedContains(q) },
      ...(digits.length >= 3 ? [{ phone: { $regex: digits.split('').join('\\D*') } }] : []),
    ],
  };
}

export class PartyService {
  constructor(private readonly deps: AppDeps) {}

  private async present(context: CustomerContext, parties: Party[], withHistory = false) {
    const maps = await loadNameMaps(context.companyId, {
      users: [
        ...parties.flatMap((p) => [p.createdBy, p.updatedBy, p.deletedBy]),
        ...(withHistory ? historyActors(parties) : []),
      ],
    });
    return parties.map((party) => ({
      ...presentParty(party, maps),
      ...(withHistory ? { history: presentHistory(party.history, maps) } : {}),
    }));
  }

  async list(context: CustomerContext, query: z.infer<typeof partyListQuerySchema>) {
    const filter: QueryFilter<Party> = {};
    if (query.q) Object.assign(filter, searchFilter(query.q));
    if (query.tag) filter.tags = query.tag;
    if (query.kind) filter.kind = query.kind;
    if (query.active !== 'all') filter.isActive = query.active === 'true';
    const scope = forCompany(PartyModel, context.companyId);
    const options = { includeDeleted: query.includeDeleted };
    const sort = { ...(query.pinnedFirst ? { pinned: -1 } : {}), ...SORTS[query.sort] } as Record<
      string,
      1 | -1
    >;

    const [parties, total] = await Promise.all([
      scope
        .find(filter, options)
        .sort(sort)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      scope.countDocuments(filter, options),
    ]);
    return {
      items: await this.present(context, parties),
      page: query.page,
      limit: query.limit,
      total,
    };
  }

  /** En fazla 8 öneri; pasifler hariç. */
  async suggest(context: CustomerContext, q: string) {
    const filter: QueryFilter<Party> = { isActive: true, ...(q ? searchFilter(q) : {}) };
    const parties = await forCompany(PartyModel, context.companyId)
      .find(filter)
      .sort({ lastUsedAt: -1, nameFolded: 1 })
      .limit(8);
    return parties.map((party) => ({
      id: party._id.toString(),
      name: party.name,
      kind: party.kind,
      tags: party.tags,
    }));
  }

  private async similarNames(context: CustomerContext, name: string) {
    const matches = await forCompany(PartyModel, context.companyId)
      .find({ nameFolded: foldedContains(name) })
      .limit(5);
    return matches.map((party) => ({ id: party._id.toString(), name: party.name }));
  }

  /** Benzer ad önerilir ve uyarılır; yalnız ad eşitliği yüzünden engellenmez veya birleştirilmez. */
  async create(context: CustomerContext, input: PartyCreateInput, session: ClientSession) {
    const similar = await this.similarNames(context, input.name);
    const party = await forCompany(PartyModel, context.companyId).create(
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
    const [data] = await this.present(context, [party]);
    return {
      outcome: {
        status: 201,
        data: {
          ...data,
          warnings:
            similar.length > 0
              ? [{ code: 'SIMILAR_NAME', message: 'Benzer adlı kişi/firma var.', related: similar }]
              : [],
        },
      } satisfies IdempotentOutcome,
      ref: { type: 'party', id: party._id.toString() },
    };
  }

  async replay(context: CustomerContext, id: string, status: number): Promise<IdempotentOutcome> {
    const party = await forCompany(PartyModel, context.companyId).findByIdOrThrow(id);
    const [data] = await this.present(context, [party]);
    return { status, data };
  }

  /**
   * Borç, alacak, fazla ödeme ve fazla tahsilat ayrı; şantiye ve firma geneli dağılımı;
   * anlaşmaya bağlanmamış doğrudan hareketlerin toplamı ayrı. Otomatik mahsup yok.
   */
  private async finance(context: CustomerContext, partyId: Types.ObjectId) {
    const today = businessToday(this.deps.clock);
    const agreements = await AgreementModel.find({
      companyId: context.companyId,
      deletedAt: null,
      partyId,
    })
      .sort({ createdAt: 1 })
      .lean();
    const summary = summarizeObligations(agreements, today);

    const scopes = new Map<string, typeof agreements>();
    for (const agreement of agreements) {
      const key = agreement.projectId?.toString() ?? 'company';
      scopes.set(key, [...(scopes.get(key) ?? []), agreement]);
    }
    const maps = await loadNameMaps(context.companyId, {
      projects: agreements.map((a) => a.projectId),
      parties: [partyId],
      users: agreements.flatMap((a) => [a.createdBy, a.updatedBy]),
    });
    const byScope = [...scopes].map(([key, rows]) => {
      const scoped = summarizeObligations(rows, today);
      return {
        scope: key === 'company' ? 'company' : 'project',
        project: key === 'company' ? null : maps.project(rows[0]?.projectId),
        payable: scoped.payable,
        receivable: scoped.receivable,
      };
    });

    const directTransactions = await cashTotals(
      context.companyId,
      { partyId, allocations: { $not: { $elemMatch: { agreementId: { $ne: null } } } } },
      null,
    );
    return {
      payable: summary.payable,
      receivable: summary.receivable,
      openings: summary.openings,
      overpaid: summary.payable.excess,
      overcollected: summary.receivable.excess,
      byScope,
      directTransactions,
      agreements: agreements.map((agreement) => presentAgreement(agreement, maps)),
    };
  }

  async get(context: CustomerContext, id: string) {
    const party = await forCompany(PartyModel, context.companyId).findByIdOrThrow(id);
    const [data] = await this.present(context, [party], true);
    return { ...data, finance: await this.finance(context, party._id) };
  }

  /** Hesap dökümü verisi: anlaşmalar, başlangıç kayıtları ve hareketler; doğrudan hareketler işaretli. */
  async statement(context: CustomerContext, id: string) {
    const party = await forCompany(PartyModel, context.companyId).findByIdOrThrow(id);
    const [finance, transactions] = await Promise.all([
      this.finance(context, party._id),
      TransactionModel.find({
        companyId: context.companyId,
        deletedAt: null,
        partyId: party._id,
      }).sort({ date: 1, recordNo: 1 }),
    ]);
    const maps = await loadNameMaps(context.companyId, transactionRefs(transactions));
    const [presented] = await this.present(context, [party]);
    return {
      party: presented,
      ...finance,
      transactions: transactions.map((transaction) => ({
        ...presentTransaction(transaction, maps),
        notLinkedToAgreement: transaction.allocations.every(
          (allocation) => allocation.agreementId === null,
        ),
      })),
      generatedAt: this.deps.clock.now().toISOString(),
    };
  }

  async update(context: CustomerContext, id: string, input: PartyUpdateInput) {
    const objectId = toObjectId(id);
    if (!objectId) throw notFound();
    const current = await forCompany(PartyModel, context.companyId).findByIdOrThrow(id);
    const { expectedUpdatedAt, ...fields } = input;
    const changes = diffChanges(current.toObject() as unknown as Record<string, unknown>, fields);
    const action =
      fields.isActive === false && current.isActive
        ? 'deactivate'
        : fields.isActive && !current.isActive
          ? 'activate'
          : 'update';
    const updated = await updateScoped({
      model: PartyModel,
      context,
      id: objectId,
      expectedUpdatedAt,
      update: {
        $set: {
          ...fields,
          ...(fields.name !== undefined ? { nameFolded: foldTurkish(fields.name) } : {}),
          updatedBy: context.userId,
        },
        ...(changes.length > 0
          ? {
              $push: {
                history: historyEntry({
                  by: context.userId,
                  action,
                  changes,
                  at: this.deps.clock.now(),
                }),
              },
            }
          : {}),
      },
      present: (doc) => presentParty(doc, emptyNameMaps),
    });
    const [data] = await this.present(context, [updated]);
    return data;
  }

  async pin(context: CustomerContext, id: string, pinned: boolean) {
    const party = await forCompany(PartyModel, context.companyId).findByIdOrThrow(id);
    party.pinned = pinned;
    party.updatedBy = context.userId;
    party.history.push(
      historyEntry({
        by: context.userId,
        action: pinned ? 'pin' : 'unpin',
        at: this.deps.clock.now(),
      }),
    );
    await party.save();
    const [data] = await this.present(context, [party]);
    return data;
  }

  /**
   * Yalnız hiç kaydı olmayan kişi silinir; silinmiş ama geri yüklenebilir kayıtlar da sayılır.
   * Kaydı olan kişi pasifleştirilir.
   */
  async remove(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    return withTransaction(async (session) => {
      const party = await forCompany(PartyModel, context.companyId).findByIdOrThrow(id, {
        session,
      });
      assertSameVersion(party.updatedAt, input.expectedUpdatedAt, () =>
        presentParty(party, emptyNameMaps),
      );
      const [transactions, agreements] = await Promise.all([
        TransactionModel.countDocuments({
          companyId: context.companyId,
          partyId: party._id,
        }).session(session),
        AgreementModel.countDocuments({ companyId: context.companyId, partyId: party._id }).session(
          session,
        ),
      ]);
      if (transactions + agreements > 0) {
        throw new AppError(
          'HAS_DEPENDENCIES',
          'Bu kişinin kayıtları var; silmek yerine pasifleştirin.',
          {
            transactions,
            agreements,
          },
        );
      }
      const now = this.deps.clock.now();
      await PartyModel.updateOne(
        { _id: party._id, companyId: context.companyId },
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
      return { id: party._id.toString(), deletedAt: now.toISOString() };
    });
  }

  async restore(
    context: CustomerContext,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    const objectId = toObjectId(id);
    if (!objectId) throw notFound();
    const party = await forCompany(PartyModel, context.companyId).findById(id, {
      includeDeleted: true,
    });
    if (!party) throw notFound();
    if (!party.deletedAt) throw new AppError('CONFLICT', 'Kişi silinmiş değil.');
    const restored = await updateScoped({
      model: PartyModel,
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
            at: this.deps.clock.now(),
          }),
        },
      },
      present: (doc) => presentParty(doc, emptyNameMaps),
    });
    const [data] = await this.present(context, [restored]);
    return data;
  }
}
