import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ellipsis,
  HardHat,
  Pencil,
  Pin,
  Plus,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { apiPost, errorMessage } from '../../api/client';
import { invalidateRecords, useProjects } from '../../api/queries';
import type { Project, ProjectStatus } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageHeader, Pagination, Panel } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { Menu } from '../../components/ui/Menu';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDateTime, formatMoney, formatSigned } from '../../lib/format';
import { PROJECT_STATUS_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';

const DEFAULTS = { q: '', durum: 'active', sirala: 'last_used', page: '1' };

type Tab = ProjectStatus | 'all';

const TABS: { value: Tab; label: string }[] = [
  { value: 'active', label: 'Aktif' },
  { value: 'completed', label: 'Tamamlandı' },
  { value: 'archived', label: 'Arşivlendi' },
  { value: 'all', label: 'Tümü' },
];

const SORT_LABEL: Record<string, string> = {
  last_used: 'son kullanılana göre',
  newest: 'yeniden eskiye',
  oldest: 'eskiden yeniye',
  name_asc: 'ada göre',
};

const lastUsed = (project: Project) =>
  project.lastUsedAt ? formatDateTime(project.lastUsedAt) : 'henüz yok';

function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={status === 'active' ? 'income' : 'neutral'}>{PROJECT_STATUS_LABEL[status]}</Badge>
  );
}

/** Durum sekmelerindeki sayılar (sekme başına tek kayıtlık sorgu). */
function useStatusCounts(): Partial<Record<Tab, number>> {
  const active = useProjects({ status: 'active', limit: 1 });
  const completed = useProjects({ status: 'completed', limit: 1 });
  const archived = useProjects({ status: 'archived', limit: 1 });
  const all = useProjects({ status: 'all', limit: 1 });
  return {
    active: active.data?.total,
    completed: completed.data?.total,
    archived: archived.data?.total,
    all: all.data?.total,
  };
}

