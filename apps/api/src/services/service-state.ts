// Etkin hizmet durumu ve erişim tablosu (şartname 9.10). Her istekte tarihlerden hesaplanır.

import { addDays, compareIsoDates } from '@santiye/shared';
import { AppError } from '../http/errors.js';
import type { Company } from '../models/company.js';

export const SERVICE_STATES = [
  'active',
  'view_only',
  'suspended',
  'archived',
  'deletion_pending',
  'deleting',
] as const;
export type ServiceState = (typeof SERVICE_STATES)[number];

/** Giriş, okuma (rapor/dışa aktarma dahil), kayıt değiştirme, kendi şifresi ve profili */
export type AccessKind = 'login' | 'read' | 'write' | 'self';

type CompanyServiceFields = Pick<
  Company,
  'isSuspended' | 'serviceEndedAt' | 'viewUntil' | 'retainUntil' | 'deletionStatus'
>;

/**
 * Hizmet sonu yürürlük günü D'den itibaren: D … viewUntil görüntüleme, viewUntil+1 … retainUntil
 * arşiv saklama, retainUntil'den sonra silme onayı bekliyor. Uçlar dahildir.
 */
export function computeServiceState(company: CompanyServiceFields, today: string): ServiceState {
  if (company.deletionStatus !== 'none') return 'deleting';

  if (company.serviceEndedAt && compareIsoDates(today, company.serviceEndedAt) >= 0) {
    if (company.retainUntil && compareIsoDates(today, company.retainUntil) > 0) {
      return 'deletion_pending';
    }
    if (company.viewUntil && compareIsoDates(today, company.viewUntil) > 0) return 'archived';
    return company.isSuspended ? 'suspended' : 'view_only';
  }

  return company.isSuspended ? 'suspended' : 'active';
}

/** Görüntüleme dönemi D … D+30, saklama D … D+180; uçlar dahil (şartname 8.1, 9.10). */
export const VIEW_PERIOD_DAYS = 30;
export const RETENTION_PERIOD_DAYS = 180;

export function serviceEndDates(effectiveDate: string) {
  return {
    serviceEndedAt: effectiveDate,
    viewUntil: addDays(effectiveDate, VIEW_PERIOD_DAYS),
    retainUntil: addDays(effectiveDate, RETENTION_PERIOD_DAYS),
  };
}

export type AccessDecision = 'allow' | 'read_only' | 'closed';

export function accessDecision(state: ServiceState, kind: AccessKind): AccessDecision {
  if (state === 'active') return 'allow';
  if (state === 'view_only') return kind === 'write' ? 'read_only' : 'allow';
  return 'closed';
}

export interface ServiceSummary {
  state: ServiceState;
  serviceEndedAt: string | null;
  viewUntil: string | null;
  retainUntil: string | null;
}

export function serviceSummary(company: CompanyServiceFields, today: string): ServiceSummary {
  return {
    state: computeServiceState(company, today),
    serviceEndedAt: company.serviceEndedAt,
    viewUntil: company.viewUntil,
    retainUntil: company.retainUntil,
  };
}

const longDate = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatLongDate(date: string): string {
  return longDate.format(new Date(`${date}T00:00:00Z`));
}

const CONTACT_OWNER = 'Ayrıntı için ürün sahibiyle iletişime geçin.';

export type ClosedReason = Exclude<ServiceState, 'active' | 'view_only'> | 'user_inactive';

const CLOSED_MESSAGES: Record<ClosedReason, string> = {
  suspended: `Firmanızın erişimi geçici olarak durduruldu. ${CONTACT_OWNER}`,
  archived: `Hizmetiniz sona erdi ve görüntüleme süresi doldu. Kayıtlarınız arşivde saklanıyor. ${CONTACT_OWNER}`,
  deletion_pending: `Hizmetiniz sona erdi ve saklama süresi doldu. ${CONTACT_OWNER}`,
  deleting: `Firma hesabı kapatılıyor. ${CONTACT_OWNER}`,
  user_inactive: `Hesabınız kullanıma kapalı. ${CONTACT_OWNER}`,
};

export function accessClosedError(reason: ClosedReason): AppError {
  return new AppError('ACCESS_CLOSED', CLOSED_MESSAGES[reason], { state: reason });
}

export function readOnlyError(service: ServiceSummary): AppError {
  const until = service.viewUntil
    ? ` Görüntüleme ve dışa aktarma süresi: ${formatLongDate(service.viewUntil)}.`
    : '';
  return new AppError(
    'READ_ONLY',
    `Hizmetiniz sona erdi; kayıtlar yalnız görüntülenebilir ve dışa aktarılabilir.${until}`,
    { state: service.state, viewUntil: service.viewUntil },
  );
}

/** Erişim tablosunu uygular; izin yoksa ilgili hatayı atar. */
export function assertAccess(service: ServiceSummary, kind: AccessKind): void {
  const decision = accessDecision(service.state, kind);
  if (decision === 'closed') throw accessClosedError(service.state as ClosedReason);
  if (decision === 'read_only') throw readOnlyError(service);
}
