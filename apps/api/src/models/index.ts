import { AgreementModel } from './agreement.js';
import { CategoryModel } from './category.js';
import { CompanyModel } from './company.js';
import { DocumentModel } from './document.js';
import { ExportJobModel } from './export-job.js';
import { IdempotencyRecordModel } from './idempotency-record.js';
import { PartyModel } from './party.js';
import { PlatformAdminModel } from './platform-admin.js';
import { PlatformLogModel } from './platform-log.js';
import { ProjectModel } from './project.js';
import { SearchHistoryModel } from './search-history.js';
import { TransactionModel } from './transaction.js';
import { UserModel } from './user.js';

export const models = [
  CompanyModel,
  UserModel,
  PlatformAdminModel,
  IdempotencyRecordModel,
  PlatformLogModel,
  ProjectModel,
  PartyModel,
  CategoryModel,
  TransactionModel,
  AgreementModel,
  SearchHistoryModel,
  DocumentModel,
  ExportJobModel,
];

/** Koleksiyonları ve indeksleri oluşturur; transaction içinde ilk yazıdan önce hazır olmalı. */
export async function initModels(): Promise<void> {
  await Promise.all(models.map((current) => current.init()));
}
