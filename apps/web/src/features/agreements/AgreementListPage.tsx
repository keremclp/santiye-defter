import type { DirectionSummary } from '@santiye/shared';
import { History, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAgreements, useParty } from '../../api/queries';
import type { ObligationSummary } from '../../api/types';
import { Badge } from '../../components/ui/Amount';
import { Button, ButtonLink } from '../../components/ui/Button';
import { PageHeader, Pagination, Panel } from '../../components/ui/Card';
import { FilterChips, Segment } from '../../components/ui/Chips';
import { Checkbox, Field, SelectInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { EmptyState, ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatMoney } from '../../lib/format';
import { PartyPicker } from '../common/Pickers';
import { useProjectOptions } from '../common/project-options';
import { AgreementTable, BalanceFlags } from '../common/RecordTables';

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

type Filters = typeof DEFAULTS;

/** "Filtreler" panelindeki ek filtreler; düğmedeki sayı bunlardan etkin olanlardır. */
const PANEL_KEYS = ['kapsam', 'kisi', 'tur', 'is', 'odeme', 'vade', 'kalan'] as const;

const KIND_LABEL: Record<string, string> = {
  agreement: 'Yalnız anlaşmalar',
  opening: 'Yalnız başlangıç kayıtları',
};
const WORK_LABEL: Record<string, string> = {
  ongoing: 'Devam ediyor',
  completed: 'İş tamamlandı',
  cancelled: 'İptal',
};
const PAYMENT_LABEL: Record<string, string> = {
  open: 'Ödeme/tahsilat yok',
  partial: 'Kısmi',
  settled: 'Kapandı',
  overpaid: 'Fazla ödeme/tahsilat',
};
const DUE_LABEL: Record<string, string> = {
  overdue: 'Gecikmiş',
  upcoming: 'Yaklaşan (30 gün)',
  later: 'Daha sonra',
  none: 'Vadesi belirlenmemiş',
};

function StripItem({
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
    <div className="summary-strip__item">
      <span className="summary-strip__label">{title}</span>
      <span className="summary-strip__value">{formatMoney(summary.remaining)}</span>
      <span className="summary-strip__sub">
        Bedel {formatMoney(summary.totalAmount)} · {payable ? 'ödenen' : 'tahsil edilen'}{' '}
        {formatMoney(summary.netSettled)}
        {opening.totalAmount > 0 ? ` · başlangıç kalanı ${formatMoney(opening.remaining)}` : ''}
      </span>
      <span className="metric__sub">
        <BalanceFlags summary={summary} payable={payable} />
      </span>
    </div>
  );
}

/** Kalan borç ve alacak bakiyedir: `ink` renkte, ayrı ve mahsup edilmeden (şartname 4.1, 9.1). */
function Totals({ totals, count }: { totals: ObligationSummary; count: number }) {
  return (
    <section className="panel summary-strip" aria-label="Filtrelenmiş toplamlar">
      <StripItem
        title="Kalan borç"
        summary={totals.payable}
        opening={totals.openings.payable}
        payable
      />
      <StripItem
        title="Kalan alacak"
        summary={totals.receivable}
        opening={totals.openings.receivable}
        payable={false}
      />
      <div className="summary-strip__item">
        <span className="summary-strip__label">Kayıt</span>
        <span className="summary-strip__value">{count}</span>
        <span className="summary-strip__sub">Anlaşmalar ve başlangıç kayıtları</span>
      </div>
    </section>
  );
}

/** Anlaşma ve başlangıç borç/alacak listesi (şartname 7.6). */
export function AgreementListPage() {
  usePageMeta('Anlaşmalar');
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
  const panelCount = PANEL_KEYS.filter((key) => f[key] !== DEFAULTS[key]).length;
  const resetAll = () => {
    setSearch('');
    clear();
  };

  const chips = filterChips(f, {
    projectName: (id) => projects.data?.items.find((p) => p.id === id)?.name,
    partyName: party.data?.name,
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
        title="Anlaşmalar"
        subtitle="Ödenecek ve tahsil edilecek anlaşmalar, başlangıç borç ve alacakları"
        actions={
          <>
            <Refreshing active={query.isFetching && !query.isPending} />
            {canWrite ? (
              <>
                <ButtonLink variant="secondary" to="/uygulama/anlasmalar/baslangic/yeni">
                  <Icon icon={History} />
                  Başlangıç borç/alacağı gir
                </ButtonLink>
                <ButtonLink to="/uygulama/anlasmalar/yeni">
                  <Icon icon={Plus} />
                  Anlaşma ekle
                </ButtonLink>
              </>
            ) : null}
          </>
        }
      />

      <Panel label="Filtreler">
        <div className="panel-toolbar">
          <label className="search-box">
            <Icon icon={Search} />
            <input
              type="search"
              placeholder="Anlaşma adı veya açıklama ara"
              aria-label="Anlaşmalarda ara"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Segment
            label="Yön"
            options={[
              { value: '', label: 'Tümü' },
              { value: 'payable', label: 'Ödenecek' },
              { value: 'receivable', label: 'Tahsil edilecek' },
            ]}
            value={f.yon}
            onChange={(yon) => update({ yon })}
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

        {chips.length > 0 ? (
          <div className="panel-toolbar__chips">
            <FilterChips chips={chips} onClear={activeCount > 0 ? resetAll : undefined} />
          </div>
        ) : null}

        {panelOpen ? (
          <div className="filter-panel">
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
            <PartyPicker
              label="Kişi / firma"
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
                  <option value="agreement">{KIND_LABEL.agreement}</option>
                  <option value="opening">{KIND_LABEL.opening}</option>
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
                  {Object.entries(WORK_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
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
                  {Object.entries(PAYMENT_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
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
                  {Object.entries(DUE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <div className="filter-panel__checks">
              <Checkbox
                label="Yalnız kalanı olanlar"
                checked={f.kalan === '1'}
                onChange={(e) => update({ kalan: e.target.checked ? '1' : '' })}
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
          <Totals totals={data.totals} count={data.total} />
          <Panel label="Anlaşma listesi">
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
              )
            ) : (
              <AgreementTable items={data.items} />
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
  f: Filters,
  names: { projectName: (id: string) => string | undefined; partyName: string | undefined },
): { key: string; label: string; reset: Partial<Filters> }[] {
  const chips: { key: string; label: string; reset: Partial<Filters> }[] = [];
  if (f.q) chips.push({ key: 'q', label: `Arama: ${f.q}`, reset: { q: '' } });
  if (f.yon) {
    const label = f.yon === 'payable' ? 'Ödenecek' : 'Tahsil edilecek';
    chips.push({ key: 'yon', label: `Yön: ${label}`, reset: { yon: '' } });
  }
  if (f.kapsam) {
    const label = f.kapsam === 'genel' ? 'Firma geneli' : (names.projectName(f.kapsam) ?? '…');
    chips.push({ key: 'kapsam', label: `Kapsam: ${label}`, reset: { kapsam: '' } });
  }
  if (f.kisi) {
    chips.push({ key: 'kisi', label: `Kişi: ${names.partyName ?? '…'}`, reset: { kisi: '' } });
  }
  if (KIND_LABEL[f.tur]) chips.push({ key: 'tur', label: KIND_LABEL[f.tur]!, reset: { tur: '' } });
  if (WORK_LABEL[f.is]) {
    chips.push({ key: 'is', label: `İş: ${WORK_LABEL[f.is]}`, reset: { is: '' } });
  }
  if (PAYMENT_LABEL[f.odeme]) {
    chips.push({ key: 'odeme', label: `Ödeme: ${PAYMENT_LABEL[f.odeme]}`, reset: { odeme: '' } });
  }
  if (DUE_LABEL[f.vade]) {
    chips.push({ key: 'vade', label: `Vade: ${DUE_LABEL[f.vade]}`, reset: { vade: '' } });
  }
  if (f.kalan === '1') {
    chips.push({ key: 'kalan', label: 'Yalnız kalanı olanlar', reset: { kalan: '' } });
  }
  return chips;
}
