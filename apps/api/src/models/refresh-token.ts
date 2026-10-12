import { Schema } from 'mongoose';

export interface StoredRefreshToken {
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

/** Refresh token yalnız hash olarak saklanır; kullanıcı başına en fazla son 10 tanesi tutulur. */
export const MAX_REFRESH_TOKENS = 10;

export const refreshTokenSchema = new Schema<StoredRefreshToken>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);
