import { Link } from 'react-router';
import { usePageMeta } from '../hooks/usePageMeta';
import { useSession } from '../stores/session';

export function NotFoundPage() {
  usePageMeta('Sayfa bulunamadı');
  const signedIn = useSession((s) => Boolean(s.accessToken));
  return (
    <main className="page page--narrow">
      <div className="empty-state">
        <h1>Sayfa bulunamadı</h1>
        <p className="muted">Adres yanlış olabilir veya bu kayda erişilemiyor.</p>
        <Link to={signedIn ? '/uygulama' : '/giris'}>{signedIn ? 'Özete dön' : 'Girişe dön'}</Link>
      </div>
    </main>
  );
}

/** "Demoyu dene" bağlantısının hedefi; hesapsız demo ayrı geliştirme adımında açılacak. */
export function DemoPlaceholderPage() {
  usePageMeta('Demo');
  return (
    <main className="auth-layout">
      <div className="auth-card">
        <p className="auth-card__brand">Şantiye Hesap</p>
        <h1>Demo</h1>
        <p>Hesapsız demo yakında burada açılacak.</p>
        <Link to="/giris">← Girişe dön</Link>
      </div>
    </main>
  );
}
