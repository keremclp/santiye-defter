import { todayInIstanbul } from '@santiye/shared';
import { BarChart3, Building2, CalendarClock, UserRound } from 'lucide-react';
import { useCategories, useParty } from '../../api/queries';
import { ButtonLink } from '../../components/ui/Button';
import { PageHeader, Panel } from '../../components/ui/Card';
import { Segment } from '../../components/ui/Chips';
import { Field, SelectInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { EmptyState } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { PROJECT_STATUS_LABEL } from '../../lib/labels';
import { PartyPicker } from '../common/Pickers';
import { useProjectOptions } from '../common/project-options';
import { FullExportPanel } from './FullExportPanel';
import { RANGE_DEFAULTS, rangeParams } from './report-params';
import { RangeFilter } from './ReportParts';
import {
  OpenBalancesView,
  PartyReportView,
  PeriodReportView,
  ProjectReportView,
} from './ReportViews';

const TABS = [
  { value: 'donem', label: 'Dönem dökümü', icon: BarChart3 },
  { value: 'santiye', label: 'Şantiye raporu', icon: Building2 },
  { value: 'kisi', label: 'Kişi/firma hesap dökümü', icon: UserRound },
  { value: 'acik', label: 'Açık borç/alacak ve vade', icon: CalendarClock },
] as const;

const DEFAULTS = {
  rapor: 'donem',
  ...RANGE_DEFAULTS,
  donem: 'buay',
  kapsam: '',
  kategori: '',
  santiye: '',
  kisi: '',
  yon: 'all',
};
type Filters = typeof DEFAULTS;

/** Kapsam seçimi: tüm firma, firma geneli kayıtlar veya bir şantiye (tamamlanan/arşivlenen dahil). */
function ScopeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const projects = useProjectOptions();
  return (
    <Field label="Kapsam">
      {(props) => (
        <SelectInput {...props} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Tüm firma (şantiyeler ve firma geneli)</option>
          <option value="genel">Firma geneli kayıtlar</option>
          {(projects.data?.items ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
              {project.status === 'active' ? '' : ` (${PROJECT_STATUS_LABEL[project.status]})`}
            </option>
          ))}
        </SelectInput>
      )}
    </Field>
  );
}

const scopeParams = (kapsam: string) =>
  kapsam === 'genel' ? { scope: 'company' } : kapsam ? { projectId: kapsam } : {};

