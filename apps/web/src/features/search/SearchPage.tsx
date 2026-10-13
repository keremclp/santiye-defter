import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { apiDelete, errorMessage } from '../../api/client';
import { keys, useSearch, useSearchHistory } from '../../api/queries';
import type { SearchResult } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/Chips';
import { DateInput, Field, TextInput } from '../../components/ui/Field';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatMoney } from '../../lib/format';
import { DIRECTION_LABEL, PARTY_KIND_LABEL, PROJECT_STATUS_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';
import { TransactionTable } from '../common/RecordTables';

const DEFAULTS = { q: '', tur: '', baslangic: '', bitis: '' };

function Results({ data }: { data: SearchResult }) {
  const count =
    data.projects.length + data.parties.length + data.agreements.length + data.transactions.length;
  if (count === 0)
    return (
      <EmptyState
        title="Sonuç bulunamadı"
        description="Başka bir kelime, kayıt numarası veya tutar deneyin."
      />
    );
  const total = (key: keyof NonNullable<SearchResult['totals']>, shown: number) =>
    data.totals && data.totals[key] > shown ? ` — ilk ${shown} / ${data.totals[key]}` : '';
  return (
    <>
      {data.projects.length > 0 ? (
        <Card title={`Şantiyeler${total('projects', data.projects.length)}`}>
          <ul className="item-list">
            {data.projects.map((p) => (
              <li key={p.id}>
                <Link className="item-card" to={`/uygulama/projeler/${p.id}`}>
                  <span className="item-card__title">{p.name}</span>
                  <Badge>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {data.parties.length > 0 ? (
        <Card title={`Kişiler / firmalar${total('parties', data.parties.length)}`}>
          <ul className="item-list">
            {data.parties.map((p) => (
              <li key={p.id}>
                <Link className="item-card" to={`/uygulama/kisiler/${p.id}`}>
                  <div className="item-card__main">
                    <span className="item-card__title">{p.name}</span>
                    <span className="meta">
                      {PARTY_KIND_LABEL[p.kind]}
                      {p.phone ? ` · ${p.phone}` : ''}
                    </span>
                  </div>
                  {!p.isActive ? <Badge tone="danger">Pasif</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {data.agreements.length > 0 ? (
        <Card title={`Anlaşmalar${total('agreements', data.agreements.length)}`}>
          <ul className="item-list">
            {data.agreements.map((a) => (
              <li key={a.id}>
                <Link className="item-card" to={`/uygulama/anlasmalar/${a.id}`}>
                  <div className="item-card__main">
                    <span className="item-card__title">{a.label}</span>
                    <span className="meta">
                      {a.party?.name} · {a.project?.name ?? 'Firma geneli'} ·{' '}
                      {DIRECTION_LABEL[a.direction]}
                    </span>
                  </div>
                  <div className="item-card__side">
                    <span className="meta">Bedel {formatMoney(a.currentAmount)}</span>
                    <span
                      className={
                        a.direction === 'payable'
                          ? 'amount amount--expense'
                          : 'amount amount--income'
                      }
                    >
                      Kalan {formatMoney(a.remaining)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {data.transactions.length > 0 ? (
        <Card title={`İşlemler${total('transactions', data.transactions.length)}`}>
          <TransactionTable items={data.transactions} compact />
        </Card>
      ) : null}
    </>
  );
}

/**
 * Genel arama (şartname 7.8): şantiye, kişi, anlaşma, tutar ("12.500" veya "10.000-20.000"),
 * açıklama ve kayıt numarası; Türkçe harf farkı engellemez. Boş sorguda son üç arama.
 */
export function SearchPage() {
  usePageMeta('Ara');
  const queryClient = useQueryClient();
  const { values: f, update } = useUrlFilters(DEFAULTS);
  const [text, setText] = useState(f.q);
  const history = useSearchHistory();
  const results = useSearch(
    {
      q: f.q,
      saveHistory: 'true',
      type: f.tur || undefined,
      dateFrom: f.baslangic || undefined,
      dateTo: f.bitis || undefined,
    },
    f.q.trim() !== '',
  );

  async function clearHistory() {
    try {
      await apiDelete('/search/history', {});
      await queryClient.invalidateQueries({ queryKey: keys.searchHistory });
      toast('Arama geçmişi temizlendi.');
    } catch (caught) {
      toast(errorMessage(caught));
    }
  }

  return (
    <main className="page">
      <PageHeader
        title="Ara"
        subtitle="Firmanın bütün kayıtlarında arar; silinen kayıtlar ve belge içerikleri hariç."
      />
      <form
        className="card stack"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: text.trim() });
        }}
      >
        <div className="toolbar">
          <Field label="Arama">
            {(props) => (
              <TextInput
                {...props}
                type="search"
                placeholder="Şantiye, kişi, anlaşma, tutar, açıklama, kayıt no"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            )}
          </Field>
          <Button type="submit">Ara</Button>
        </div>
        <ChipGroup
          label="Tür"
          options={[
            { value: '', label: 'Tümü' },
            { value: 'project', label: 'Şantiyeler' },
            { value: 'party', label: 'Kişiler' },
            { value: 'agreement', label: 'Anlaşmalar' },
            { value: 'transaction', label: 'İşlemler' },
          ]}
          value={f.tur}
          onChange={(tur) => update({ tur })}
        />
        <div className="form-grid">
          <Field label="Başlangıç tarihi">
            {(props) => (
              <DateInput
                {...props}
                value={f.baslangic}
                onChange={(e) => update({ baslangic: e.target.value })}
              />
            )}
          </Field>
          <Field label="Bitiş tarihi">
            {(props) => (
              <DateInput
                {...props}
                value={f.bitis}
                onChange={(e) => update({ bitis: e.target.value })}
              />
            )}
          </Field>
        </div>
      </form>

      {f.q.trim() === '' ? (
        <Card
          title="Son aramalar"
          actions={
            history.data && history.data.length > 0 ? (
              <Button variant="ghost" size="small" onClick={() => void clearHistory()}>
                Temizle
              </Button>
            ) : null
          }
        >
          {history.isPending ? (
            <Loading />
          ) : history.error ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : (history.data ?? []).length === 0 ? (
            <p className="muted">Son arama yok.</p>
          ) : (
            <ul className="row plain-list">
              {history.data.map((item) => (
                <li key={item.createdAt}>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      setText(item.query);
                      update({ q: item.query });
                    }}
                  >
                    {item.query}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : results.isPending ? (
        <Loading label="Aranıyor…" />
      ) : results.error || !results.data ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : (
        <Results data={results.data} />
      )}
    </main>
  );
}
