import { useEffect, useState } from 'react';
import { useCategories, useCompanyUsers, useParty, useTransactions } from '../../api/queries';
import { ButtonLink, Button } from '../../components/ui/Button';
import { Pagination, PageHeader } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/Chips';
import { Checkbox, DateInput, Field, SelectInput, TextInput } from '../../components/ui/Field';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatMoney } from '../../lib/format';
import { PartyPicker } from '../common/Pickers';
import { useProjectOptions } from '../common/project-options';
import { TransactionTable } from '../common/RecordTables';
import { TRANSACTION_FILTER_DEFAULTS, transactionQuery } from './transaction-filters';

/** Gelir, gider ve iade listesi (şartname 7.4). Filtreler URL'de; özet bütün sonuçları kapsar. */
export function TransactionListPage() {
  usePageMeta('İşlemler');
  const phone = usePhone();
  const { canWrite } = useWriteAccess();
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

  const showPanel = !phone || panelOpen;
  const data = query.data;

  return (
    <main className="page">
      <PageHeader
        title="İşlemler"
        actions={
          canWrite ? (
            <>
              <ButtonLink variant="income" to="/uygulama/islemler/yeni?tur=gelir">
                Gelir ekle
              </ButtonLink>
              <ButtonLink variant="expense" to="/uygulama/islemler/yeni?tur=gider">
                Gider ekle
              </ButtonLink>
            </>
          ) : null
        }
      />

      <section className="card stack" aria-label="Filtreler">
        <div className="toolbar">
          <Field label="Ara">
            {(props) => (
              <TextInput
                {...props}
                type="search"
                placeholder="Açıklama, kişi, şantiye, kayıt no, tutar"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
          </Field>
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
        </div>
        <ChipGroup
          label="Tarih"
          options={[
            { value: 'bugun', label: 'Bugün' },
            { value: 'buay', label: 'Bu ay' },
            { value: 'tumu', label: 'Tümü' },
            { value: 'aralik', label: 'Tarih aralığı' },
          ]}
          value={filters.donem}
          onChange={(donem) => update({ donem })}
        />
        {filters.donem === 'aralik' ? (
          <div className="form-grid">
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

        {phone ? (
          <Button
            variant="ghost"
            size="small"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((open) => !open)}
          >
            {panelOpen ? 'Diğer filtreleri gizle' : 'Diğer filtreler'}
          </Button>
        ) : null}

        {showPanel ? (
          <div className="stack">
            <ChipGroup
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
            <div className="form-grid">
              <PartyPicker
                label="Kişi/firma"
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
            </div>
            <div className="row">
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

        <div className="filter-summary">
          <span>
            {data ? `${data.total} kayıt` : 'Kayıtlar yükleniyor'}
            {activeCount > 0 ? ` · ${activeCount} filtre seçili` : ''}
          </span>
          {activeCount > 0 ? (
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
          ) : null}
          <Refreshing active={query.isFetching && !query.isPending} />
        </div>
      </section>

      {query.isPending ? (
        <Loading />
      ) : query.error || !data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <section className="totals-bar" aria-label="Filtrelenmiş toplamlar">
            <div className="stat stat--income">
              <span className="stat__label">Tahsilat (net)</span>
              <span className="stat__value">{formatMoney(data.totals.netIncome)}</span>
              {data.totals.incomeRefund > 0 ? (
                <span className="stat__hint">
                  Tahsilat iadesi düşüldü: {formatMoney(data.totals.incomeRefund)}
                </span>
              ) : null}
            </div>
            <div className="stat stat--expense">
              <span className="stat__label">Ödeme (net)</span>
              <span className="stat__value">{formatMoney(data.totals.netExpense)}</span>
              {data.totals.expenseRefund > 0 ? (
                <span className="stat__hint">
                  Ödeme iadesi düşüldü: {formatMoney(data.totals.expenseRefund)}
                </span>
              ) : null}
            </div>
            <div className="stat">
              <span className="stat__label">Gelir − gider farkı</span>
              <span className="stat__value">{formatMoney(data.totals.difference)}</span>
            </div>
          </section>
          {filters.kapsam && filters.kapsam !== 'genel' ? (
            <p className="meta">
              Paylaştırılmış kayıtlarda toplamlara yalnız seçili şantiyeye düşen pay girer.
            </p>
          ) : null}
          {data.items.length === 0 ? (
            <EmptyState
              title="Filtrelere uyan kayıt bulunamadı"
              actions={
                <>
                  {activeCount > 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch('');
                        clear();
                      }}
                    >
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
