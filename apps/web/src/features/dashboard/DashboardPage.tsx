import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useDashboard } from '../../api/queries';
import type { Agreement, Dashboard } from '../../api/types';
import { Amount } from '../../components/ui/Amount';
import { ButtonLink } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { PROJECT_STATUS_LABEL } from '../../lib/labels';
import { useSession } from '../../stores/session';
import { DueBadge, TransactionTable } from '../common/RecordTables';

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

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: ReactNode;
  tone?: 'income' | 'expense';
  hint?: ReactNode;
}) {
  return (
    <div className={tone ? `stat stat--${tone}` : 'stat'}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {hint ? <span className="stat__hint">{hint}</span> : null}
    </div>
  );
}

function AgreementRows({ items }: { items: Agreement[] }) {
  return (
    <ul className="item-list">
      {items.map((a) => (
        <li key={a.id}>
          <Link className="item-card" to={`/uygulama/anlasmalar/${a.id}`}>
            <div className="item-card__main">
              <span className="item-card__title">{a.label}</span>
              <span className="meta">
                {a.party?.name} · {a.scope === 'company' ? 'Firma geneli' : a.project?.name}
              </span>
              <span className="row">
                {a.dueDate ? <span className="meta">Vade {formatDate(a.dueDate)}</span> : null}
                <DueBadge agreement={a} />
              </span>
            </div>
            <Amount
              value={a.remaining}
              tone={a.direction === 'payable' ? 'expense' : 'income'}
              label={a.direction === 'payable' ? 'Kalan borç' : 'Kalan alacak'}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function isEmpty(data: Dashboard): boolean {
  return (
    data.recentTransactions.length === 0 &&
    data.openAgreements.length === 0 &&
    data.recentProjects.length === 0 &&
    data.activeProjectCount === 0
  );
}

/** Firma geneli özet (şartname 7.1). Yüklenirken tutar kutularında 0 TL gösterilmez. */
export function DashboardPage() {
  usePageMeta('Özet');
  const user = useSession((state) => state.user);
  const { canWrite } = useWriteAccess();
  const query = useDashboard();
  const data = query.data;

  return (
    <main className="page">
      <PageHeader
        title={`Merhaba, ${user?.name ?? ''}`}
        subtitle={data?.scope ?? 'Firma geneli — tüm şantiyeler'}
        actions={
          <>
            <Refreshing active={query.isFetching && !query.isPending} />
            {canWrite ? (
              <>
                <ButtonLink variant="income" to="/uygulama/islemler/yeni?tur=gelir">
                  Gelir ekle
                </ButtonLink>
                <ButtonLink variant="expense" to="/uygulama/islemler/yeni?tur=gider">
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
        <>
          <p className="meta">
            Tamamlanan ve arşivlenen şantiyeler dahildir. Hesaplandığı an:{' '}
            {formatDateTime(data.generatedAt)}
          </p>
          {isEmpty(data) ? (
            <Card>
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
            </Card>
          ) : null}

          <section className="grid" aria-label="Özet kutuları">
            <Stat
              label="Tahsilat"
              tone="income"
              value={formatMoney(data.totals.netIncome)}
              hint="Tahsilatlar − tahsilat iadeleri"
            />
            <Stat
              label="Ödeme"
              tone="expense"
              value={formatMoney(data.totals.netExpense)}
              hint="Ödemeler − ödeme iadeleri"
            />
            <Stat label="Gelir − gider farkı" value={formatMoney(data.totals.difference)} />
            <Stat
              label="Kalan borç"
              value={formatMoney(data.totals.remainingPayable)}
              hint={
                data.totals.excessPayable > 0
                  ? `Fazla ödeme: ${formatMoney(data.totals.excessPayable)}`
                  : 'Anlaşmalar ve başlangıç kayıtları'
              }
            />
            <Stat
              label="Kalan alacak"
              value={formatMoney(data.totals.remainingReceivable)}
              hint={
                data.totals.excessReceivable > 0
                  ? `Fazla tahsilat: ${formatMoney(data.totals.excessReceivable)}`
                  : 'Anlaşmalar ve başlangıç kayıtları'
              }
            />
            <Stat
              label="Gecikmiş borç"
              tone={data.totals.overduePayable > 0 ? 'expense' : undefined}
              value={formatMoney(data.totals.overduePayable)}
            />
            <Stat
              label="Gecikmiş alacak"
              tone={data.totals.overdueReceivable > 0 ? 'expense' : undefined}
              value={formatMoney(data.totals.overdueReceivable)}
            />
            <Stat label="Aktif şantiye" value={String(data.activeProjectCount)} />
          </section>

          <Card title={`Bu ay — ${monthLabel(data.monthly.month)}`}>
            <div className="totals-bar">
              <Stat label="Tahsilat" tone="income" value={formatMoney(data.monthly.netIncome)} />
              <Stat label="Ödeme" tone="expense" value={formatMoney(data.monthly.netExpense)} />
              <Stat label="Fark" value={formatMoney(data.monthly.difference)} />
            </div>
            <p className="meta">İşlem tarihine göre.</p>
          </Card>

          <div className="grid grid--2">
            <Card
              title="Son hareketler"
              actions={<Link to="/uygulama/islemler?donem=tumu">Tümünü gör</Link>}
            >
              {data.recentTransactions.length === 0 ? (
                <p className="muted">Henüz hareket yok.</p>
              ) : (
                <TransactionTable items={data.recentTransactions} compact />
              )}
            </Card>
            <Card
              title="Gecikmiş ve 14 gün içinde"
              actions={<Link to="/uygulama/vadeler">Tümünü gör</Link>}
            >
              {data.dueSoon.length === 0 ? (
                <p className="muted">Gecikmiş veya yaklaşan vade yok.</p>
              ) : (
                <AgreementRows items={data.dueSoon} />
              )}
            </Card>
            <Card
              title="Açık anlaşmalar"
              actions={<Link to="/uygulama/anlasmalar?kalan=1">Tümünü gör</Link>}
            >
              {data.openAgreements.length === 0 ? (
                <p className="muted">Kalanı olan anlaşma yok.</p>
              ) : (
                <AgreementRows items={data.openAgreements} />
              )}
            </Card>
            <Card
              title="Son kullanılan şantiyeler"
              actions={<Link to="/uygulama/projeler">Tümünü gör</Link>}
            >
              {data.recentProjects.length === 0 ? (
                <p className="muted">Henüz şantiye kullanılmadı.</p>
              ) : (
                <ul className="item-list">
                  {data.recentProjects.map((project) => (
                    <li key={project.id}>
                      <Link className="item-card" to={`/uygulama/projeler/${project.id}`}>
                        <span className="item-card__title">{project.name}</span>
                        <span className="badge">{PROJECT_STATUS_LABEL[project.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
