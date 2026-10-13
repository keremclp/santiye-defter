import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router';
import { ButtonLink } from '../components/ui/Button';
import { Panel } from '../components/ui/Card';
import { Icon } from '../components/ui/Icon';
import { usePageMeta } from '../hooks/usePageMeta';
import { useSession } from '../stores/session';

export function NotFoundPage() {
  usePageMeta('Sayfa bulunamadı');
  const signedIn = useSession((s) => Boolean(s.accessToken));
  return (
    <main className="page">
      <Panel>
        <div className="empty-state">
          <h1>Sayfa bulunamadı</h1>
          <p className="muted">Adres yanlış olabilir veya bu kayda erişilemiyor.</p>
          <div className="empty-state__actions">
            <ButtonLink variant="secondary" to={signedIn ? '/uygulama' : '/giris'}>
              <Icon icon={ChevronLeft} />
              {signedIn ? 'Özete dön' : 'Girişe dön'}
            </ButtonLink>
          </div>
        </div>
      </Panel>
    </main>
  );
}

/** "Demoyu dene" bağlantısının hedefi; hesapsız demo ayrı geliştirme adımında açılacak. */
export function DemoPlaceholderPage() {
  usePageMeta('Demo');
  return (
    <main className="auth-layout">
      <div className="auth-card">
        <div className="nav-brand">
          <span className="nav-brand__mark" aria-hidden="true">
            ŞH
          </span>
          <span className="nav-brand__text">
            <span className="nav-brand__name">Şantiye Hesap</span>
          </span>
        </div>
        <div className="auth-card__head">
          <h1>Demo</h1>
          <p>Hesapsız demo yakında burada açılacak.</p>
        </div>
        <div className="auth-links">
          <Link to="/giris">
            <Icon icon={ChevronLeft} />
            Girişe dön
          </Link>
        </div>
      </div>
    </main>
  );
}
