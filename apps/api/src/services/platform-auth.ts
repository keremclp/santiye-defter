// Ürün sahibi kimliği: şifre + zorunlu TOTP veya kurtarma kodu (şartname 3, 7.13, 8.2, 9.8, 10.10).

import { normalizeUsername, type LoginInput, type TotpResetStartInput } from '@santiye/shared';
import { isValidObjectId, type Types } from 'mongoose';
import { generateSecret, generateURI, verify } from 'otplib';
import { withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import type { Clock } from '../lib/clock.js';
import { decryptSecret, encryptSecret, randomReadable, sha256Hex } from '../lib/crypto.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../lib/passwords.js';
import { isIssuedBeforeRevocation, revocationTime, TokenError } from '../lib/tokens.js';
import { PlatformAdminModel, type PlatformAdminDocument } from '../models/platform-admin.js';
import { rateLimited } from './customer-auth.js';
import { writePlatformLog } from './platform-log.js';
import { presentPlatformAdmin } from './presenters.js';
import {
  consumeRefreshToken,
  issueTokenPair,
  revokeRefreshTokens,
  sessionExpired,
  type TokenPair,
} from './sessions.js';

export const RECOVERY_CODE_COUNT = 10;
/** Şartname 9.8: 5 hatalı ikinci adım denemesinde 15 dakika kilit. */
export const SECOND_FACTOR_MAX_FAILURES = 5;
export const SECOND_FACTOR_LOCK_MS = 15 * 60 * 1000;

const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVALID_CREDENTIALS = 'Kullanıcı adı veya şifre hatalı';

function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashRecoveryCode(code: string): string {
  return sha256Hex(normalizeRecoveryCode(code));
}

function generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomReadable(10, RECOVERY_ALPHABET);
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map(hashRecoveryCode) };
}

function verifyAccessTime(admin: { tokensValidAfter: Date | null }, issuedAt: number): void {
  if (isIssuedBeforeRevocation(issuedAt, admin.tokensValidAfter)) throw sessionExpired();
}

export class PlatformAuthService {
  constructor(private readonly deps: AppDeps) {}

  private nowSeconds(): number {
    return Math.floor(this.deps.clock.now().getTime() / 1000);
  }

  /** 1. adım: şifre doğruysa yalnız 5 dakika geçerli ara token verilir. */
  async login(input: LoginInput, ip: string) {
    const { deps } = this;
    const username = normalizeUsername(input.username);
    const blockedFor = deps.platformLoginLimiter.blockedFor(username, ip);
    if (blockedFor > 0) throw rateLimited(blockedFor);

    const admin = await PlatformAdminModel.findOne({ username }).select('+passwordHash');
    const valid = admin
      ? await verifyPassword(input.password, admin.passwordHash)
      : await verifyAgainstDummy(input.password, deps.config.bcryptCost);
    if (!admin || !valid) {
      deps.platformLoginLimiter.recordFailure(username, ip);
      throw new AppError('UNAUTHORIZED', INVALID_CREDENTIALS);
    }
    deps.platformLoginLimiter.recordSuccess(username);

    return {
      pendingToken: await deps.tokens.signPending(admin._id.toString()),
      totpSetupRequired: admin.totpConfirmedAt === null,
    };
  }

  private async loadAdmin(subject: string, issuedAt: number): Promise<PlatformAdminDocument> {
    if (!isValidObjectId(subject)) throw sessionExpired();
    const admin = await PlatformAdminModel.findById(subject);
    if (!admin) throw sessionExpired();
    verifyAccessTime(admin, issuedAt);
    return admin;
  }

  async authenticatePending(token: string): Promise<PlatformAdminDocument> {
    try {
      const { subject, issuedAt } = await this.deps.tokens.verifyAccess(token, 'platform-pending');
      return await this.loadAdmin(subject, issuedAt);
    } catch (error) {
      if (error instanceof TokenError) throw sessionExpired();
      throw error;
    }
  }

  /** Ürün sahibi oturumu; TOTP kurulumu tamamlanmamış hesap yönetim alanına giremez. */
  async authenticate(token: string): Promise<PlatformAdminDocument> {
    try {
      const { subject, issuedAt } = await this.deps.tokens.verifyAccess(token, 'platform');
      const admin = await this.loadAdmin(subject, issuedAt);
      if (!admin.totpConfirmedAt) throw sessionExpired();
      return admin;
    } catch (error) {
      if (error instanceof TokenError) throw sessionExpired();
      throw error;
    }
  }

  private assertNotLocked(admin: PlatformAdminDocument): void {
    const lockedUntil = admin.secondFactorLockedUntil?.getTime() ?? 0;
    const remaining = lockedUntil - this.deps.clock.now().getTime();
    if (remaining > 0) throw rateLimited(remaining);
  }