function PeriodTab({ f, update }: { f: Filters; update: (patch: Partial<Filters>) => void }) {
  const categories = useCategories(true);
  const params = {
    ...rangeParams(f, todayInIstanbul()),
    ...scopeParams(f.kapsam),
    ...(f.kategori === 'yok'
      ? { uncategorized: 'true' }
      : f.kategori
        ? { categoryId: f.kategori }
        : {}),
  };
  return (
    <>
      <Panel label="Rapor filtreleri">
        <div className="panel-toolbar">
          <RangeFilter filters={f} onChange={update} />
        </div>
        <div className="filter-panel">
          <ScopeSelect value={f.kapsam} onChange={(kapsam) => update({ kapsam })} />
          <Field label="Gider kategorisi">
            {(props) => (
              <SelectInput
                {...props}
                value={f.kategori}
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
        </div>
      </Panel>
      <PeriodReportView params={params} />
    </>
  );
}

function ProjectTab({ f, update }: { f: Filters; update: (patch: Partial<Filters>) => void }) {
  const projects = useProjectOptions();
  const params = rangeParams(f, todayInIstanbul());
  return (
    <>
      <Panel label="Rapor filtreleri">
        <div className="filter-panel">
          <Field label="Şantiye">
            {(props) => (
              <SelectInput
                {...props}
                value={f.santiye}
                onChange={(event) => update({ santiye: event.target.value })}
              >
                <option value="">Şantiye seçin</option>
                {(projects.data?.items ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                    {project.status === 'active'
                      ? ''
                      : ` (${PROJECT_STATUS_LABEL[project.status]})`}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>
        </div>
        <div className="panel-toolbar">
          <RangeFilter filters={f} onChange={update} />
          {f.santiye ? (
            <ButtonLink variant="ghost" size="small" to={`/uygulama/projeler/${f.santiye}/rapor`}>
              Şantiye rapor sayfası
            </ButtonLink>
          ) : null}
        </div>
      </Panel>
      {f.santiye ? (
        <ProjectReportView projectId={f.santiye} params={params} />
      ) : (
        <Panel>
          <EmptyState title="Raporu görmek için bir şantiye seçin" />
        </Panel>
      )}
    </>
  );
}

function PartyTab({ f, update }: { f: Filters; update: (patch: Partial<Filters>) => void }) {
  const party = useParty(f.kisi || null);
  const params = rangeParams(f, todayInIstanbul());
  return (
    <>
      <Panel label="Rapor filtreleri">
        <div className="filter-panel">
          <PartyPicker
            label="Kişi / firma"
            value={f.kisi && party.data ? { id: party.data.id, name: party.data.name } : null}
            onChange={(selected) => update({ kisi: selected?.id ?? '' })}
          />
        </div>
        <div className="panel-toolbar">
          <RangeFilter filters={f} onChange={update} />
        </div>
      </Panel>
      {f.kisi ? (
        <PartyReportView partyId={f.kisi} params={params} />
      ) : (
        <Panel>
          <EmptyState title="Hesap dökümü için bir kişi veya firma seçin" />
        </Panel>
      )}
    </>
  );
}

function OpenTab({ f, update }: { f: Filters; update: (patch: Partial<Filters>) => void }) {
  const params = { direction: f.yon, ...scopeParams(f.kapsam) };
  return (
    <>
      <Panel label="Rapor filtreleri">
        <div className="panel-toolbar">
          <Segment
            label="Yön"
            options={[
              { value: 'all', label: 'Borç ve alacak' },
              { value: 'payable', label: 'Borç' },
              { value: 'receivable', label: 'Alacak' },
            ]}
            value={f.yon}
            onChange={(yon) => update({ yon })}
          />
        </div>
        <div className="filter-panel">
          <ScopeSelect value={f.kapsam} onChange={(kapsam) => update({ kapsam })} />
        </div>
      </Panel>
      <OpenBalancesView params={params} />
    </>
  );
}

/**
 * Raporlar (şartname 7.10): dört standart rapor; her biri ekranda görüntülenir ve aynı filtrelerle
 * Excel, CSV veya PDF olarak indirilir. Telefonda da aynı. Altta filtrelerden bağımsız tam firma
 * veri çıkışı.
 */
export function ReportsPage() {
  usePageMeta('Raporlar');
  const { values: f, update } = useUrlFilters(DEFAULTS);
  // Şantiye ve kişi dökümleri varsayılan olarak bütün tarihleri kapsar; dönem dökümü bu ayı.
  const tab = TABS.some((t) => t.value === f.rapor) ? f.rapor : 'donem';

  function selectTab(rapor: string) {
    update({ rapor, donem: rapor === 'donem' ? 'buay' : 'tumu', baslangic: '', bitis: '' });
  }

  return (
    <main className="page">
      <PageHeader
        title="Raporlar"
        subtitle="Standart raporlar · ekranda görüntüle, Excel, CSV veya PDF indir"
      />
      <Panel label="Rapor türü">
        <div className="tabs" role="tablist" aria-label="Rapor türü">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              className="tab"
              aria-selected={tab === item.value}
              onClick={() => selectTab(item.value)}
            >
              <Icon icon={item.icon} />
              {item.label}
            </button>
          ))}
        </div>
      </Panel>
      {tab === 'donem' ? <PeriodTab f={f} update={update} /> : null}
      {tab === 'santiye' ? <ProjectTab f={f} update={update} /> : null}
      {tab === 'kisi' ? <PartyTab f={f} update={update} /> : null}
      {tab === 'acik' ? <OpenTab f={f} update={update} /> : null}
      <FullExportPanel />
    </main>
  );
}
