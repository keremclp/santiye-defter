// Firma verisi taşıyan modellerin ortak alanları ve firma ayrımı (şartname 3 ve 8).

import {
  isValidObjectId,
  Schema,
  Types,
  type ClientSession,
  type Model,
  type Query,
  type QueryFilter,
} from 'mongoose';
import { AppError } from '../http/errors.js';

export interface HistoryChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface HistoryEntry {
  at: Date;
  by: Types.ObjectId;
  action: string;
  changes: HistoryChange[];
  reason: string | null;
}

export interface CompanyScopedFields {
  companyId: Types.ObjectId;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
  deleteReason: string | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  history: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export const historyEntrySchema = new Schema<HistoryEntry>(
  {
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    changes: {
      type: [{ _id: false, field: String, old: Schema.Types.Mixed, new: Schema.Types.Mixed }],
      default: [],
    },
    reason: { type: String, default: null },
  },
  { _id: false },
);

const FILTERED_QUERIES = [
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'distinct',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndReplace',
  'findOneAndUpdate',
  'replaceOne',
  'updateMany',
  'updateOne',
] as const;

const MISSING_COMPANY_FILTER = 'Firma verisi companyId filtresi olmadan sorgulanamaz.';

/**
 * Ortak alanları ekler ve companyId filtresi olmayan her sorguyu reddeder. Böylece servis
 * katmanındaki `forCompany` dışında yanlışlıkla firmalar arası sorgu yazılamaz.
 */
export function companyScopedPlugin(schema: Schema): void {
  schema.add({
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, immutable: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deleteReason: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    history: { type: [historyEntrySchema], default: [] },
  });
  schema.set('timestamps', true);

  schema.pre<Query<unknown, unknown>>([...FILTERED_QUERIES], function () {
    if (!('companyId' in this.getFilter())) throw new Error(MISSING_COMPANY_FILTER);
  });
  schema.pre('aggregate', function () {
    const first = this.pipeline()[0] as { $match?: Record<string, unknown> } | undefined;
    if (!first?.$match || !('companyId' in first.$match)) throw new Error(MISSING_COMPANY_FILTER);
  });
}

export function notFound(): AppError {
  return new AppError('NOT_FOUND', 'Bu kayda erişilemiyor.');
}

interface ScopeOptions {
  includeDeleted?: boolean;
  session?: ClientSession | null;
}

/**
 * Bir firmanın kayıtlarına erişim. companyId her filtreye zorla eklenir; istemciden gelen
 * companyId kullanılmaz. Başka firmanın kaydı bulunamamış gibi davranır (404).
 */
export function forCompany<T extends CompanyScopedFields>(
  model: Model<T>,
  companyId: Types.ObjectId,
) {
  const scopedFilter = (filter: QueryFilter<T>, options: ScopeOptions = {}): QueryFilter<T> => ({
    ...filter,
    companyId,
    ...(options.includeDeleted ? {} : { deletedAt: null }),
  });

  return {
    filter: scopedFilter,

    find(filter: QueryFilter<T> = {}, options: ScopeOptions = {}) {
      return model.find(scopedFilter(filter, options)).session(options.session ?? null);
    },

    async findById(id: string, options: ScopeOptions = {}) {
      if (!isValidObjectId(id)) return null;
      return model
        .findOne(scopedFilter({ _id: new Types.ObjectId(id) }, options))
        .session(options.session ?? null);
    },

    async findByIdOrThrow(id: string, options: ScopeOptions = {}) {
      const doc = await this.findById(id, options);
      if (!doc) throw notFound();
      return doc;
    },

    countDocuments(filter: QueryFilter<T> = {}, options: ScopeOptions = {}) {
      return model.countDocuments(scopedFilter(filter, options)).session(options.session ?? null);
    },

    async create(
      data: Omit<Partial<T>, 'companyId' | 'createdBy' | 'updatedBy'>,
      by: Types.ObjectId,
      session?: ClientSession,
    ) {
      const doc = new model({ ...data, companyId, createdBy: by, updatedBy: by });
      await doc.save({ session: session ?? null });
      return doc;
    },
  };
}
