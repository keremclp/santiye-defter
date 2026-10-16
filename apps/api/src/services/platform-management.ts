// Ürün sahibinin firma ve kullanıcı yönetimi, kapasite ve hizmet yaşam döngüsü (şartname 7.13, 8.1,
// 8.2, 9.10, 10.10). Bütün işlemler işlem yapan, zaman ve gerekçeyle işletim geçmişine yazılır; şifre
// hiçbir kayda girmez. Ürün sahibi müşteri finansal kayıtlarını görmez; yalnız sayılarını görür.

import {
  addDays,
  compareIsoDates,
  foldTurkish,
  type PlatformCompanyCreateInput,
  type PlatformCompanyDeleteInput,
  type PlatformCompanyUpdateInput,
  type PlatformEndServiceInput,
  type PlatformExtendRetentionInput,
  type PlatformQuotaInput,
  type PlatformSuspendInput,
  type PlatformUserCreateInput,
  type PlatformUserUpdateInput,
} from '@santiye/shared';
import { isValidObjectId, Types, type ClientSession, type UpdateQuery } from 'mongoose';
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
import { AgreementModel } from '../models/agreement.js';
import { CompanyModel, type Company } from '../models/company.js';
import { DocumentModel } from '../models/document.js';
import type { IdempotencyResultRef } from '../models/idempotency-record.js';
import { PartyModel } from '../models/party.js';
import { PlatformLogModel, type PlatformLogChange } from '../models/platform-log.js';
import { ProjectModel } from '../models/project.js';
import { TransactionModel } from '../models/transaction.js';
import { UserModel, type User } from '../models/user.js';
import { seedDefaultCategories } from './categories.js';
import { CompanyDeletionService } from './company-deletion.js';
import type { IdempotentOutcome } from './idempotency.js';
import { writePlatformLog } from './platform-log.js';
import { presentPlatformCompany, presentPlatformLog, presentPlatformUser } from './presenters.js';
import { diffChanges } from './records.js';
import {
  computeServiceState,
  serviceEndDates,
  serviceSummary,
  type ServiceState,
} from './service-state.js';

const COMPANY_HISTORY_LIMIT = 100;

/** İşletim özeti: kullanım kotanın %90'ına ulaşınca "yaklaşan", tamamına ulaşınca "dolu". */
const STORAGE_WARNING_PERCENT = 90;
/** Görüntüleme dönemi bu kadar gün içinde bitecek firmalar özetlenir. */
const VIEW_ENDING_WINDOW_DAYS = 7;
/** Arşiv saklaması bu kadar gün içinde bitecek firmalar özetlenir. */
const RETENTION_ENDING_WINDOW_DAYS = 30;

export const TEMPORARY_PASSWORD_REPLAY_MESSAGE =
  'Geçici şifre ilk yanıtta gösterildi ve yeniden gösterilemez. Görmediyseniz şifreyi sıfırlayın.';

function usernameTaken(): AppError {
  return new AppError('USERNAME_EXISTS', 'Bu kullanıcı adı kullanılıyor');
}

function toObjectId(id: string): Types.ObjectId {
  if (!isValidObjectId(id)) throw notFound();
  return new Types.ObjectId(id);
}

function permanentlyDeleted(): AppError {
  return new AppError(
    'CONFLICT',
    'Firma kalıcı olarak silindi; yeniden açılamaz ve değiştirilemez. Müşteri için yeni firma açın.',
  );
}

/** Kalıcı silme başladıysa (bekliyor, sürüyor, başarısız, tamamlandı) firma değiştirilemez. */
function assertModifiable(company: Pick<Company, 'deletionStatus'>): void {
  if (company.deletionStatus === 'none') return;
  if (company.deletionStatus === 'done') throw permanentlyDeleted();
  throw new AppError(
    'CONFLICT',
    company.deletionStatus === 'failed'
      ? 'Firmanın kalıcı silme işlemi başarısız oldu; firma değiştirilemez, silme yeniden başlatılabilir.'
      : 'Firmanın kalıcı silme işlemi sürüyor; firma değiştirilemez.',
    { deletionStatus: company.deletionStatus },
  );
}

