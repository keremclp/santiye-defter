import { todayInIstanbul } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  CircleCheck,
  Ellipsis,
  FileText,
  HandCoins,
  Handshake,
  History,
  Info,
  Pencil,
  Pin,
  RotateCcw,
  Scale,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiDelete, apiPost } from '../../api/client';
import {
  invalidateRecords,
  useAgreements,
  useProject,
  useProjectSummary,
  useTransactions,
} from '../../api/queries';
import type { Project, ProjectSummary } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Badge } from '../../components/ui/Amount';
import { ButtonLink, DisabledAction } from '../../components/ui/Button';
import { Metric, PageHeader, Panel } from '../../components/ui/Card';
import { DateInput, Field } from '../../components/ui/Field';
import { HistoryList } from '../../components/ui/HistoryList';
import { Icon } from '../../components/ui/Icon';
import { Menu } from '../../components/ui/Menu';
import { ErrorState, Loading, QueryView, Refreshing } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDate, formatDateTime, formatMoney, formatSigned, formatTl } from '../../lib/format';
import { PROJECT_STATUS_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';
import {
  AgreementTable,
  BalanceFlags,
  DirectionIcon,
  TransactionTable,
} from '../common/RecordTables';

type DialogName = 'complete' | 'reactivate' | 'archive' | 'delete' | null;

export function ProjectDetailPage() {
  const { id } = useParams();
  const query = useProject(id);
  usePageMeta(query.data?.name ?? 'Şantiye');
  return (
    <main className="page">
      {query.isPending ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <ProjectView
          project={query.data}
          refreshing={query.isFetching}
          reload={() => query.refetch()}
        />
      )}
    </main>
  );
}

const BALANCE_INFO = 'Anlaşmalar ve başlangıç kayıtları birlikte; dönemden bağımsız güncel bakiye.';

/**
 * Şantiye özet kutuları (şartname 7.2, 4.4): beyaz kart, renk yalnız rakamda; bakiyeler `ink`.
 * Detayda tutarlar kuruşludur.
 */
function SummaryMetrics({ summary }: { summary: ProjectSummary }) {
  const { cash, payable, receivable } = summary;
  return (
    <section className="metrics" aria-label="Şantiye özeti">
      <Metric
        label="Tahsilat"
        icon={ArrowDownLeft}
        tone="income"
        value={formatMoney(cash.netIncome)}
        valueClassName="amount--income"
        sub={
          cash.incomeRefund > 0
            ? `Tahsilat iadesi düşüldü: ${formatMoney(cash.incomeRefund)}`
            : 'Tüm zamanlar'
        }
        info="Tahsilatlar − tahsilat iadeleri."
      />
      <Metric
        label="Ödeme"
        icon={ArrowUpRight}
        tone="expense"
        value={formatMoney(cash.netExpense)}
        valueClassName="amount--expense"
        sub={
          cash.expenseRefund > 0
            ? `Ödeme iadesi düşüldü: ${formatMoney(cash.expenseRefund)}`
            : 'Tüm zamanlar'
        }
        info="Ödemeler − ödeme iadeleri."
      />
      <Metric
        label="Gelir − gider farkı"
        icon={Scale}
        tone="neutral"
        className="metric--wide"
        value={formatSigned(cash.difference)}
        sub="Tüm zamanlar"
      />
      <Metric
        label="Kalan alacak"
        icon={HandCoins}
        tone="primary"
        balance
        value={formatMoney(receivable.remaining)}
        info={BALANCE_INFO}
        sub={<BalanceFlags summary={receivable} payable={false} />}
      />
      <Metric
        label="Kalan borç"
        icon={Wallet}
        tone="primary"
        balance
        value={formatMoney(payable.remaining)}
        info={BALANCE_INFO}
        sub={<BalanceFlags summary={payable} payable />}
      />
    </section>
  );
}

