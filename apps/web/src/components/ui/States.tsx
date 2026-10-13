import type { ReactNode } from 'react';
import { errorMessage, isApiError } from '../../api/client';
import { Button } from './Button';

/** Boş durum: başlık, kısa açıklama, varsa eylem; ortalı (şartname 4.4). */
export function EmptyState({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {description ? <p className="muted">{description}</p> : null}
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  );
}

/** Yükleniyor; tutar yerine "0 TL" gösterilmez. */
export function Loading({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Okuma hatası; "Yeniden dene" yalnız okumayı tekrarlar. Erişilemeyen kayıt genel mesajla. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const notFound = isApiError(error) && error.code === 'NOT_FOUND';
  return (
    <div className="alert alert--danger" role="alert">
      <p className="alert__title">
        {notFound ? 'Bu kayda erişilemiyor.' : 'Bilgiler yüklenemedi.'}
      </p>
      {notFound ? null : <p>{errorMessage(error)}</p>}
      {onRetry && !notFound ? (
        <div>
          <Button variant="secondary" size="small" onClick={onRetry}>
            Yeniden dene
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** Eski veri gösterilirken yenileme sürüyorsa "Güncelleniyor" (şartname 11). */
export function Refreshing({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="meta" role="status">
      Güncelleniyor…
    </span>
  );
}

/** Sorgu durumu: yükleniyor / hata / veri. */
export function QueryView<T>({
  query,
  children,
  loadingLabel,
}: {
  query: { data: T | undefined; error: unknown; isPending: boolean; refetch: () => unknown };
  children: (data: T) => ReactNode;
  loadingLabel?: string;
}) {
  if (query.isPending) return <Loading label={loadingLabel} />;
  if (query.error || query.data === undefined) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}
