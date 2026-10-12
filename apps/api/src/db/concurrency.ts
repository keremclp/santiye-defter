// expectedUpdatedAt ile eşzamanlı güncelleme kontrolü (şartname 3).

import type { ClientSession, Model, QueryFilter, UpdateQuery } from 'mongoose';
import { AppError } from '../http/errors.js';

export function conflictError(current: unknown): AppError {
  return new AppError('CONFLICT', 'Kayıt başka bir yerde güncellendi', { current });
}

/**
 * Kayıt `expectedUpdatedAt` anından beri değişmediyse günceller. Değiştiyse sessizce üzerine
 * yazmaz: 409 CONFLICT ve güncel kaydı döner. Kayıt yoksa `onMissing` hatası atılır.
 */
export async function updateIfUnchanged<T extends { updatedAt: Date }>(options: {
  model: Model<T>;
  filter: QueryFilter<T>;
  expectedUpdatedAt: string;
  update: UpdateQuery<T>;
  session?: ClientSession;
  present: (doc: T) => unknown;
  onMissing: () => Error;
}) {
  const expected = new Date(options.expectedUpdatedAt);
  const updated = await options.model.findOneAndUpdate(
    { ...options.filter, updatedAt: expected } as QueryFilter<T>,
    options.update,
    { returnDocument: 'after', session: options.session ?? null },
  );
  if (updated) return updated;

  const current = await options.model.findOne(options.filter).session(options.session ?? null);
  if (!current) throw options.onMissing();
  throw conflictError(options.present(current));
}