  private async recordSecondFactorFailure(admin: PlatformAdminDocument): Promise<never> {
    const { clock } = this.deps;
    const updated = await PlatformAdminModel.findOneAndUpdate(
      { _id: admin._id },
      { $inc: { failedSecondFactorCount: 1 } },
      { returnDocument: 'after', timestamps: false },
    );
    if (updated && updated.failedSecondFactorCount >= SECOND_FACTOR_MAX_FAILURES) {
      const lockedUntil = new Date(clock.now().getTime() + SECOND_FACTOR_LOCK_MS);
      await withTransaction(async (session) => {
        await PlatformAdminModel.updateOne(
          { _id: admin._id },
          { $set: { failedSecondFactorCount: 0, secondFactorLockedUntil: lockedUntil } },
          { session, timestamps: false },
        );
        await writePlatformLog(
          {
            adminId: admin._id,
            action: 'admin.second_factor_locked',
            changes: [
              { field: 'secondFactorLockedUntil', old: null, new: lockedUntil.toISOString() },
            ],
            reason: `${SECOND_FACTOR_MAX_FAILURES} hatalı ikinci adım denemesi`,
            at: clock.now(),
          },
          session,
        );
      });
    }
    throw new AppError('UNAUTHORIZED', 'Doğrulama kodu hatalı.');
  }

  /** ±1 zaman adımı toleransla doğrular; geçerliyse kodun zaman adımını döner. */
  private async matchTimeStep(
    encryptedSecret: string,
    code: string,
    afterTimeStep: number | null,
  ): Promise<number | null> {
    const result = await verify({
      secret: decryptSecret(encryptedSecret, this.deps.config.totpEncryptionKey),
      token: code,
      epoch: this.nowSeconds(),
      epochTolerance: 30,
      ...(afterTimeStep !== null ? { afterTimeStep } : {}),
    });
    return result.valid && 'timeStep' in result ? result.timeStep : null;
  }

  /** TOTP kodunu ±1 zaman adımı toleransla doğrular; aynı kod ikinci kez kabul edilmez. */
  private async checkTotp(admin: PlatformAdminDocument, code: string): Promise<boolean> {
    const withSecret = await PlatformAdminModel.findById(admin._id).select('+totpSecretEncrypted');
    if (!withSecret?.totpSecretEncrypted) return false;
    const timeStep = await this.matchTimeStep(
      withSecret.totpSecretEncrypted,
      code,
      withSecret.totpLastUsedStep,
    );
    if (timeStep === null) return false;

    // Zaman adımı atomik olarak işaretlenir; eşzamanlı aynı kod yalnız bir kez geçer.
    const claimed = await PlatformAdminModel.findOneAndUpdate(
      {
        _id: admin._id,
        $or: [{ totpLastUsedStep: null }, { totpLastUsedStep: { $lt: timeStep } }],
      },
      { $set: { totpLastUsedStep: timeStep } },
      { timestamps: false },
    );
    return claimed !== null;
  }

  private async resetSecondFactorFailures(adminId: Types.ObjectId): Promise<void> {
    await PlatformAdminModel.updateOne(
      { _id: adminId },
      { $set: { failedSecondFactorCount: 0, secondFactorLockedUntil: null } },
      { timestamps: false },
    );
  }

  /** İlk girişte QR için otpauth adresi; kurulum onaylanana kadar her çağrı yeni gizli anahtar üretir. */
  async startTotpSetup(admin: PlatformAdminDocument) {
    if (admin.totpConfirmedAt) {
      throw new AppError('CONFLICT', 'İki aşamalı doğrulama zaten kurulu.');
    }
    const secret = generateSecret();
    await PlatformAdminModel.updateOne(
      { _id: admin._id },
      {
        $set: {
          totpSecretEncrypted: encryptSecret(secret, this.deps.config.totpEncryptionKey),
          totpLastUsedStep: null,
        },
      },
    );
    return {
      otpauthUrl: generateURI({ issuer: this.deps.config.appName, label: admin.username, secret }),
      secret,
    };
  }

