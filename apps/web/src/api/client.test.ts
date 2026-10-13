import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../stores/session';
import { useUi } from '../stores/ui';
import { fail, mockHttp, ok } from '../test/http-mock';
import { apiGet, ApiError, configureApiHandlers } from './client';

const user = {
  id: 'u1',
  name: 'Ayşe',
  username: 'ayse',
  companyId: 'c1',
  mustChangePassword: false,
};

beforeEach(() => {
  useSession
    .getState()
    .setSession({ accessToken: 'eski-access', refreshToken: 'eski-refresh', user });
  useUi.getState().setOffline(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  useSession.getState().clear();
});

describe('API istemcisi', () => {
  it('her istekte Bearer token gönderir', async () => {
    const requests = mockHttp(() => ok({ x: 1 }));
    await apiGet('/dashboard');
    expect(requests[0]?.headers.authorization).toBe('Bearer eski-access');
  });

  it('401 gelince bir kez yeniler ve isteği yeni token ile tekrarlar; eşzamanlı istekler tek yenileme bekler', async () => {
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({
      data: { success: true, data: { accessToken: 'yeni-access', refreshToken: 'yeni-refresh' } },
    });
    const requests = mockHttp((request) =>
      request.headers.authorization === 'Bearer yeni-access'
        ? ok({ ok: true })
        : fail(401, 'UNAUTHORIZED', 'Oturumunuz sona erdi.'),
    );

    const [a, b] = await Promise.all([apiGet('/dashboard'), apiGet('/projects')]);
    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0]?.[1]).toEqual({ refreshToken: 'eski-refresh' });
    expect(requests.filter((r) => r.headers.authorization === 'Bearer yeni-access')).toHaveLength(
      2,
    );
    expect(useSession.getState().refreshToken).toBe('yeni-refresh');
  });

  it('yenileme de 401 verirse oturum temizlenir ve girişe yönlendirilir', async () => {
    const onSessionExpired = vi.fn();
    configureApiHandlers({ onSessionExpired });
    vi.spyOn(axios, 'post').mockRejectedValue(
      new axios.AxiosError('401', 'ERR_BAD_REQUEST', undefined, null, {
        status: 401,
        data: {},
        statusText: '',
        headers: {},
        config: {} as never,
      }),
    );
    mockHttp(() => fail(401, 'UNAUTHORIZED', 'Oturumunuz sona erdi.'));

    await expect(apiGet('/dashboard')).rejects.toBeInstanceOf(ApiError);
    expect(useSession.getState().accessToken).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('ağ hatasında token silinmez, bağlantı durumu görünür olur', async () => {
    mockHttp(() => 'network');
    const error = await apiGet('/dashboard').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isNetwork).toBe(true);
    expect((error as ApiError).message).toBe('Bağlantı hatası. İnternetinizi kontrol edin.');
    expect(useSession.getState().accessToken).toBe('eski-access');
    expect(useUi.getState().offline).toBe(true);
  });

  it('API hata gövdesi Türkçe mesaj, kod ve alan hatalarıyla taşınır', async () => {
    mockHttp(() =>
      fail(400, 'VALIDATION', 'Şantiye seçilmeli.', {
        issues: [{ path: 'allocations.0.projectId', message: 'Şantiye seçilmeli.' }],
      }),
    );
    const error = (await apiGet('/x').catch((caught: unknown) => caught)) as ApiError;
    expect(error.code).toBe('VALIDATION');
    expect(error.status).toBe(400);
    expect(error.issues).toEqual([
      { path: 'allocations.0.projectId', message: 'Şantiye seçilmeli.' },
    ]);
  });
});
