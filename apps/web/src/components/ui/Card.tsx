import { ChevronLeft, ChevronRight, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';

/** Kart: beyaz, radius 14, kenar border, hafif gölge (şartname 4.4). */
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

/**
 * Panel: başlıkta solda ikon + başlık, sağda "Tümü ›" bağlantısı. İçindeki listeler ince çizgiyle
 * ayrılmış satırlardır; kart içinde kart yok (şartname 4.4).
 */
export function Panel({
  title,
  icon,
  more,
  actions,
  children,
  className,
  label,
}: {
  title?: ReactNode;
  icon?: LucideIcon;
  more?: { to: string; label?: string };
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Başlıksız panelin erişilebilir adı. */
  label?: string;
}) {
  return (
    <section className={['panel', className].filter(Boolean).join(' ')} aria-label={label}>
      {title || more || actions ? (
        <div className="panel__head">
          {title ? (
            <h2 className="panel__title">
              {icon ? <Icon icon={icon} /> : null}
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions}
          {more ? (
            <Link className="panel__more" to={more.to}>
              {more.label ?? 'Tümü'}
              <Icon icon={ChevronRight} />
            </Link>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Özet kutusu: etiket + renkli ikon kutusu, büyük rakam, tek satır alt bilgi (şartname 4.4).
 * Yüklenirken rakam yerine "0 TL" gösterilmez; çağıran `value` yerine yükleniyor gösterir.
 */
export function Metric({
  label,
  icon,
  tone,
  value,
  valueClassName,
  sub,
  info,
  balance = false,
  className,
}: {
  label: string;
  icon: LucideIcon;
  tone: 'income' | 'expense' | 'primary' | 'neutral';
  value: ReactNode;
  valueClassName?: string;
  sub?: ReactNode;
  /** Ayrıntı ipucu (ek gri satır yerine bilgi ikonu, şartname 4.2). */
  info?: string;
  balance?: boolean;
  className?: string;
}) {
  return (
    <div
      className={['panel metric', balance ? 'metric--balance' : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="metric__label">
        <span className={`icon-box icon-box--${tone}`}>
          <Icon icon={icon} />
        </span>
        {label}
        {info ? (
          <span className="metric__info" title={info} role="img" aria-label={info}>
            <Icon icon={Info} />
          </span>
        ) : null}
      </div>
      <div className={['metric__value', valueClassName].filter(Boolean).join(' ')}>{value}</div>
      <div className="metric__sub">{sub}</div>
    </div>
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
            <Icon icon={ChevronLeft} />
            {back.label}
          </Link>
        ) : null}
        <h1>{title}</h1>
        {subtitle ? <p className="page__subtitle">{subtitle}</p> : null}
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
