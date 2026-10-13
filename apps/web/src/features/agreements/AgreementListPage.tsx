import type { DirectionSummary } from '@santiye/shared';
import { useEffect, useState } from 'react';
import { useAgreements, useParty } from '../../api/queries';
import type { ObligationSummary } from '../../api/types';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card, PageHeader, Pagination } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/Chips';
import { Checkbox, Field, SelectInput, TextInput } from '../../components/ui/Field';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePhone } from '../../hooks/useMediaQuery';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatMoney } from '../../lib/format';
import { PartyPicker } from '../common/Pickers';
import { useProjectOptions } from '../common/project-options';
import { AgreementTable } from '../common/RecordTables';

const DEFAULTS = {
  q: '',
  yon: '',
  tur: '',
  kapsam: '',
  kisi: '',
  is: '',
  odeme: '',
  vade: '',
  kalan: '',
  page: '1',
};

function SummaryColumn({
  title,
  summary,
  opening,
  payable,
}: {
  title: string;
  summary: DirectionSummary;
  opening: DirectionSummary;
  payable: boolean;
}) {
  return (
    <div className={payable ? 'stat stat--expense' : 'stat stat--income'}>
      <span className="stat__label">{title}</span>
      <span className="stat__value">{formatMoney(summary.remaining)}</span>
      <span className="stat__hint">
        Bedel {formatMoney(summary.totalAmount)} · {payable ? 'ödenen' : 'tahsil edilen'}{' '}
        {formatMoney(summary.netSettled)}
      </span>
      {summary.overdue > 0 ? (
        <span className="stat__hint">Gecikmiş: {formatMoney(summary.overdue)}</span>
      ) : null}
      {summary.excess > 0 ? (
        <span className="stat__hint">
          {payable ? 'Fazla ödeme' : 'Fazla tahsilat'}: {formatMoney(summary.excess)}
        </span>
      ) : null}
      {opening.totalAmount > 0 ? (
        <span className="stat__hint">
          Bunun başlangıç kayıtları kalanı: {formatMoney(opening.remaining)}
        </span>
      ) : null}
    </div>
  );
}

function Totals({ totals }: { totals: ObligationSummary }) {
  return (
    <section className="stack stack--sm" aria-label="Filtrelenmiş toplamlar">
      <p className="meta">Anlaşmalar ve başlangıç kayıtları — bütün filtrelenmiş sonuçlar</p>
      <div className="totals-bar">
        <SummaryColumn
          title="Kalan borç"
          summary={totals.payable}
          opening={totals.openings.payable}
          payable
        />
        <SummaryColumn
          title="Kalan alacak"
          summary={totals.receivable}
          opening={totals.openings.receivable}
          payable={false}
        />
      </div>
    </section>
  );
}