function PinButton({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const { canWrite } = useWriteAccess();
  const [busy, setBusy] = useState(false);

  async function togglePin() {
    setBusy(true);
    try {
      await apiPost(`/projects/${project.id}/pin`, { pinned: !project.pinned });
      await invalidateRecords(queryClient);
    } catch (caught) {
      toast(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const label = project.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle';
  return (
    <button
      type="button"
      className="icon-btn pin-btn"
      aria-pressed={project.pinned}
      aria-label={`${label}: ${project.name}`}
      title={label}
      disabled={!canWrite || busy}
      onClick={(event) => {
        event.stopPropagation();
        void togglePin();
      }}
    >
      <Icon icon={Pin} />
    </button>
  );
}

/** Satır sonundaki "Diğer işlemler": bu şantiyeye kilitli kayıt ve düzenleme bağlantıları. */
function RowMenu({ project }: { project: Project }) {
  const { canWrite } = useWriteAccess();
  const base = `/uygulama/projeler/${project.id}`;
  const items = [
    { to: base, icon: HardHat, label: 'Detayı aç', show: true },
    { to: `${base}/duzenle`, icon: Pencil, label: 'Düzenle', show: canWrite },
    {
      to: `/uygulama/islemler/yeni?tur=gelir&proje=${project.id}`,
      icon: ArrowDownLeft,
      label: 'Gelir ekle',
      show: canWrite,
    },
    {
      to: `/uygulama/islemler/yeni?tur=gider&proje=${project.id}`,
      icon: ArrowUpRight,
      label: 'Gider ekle',
      show: canWrite,
    },
  ];
  return (
    <Menu
      label={`${project.name} işlemleri`}
      buttonClassName="icon-btn"
      buttonLabel="Diğer işlemler"
      buttonContent={<Icon icon={Ellipsis} />}
    >
      {(close) =>
        items
          .filter((item) => item.show)
          .map((item) => (
            <Link
              key={item.label}
              className="dropdown__item"
              role="menuitem"
              to={item.to}
              onClick={close}
            >
              <Icon icon={item.icon} />
              {item.label}
            </Link>
          ))
      }
    </Menu>
  );
}

function ProjectTable({ items, showStatus }: { items: Project[]; showStatus: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col" className="cell-tight">
              <span className="visually-hidden">Sabitleme</span>
            </th>
            <th scope="col">Şantiye</th>
            {showStatus ? <th scope="col">Durum</th> : null}
            <th scope="col" className="num">
              Tahsilat
            </th>
            <th scope="col" className="num">
              Ödeme
            </th>
            <th scope="col" className="num">
              Fark
            </th>
            <th scope="col" className="num">
              Kalan borç
            </th>
            <th scope="col" className="num">
              Kalan alacak
            </th>
            <th scope="col" className="cell-tight">
              <span className="visually-hidden">Diğer işlemler</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((project) => {
            const s = project.summary;
            const href = `/uygulama/projeler/${project.id}`;
            return (
              <tr key={project.id} onClick={() => void navigate(href)}>
                <td className="cell-tight">
                  <PinButton project={project} />
                </td>
                <td>
                  <Link className="cell-link" to={href}>
                    {project.name}
                  </Link>
                  <span className="cell-sub">
                    {project.address ? `${project.address} · ` : ''}Son kullanım {lastUsed(project)}
                  </span>
                </td>
                {showStatus ? (
                  <td>
                    <StatusBadge status={project.status} />
                  </td>
                ) : null}
                <td className="num">
                  {s ? (
                    <span className="amount amount--income">{formatMoney(s.netIncome)}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="num">
                  {s ? (
                    <span className="amount amount--expense">{formatMoney(s.netExpense)}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="num">
                  {s ? <span className="amount">{formatSigned(s.difference)}</span> : '—'}
                </td>
                <td className="num">{s ? formatMoney(s.remainingPayable) : '—'}</td>
                <td className="num">
                  {s ? formatMoney(s.remainingReceivable) : '—'}
                  {s && s.overdueReceivable > 0 ? (
                    <span className="cell-sub text-danger">
                      Gecikmiş {formatMoney(s.overdueReceivable)}
                    </span>
                  ) : null}
                </td>
                <td className="cell-tight">
                  <RowMenu project={project} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProjectCards({ items, showStatus }: { items: Project[]; showStatus: boolean }) {
  return (
    <ul className="project-cards">
      {items.map((project) => {
        const s = project.summary;
        return (
          <li key={project.id}>
            <article className="project-card">
              <div className="project-card__top">
                <div className="list-row__main">
                  <Link className="cell-link" to={`/uygulama/projeler/${project.id}`}>
                    {project.name}
                  </Link>
                  {project.address ? (
                    <span className="list-row__meta block">{project.address}</span>
                  ) : null}
                </div>
                <span className="row row--nowrap">
                  {showStatus ? <StatusBadge status={project.status} /> : null}
                  <PinButton project={project} />
                </span>
              </div>
              <dl className="project-card__kv">
                <div>
                  <dt>Gelir − gider farkı</dt>
                  <dd className="num">{s ? formatSigned(s.difference) : '—'}</dd>
                </div>
                <div>
                  <dt>Son kullanım</dt>
                  <dd>{lastUsed(project)}</dd>
                </div>
                <div>
                  <dt>Kalan borç</dt>
                  <dd className="num">{s ? formatMoney(s.remainingPayable) : '—'}</dd>
                </div>
                <div>
                  <dt>Kalan alacak</dt>
                  <dd className="num">
                    {s ? formatMoney(s.remainingReceivable) : '—'}
                    {s && s.overdueReceivable > 0 ? (
                      <span className="block text-danger">
                        Gecikmiş {formatMoney(s.overdueReceivable)}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

/** Şantiye listesi (şartname 7.2): durum sekmeleri, arama, sıralama; sabitlenenler önce. */
export function ProjectListPage() {
  usePageMeta('Şantiyeler');
  const phone = usePhone();
  const { canWrite } = useWriteAccess();
  const { values: f, update, clear } = useUrlFilters(DEFAULTS);
  const [search, setSearch] = useState(f.q);
  const counts = useStatusCounts();
  const query = useProjects({
    status: f.durum,
    q: f.q || undefined,
    sort: f.sirala,
    page: Number(f.page) || 1,
    limit: 50,
  });

  useEffect(() => {
    if (search === f.q) return;
    const timer = window.setTimeout(() => update({ q: search }), 350);
    return () => window.clearTimeout(timer);
  }, [search, f.q, update]);

  const data = query.data;
  const showStatus = f.durum === 'all';
  const filtered = Boolean(f.q) || f.durum !== 'active';

  return (
    <main className="page">
      <PageHeader
        title="Şantiyeler"
        subtitle={`Sabitlenenler önce · ${SORT_LABEL[f.sirala] ?? ''}`}
        actions={
          <>
            <Refreshing active={query.isFetching && !query.isPending} />
            {canWrite ? (
              <ButtonLink to="/uygulama/projeler/yeni">
                <Icon icon={Plus} />
                Yeni şantiye
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <Panel label="Şantiye listesi">
        <div className="tabs" role="tablist" aria-label="Durum">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              className="tab"
              aria-selected={f.durum === tab.value}
              onClick={() => update({ durum: tab.value })}
            >
              {tab.label}
              {counts[tab.value] !== undefined ? (
                <span className="tab__count">{counts[tab.value]}</span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="panel-toolbar">
          <label className="search-box">
            <Icon icon={Search} />
            <input
              type="search"
              placeholder="Şantiye adı veya adres ara"
              aria-label="Şantiyelerde ara"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            className="input toolbar-select"
            aria-label="Sıralama"
            value={f.sirala}
            onChange={(event) => update({ sirala: event.target.value })}
          >
            <option value="last_used">Son kullanılan</option>
            <option value="newest">Yeniden eskiye</option>
            <option value="oldest">Eskiden yeniye</option>
            <option value="name_asc">Ada göre</option>
          </select>
        </div>

        {query.isPending ? (
          <Loading />
        ) : query.error || !data ? (
          <div className="panel__body">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : data.items.length === 0 ? (
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
              title="Aktif proje bulunamadı"
              description="İlk şantiyeni oluştur. Firma geneli giderler için şantiye gerekmez."
            />
          )
        ) : phone ? (
          <ProjectCards items={data.items} showStatus={showStatus} />
        ) : (
          <ProjectTable items={data.items} showStatus={showStatus} />
        )}
      </Panel>
      {data ? (
        <Pagination
          page={data.page}
          limit={data.limit}
          total={data.total}
          onPage={(page) => update({ page: String(page) })}
        />
      ) : null}
    </main>
  );
}
