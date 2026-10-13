import type { ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Liste satırı (şartname 4.4): solda 36 px ikon kutusu, ortada başlık (600) ve tek satır meta,
 * sağda tutar ve gerekirse rozet. Uzun metin üç nokta ile kısalır. `ListRows` içinde kullanılır.
 */
export function ListRow({
  to,
  icon,
  title,
  titleExtra,
  meta,
  side,
}: {
  to: string;
  icon: ReactNode;
  title: ReactNode;
  /** Başlığın yanında rozet (ör. "Başlangıç", "Silindi"). */
  titleExtra?: ReactNode;
  meta?: ReactNode;
  side?: ReactNode;
}) {
  return (
    <li>
      <Link className="list-row" to={to}>
        {icon}
        <span className="list-row__main">
          <span className="list-row__title">
            <span className="list-row__title-text">{title}</span>
            {titleExtra}
          </span>
          {meta ? <span className="list-row__meta block">{meta}</span> : null}
        </span>
        {side ? <span className="list-row__side">{side}</span> : null}
      </Link>
    </li>
  );
}

export function ListRows({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul className="list-rows" aria-label={label}>
      {children}
    </ul>
  );
}
