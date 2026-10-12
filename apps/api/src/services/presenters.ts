// API cevaplarında dönen biçimler. Şifre hash'i, token ve TOTP bilgisi hiçbir zaman dönmez.

import type { Company } from '../models/company.js';
import type { PlatformAdmin } from '../models/platform-admin.js';
import type { PlatformLog } from '../models/platform-log.js';
import type { User } from '../models/user.js';
import type { ServiceSummary } from './service-state.js';

/** Şartname 10.1: `{ id, name, username, companyId, mustChangePassword }` */
export function presentAuthUser(user: User) {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    companyId: user.companyId.toString(),
    mustChangePassword: user.mustChangePassword,
  };
}

export function presentProfile(user: User) {
  return {
    ...presentAuthUser(user),
    phone: user.phone,
    email: user.email,
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function presentPlatformUser(user: User) {
  return {
    id: user._id.toString(),
    companyId: user.companyId.toString(),
    name: user.name,
    username: user.username,
    phone: user.phone,
    email: user.email,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    tempPasswordExpiresAt: user.tempPasswordExpiresAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function presentPlatformCompany(
  company: Company,
  extra: { service: ServiceSummary; userCount: number },
) {
  return {
    id: company._id.toString(),
    name: company.name,
    displayName: company.displayName,
    contact: company.contact,
    opsNote: company.opsNote,
    storage: { usedBytes: company.storageUsedBytes, quotaBytes: company.storageQuotaBytes },
    service: extra.service,
    isSuspended: company.isSuspended,
    deletionStatus: company.deletionStatus,
    userCount: extra.userCount,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

export function presentPlatformAdmin(admin: PlatformAdmin) {
  return { id: admin._id.toString(), username: admin.username };
}

export function presentPlatformLog(log: PlatformLog) {
  return {
    id: log._id.toString(),
    adminId: log.adminId?.toString() ?? null,
    companyId: log.companyId?.toString() ?? null,
    action: log.action,
    changes: log.changes,
    reason: log.reason,
    at: log.at.toISOString(),
  };
}
