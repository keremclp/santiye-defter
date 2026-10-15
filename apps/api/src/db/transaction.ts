import mongoose, { type ClientSession } from 'mongoose';

/**
 * Bütün yazıları tek MongoDB transaction'ında çalıştırır (şartname 3, atomik işlem).
 * Geçici çakışmalarda sürücü işlevi yeniden çalıştırabilir; işlev yalnız veritabanına yazmalıdır.
 */
export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  let result: T | undefined;
  await mongoose.connection.transaction(async (session) => {
    result = await work(session);
  });
  return result as T;
}

/**
 * Okumaları tek tutarlı veri görünümünden (snapshot) yapar; rapor satırları ve özetleri eşzamanlı
 * bir değişiklikle birbirini çelişmez (şartname 7.10). Oturum paralel sorguda kullanılmaz.
 */
export async function withReadSnapshot<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    session.startTransaction({ readConcern: { level: 'snapshot' } });
    const result = await work(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

interface MongoServerErrorLike {
  code?: number;
  keyPattern?: Record<string, unknown>;
}

/** Benzersiz indeks ihlali; `field` verilirse yalnız o alanın ihlali. */
export function isDuplicateKeyError(error: unknown, field?: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, keyPattern } = error as MongoServerErrorLike;
  if (code !== 11000) return false;
  return field === undefined || (keyPattern !== undefined && field in keyPattern);
}
