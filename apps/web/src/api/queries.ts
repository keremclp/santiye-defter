// Sunucu verisi sorguları (TanStack Query). Mutasyonlar ilgili liste, detay, özet ve panoyu
// geçersiz kılar (şartname 11).

import { QueryClient, useQuery } from '@tanstack/react-query';
import { apiGet, isApiError } from './client';
import type {
  AgreementDetail,
  AgreementList,
  Category,
  CompanyInfo,
  CompanyUser,
  Dashboard,
  DeletedItem,
  DeletedType,
  DuesList,
  MeResult,
  OpenBalancesReport,
  Paged,
  PartyDetail,
  PartyReport,
  PartySuggestion,
  Party,
  PeriodReport,
  Project,
  ProjectReport,
  ProjectSummary,
  SearchHistoryItem,
  SearchResult,
  TransactionDetail,
  TransactionList,
} from './types';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Kesin cevaplarda (4xx) tekrar denenmez; yalnız bağlantı hatası bir kez yeniden denenir.
        retry: (failureCount, error) =>
          failureCount < 1 && isApiError(error) && (error.isNetwork || (error.status ?? 0) >= 500),
      },
      mutations: { retry: false },
    },
  });
}

type Params = Record<string, unknown>;

export const keys = {
  me: ['me'] as const,
  company: ['company'] as const,
  companyUsers: ['company', 'users'] as const,
  categories: (includeInactive: boolean) => ['categories', includeInactive] as const,
  dashboard: ['dashboard'] as const,
  projects: (params: Params) => ['projects', 'list', params] as const,
  project: (id: string) => ['projects', 'detail', id] as const,
  projectSummary: (id: string) => ['projects', 'summary', id] as const,
  parties: (params: Params) => ['parties', 'list', params] as const,
  partySuggest: (q: string) => ['parties', 'suggest', q] as const,
  party: (id: string) => ['parties', 'detail', id] as const,
  transactions: (params: Params) => ['transactions', 'list', params] as const,
  transaction: (id: string) => ['transactions', 'detail', id] as const,
  agreements: (params: Params) => ['agreements', 'list', params] as const,
  agreement: (id: string) => ['agreements', 'detail', id] as const,
  dues: (params: Params) => ['dues', params] as const,
  search: (params: Params) => ['search', params] as const,
  searchHistory: ['search', 'history'] as const,
  deleted: (params: Params) => ['deleted', params] as const,
  report: (path: string, params: Params) => ['reports', path, params] as const,
};

const STATIC_KEYS = new Set(['me']);

/** Finansal kayıt değişince bütün listeler, detaylar, özetler ve pano yeniden doğrulanır. */
export function invalidateRecords(client: QueryClient): Promise<void> {
  return client.invalidateQueries({
    predicate: (query) => !STATIC_KEYS.has(String(query.queryKey[0])),
  });
}

const enabledId = (id: string | undefined | null) => Boolean(id);

export const useMe = (enabled = true) =>
  useQuery({ queryKey: keys.me, queryFn: () => apiGet<MeResult>('/auth/me'), enabled });

export const useCompany = () =>
  useQuery({ queryKey: keys.company, queryFn: () => apiGet<CompanyInfo>('/company') });

export const useCompanyUsers = () =>
  useQuery({
    queryKey: keys.companyUsers,
    queryFn: () => apiGet<CompanyUser[]>('/company/users'),
    staleTime: 5 * 60_000,
  });

export const useCategories = (includeInactive = false) =>
  useQuery({
    queryKey: keys.categories(includeInactive),
    queryFn: () => apiGet<Category[]>('/categories', { includeInactive }),
  });

export const useDashboard = () =>
  useQuery({ queryKey: keys.dashboard, queryFn: () => apiGet<Dashboard>('/dashboard') });

export const useProjects = (params: Params, enabled = true) =>
  useQuery({
    queryKey: keys.projects(params),
    queryFn: () => apiGet<Paged<Project>>('/projects', params),
    enabled,
  });

export const useProject = (id: string | undefined) =>
  useQuery({
    queryKey: keys.project(id ?? ''),
    queryFn: () => apiGet<Project>(`/projects/${id}`),
    enabled: enabledId(id),
  });

export const useProjectSummary = (id: string | undefined) =>
  useQuery({
    queryKey: keys.projectSummary(id ?? ''),
    queryFn: () => apiGet<ProjectSummary>(`/projects/${id}/summary`),
    enabled: enabledId(id),
  });

export const useParties = (params: Params, enabled = true) =>
  useQuery({
    queryKey: keys.parties(params),
    queryFn: () => apiGet<Paged<Party>>('/parties', params),
    enabled,
  });

export const usePartySuggest = (q: string, enabled = true) =>
  useQuery({
    queryKey: keys.partySuggest(q),
    queryFn: () => apiGet<PartySuggestion[]>('/parties/suggest', { q }),
    enabled,
  });

export const useParty = (id: string | undefined | null) =>
  useQuery({
    queryKey: keys.party(id ?? ''),
    queryFn: () => apiGet<PartyDetail>(`/parties/${id}`),
    enabled: enabledId(id),
  });

export const useTransactions = (params: Params, enabled = true) =>
  useQuery({
    queryKey: keys.transactions(params),
    queryFn: () => apiGet<TransactionList>('/transactions', params),
    enabled,
  });

export const useTransaction = (id: string | undefined) =>
  useQuery({
    queryKey: keys.transaction(id ?? ''),
    queryFn: () => apiGet<TransactionDetail>(`/transactions/${id}`),
    enabled: enabledId(id),
  });

export const useAgreements = (params: Params, enabled = true) =>
  useQuery({
    queryKey: keys.agreements(params),
    queryFn: () => apiGet<AgreementList>('/agreements', params),
    enabled,
  });

export const useAgreement = (id: string | undefined | null) =>
  useQuery({
    queryKey: keys.agreement(id ?? ''),
    queryFn: () => apiGet<AgreementDetail>(`/agreements/${id}`),
    enabled: enabledId(id),
  });

export const useDues = (params: Params) =>
  useQuery({ queryKey: keys.dues(params), queryFn: () => apiGet<DuesList>('/dues', params) });

export const useSearch = (params: Params, enabled: boolean) =>
  useQuery({
    queryKey: keys.search(params),
    queryFn: () => apiGet<SearchResult>('/search', params),
    enabled,
  });

export const useSearchHistory = () =>
  useQuery({
    queryKey: keys.searchHistory,
    queryFn: () => apiGet<SearchHistoryItem[]>('/search/history'),
  });

export const useDeleted = (type: DeletedType, page: number) =>
  useQuery({
    queryKey: keys.deleted({ type, page }),
    queryFn: () => apiGet<Paged<DeletedItem>>('/deleted', { type, page }),
  });

const useReport = <T>(path: string, params: Params, enabled = true) =>
  useQuery({
    queryKey: keys.report(path, params),
    queryFn: () => apiGet<T>(path, params),
    enabled,
  });

export const usePeriodReport = (params: Params) =>
  useReport<PeriodReport>('/reports/period', params);

export const useProjectReport = (id: string | undefined, params: Params) =>
  useReport<ProjectReport>(`/reports/projects/${id}/summary`, params, enabledId(id));

export const usePartyReport = (id: string | undefined | null, params: Params) =>
  useReport<PartyReport>(`/reports/parties/${id}/statement`, params, enabledId(id));

export const useOpenBalancesReport = (params: Params) =>
  useReport<OpenBalancesReport>('/reports/open-balances', params);
