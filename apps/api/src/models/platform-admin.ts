import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { refreshTokenSchema, type StoredRefreshToken } from './refresh-token.js';

export interface PlatformAdmin {
  _id: Types.ObjectId;
  username: string;
  passwordHash: string;
  refreshTokens: StoredRefreshToken[];
  /** PLATFORM_TOTP_ENCRYPTION_KEY ile AES-256-GCM şifreli */
  totpSecretEncrypted: string | null;
  /** Giriş sonrası yeniden kurulumda onay bekleyen yeni anahtar (şifreli); onaylanana kadar eskisi geçerli */
  pendingTotpSecretEncrypted: string | null;
  /** null ise ilk girişte kurulum zorunlu */
  totpConfirmedAt: Date | null;
  /** Kabul edilen son TOTP zaman adımı; aynı kod ikinci kez kabul edilmez */
  totpLastUsedStep: number | null;
  recoveryCodeHashes: string[];
  failedSecondFactorCount: number;
  secondFactorLockedUntil: Date | null;
  tokensValidAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const platformAdminSchema = new Schema<PlatformAdmin>(
  {
    username: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    totpSecretEncrypted: { type: String, default: null, select: false },
    pendingTotpSecretEncrypted: { type: String, default: null, select: false },
    totpConfirmedAt: { type: Date, default: null },
    totpLastUsedStep: { type: Number, default: null },
    recoveryCodeHashes: { type: [String], default: [], select: false },
    failedSecondFactorCount: { type: Number, default: 0 },
    secondFactorLockedUntil: { type: Date, default: null },
    tokensValidAfter: { type: Date, default: null },
  },
  { timestamps: true },
);

platformAdminSchema.index({ username: 1 }, { unique: true });

export const PlatformAdminModel = model<PlatformAdmin>('PlatformAdmin', platformAdminSchema);
export type PlatformAdminDocument = HydratedDocument<PlatformAdmin>;
