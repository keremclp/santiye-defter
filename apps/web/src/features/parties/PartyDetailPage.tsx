import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from '../../api/client';
import { invalidateRecords, useParty } from '../../api/queries';
import type { PartyDetail, PartyStatement } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Amount, Badge, KindBadge } from '../../components/ui/Amount';
import { Button, ButtonLink, DisabledAction } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { HistoryList } from '../../components/ui/HistoryList';
import { ErrorState, Loading, QueryView, Refreshing } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDate, formatMoney } from '../../lib/format';
import { PARTY_KIND_LABEL, PARTY_TAG_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';
import { AgreementTable, ScopeText } from '../common/RecordTables';

export function PartyDetailPage() {
  const { id } = useParams();
  const query = useParty(id);
  usePageMeta(query.data?.name ?? 'Kişi');
  return (
    <main className="page">
      {query.isPending ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <PartyView
          party={query.data}
          refreshing={query.isFetching}
          reload={() => query.refetch()}
        />
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone?: 'income' | 'expense';
  hint?: string;
}) {
  return (
    <div className={tone ? `stat stat--${tone}` : 'stat'}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{formatMoney(value)}</span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </div>
  );
}

/** Kişi detayı (şartname 7.3): borç ve alacak ayrı, netleştirilmez; doğrudan hareketler işaretli. */
function PartyView({
  party: p,
  refreshing,
  reload,
}: {
  party: PartyDetail;
  refreshing: boolean;
  reload: () => unknown;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const phone = usePhone();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const [dialog, setDialog] = useState<'active' | 'delete' | null>(null);
  const statement = useQuery({
    queryKey: ['parties', 'statement', p.id],
    queryFn: () => apiGet<PartyStatement>(`/parties/${p.id}/statement`),
  });
  const f = p.finance;
  const recordCount = (statement.data?.transactions.length ?? 0) + f.agreements.length;
  const ctx = `kisi=${p.id}`;

  async function togglePin() {
    try {
      await apiPost(`/parties/${p.id}/pin`, { pinned: !p.pinned });
      await invalidateRecords(queryClient);
    } catch (caught) {
      toast(errorMessage(caught));
    }
  }

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={[PARTY_KIND_LABEL[p.kind], p.phone, p.email].filter(Boolean).join(' · ')}
        back={{ to: '/uygulama/kisiler', label: 'Kişiler' }}
        actions={<Refreshing active={refreshing} />}
      />
      <span className="row">
        {p.tags.map((tag) => (
          <Badge key={tag}>{PARTY_TAG_LABEL[tag]}</Badge>
        ))}
        {p.pinned ? <Badge tone="primary">Sabit</Badge> : null}
        {!p.isActive ? <Badge tone="danger">Pasif — yeni kayıtta önerilmez</Badge> : null}
      </span>

      <section className="grid" aria-label="Borç ve alacak">
        <Stat
          label="Kalan borç"
          tone="expense"
          value={f.payable.remaining}
          hint={
            f.openings.payable.totalAmount > 0
              ? `Başlangıç kalanı ${formatMoney(f.openings.payable.remaining)}`
              : undefined
          }
        />
        <Stat
          label="Kalan alacak"
          tone="income"
          value={f.receivable.remaining}
          hint={
            f.openings.receivable.totalAmount > 0
              ? `Başlangıç kalanı ${formatMoney(f.openings.receivable.remaining)}`
              : undefined
          }
        />
        <Stat label="Fazla ödeme" value={f.overpaid} />
        <Stat label="Fazla tahsilat" value={f.overcollected} />
      </section>
      <p className="meta">Borç ve alacak ayrı gösterilir; birbirinden otomatik mahsup edilmez.</p>

      <div className="page__actions">
        {!canWrite ? (
          <DisabledAction label="Değişiklik kapalı" reason={closedReason ?? ''} />
        ) : (
          <>
            <ButtonLink variant="expense" to={`/uygulama/islemler/yeni?tur=gider&${ctx}`}>
              Gider / ödeme ekle
            </ButtonLink>
            <ButtonLink variant="income" to={`/uygulama/islemler/yeni?tur=gelir&${ctx}`}>
              Gelir / tahsilat ekle
            </ButtonLink>
            <ButtonLink variant="secondary" to={`/uygulama/anlasmalar/yeni?${ctx}`}>
              Yeni anlaşma
            </ButtonLink>
            <ButtonLink variant="ghost" to={`/uygulama/kisiler/${p.id}/duzenle`}>
              Düzenle
            </ButtonLink>
            <Button variant="ghost" onClick={() => void togglePin()}>
              {p.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
            </Button>
            <Button variant="secondary" onClick={() => setDialog('active')}>
              {p.isActive ? 'Pasifleştir' : 'Yeniden aktifleştir'}
            </Button>
            <Button variant="danger" onClick={() => setDialog('delete')}>
              Sil
            </Button>
          </>
        )}
        <DisabledAction
          label="Hesap dökümü indir"
          reason="Rapor ve indirme sonraki sürüm adımında açılacak."
        />
      </div>

      {f.byScope.length > 0 ? (
        <Card title="Şantiye ve firma geneli dağılımı">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Kapsam</th>
                <th scope="col" className="num">
                  Kalan borç
                </th>
                <th scope="col" className="num">
                  Kalan alacak
                </th>
              </tr>
            </thead>
            <tbody>
              {f.byScope.map((row, index) => (
                <tr key={row.project?.id ?? `company-${index}`}>
                  <td>{row.scope === 'company' ? 'Firma geneli' : row.project?.name}</td>
                  <td className="num">
                    <Amount value={row.payable.remaining} tone="expense" />
                  </td>
                  <td className="num">
                    <Amount value={row.receivable.remaining} tone="income" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Card title="Anlaşmalar ve başlangıç kayıtları">
        {f.agreements.length === 0 ? (
          <p className="muted">Bu kişiyle anlaşma yok.</p>
        ) : (
          <>
            <AgreementTable items={f.agreements} />
            {canWrite ? (
              <ul className="row plain-list">
                {f.agreements
                  .filter((a) => a.remaining > 0 || a.settlementPending)
                  .map((a) => (
                    <li key={a.id}>
                      <ButtonLink
                        variant="secondary"
                        size="small"
                        to={`/uygulama/anlasmalar/${a.id}/odeme`}
                      >
                        {a.direction === 'payable' ? 'Öde' : 'Tahsil et'}: {a.label}
                      </ButtonLink>
                    </li>
                  ))}
              </ul>
            ) : null}
          </>
        )}
      </Card>

      <Card title="Hareket geçmişi">
        <p className="meta">
          Anlaşmaya bağlanmamış doğrudan hareketler: tahsilat{' '}
          {formatMoney(f.directTransactions.netIncome)}, ödeme{' '}
          {formatMoney(f.directTransactions.netExpense)}. Bunlar hiçbir anlaşmanın kalanını
          azaltmaz.
        </p>
        <QueryView query={statement}>
          {(data) =>
            data.transactions.length === 0 ? (
              <p className="muted">Hareket yok.</p>
            ) : (
              <ul className="item-list">
                {[...data.transactions].reverse().map((t) => (
                  <li key={t.id}>
                    <Link className="item-card" to={`/uygulama/islemler/${t.id}`}>
                      <div className="item-card__main">
                        <span className="item-card__title">
                          #{t.recordNo} {t.description}
                        </span>
                        <span className="meta">
                          {formatDate(t.date)} · <ScopeText transaction={t} />
                        </span>
                        <span className="row">
                          <KindBadge kind={t.kind} />
                          {t.notLinkedToAgreement ? (
                            <Badge tone="cyan">Anlaşmaya bağlı değil</Badge>
                          ) : null}
                        </span>
                      </div>
                      <Amount value={t.amount} kind={t.kind} />
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryView>
        {phone ? null : <p className="meta">Liste işlem tarihine göre yeniden eskiye.</p>}
      </Card>

      {p.address || p.note ? (
        <Card title="İletişim ve not">
          <dl className="definition-list">
            {p.address ? (
              <>
                <dt>Adres</dt>
                <dd>{p.address}</dd>
              </>
            ) : null}
            {p.note ? (
              <>
                <dt>Not</dt>
                <dd>{p.note}</dd>
              </>
            ) : null}
          </dl>
        </Card>
      ) : null}

      <Card title="Değişiklik geçmişi">
        <HistoryList history={p.history ?? []} />
      </Card>

      <ActionDialog
        open={dialog === 'active'}
        title={p.isActive ? 'Kişiyi pasifleştir' : 'Kişiyi yeniden aktifleştir'}
        onClose={() => setDialog(null)}
        confirmLabel={p.isActive ? 'Pasifleştir' : 'Aktifleştir'}
        reason="none"
        onConflict={reload}
        onConfirm={async () => {
          await apiPatch(`/parties/${p.id}`, {
            isActive: !p.isActive,
            expectedUpdatedAt: p.updatedAt,
          });
          await invalidateRecords(queryClient);
          setDialog(null);
          toast(p.isActive ? 'Kişi pasifleştirildi.' : 'Kişi yeniden aktif.');
        }}
      >
        <p>
          {p.isActive
            ? 'Pasif kişi yeni kayıtta önerilmez; geçmiş kayıtları ve bakiyeleri görünmeye devam eder.'
            : 'Kişi yeni kayıtlarda yeniden önerilir.'}
        </p>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'delete'}
        title="Kişiyi sil"
        onClose={() => setDialog(null)}
        confirmLabel="Sil"
        confirmVariant="danger"
        onConflict={reload}
        confirmDisabled={statement.isPending}
        blockedReason={
          recordCount > 0 ? 'Bu kişinin kayıtları var; silmek yerine pasifleştirin.' : null
        }
        onConfirm={async (reason) => {
          await apiDelete(`/parties/${p.id}`, { reason, expectedUpdatedAt: p.updatedAt });
          await invalidateRecords(queryClient);
          toast('Kişi silindi. Silinenlerden geri alınabilir.');
          await navigate('/uygulama/kisiler', { replace: true });
        }}
      >
        <p>
          Yalnız hiç kaydı olmayan kişi silinebilir (silinmiş ama geri alınabilir kayıtlar dahil).
          Toplamlar değişmez.
        </p>
      </ActionDialog>
    </>
  );
}
