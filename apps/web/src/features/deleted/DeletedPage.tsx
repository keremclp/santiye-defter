import { useQueryClient } from '@tanstack/react-query';
import {
  ArchiveRestore,
  ArrowLeftRight,
  Handshake,
  HardHat,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { apiPost } from '../../api/client';
import { invalidateRecords, useDeleted } from '../../api/queries';
import type { DeletedItem, DeletedType } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { ButtonLink, Button, DisabledAction } from '../../components/ui/Button';
import { PageHeader, Pagination, Panel } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { ImpactPreview } from '../../components/ui/ImpactPreview';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDateTime, formatMoney } from '../../lib/format';
import { toast } from '../../stores/ui';

const TABS: { value: DeletedType; label: string; path: string; icon: LucideIcon }[] = [
  { value: 'transaction', label: 'İşlemler', path: 'transactions', icon: ArrowLeftRight },
  { value: 'agreement', label: 'Anlaşmalar', path: 'agreements', icon: Handshake },
  { value: 'project', label: 'Şantiyeler', path: 'projects', icon: HardHat },
  { value: 'party', label: 'Kişiler', path: 'parties', icon: Users },
];

/**
 * Silinenler (şartname 7.9): silen kişi, zaman ve gerekçe. Geri alma güncel ilişkileri doğrular;
 * geçersizse sessizce düzeltilmez, neden ve çözüm yolu gösterilir. Kalıcı silme sunulmaz.
 */
export function DeletedPage() {
  usePageMeta('Silinenler');
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const { values: f, update } = useUrlFilters({ tur: 'transaction', page: '1' });
  const type = (TABS.some((t) => t.value === f.tur) ? f.tur : 'transaction') as DeletedType;
  const query = useDeleted(type, Number(f.page) || 1);
  const [restoring, setRestoring] = useState<DeletedItem | null>(null);
  const tab = TABS.find((t) => t.value === type)!;

  return (
    <main className="page">
      <PageHeader
        title="Silinenler"
        subtitle="Silinen kayıtlar normal toplamlara girmez · geri alınan kaydın etkisi bir kez uygulanır"
      />
      {!canWrite && closedReason ? <DisabledAction label="Geri al" reason={closedReason} /> : null}
      <Panel label="Silinen kayıtlar">
        <div className="tabs" role="tablist" aria-label="Kayıt türü">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              className="tab"
              aria-selected={item.value === type}
              onClick={() => update({ tur: item.value })}
            >
              <Icon icon={item.icon} />
              {item.label}
            </button>
          ))}
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.error || !query.data ? (
          <div className="panel__body">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : query.data.items.length === 0 ? (
          <EmptyState title="Silinen kayıt yok" />
        ) : (
          <ul className="list-rows">
            {query.data.items.map((item) => (
              <li key={item.id}>
                <div className="list-row list-row--static">
                  <span className="icon-box icon-box--lg icon-box--neutral">
                    <Icon icon={tab.icon} />
                  </span>
                  <span className="list-row__main">
                    <span className="list-row__title">
                      <span className="list-row__title-text">{item.label || '—'}</span>
                    </span>
                    <span className="list-row__meta block">
                      {formatDateTime(item.deletedAt)} ·{' '}
                      {item.deletedBy?.name ?? 'Bilinmeyen kullanıcı'}
                    </span>
                    <span className="list-row__meta block">
                      Gerekçe: {item.deleteReason || '—'}
                    </span>
                  </span>
                  <span className="list-row__side">
                    {item.amount !== null ? (
                      <span className="amount amount--neutral">{formatMoney(item.amount)}</span>
                    ) : null}
                    {!canWrite ? null : type === 'transaction' ? (
                      <ButtonLink
                        variant="secondary"
                        size="small"
                        to={`/uygulama/islemler/${item.id}`}
                      >
                        İncele ve geri al
                      </ButtonLink>
                    ) : (
                      <Button variant="secondary" size="small" onClick={() => setRestoring(item)}>
                        <Icon icon={ArchiveRestore} />
                        Geri al
                      </Button>
                    )}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {query.data ? (
        <Pagination
          page={query.data.page}
          limit={query.data.limit}
          total={query.data.total}
          onPage={(page) => update({ page: String(page) })}
        />
      ) : null}

      <ActionDialog
        open={restoring !== null}
        title={`${restoring?.label ?? ''} — geri al`}
        onClose={() => setRestoring(null)}
        confirmLabel="Geri al"
        onConflict={() => query.refetch()}
        onConfirm={async (reason) => {
          if (!restoring) return;
          await apiPost(`/${tab.path}/${restoring.id}/restore`, {
            reason,
            expectedUpdatedAt: restoring.updatedAt,
          });
          await invalidateRecords(queryClient);
          setRestoring(null);
          toast('Kayıt geri alındı.');
        }}
      >
        {type === 'agreement' && restoring?.amount !== null && restoring ? (
          <ImpactPreview
            groups={[
              {
                rows: [
                  {
                    label: 'Firmanın açık borç/alacak toplamına eklenecek kalan',
                    before: 0,
                    after: restoring.amount,
                  },
                ],
              },
            ]}
            note="Anlaşma yalnız bağlı hareketi yokken silinebildiği için geri alınınca kalanı bedelinin tamamıdır. Gelir/gider değişmez."
          />
        ) : (
          <p className="meta">
            Bu kaydı geri almak gelir, gider veya kalan toplamlarını değiştirmez.
          </p>
        )}
        <p className="meta">
          Güncel ilişkiler sunucuda doğrulanır. Bağlı şantiye veya kişi silinmişse önce onları geri
          alın.
        </p>
        {type === 'agreement' && restoring ? (
          <p className="meta">
            Geri alınca <Link to={`/uygulama/anlasmalar/${restoring.id}`}>anlaşma detayında</Link>{' '}
            görünür.
          </p>
        ) : null}
      </ActionDialog>
    </main>
  );
}
