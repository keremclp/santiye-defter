import { Building2, Pin, Plus, Search, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useParties } from '../../api/queries';
import type { Party } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageHeader, Pagination, Panel } from '../../components/ui/Card';
import { Segment } from '../../components/ui/Chips';
import { Icon } from '../../components/ui/Icon';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { PARTY_KIND_LABEL, PARTY_TAG_LABEL } from '../../lib/labels';

const DEFAULTS = { q: '', etiket: '', aktif: 'all', sirala: 'last_used', page: '1' };

const href = (party: Party) => `/uygulama/kisiler/${party.id}`;

function PartyIcon({ party }: { party: Party }) {
  return (
    <span className="icon-box icon-box--md icon-box--neutral">
      <Icon icon={party.kind === 'company' ? Building2 : UserRound} />
    </span>
  );
}

function Flags({ party }: { party: Party }) {
  return (
    <>
      {party.pinned ? (
        <Badge tone="primary">
          <Icon icon={Pin} />
          Sabit
        </Badge>
      ) : null}
      {!party.isActive ? <Badge tone="danger">Pasif</Badge> : null}
    </>
  );
}

function PartyTable({ items }: { items: Party[] }) {
  const navigate = useNavigate();
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Kişi / firma</th>
            <th scope="col">Etiketler</th>
            <th scope="col">Telefon</th>
            <th scope="col">E-posta</th>
          </tr>
        </thead>
        <tbody>
          {items.map((party) => (
            <tr key={party.id} onClick={() => void navigate(href(party))}>
              <td>
                <div className="type-cell">
                  <PartyIcon party={party} />
                  <div>
                    <span className="list-row__title">
                      <Link className="cell-link" to={href(party)}>
                        {party.name}
                      </Link>
                      <Flags party={party} />
                    </span>
                    <span className="cell-sub">{PARTY_KIND_LABEL[party.kind]}</span>
                  </div>
                </div>
              </td>
              <td>
                <span className="status-row">
                  {party.tags.length === 0 ? <span className="muted">—</span> : null}
                  {party.tags.map((tag) => (
                    <Badge key={tag}>{PARTY_TAG_LABEL[tag]}</Badge>
                  ))}
                </span>
              </td>
              <td className="nowrap">{party.phone || <span className="muted">—</span>}</td>
              <td>{party.email || <span className="muted">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartyCards({ items }: { items: Party[] }) {
  return (
    <ul className="card-list">
      {items.map((party) => (
        <li key={party.id}>
          <Link className="card-list__item" to={href(party)}>
            <span className="list-row__main">
              <span className="list-row__title">
                <span className="list-row__title-text">{party.name}</span>
                <Flags party={party} />
              </span>
              <span className="list-row__meta block">
                {PARTY_KIND_LABEL[party.kind]}
                {party.phone ? ` · ${party.phone}` : ''}
              </span>
            </span>
            <span className="list-row__side status-row">
              {party.tags.map((tag) => (
                <Badge key={tag}>{PARTY_TAG_LABEL[tag]}</Badge>
              ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Kişi / firma listesi (şartname 7.3): ad ve telefonla arama, etiket filtresi, sıralama, sabitler önce. */
export function PartyListPage() {
  usePageMeta('Kişiler');
  const phone = usePhone();
  const { canWrite } = useWriteAccess();
  const { values: f, update, clear, activeCount } = useUrlFilters(DEFAULTS);
  const [search, setSearch] = useState(f.q);
  const query = useParties({
    q: f.q || undefined,
    tag: f.etiket || undefined,
    active: f.aktif,
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
  const resetAll = () => {
    setSearch('');
    clear();
  };

  return (
    <main className="page">
      <PageHeader
        title="Kişiler / firmalar"
        subtitle={`Taşeron, tedarikçi ve müşteriler · sabitlenenler önce${data ? ` · ${data.total} kayıt` : ''}`}
        actions={
          <>
            <Refreshing active={query.isFetching && !query.isPending} />
            {canWrite ? (
              <ButtonLink to="/uygulama/kisiler/yeni">
                <Icon icon={Plus} />
                Kişi/firma ekle
              </ButtonLink>
            ) : null}
          </>
        }
      />
      <Panel label="Kişi listesi">
        <div className="panel-toolbar">
          <label className="search-box">
            <Icon icon={Search} />
            <input
              type="search"
              placeholder="Ad veya telefon ara"
              aria-label="Kişilerde ara"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Segment
            label="Etiket"
            options={[
              { value: '', label: 'Tümü' },
              { value: 'supplier', label: 'Tedarikçi' },
              { value: 'subcontractor', label: 'Taşeron' },
              { value: 'customer', label: 'Müşteri' },
            ]}
            value={f.etiket}
            onChange={(etiket) => update({ etiket })}
          />
          <select
            className="input toolbar-select"
            aria-label="Durum"
            value={f.aktif}
            onChange={(event) => update({ aktif: event.target.value })}
          >
            <option value="all">Aktif ve pasif</option>
            <option value="true">Yalnız aktif</option>
            <option value="false">Yalnız pasif</option>
          </select>
          <select
            className="input toolbar-select"
            aria-label="Sıralama"
            value={f.sirala}
            onChange={(event) => update({ sirala: event.target.value })}
          >
            <option value="last_used">Son kullanılan</option>
            <option value="name_asc">Ada göre</option>
            <option value="newest">Yeniden eskiye</option>
            <option value="oldest">Eskiden yeniye</option>
          </select>
          {activeCount > 0 ? (
            <button type="button" className="filter-clear" onClick={resetAll}>
              Filtreleri temizle
            </button>
          ) : null}
        </div>

        {query.isPending ? (
          <Loading />
        ) : query.error || !data ? (
          <div className="panel__body">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : data.items.length === 0 ? (
          activeCount > 0 ? (
            <EmptyState
              title="Filtrelere uyan kayıt bulunamadı"
              actions={
                <Button variant="secondary" onClick={resetAll}>
                  Filtreleri temizle
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="Henüz kişi/firma yok"
              description="Taşeron, tedarikçi ve müşterilerinizi ekleyin. Gelir/gider formundan yalnız adla da ekleyebilirsiniz."
              actions={
                canWrite ? (
                  <ButtonLink to="/uygulama/kisiler/yeni">Kişi/firma ekle</ButtonLink>
                ) : null
              }
            />
          )
        ) : phone ? (
          <PartyCards items={data.items} />
        ) : (
          <PartyTable items={data.items} />
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
