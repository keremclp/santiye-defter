// Firma kullanıcısının kimliği ve firma bağlamı (şartname 3, 9.8, 9.10, 10.1).

import {
  normalizeUsername,
  type LoginInput,
  type PasswordChangeInput,
  type ProfileUpdateInput,
} from '@santiye/shared';
import { isValidObjectId, type Types } from 'mongoose';
import { updateIfUnchanged } from '../db/concurrency.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { businessToday } from '../lib/clock.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../lib/passwords.js';
import { isIssuedBeforeRevocation, revocationTime, TokenError } from '../lib/tokens.js';
import { CompanyModel, type CompanyDocument } from '../models/company.js';
import { UserModel, type UserDocument } from '../models/user.js';
import { presentAuthUser, presentProfile } from './presenters.js';
import {
  accessClosedError,
  assertAccess,
  serviceSummary,
  type AccessKind,
  type ServiceSummary,
} from './service-state.js';
import {
  consumeRefreshToken,
  issueTokenPair,
  revokeRefreshTokens,
  sessionExpired,
} from './sessions.js';

export interface CustomerContext {
  userId: Types.ObjectId;
  companyId: Types.ObjectId;
  user: UserDocument;
  company: CompanyDocument;
  service: ServiceSummary;
}

const INVALID_CREDENTIALS = 'Kullanıcı adı veya şifre hatalı';

export function passwordChangeRequired(): AppError {
  return new AppError('PASSWORD_CHANGE_REQUIRED', 'Devam etmek için kişisel şifrenizi oluşturun.');
}

export function rateLimited(blockedForMs: number): AppError {
  const minutes = Math.max(Math.ceil(blockedForMs / 60_000), 1);
  return new AppError(
    'RATE_LIMITED',
    `Çok fazla hatalı deneme. ${minutes} dakika sonra tekrar deneyin.`,
  );
}

/** Kullanıcının firmasını ve etkin hizmet durumunu yükler; erişim kapalıysa reddeder. */
async function loadCompanyFor(
  deps: AppDeps,
  user: UserDocument,
): Promise<{ company: CompanyDocument; service: ServiceSummary }> {
  if (!user.isActive) throw accessClosedError('user_inactive');
  const company = await CompanyModel.findById(user.companyId);
  if (!company) throw accessClosedError('deleting');
  const service = serviceSummary(company, businessToday(deps.clock));
  assertAccess(service, 'login');
  return { company, service };
}

export class CustomerAuthService {
  constructor(private readonly deps: AppDeps) {}

  async login(input: LoginInput, ip: string) {
    const { deps } = this;
    const username = normalizeUsername(input.username);
    const blockedFor = deps.customerLoginLimiter.blockedFor(username, ip);
    if (blockedFor > 0) throw rateLimited(blockedFor);

    const user = await UserModel.findOne({ username }).select('+passwordHash');
    const valid = user
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyAgainstDummy(input.password, deps.config.bcryptCost);
    if (!user || !valid) {
      deps.customerLoginLimiter.recordFailure(username, ip);
      throw new AppError('UNAUTHORIZED', INVALID_CREDENTIALS);
    }
    deps.customerLoginLimiter.recordSuccess(username);

    if (
      user.mustChangePassword &&
      user.tempPasswordExpiresAt &&
      user.tempPasswordExpiresAt.getTime() < deps.clock.now().getTime()
    ) {
      throw new AppError(
        'UNAUTHORIZED',
        'Geçici şifrenizin süresi doldu. Yeni şifre için ürün sahibiyle iletişime geçin.',
      );
    }

    const { company, service } = await loadCompanyFor(deps, user);
    const tokens = await issueTokenPair(deps, UserModel, user._id, 'customer');
    return {
      ...tokens,
      user: presentAuthUser(user),
      mustChangePassword: user.mustChangePassword,
      company: { displayName: company.displayName || company.name },
      service,
    };
  }