/** Anlaşma ve başlangıç borç/alacak listesi (şartname 7.6). */
export function AgreementListPage() {
  usePageMeta('Anlaşmalar');
  const phone = usePhone();
  const { canWrite } = useWriteAccess();
  const { values: f, update, clear, activeCount } = useUrlFilters(DEFAULTS);
  const [search, setSearch] = useState(f.q);
  const [panelOpen, setPanelOpen] = useState(false);
  const projects = useProjectOptions();
  const party = useParty(f.kisi || null);

  useEffect(() => {
    if (search === f.q) return;
    const timer = window.setTimeout(() => update({ q: search }), 350);
    return () => window.clearTimeout(timer);
  }, [search, f.q, update]);

  const query = useAgreements({
    q: f.q || undefined,
    direction: f.yon || undefined,
    kind: f.tur || undefined,
    ...(f.kapsam === 'genel' ? { scope: 'company' } : f.kapsam ? { projectId: f.kapsam } : {}),
    partyId: f.kisi || undefined,
    workStatus: f.is || undefined,
    paymentStatus: f.odeme || undefined,
    dueState: f.vade || undefined,
    remainingOnly: f.kalan === '1' ? 'true' : undefined,
    page: Number(f.page) || 1,
    limit: 50,
  });
  const data = query.data;
  const resetAll = () => {
    setSearch('');
    clear();
  };

  return (
    <main className="page">
      <PageHeader
        title="Anlaşmalar"
        subtitle="Ödenecek ve tahsil edilecek anlaşmalar, başlangıç borç ve alacakları"
        actions={
          canWrite ? (
            <>
              <ButtonLink to="/uygulama/anlasmalar/yeni">Anlaşma ekle</ButtonLink>
              <ButtonLink variant="secondary" to="/uygulama/anlasmalar/baslangic/yeni">
                Başlangıç borç/alacağı gir
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
                placeholder="Anlaşma adı veya açıklama"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
          </Field>
          <Field label="Kapsam">
            {(props) => (
              <SelectInput
                {...props}
                value={f.kapsam}
                onChange={(e) => update({ kapsam: e.target.value })}
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
          label="Yön"
          options={[
            { value: '', label: 'Tümü' },
            { value: 'payable', label: 'Ödenecek' },
            { value: 'receivable', label: 'Tahsil edilecek' },
          ]}
          value={f.yon}
          onChange={(yon) => update({ yon })}
        />
        {phone ? (
          <Button
            variant="ghost"
            size="small"
            aria-expanded={panelOpen}
            onClick={() => setPanelOpen((o) => !o)}
          >
            {panelOpen ? 'Diğer filtreleri gizle' : 'Diğer filtreler'}
          </Button>
        ) : null}
        {!phone || panelOpen ? (
          <div className="form-grid">
            <PartyPicker
              label="Kişi/firma"
              value={f.kisi && party.data ? { id: party.data.id, name: party.data.name } : null}
              onChange={(next) => update({ kisi: next?.id ?? '' })}
            />
            <Field label="Kayıt türü">
              {(props) => (
                <SelectInput
                  {...props}
                  value={f.tur}
                  onChange={(e) => update({ tur: e.target.value })}
                >
                  <option value="">Anlaşma ve başlangıç</option>
                  <option value="agreement">Yalnız anlaşmalar</option>
                  <option value="opening">Yalnız başlangıç kayıtları</option>
                </SelectInput>
              )}
            </Field>
            <Field label="İş durumu">
              {(props) => (
                <SelectInput
                  {...props}
                  value={f.is}
                  onChange={(e) => update({ is: e.target.value })}
                >
                  <option value="">Tümü</option>
                  <option value="ongoing">Devam ediyor</option>
                  <option value="completed">İş tamamlandı</option>
                  <option value="cancelled">İptal</option>
                </SelectInput>
              )}
            </Field>
            <Field label="Ödeme durumu">
              {(props) => (
                <SelectInput
                  {...props}
                  value={f.odeme}
                  onChange={(e) => update({ odeme: e.target.value })}
                >
                  <option value="">Tümü</option>
                  <option value="open">Ödeme/tahsilat yok</option>
                  <option value="partial">Kısmi</option>
                  <option value="settled">Kapandı</option>
                  <option value="overpaid">Fazla ödeme/tahsilat</option>
                </SelectInput>
              )}
            </Field>
            <Field label="Vade durumu">
              {(props) => (
                <SelectInput
                  {...props}
                  value={f.vade}
                  onChange={(e) => update({ vade: e.target.value })}
                >
                  <option value="">Tümü</option>
                  <option value="overdue">Gecikmiş</option>
                  <option value="upcoming">Yaklaşan (30 gün)</option>
                  <option value="later">Daha sonra</option>
                  <option value="none">Vadesi belirlenmemiş</option>
                </SelectInput>
              )}
            </Field>
            <Checkbox
              label="Yalnız kalanı olanlar"
              checked={f.kalan === '1'}
              onChange={(e) => update({ kalan: e.target.checked ? '1' : '' })}
            />
          </div>
        ) : null}
        <div className="filter-summary">
          <span>
            {data ? `${data.total} kayıt` : 'Kayıtlar yükleniyor'}
            {activeCount > 0 ? ` · ${activeCount} filtre seçili` : ''}
          </span>
          {activeCount > 0 ? (
            <Button variant="ghost" size="small" onClick={resetAll}>
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
          <Totals totals={data.totals} />
          {data.items.length === 0 ? (
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
              <Card>
                <EmptyState
                  title="Henüz anlaşma yok"
                  description="Taşeron, tedarikçi veya müşteri anlaşmalarını ve uygulamaya geçmeden önce açık kalan borç/alacakları buradan takip edin."
                  actions={
                    canWrite ? (
                      <>
                        <ButtonLink to="/uygulama/anlasmalar/yeni">Anlaşma ekle</ButtonLink>
                        <ButtonLink variant="secondary" to="/uygulama/anlasmalar/baslangic/yeni">
                          Başlangıç borç/alacağı gir
                        </ButtonLink>
                      </>
                    ) : null
                  }
                />
              </Card>
            )
          ) : (
            <AgreementTable items={data.items} />
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
