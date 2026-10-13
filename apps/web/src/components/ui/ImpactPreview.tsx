import { ArrowRightLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatMoney } from '../../lib/format';
import { Icon } from './Icon';

export interface ImpactRow {
  label: ReactNode;
  /** Kuruş; null gösterilmez ("—"). */
  before: number | null;
  after: number | null;
  /** Para dışı değer (ör. tarih, durum) gösterimi. */
  format?: (value: number | null) => ReactNode;
}

export interface ImpactGroup {
  title?: ReactNode;
  rows: ImpactRow[];
}

/**
 * Etki önizlemesi (şartname 4.4): bedel değişikliği, iptal, iade, silme, geri yükleme ve düzeltme
 * öncesinde etkilenen kalan, fazla ve toplamların "önce → sonra" hali.
 */
export function ImpactPreview({
  title = 'Etki önizlemesi',
  groups,
  note,
}: {
  title?: ReactNode;
  groups: ImpactGroup[];
  note?: ReactNode;
}) {
  const show = (row: ImpactRow, value: number | null) =>
    row.format ? row.format(value) : value === null ? '—' : formatMoney(value);

  return (
    <section className="impact" aria-label="Etki önizlemesi">
      <p className="impact__title">
        <Icon icon={ArrowRightLeft} />
        {title}
      </p>
      <table className="impact__table">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Kalem</span>
            </th>
            <td>Önce</td>
            <td aria-hidden="true">→</td>
            <td>Sonra</td>
          </tr>
        </thead>
        {groups.map((group, groupIndex) => (
          <tbody key={groupIndex}>
            {group.title ? (
              <tr className="impact__group">
                <th colSpan={4}>{group.title}</th>
              </tr>
            ) : null}
            {group.rows.map((row, index) => {
              const changed = row.before !== row.after;
              return (
                <tr key={index} className={changed ? 'impact__changed' : undefined}>
                  <th scope="row">{row.label}</th>
                  <td>{show(row, row.before)}</td>
                  <td aria-hidden="true">→</td>
                  <td>
                    {show(row, row.after)}
                    {changed ? <span className="visually-hidden"> (değişiyor)</span> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
      {note ? <p className="meta">{note}</p> : null}
    </section>
  );
}
