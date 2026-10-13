// Güvenli kayıt gönderimi (şartname 9.7):
// - "Kaydet"e basınca yeni Idempotency-Key üretilir; aynı gönderimin tekrarlarında aynı anahtar kullanılır.
// - Cevap alınamazsa kesin başarısızlık sayılmaz: "Kaydın durumu doğrulanıyor"; GET /idempotency/:key
//   ile sorulur ve aynı anahtarla yeniden gönderilir (sunucu ilk sonucu döner, ikinci kayıt açmaz).
// - Kesin ret (doğrulama hatası) olursa anahtar bırakılır; düzeltilen form yeni anahtarla gider.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet, errorMessage, isApiError } from './client';
import type { IdempotencyStatus } from './types';

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; message?: string | undefined }
  | { status: 'failed'; message: string }
  | { status: 'verifying'; found?: boolean | undefined; checking?: boolean | undefined };

export interface SubmissionResult<T> {
  data: T;
  message?: string | undefined;
}

type Send<T> = (idempotencyKey: string) => Promise<SubmissionResult<T>>;

/** Güvenli (sertifikasız yerel ağ dahil) ortamlarda çalışan UUID v4. */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const VERIFY_INTERVAL_MS = 8_000;

export interface CreateSubmission<T> {
  state: SaveState;
  /** Gönderim veya doğrulama sürüyor; düğmeler kilitli. */
  busy: boolean;
  /** Yeni gönderim. Doğrulama bekleyen bir gönderim varsa yenisi açılmaz, o doğrulanır. */
  submit: (send: Send<T>) => Promise<SubmissionResult<T> | null>;
  verify: () => Promise<SubmissionResult<T> | null>;
  reset: () => void;
}

export function useCreateSubmission<T>(
  onSuccess?: (result: SubmissionResult<T>) => void,
): CreateSubmission<T> {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const pending = useRef<{ key: string; send: Send<T> } | null>(null);
  const inFlight = useRef(false);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  const attempt = useCallback(async (): Promise<SubmissionResult<T> | null> => {
    const current = pending.current;
    if (!current) return null;
    inFlight.current = true;
    try {
      const result = await current.send(current.key);
      pending.current = null;
      setState({ status: 'saved', message: result.message });
      onSuccessRef.current?.(result);
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
  }, []);

  const verify = useCallback(async (): Promise<SubmissionResult<T> | null> => {
    const current = pending.current;
    if (!current || inFlight.current) return null;
    setState({ status: 'verifying', checking: true });
    let found: boolean;
    try {
      inFlight.current = true;
      const status = await apiGet<IdempotencyStatus>(`/idempotency/${current.key}`);
      found = status.status === 'done';
    } catch (error) {
      inFlight.current = false;
      if (isApiError(error) && error.isNetwork) {
        setState({ status: 'verifying' });
        return null;
      }
      setState({ status: 'verifying' });
      return null;
    }
    inFlight.current = false;
    setState({ status: 'verifying', found, checking: true });
    // Kayıt oluşmuşsa aynı anahtar ilk sonucu döndürür; oluşmamışsa güvenle bir kez oluşturur.
    return attempt();
  }, [attempt]);

  const submit = useCallback(
    async (send: Send<T>) => {
      if (pending.current) return verify();
      if (inFlight.current) return null;
      pending.current = { key: newIdempotencyKey(), send };
      setState({ status: 'saving' });
      return attempt();
    },
    [attempt, verify],
  );

  const reset = useCallback(() => {
    if (pending.current) return;
    setState({ status: 'idle' });
  }, []);

  // Doğrulama bekleyen gönderim, bağlantı dönünce ve aralıklarla kendiliğinden yeniden sorulur.
  const verifying = state.status === 'verifying';
  useEffect(() => {
    if (!verifying) return;
    const retry = () => void verify().catch(() => undefined);
    window.addEventListener('online', retry);
    const timer = window.setInterval(retry, VERIFY_INTERVAL_MS);
    return () => {
      window.removeEventListener('online', retry);
      window.clearInterval(timer);
    };
  }, [verifying, verify]);

  return {
    state,
    busy: state.status === 'saving' || state.status === 'verifying',
    submit,
    verify,
    reset,
  };
}
