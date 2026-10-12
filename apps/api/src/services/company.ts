// Firma kullanıcılarının ortak firma bilgisi (şartname 7.11, 10.3).

import type { z } from 'zod';
import type { companyUpdateSchema } from '@santiye/shared';
import { updateIfUnchanged } from '../db/concurrency.js';
import type { AppDeps } from '../deps.js';
import { CompanyModel, type Company } from '../models/company.js';
import type { CustomerContext } from './customer-auth.js';
import { diffChanges, historyEntry } from './records.js';
import { accessClosedError, type ServiceSummary } from './service-state.js';

/** Ürün sahibinin işletim notu ve resmi kayıt alanları müşteriye açılmaz. */
function presentCompany(company: Company, service: ServiceSummary) {
  return {
    displayName: company.displayName || company.name,
    contact: company.contact,
    storage: { usedBytes: company.storageUsedBytes, quotaBytes: company.storageQuotaBytes },
    service,
    updatedAt: company.updatedAt.toISOString(),
  };
}

export class CompanyService {
  constructor(private readonly deps: AppDeps) {}

  get(context: CustomerContext) {
    return presentCompany(context.company, context.service);
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
    return presentCompany(updated, context.service);
  }
}