  /**
   * Kurulum onaylanmamışsa kodla kurulumu onaylar ve 10 kurtarma kodunu bir kez döner;
   * kurulu hesapta girişi tamamlar.
   */
  async verifyTotp(admin: PlatformAdminDocument, code: string) {
    const { deps } = this;
    this.assertNotLocked(admin);
    const settingUp = admin.totpConfirmedAt === null;
    if (!(await this.checkTotp(admin, code))) {
      if (settingUp) {
        const withSecret = await PlatformAdminModel.findById(admin._id).select(
          '+totpSecretEncrypted',
        );
        if (!withSecret?.totpSecretEncrypted) {
          throw new AppError('CONFLICT', 'Önce iki aşamalı doğrulama kurulumunu başlatın.');
        }
      }
      return this.recordSecondFactorFailure(admin);
    }

    if (!settingUp) {
      await this.resetSecondFactorFailures(admin._id);
      return { ...(await this.issueSession(admin._id)), admin: presentPlatformAdmin(admin) };
    }

    const { codes, hashes } = generateRecoveryCodes();
    const session = await withTransaction(async (dbSession) => {
      await PlatformAdminModel.updateOne(
        { _id: admin._id },
        {
          $set: {
            totpConfirmedAt: deps.clock.now(),
            recoveryCodeHashes: hashes,
            failedSecondFactorCount: 0,
            secondFactorLockedUntil: null,
          },
        },
        { session: dbSession },
      );
      await writePlatformLog(
        { adminId: admin._id, action: 'admin.totp_confirmed', at: deps.clock.now() },
        dbSession,
      );
      return issueTokenPair(deps, PlatformAdminModel, admin._id, 'platform', dbSession);
    });
    return { ...session, admin: presentPlatformAdmin(admin), recoveryCodes: codes };
  }

  /** Telefon kaybolursa kod yerine kurtarma koduyla giriş; kullanılan kod geçersizleşir. */
  async loginWithRecoveryCode(admin: PlatformAdminDocument, recoveryCode: string) {
    this.assertNotLocked(admin);
    if (!admin.totpConfirmedAt) {
      throw new AppError('CONFLICT', 'Önce iki aşamalı doğrulama kurulumunu tamamlayın.');
    }
    const remainingRecoveryCodes = await this.consumeRecoveryCode(admin, recoveryCode);
    await this.resetSecondFactorFailures(admin._id);
    return {
      ...(await this.issueSession(admin._id)),
      admin: presentPlatformAdmin(admin),
      remainingRecoveryCodes,
    };
  }

  /** Kurtarma kodunu atomik olarak harcar; kalan kod sayısını döner. Hatalı kod denemeye sayılır. */
  private async consumeRecoveryCode(
    admin: PlatformAdminDocument,
    recoveryCode: string,
  ): Promise<number> {
    const hash = hashRecoveryCode(recoveryCode);
    const consumed = await PlatformAdminModel.findOneAndUpdate(
      { _id: admin._id, recoveryCodeHashes: hash },
      { $pull: { recoveryCodeHashes: hash } },
      { returnDocument: 'after', timestamps: false },
    ).select('+recoveryCodeHashes');
    if (!consumed) return this.recordSecondFactorFailure(admin);

    await writePlatformLog({
      adminId: admin._id,
      action: 'admin.recovery_code_used',
      changes: [
        { field: 'remainingRecoveryCodes', old: null, new: consumed.recoveryCodeHashes.length },
      ],
      at: this.deps.clock.now(),
    });
    return consumed.recoveryCodeHashes.length;
  }

  /**
   * Giriş sonrası TOTP yeniden kurulumu, 1. adım: mevcut kod veya (telefon kaybolduysa) bir kurtarma
   * koduyla yeni anahtar üretilir. Yeni anahtar onaylanana kadar eski anahtar geçerli kalır.
   */
  async startTotpReset(admin: PlatformAdminDocument, input: TotpResetStartInput) {
    this.assertNotLocked(admin);
    if ('code' in input) {
      if (!(await this.checkTotp(admin, input.code))) return this.recordSecondFactorFailure(admin);
    } else {
      await this.consumeRecoveryCode(admin, input.recoveryCode);
    }
    await this.resetSecondFactorFailures(admin._id);

    const secret = generateSecret();
    await PlatformAdminModel.updateOne(
      { _id: admin._id },
      {
        $set: {
          pendingTotpSecretEncrypted: encryptSecret(secret, this.deps.config.totpEncryptionKey),
        },
      },
      { timestamps: false },
    );
    return {
      otpauthUrl: generateURI({ issuer: this.deps.config.appName, label: admin.username, secret }),
      secret,
    };
  }

  /** 2. adım: yeni anahtardan bir doğru kodla onaylanır; eski anahtar o anda geçersizleşir. */
  async confirmTotpReset(admin: PlatformAdminDocument, code: string): Promise<void> {
    const { deps } = this;
    this.assertNotLocked(admin);
    const withPending = await PlatformAdminModel.findById(admin._id).select(
      '+pendingTotpSecretEncrypted',
    );
    const pending = withPending?.pendingTotpSecretEncrypted;
    if (!pending) {
      throw new AppError('CONFLICT', 'Önce yeniden kurulumu başlatın.');
    }
    // Yeni anahtarda önceki kodların zaman adımı geçerli değildir; son adım yeni koddan başlar.
    const timeStep = await this.matchTimeStep(pending, code, null);
    if (timeStep === null) return this.recordSecondFactorFailure(admin);

    await withTransaction(async (session) => {
      const updated = await PlatformAdminModel.updateOne(
        { _id: admin._id, pendingTotpSecretEncrypted: pending },
        {
          $set: {
            totpSecretEncrypted: pending,
            pendingTotpSecretEncrypted: null,
            totpLastUsedStep: timeStep,
            failedSecondFactorCount: 0,
            secondFactorLockedUntil: null,
          },
        },
        { session },
      );
      if (updated.matchedCount === 0) {
        throw new AppError('CONFLICT', 'Yeniden kurulum başka bir yerde değişti; baştan başlatın.');
      }
      await writePlatformLog(
        { adminId: admin._id, action: 'admin.totp_reset', at: deps.clock.now() },
        session,
      );
    });
  }

