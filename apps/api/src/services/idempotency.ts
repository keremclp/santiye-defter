// Güvenli tekrar: Idempotency-Key (şartname 3, 9.7, 8.10).

import type { Request } from 'express';
import type { ClientSession, Types } from 'mongoose';
import { isDuplicateKeyError, withTransaction } from '../db/transaction.js';
import { AppError } from '../http/errors.js';
import type { Clock } from '../lib/clock.js';
import { sha256Hex } from '../lib/crypto.js';
import {
  IdempotencyRecordModel,
  type IdempotencyRecord,
  type IdempotencyResultRef,
} from '../models/idempotency-record.js';

/** 24 saatten eski anahtar yeniden kullanılamaz (422 IDEMPOTENCY_EXPIRED). */
export const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface IdempotentOutcome {
  status: number;
  data: unknown;
  message?: string;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Aynı yol ve aynı gövde aynı özeti verir; anahtar sırası önemli değildir. */
export function hashRequest(req: Request): string {
  return sha256Hex(`${req.method} ${req.baseUrl}${req.path}\n${stableStringify(req.body)}`);
}

function readKey(header: string | undefined): string {
  const key = header?.trim();
  if (!key) throw new AppError('VALIDATION', 'Idempotency-Key başlığı gerekli.');
  if (!UUID.test(key)) {
    throw new AppError('VALIDATION', 'Idempotency-Key başlığı geçerli bir UUID olmalı.');
  }
  return key.toLowerCase();
}

/**
 * Oluşturan bir isteği güvenli tekrarla çalıştırır:
 * - Anahtar kaydı işlemle aynı transaction'da ilk yazı olarak eklenir; benzersiz indeks
 *   eşzamanlı ikinci isteğin ikinci kayıt açmasını engeller.
 * - Aynı anahtar + aynı gövde → ilk sonuç `replay` ile tekrar döner.
 * - Aynı anahtar + farklı gövde → 422 IDEMPOTENCY_MISMATCH; 24 saatten eski → 422 IDEMPOTENCY_EXPIRED.
 */
export async function runIdempotent(options: {
  keyHeader: string | undefined;
  scope: { companyId: Types.ObjectId | null; userId: Types.ObjectId };
  requestHash: string;
  clock: Clock;
  execute: (
    session: ClientSession,
  ) => Promise<{ outcome: IdempotentOutcome; ref: { type: string; id: string } }>;
  replay: (ref: IdempotencyResultRef) => Promise<IdempotentOutcome>;
}): Promise<IdempotentOutcome> {
  const key = readKey(options.keyHeader);
  const filter = { companyId: options.scope.companyId, key };

  const replayExisting = async (record: IdempotencyRecord): Promise<IdempotentOutcome> => {
    if (options.clock.now().getTime() - record.createdAt.getTime() > IDEMPOTENCY_KEY_TTL_MS) {
      throw new AppError(
        'IDEMPOTENCY_EXPIRED',
        'Bu gönderimin süresi doldu. Yeni kayıt için formu yeniden gönderin.',
      );
    }
    if (record.requestHash !== options.requestHash) {
      throw new AppError(
        'IDEMPOTENCY_MISMATCH',
        'Bu gönderim anahtarı farklı bir istek için kullanılmış.',
      );
    }
    if (!record.resultRef) throw new Error('Güvenli tekrar kaydında sonuç yok.');
    return options.replay(record.resultRef);
  };

  const existing = await IdempotencyRecordModel.findOne(filter);
  if (existing) return replayExisting(existing);

  try {
    return await withTransaction(async (session) => {
      await IdempotencyRecordModel.create(
        [
          {
            ...filter,
            userId: options.scope.userId,
            requestHash: options.requestHash,
            resultRef: null,
            createdAt: options.clock.now(),
          },
        ],
        { session },
      );
      const { outcome, ref } = await options.execute(session);
      await IdempotencyRecordModel.updateOne(
        filter,
        { $set: { resultRef: { ...ref, status: outcome.status } } },
        { session },
      );
      return outcome;
    });
  } catch (error) {
    if (!isDuplicateKeyError(error, 'key')) throw error;
    const winner = await IdempotencyRecordModel.findOne(filter);
    if (!winner) throw error;
    return replayExisting(winner);
  }
}
