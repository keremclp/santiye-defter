// Firma kayıtlarının API cevap biçimleri. Tutarlar kuruş tamsayı, iş tarihleri YYYY-MM-DD.

import type { Types } from 'mongoose';
import type { CompanyScopedFields, HistoryEntry } from '../db/company-scope.js';
import type { Agreement } from '../models/agreement.js';
import { AgreementModel } from '../models/agreement.js';
import type { Category } from '../models/category.js';
import { CategoryModel } from '../models/category.js';
import type { Party } from '../models/party.js';
import { PartyModel } from '../models/party.js';
import type { Project } from '../models/project.js';
import { ProjectModel } from '../models/project.js';
import type { Transaction } from '../models/transaction.js';
import { actorNames, type ActorRef } from './records.js';

type Id = Types.ObjectId | null | undefined;

export interface NameRef {
  id: string;
  name: string;
  deleted: boolean;
}

export interface NameMaps {
  project(id: Id): (NameRef & { status: Project['status'] }) | null;
  party(id: Id): NameRef | null;
  agreement(id: Id): (NameRef & { kind: Agreement['kind'] }) | null;
  category(id: Id): NameRef | null;
  actor(id: Id): ActorRef | null;
}

/** Çakışma cevabındaki güncel kayıt için; adlar yüklenmez. */
export const emptyNameMaps: NameMaps = {
  project: () => null,
  party: () => null,
  agreement: () => null,
  category: () => null,
  actor: (id) => (id ? { id: id.toString(), name: '' } : null),
};

export function agreementLabel(agreement: Pick<Agreement, 'kind' | 'direction' | 'title'>): string {
  if (agreement.kind === 'agreement') return agreement.title;
  return agreement.direction === 'payable' ? 'Başlangıç borcu' : 'Başlangıç alacağı';
}

const keyOf = (id: Id) => id?.toString() ?? '';
const ids = (values: Id[]) => [
  ...new Set(values.filter(Boolean).map((value) => value!.toString())),
];

/** Verilen kimliklerin adları; silinmiş kayıtların adları da gösterilir. */
export async function loadNameMaps(
  companyId: Types.ObjectId,
  refs: { projects?: Id[]; parties?: Id[]; agreements?: Id[]; categories?: Id[]; users?: Id[] },
): Promise<NameMaps> {
  const [projects, parties, agreements, categories, actor] = await Promise.all([
    ProjectModel.find(
      { companyId, _id: { $in: ids(refs.projects ?? []) } },
      { name: 1, status: 1, deletedAt: 1 },
    ).lean(),
    PartyModel.find(
      { companyId, _id: { $in: ids(refs.parties ?? []) } },
      { name: 1, deletedAt: 1 },
    ).lean(),
    AgreementModel.find(
      { companyId, _id: { $in: ids(refs.agreements ?? []) } },
      { kind: 1, direction: 1, title: 1, deletedAt: 1 },
    ).lean(),
    CategoryModel.find(
      { companyId, _id: { $in: ids(refs.categories ?? []) } },
      { name: 1, deletedAt: 1 },
    ).lean(),
    actorNames(companyId, refs.users ?? []),
  ]);

  const projectMap = new Map(
    projects.map((p) => [
      p._id.toString(),
      { id: p._id.toString(), name: p.name, status: p.status, deleted: p.deletedAt !== null },
    ]),
  );
  const partyMap = new Map(
    parties.map((p) => [
      p._id.toString(),
      { id: p._id.toString(), name: p.name, deleted: p.deletedAt !== null },
    ]),
  );
  const agreementMap = new Map(
    agreements.map((a) => [
      a._id.toString(),
      {
        id: a._id.toString(),
        name: agreementLabel(a),
        kind: a.kind,
        deleted: a.deletedAt !== null,
      },
    ]),
  );
  const categoryMap = new Map(
    categories.map((c) => [
      c._id.toString(),
      { id: c._id.toString(), name: c.name, deleted: c.deletedAt !== null },
    ]),
  );

  return {
    project: (id) => projectMap.get(keyOf(id)) ?? null,
    party: (id) => partyMap.get(keyOf(id)) ?? null,
    agreement: (id) => agreementMap.get(keyOf(id)) ?? null,
    category: (id) => categoryMap.get(keyOf(id)) ?? null,
    actor,
  };
}

