import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockHttp, ok } from '../test/http-mock';
import { ApiError } from './client';
import { useCreateSubmission } from './submission';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('güvenli kayıt gönderimi', () => {
  it('cevap alınamazsa "doğrulanıyor" olur; doğrulama aynı anahtarla tekrar gönderir ve tek kayıt döner', async () => {
    const requests = mockHttp(() =>
      ok({ status: 'done', resultRef: { type: 'transaction', id: 't1' } }),
    );
    const keys: string[] = [];
    const send = vi.fn((key: string) => {
      keys.push(key);
      return keys.length === 1
        ? Promise.reject(new ApiError('network', 'Bağlantı hatası. İnternetinizi kontrol edin.'))
        : Promise.resolve({ data: { id: 't1' } });
    });
    const { result } = renderHook(() => useCreateSubmission<{ id: string }>());

    await act(async () => {
      await result.current.submit(send);
    });
    expect(result.current.state.status).toBe('verifying');
    expect(result.current.busy).toBe(true);

    // Doğrulama beklerken yeni gönderim yeni anahtar üretmez; aynı gönderim doğrulanır.
    await act(async () => {
      await result.current.submit(send);
    });
    await waitFor(() => expect(result.current.state.status).toBe('saved'));
    expect(requests.some((r) => r.url === `/idempotency/${keys[0]}`)).toBe(true);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(UUID);
    expect(keys[1]).toBe(keys[0]);
  });

  it('kesin retten sonra düzeltilen form yeni anahtarla gider', async () => {
    const keys: string[] = [];
    const send = vi.fn((key: string) => {
      keys.push(key);
      return keys.length === 1
        ? Promise.reject(new ApiError('http', 'Şantiye seçilmeli.', 400, 'VALIDATION'))
        : Promise.resolve({ data: { id: 't2' } });
    });
    const { result } = renderHook(() => useCreateSubmission<{ id: string }>());
    await act(async () => {
      await result.current.submit(send).catch(() => undefined);
    });
    expect(result.current.state).toEqual({ status: 'failed', message: 'Şantiye seçilmeli.' });
    await act(async () => {
      await result.current.submit(send);
    });
    expect(result.current.state.status).toBe('saved');
    expect(keys[1]).not.toBe(keys[0]);
  });
});
