import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@santiye/shared';
import { KeyRound, LifeBuoy, LogIn, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import type { z } from 'zod';
import { adminPost } from '../../api/admin-client';
import type {
  PlatformLoginResult,
  RecoveryLoginResult,
  TotpVerifyResult,
} from '../../api/admin-types';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useAdminPending, useAdminSession } from '../../stores/admin-session';
import { toast, useUi } from '../../stores/ui';
import { CodeField } from './TotpParts';
import { validCode } from './admin-utils';

type LoginForm = z.input<typeof loginSchema>;

export function AdminBrand() {
  return (
    <div className="nav-brand">
      <span className="nav-brand__mark" aria-hidden="true">
        ŞH
      </span>
      <span className="nav-brand__text">
        <span className="nav-brand__name">Şantiye Hesap</span>
        <span className="badge badge--cyan">
          <Icon icon={ShieldCheck} />
          Yönetim alanı
        </span>
      </span>
    </div>
  );
}

/**
 * Ürün sahibi girişi (şartname 7.13): önce şifre, ardından doğrulama uygulamasındaki kod veya
 * telefon kaybolduysa bir kurtarma kodu. İlk girişte güvenlik kurulumuna yönlendirilir.
 */
export function AdminLoginPage() {
  usePageMeta('Yönetim girişi');
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const setPending = useAdminPending((state) => state.setPending);
  const [notice] = useState(() => useUi.getState().loginNotice);
  useEffect(() => {
    useUi.getState().setLoginNotice(null);
  }, []);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onPassword = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await adminPost<PlatformLoginResult>('/platform/auth/login', values);
      if (result.totpSetupRequired) {
        setPending({ pendingToken: result.pendingToken, setupRequired: true });
        await navigate('/yonetim/guvenlik-kurulumu', { replace: true });
        return;
      }
      setPendingToken(result.pendingToken);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  });

  return (
    <main className="auth-layout">
      <div className="auth-card">
        <AdminBrand />
        <div className="auth-card__head">
          <h1>Yönetim girişi</h1>
          <p>
            {pendingToken
              ? 'İkinci adım: doğrulama uygulamasındaki kodu girin.'
              : 'Ürün sahibi hesabınızla giriş yapın.'}
          </p>
        </div>
        {notice && !pendingToken ? (
          <div className="alert alert--info" role="status">
            {notice}
          </div>
        ) : null}
        {pendingToken ? (
          <SecondFactor
            pendingToken={pendingToken}
            onRestart={() => setPendingToken(null)}
            onSignedIn={() => void navigate(from ?? '/yonetim', { replace: true })}
          />
        ) : (
          <form className="stack" onSubmit={(event) => void onPassword(event)} noValidate>
            <Field label="Kullanıcı adı" required error={errors.username?.message}>
              {(props) => (
                <TextInput
                  {...props}
                  {...register('username')}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              )}
            </Field>
            <Field label="Şifre" required error={errors.password?.message}>
              {(props) => (
                <TextInput
                  {...props}
                  {...register('password')}
                  type="password"
                  autoComplete="current-password"
                />
              )}
            </Field>
            {error ? (
              <div className="alert alert--danger" role="alert">
                <p className="alert__title">{error}</p>
              </div>
            ) : null}
            <Button type="submit" block loading={isSubmitting} loadingText="Kontrol ediliyor…">
              <Icon icon={LogIn} />
              Devam
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

function SecondFactor({
  pendingToken,
  onRestart,
  onSignedIn,
}: {
  pendingToken: string;
  onRestart: () => void;
  onSignedIn: () => void;
}) {
  const setSession = useAdminSession((state) => state.setSession);
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid =
      mode === 'totp'
        ? validCode(code)
        : recoveryCode.trim() === ''
          ? 'Kurtarma kodunu girin.'
          : undefined;
    setFieldError(invalid);
    if (invalid) return;
    setError(null);
    setBusy(true);
    try {
      if (mode === 'totp') {
        const result = await adminPost<TotpVerifyResult>(
          '/platform/auth/totp/verify',
          { code },
          { pendingToken },
        );
        setSession(result);
      } else {
        const result = await adminPost<RecoveryLoginResult>(
          '/platform/auth/recovery',
          { recoveryCode: recoveryCode.trim() },
          { pendingToken },
        );
        setSession(result);
        toast(
          `Kurtarma koduyla giriş yapıldı. Kalan kod: ${result.remainingRecoveryCodes}. Güvenlik sayfasından doğrulamayı yeniden kurabilirsiniz.`,
        );
      }
      onSignedIn();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={(event) => void submit(event)} noValidate>
      {mode === 'totp' ? (
        <CodeField value={code} onChange={setCode} error={fieldError} />
      ) : (
        <Field
          label="Kurtarma kodu"
          required
          error={fieldError}
          hint="Kurulumda indirdiğiniz kodlardan biri. Kullanılan kod geçersizleşir."
        >
          {(props) => (
            <TextInput
              {...props}
              className="code-input"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
            />
          )}
        </Field>
      )}
      {error ? (
        <div className="alert alert--danger" role="alert">
          <p className="alert__title">{error}</p>
        </div>
      ) : null}
      <Button type="submit" block loading={busy} loadingText="Doğrulanıyor…">
        <Icon icon={KeyRound} />
        Giriş Yap
      </Button>
      <div className="auth-links">
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => {
            setMode(mode === 'totp' ? 'recovery' : 'totp');
            setFieldError(undefined);
            setError(null);
          }}
        >
          <Icon icon={LifeBuoy} />
          {mode === 'totp'
            ? 'Telefonum yanımda değil: kurtarma kodu kullan'
            : 'Doğrulama kodu kullan'}
        </button>
        <button type="button" className="btn btn--ghost btn--small" onClick={onRestart}>
          Baştan başla
        </button>
      </div>
    </form>
  );
}
