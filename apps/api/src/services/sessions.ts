// Access + refresh token çifti üretimi ve dönen refresh (şartname 2 ve 3).

import type { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { hashRefreshToken, TokenError } from '../lib/tokens.js';
import { MAX_REFRESH_TOKENS, type StoredRefreshToken } from '../models/refresh-token.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface SessionOwner {
  _id: Types.ObjectId;
  refreshTokens: StoredRefreshToken[];
}

export function sessionExpired(): AppError {
  return new AppError('UNAUTHORIZED', 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
}

export async function issueTokenPair<T extends SessionOwner>(
  deps: AppDeps,
  model: Model<T>,
  ownerId: Types.ObjectId,
  audience: 'customer' | 'platform',
  session?: ClientSession,
): Promise<TokenPair> {
  const subject = ownerId.toString();
  const accessToken = await deps.tokens.signAccess(audience, subject);
  const refresh = await deps.tokens.signRefresh(audience, subject);
  const stored: StoredRefreshToken = {
    tokenHash: refresh.tokenHash,
    expiresAt: refresh.expiresAt,
    createdAt: deps.clock.now(),
  };
  await model.updateOne(
    { _id: ownerId } as QueryFilter<T>,
    {
      $push: { refreshTokens: { $each: [stored], $slice: -MAX_REFRESH_TOKENS } },
    },
    { session, timestamps: false },
  );
  return { accessToken, refreshToken: refresh.token };
}

/**
 * Refresh token'ı tek kullanımlık olarak tüketir: kayıtlı hash atomik olarak silinir.
 * Aynı token ikinci kez (veya eşzamanlı iki istekte) kullanılırsa 401 döner.
 */
export async function consumeRefreshToken<T extends SessionOwner>(
  deps: AppDeps,
  model: Model<T>,
  token: string,
  audience: 'customer' | 'platform',
): Promise<Types.ObjectId> {
  let subject: string;
  try {
    subject = (await deps.tokens.verifyRefresh(token, audience)).subject;
  } catch (error) {
    if (error instanceof TokenError) throw sessionExpired();
    throw error;
  }

  const tokenHash = hashRefreshToken(token);
  const owner = await model.findOneAndUpdate(
    { _id: subject, 'refreshTokens.tokenHash': tokenHash },
    { $pull: { refreshTokens: { tokenHash } } },
    { timestamps: false },
  );
  if (!owner) throw sessionExpired();
  return owner._id;
}

/** Tek refresh token'ı veya verilmezse hepsini siler. */
export async function revokeRefreshTokens<T extends SessionOwner>(
  model: Model<T>,
  ownerId: Types.ObjectId,
  token?: string,
): Promise<void> {
  const update = token
    ? { $pull: { refreshTokens: { tokenHash: hashRefreshToken(token) } } }
    : { $set: { refreshTokens: [] } };
  await model.updateOne({ _id: ownerId } as QueryFilter<T>, update, {
    timestamps: false,
  });
}

export function bearerToken(header: string | undefined): string {
  const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  if (!match?.[1]) throw new AppError('UNAUTHORIZED', 'Oturum açmanız gerekiyor.');
  return match[1];
}
