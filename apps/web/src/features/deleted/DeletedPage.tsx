import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { apiPost } from '../../api/client';
import { invalidateRecords, useDeleted } from '../../api/queries';
import type { DeletedItem, DeletedType } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { ButtonLink, Button, DisabledAction } from '../../components/ui/Button';
import { PageHeader, Pagination } from '../../components/ui/Card';
import { ImpactPreview } from '../../components/ui/ImpactPreview';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDateTime, formatMoney } from '../../lib/format';
import { toast } from '../../stores/ui';

const TABS: { value: DeletedType; label: string; path: string }[] = [
  { value: 'transaction', label: 'İşlemler', path: 'transactions' },
  { value: 'agreement', label: 'Anlaşmalar', path: 'agreements' },
  { value: 'project', label: 'Şantiyeler', path: 'projects' },
  { value: 'party', label: 'Kişiler', path: 'parties' },
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
        subtitle="Silinen kayıtlar normal toplamlara girmez. Geri alınan kaydın etkisi bir kez uygulanır."
      />
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
            {item.label}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="Silinen kayıt yok" />
      ) : (
        <>
          <ul className="item-list">
            {query.data.items.map((item) => (
              <li key={item.id} className="item-card">
                <div className="item-card__main">
                  <span className="item-card__title">{item.label || '—'}</span>
                  <span className="meta">
                    {formatDateTime(item.deletedAt)} ·{' '}
                    {item.deletedBy?.name ?? 'Bilinmeyen kullanıcı'}
                  </span>
                  <span className="meta">Gerekçe: {item.deleteReason || '—'}</span>
                </div>
                <div className="item-card__side">
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
                      Geri al
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!canWrite && closedReason ? (
            <DisabledAction label="Geri al" reason={closedReason} />
          ) : null}
          <Pagination
            page={query.data.page}
            limit={query.data.limit}
            total={query.data.total}
            onPage={(page) => update({ page: String(page) })}
          />
        </>
      )}

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
