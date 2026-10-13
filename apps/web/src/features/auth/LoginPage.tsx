import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@santiye/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import type { z } from 'zod';
import { apiPost, errorMessage } from '../../api/client';
import type { LoginResult } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useSession } from '../../stores/session';
import { useUi } from '../../stores/ui';

type LoginForm = z.input<typeof loginSchema>;

/** Giriş: kullanıcı adı + şifre; hata hangi alanın yanlış olduğunu söylemez (şartname 7.12). */
export function LoginPage() {
  usePageMeta('Giriş');
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: string } | null;
  const setSession = useSession((s) => s.setSession);
  // Bildirim bir kez gösterilir: ekrana alınır, depodan silinir.
  const [notice] = useState(() => useUi.getState().loginNotice);
  useEffect(() => {
    useUi.getState().setLoginNotice(null);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const result = await apiPost<LoginResult>('/auth/login', values);
      setSession(result);
      // Giriş sonrası önceki form kendiliğinden gönderilmez; yalnız sayfaya dönülür.
      if (result.mustChangePassword) await navigate('/ilk-sifre', { replace: true });
      else await navigate(state?.from ?? '/uygulama', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    }
  });

  return (
    <main className="auth-layout">
      <div className="auth-card">
        <p className="auth-card__brand">Şantiye Hesap</p>
        <p className="muted">Şantiye parasını net ve hızlı yönetin.</p>
        <h1>Giriş</h1>
        {notice ? (
          <div className="alert alert--info" role="status">
            {notice}
          </div>
        ) : null}
        <form className="stack" onSubmit={(event) => void onSubmit(event)} noValidate>
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
          <Button type="submit" block loading={isSubmitting} loadingText="Giriş yapılıyor…">
            Giriş Yap
          </Button>
        </form>
        <div className="auth-links">
          <Link to="/demo">Demoyu Dene</Link>
          <Link to="/sifremi-unuttum">Şifremi unuttum</Link>
        </div>
      </div>
    </main>
  );
}