  async refresh(refreshToken: string) {
    const { deps } = this;
    const userId = await consumeRefreshToken(deps, UserModel, refreshToken, 'customer');
    const user = await UserModel.findById(userId);
    if (!user) throw sessionExpired();
    await loadCompanyFor(deps, user);
    const tokens = await issueTokenPair(deps, UserModel, user._id, 'customer');
    return { ...tokens, user: presentAuthUser(user), mustChangePassword: user.mustChangePassword };
  }

  async logout(userId: Types.ObjectId, refreshToken?: string): Promise<void> {
    await revokeRefreshTokens(UserModel, userId, refreshToken);
  }

  /** Access token'ı doğrular; oturumu düşürülmüş veya bulunamayan kullanıcı 401 alır. */
  async authenticate(accessToken: string): Promise<UserDocument> {
    let subject: string;
    let issuedAt: number;
    try {
      ({ subject, issuedAt } = await this.deps.tokens.verifyAccess(accessToken, 'customer'));
    } catch (error) {
      if (error instanceof TokenError) throw sessionExpired();
      throw error;
    }
    if (!isValidObjectId(subject)) throw sessionExpired();
    const user = await UserModel.findById(subject);
    if (!user || isIssuedBeforeRevocation(issuedAt, user.tokensValidAfter)) throw sessionExpired();
    return user;
  }

  /**
   * Firma bağlamını kurar: kullanıcı → firma → etkin hizmet durumu (her istekte).
   * `allowPasswordChangeRequired` yalnız şifre değişimi ve çıkış içindir.
   */
  async buildContext(
    user: UserDocument,
    kind: AccessKind,
    allowPasswordChangeRequired = false,
  ): Promise<CustomerContext> {
    const { company, service } = await loadCompanyFor(this.deps, user);
    if (user.mustChangePassword && !allowPasswordChangeRequired) throw passwordChangeRequired();
    assertAccess(service, kind);
    return { userId: user._id, companyId: company._id, user, company, service };
  }

  me(context: CustomerContext) {
    return {
      user: presentProfile(context.user),
      company: { displayName: context.company.displayName || context.company.name },
      service: context.service,
    };
  }

  async updateProfile(context: CustomerContext, input: ProfileUpdateInput) {
    const { expectedUpdatedAt, ...changes } = input;
    const user = await updateIfUnchanged({
      model: UserModel,
      filter: { _id: context.userId },
      expectedUpdatedAt,
      update: { $set: changes },
      present: presentProfile,
      onMissing: sessionExpired,
    });
    return presentProfile(user);
  }

  /**
   * Şifre değişince bütün oturumlar hemen düşer. Geçici şifreden kişisel şifreye geçişte
   * kullanıcı firma özetine devam edebilsin diye yeni oturum verilir (şartname 7.11, 7.12).
   */
  async changePassword(context: CustomerContext, input: PasswordChangeInput) {
    const { deps } = this;
    const user = await UserModel.findById(context.userId).select('+passwordHash');
    if (!user) throw sessionExpired();
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new AppError('VALIDATION', 'Mevcut şifre hatalı.', {
        issues: [{ path: 'currentPassword', message: 'Mevcut şifre hatalı.' }],
      });
    }

    const wasTemporary = user.mustChangePassword;
    const updated = await UserModel.findOneAndUpdate(
      { _id: user._id },
      {
        $set: {
          passwordHash: await hashPassword(input.newPassword, deps.config.bcryptCost),
          mustChangePassword: false,
          tempPasswordExpiresAt: null,
          refreshTokens: [],
          tokensValidAfter: revocationTime(deps.clock),
        },
      },
      { returnDocument: 'after' },
    );
    if (!updated) throw sessionExpired();

    if (!wasTemporary) return { user: presentAuthUser(updated), session: null };
    const session = await issueTokenPair(deps, UserModel, updated._id, 'customer');
    return { user: presentAuthUser(updated), session };
  }
}
