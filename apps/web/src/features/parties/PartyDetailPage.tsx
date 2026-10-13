import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Building2,
  Download,
  Ellipsis,
  HandCoins,
  Handshake,
  HardHat,
  History,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from '../../api/client';
import { invalidateRecords, useParty } from '../../api/queries';
import type { PartyDetail, PartyStatement } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Amount, Badge, KindIcon } from '../../components/ui/Amount';
import { ButtonLink, DisabledAction } from '../../components/ui/Button';
import { Metric, PageHeader, Panel } from '../../components/ui/Card';
import { HistoryList } from '../../components/ui/HistoryList';
import { Icon } from '../../components/ui/Icon';
import { ListRow, ListRows } from '../../components/ui/ListRow';
import { Menu } from '../../components/ui/Menu';
import { ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDate, formatMoney } from '../../lib/format';
import { KIND_LABEL, PARTY_KIND_LABEL, PARTY_TAG_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';
import { AgreementTable, BalanceFlags, ScopeText } from '../common/RecordTables';

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
  const { canWrite, reason: closedReason } = useWriteAccess();
  const [dialog, setDialog] = useState<'active' | 'delete' | null>(null);
  const statement = useQuery({
    queryKey: ['parties', 'statement', p.id],
    queryFn: () => apiGet<PartyStatement>(`/parties/${p.id}/statement`),
  });
  const f = p.finance;
  const recordCount = (statement.data?.transactions.length ?? 0) + f.agreements.length;
  const ctx = `kisi=${p.id}`;
  const payable = f.agreements.filter((a) => a.remaining > 0 || a.settlementPending);

  async function togglePin() {
    try {
      await apiPost(`/parties/${p.id}/pin`, { pinned: !p.pinned });
      await invalidateRecords(queryClient);
    } catch (caught) {
      toast(errorMessage(caught));
    }
  }

  const opening = (summary: { totalAmount: number; remaining: number }) =>
    summary.totalAmount > 0
      ? ` Başlangıç kayıtlarının kalanı: ${formatMoney(summary.remaining)}.`
      : '';

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={[PARTY_KIND_LABEL[p.kind], p.phone, p.email].filter(Boolean).join(' · ')}
        back={{ to: '/uygulama/kisiler', label: 'Kişiler' }}
        actions={
          <>
            <Refreshing active={refreshing} />
            {canWrite ? (
              <>
                <ButtonLink variant="secondary" to={`/uygulama/islemler/yeni?tur=gider&${ctx}`}>
                  <Icon icon={ArrowUpRight} />
                  Gider / ödeme ekle
                </ButtonLink>
                <ButtonLink variant="secondary" to={`/uygulama/islemler/yeni?tur=gelir&${ctx}`}>
                  <Icon icon={ArrowDownLeft} />
                  Gelir / tahsilat ekle
                </ButtonLink>
                <ButtonLink variant="secondary" to={`/uygulama/anlasmalar/yeni?${ctx}`}>
                  <Icon icon={Handshake} />
                  Yeni anlaşma
                </ButtonLink>
              </>
            ) : null}
            <Menu
              label="Diğer işlemler"
              buttonClassName="btn btn--secondary"
              buttonContent={
                <>
                  <Icon icon={Ellipsis} />
                  Diğer
                </>
              }
            >
              {(close) => (
                <>
                  {canWrite ? (
                    <>
                      <Link
                        className="dropdown__item"
                        role="menuitem"
                        to={`/uygulama/kisiler/${p.id}/duzenle`}
                        onClick={close}
                      >
                        <Icon icon={Pencil} />
                        Düzenle
                      </Link>
                      <button
                        type="button"
                        className="dropdown__item"
                        role="menuitem"
                        onClick={() => {
                          close();
                          void togglePin();
                        }}
                      >
                        <Icon icon={p.pinned ? PinOff : Pin} />
                        {p.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                      </button>
                      <button
                        type="button"
                        className="dropdown__item"
                        role="menuitem"
                        onClick={() => {
                          close();
                          setDialog('active');
                        }}
                      >
                        <Icon icon={p.isActive ? UserX : UserCheck} />
                        {p.isActive ? 'Pasifleştir' : 'Yeniden aktifleştir'}
                      </button>
                    </>
                  ) : null}
                  <button type="button" className="dropdown__item" role="menuitem" disabled>
                    <Icon icon={Download} />
                    <span>
                      Hesap dökümü indir
                      <small>Rapor ve indirme sonraki sürüm adımında açılacak.</small>
                    </span>
                  </button>
                  {canWrite ? (
                    <>
                      <div className="dropdown__sep" role="separator" />
                      <button
                        type="button"
                        className="dropdown__item dropdown__item--danger"
                        role="menuitem"
                        onClick={() => {
                          close();
                          setDialog('delete');
                        }}
                      >
                        <Icon icon={Trash2} />
                        Sil
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </Menu>
          </>
        }
      />
      {p.tags.length > 0 || p.pinned || !p.isActive ? (
        <span className="status-row">
          {p.tags.map((tag) => (
            <Badge key={tag}>{PARTY_TAG_LABEL[tag]}</Badge>
          ))}
          {p.pinned ? (
            <Badge tone="primary">
              <Icon icon={Pin} />
              Sabit
            </Badge>
          ) : null}
          {!p.isActive ? <Badge tone="danger">Pasif — yeni kayıtta önerilmez</Badge> : null}
        </span>
      ) : null}
      {!canWrite && closedReason ? (
        <DisabledAction label="Değişiklik kapalı" reason={closedReason} />
      ) : null}

      <section className="metrics metrics--4" aria-label="Borç ve alacak">
        <Metric
          label="Kalan borç"
          icon={Wallet}
          tone="primary"
          balance
          value={formatMoney(f.payable.remaining)}
          info={`Ödenecek anlaşmalar ve başlangıç borçları; alacaktan mahsup edilmez.${opening(f.openings.payable)}`}
          sub={<BalanceFlags summary={{ ...f.payable, excess: 0 }} payable />}
        />
        <Metric
          label="Kalan alacak"
          icon={HandCoins}
          tone="primary"
          balance
          value={formatMoney(f.receivable.remaining)}
          info={`Tahsil edilecek anlaşmalar ve başlangıç alacakları; borçtan mahsup edilmez.${opening(f.openings.receivable)}`}
          sub={<BalanceFlags summary={{ ...f.receivable, excess: 0 }} payable={false} />}
        />
        <Metric
          label="Fazla ödeme"
          icon={ArrowUpRight}
          tone="expense"
          balance
          value={formatMoney(f.overpaid)}
          sub={
            f.overpaid > 0 ? (
              <Badge tone="danger">Bedeli aşan ödeme var</Badge>
            ) : (
              'Ödenecek anlaşmalarda aşan tutar yok'
            )
          }
        />
        <Metric
          label="Fazla tahsilat"
          icon={ArrowDownLeft}
          tone="income"
          balance
          value={formatMoney(f.overcollected)}
          sub={
            f.overcollected > 0 ? (
              <Badge tone="danger">Bedeli aşan tahsilat var</Badge>
            ) : (
              'Tahsil edilecek anlaşmalarda aşan tutar yok'
            )
          }
        />
      </section>

      <div className="dash-grid">
        <div className="dash-col">
          <Panel
            title="Anlaşmalar ve başlangıç kayıtları"
            icon={Handshake}
            more={{ to: `/uygulama/anlasmalar?kisi=${p.id}` }}
          >
            {f.agreements.length === 0 ? (
              <p className="list-empty">Bu kişiyle anlaşma yok.</p>
            ) : (
              <>
                <AgreementTable items={f.agreements} compact />
                {canWrite && payable.length > 0 ? (
                  <div className="panel__actions">
                    {payable.map((a) => (
                      <ButtonLink
                        key={a.id}
                        variant="secondary"
                        size="small"
                        to={`/uygulama/anlasmalar/${a.id}/odeme`}
                      >
                        <Icon icon={a.direction === 'payable' ? ArrowUpRight : ArrowDownLeft} />
                        {a.direction === 'payable' ? 'Öde' : 'Tahsil et'}: {a.label}
                      </ButtonLink>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </Panel>

          <Panel
            title="Hareket geçmişi"
            icon={ArrowLeftRight}
            more={{ to: `/uygulama/islemler?kisi=${p.id}&donem=tumu`, label: 'İşlemlerde aç' }}
          >
            <p className="panel__note">
              Anlaşmaya bağlı olmayan doğrudan hareketler: tahsilat{' '}
              {formatMoney(f.directTransactions.netIncome)}, ödeme{' '}
              {formatMoney(f.directTransactions.netExpense)}. Bunlar hiçbir anlaşmanın kalanını
              azaltmaz.
            </p>
            {statement.isPending ? (
              <Loading />
            ) : statement.error || !statement.data ? (
              <div className="panel__body">
                <ErrorState error={statement.error} onRetry={() => void statement.refetch()} />
              </div>
            ) : statement.data.transactions.length === 0 ? (
              <p className="list-empty">Hareket yok.</p>
            ) : (
              <ListRows label="Hareket geçmişi">
                {[...statement.data.transactions].reverse().map((t) => (
                  <ListRow
                    key={t.id}
                    to={`/uygulama/islemler/${t.id}`}
                    icon={<KindIcon kind={t.kind} />}
                    title={t.description || KIND_LABEL[t.kind]}
                    titleExtra={
                      t.notLinkedToAgreement ? <Badge>Anlaşmaya bağlı değil</Badge> : null
                    }
                    meta={
                      <>
                        <span className="record-no">#{t.recordNo}</span> · {formatDate(t.date)} ·{' '}
                        <ScopeText transaction={t} />
                      </>
                    }
                    side={
                      <>
                        <Amount value={t.amount} kind={t.kind} />
                        <span className="list-row__note">{KIND_LABEL[t.kind]}</span>
                      </>
                    }
                  />
                ))}
              </ListRows>
            )}
          </Panel>
        </div>

        <div className="dash-col">
          <Panel title="Bilgiler" icon={p.kind === 'company' ? Building2 : UserRound}>
            <div className="panel__body">
              <dl className="definition-list">
                <dt>Tür</dt>
                <dd>{PARTY_KIND_LABEL[p.kind]}</dd>
                <dt>Telefon</dt>
                <dd>{p.phone || <span className="muted">—</span>}</dd>
                <dt>E-posta</dt>
                <dd>{p.email || <span className="muted">—</span>}</dd>
                <dt>Adres</dt>
                <dd>{p.address || <span className="muted">—</span>}</dd>
                <dt>Not</dt>
                <dd>{p.note || <span className="muted">—</span>}</dd>
              </dl>
            </div>
          </Panel>

          {f.byScope.length > 0 ? (
            <Panel title="Şantiye ve firma geneli dağılımı" icon={HardHat}>
              <div className="table-wrap">
                <table className="data-table data-table--static">
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
                          <span className="amount amount--neutral">
                            {formatMoney(row.payable.remaining)}
                          </span>
                        </td>
                        <td className="num">
                          <span className="amount amount--neutral">
                            {formatMoney(row.receivable.remaining)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}

          <Panel title="Değişiklik geçmişi" icon={History}>
            <div className="panel__body">
              <HistoryList history={p.history ?? []} />
            </div>
          </Panel>
        </div>
      </div>

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
