// Ürün sahibi yönetim API'sinin cevap tipleri (şartname 10.10).

import type { Contact, ServiceState, ServiceSummary } from './types';

export interface PlatformAdmin {
  id: string;
  username: string;
}

export interface PlatformSession {
  accessToken: string;
  refreshToken: string;
  admin: PlatformAdmin;
}

export interface PlatformLoginResult {
  pendingToken: string;
  totpSetupRequired: boolean;
}

export interface TotpSetupResult {
  otpauthUrl: string;
  secret: string;
}

export interface TotpVerifyResult extends PlatformSession {
  /** Yalnız ilk kurulumda bir kez döner. */
  recoveryCodes?: string[];
}

export interface RecoveryLoginResult extends PlatformSession {
  remainingRecoveryCodes: number;
}

export type DeletionStatus = 'none' | 'pending' | 'running' | 'done' | 'failed';

export interface PlatformCompany {
  id: string;
  name: string;
  displayName: string;
  contact: Contact;
  opsNote: string;
  storage: { usedBytes: number; quotaBytes: number };
  service: ServiceSummary;
  isSuspended: boolean;
  deletionStatus: DeletionStatus;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

/** İşletim özeti öğesi. */
export interface CompanyRef {
  id: string;
  name: string;
  state: ServiceState;
  deletionStatus: DeletionStatus;
  usedBytes: number;
  quotaBytes: number;
  viewUntil: string | null;
  retainUntil: string | null;
}

export interface OperationsSummary {
  storageFull: CompanyRef[];
  storageNearFull: CompanyRef[];
  viewEnding: CompanyRef[];
  retentionEnding: CompanyRef[];
  deletionPending: CompanyRef[];
  deletionIncomplete: CompanyRef[];
}

export interface PlatformCompanyList {
  items: PlatformCompany[];
  page: number;
  limit: number;
  total: number;
  summary: OperationsSummary;
}

export interface PlatformUser {
  id: string;
  companyId: string;
  name: string;
  username: string;
  phone: string;
  email: string;
  isActive: boolean;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformLogChange {
  field: string;
  old: unknown;
  new: unknown;
}

export interface PlatformLogEntry {
  id: string;
  adminId: string | null;
  companyId: string | null;
  action: string;
  changes: PlatformLogChange[];
  reason: string | null;
  at: string;
}

export interface CompanyContents {
  transactions: number;
  agreements: number;
  projects: number;
  parties: number;
  documents: number;
}

export interface PlatformCompanyDetail {
  company: PlatformCompany;
  users: PlatformUser[];
  contents: CompanyContents;
  history: PlatformLogEntry[];
}

/** Geçici şifre yalnız ilk cevapta döner; aynı anahtarla tekrar gelirse `null`. */
export interface TemporaryPasswordResult {
  user: PlatformUser;
  temporaryPassword: string | null;
  tempPasswordExpiresAt: string | null;
}

export interface EndServicePreview {
  preview: true;
  name: string;
  effectiveDate: string;
  serviceEndedAt: string;
  viewUntil: string;
  retainUntil: string;
}
