import { ChevronLeft, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router';
import { Icon } from '../../components/ui/Icon';
import { usePageMeta } from '../../hooks/usePageMeta';
import { SUPPORT_CONTACT_TEXT } from '../../lib/support';

/** Şifremi unuttum: e-posta gönderimi yok; ürün sahibine nasıl ulaşılacağı (şartname 7.12). */
export function ForgotPasswordPage() {
  usePageMeta('Şifremi unuttum');
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
          <h1>Şifremi unuttum</h1>
          <p>Şifrenizi sıfırlamak için hesabınızı açan ürün sahibiyle iletişime geçin.</p>
        </div>
        <div className="alert alert--info">
          <p className="alert__title alert__title--icon">
            <Icon icon={LifeBuoy} />
            İletişim
          </p>
          <p>{SUPPORT_CONTACT_TEXT}</p>
        </div>
        <p className="meta">
          Ürün sahibi kimliğinizi doğruladıktan sonra size yeni bir geçici şifre verir. İlk girişte
          kendi şifrenizi oluşturursunuz.
        </p>
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
