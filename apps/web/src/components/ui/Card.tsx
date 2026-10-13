import type { ReactNode } from 'react';
import { Link } from 'react-router';

/** Kart: beyaz, radius md, kenar border, iç boşluk md (şartname 4.4). */
export function Card({
  title,
  actions,
  children,
  className,
  as: Tag = 'section',
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag className={['card', className].filter(Boolean).join(' ')}>
      {title || actions ? (
        <div className="card__header">
          {title ? <h2>{title}</h2> : <span />}
          {actions ? <div className="row">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </Tag>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="page__header">
      <div className="page__titles">
        {back ? (
          <Link className="page__back" to={back.to}>
            ← {back.label}
          </Link>
        ) : null}
        <h1>{title}</h1>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page__actions">{actions}</div> : null}
    </header>
  );
}

export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(Math.ceil(total / limit), 1);
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Sayfalar">
      <button
        type="button"
        className="btn btn--secondary btn--small"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Önceki
      </button>
      <span className="meta">
        Sayfa {page} / {pages}
      </span>
      <button
        type="button"
        className="btn btn--secondary btn--small"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Sonraki
      </button>
    </nav>
  );
}

/** Belge alanı yer tutucusu; yükleme Adım 5'te bağlanır. */
export function DocumentPlaceholder({
  count,
  titled = true,
}: {
  count?: number;
  titled?: boolean;
}) {
  return (
    <div className="document-placeholder">
      {titled ? <strong>Belgeler</strong> : null}
      <p>
        {count
          ? `${count} belge kayıtlı. Belge görüntüleme yakında bu alanda olacak.`
          : 'Belge ekleme yakında bu alanda olacak. Kaydı belgesiz kaydedebilirsiniz.'}
      </p>
    </div>
  );
}