function alreadyEnded(serviceEndedAt: string): AppError {
  return new AppError(
    'CONFLICT',
    'Firmanın hizmeti zaten sonlandırıldı; süreler yeniden başlatılamaz. Gerekirse önce yeniden açın.',
    { serviceEndedAt },
  );
}

/** Koşullu güncelleme eşleşmediyse kayıt bu arada değişmiştir. */
function ensureMatched(result: { matchedCount: number }): void {
  if (result.matchedCount === 0) {
    throw new AppError('CONFLICT', 'Firma başka bir yerde güncellendi; sayfayı yenileyin.');
  }
}

type ServiceDates = Pick<Company, 'serviceEndedAt' | 'viewUntil' | 'retainUntil'>;

function dateChanges(before: ServiceDates, after: ServiceDates): PlatformLogChange[] {
  return (['serviceEndedAt', 'viewUntil', 'retainUntil'] as const).map((field) => ({
    field,
    old: before[field],
    new: after[field],
  }));
}

/** Kalıcı silme ekranı için kapsanan kayıt ve belge sayıları (silinmiş ama geri alınabilirler dahil). */
async function companyContents(companyId: Types.ObjectId) {
  const [transactions, agreements, projects, parties, documents] = await Promise.all([
    TransactionModel.countDocuments({ companyId }),
    AgreementModel.countDocuments({ companyId }),
    ProjectModel.countDocuments({ companyId }),
    PartyModel.countDocuments({ companyId }),
    DocumentModel.countDocuments({ companyId, status: { $in: ['pending', 'uploaded'] } }),
  ]);
  return { transactions, agreements, projects, parties, documents };
}

/**
 * Listenin üstündeki işletim özeti: kapasitesi dolan/yaklaşan, görüntüleme dönemi 7 gün içinde
 * biten, arşiv saklaması 30 gün içinde biten ve saklama süresi dolmuş (silme onayı bekleyen) firmalar.
 * Kalıcı silmesi bekleyen, süren veya başarısız olanlar yalnız `deletionIncomplete` grubundadır;
 * tamamlanmış silmeler özete girmez.
 */
function operationsSummary(companies: Company[], today: string) {
  const live = companies.filter((company) => company.deletionStatus === 'none');
  const ref = (company: Company) => ({
    id: company._id.toString(),
    name: company.name,
    state: computeServiceState(company, today),
    deletionStatus: company.deletionStatus,
    usedBytes: company.storageUsedBytes,
    quotaBytes: company.storageQuotaBytes,
    viewUntil: company.viewUntil,
    retainUntil: company.retainUntil,
  });
  const ended = (company: Company) =>
    company.serviceEndedAt !== null && compareIsoDates(company.serviceEndedAt, today) <= 0;
  const byDate = (field: 'viewUntil' | 'retainUntil') => (a: Company, b: Company) =>
    compareIsoDates(a[field]!, b[field]!);
  const viewLimit = addDays(today, VIEW_ENDING_WINDOW_DAYS);
  const retentionLimit = addDays(today, RETENTION_ENDING_WINDOW_DAYS);

  const storageFull = live.filter(
    (company) => company.storageUsedBytes >= company.storageQuotaBytes,
  );
  const storageNearFull = live.filter(
    (company) =>
      company.storageUsedBytes < company.storageQuotaBytes &&
      company.storageUsedBytes * 100 >= company.storageQuotaBytes * STORAGE_WARNING_PERCENT,
  );
  const viewEnding = live
    .filter(
      (company) =>
        ended(company) &&
        compareIsoDates(today, company.viewUntil!) <= 0 &&
        compareIsoDates(company.viewUntil!, viewLimit) <= 0,
    )
    .sort(byDate('viewUntil'));
  const retentionEnding = live
    .filter(
      (company) =>
        ended(company) &&
        compareIsoDates(today, company.viewUntil!) > 0 &&
        compareIsoDates(today, company.retainUntil!) <= 0 &&
        compareIsoDates(company.retainUntil!, retentionLimit) <= 0,
    )
    .sort(byDate('retainUntil'));
  const deletionPending = live
    .filter((company) => ended(company) && compareIsoDates(today, company.retainUntil!) > 0)
    .sort(byDate('retainUntil'));
  const deletionIncomplete = companies.filter(
    (company) => company.deletionStatus !== 'none' && company.deletionStatus !== 'done',
  );

  return {
    storageFull: storageFull.map(ref),
    storageNearFull: storageNearFull.map(ref),
    viewEnding: viewEnding.map(ref),
    retentionEnding: retentionEnding.map(ref),
    deletionPending: deletionPending.map(ref),
    deletionIncomplete: deletionIncomplete.map(ref),
  };
}

