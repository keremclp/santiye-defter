// Ürün sahibinin temel firma ve kullanıcı yönetimi (şartname 7.13, 8.1, 8.2, 10.10).

import type {
  PlatformCompanyCreateInput,
  PlatformUserActivationInput,
  PlatformUserCreateInput,
} from '@santiye/shared';
import { isValidObjectId, Types, type ClientSession } from 'mongoose';
import { notFound } from '../db/company-scope.js';
import { updateIfUnchanged } from '../db/concurrency.js';
import { isDuplicateKeyError, withTransaction } from '../db/transaction.js';
import type { AppDeps } from '../deps.js';
import { AppError } from '../http/errors.js';
import { businessToday } from '../lib/clock.js';
import {
  generateTemporaryPassword,
  hashPassword,
  TEMPORARY_PASSWORD_TTL_MS,
} from '../lib/passwords.js';
import { revocationTime } from '../lib/tokens.js';
import { CompanyModel, type Company } from '../models/company.js';
import type { IdempotencyResultRef } from '../models/idempotency-record.js';
import { PlatformLogModel } from '../models/platform-log.js';
import { UserModel } from '../models/user.js';
import type { IdempotentOutcome } from './idempotency.js';
import { writePlatformLog } from './platform-log.js';
import { presentPlatformCompany, presentPlatformLog, presentPlatformUser } from './presenters.js';
import { serviceSummary, type ServiceState } from './service-state.js';

const COMPANY_HISTORY_LIMIT = 100;

export const TEMPORARY_PASSWORD_REPLAY_MESSAGE =
  'Geçici şifre ilk yanıtta gösterildi ve yeniden gösterilemez. Görmediyseniz şifreyi sıfırlayın.';

function usernameTaken(): AppError {
  return new AppError('USERNAME_EXISTS', 'Bu kullanıcı adı kullanılıyor');
}

function toObjectId(id: string): Types.ObjectId {
  if (!isValidObjectId(id)) throw notFound();
  return new Types.ObjectId(id);
}

export interface CompanyListQuery {
  q?: string | undefined;
  status?: ServiceState | undefined;
  page: number;
  limit: number;
}

export class PlatformManagementService {
  constructor(private readonly deps: AppDeps) {}

  private today(): string {
    return businessToday(this.deps.clock);
  }

