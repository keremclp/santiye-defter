// Ürün sahibi HTTP istemcisi (şartname 10.10): müşteri istemcisiyle aynı hata biçimi, ayrı token ve
// ayrı yenileme yolu (`/platform/auth/refresh`). 401'de bir kez yenilenir; yenileme de 401 ise oturum
// temizlenir ve yönetim girişine dönülür.

import type { ApiFailure, ApiSuccess } from '@santiye/shared';
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { useAdminSession } from '../stores/admin-session';
import { useUi } from '../stores/ui';
import type { PlatformSession } from './admin-types';
import { API_URL, ApiError, NETWORK_ERROR_MESSAGE, serializeParams, toApiError } from './client';

export const adminHttp = axios.create({
  baseURL: API_URL,
  timeout: 20_000,
  paramsSerializer: { serialize: serializeParams },
});

type AdminConfig = InternalAxiosRequestConfig & {
  _retried?: boolean;
  /** Ara token ile giden istekler (şifre adımından sonra). */
  _pendingToken?: string;
  /**
   * İkinci adım kodu doğrulayan oturumlu istekler: 401 "kod hatalı" demektir, oturum sonu değil.
   * Token istekten hemen önce yenilendiği için yeniden denenmez (hatalı kod iki kez sayılmasın).
   */
  _codeCheck?: boolean;
};

let onSessionExpired: () => void = () => undefined;

export function configureAdminHandlers(handler: () => void): void {
  onSessionExpired = handler;
}

adminHttp.interceptors.request.use((config: AdminConfig) => {
  const token = config._pendingToken ?? useAdminSession.getState().accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

let refreshing: Promise<'ok' | 'expired' | 'network'> | null = null;

export function refreshAdminSession(): Promise<'ok' | 'expired' | 'network'> {
  refreshing ??= (async () => {
    const refreshToken = useAdminSession.getState().refreshToken;
    if (!refreshToken) return 'expired';
    try {
      const res = await axios.post<ApiSuccess<PlatformSession>>(
        `${API_URL}/platform/auth/refresh`,
        { refreshToken },
        { timeout: 20_000, adapter: adminHttp.defaults.adapter },
      );
      useAdminSession.getState().setSession(res.data.data);
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

function expire(): void {
  useAdminSession.getState().clear();
  useUi.getState().setLoginNotice('Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
  onSessionExpired();
}

adminHttp.interceptors.response.use(
  (response) => {
    useUi.getState().setOffline(false);
    return response;
  },
  async (error: unknown) => {
    if (!(error instanceof AxiosError)) throw error;
    const config = error.config as AdminConfig | undefined;
    if (!error.response) {
      useUi.getState().setOffline(true);
      throw toApiError(error as AxiosError<ApiFailure>);
    }
    useUi.getState().setOffline(false);

    if (
      error.response.status === 401 &&
      config &&
      !config._retried &&
      !config._pendingToken &&
      !config._codeCheck &&
      config.url !== '/platform/auth/login'
    ) {
      const result = await refreshAdminSession();
      if (result === 'ok') {
        config._retried = true;
        return adminHttp.request(config);
      }
      if (result === 'network') {
        useUi.getState().setOffline(true);
        throw new ApiError('network', NETWORK_ERROR_MESSAGE);
      }
      expire();
    }
    throw toApiError(error as AxiosError<ApiFailure>);
  },
);

export interface AdminRequestOptions {
  idempotencyKey?: string;
  pendingToken?: string;
  params?: Record<string, unknown>;
}

function config(options: AdminRequestOptions = {}): AxiosRequestConfig {
  return {
    params: options.params,
    headers: options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {},
    ...(options.pendingToken ? { _pendingToken: options.pendingToken } : {}),
  };
}

export async function adminGet<T>(url: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await adminHttp.get<ApiSuccess<T>>(url, { params });
  return res.data.data;
}

export async function adminPostFull<T>(
  url: string,
  body: unknown = {},
  options: AdminRequestOptions = {},
): Promise<{ data: T; message?: string | undefined }> {
  const res = await adminHttp.post<ApiSuccess<T>>(url, body, config(options));
  return { data: res.data.data, message: res.data.message };
}

export async function adminPost<T>(
  url: string,
  body: unknown = {},
  options: AdminRequestOptions = {},
): Promise<T> {
  return (await adminPostFull<T>(url, body, options)).data;
}

export async function adminPatch<T>(url: string, body: unknown): Promise<T> {
  const res = await adminHttp.patch<ApiSuccess<T>>(url, body);
  return res.data.data;
}

/**
 * Oturumlu kod doğrulaması (kurtarma kodu yenileme, TOTP yeniden kurulumu): önce oturum yenilenir,
 * böylece 401 yalnız "kod hatalı" anlamına gelir.
 */
export async function adminCodeCheck<T>(
  url: string,
  body: unknown,
): Promise<{
  data: T;
  message?: string | undefined;
}> {
  const refreshed = await refreshAdminSession();
  if (refreshed === 'network') throw new ApiError('network', NETWORK_ERROR_MESSAGE);
  if (refreshed === 'expired') {
    expire();
    throw new ApiError('http', 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.', 401);
  }
  const res = await adminHttp.post<ApiSuccess<T>>(url, body, {
    _codeCheck: true,
  } as AxiosRequestConfig);
  return { data: res.data.data, message: res.data.message };
}
