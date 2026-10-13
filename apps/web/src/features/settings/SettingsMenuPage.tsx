import { Building2, ChevronRight, Info, KeyRound, Tags, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { usePageMeta } from '../../hooks/usePageMeta';

const ITEMS = [
  { to: 'profil', icon: UserRound, title: 'Profil', text: 'Görünen ad ve iletişim bilgileriniz' },
  { to: 'sifre', icon: KeyRound, title: 'Şifre', text: 'Şifrenizi değiştirin' },
  {
    to: 'firma',
    icon: Building2,
    title: 'Firma',
    text: 'Ortak firma adı, iletişim, depolama ve hizmet durumu',
  },
  {
    to: 'kategoriler',
    icon: Tags,
    title: 'Gider kategorileri',
    text: 'Ekle, yeniden adlandır, pasifleştir',
  },
  { to: 'hakkinda', icon: Info, title: 'Hakkında', text: 'Sürüm ve ürün notu' },
];

/** Ayarlar menüsü (şartname 5.2, 7.11): her bölüm ayrı panel, geniş ekranda yan yana. */
export function SettingsMenuPage() {
  usePageMeta('Ayarlar');
  return (
    <main className="page">
      <PageHeader title="Ayarlar" subtitle="Hesap, firma ve kategori ayarları" />
      <nav aria-label="Ayarlar">
        <ul className="settings-grid">
          {ITEMS.map((item) => (
            <li key={item.to}>
              <Link className="panel settings-card" to={`/uygulama/ayarlar/${item.to}`}>
                <span className="icon-box icon-box--lg icon-box--primary">
                  <Icon icon={item.icon} />
                </span>
                <span className="list-row__main">
                  <span className="list-row__title">{item.title}</span>
                  <span className="list-row__meta block">{item.text}</span>
                </span>
                <span className="chevron">
                  <Icon icon={ChevronRight} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
