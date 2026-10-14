// Firma kullanıcılarının ortak firma bilgisi (şartname 7.11, 10.3).

import type { z } from 'zod';
import type { companyUpdateSchema } from '@santiye/shared';
import { updateIfUnchanged } from '../db/concurrency.js';
import type { AppDeps } from '../deps.js';
import { CompanyModel, type Company } from '../models/company.js';
import { UserModel } from '../models/user.js';
import type { CustomerContext } from './customer-auth.js';
import { storageBreakdown } from './documents.js';
import { diffChanges, historyEntry } from './records.js';
import { accessClosedError, type ServiceSummary } from './service-state.js';

type StorageBreakdown = Awaited<ReturnType<typeof storageBreakdown>>;

/**
 * Ürün sahibinin işletim notu ve resmi kayıt alanları müşteriye açılmaz. Depolama kullanımı orijinal,
 * önizleme ve geri alınabilir silinmiş belgeler ayrı olarak döner (şartname 7.11, 9.6).
 */
function presentCompany(company: Company, service: ServiceSummary, breakdown?: StorageBreakdown) {
  return {
    displayName: company.displayName || company.name,
    contact: company.contact,
    storage: {
      usedBytes: company.storageUsedBytes,
      quotaBytes: company.storageQuotaBytes,
      ...(breakdown ? { breakdown } : {}),
    },
    service,
    updatedAt: company.updatedAt.toISOString(),
  };
}

export class CompanyService {
  constructor(private readonly deps: AppDeps) {}

  async get(context: CustomerContext) {
    return presentCompany(
      context.company,
      context.service,
      await storageBreakdown(context.companyId),
    );
  }

  /**
   * "Kaydı oluşturan kullanıcı" filtresi için aynı firmanın kullanıcıları. Yalnız kimlik, görünen ad
   * ve aktiflik döner; pasif kullanıcıların geçmiş kayıtları da süzülebilsin diye onlar da listelenir.
   */
  async users(context: CustomerContext) {
    const users = await UserModel.find(
      { companyId: context.companyId },
      { name: 1, isActive: 1 },
    ).sort({ name: 1 });
    return users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      isActive: user.isActive,
    }));
  }

  /** Görünen ad ve iletişim; kimlik, kullanıcılar, kapasite ve hizmet durumu değişmez. */
  async update(context: CustomerContext, input: z.infer<typeof companyUpdateSchema>) {
    const next: Record<string, unknown> = {};
    if (input.displayName !== undefined) next.displayName = input.displayName;
    if (input.contact !== undefined) next.contact = input.contact;
    const changes = diffChanges(
      { displayName: context.company.displayName, contact: context.company.contact },
      next,
    );

    const updated = await updateIfUnchanged({
      model: CompanyModel,
      filter: { _id: context.companyId },
      expectedUpdatedAt: input.expectedUpdatedAt,
      update: {
        $set: next,
        ...(changes.length > 0
          ? {
              $push: {
                history: historyEntry({
                  by: context.userId,
                  action: 'update',
                  changes,
                  at: this.deps.clock.now(),
                }),
              },
            }
          : {}),
      },
      present: (company) => presentCompany(company, context.service),
      onMissing: () => accessClosedError('deleting'),
    });
    return presentCompany(updated, context.service, await storageBreakdown(context.companyId));
  }
}
