import { Database, Info } from 'lucide-react';
import { PageHeader, Panel } from '../../components/ui/Card';
import { usePageMeta } from '../../hooks/usePageMeta';

/** Hakkında: ürün adı, slogan, sürüm (şartname 7.11). */
export function AboutPage() {
  usePageMeta('Hakkında');
  return (
    <main className="page">
      <PageHeader title="Hakkında" back={{ to: '/uygulama/ayarlar', label: 'Ayarlar' }} />
      <div className="form-columns">
        <Panel title="Şantiye Hesap" icon={Info}>
          <p className="panel__note">Şantiye parasını net ve hızlı yönetin.</p>
          <dl className="definition-list">
            <dt>Sürüm</dt>
            <dd>{__APP_VERSION__}</dd>
            <dt>Dil</dt>
            <dd>Türkçe</dd>
          </dl>
        </Panel>
        <Panel title="Veriler" icon={Database}>
          <p className="panel__note">Veriler sunucuda saklanır; her firmanın kayıtları ayrıdır.</p>
        </Panel>
      </div>
    </main>
  );
}
