import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  HandCoins,
  Handshake,
  HardHat,
  History,
  RefreshCw,
  Scale,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useDashboard } from '../../api/queries';
import type { Agreement, Dashboard } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { ButtonLink } from '../../components/ui/Button';
import { Metric, PageHeader, Panel } from '../../components/ui/Card';
import { Segment } from '../../components/ui/Chips';
import { Icon } from '../../components/ui/Icon';
import { ListRow, ListRows } from '../../components/ui/ListRow';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyWhole,
  formatSigned,
} from '../../lib/format';
import { PROJECT_STATUS_LABEL } from '../../lib/labels';
import { useSession } from '../../stores/session';
import { DueBadge, TransactionRow } from '../common/RecordTables';

const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

function monthLabel(month: string): string {
  const [year, index] = month.split('-');
  return `${MONTHS[Number(index) - 1] ?? ''} ${year}`;
}

const BALANCE_INFO = 'Anlaşmalar ve başlangıç kayıtları birlikte; dönemden bağımsız güncel bakiye.';

function isEmpty(data: Dashboard): boolean {
  return (
    data.recentTransactions.length === 0 &&
    data.openAgreements.length === 0 &&
    data.recentProjects.length === 0 &&
    data.activeProjectCount === 0
  );
}

const scopeName = (a: Agreement) => (a.scope === 'company' ? 'Firma geneli' : a.project?.name);

function DirectionIcon({ agreement, opening }: { agreement: Agreement; opening?: boolean }) {
  const receivable = agreement.direction === 'receivable';
  const glyph = opening ? History : receivable ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className={`icon-box icon-box--lg icon-box--${receivable ? 'income' : 'expense'}`}>
      <Icon icon={glyph} />
    </span>
  );
}

function DueRow({ agreement: a }: { agreement: Agreement }) {
  return (
    <ListRow
      to={`/uygulama/anlasmalar/${a.id}`}
      icon={<DirectionIcon agreement={a} />}
      title={a.party?.name ?? a.label}
      meta={`${a.label} · ${scopeName(a) ?? ''} · Vade ${formatDate(a.dueDate)}`}
      side={
        <>
          <span className="amount amount--neutral">{formatMoney(a.remaining)}</span>
          <DueBadge agreement={a} />
        </>
      }
    />
  );
}

function DueGroup({ title, items, empty }: { title: string; items: Agreement[]; empty: string }) {
  return (
    <>
      <div className="subhead">
        <span>{title}</span>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="list-empty">{empty}</p>
      ) : (
        <ListRows label={title}>
          {items.map((a) => (
            <DueRow key={a.id} agreement={a} />
          ))}
        </ListRows>
      )}
    </>
  );
}

function OpenAgreementRow({ agreement: a }: { agreement: Agreement }) {
  const opening = a.kind === 'opening';
  return (
    <ListRow
      to={`/uygulama/anlasmalar/${a.id}`}
      icon={<DirectionIcon agreement={a} opening={opening} />}
      title={a.label}
      titleExtra={opening ? <Badge>Başlangıç</Badge> : null}
      meta={`${a.party?.name ?? ''} · ${scopeName(a) ?? ''}`}
      side={
        <>
          <span className="amount amount--neutral">{formatMoney(a.remaining)}</span>
          <span className="list-row__note">
            {a.direction === 'receivable' ? 'Kalan alacak' : 'Kalan borç'}
            {a.dueState === 'overdue' ? <span className="text-danger"> · gecikmiş</span> : null}
          </span>
        </>
      }
    />
  );
}

function Overdue({ amount }: { amount: number }) {
  return amount > 0 ? (
    <Badge tone="overdue">
      <Icon icon={TriangleAlert} />
      Gecikmiş {formatMoneyWhole(amount)}
    </Badge>
  ) : (
    <>Gecikmiş yok</>
  );
}

function Excess({ amount, label }: { amount: number; label: string }): ReactNode {
  return amount > 0 ? (
    <Badge tone="danger">
      {label} {formatMoneyWhole(amount)}
    </Badge>
  ) : null;
}

