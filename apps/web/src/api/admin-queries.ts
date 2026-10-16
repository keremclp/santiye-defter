// Ürün sahibi yönetim sorguları. Değiştiren her işlem firma listesini ve detayını geçersiz kılar.

import { useQuery, type QueryClient } from '@tanstack/react-query';
import { adminGet } from './admin-client';
import type { PlatformCompanyDetail, PlatformCompanyList } from './admin-types';

export const adminKeys = {
  all: ['platform'] as const,
  companies: (params: Record<string, unknown>) => ['platform', 'companies', params] as const,
  company: (id: string) => ['platform', 'company', id] as const,
};

export function usePlatformCompanies(params: { q?: string; status?: string; page: number }) {
  return useQuery({
    queryKey: adminKeys.companies(params),
    queryFn: () => adminGet<PlatformCompanyList>('/platform/companies', { ...params, limit: 50 }),
    placeholderData: (previous) => previous,
  });
}

/** Kalıcı silme sürerken durum kendiliğinden yenilenir. */
export function usePlatformCompany(id: string) {
  return useQuery({
    queryKey: adminKeys.company(id),
    queryFn: () => adminGet<PlatformCompanyDetail>(`/platform/companies/${id}`),
    refetchInterval: (query) => {
      const status = query.state.data?.company.deletionStatus;
      return status === 'pending' || status === 'running' ? 3_000 : false;
    },
  });
}

export function invalidatePlatform(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: adminKeys.all });
}