export function transactionRefs(transactions: Transaction[]) {
  return {
    projects: transactions.flatMap((t) => t.allocations.map((a) => a.projectId)),
    agreements: transactions.flatMap((t) => t.allocations.map((a) => a.agreementId)),
    parties: transactions.map((t) => t.partyId),
    categories: transactions.map((t) => t.categoryId),
    users: transactions.flatMap((t) => [t.createdBy, t.updatedBy, t.deletedBy]),
  };
}

function recordMeta(doc: CompanyScopedFields, maps: NameMaps) {
  return {
    createdBy: maps.actor(doc.createdBy),
    createdAt: doc.createdAt.toISOString(),
    updatedBy: maps.actor(doc.updatedBy),
    updatedAt: doc.updatedAt.toISOString(),
    deletedAt: doc.deletedAt?.toISOString() ?? null,
    deletedBy: maps.actor(doc.deletedBy),
    deleteReason: doc.deleteReason,
  };
}

export function presentHistory(history: HistoryEntry[], maps: NameMaps) {
  return history.map((entry) => ({
    at: entry.at.toISOString(),
    by: maps.actor(entry.by),
    action: entry.action,
    changes: entry.changes,
    reason: entry.reason,
  }));
}

export function historyActors(docs: { history: HistoryEntry[] }[]): Id[] {
  return docs.flatMap((doc) => doc.history.map((entry) => entry.by));
}

export function presentTransaction(doc: Transaction, maps: NameMaps) {
  return {
    id: doc._id.toString(),
    recordNo: doc.recordNo,
    kind: doc.kind,
    amount: doc.amount,
    date: doc.date,
    partyId: doc.partyId?.toString() ?? null,
    party: maps.party(doc.partyId),
    categoryId: doc.categoryId?.toString() ?? null,
    category: maps.category(doc.categoryId),
    description: doc.description,
    isSplit: doc.allocations.length > 1,
    linkedToAgreement: doc.allocations.some((allocation) => allocation.agreementId !== null),
    allocations: doc.allocations.map((allocation) => ({
      id: allocation._id.toString(),
      scope: allocation.scope,
      projectId: allocation.projectId?.toString() ?? null,
      project: maps.project(allocation.projectId),
      agreementId: allocation.agreementId?.toString() ?? null,
      agreement: maps.agreement(allocation.agreementId),
      amount: allocation.amount,
      refundedAmount: allocation.refundedAmount,
    })),
    refundOf: doc.refundOf
      ? {
          transactionId: doc.refundOf.transactionId.toString(),
          parts: doc.refundOf.parts.map((part) => ({
            allocationId: part.allocationId.toString(),
            amount: part.amount,
          })),
        }
      : null,
    excess: doc.excess,
    documentCount: doc.documentCount,
    ...recordMeta(doc, maps),
  };
}

export function presentAgreement(doc: Agreement, maps: NameMaps) {
  return {
    id: doc._id.toString(),
    kind: doc.kind,
    direction: doc.direction,
    label: agreementLabel(doc),
    title: doc.title,
    description: doc.description,
    scope: doc.scope,
    projectId: doc.projectId?.toString() ?? null,
    project: maps.project(doc.projectId),
    partyId: doc.partyId.toString(),
    party: maps.party(doc.partyId),
    initialAmount: doc.initialAmount,
    currentAmount: doc.currentAmount,
    netSettled: doc.netSettled,
    remaining: doc.remaining,
    excess: doc.excess,
    paymentStatus: doc.paymentStatus,
    workStatus: doc.workStatus,
    settlementPending: doc.settlementPending,
    agreementDate: doc.agreementDate,
    trackingStartDate: doc.trackingStartDate,
    dueDate: doc.dueDate,
    ...recordMeta(doc, maps),
  };
}

export function presentProject(doc: Project, maps: NameMaps) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    address: doc.address,
    startDate: doc.startDate,
    status: doc.status,
    completedAt: doc.completedAt,
    pinned: doc.pinned,
    lastUsedAt: doc.lastUsedAt?.toISOString() ?? null,
    ...recordMeta(doc, maps),
  };
}

export function presentParty(doc: Party, maps: NameMaps) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    kind: doc.kind,
    tags: doc.tags,
    phone: doc.phone,
    email: doc.email,
    address: doc.address,
    note: doc.note,
    isActive: doc.isActive,
    pinned: doc.pinned,
    lastUsedAt: doc.lastUsedAt?.toISOString() ?? null,
    ...recordMeta(doc, maps),
  };
}

export function presentCategory(doc: Category) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    isActive: doc.isActive,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
