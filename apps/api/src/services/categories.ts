// Gider kategorileri (şartname 7.11, 8.5, 10.3).

import { foldTurkish } from '@santiye/shared';
import type { ClientSession, Types } from 'mongoose';
import { forCompany } from '../db/company-scope.js';
import { isDuplicateKeyError } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { CategoryModel, DEFAULT_CATEGORY_NAMES } from '../models/category.js';
import type { CustomerContext } from './customer-auth.js';
import { presentCategory } from './finance-presenters.js';
import type { IdempotentOutcome } from './idempotency.js';
import { diffChanges, historyEntry, SYSTEM_ACTOR_ID, toObjectId, updateScoped } from './records.js';
import { notFound } from '../db/company-scope.js';

function duplicateName(): AppError {
  return new AppError('CONFLICT', 'Bu adla bir kategori var.');
}

/** Yeni firmaya başlangıç kategorileri; firma oluşturmayla aynı transaction'da. */
export async function seedDefaultCategories(
  companyId: Types.ObjectId,
  at: Date,
  session: ClientSession,
): Promise<void> {
  await CategoryModel.insertMany(
    DEFAULT_CATEGORY_NAMES.map((name) => ({
      companyId,
      name,
      nameFolded: foldTurkish(name),
      createdBy: SYSTEM_ACTOR_ID,
      updatedBy: SYSTEM_ACTOR_ID,
      history: [historyEntry({ by: SYSTEM_ACTOR_ID, action: 'create', at })],
    })),
    { session },
  );
}

export class CategoryService {
  constructor(private readonly deps: AppDeps) {}

  async list(context: CustomerContext, includeInactive: boolean) {
    const filter = includeInactive ? {} : { isActive: true };
    const categories = await forCompany(CategoryModel, context.companyId)
      .find(filter)
      .sort({ nameFolded: 1 });
    return categories.map(presentCategory);
  }

  async create(context: CustomerContext, name: string, session: ClientSession) {
    try {
      const category = await forCompany(CategoryModel, context.companyId).create(
        {
          name,
          nameFolded: foldTurkish(name),
          history: [
            historyEntry({ by: context.userId, action: 'create', at: this.deps.clock.now() }),
          ],
        },
        context.userId,
        session,
      );
      return {
        outcome: { status: 201, data: presentCategory(category) } satisfies IdempotentOutcome,
        ref: { type: 'category', id: category._id.toString() },
      };
    } catch (error) {
      if (isDuplicateKeyError(error, 'nameFolded')) throw duplicateName();
      throw error;
    }
  }

  async replay(context: CustomerContext, id: string, status: number): Promise<IdempotentOutcome> {
    const category = await forCompany(CategoryModel, context.companyId).findByIdOrThrow(id);
    return { status, data: presentCategory(category) };
  }

  /** Yeniden adlandır veya pasifleştir; kullanılmış kategori silinmez, pasifleşir. */
  async update(
    context: CustomerContext,
    id: string,
    input: { name?: string | undefined; isActive?: boolean | undefined; expectedUpdatedAt: string },
  ) {
    const objectId = toObjectId(id);
    if (!objectId) throw notFound();
    const current = await forCompany(CategoryModel, context.companyId).findByIdOrThrow(id);
    const next: Record<string, unknown> = {};
    if (input.name !== undefined) next.name = input.name;
    if (input.isActive !== undefined) next.isActive = input.isActive;
    const changes = diffChanges({ name: current.name, isActive: current.isActive }, next);

    try {
      const updated = await updateScoped({
        model: CategoryModel,
        context,
        id: objectId,
        expectedUpdatedAt: input.expectedUpdatedAt,
        update: {
          $set: {
            ...next,
            ...(input.name !== undefined ? { nameFolded: foldTurkish(input.name) } : {}),
            updatedBy: context.userId,
          },
          ...(changes.length > 0
            ? {
                $push: {
                  history: historyEntry({
                    by: context.userId,
                    action: 'update',
                    changes,
                    at: this.deps.clock.now(),
                  }),
                },
              }
            : {}),
        },
        present: presentCategory,
      });
      return presentCategory(updated);
    } catch (error) {
      if (isDuplicateKeyError(error, 'nameFolded')) throw duplicateName();
      throw error;
    }
  }
}
