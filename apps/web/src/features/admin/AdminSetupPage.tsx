import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { adminPost } from '../../api/admin-client';
import type { TotpSetupResult, TotpVerifyResult } from '../../api/admin-types';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useAdminPending, useAdminSession } from '../../stores/admin-session';
import { AdminBrand } from './AdminLoginPage';
import { CodeField, RecoveryCodes, TotpQr } from './TotpParts';
import { validCode } from './admin-utils';

/**
 * İlk girişte zorunlu güvenlik kurulumu (şartname 7.13): QR ile doğrulama uygulaması kurulur, bir
 * doğru kodla onaylanır; ardından 10 kurtarma kodu yalnız bir kez gösterilir ve indirilebilir.
 */
export function AdminSetupPage() {
  usePageMeta('Güvenlik kurulumu');
  const navigate = useNavigate();
  const pendingToken = useAdminPending((state) => state.pendingToken);
  const setPending = useAdminPending((state) => state.setPending);
  const signedIn = useAdminSession((state) => Boolean(state.accessToken && state.admin));
  const setSession = useAdminSession((state) => state.setSession);
  const [setup, setSetup] = useState<TotpSetupResult | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [codes, setCodes] = useState<{ codes: string[]; username: string } | null>(null);
  const started = useRef(false);

  // Her başlatma yeni anahtar üretir; sayfa açılışında bir kez istenir.
  const start = async (token: string) => {
    setLoadError(null);
    try {
      setSetup(
        await adminPost<TotpSetupResult>('/platform/auth/totp/setup', {}, { pendingToken: token }),
      );
    } catch (caught) {
      setLoadError(caught);
    }
  };
  useEffect(() => {
    if (!pendingToken || started.current) return;
    started.current = true;
    void start(pendingToken);
  }, [pendingToken]);

  if (codes) {
    return (
      <main className="auth-layout">
        <div className="auth-card auth-card--wide">
          <AdminBrand />
          <div className="auth-card__head">
            <h1>Kurtarma kodlarınız</h1>
            <p>İki aşamalı doğrulama kuruldu.</p>
          </div>
          <RecoveryCodes
            codes={codes.codes}
            username={codes.username}
            doneLabel="Yönetim alanına geç"
            onDone={() => {
              setCodes(null);
              void navigate('/yonetim', { replace: true });
            }}
          />
        </div>
      </main>
    );
  }
  if (!pendingToken) {
    return <Navigate to={signedIn ? '/yonetim' : '/yonetim/giris'} replace />;
  }

  return (
    <main className="auth-layout">
      <div className="auth-card auth-card--wide">
        <AdminBrand />
        <div className="auth-card__head">
          <h1>Güvenlik kurulumu</h1>
          <p>Yönetim alanı iki aşamalı doğrulama kurulmadan açılmaz.</p>
        </div>
        <ol className="auth-steps">
          <li>Telefonunuzda bir doğrulama uygulaması açın (ör. Google Authenticator, Authy).</li>
          <li>Aşağıdaki QR kodunu okutun.</li>
          <li>Uygulamanın gösterdiği 6 haneli kodu girip onaylayın.</li>
        </ol>
        {loadError ? (
          <ErrorState error={loadError} onRetry={() => void start(pendingToken)} />
        ) : setup ? (
          <>
            <TotpQr otpauthUrl={setup.otpauthUrl} secret={setup.secret} />
            <ConfirmForm
              pendingToken={pendingToken}
              onConfirmed={(result) => {
                setSession(result);
                setPending(null);
                setCodes({ codes: result.recoveryCodes ?? [], username: result.admin.username });
              }}
              onExpired={() => {
                setPending(null);
                void navigate('/yonetim/giris', { replace: true });
              }}
            />
          </>
        ) : (
          <Loading label="Kurulum hazırlanıyor…" />
        )}
      </div>
    </main>
  );
}

function ConfirmForm({
  pendingToken,
  onConfirmed,
  onExpired,
}: {
  pendingToken: string;
  onConfirmed: (result: TotpVerifyResult) => void;
  onExpired: () => void;
}) {
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validCode(code);
    setFieldError(invalid);
    if (invalid) return;
    setError(null);
    setBusy(true);
    try {
      onConfirmed(
        await adminPost<TotpVerifyResult>('/platform/auth/totp/verify', { code }, { pendingToken }),
      );
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void submit(event)} noValidate>
      <CodeField value={code} onChange={setCode} error={fieldError} />
      {error ? (
        <div className="alert alert--danger" role="alert">
          <p className="alert__title">{error}</p>
          <p className="meta">
            Ara oturum 5 dakika geçerlidir; süre dolduysa{' '}
            <button type="button" className="btn btn--ghost btn--small" onClick={onExpired}>
              yeniden giriş yapın
            </button>
            .
          </p>
        </div>
      ) : null}
      <Button type="submit" block loading={busy} loadingText="Doğrulanıyor…">
        Kurulumu onayla
      </Button>
    </form>
  );
}
