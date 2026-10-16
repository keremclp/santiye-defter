import {
  Archive,
  CalendarClock,
  CircleAlert,
  HardDrive,
  Plus,
  Search,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { usePlatformCompanies } from '../../api/admin-queries';
import type { CompanyRef, OperationsSummary, PlatformCompany } from '../../api/admin-types';
import { Badge } from '../../components/ui/Amount';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageHeader, Pagination, Panel } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { DELETION_STATUS_LABEL, STATUS_FILTERS } from '../../lib/admin-labels';
import { formatDate, formatDateTime } from '../../lib/format';
import { CompanyStateBadge, StorageText } from './admin-parts';
import { companyState } from './admin-utils';

const DEFAULTS = { q: '', durum: '', page: '1' };

const companyHref = (id: string) => `/yonetim/firmalar/${id}`;
const deleteHref = (id: string) => `/yonetim/firmalar/${id}/sil`;

interface Group {
  key: keyof OperationsSummary;
  title: string;
  icon: LucideIcon;
  hint: string;
  meta: (ref: CompanyRef) => ReactNode;
  action?: (ref: CompanyRef) => ReactNode;
}

const GROUPS: Group[] = [
  {
    key: 'storageFull',
    title: 'Kapasitesi dolan',
    icon: HardDrive,
    hint: 'Kullanım kotanın tamamına ulaştı.',
    meta: (ref) => <StorageText used={ref.usedBytes} quota={ref.quotaBytes} />,
  },
  {
    key: 'storageNearFull',
    title: 'Kapasitesi yaklaşan',
    icon: HardDrive,
    hint: 'Kullanım kotanın %90’ına ulaştı.',
    meta: (ref) => <StorageText used={ref.usedBytes} quota={ref.quotaBytes} />,
  },
  {
    key: 'viewEnding',
    title: 'Görüntüleme süresi biten',
    icon: CalendarClock,
    hint: 'Görüntüleme dönemi 7 gün içinde bitiyor.',
    meta: (ref) => `Son görüntüleme günü ${formatDate(ref.viewUntil)}`,
  },
  {
    key: 'retentionEnding',
    title: 'Saklama bitişi yaklaşan',
    icon: Archive,
    hint: 'Arşiv saklaması 30 gün içinde bitiyor.',
    meta: (ref) => `Saklama bitişi ${formatDate(ref.retainUntil)}`,
  },
  {
    key: 'deletionPending',
    title: 'Silme onayı bekleyen',
    icon: Trash2,
    hint: 'Saklama süresi doldu; veri onayınız olmadan silinmez.',
    meta: (ref) => `Saklama ${formatDate(ref.retainUntil)} tarihinde bitti`,
    action: (ref) => (
      <ButtonLink variant="secondary" size="small" to={deleteHref(ref.id)}>
        Kalıcı silme
      </ButtonLink>
    ),
  },
  {
    key: 'deletionIncomplete',
    title: 'Silmesi tamamlanmayan',
    icon: CircleAlert,
    hint: 'Kalıcı silmesi bekleyen, süren veya başarısız olan firmalar.',
    meta: (ref) => DELETION_STATUS_LABEL[ref.deletionStatus],
    action: (ref) =>
      ref.deletionStatus === 'failed' ? (
        <ButtonLink variant="danger" size="small" to={deleteHref(ref.id)}>
          Silmeyi yeniden başlat
        </ButtonLink>
      ) : null,
  },
];

