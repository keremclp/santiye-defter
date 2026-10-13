// HTTP istemcisi (şartname 3 kimlik akışı, 9.7, 11):
// - Her istekte `Authorization: Bearer`.
// - 401'de bir kez /auth/refresh, sonra isteği tekrarla; refresh de 401 ise oturumu temizle.
// - Ağ hatasında token silinmez; bağlantı durumu görünür olur.

import type { ApiErrorCode, ApiFailure, ApiSuccess } from '@santiye/shared';
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { useSession } from '../stores/session';
import { useUi } from '../stores/ui';
import type { TokenPair } from './types';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const NETWORK_ERROR_MESSAGE = 'Bağlantı hatası. İnternetinizi kontrol edin.';

export interface FieldIssue {
  path: string;
  message: string;
  code?: string;
}

export class ApiError extends Error {
  constructor(
    readonly kind: 'http' | 'network',
    message: string,
    readonly status: number | null = null,
    readonly code: ApiErrorCode | null = null,
    readonly details: unknown = undefined,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean {
    return this.kind === 'network';
  }

  /** Alan hataları: `details.issues` içindeki `path` → mesaj. */
  get issues(): FieldIssue[] {
    const details = this.details as { issues?: FieldIssue[] } | undefined;
    return Array.isArray(details?.issues) ? details.issues : [];
  }

  /** 409 CONFLICT cevabındaki güncel kayıt. */
  get current(): unknown {
    return (this.details as { current?: unknown } | undefined)?.current;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  return 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';
}

interface Handlers {
  onSessionExpired: () => void;
  onPasswordChangeRequired: () => void;
  onAccessChanged: () => void;
}

const handlers: Handlers = {
  onSessionExpired: () => undefined,
  onPasswordChangeRequired: () => undefined,
  onAccessChanged: () => undefined,
};

/** Uygulama yönlendirmesi kurulunca oturum sonu ve ilk şifre davranışları bağlanır. */
export function configureApiHandlers(next: Partial<Handlers>): void {
  Object.assign(handlers, next);
}

function serializeParams(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export const http = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  paramsSerializer: { serialize: serializeParams },
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

http.interceptors.request.use((config) => {
  const token = useSession.getState().accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

let refreshing: Promise<'ok' | 'expired' | 'network'> | null = null;

/** Tek seferde tek yenileme; eşzamanlı 401'ler aynı sonucu bekler. */
export function refreshSession(): Promise<'ok' | 'expired' | 'network'> {
  refreshing ??= (async () => {
    const refreshToken = useSession.getState().refreshToken;
    if (!refreshToken) return 'expired';
    try {
      const res = await axios.post<ApiSuccess<TokenPair>>(
        `${API_URL}/auth/refresh`,
        { refreshToken },
        { timeout: 20_000 },
      );
      useSession.getState().setTokens(res.data.data);
      return 'ok';
    } catch (error) {
      if (error instanceof AxiosError && error.response) return 'expired';
      return 'network';
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function toApiError(error: AxiosError<ApiFailure>): ApiError {
  if (!error.response) return new ApiError('network', NETWORK_ERROR_MESSAGE);
  const body = error.response.data;
  if (body && typeof body === 'object' && body.success === false) {
    return new ApiError('http', body.message, error.response.status, body.code, body.details);
  }
  return new ApiError(
    'http',
    'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
    error.response.status,
    'INTERNAL',
  );
}

const SESSION_PATHS = ['/auth/login', '/auth/refresh'];

http.interceptors.response.use(
  (response) => {
    useUi.getState().setOffline(false);
    return response;
  },
  async (error: unknown) => {
    if (!(error instanceof AxiosError)) throw error;
    const config = error.config as RetriableConfig | undefined;

    if (!error.response) {
      useUi.getState().setOffline(true);
      throw toApiError(error as AxiosError<ApiFailure>);
    }
    useUi.getState().setOffline(false);

    const status = error.response.status;
    const url = config?.url ?? '';
    if (status === 401 && config && !config._retried && !SESSION_PATHS.includes(url)) {
      const result = await refreshSession();
      if (result === 'ok') {
        config._retried = true;
        return http.request(config);
      }
      if (result === 'network') {
        useUi.getState().setOffline(true);
        throw new ApiError('network', NETWORK_ERROR_MESSAGE);
      }
      useSession.getState().clear();
      handlers.onSessionExpired();
    }

    const apiError = toApiError(error as AxiosError<ApiFailure>);
    if (apiError.code === 'PASSWORD_CHANGE_REQUIRED') handlers.onPasswordChangeRequired();
    if (apiError.code === 'READ_ONLY' || apiError.code === 'ACCESS_CLOSED') {
      handlers.onAccessChanged();
    }
    throw apiError;
  },
);

export interface RequestOptions {
  idempotencyKey?: string;
  signal?: AbortSignal;
}

function config(options: RequestOptions = {}): AxiosRequestConfig {
  return {
    signal: options.signal,
    headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {},
  };
}

export async function apiGet<T>(
  url: string,
  params: Record<string, unknown> = {},
  options: RequestOptions = {},
): Promise<T> {
  const res = await http.get<ApiSuccess<T>>(url, { ...config(options), params });
  return res.data.data;
}

/** Cevabın verisi ve varsa mesajı (ör. "Fazla ödeme kaydedildi"). */
export async function apiPostFull<T>(
  url: string,
  body: unknown = {},
  options: RequestOptions = {},
): Promise<{ data: T; message?: string | undefined }> {
  const res = await http.post<ApiSuccess<T>>(url, body, config(options));
  return { data: res.data.data, message: res.data.message };
}

export async function apiPost<T>(
  url: string,
  body: unknown = {},
  options: RequestOptions = {},
): Promise<T> {
  return (await apiPostFull<T>(url, body, options)).data;
}

export async function apiPatch<T>(url: string, body: unknown): Promise<T> {
  const res = await http.patch<ApiSuccess<T>>(url, body);
  return res.data.data;
}

export async function apiDelete<T>(url: string, body: unknown): Promise<T> {
  const res = await http.delete<ApiSuccess<T>>(url, { data: body });
  return res.data.data;
}
