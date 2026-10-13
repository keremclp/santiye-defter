import { Card, PageHeader } from '../../components/ui/Card';
import { usePageMeta } from '../../hooks/usePageMeta';

/** Hakkında: ürün adı, slogan, sürüm (şartname 7.11). */
export function AboutPage() {
  usePageMeta('Hakkında');
  return (
    <main className="page">
      <PageHeader title="Hakkında" back={{ to: '/uygulama/ayarlar', label: 'Ayarlar' }} />
      <Card>
        <h2>Şantiye Hesap</h2>
        <p>Şantiye parasını net ve hızlı yönetin.</p>
        <dl className="definition-list">
          <dt>Sürüm</dt>
          <dd>{__APP_VERSION__}</dd>
          <dt>Veriler</dt>
          <dd>Veriler sunucuda saklanır; her firmanın kayıtları ayrıdır.</dd>
          <dt>Dil</dt>
          <dd>Türkçe</dd>
        </dl>
      </Card>
    </main>
  );
}