/** Filtreden bağımsız işletim özeti (şartname 7.13). Boş grup tek satırdır. */
function Overview({ summary }: { summary: OperationsSummary }) {
  return (
    <Panel title="İşletim özeti" label="İşletim özeti">
      <div className="ops-groups panel__body">
        {GROUPS.map((group) => {
          const items = summary[group.key];
          return (
            <section key={group.key} className="ops-group" aria-labelledby={`ops-${group.key}`}>
              <h3 id={`ops-${group.key}`} className="subhead ops-group__head">
                <Icon icon={group.icon} />
                {group.title}
                <Badge tone={items.length > 0 ? 'warn' : 'neutral'}>{items.length}</Badge>
              </h3>
              <p className="ops-group__hint">{group.hint}</p>
              {items.length === 0 ? (
                <p className="list-empty">Bu grupta firma yok.</p>
              ) : (
                <>
                  <ul className="list-rows">
                    {items.map((ref) => (
                      <li key={ref.id}>
                        <div className="list-row list-row--static">
                          <div className="list-row__main">
                            <span className="list-row__title">
                              <Link className="cell-link" to={companyHref(ref.id)}>
                                <span className="list-row__title-text">{ref.name}</span>
                              </Link>
                            </span>
                            <span className="list-row__meta block">{group.meta(ref)}</span>
                          </div>
                          <div className="list-row__side">{group.action?.(ref)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          );
        })}
      </div>
    </Panel>
  );
}

function ServiceDates({ company }: { company: PlatformCompany }) {
  const { service } = company;
  if (!service.serviceEndedAt) return <span className="muted">Hizmet sonu yok</span>;
  return (
    <span className="stack stack--sm">
      <span>Hizmet sonu {formatDate(service.serviceEndedAt)}</span>
      <span className="cell-sub">
        Görüntüleme {formatDate(service.viewUntil)} · Saklama {formatDate(service.retainUntil)}
      </span>
    </span>
  );
}

function CompanyTable({ items }: { items: PlatformCompany[] }) {
  return (
    <div className="table-wrap">
      <table className="data-table data-table--static">
        <thead>
          <tr>
            <th scope="col">Firma</th>
            <th scope="col" className="num">
              Kullanıcı
            </th>
            <th scope="col">Depolama</th>
            <th scope="col">Durum</th>
            <th scope="col">Tarihler</th>
          </tr>
        </thead>
        <tbody>
          {items.map((company) => (
            <tr key={company.id}>
              <td>
                <Link className="cell-link" to={companyHref(company.id)}>
                  {company.name}
                </Link>
                <span className="cell-sub">
                  {company.contact.person || 'Yetkili girilmemiş'} · Açılış{' '}
                  {formatDateTime(company.createdAt)}
                </span>
              </td>
              <td className="num">{company.userCount}</td>
              <td>
                <StorageText used={company.storage.usedBytes} quota={company.storage.quotaBytes} />
              </td>
              <td>
                <CompanyStateBadge {...companyState(company)} />
              </td>
              <td>
                <ServiceDates company={company} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompanyCards({ items }: { items: PlatformCompany[] }) {
  return (
    <ul className="card-list">
      {items.map((company) => (
        <li key={company.id}>
          <Link className="card-list__item" to={companyHref(company.id)}>
            <span className="list-row__title">
              <span className="list-row__title-text">{company.name}</span>
            </span>
            <CompanyStateBadge {...companyState(company)} />
            <span className="card-list__extra">
              {company.userCount} kullanıcı ·{' '}
              <StorageText used={company.storage.usedBytes} quota={company.storage.quotaBytes} />
            </span>
            {company.service.serviceEndedAt ? (
              <span className="card-list__extra">
                Hizmet sonu {formatDate(company.service.serviceEndedAt)} · Görüntüleme{' '}
                {formatDate(company.service.viewUntil)} · Saklama{' '}
                {formatDate(company.service.retainUntil)}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** İşletim özeti ve firma listesi (şartname 5.3, 7.13). */
export function AdminHomePage() {
  usePageMeta('Yönetim');
  const phone = usePhone();
  const { values: f, update, clear } = useUrlFilters(DEFAULTS);
  const [search, setSearch] = useState(f.q);
  const query = usePlatformCompanies({
    ...(f.q ? { q: f.q } : {}),
    ...(f.durum ? { status: f.durum } : {}),
    page: Number(f.page) || 1,
  });

  useEffect(() => {
    if (search === f.q) return;
    const timer = window.setTimeout(() => update({ q: search }), 350);
    return () => window.clearTimeout(timer);
  }, [search, f.q, update]);

  const data = query.data;
  const filtered = Boolean(f.q) || Boolean(f.durum);

  return (
    <main className="page">
      <PageHeader
        title="İşletim özeti"
        subtitle="Firmalar, kullanım ve hizmet tarihleri. Müşteri kayıtları bu alanda görünmez."
        actions={
          <>
            <Refreshing active={query.isFetching && !query.isPending} />
            <ButtonLink to="/yonetim/firmalar/yeni">
              <Icon icon={Plus} />
              Yeni firma
            </ButtonLink>
          </>
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.error || !data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <Overview summary={data.summary} />
          <Panel label="Firma listesi" title="Firmalar">
            <div className="panel-toolbar">
              <label className="search-box">
                <Icon icon={Search} />
                <input
                  type="search"
                  placeholder="Firma adı ara"
                  aria-label="Firma adında ara"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <select
                className="input toolbar-select"
                aria-label="Durum"
                value={f.durum}
                onChange={(event) => update({ durum: event.target.value })}
              >
                <option value="">Bütün durumlar</option>
                {STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            {data.items.length === 0 ? (
              filtered ? (
                <EmptyState
                  title="Filtrelere uyan kayıt bulunamadı"
                  actions={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch('');
                        clear();
                      }}
                    >
                      Filtreleri temizle
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="Henüz firma yok"
                  description="Müşteri için firma açın; ardından kullanıcı ekleyin."
                  actions={
                    <ButtonLink to="/yonetim/firmalar/yeni">
                      <Icon icon={Plus} />
                      Yeni firma
                    </ButtonLink>
                  }
                />
              )
            ) : phone ? (
              <CompanyCards items={data.items} />
            ) : (
              <CompanyTable items={data.items} />
            )}
          </Panel>
          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPage={(page) => update({ page: String(page) })}
          />
        </>
      )}
    </main>
  );
}