/** Firma geneli özet (şartname 7.1). Yüklenirken tutar kutularında 0 TL gösterilmez. */
export function DashboardPage() {
  usePageMeta('Özet');
  const user = useSession((state) => state.user);
  const { canWrite } = useWriteAccess();
  const { values, update } = useUrlFilters({ donem: 'buay' });
  const query = useDashboard();
  const data = query.data;
  const month = values.donem !== 'tumu';

  return (
    <main className="page">
      <PageHeader
        title={`Merhaba, ${user?.name ?? ''}`}
        subtitle="Firma geneli · tamamlanan ve arşivlenen şantiyeler dahil"
        actions={
          <>
            <Refreshing active={query.isFetching && !query.isPending} />
            {canWrite ? (
              <>
                <ButtonLink
                  variant="secondary"
                  className="hide-mobile"
                  to="/uygulama/islemler/yeni?tur=gelir"
                >
                  <Icon icon={ArrowDownLeft} />
                  Gelir ekle
                </ButtonLink>
                <ButtonLink
                  variant="secondary"
                  className="hide-mobile"
                  to="/uygulama/islemler/yeni?tur=gider"
                >
                  <Icon icon={ArrowUpRight} />
                  Gider ekle
                </ButtonLink>
              </>
            ) : null}
          </>
        }
      />
      {query.isPending ? (
        <Loading label="Özet yükleniyor…" />
      ) : query.error || !data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <DashboardBody
          data={data}
          month={month}
          canWrite={canWrite}
          onPeriod={(donem) => update({ donem })}
        />
      )}
    </main>
  );
}