  /** Geçerli TOTP koduyla yeni 10 kod; eskileri geçersiz olur. */
  async regenerateRecoveryCodes(admin: PlatformAdminDocument, code: string) {
    const { deps } = this;
    this.assertNotLocked(admin);
    if (!(await this.checkTotp(admin, code))) return this.recordSecondFactorFailure(admin);

    const { codes, hashes } = generateRecoveryCodes();
    await withTransaction(async (session) => {
      await PlatformAdminModel.updateOne(
        { _id: admin._id },
        {
          $set: {
            recoveryCodeHashes: hashes,
            failedSecondFactorCount: 0,
            secondFactorLockedUntil: null,
          },
        },
        { session },
      );
      await writePlatformLog(
        { adminId: admin._id, action: 'admin.recovery_codes_regenerated', at: deps.clock.now() },
        session,
      );
    });
    return { recoveryCodes: codes };
  }

  private issueSession(adminId: Types.ObjectId): Promise<TokenPair> {
    return issueTokenPair(this.deps, PlatformAdminModel, adminId, 'platform');
  }

  async refresh(refreshToken: string) {
    const adminId = await consumeRefreshToken(
      this.deps,
      PlatformAdminModel,
      refreshToken,
      'platform',
    );
    const admin = await PlatformAdminModel.findById(adminId);
    if (!admin?.totpConfirmedAt) throw sessionExpired();
    return { ...(await this.issueSession(admin._id)), admin: presentPlatformAdmin(admin) };
  }

  async logout(adminId: Types.ObjectId, refreshToken?: string): Promise<void> {
    await revokeRefreshTokens(PlatformAdminModel, adminId, refreshToken);
  }
}

/** PLATFORM_BOOTSTRAP_* ile ilk ürün sahibi hesabını bir kez oluşturur. */
export async function ensureBootstrapAdmin(
  deps: AppDeps,
): Promise<'created' | 'exists' | 'skipped'> {
  const bootstrap = deps.config.platformBootstrap;
  if (!bootstrap) return 'skipped';
  if ((await PlatformAdminModel.countDocuments()) > 0) return 'exists';
  if (bootstrap.password.length < 8) {
    throw new Error('PLATFORM_BOOTSTRAP_PASSWORD en az 8 karakter olmalı.');
  }

  const passwordHash = await hashPassword(bootstrap.password, deps.config.bcryptCost);
  await withTransaction(async (session) => {
    const [admin] = await PlatformAdminModel.create(
      [{ username: normalizeUsername(bootstrap.username), passwordHash }],
      { session },
    );
    if (!admin) throw new Error('Ürün sahibi hesabı oluşturulamadı.');
    await writePlatformLog(
      { adminId: admin._id, action: 'admin.bootstrap', at: deps.clock.now() },
      session,
    );
  });
  return 'created';
}

/**
 * `platform:reset-2fa` komutu: TOTP'yi ve kurtarma kodlarını sıfırlar, bütün ürün sahibi
 * oturumlarını düşürür ve işletim geçmişine yazar. Sonraki girişte kurulum yeniden zorunludur.
 */
export async function resetPlatformTwoFactor(username: string, clock: Clock): Promise<boolean> {
  const admin = await PlatformAdminModel.findOne({ username: normalizeUsername(username) });
  if (!admin) return false;

  await withTransaction(async (session) => {
    await PlatformAdminModel.updateOne(
      { _id: admin._id },
      {
        $set: {
          totpSecretEncrypted: null,
          pendingTotpSecretEncrypted: null,
          totpConfirmedAt: null,
          totpLastUsedStep: null,
          recoveryCodeHashes: [],
          failedSecondFactorCount: 0,
          secondFactorLockedUntil: null,
          refreshTokens: [],
          tokensValidAfter: revocationTime(clock),
        },
      },
      { session },
    );
    await writePlatformLog(
      {
        adminId: admin._id,
        action: 'admin.two_factor_reset',
        reason: 'Sunucu komutuyla sıfırlandı (platform:reset-2fa)',
        at: clock.now(),
      },
      session,
    );
  });
  return true;
}