/** Ödenecek ve tahsil edilecek anlaşma dökümü: toplam, ödenen, kalan, fazla, başlangıç kalanı. */
function ObligationBreakdown({ summary }: { summary: ProjectSummary }) {
  const phone = usePhone();
  const rows = [
    {
      key: 'payable',
      label: 'Ödenecek',
      settled: 'Ödenen',
      data: summary.payable,
      opening: summary.openings.payable,
    },
    {
      key: 'receivable',
      label: 'Tahsil edilecek',
      settled: 'Tahsil edilen',
      data: summary.receivable,
      opening: summary.openings.receivable,
    },
  ];
  if (phone) {
    return (
      <ul className="card-list">
        {rows.map((row) => (
          <li key={row.key}>
            <div className="card-list__item">
              <span className="list-row__main">
                <span className="list-row__title">{row.label}</span>
                <span className="list-row__meta block">
                  Toplam {formatMoney(row.data.totalAmount)} ·{' '}
                  {row.settled.toLocaleLowerCase('tr-TR')} {formatMoney(row.data.netSettled)}
                </span>
              </span>
              <span className="list-row__side">
                <span className="amount amount--neutral">{formatMoney(row.data.remaining)}</span>
                <span className="list-row__note">Kalan</span>
              </span>
              {row.data.excess > 0 || row.opening.totalAmount > 0 ? (
                <span className="card-list__extra">
                  {row.opening.totalAmount > 0
                    ? `Başlangıç kalanı ${formatMoney(row.opening.remaining)} dahil`
                    : null}
                  {row.data.excess > 0 ? (
                    <span className="text-danger"> Fazla {formatMoney(row.data.excess)}</span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data-table data-table--static">
        <thead>
          <tr>
            <th scope="col">Yön</th>
            <th scope="col" className="num">
              Anlaşma toplamı
            </th>
            <th scope="col" className="num">
              Ödenen / tahsil edilen
            </th>
            <th scope="col" className="num">
              Kalan
            </th>
            <th scope="col" className="num">
              Fazla
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>
                <div className="type-cell">
                  <DirectionIcon
                    agreement={{ direction: row.key === 'payable' ? 'payable' : 'receivable' }}
                    size="md"
                  />
                  <div>
                    <span className="list-row__title">{row.label}</span>
                    {row.opening.totalAmount > 0 ? (
                      <span className="cell-sub">
                        Başlangıç kalanı {formatMoney(row.opening.remaining)} dahil
                      </span>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="num">{formatMoney(row.data.totalAmount)}</td>
              <td className="num">{formatMoney(row.data.netSettled)}</td>
              <td className="num">
                <span className="amount amount--neutral">{formatMoney(row.data.remaining)}</span>
              </td>
              <td className="num">
                {row.data.excess > 0 ? (
                  <span className="text-danger">{formatMoney(row.data.excess)}</span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectView({
  project: p,
  refreshing,
  reload,
}: {
  project: Project;
  refreshing: boolean;
  reload: () => unknown;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [completedAt, setCompletedAt] = useState(todayInIstanbul());
  const summary = useProjectSummary(p.id);
  const transactions = useTransactions({ projectId: p.id, kind: 'all', limit: 5 });
  const agreements = useAgreements({ projectId: p.id, limit: 100 });
  const openAgreements = (agreements.data?.items ?? []).filter((a) => a.remaining > 0);
  const dues = openAgreements.filter((a) => a.dueState === 'overdue' || a.dueState === 'upcoming');
  const hasRecords = (transactions.data?.total ?? 0) + (agreements.data?.total ?? 0) > 0;
  const active = p.status === 'active';
  const close = () => setDialog(null);
  const done = async (message: string) => {
    await invalidateRecords(queryClient);
    setDialog(null);
    toast(message);
  };
  const ctx = `proje=${p.id}`;

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={
          <>
            {p.address ? `${p.address} · ` : ''}
            {p.startDate ? `Başlangıç ${formatDate(p.startDate)}` : 'Başlangıç tarihi girilmedi'}
            {p.completedAt ? ` · Tamamlanma ${formatDate(p.completedAt)}` : ''}
          </>
        }
        back={{ to: '/uygulama/projeler', label: 'Şantiyeler' }}
        actions={
          <>
            <Refreshing active={refreshing} />
            {canWrite ? (
              <>
                <ButtonLink variant="secondary" to={`/uygulama/islemler/yeni?tur=gelir&${ctx}`}>
                  <Icon icon={ArrowDownLeft} />
                  Gelir ekle
                </ButtonLink>
                <ButtonLink variant="secondary" to={`/uygulama/islemler/yeni?tur=gider&${ctx}`}>
                  <Icon icon={ArrowUpRight} />
                  Gider ekle
                </ButtonLink>
                {active ? (
                  <ButtonLink variant="secondary" to={`/uygulama/anlasmalar/yeni?${ctx}`}>
                    <Icon icon={Handshake} />
                    Anlaşma ekle
                  </ButtonLink>
                ) : null}
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
              {(close) => {
                const open = (name: DialogName) => () => {
                  close();
                  setDialog(name);
                };
                return (
                  <>
                    <Link
                      className="dropdown__item"
                      role="menuitem"
                      to={`/uygulama/projeler/${p.id}/rapor`}
                      onClick={close}
                    >
                      <Icon icon={FileText} />
                      Şantiye raporu
                    </Link>
                    {canWrite ? (
                      <>
                        <Link
                          className="dropdown__item"
                          role="menuitem"
                          to={`/uygulama/projeler/${p.id}/duzenle`}
                          onClick={close}
                        >
                          <Icon icon={Pencil} />
                          Düzenle
                        </Link>
                        {active ? (
                          <button
                            type="button"
                            className="dropdown__item"
                            role="menuitem"
                            onClick={open('complete')}
                          >
                            <Icon icon={CircleCheck} />
                            Tamamla
                          </button>
                        ) : null}
                        {p.status === 'completed' ? (
                          <button
                            type="button"
                            className="dropdown__item"
                            role="menuitem"
                            onClick={open('reactivate')}
                          >
                            <Icon icon={RotateCcw} />
                            Yeniden aktifleştir
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="dropdown__item"
                          role="menuitem"
                          onClick={open('archive')}
                        >
                          <Icon icon={p.status === 'archived' ? ArchiveRestore : Archive} />
                          {p.status === 'archived' ? 'Arşivden çıkar' : 'Arşivle'}
                        </button>
                        <div className="dropdown__sep" role="separator" />
                        <button
                          type="button"
                          className="dropdown__item dropdown__item--danger"
                          role="menuitem"
                          onClick={open('delete')}
                        >
                          <Icon icon={Trash2} />
                          Sil
                        </button>
                      </>
                    ) : null}
                  </>
                );
              }}
            </Menu>
          </>
        }
      />
      <span className="status-row">
        <Badge tone={active ? 'income' : 'neutral'}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
        {p.pinned ? (
          <Badge tone="primary">
            <Icon icon={Pin} />
            Sabit
          </Badge>
        ) : null}
      </span>
      {!canWrite && closedReason ? (
        <DisabledAction label="Değişiklik kapalı" reason={closedReason} />
      ) : null}
      {!active ? (
        <div className="alert alert--info">
          <p className="alert__title alert__title--icon">
            <Icon icon={Info} />
            Bu şantiye {p.status === 'completed' ? 'tamamlandı' : 'arşivlendi'}
          </p>
          <p>
            Anlaşmaya bağlı ödeme, tahsilat, iade ve düzeltme serbesttir; anlaşmaya bağlı olmayan
            yeni gider gerekçe ister. Yeni anlaşma için önce şantiyeyi yeniden aktifleştirin.
          </p>
        </div>
      ) : null}

      <QueryView query={summary} loadingLabel="Özet yükleniyor…">
        {(data) => <SummaryMetrics summary={data} />}
      </QueryView>

      <div className="dash-grid">
        <Panel
          title="Son hareketler"
          icon={ArrowLeftRight}
          more={{ to: `/uygulama/islemler?kapsam=${p.id}&donem=tumu`, label: 'Tüm işlemler' }}
        >
          <QueryView query={transactions}>
            {(data) =>
              data.items.length === 0 ? (
                <p className="list-empty">Bu şantiyede hareket yok.</p>
              ) : (
                <TransactionTable items={data.items} compact showScopedAmount />
              )
            }
          </QueryView>
        </Panel>
        <Panel title="Vadeler" icon={CalendarClock} more={{ to: '/uygulama/vadeler' }}>
          {agreements.isPending ? (
            <Loading />
          ) : dues.length === 0 ? (
            <p className="list-empty">Gecikmiş veya 30 gün içinde vadesi gelen tutar yok.</p>
          ) : (
            <AgreementTable items={dues} compact />
          )}
        </Panel>
      </div>

      <Panel
        title="Anlaşmalar ve başlangıç kayıtları"
        icon={Handshake}
        more={{ to: `/uygulama/anlasmalar?kapsam=${p.id}` }}
      >
        <QueryView query={summary}>{(data) => <ObligationBreakdown summary={data} />}</QueryView>
        <QueryView query={agreements}>
          {(data) =>
            data.items.length === 0 ? (
              <p className="list-empty">Bu şantiyede anlaşma yok.</p>
            ) : (
              <div className="panel__section">
                <AgreementTable items={data.items} />
              </div>
            )
          }
        </QueryView>
        {!active && canWrite ? (
          <p className="panel__note">Yeni anlaşma için şantiyeyi yeniden aktifleştirin.</p>
        ) : null}
      </Panel>

      <Panel title="Değişiklik geçmişi" icon={History}>
        <div className="panel__body stack stack--sm">
          <HistoryList history={p.history ?? []} />
          <p className="meta">
            Oluşturan: {p.createdBy?.name ?? 'Bilinmeyen kullanıcı'} · {formatDateTime(p.createdAt)}
          </p>
        </div>
      </Panel>

      <ActionDialog
        open={dialog === 'complete'}
        title="Şantiyeyi tamamla"
        onClose={close}
        confirmLabel="Tamamla"
        reason="none"
        onConflict={reload}
        confirmDisabled={!completedAt || agreements.isPending}
        onConfirm={async () => {
          await apiPost(`/projects/${p.id}/complete`, {
            completedAt,
            expectedUpdatedAt: p.updatedAt,
          });
          await done('Şantiye tamamlandı.');
        }}
      >
        <p>Tamamlamak tutarları, vadeleri veya kalanları değiştirmez.</p>
        {openAgreements.length > 0 ? (
          <div className="alert alert--danger">
            <p className="alert__title">Açık borç/alacak var</p>
            <ul>
              {openAgreements.map((a) => (
                <li key={a.id}>
                  {a.label} ({a.party?.name}): kalan {formatTl(a.remaining)}
                  {a.dueDate ? `, vade ${formatDate(a.dueDate)}` : ''}
                  {a.dueState === 'overdue' ? ' — Gecikmiş' : ''}
                </li>
              ))}
            </ul>
            <p>Bunlar firma özetinde ve vade listelerinde görünmeye devam eder.</p>
          </div>
        ) : (
          <p className="meta">Açık borç veya alacak yok.</p>
        )}
        <Field label="Tamamlanma tarihi" required>
          {(props) => (
            <DateInput
              {...props}
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
            />
          )}
        </Field>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'reactivate'}
        title="Şantiyeyi yeniden aktifleştir"
        onClose={close}
        confirmLabel="Yeniden aktifleştir"
        onConflict={reload}
        onConfirm={async (reason) => {
          await apiPost(`/projects/${p.id}/reactivate`, { reason, expectedUpdatedAt: p.updatedAt });
          await done('Şantiye yeniden aktif.');
        }}
      >
        <p>Tamamlanma tarihi temizlenir; yeni anlaşma eklenebilir.</p>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'archive'}
        title={p.status === 'archived' ? 'Arşivden çıkar' : 'Şantiyeyi arşivle'}
        onClose={close}
        confirmLabel={p.status === 'archived' ? 'Arşivden çıkar' : 'Arşivle'}
        reason="none"
        onConflict={reload}
        onConfirm={async () => {
          await apiPost(`/projects/${p.id}/archive`, {
            archived: p.status !== 'archived',
            expectedUpdatedAt: p.updatedAt,
          });
          await done(
            p.status === 'archived' ? 'Şantiye arşivden çıkarıldı.' : 'Şantiye arşivlendi.',
          );
        }}
      >
        {p.status === 'archived' ? (
          <p>Şantiye önceki durumuna döner: {p.completedAt ? 'tamamlandı' : 'aktif'}.</p>
        ) : (
          <p>
            Arşiv şantiyeyi günlük listeden kaldırır. Kayıtlar, belgeler ve açık tutarlar firma
            özetinde ve vade listelerinde kalır. Arşivdeki şantiye kayıt kuralları bakımından
            tamamlanan şantiye gibi davranır.
          </p>
        )}
      </ActionDialog>

      <ActionDialog
        open={dialog === 'delete'}
        title="Şantiyeyi sil"
        onClose={close}
        confirmLabel="Sil"
        confirmVariant="danger"
        onConflict={reload}
        confirmDisabled={transactions.isPending || agreements.isPending}
        blockedReason={
          hasRecords
            ? 'Bu şantiyenin hareketleri veya anlaşmaları var; silmek yerine arşivleyin.'
            : null
        }
        onConfirm={async (reason) => {
          await apiDelete(`/projects/${p.id}`, { reason, expectedUpdatedAt: p.updatedAt });
          await invalidateRecords(queryClient);
          toast('Şantiye silindi. Silinenlerden geri alınabilir.');
          await navigate('/uygulama/projeler', { replace: true });
        }}
      >
        <p>Hiç hareketi ve anlaşması olmayan şantiye silinebilir. Toplamlar değişmez.</p>
      </ActionDialog>
    </>
  );
}
