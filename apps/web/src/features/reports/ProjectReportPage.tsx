import { todayInIstanbul } from '@santiye/shared';
import { useParams } from 'react-router';
import { useProject } from '../../api/queries';
import { PageHeader, Panel } from '../../components/ui/Card';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { RANGE_DEFAULTS, rangeParams } from './report-params';
import { RangeFilter } from './ReportParts';
import { ProjectReportView } from './ReportViews';

/** Şantiye özeti ve hareket dökümü (`/uygulama/projeler/:id/rapor`, şartname 7.10). */
export function ProjectReportPage() {
  const { id = '' } = useParams();
  const project = useProject(id);
  const name = project.data?.name;
  usePageMeta(name ? `${name} — Şantiye raporu` : 'Şantiye raporu');
  const { values: f, update } = useUrlFilters(RANGE_DEFAULTS);

  return (
    <main className="page">
      <PageHeader
        title="Şantiye raporu"
        subtitle={name ? `${name} · özet ve hareket dökümü` : 'Özet ve hareket dökümü'}
        back={{ to: `/uygulama/projeler/${id}`, label: name ?? 'Şantiye' }}
      />
      <Panel label="Rapor filtreleri">
        <div className="panel-toolbar">
          <RangeFilter filters={f} onChange={update} />
        </div>
      </Panel>
      <ProjectReportView projectId={id} params={rangeParams(f, todayInIstanbul())} />
    </main>
  );
}
