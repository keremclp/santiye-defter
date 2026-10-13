import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Building2,
  CalendarRange,
  Handshake,
  HardHat,
  History,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { apiDelete, errorMessage } from '../../api/client';
import { keys, useSearch, useSearchHistory } from '../../api/queries';
import type { SearchResult } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { Button } from '../../components/ui/Button';
import { PageHeader, Panel } from '../../components/ui/Card';
import { Segment } from '../../components/ui/Chips';
import { DateInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { ListRow, ListRows } from '../../components/ui/ListRow';
import { EmptyState, ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatMoney } from '../../lib/format';
import { PARTY_KIND_LABEL, PROJECT_STATUS_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';
import { DirectionIcon, TransactionRow } from '../common/RecordTables';

const DEFAULTS = { q: '', tur: '', baslangic: '', bitis: '' };

function Results({ data }: { data: SearchResult }) {
  const count =
    data.projects.length + data.parties.length + data.agreements.length + data.transactions.length;
  if (count === 0)
    return (
      <Panel>
        <EmptyState
          title="Sonuç bulunamadı"
          description="Başka bir kelime, kayıt numarası veya tutar deneyin."
        />
      </Panel>
    );
  const total = (key: keyof NonNullable<SearchResult['totals']>, shown: number) =>
    data.totals && data.totals[key] > shown ? ` · ilk ${shown} / ${data.totals[key]}` : '';
  return (
    <>
      {data.projects.length > 0 ? (
        <Panel title={`Şantiyeler${total('projects', data.projects.length)}`} icon={HardHat}>
          <ListRows label="Şantiyeler">
            {data.projects.map((p) => (
              <ListRow
                key={p.id}
                to={`/uygulama/projeler/${p.id}`}
                icon={
                  <span className="icon-box icon-box--lg icon-box--neutral">
                    <Icon icon={HardHat} />
                  </span>
                }
                title={p.name}
                side={
                  <Badge tone={p.status === 'active' ? 'income' : 'neutral'}>
                    {PROJECT_STATUS_LABEL[p.status]}
                  </Badge>
                }
              />
            ))}
          </ListRows>
        </Panel>
      ) : null}
      {data.parties.length > 0 ? (
        <Panel title={`Kişiler / firmalar${total('parties', data.parties.length)}`} icon={Users}>
          <ListRows label="Kişiler / firmalar">
            {data.parties.map((p) => (
              <ListRow
                key={p.id}
                to={`/uygulama/kisiler/${p.id}`}
                icon={
                  <span className="icon-box icon-box--lg icon-box--neutral">
                    <Icon icon={p.kind === 'company' ? Building2 : UserRound} />
                  </span>
                }
                title={p.name}
                meta={`${PARTY_KIND_LABEL[p.kind]}${p.phone ? ` · ${p.phone}` : ''}`}
                side={!p.isActive ? <Badge tone="danger">Pasif</Badge> : null}
              />
            ))}
          </ListRows>
        </Panel>
      ) : null}
      {data.agreements.length > 0 ? (
        <Panel title={`Anlaşmalar${total('agreements', data.agreements.length)}`} icon={Handshake}>
          <ListRows label="Anlaşmalar">
            {data.agreements.map((a) => (
              <ListRow
                key={a.id}
                to={`/uygulama/anlasmalar/${a.id}`}
                icon={<DirectionIcon agreement={a} opening={a.kind === 'opening'} />}
                title={a.label}
                titleExtra={a.kind === 'opening' ? <Badge>Başlangıç</Badge> : null}
                meta={`${a.party?.name ?? ''} · ${a.project?.name ?? 'Firma geneli'} · Bedel ${formatMoney(a.currentAmount)}`}
                side={
                  <>
                    <span className="amount amount--neutral">{formatMoney(a.remaining)}</span>
                    <span className="list-row__note">
                      {a.direction === 'payable' ? 'Kalan borç' : 'Kalan alacak'}
                    </span>
                  </>
                }
              />
            ))}
          </ListRows>
        </Panel>
      ) : null}
      {data.transactions.length > 0 ? (
        <Panel
          title={`İşlemler${total('transactions', data.transactions.length)}`}
          icon={ArrowLeftRight}
        >
          <ListRows label="İşlemler">
            {data.transactions.map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </ListRows>
        </Panel>
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
  // Üst çubuktaki genel aramadan yeni sorgu gelince kutu da güncellenir.
  const [shownQ, setShownQ] = useState(f.q);
  if (shownQ !== f.q) {
    setShownQ(f.q);
    setText(f.q);
  }
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
        subtitle="Firmanın bütün kayıtlarında arar; silinen kayıtlar ve belge içerikleri hariç"
      />
      <Panel label="Arama">
        <form
          className="panel-toolbar"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: text.trim() });
          }}
        >
          <label className="search-box">
            <Icon icon={Search} />
            <input
              type="search"
              aria-label="Arama"
              placeholder="Şantiye, kişi, anlaşma, tutar, açıklama, kayıt no"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <Button type="submit" size="small">
            Ara
          </Button>
        </form>
        <div className="panel-toolbar">
          <Segment
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
          <div className="date-range" role="group" aria-label="Tarih aralığı">
            <span className="date-range__label">
              <Icon icon={CalendarRange} />
              Tarih
            </span>
            <DateInput
              aria-label="Başlangıç tarihi"
              value={f.baslangic}
              onChange={(e) => update({ baslangic: e.target.value })}
            />
            <span aria-hidden="true">–</span>
            <DateInput
              aria-label="Bitiş tarihi"
              value={f.bitis}
              onChange={(e) => update({ bitis: e.target.value })}
            />
            {f.baslangic || f.bitis ? (
              <button
                type="button"
                className="filter-clear"
                onClick={() => update({ baslangic: '', bitis: '' })}
              >
                Tarihi temizle
              </button>
            ) : null}
          </div>
        </div>
      </Panel>

      {f.q.trim() === '' ? (
        <Panel
          title="Son aramalar"
          icon={History}
          actions={
            history.data && history.data.length > 0 ? (
              <button type="button" className="filter-clear" onClick={() => void clearHistory()}>
                Temizle
              </button>
            ) : null
          }
        >
          {history.isPending ? (
            <Loading />
          ) : history.error ? (
            <div className="panel__body">
              <ErrorState error={history.error} onRetry={() => void history.refetch()} />
            </div>
          ) : (history.data ?? []).length === 0 ? (
            <p className="list-empty">Son arama yok.</p>
          ) : (
            <ul className="list-rows">
              {history.data.map((item) => (
                <li key={item.createdAt}>
                  <button
                    type="button"
                    className="dropdown__item"
                    onClick={() => {
                      setText(item.query);
                      update({ q: item.query });
                    }}
                  >
                    <Icon icon={History} />
                    {item.query}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
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
