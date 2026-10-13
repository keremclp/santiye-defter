import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useParties } from '../../api/queries';
import { Badge } from '../../components/ui/Amount';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageHeader, Pagination } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/Chips';
import { Field, SelectInput, TextInput } from '../../components/ui/Field';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { PARTY_KIND_LABEL, PARTY_TAG_LABEL } from '../../lib/labels';

const DEFAULTS = { q: '', etiket: '', aktif: 'all', sirala: 'last_used', page: '1' };

/** Kişi / firma listesi (şartname 7.3): ad ve telefonla arama, etiket filtresi, sıralama, sabitler önce. */
export function PartyListPage() {
  usePageMeta('Kişiler');
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
        actions={
          <>
            <Refreshing active={query.isFetching && !query.isPending} />
            {canWrite ? <ButtonLink to="/uygulama/kisiler/yeni">Kişi/firma ekle</ButtonLink> : null}
          </>
        }
      />
      <section className="card stack" aria-label="Filtreler">
        <div className="toolbar">
          <Field label="Ara">
            {(props) => (
              <TextInput
                {...props}
                type="search"
                placeholder="Ad veya telefon"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
          </Field>
          <Field label="Durum">
            {(props) => (
              <SelectInput
                {...props}
                value={f.aktif}
                onChange={(e) => update({ aktif: e.target.value })}
              >
                <option value="all">Tümü</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </SelectInput>
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
                <option value="name_asc">Ada göre</option>
                <option value="newest">Yeniden eskiye</option>
                <option value="oldest">Eskiden yeniye</option>
              </SelectInput>
            )}
          </Field>
        </div>
        <ChipGroup
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
        <div className="filter-summary">
          <span>
            {data ? `${data.total} kayıt` : ''}
            {activeCount > 0 ? ` · ${activeCount} filtre seçili` : ''}
          </span>
          {activeCount > 0 ? (
            <Button variant="ghost" size="small" onClick={resetAll}>
              Filtreleri temizle
            </Button>
          ) : null}
        </div>
      </section>

      {query.isPending ? (
        <Loading />
      ) : query.error || !data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
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
              canWrite ? <ButtonLink to="/uygulama/kisiler/yeni">Kişi/firma ekle</ButtonLink> : null
            }
          />
        )
      ) : (
        <>
          <ul className="item-list">
            {data.items.map((party) => (
              <li key={party.id}>
                <Link className="item-card" to={`/uygulama/kisiler/${party.id}`}>
                  <div className="item-card__main">
                    <span className="item-card__title">{party.name}</span>
                    <span className="meta">
                      {PARTY_KIND_LABEL[party.kind]}
                      {party.phone ? ` · ${party.phone}` : ''}
                    </span>
                    <span className="row">
                      {party.tags.map((tag) => (
                        <Badge key={tag}>{PARTY_TAG_LABEL[tag]}</Badge>
                      ))}
                      {party.pinned ? <Badge tone="primary">Sabit</Badge> : null}
                      {!party.isActive ? <Badge tone="danger">Pasif</Badge> : null}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
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
