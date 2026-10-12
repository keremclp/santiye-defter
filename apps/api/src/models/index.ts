import { CompanyModel } from './company.js';
import { IdempotencyRecordModel } from './idempotency-record.js';
import { PlatformAdminModel } from './platform-admin.js';
import { PlatformLogModel } from './platform-log.js';
import { UserModel } from './user.js';

export const models = [
  CompanyModel,
  UserModel,
  PlatformAdminModel,
  IdempotencyRecordModel,
  PlatformLogModel,
];

/** Koleksiyonları ve indeksleri oluşturur; transaction içinde ilk yazıdan önce hazır olmalı. */
export async function initModels(): Promise<void> {
  await Promise.all(models.map((current) => current.init()));
}