export interface CompanyListQuery {
  q?: string | undefined;
  status?: ServiceState | undefined;
  page: number;
  limit: number;
}

export class PlatformManagementService {
  private readonly deletion: CompanyDeletionService;

  constructor(private readonly deps: AppDeps) {
    this.deletion = new CompanyDeletionService(deps);
  }

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

  /**
   * Etkin durum tarihlerden hesaplandığı için arama ve durum filtresi bellek içinde uygulanır. Arama
   * Türkçe harf ve büyük/küçük harf farkı gözetmez. İşletim özeti filtreden bağımsız bütün firmalardır.
   */
  async listCompanies(query: CompanyListQuery) {
    const companies = await CompanyModel.find({}).select('-history').lean<Company[]>();
    companies.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    const today = this.today();
    const needle = query.q ? foldTurkish(query.q) : '';
    const matching = companies.filter(
      (company) =>
        (!needle || foldTurkish(company.name).includes(needle)) &&
        (!query.status || serviceSummary(company, today).state === query.status),
    );

    const pageItems = matching.slice((query.page - 1) * query.limit, query.page * query.limit);
    const counts = await this.userCounts(pageItems.map((company) => company._id));
    return {
      items: pageItems.map((company) =>
        this.present(company, counts.get(company._id.toString()) ?? 0),
      ),
      page: query.page,
      limit: query.limit,
      total: matching.length,
      summary: operationsSummary(companies, today),
    };
  }

  async getCompany(id: string) {
    const company = await CompanyModel.findById(toObjectId(id)).lean<Company>();
    if (!company) throw notFound();
    const companyId = company._id;
    const [users, history, contents] = await Promise.all([
      UserModel.find({ companyId }).sort({ createdAt: 1 }),
      PlatformLogModel.find({ companyId }).sort({ at: -1, _id: -1 }).limit(COMPANY_HISTORY_LIMIT),
      companyContents(companyId),
    ]);
    return {
      company: this.present(company, users.length),
      users: users.map(presentPlatformUser),
      contents,
      history: history.map(presentPlatformLog),
    };
  }

  private async presentById(companyId: Types.ObjectId) {
    const company = await CompanyModel.findById(companyId).lean<Company>();
    if (!company) throw notFound();
    return this.present(company, await UserModel.countDocuments({ companyId }));
  }

  private async load(companyId: Types.ObjectId, session?: ClientSession) {
    const company = await CompanyModel.findById(companyId)
      .select('-history')
      .session(session ?? null)
      .lean<Company>();
    if (!company) throw notFound();
    return company;
  }

