import { Calendar, Download, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useCategories, useCompanyUsers, useParty, useTransactions } from '../../api/queries';
import { Badge } from '../../components/ui/Amount';
import { Button } from '../../components/ui/Button';
import { PageHeader, Pagination, Panel } from '../../components/ui/Card';
import { FilterChips, Segment } from '../../components/ui/Chips';
import { Checkbox, DateInput, Field, SelectInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { formatDate, formatMoney, formatSigned } from '../../lib/format';
import { PartyPicker } from '../common/Pickers';
import { useProjectOptions } from '../common/project-options';
import { TransactionTable } from '../common/RecordTables';
import {
  TRANSACTION_FILTER_DEFAULTS,
  transactionQuery,
  type TransactionFilters,
} from './transaction-filters';

/** "Filtreler" panelindeki ek filtreler; düğmedeki sayı bunlardan etkin olanlardır. */
const PANEL_KEYS = [
  'kapsam',
  'kisi',
  'muhatapsiz',
  'kategori',
  'bag',
  'olusturan',
  'tutarMin',
  'tutarMax',
  'silinen',
] as const satisfies readonly (keyof TransactionFilters)[];

const PERIOD_LABEL: Record<string, string> = { bugun: 'Bugün', buay: 'Bu ay' };
const KIND_FILTER_LABEL: Record<string, string> = {
  income: 'Gelir',
  expense: 'Gider',
  refund: 'İade',
};

/** Gelir, gider ve iade listesi (şartname 7.4). Filtreler URL'de; toplamlar bütün sonuçları kapsar. */
export function TransactionListPage() {
  usePageMeta('İşlemler');
  const exportHintId = useId();
  const {
    values: filters,
    update,
    clear,
    activeCount,
  } = useUrlFilters(TRANSACTION_FILTER_DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const [panelOpen, setPanelOpen] = useState(false);
  const projects = useProjectOptions();
  const categories = useCategories(true);
  const users = useCompanyUsers();
  const selectedParty = useParty(filters.kisi || null);
  const query = useTransactions(transactionQuery(filters));

  // Arama yazarken her harfte istek atılmaz.
  useEffect(() => {
    if (search === filters.q) return;
    const timer = window.setTimeout(() => update({ q: search }), 350);
    return () => window.clearTimeout(timer);
  }, [search, filters.q, update]);

  const data = query.data;
  const panelCount = PANEL_KEYS.filter(
    (key) => filters[key] !== TRANSACTION_FILTER_DEFAULTS[key],
  ).length;
  const scopedToProject = Boolean(filters.kapsam) && filters.kapsam !== 'genel';

  function clearAll() {
    setSearch('');
    clear();
  }

  const chips = filterChips(filters, {
    projectName: (id) => projects.data?.items.find((p) => p.id === id)?.name,
    partyName: selectedParty.data?.name,
    categoryName: (id) => categories.data?.find((c) => c.id === id)?.name,
    userName: (id) => users.data?.find((u) => u.id === id)?.name,
  }).map((chip) => ({
    ...chip,
    onRemove: () => {
      if (chip.key === 'q') setSearch('');
      update(chip.reset);
    },
  }));

  return (
    <main className="page">
      <PageHeader
        title="İşlemler"
        subtitle="Gelir, gider ve iadeler · işlem tarihine göre"
        actions={
          <>
            <Refreshing active={query.isFetching && !query.isPending} />
            <Button
              variant="secondary"
              className="hide-mobile"
              disabled
              aria-describedby={exportHintId}
            >
              <Icon icon={Download} />
              Bu sonuçları indir
            </Button>
            <span id={exportHintId} className="visually-hidden">
              İndirme yakında eklenecek.
            </span>
          </>
        }
      />

      <Panel label="Filtreler">
        <div className="panel-toolbar">
          <label className="search-box">
            <Icon icon={Search} />
            <input
              type="search"
              placeholder="Açıklama, kişi, şantiye, kayıt no veya tutar"
              aria-label="İşlemlerde ara"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Segment
            label="Tarih"
            options={[
              { value: 'bugun', label: 'Bugün' },
              { value: 'buay', label: 'Bu ay' },
              { value: 'tumu', label: 'Tümü' },
              { value: 'aralik', label: <Icon icon={Calendar} />, ariaLabel: 'Tarih aralığı' },
            ]}
            value={filters.donem}
            onChange={(donem) => update({ donem })}
          />
          <Segment
            label="Tür"
            options={[
              { value: 'all', label: 'Tümü' },
              { value: 'income', label: 'Gelir' },
              { value: 'expense', label: 'Gider' },
              { value: 'refund', label: 'İade' },
            ]}
            value={filters.tur}
            onChange={(tur) => update({ tur })}
          />
          <Button
            variant="secondary"
            size="small"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            <Icon icon={SlidersHorizontal} />
            Filtreler
            {panelCount > 0 ? <Badge tone="primary">{panelCount}</Badge> : null}
          </Button>
        </div>

        {filters.donem === 'aralik' ? (
          <div className="panel-toolbar__range">
            <Field label="Başlangıç">
              {(props) => (
                <DateInput
                  {...props}
                  value={filters.baslangic}
                  onChange={(event) => update({ baslangic: event.target.value })}
                />
              )}
            </Field>
            <Field label="Bitiş">
              {(props) => (
                <DateInput
                  {...props}
                  value={filters.bitis}
                  onChange={(event) => update({ bitis: event.target.value })}
                />
              )}
            </Field>
          </div>
        ) : null}

        {chips.length > 0 ? (
          <div className="panel-toolbar__chips">
            <FilterChips chips={chips} onClear={activeCount > 0 ? clearAll : undefined} />
          </div>
        ) : null}

        {panelOpen ? (
          <div className="filter-panel">
            <Field label="Kapsam">
              {(props) => (
                <SelectInput
                  {...props}
                  value={filters.kapsam}
                  onChange={(event) => update({ kapsam: event.target.value })}
                >
                  <option value="">Tüm şantiyeler ve firma geneli</option>
                  <option value="genel">Firma geneli</option>
                  {(projects.data?.items ?? []).map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <PartyPicker
              label="Kişi / firma"
              value={
                filters.kisi && selectedParty.data
                  ? { id: selectedParty.data.id, name: selectedParty.data.name }
                  : null
              }
              onChange={(party) => update({ kisi: party?.id ?? '', muhatapsiz: '' })}
            />
            <Field label="Gider kategorisi">
              {(props) => (
                <SelectInput
                  {...props}
                  value={filters.kategori}
                  onChange={(event) => update({ kategori: event.target.value })}
                >
                  <option value="">Tümü</option>
                  <option value="yok">Kategorisiz</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.isActive ? '' : ' (pasif)'}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field label="Anlaşma bağlantısı">
              {(props) => (
                <SelectInput
                  {...props}
                  value={filters.bag}
                  onChange={(event) => update({ bag: event.target.value })}
                >
                  <option value="">Tümü</option>
                  <option value="bagli">Anlaşmaya bağlı</option>
                  <option value="bagsiz">Anlaşmaya bağlı değil</option>
                </SelectInput>
              )}
            </Field>
            <Field label="Kaydı oluşturan">
              {(props) => (
                <SelectInput
                  {...props}
                  value={filters.olusturan}
                  onChange={(event) => update({ olusturan: event.target.value })}
                >
                  <option value="">Herkes</option>
                  {(users.data ?? []).map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                      {user.isActive ? '' : ' (pasif)'}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field label="En az tutar">
              {(props) => (
                <MoneyInput
                  {...props}
                  value={filters.tutarMin}
                  onChange={(tutarMin) => update({ tutarMin })}
                />
              )}
            </Field>
            <Field label="En çok tutar">
              {(props) => (
                <MoneyInput
                  {...props}
                  value={filters.tutarMax}
                  onChange={(tutarMax) => update({ tutarMax })}
                />
              )}
            </Field>
            <Field label="Sıralama">
              {(props) => (
                <SelectInput
                  {...props}
                  value={filters.sirala}
                  onChange={(event) => update({ sirala: event.target.value })}
                >
                  <option value="newest">Yeniden eskiye</option>
                  <option value="oldest">Eskiden yeniye</option>
                  <option value="amount_desc">Tutar azalan</option>
                  <option value="amount_asc">Tutar artan</option>
                </SelectInput>
              )}
            </Field>
            <div className="filter-panel__checks">
              <Checkbox
                label="Muhatapsız kayıtlar"
                checked={filters.muhatapsiz === '1'}
                onChange={(event) =>
                  update({ muhatapsiz: event.target.checked ? '1' : '', kisi: '' })
                }
              />
              <Checkbox
                label="Silinenleri göster"
                checked={filters.silinen === '1'}
                onChange={(event) => update({ silinen: event.target.checked ? '1' : '' })}
              />
            </div>
          </div>
        ) : null}
      </Panel>

      {query.isPending ? (
        <Loading />
      ) : query.error || !data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <section className="panel summary-strip" aria-label="Filtrelenmiş toplamlar">
            <div className="summary-strip__item">
              <span className="summary-strip__label">Tahsilat (net)</span>
              <span className="summary-strip__value amount--income">
                {formatMoney(data.totals.netIncome)}
              </span>
              <span className="summary-strip__sub">
                {data.totals.incomeRefund > 0
                  ? `Tahsilat iadesi düşüldü: ${formatMoney(data.totals.incomeRefund)}`
                  : 'Tahsilat iadesi yok'}
              </span>
            </div>
            <div className="summary-strip__item">
              <span className="summary-strip__label">Ödeme (net)</span>
              <span className="summary-strip__value amount--expense">
                {formatMoney(data.totals.netExpense)}
              </span>
              <span className="summary-strip__sub">
                {data.totals.expenseRefund > 0
                  ? `Ödeme iadesi düşüldü: ${formatMoney(data.totals.expenseRefund)}`
                  : 'Ödeme iadesi yok'}
              </span>
            </div>
            <div className="summary-strip__item">
              <span className="summary-strip__label">Gelir − gider farkı</span>
              <span className="summary-strip__value">{formatSigned(data.totals.difference)}</span>
              <span className="summary-strip__sub">
                {data.total} kaydın tamamı
                {scopedToProject ? ' · yalnız bu şantiyeye düşen paylar' : ''}
              </span>
            </div>
          </section>

          <Panel label="İşlem listesi">
            {data.items.length === 0 ? (
              <EmptyState
                title="Filtrelere uyan kayıt bulunamadı"
                actions={
                  <>
                    {activeCount > 0 ? (
                      <Button variant="secondary" onClick={clearAll}>
                        Filtreleri temizle
                      </Button>
                    ) : null}
                    {filters.donem !== 'tumu' ? (
                      <Button variant="ghost" onClick={() => update({ donem: 'tumu' })}>
                        Bütün tarihleri göster
                      </Button>
                    ) : null}
                  </>
                }
              />
            ) : (
              <TransactionTable items={data.items} showScopedAmount={Boolean(filters.kapsam)} />
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

/** Etkin filtrelerin etiketleri; kaldırınca ilgili alan varsayılana döner. */
function filterChips(
  f: TransactionFilters,
  names: {
    projectName: (id: string) => string | undefined;
    partyName: string | undefined;
    categoryName: (id: string) => string | undefined;
    userName: (id: string) => string | undefined;
  },
): { key: string; label: string; reset: Partial<TransactionFilters> }[] {
  const chips: { key: string; label: string; reset: Partial<TransactionFilters> }[] = [];
  if (f.q) chips.push({ key: 'q', label: `Arama: ${f.q}`, reset: { q: '' } });
  if (f.donem === 'aralik') {
    const range = `${f.baslangic ? formatDate(f.baslangic) : '…'} – ${f.bitis ? formatDate(f.bitis) : '…'}`;
    chips.push({ key: 'donem', label: range, reset: { donem: 'tumu', baslangic: '', bitis: '' } });
  } else if (PERIOD_LABEL[f.donem]) {
    chips.push({ key: 'donem', label: PERIOD_LABEL[f.donem]!, reset: { donem: 'tumu' } });
  }
  if (KIND_FILTER_LABEL[f.tur]) {
    chips.push({ key: 'tur', label: `Tür: ${KIND_FILTER_LABEL[f.tur]}`, reset: { tur: 'all' } });
  }
  if (f.kapsam) {
    const label =
      f.kapsam === 'genel'
        ? 'Firma geneli'
        : f.kapsam
            .split(',')
            .map((id) => names.projectName(id) ?? 'Şantiye')
            .join(', ');
    chips.push({ key: 'kapsam', label: `Kapsam: ${label}`, reset: { kapsam: '' } });
  }
  if (f.kisi) {
    chips.push({ key: 'kisi', label: `Kişi: ${names.partyName ?? '…'}`, reset: { kisi: '' } });
  }
  if (f.muhatapsiz === '1') {
    chips.push({ key: 'muhatapsiz', label: 'Muhatapsız', reset: { muhatapsiz: '' } });
  }
  if (f.kategori) {
    const label = f.kategori === 'yok' ? 'Kategorisiz' : (names.categoryName(f.kategori) ?? '…');
    chips.push({ key: 'kategori', label: `Kategori: ${label}`, reset: { kategori: '' } });
  }
  if (f.bag) {
    chips.push({
      key: 'bag',
      label: f.bag === 'bagli' ? 'Anlaşmaya bağlı' : 'Anlaşmaya bağlı değil',
      reset: { bag: '' },
    });
  }
  if (f.olusturan) {
    const label = names.userName(f.olusturan) ?? '…';
    chips.push({ key: 'olusturan', label: `Oluşturan: ${label}`, reset: { olusturan: '' } });
  }
  if (f.tutarMin) {
    chips.push({ key: 'tutarMin', label: `En az ${f.tutarMin} TL`, reset: { tutarMin: '' } });
  }
  if (f.tutarMax) {
    chips.push({ key: 'tutarMax', label: `En çok ${f.tutarMax} TL`, reset: { tutarMax: '' } });
  }
  if (f.silinen === '1') {
    chips.push({ key: 'silinen', label: 'Silinenler dahil', reset: { silinen: '' } });
  }
  return chips;
}
