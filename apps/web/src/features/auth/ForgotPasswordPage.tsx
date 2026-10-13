import { Link } from 'react-router';
import { usePageMeta } from '../../hooks/usePageMeta';
import { SUPPORT_CONTACT_TEXT } from '../../lib/support';

/** Şifremi unuttum: e-posta gönderimi yok; ürün sahibine nasıl ulaşılacağı (şartname 7.12). */
export function ForgotPasswordPage() {
  usePageMeta('Şifremi unuttum');
  return (
    <main className="auth-layout">
      <div className="auth-card">
        <p className="auth-card__brand">Şantiye Hesap</p>
        <h1>Şifremi unuttum</h1>
        <p>Şifrenizi sıfırlamak için hesabınızı açan ürün sahibiyle iletişime geçin.</p>
        <div className="alert alert--info">{SUPPORT_CONTACT_TEXT}</div>
        <p className="meta">
          Ürün sahibi kimliğinizi doğruladıktan sonra size yeni bir geçici şifre verir. İlk girişte
          kendi şifrenizi oluşturursunuz.
        </p>
        <Link to="/giris">← Girişe dön</Link>
      </div>
    </main>
  );
}