  /** Ürün sahibinin kaydettiği ad, iletişim ve işletim notu; `expectedUpdatedAt` ile. */
  async updateCompany(adminId: Types.ObjectId, id: string, input: PlatformCompanyUpdateInput) {
    const companyId = toObjectId(id);
    const userCount = await UserModel.countDocuments({ companyId });
    return withTransaction(async (session) => {
      const current = await this.load(companyId, session);
      assertModifiable(current);
      const next: Record<string, unknown> = {};
      if (input.name !== undefined) next.name = input.name;
      if (input.contact !== undefined) next.contact = input.contact;
      if (input.opsNote !== undefined) next.opsNote = input.opsNote;
      const changes = diffChanges(
        { name: current.name, contact: current.contact, opsNote: current.opsNote },
        next,
      );
      const updated = await updateIfUnchanged({
        model: CompanyModel,
        filter: { _id: companyId },
        expectedUpdatedAt: input.expectedUpdatedAt,
        update: { $set: next },
        session,
        present: (company) => this.present(company, userCount),
        onMissing: notFound,
      });
      if (changes.length > 0) {
        await this.log(session, {
          adminId,
          companyId,
          action: 'company.update',
          changes,
          reason: input.reason,
        });
      }
      return this.present(updated.toObject(), userCount);
    });
  }

  /** Kapasite artırılır veya mevcut kullanımın altına inmeden azaltılır. */
  async setQuota(adminId: Types.ObjectId, id: string, input: PlatformQuotaInput) {
    const companyId = toObjectId(id);
    await withTransaction(async (session) => {
      const current = await this.load(companyId, session);
      assertModifiable(current);
      if (current.storageQuotaBytes === input.quotaBytes) return;
      const updated = await CompanyModel.updateOne(
        { _id: companyId, deletionStatus: 'none', storageUsedBytes: { $lte: input.quotaBytes } },
        { $set: { storageQuotaBytes: input.quotaBytes } },
        { session, timestamps: false },
      );
      if (updated.matchedCount === 0) {
        throw new AppError('CONFLICT', 'Kapasite mevcut kullanımın altına indirilemez.', {
          usedBytes: current.storageUsedBytes,
          quotaBytes: current.storageQuotaBytes,
        });
      }
      await this.log(session, {
        adminId,
        companyId,
        action: 'company.quota',
        changes: [
          { field: 'storageQuotaBytes', old: current.storageQuotaBytes, new: input.quotaBytes },
        ],
        reason: input.reason,
      });
    });
    return this.presentById(companyId);
  }

  /** Geçici durdurma erişimi kapatır; hizmet sonu sayacını başlatmaz (şartname 9.10). */
  async setSuspended(adminId: Types.ObjectId, id: string, input: PlatformSuspendInput) {
    const companyId = toObjectId(id);
    await withTransaction(async (session) => {
      const current = await this.load(companyId, session);
      assertModifiable(current);
      if (current.isSuspended === input.suspended) return;
      ensureMatched(
        await CompanyModel.updateOne(
          { _id: companyId, deletionStatus: 'none', isSuspended: current.isSuspended },
          { $set: { isSuspended: input.suspended } },
          { session, timestamps: false },
        ),
      );
      await this.log(session, {
        adminId,
        companyId,
        action: input.suspended ? 'company.suspend' : 'company.unsuspend',
        changes: [{ field: 'isSuspended', old: current.isSuspended, new: input.suspended }],
        reason: input.reason,
      });
    });
    return this.presentById(companyId);
  }

  /**
   * Hizmeti sonlandırır: yürürlük günü D bugünden önce olamaz; görüntüleme D+30, saklama D+180 son
   * günüdür. Önizleme yazmaz. Zaten sonlandırılmış firmada süreler yeniden başlatılamaz.
   */
  async endService(
    adminId: Types.ObjectId,
    id: string,
    input: PlatformEndServiceInput,
    preview: boolean,
  ) {
    const companyId = toObjectId(id);
    const today = this.today();
    if (compareIsoDates(input.effectiveDate, today) < 0) {
      throw new AppError(
        'VALIDATION',
        'Yürürlük tarihi geçmişe çekilemez; en erken bugün seçilir.',
      );
    }
    const dates = serviceEndDates(input.effectiveDate);
    if (preview) {
      const current = await this.load(companyId);
      assertModifiable(current);
      if (current.serviceEndedAt) throw alreadyEnded(current.serviceEndedAt);
      return { preview: true, name: current.name, effectiveDate: input.effectiveDate, ...dates };
    }

    await withTransaction(async (session) => {
      const current = await this.load(companyId, session);
      assertModifiable(current);
      if (current.serviceEndedAt) throw alreadyEnded(current.serviceEndedAt);
      ensureMatched(
        await CompanyModel.updateOne(
          { _id: companyId, deletionStatus: 'none', serviceEndedAt: null },
          { $set: dates },
          { session, timestamps: false },
        ),
      );
      await this.log(session, {
        adminId,
        companyId,
        action: 'company.end_service',
        changes: dateChanges(current, dates),
        reason: input.reason,
      });
    });
    return this.presentById(companyId);
  }

