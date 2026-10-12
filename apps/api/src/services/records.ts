// Firma kayıtları için ortak yardımcılar: geçmiş, doğrulama hatası, sayfalama, sürüm kontrolü.

import type { ValidationIssue } from '@santiye/shared';
import type { Request } from 'express';
import {
  Types,
  type ClientSession,
  type Model,
  type QueryFilter,
  type UpdateQuery,
} from 'mongoose';
import { z } from 'zod';
import {
  notFound,
  type CompanyScopedFields,
  type HistoryChange,
  type HistoryEntry,
} from '../db/company-scope.js';
import { updateIfUnchanged } from '../db/concurrency.js';
import { withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { UserModel } from '../models/user.js';
import type { CustomerContext } from './customer-auth.js';
import { hashRequest, runIdempotent, type IdempotentOutcome } from './idempotency.js';

/** Sistemin kendisinin yaptığı kayıtlar (ör. yeni firmanın başlangıç kategorileri). */
export const SYSTEM_ACTOR_ID = new Types.ObjectId('000000000000000000000000');

export function historyEntry(options: {
  by: Types.ObjectId;
  action: string;
  at: Date;
  changes?: HistoryChange[];
  reason?: string | null;
}): HistoryEntry {
  return {
    at: options.at,
    by: options.by,
    action: options.action,
    changes: options.changes ?? [],
    reason: options.reason?.trim() || null,
  };
}

function comparable(value: unknown): string {
  if (value instanceof Types.ObjectId) return value.toString();
  return JSON.stringify(value ?? null);
}

/** Yalnız değişen alanların eski → yeni listesi. */
export function diffChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): HistoryChange[] {
  return Object.keys(after)
    .filter((field) => comparable(before[field]) !== comparable(after[field]))
    .map((field) => ({ field, old: before[field] ?? null, new: after[field] ?? null }));
}

function issuesDetail(issues: ValidationIssue[]) {
  return {
    issues: issues.map(({ code, message, path }) => ({ code, message, path: path.join('.') })),
  };
}

export function validationError(issues: ValidationIssue[]): AppError {
  return new AppError(
    'VALIDATION',
    issues[0]?.message ?? 'Eksik veya hatalı bilgi.',
    issuesDetail(issues),
  );
}

export function conflictWithIssues(message: string, issues: ValidationIssue[]): AppError {
  return new AppError('CONFLICT', message, issuesDetail(issues));
}

export function requireReason(
  reason: string | undefined | null,
  message = 'Gerekçe girin.',
): string {
  const trimmed = reason?.trim();
  if (!trimmed) throw validationError([{ code: 'REASON_REQUIRED', message, path: ['reason'] }]);
  return trimmed;
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function toObjectId(id: string | undefined | null): Types.ObjectId | null {
  return id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

/** Sorgu metnindeki değer listesi: `?projectId=a&projectId=b` veya `?projectId=a,b`. */
export function queryList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return items
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Silinmemiş kaydı yalnız `expectedUpdatedAt` anından beri değişmediyse günceller;
 * değiştiyse 409 ve güncel kayıt, başka firmanın veya silinmiş kaydı ise 404.
 */
export function updateScoped<T extends CompanyScopedFields>(options: {
  model: Model<T>;
  context: CustomerContext;
  id: Types.ObjectId;
  expectedUpdatedAt: string;
  update: UpdateQuery<T>;
  session?: ClientSession;
  present: (doc: T) => unknown;
  includeDeleted?: boolean;
}) {
  const filter = {
    _id: options.id,
    companyId: options.context.companyId,
    ...(options.includeDeleted ? {} : { deletedAt: null }),
  } as QueryFilter<T>;
  return updateIfUnchanged({
    model: options.model,
    filter,
    expectedUpdatedAt: options.expectedUpdatedAt,
    update: options.update,
    session: options.session,
    present: options.present,
    onMissing: notFound,
  });
}

export function assertSameVersion(
  updatedAt: Date,
  expectedUpdatedAt: string,
  current: () => unknown,
): void {
  if (updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new AppError('CONFLICT', 'Kayıt başka bir yerde güncellendi', { current: current() });
  }
}

export interface ActorRef {
  id: string;
  name: string;
}

/** Oluşturan, güncelleyen ve silen kullanıcıların adları (aynı firma). */
export async function actorNames(
  companyId: Types.ObjectId,
  ids: (Types.ObjectId | null | undefined)[],
): Promise<(id: Types.ObjectId | null | undefined) => ActorRef | null> {
  const unique = [...new Set(ids.filter(Boolean).map((id) => id!.toString()))];
  const users = await UserModel.find({ companyId, _id: { $in: unique } }, { name: 1 });
  const names = new Map(users.map((user) => [user._id.toString(), user.name]));
  return (id) => {
    if (!id) return null;
    const key = id.toString();
    if (key === SYSTEM_ACTOR_ID.toString()) return { id: key, name: 'Sistem' };
    return { id: key, name: names.get(key) ?? 'Bilinmeyen kullanıcı' };
  };
}

/** Idempotency-Key zorunlu oluşturma (para hareketi, anlaşma, iade). */
export function runCompanyIdempotent(
  deps: AppDeps,
  req: Request,
  context: CustomerContext,
  execute: (
    session: ClientSession,
  ) => Promise<{ outcome: IdempotentOutcome; ref: { type: string; id: string } }>,
  replay: (id: string, status: number) => Promise<IdempotentOutcome>,
): Promise<IdempotentOutcome> {
  return runIdempotent({
    keyHeader: req.get('idempotency-key'),
    scope: { companyId: context.companyId, userId: context.userId },
    requestHash: hashRequest(req),
    clock: deps.clock,
    execute,
    replay: (ref) => replay(ref.id, ref.status),
  });
}

/** Idempotency-Key isteğe bağlı oluşturma (şantiye, kişi, kategori): gelirse uygulanır. */
export async function runOptionallyIdempotent(
  deps: AppDeps,
  req: Request,
  context: CustomerContext,
  execute: (
    session: ClientSession,
  ) => Promise<{ outcome: IdempotentOutcome; ref: { type: string; id: string } }>,
  replay: (id: string, status: number) => Promise<IdempotentOutcome>,
): Promise<IdempotentOutcome> {
  if (req.get('idempotency-key')) return runCompanyIdempotent(deps, req, context, execute, replay);
  const { outcome } = await withTransaction(execute);
  return outcome;
}