function DashboardBody({
  data,
  month,
  canWrite,
  onPeriod,
}: {
  data: Dashboard;
  month: boolean;
  canWrite: boolean;
  onPeriod: (donem: string) => void;
}) {
  const period = month ? data.monthly : data.totals;
  const periodLabel = month ? monthLabel(data.monthly.month) : 'Tüm zamanlar';
  const overdue = data.dueSoon.filter((a) => a.dueState === 'overdue');
  const upcoming = data.dueSoon.filter((a) => a.dueState === 'upcoming');

  return (
    <>
      {isEmpty(data) ? (
        <Panel>
          <EmptyState
            title="Henüz kayıt yok"
            description="Şantiye oluşturmak firma geneli kayıt için ön koşul değildir; firma geneli gider veya başlangıç borç/alacağıyla da başlayabilirsiniz."
            actions={
              canWrite ? (
                <>
                  <ButtonLink to="/uygulama/projeler/yeni">İlk şantiyeni oluştur</ButtonLink>
                  <ButtonLink variant="secondary" to="/uygulama/anlasmalar/baslangic/yeni">
                    Başlangıç borç/alacağı gir
                  </ButtonLink>
                </>
              ) : null
            }
          />
        </Panel>
      ) : null}

      <div className="metrics-top">
        <Segment
          label="Dönem"
          options={[
            { value: 'buay', label: 'Bu ay' },
            { value: 'tumu', label: 'Tüm zamanlar' },
          ]}
          value={month ? 'buay' : 'tumu'}
          onChange={onPeriod}
        />
        <span className="metrics-top__meta">
          <Icon icon={RefreshCw} />
          Hesaplandı: {formatDateTime(data.generatedAt)}
        </span>
      </div>

      <section className="metrics" aria-label="Özet kutuları">
        <Metric
          label="Tahsilat"
          icon={ArrowDownLeft}
          tone="income"
          value={formatMoneyWhole(period.netIncome)}
          valueClassName="amount--income"
          sub={periodLabel}
          info="Tahsilatlar − tahsilat iadeleri; işlem tarihine göre."
        />
        <Metric
          label="Ödeme"
          icon={ArrowUpRight}
          tone="expense"
          value={formatMoneyWhole(period.netExpense)}
          valueClassName="amount--expense"
          sub={
            period.expenseRefund > 0
              ? `Ödeme iadesi düşüldü: ${formatMoneyWhole(period.expenseRefund)}`
              : periodLabel
          }
          info="Ödemeler − ödeme iadeleri; işlem tarihine göre."
        />
        <Metric
          label="Gelir − gider farkı"
          icon={Scale}
          tone="neutral"
          className="metric--wide"
          value={formatSigned(period.difference, true)}
          sub={periodLabel}
        />
        <Metric
          label="Kalan alacak"
          icon={HandCoins}
          tone="primary"
          balance
          value={formatMoneyWhole(data.totals.remainingReceivable)}
          info={BALANCE_INFO}
          sub={
            <>
              <Overdue amount={data.totals.overdueReceivable} />
              <Excess amount={data.totals.excessReceivable} label="Fazla tahsilat" />
            </>
          }
        />
        <Metric
          label="Kalan borç"
          icon={Wallet}
          tone="primary"
          balance
          value={formatMoneyWhole(data.totals.remainingPayable)}
          info={BALANCE_INFO}
          sub={
            <>
              <Overdue amount={data.totals.overduePayable} />
              <Excess amount={data.totals.excessPayable} label="Fazla ödeme" />
            </>
          }
        />
      </section>

      <div className="dash-grid">
        <Panel
          title="Son hareketler"
          icon={ArrowLeftRight}
          more={{ to: '/uygulama/islemler?donem=tumu', label: 'Tüm işlemler' }}
        >
          {data.recentTransactions.length === 0 ? (
            <p className="list-empty">Henüz hareket yok.</p>
          ) : (
            <ListRows label="Son hareketler">
              {data.recentTransactions.map((t) => (
                <TransactionRow key={t.id} transaction={t} />
              ))}
            </ListRows>
          )}
        </Panel>
        <Panel title="Vadeler" icon={CalendarClock} more={{ to: '/uygulama/vadeler' }}>
          <DueGroup title="Gecikmiş" items={overdue} empty="Gecikmiş vade yok." />
          <DueGroup
            title="14 gün içinde"
            items={upcoming}
            empty="14 gün içinde vadesi gelen tutar yok."
          />
        </Panel>
      </div>

      <div className="dash-grid dash-grid--even">
        <Panel
          title="Açık anlaşmalar"
          icon={Handshake}
          more={{ to: '/uygulama/anlasmalar?kalan=1' }}
        >
          {data.openAgreements.length === 0 ? (
            <p className="list-empty">Kalanı olan anlaşma yok.</p>
          ) : (
            <ListRows label="Açık anlaşmalar">
              {data.openAgreements.map((a) => (
                <OpenAgreementRow key={a.id} agreement={a} />
              ))}
            </ListRows>
          )}
        </Panel>
        <Panel
          title="Son kullanılan şantiyeler"
          icon={HardHat}
          actions={
            <span className="meta panel__aside">{data.activeProjectCount} aktif şantiye</span>
          }
          more={{ to: '/uygulama/projeler' }}
        >
          {data.recentProjects.length === 0 ? (
            <p className="list-empty">Henüz şantiye kullanılmadı.</p>
          ) : (
            <ListRows label="Son kullanılan şantiyeler">
              {data.recentProjects.map((project) => (
                <ListRow
                  key={project.id}
                  to={`/uygulama/projeler/${project.id}`}
                  icon={
                    <span className="icon-box icon-box--lg icon-box--neutral">
                      <Icon icon={HardHat} />
                    </span>
                  }
                  title={project.name}
                  titleExtra={
                    project.status === 'active' ? null : (
                      <Badge>{PROJECT_STATUS_LABEL[project.status]}</Badge>
                    )
                  }
                  meta={`Son kullanım ${formatDateTime(project.lastUsedAt)}`}
                  side={
                    project.summary ? (
                      <>
                        <span className="amount amount--neutral">
                          {formatSigned(project.summary.difference, true)}
                        </span>
                        <span className="list-row__note">Gelir − gider farkı</span>
                      </>
                    ) : null
                  }
                />
              ))}
            </ListRows>
          )}
        </Panel>
      </div>
    </>
  );
}