  /** Veri korunurken (kalıcı silme başlamadıysa) hizmet yeniden açılır; eski tarihler geçmişte kalır. */
  async reopen(adminId: Types.ObjectId, id: string, reason: string) {
    const companyId = toObjectId(id);
    await withTransaction(async (session) => {
      const current = await this.load(companyId, session);
      assertModifiable(current);
      if (!current.serviceEndedAt) {
        throw new AppError(
          'CONFLICT',
          'Firmanın hizmeti sonlandırılmamış; yeniden açılacak hizmet yok.',
        );
      }
      const cleared = { serviceEndedAt: null, viewUntil: null, retainUntil: null };
      ensureMatched(
        await CompanyModel.updateOne(
          { _id: companyId, deletionStatus: 'none', serviceEndedAt: current.serviceEndedAt },
          { $set: cleared },
          { session, timestamps: false },
        ),
      );
      await this.log(session, {
        adminId,
        companyId,
        action: 'company.reopen',
        changes: dateChanges(current, cleared),
        reason,
      });
    });
    return this.presentById(companyId);
  }

  /** Arşiv uzatma yalnız saklama bitişini ileri alır; müşteri erişimini açmaz. */
  async extendRetention(adminId: Types.ObjectId, id: string, input: PlatformExtendRetentionInput) {
    const companyId = toObjectId(id);
    const today = this.today();
    await withTransaction(async (session) => {
      const current = await this.load(companyId, session);
      assertModifiable(current);
      if (!current.serviceEndedAt || !current.retainUntil) {
        throw new AppError('CONFLICT', 'Hizmeti sonlandırılmamış firmada arşiv uzatılamaz.');
      }
      if (compareIsoDates(input.retainUntil, current.retainUntil) <= 0) {
        throw new AppError(
          'VALIDATION',
          `Yeni saklama bitişi mevcut bitişten (${current.retainUntil}) sonra olmalı.`,
        );
      }
      if (compareIsoDates(input.retainUntil, today) < 0) {
        throw new AppError('VALIDATION', 'Yeni saklama bitişi bugünden önce olamaz.');
      }
      ensureMatched(
        await CompanyModel.updateOne(
          { _id: companyId, deletionStatus: 'none', retainUntil: current.retainUntil },
          { $set: { retainUntil: input.retainUntil } },
          { session, timestamps: false },
        ),
      );
      await this.log(session, {
        adminId,
        companyId,
        action: 'company.extend_retention',
        changes: [{ field: 'retainUntil', old: current.retainUntil, new: input.retainUntil }],
        reason: input.reason,
      });
    });
    return this.presentById(companyId);
  }

