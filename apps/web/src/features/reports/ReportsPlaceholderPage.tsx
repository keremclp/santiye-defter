import { useParams } from 'react-router';
import { PageHeader, Panel } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';

/** Raporlar ve şantiye raporu için yer tutucu; rapor ve veri çıkışı ayrı geliştirme adımında. */
export function ReportsPlaceholderPage() {
  const { id } = useParams();
  usePageMeta('Raporlar');
  return (
    <main className="page">
      <PageHeader
        title={id ? 'Şantiye özeti ve hareket dökümü' : 'Raporlar'}
        back={id ? { to: `/uygulama/projeler/${id}`, label: 'Şantiye' } : undefined}
      />
      <Panel>
        <EmptyState
          title="Raporlar hazırlanıyor"
          description="Dönem dökümü, şantiye özeti, kişi/firma hesap dökümü, açık borç/alacak listesi ve tam veri çıkışı (Excel, CSV, PDF) bu sayfada olacak."
        />
      </Panel>
    </main>
  );
}
