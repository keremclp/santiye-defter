// Ürün sahibinin oluşturma istekleri (firma, kullanıcı) için güvenli tekrar (şartname 9.7):
// gönderim başına bir Idempotency-Key; cevap alınamazsa aynı anahtarla aynı istek yeniden gönderilir,
// sunucu ilk sonucu döner ve ikinci kayıt açmaz. Müşteri tarafındaki `/idempotency/:key` sorgusu
// yönetim oturumunda olmadığı için doğrulama aynı gönderimin tekrarıyla yapılır.

import { useCallback, useRef, useState } from 'react';
import { errorMessage, isApiError } from '../../api/client';
import { newIdempotencyKey, type SaveState } from '../../api/submission';

type Send<T> = (idempotencyKey: string) => Promise<{ data: T; message?: string | undefined }>;

export function useAdminCreate<T>() {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const pending = useRef<{ key: string; send: Send<T> } | null>(null);
  const inFlight = useRef(false);

  const attempt = useCallback(async () => {
    const current = pending.current;
    if (!current || inFlight.current) return null;
    inFlight.current = true;
    setState(
      state.status === 'verifying' ? { status: 'verifying', checking: true } : { status: 'saving' },
    );
    try {
      const result = await current.send(current.key);
      pending.current = null;
      setState({ status: 'saved', message: result.message });
      return result;
    } catch (error) {
      if (isApiError(error) && error.isNetwork) {
        setState({ status: 'verifying' });
        return null;
      }
      pending.current = null;
      setState({ status: 'failed', message: errorMessage(error) });
      throw error;
    } finally {
      inFlight.current = false;
    }
  }, [state.status]);

  /** Doğrulama bekleyen gönderim varsa yenisi açılmaz; aynı gönderim tekrarlanır. */
  const submit = useCallback(
    (send: Send<T>) => {
      pending.current ??= { key: newIdempotencyKey(), send };
      return attempt();
    },
    [attempt],
  );

  return {
    state,
    busy: state.status === 'saving' || state.status === 'verifying',
    uncertain: state.status === 'verifying',
    submit,
    retry: attempt,
  };
}
