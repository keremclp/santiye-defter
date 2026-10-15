// Testlerde HTTP istemcisinin cevaplarını taklit eder; gerçek ağa çıkılmaz.

import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { http } from '../api/client';
import { storageHttp } from '../features/documents/upload';

export interface MockRequest {
  method: string;
  url: string;
  params: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string>;
}

export type MockReply = { status: number; data?: unknown } | 'network';

/**
 * Her isteği kaydeder ve `handler` cevabını döner. İmzalı depo adresine yükleme (belgeler) de
 * aynı işleyiciye tam adresiyle gelir.
 */
export function mockHttp(handler: (request: MockRequest) => MockReply) {
  const requests: MockRequest[] = [];
  const adapter = (config: InternalAxiosRequestConfig) => {
    const request: MockRequest = {
      method: (config.method ?? 'get').toUpperCase(),
      url: config.url ?? '',
      params: (config.params ?? {}) as Record<string, unknown>,
      body: typeof config.data === 'string' ? (JSON.parse(config.data) as unknown) : config.data,
      headers: Object.fromEntries(
        Object.entries(config.headers.toJSON()).map(([key, value]) => [
          key.toLowerCase(),
          String(value),
        ]),
      ),
    };
    requests.push(request);
    const reply = handler(request);
    if (reply === 'network') {
      return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
    }
    const response: AxiosResponse = {
      data: reply.data,
      status: reply.status,
      statusText: '',
      headers: {},
      config,
    };
    if (reply.status >= 200 && reply.status < 300) return Promise.resolve(response);
    return Promise.reject(
      new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response),
    );
  };
  http.defaults.adapter = adapter;
  storageHttp.defaults.adapter = adapter;
  return requests;
}

export const ok = (data: unknown, status = 200): MockReply => ({
  status,
  data: { success: true, data },
});

export const fail = (
  status: number,
  code: string,
  message: string,
  details?: unknown,
): MockReply => ({
  status,
  data: { success: false, code, message, ...(details === undefined ? {} : { details }) },
});
