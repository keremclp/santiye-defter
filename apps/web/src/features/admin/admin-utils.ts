import type { PlatformCompany } from '../../api/admin-types';
import { isApiError } from '../../api/client';

/** Sunucunun alan hataları (`details.issues`) → alan yolu → mesaj. */
export function issuesByPath(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  return Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message]));
}

export function validCode(code: string): string | undefined {
  return /^\d{6}$/.test(code) ? undefined : 'Doğrulama uygulamasındaki 6 haneli kodu girin.';
}

export function companyState(company: PlatformCompany) {
  return { state: company.service.state, deletionStatus: company.deletionStatus };
}

/** Kullanım yüzdesi yalnız gösterim içindir (bayt tamsayı; para değil). */
export function usagePercent(used: number, quota: number): number {
  return quota > 0 ? Math.floor((used * 100) / quota) : 0;
}