  /**
   * Kalıcı silmeyi başlatır: yalnız saklama süresi dolmuş (silme onayı bekleyen) firmada veya
   * başarısız silmenin yeniden denenmesinde; firma adı yazılarak onaylanır. Silme arka planda sürer.
   */
  async requestDeletion(adminId: Types.ObjectId, id: string, input: PlatformCompanyDeleteInput) {
    const companyId = toObjectId(id);
    const today = this.today();
    await withTransaction(async (session) => {
      const current = await this.load(companyId, session);
      if (current.deletionStatus === 'done') throw permanentlyDeleted();
      if (current.deletionStatus === 'pending' || current.deletionStatus === 'running') {
        throw new AppError('CONFLICT', 'Firmanın kalıcı silme işlemi sürüyor.');
      }
      if (
        current.deletionStatus === 'none' &&
        computeServiceState(current, today) !== 'deletion_pending'
      ) {
        throw new AppError(
          'CONFLICT',
          'Kalıcı silme yalnız saklama süresi dolmuş firmada yapılabilir.',
        );
      }
      if (input.confirmName !== current.name.trim()) {
        throw new AppError('VALIDATION', 'Yazılan ad firma adıyla aynı değil.');
      }
      ensureMatched(
        await CompanyModel.updateOne(
          { _id: companyId, deletionStatus: current.deletionStatus },
          { $set: { deletionStatus: 'pending' } },
          { session, timestamps: false },
        ),
      );
      await this.log(session, {
        adminId,
        companyId,
        action: 'company.delete',
        changes: [{ field: 'deletionStatus', old: current.deletionStatus, new: 'pending' }],
        reason: input.reason,
      });
    });
    this.deletion.schedule(companyId);
    return this.presentById(companyId);
  }

  private log(
    session: ClientSession,
    entry: {
      adminId: Types.ObjectId;
      companyId: Types.ObjectId;
      action: string;
      changes: PlatformLogChange[];
      reason?: string | null | undefined;
    },
  ) {
    return writePlatformLog(
      { ...entry, reason: entry.reason ?? null, at: this.deps.clock.now() },
      session,
    );
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
    await seedDefaultCategories(company._id, this.deps.clock.now(), session);
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
    assertModifiable(company);
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

  /**
   * Ad, kullanıcı adı ve aktiflik. Pasifleştirme girişi ve bütün oturumları hemen kapatır; geçmiş
   * kayıt atıfları kalır. Kullanıcı adı sistem genelinde tektir.
   */
  async updateUser(adminId: Types.ObjectId, userId: string, input: PlatformUserUpdateInput) {
    const { deps } = this;
    const id = toObjectId(userId);
    return withTransaction(async (session) => {
      const current = await UserModel.findById(id).session(session);
      if (!current) throw notFound();
      const company = await this.load(current.companyId, session);
      assertModifiable(company);

      const profile: Partial<Pick<User, 'name' | 'username'>> = {};
      if (input.name !== undefined) profile.name = input.name;
      if (input.username !== undefined) profile.username = input.username;
      const profileChanges = diffChanges(
        { name: current.name, username: current.username },
        profile,
      );
      if (
        profile.username !== undefined &&
        profile.username !== current.username &&
        (await UserModel.exists({ username: profile.username, _id: { $ne: id } }).session(session))
      ) {
        throw usernameTaken();
      }

      const set: UpdateQuery<User>['$set'] = { ...profile };
      if (input.isActive === true) set.isActive = true;
      if (input.isActive === false) {
        Object.assign(set, {
          isActive: false,
          refreshTokens: [],
          tokensValidAfter: revocationTime(deps.clock),
        });
      }
      let user;
      try {
        user = await updateIfUnchanged({
          model: UserModel,
          filter: { _id: id },
          expectedUpdatedAt: input.expectedUpdatedAt,
          update: { $set: set },
          session,
          present: presentPlatformUser,
          onMissing: notFound,
        });
      } catch (error) {
        if (isDuplicateKeyError(error, 'username')) throw usernameTaken();
        throw error;
      }

      const userRef = { field: 'userId', old: null, new: user._id.toString() };
      if (profileChanges.length > 0) {
        await this.log(session, {
          adminId,
          companyId: user.companyId,
          action: 'user.update',
          changes: [userRef, ...profileChanges],
          reason: input.reason,
        });
      }
      if (input.isActive !== undefined && current.isActive !== input.isActive) {
        await this.log(session, {
          adminId,
          companyId: user.companyId,
          action: input.isActive ? 'user.activate' : 'user.deactivate',
          changes: [userRef, { field: 'isActive', old: current.isActive, new: input.isActive }],
          reason: input.reason,
        });
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