  private async userCounts(companyIds: Types.ObjectId[]): Promise<Map<string, number>> {
    const rows = await UserModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { companyId: { $in: companyIds } } },
      { $group: { _id: '$companyId', count: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [row._id.toString(), row.count]));
  }

  private present(company: Company, userCount: number) {
    return presentPlatformCompany(company, {
      service: serviceSummary(company, this.today()),
      userCount,
    });
  }

  /** Etkin durum tarihlerden hesaplandığı için durum filtresi bellek içinde uygulanır. */
  async listCompanies(query: CompanyListQuery) {
    const filter = query.q
      ? { name: { $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      : {};
    const companies = await CompanyModel.find(filter).sort({ name: 1 }).lean<Company[]>();
    const today = this.today();
    const matching = query.status
      ? companies.filter((company) => serviceSummary(company, today).state === query.status)
      : companies;

    const pageItems = matching.slice((query.page - 1) * query.limit, query.page * query.limit);
    const counts = await this.userCounts(pageItems.map((company) => company._id));
    return {
      items: pageItems.map((company) =>
        this.present(company, counts.get(company._id.toString()) ?? 0),
      ),
      page: query.page,
      limit: query.limit,
      total: matching.length,
    };
  }

  async getCompany(id: string) {
    const company = await CompanyModel.findById(toObjectId(id)).lean<Company>();
    if (!company) throw notFound();
    const [users, history] = await Promise.all([
      UserModel.find({ companyId: company._id }).sort({ createdAt: 1 }),
      PlatformLogModel.find({ companyId: company._id })
        .sort({ at: -1, _id: -1 })
        .limit(COMPANY_HISTORY_LIMIT),
    ]);
    return {
      company: this.present(company, users.length),
      users: users.map(presentPlatformUser),
      history: history.map(presentPlatformLog),
    };
  }

  /** Yeni firma aktif, boş ve 20 GB kapasiteyle başlar; demo verisi aktarılmaz. */
  async createCompany(
    adminId: Types.ObjectId,
    input: PlatformCompanyCreateInput,
    session: ClientSession,
  ) {
    const [company] = await CompanyModel.create(
      [{ name: input.name, contact: input.contact, opsNote: input.opsNote }],
      { session },
    );
    if (!company) throw new Error('Firma oluşturulamadı.');
    await writePlatformLog(
      {
        adminId,
        companyId: company._id,
        action: 'company.create',
        changes: [
          { field: 'name', old: null, new: company.name },
          { field: 'storageQuotaBytes', old: null, new: company.storageQuotaBytes },
        ],
        reason: input.reason ?? null,
        at: this.deps.clock.now(),
      },
      session,
    );
    return {
      outcome: {
        status: 201,
        data: this.present(company.toObject(), 0),
      } satisfies IdempotentOutcome,
      ref: { type: 'company', id: company._id.toString() },
    };
  }

  async replayCompany(ref: IdempotencyResultRef): Promise<IdempotentOutcome> {
    const { company } = await this.getCompany(ref.id);
    return { status: ref.status, data: company };
  }

  /**
   * Geçici şifre yalnız bu cevapta bir kez döner ve hiçbir yerde düz metin saklanmaz;
   * 72 saat geçerlidir.
   */
  async createUser(
    adminId: Types.ObjectId,
    companyId: string,
    input: PlatformUserCreateInput,
    session: ClientSession,
  ) {
    const { deps } = this;
    const company = await CompanyModel.findById(toObjectId(companyId)).session(session);
    if (!company) throw notFound();
    if (await UserModel.exists({ username: input.username }).session(session))
      throw usernameTaken();

    const temporaryPassword = generateTemporaryPassword();
    const tempPasswordExpiresAt = new Date(deps.clock.now().getTime() + TEMPORARY_PASSWORD_TTL_MS);
    let user;
    try {
      [user] = await UserModel.create(
        [
          {
            companyId: company._id,
            name: input.name,
            username: input.username,
            phone: input.phone,
            email: input.email,
            passwordHash: await hashPassword(temporaryPassword, deps.config.bcryptCost),
            mustChangePassword: true,
            tempPasswordExpiresAt,
          },
        ],
        { session },
      );
    } catch (error) {
      if (isDuplicateKeyError(error, 'username')) throw usernameTaken();
      throw error;
    }
    if (!user) throw new Error('Kullanıcı oluşturulamadı.');

    await writePlatformLog(
      {
        adminId,
        companyId: company._id,
        action: 'user.create',
        changes: [
          { field: 'userId', old: null, new: user._id.toString() },
          { field: 'username', old: null, new: user.username },
          { field: 'name', old: null, new: user.name },
        ],
        reason: input.reason ?? null,
        at: deps.clock.now(),
      },
      session,
    );
    return {
      outcome: {
        status: 201,
        data: {
          user: presentPlatformUser(user),
          temporaryPassword,
          tempPasswordExpiresAt: tempPasswordExpiresAt.toISOString(),
        },
      } satisfies IdempotentOutcome,
      ref: { type: 'user', id: user._id.toString() },
    };
  }

  async replayUser(ref: IdempotencyResultRef): Promise<IdempotentOutcome> {
    const user = await UserModel.findById(toObjectId(ref.id));
    if (!user) throw notFound();
    return {
      status: ref.status,
      data: {
        user: presentPlatformUser(user),
        temporaryPassword: null,
        tempPasswordExpiresAt: user.tempPasswordExpiresAt?.toISOString() ?? null,
      },
      message: TEMPORARY_PASSWORD_REPLAY_MESSAGE,
    };
  }

  /** Pasifleştirme girişi ve bütün oturumları hemen kapatır; geçmiş kayıt atıfları kalır. */
  async setUserActive(adminId: Types.ObjectId, userId: string, input: PlatformUserActivationInput) {
    const { deps } = this;
    const id = toObjectId(userId);
    return withTransaction(async (session) => {
      const current = await UserModel.findById(id).session(session);
      if (!current) throw notFound();
      const update = input.isActive
        ? { $set: { isActive: true } }
        : {
            $set: {
              isActive: false,
              refreshTokens: [],
              tokensValidAfter: revocationTime(deps.clock),
            },
          };
      const user = await updateIfUnchanged({
        model: UserModel,
        filter: { _id: id },
        expectedUpdatedAt: input.expectedUpdatedAt,
        update,
        session,
        present: presentPlatformUser,
        onMissing: notFound,
      });
      if (current.isActive !== input.isActive) {
        await writePlatformLog(
          {
            adminId,
            companyId: user.companyId,
            action: input.isActive ? 'user.activate' : 'user.deactivate',
            changes: [
              { field: 'userId', old: null, new: user._id.toString() },
              { field: 'isActive', old: current.isActive, new: input.isActive },
            ],
            reason: input.reason,
            at: deps.clock.now(),
          },
          session,
        );
      }
      return presentPlatformUser(user);
    });
  }

  /** Yeni geçici şifre; mevcut şifre hiç görüntülenmez ve bütün oturumlar düşer. */
  async resetPassword(adminId: Types.ObjectId, userId: string, reason: string) {
    const { deps } = this;
    const id = toObjectId(userId);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword, deps.config.bcryptCost);
    const tempPasswordExpiresAt = new Date(deps.clock.now().getTime() + TEMPORARY_PASSWORD_TTL_MS);

    const user = await withTransaction(async (session) => {
      const updated = await UserModel.findOneAndUpdate(
        { _id: id },
        {
          $set: {
            passwordHash,
            mustChangePassword: true,
            tempPasswordExpiresAt,
            refreshTokens: [],
            tokensValidAfter: revocationTime(deps.clock),
          },
        },
        { returnDocument: 'after', session },
      );
      if (!updated) throw notFound();
      await writePlatformLog(
        {
          adminId,
          companyId: updated.companyId,
          action: 'user.reset_password',
          changes: [{ field: 'userId', old: null, new: updated._id.toString() }],
          reason,
          at: deps.clock.now(),
        },
        session,
      );
      return updated;
    });

    return {
      user: presentPlatformUser(user),
      temporaryPassword,
      tempPasswordExpiresAt: tempPasswordExpiresAt.toISOString(),
    };
  }
}
