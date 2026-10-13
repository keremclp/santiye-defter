import { Link } from 'react-router';
import { PageHeader } from '../../components/ui/Card';
import { usePageMeta } from '../../hooks/usePageMeta';

const ITEMS = [
  { to: 'profil', title: 'Profil', text: 'Görünen ad ve iletişim bilgileriniz' },
  { to: 'sifre', title: 'Şifre', text: 'Şifrenizi değiştirin' },
  { to: 'firma', title: 'Firma', text: 'Ortak firma adı, iletişim, depolama ve hizmet durumu' },
  { to: 'kategoriler', title: 'Gider kategorileri', text: 'Ekle, yeniden adlandır, pasifleştir' },
  { to: 'hakkinda', title: 'Hakkında', text: 'Sürüm ve ürün notu' },
];

/** Ayarlar menüsü (şartname 5.2, 7.11). */
export function SettingsMenuPage() {
  usePageMeta('Ayarlar');
  return (
    <main className="page">
      <PageHeader title="Ayarlar" />
      <ul className="item-list">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <Link className="item-card" to={`/uygulama/ayarlar/${item.to}`}>
              <div className="item-card__main">
                <span className="item-card__title">{item.title}</span>
                <span className="meta">{item.text}</span>
              </div>
              <span aria-hidden="true">›</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
