import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiPost, errorMessage } from '../../api/client';
import { invalidateRecords, useProjects } from '../../api/queries';
import type { Project } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { Button } from '../../components/ui/Button';
import { PageHeader, Pagination } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/Chips';
import { Field, SelectInput, TextInput } from '../../components/ui/Field';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDateTime, formatMoney } from '../../lib/format';
import { PROJECT_STATUS_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';

const DEFAULTS = { q: '', durum: 'active', sirala: 'last_used', page: '1' };

function ProjectCard({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const { canWrite } = useWriteAccess();
  const [busy, setBusy] = useState(false);
  const summary = project.summary;

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

  return (
    <li className="card stack stack--sm">
      <div className="row row--between">
        <Link className="item-card__title" to={`/uygulama/projeler/${project.id}`}>
          {project.name}
        </Link>
        <span className="row">
          {project.pinned ? <Badge tone="primary">Sabit</Badge> : null}
          <Badge tone={project.status === 'active' ? 'income' : 'neutral'}>
            {PROJECT_STATUS_LABEL[project.status]}
          </Badge>
        </span>
      </div>
      <span className="meta">
        Son kullanım: {project.lastUsedAt ? formatDateTime(project.lastUsedAt) : 'henüz yok'}
      </span>
      {summary ? (
        <dl className="definition-list">
          <dt>Gelir − gider farkı</dt>
          <dd>{formatMoney(summary.difference)}</dd>
          <dt>Kalan borç</dt>
          <dd className="amount amount--expense">{formatMoney(summary.remainingPayable)}</dd>
          <dt>Kalan alacak</dt>
          <dd className="amount amount--income">{formatMoney(summary.remainingReceivable)}</dd>
        </dl>
      ) : null}
      {canWrite ? (
        <div>
          <Button variant="ghost" size="small" disabled={busy} onClick={() => void togglePin()}>
            {project.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/** Şantiye listesi (şartname 7.2): arama, durum filtresi (varsayılan aktif), sıralama; sabitler önce. */
export function ProjectListPage() {
  usePageMeta('Şantiyeler');
  const { canWrite } = useWriteAccess();
  const { values: f, update, clear, activeCount } = useUrlFilters(DEFAULTS);
  const [search, setSearch] = useState(f.q);
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

  return (
    <main className="page">
      <PageHeader
        title="Şantiyeler"
        actions={<Refreshing active={query.isFetching && !query.isPending} />}
      />
      <section className="card stack" aria-label="Filtreler">
        <div className="toolbar">
          <Field label="Ara">
            {(props) => (
              <TextInput
                {...props}
                type="search"
                placeholder="Proje ara…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
          </Field>
          <Field label="Sıralama">
            {(props) => (
              <SelectInput
                {...props}
                value={f.sirala}
                onChange={(e) => update({ sirala: e.target.value })}
              >
                <option value="last_used">Son kullanılan</option>
                <option value="newest">Yeniden eskiye</option>
                <option value="oldest">Eskiden yeniye</option>
                <option value="name_asc">Ada göre</option>
              </SelectInput>
            )}
          </Field>
        </div>
        <ChipGroup
          label="Durum"
          options={[
            { value: 'active', label: 'Aktif' },
            { value: 'completed', label: 'Tamamlandı' },
            { value: 'archived', label: 'Arşivlendi' },
            { value: 'all', label: 'Tümü' },
          ]}
          value={f.durum}
          onChange={(durum) => update({ durum })}
        />
        {activeCount > 0 ? (
          <div className="filter-summary">
            <span>{data ? `${data.total} şantiye` : ''}</span>
            <Button
              variant="ghost"
              size="small"
              onClick={() => {
                setSearch('');
                clear();
              }}
            >
              Filtreleri temizle
            </Button>
          </div>
        ) : null}
      </section>

      {query.isPending ? (
        <Loading />
      ) : query.error || !data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <ul className="grid grid--2 plain-list">
            {canWrite ? (
              <li>
                <Link
                  className="card card--link card--dashed stack stack--sm"
                  to="/uygulama/projeler/yeni"
                >
                  <span className="item-card__title">+ Yeni şantiye</span>
                  <span className="meta">Ad zorunlu; diğer bilgiler sonradan eklenebilir.</span>
                </Link>
              </li>
            ) : null}
            {data.items.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </ul>
          {data.items.length === 0 ? (
            f.q || f.durum !== 'active' ? (
              <EmptyState title="Filtrelere uyan kayıt bulunamadı" />
            ) : (
              <EmptyState
                title="Aktif proje bulunamadı"
                description="İlk şantiyeni oluştur. Firma geneli giderler için şantiye gerekmez."
              />
            )
          ) : null}
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
