import { ArrowRightLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DeletionStatus } from '../../api/admin-types';
import type { ServiceState } from '../../api/types';
import { Badge, type BadgeTone } from '../../components/ui/Amount';
import { Icon } from '../../components/ui/Icon';
import { DELETION_STATUS_LABEL, PLATFORM_STATE_LABEL } from '../../lib/admin-labels';
import { formatBytes } from '../../lib/format';
import { usagePercent } from './admin-utils';

const STATE_TONE: Record<ServiceState, BadgeTone> = {
  active: 'income',
  suspended: 'warn',
  view_only: 'upcoming',
  archived: 'neutral',
  deletion_pending: 'danger',
  deleting: 'warn',
};

/** Hizmet durumu; kalıcı silmesi başlamış firmada silme durumu gösterilir. */
export function CompanyStateBadge({
  state,
  deletionStatus,
}: {
  state: ServiceState;
  deletionStatus: DeletionStatus;
}) {
  if (deletionStatus !== 'none') {
    const tone: BadgeTone =
      deletionStatus === 'failed' ? 'danger' : deletionStatus === 'done' ? 'neutral' : 'warn';
    return <Badge tone={tone}>{DELETION_STATUS_LABEL[deletionStatus]}</Badge>;
  }
  return <Badge tone={STATE_TONE[state]}>{PLATFORM_STATE_LABEL[state]}</Badge>;
}

export function StorageText({ used, quota }: { used: number; quota: number }) {
  return (
    <>
      {formatBytes(used)} / {formatBytes(quota)}{' '}
      <span className="muted">(%{usagePercent(used, quota)})</span>
    </>
  );
}

/** "Önce → sonra" kutusu; tarih ve durum gibi metin değerler için (şartname 4.4). */
export function ChangePreview({
  title,
  rows,
  note,
}: {
  title: string;
  rows: { label: string; before: ReactNode; after: ReactNode; changed?: boolean }[];
  note?: ReactNode;
}) {
  return (
    <section className="impact" aria-label={title}>
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
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className={row.changed === false ? undefined : 'impact__changed'}>
              <th scope="row">{row.label}</th>
              <td>{row.before}</td>
              <td aria-hidden="true">→</td>
              <td>{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note ? <p className="meta">{note}</p> : null}
    </section>
  );
}
