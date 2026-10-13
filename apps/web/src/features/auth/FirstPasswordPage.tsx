import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { apiPatch, apiPost, errorMessage, isApiError } from '../../api/client';
import type { PasswordChangeResult } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { usePageMeta } from '../../hooks/usePageMeta';
import { applyServerErrors } from '../../lib/forms';
import { useSession } from '../../stores/session';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Geçici şifreyi girin.'),
    newPassword: passwordSchema,
    repeat: z.string().min(1, 'Yeni şifreyi tekrar girin.'),
  })
  .refine((value) => value.newPassword === value.repeat, {
    message: 'Şifreler aynı değil.',
    path: ['repeat'],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: 'Yeni şifre geçici şifreden farklı olmalı.',
    path: ['newPassword'],
  });

type Form = z.infer<typeof schema>;

/**
 * İlk şifre: geçici şifreyle giren kullanıcı kişisel şifresini oluşturmadan ilerleyemez. Kaydedilince
 * eski oturumlar düşer, yeni oturum verilir ve firma özetine geçilir (şartname 7.12).
 */
export function FirstPasswordPage() {
  usePageMeta('Kişisel şifre');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const accessToken = useSession((s) => s.accessToken);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', repeat: '' },
  });

  if (!accessToken || !user) return <Navigate to="/giris" replace />;
  if (!user.mustChangePassword) return <Navigate to="/uygulama" replace />;

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError(null);
    try {
      const result = await apiPatch<PasswordChangeResult>('/auth/password', {
        currentPassword,
        newPassword,
      });
      const session = useSession.getState();
      if (result.accessToken && result.refreshToken) {
        session.setSession({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
        });
        queryClient.clear();
        await navigate('/uygulama', { replace: true });
      } else {
        session.clear();
        await navigate('/giris', { replace: true });
      }
    } catch (caught) {
      const rest = applyServerErrors(caught, setFieldError, ['currentPassword', 'newPassword']);
      if (rest.length > 0 || !isApiError(caught) || caught.issues.length === 0) {
        setError(errorMessage(caught));
      }
    }
  });

  const logout = async () => {
    try {
      await apiPost('/auth/logout', {});
    } catch {
      // Sunucuya ulaşılamasa da bu cihazdaki oturum kapanır.
    }
    useSession.getState().clear();
    await navigate('/giris', { replace: true });
  };

  return (
    <main className="auth-layout">
      <div className="auth-card">
        <div className="nav-brand">
          <span className="nav-brand__mark" aria-hidden="true">
            ŞH
          </span>
          <span className="nav-brand__text">
            <span className="nav-brand__name">Şantiye Hesap</span>
            <span className="nav-brand__company">{user.name}</span>
          </span>
        </div>
        <div className="auth-card__head">
          <h1>Kişisel şifrenizi oluşturun</h1>
          <p>
            Devam etmek için geçici şifrenizin yerine kendi şifrenizi belirleyin. Yeni şifre en az 8
            karakter olmalı.
          </p>
        </div>
        <form className="stack" onSubmit={(event) => void onSubmit(event)} noValidate>
          <Field label="Geçici şifre" required error={errors.currentPassword?.message}>
            {(props) => (
              <TextInput
                {...props}
                {...register('currentPassword')}
                type="password"
                autoComplete="current-password"
              />
            )}
          </Field>
          <Field label="Yeni şifre" required error={errors.newPassword?.message}>
            {(props) => (
              <TextInput
                {...props}
                {...register('newPassword')}
                type="password"
                autoComplete="new-password"
              />
            )}
          </Field>
          <Field label="Yeni şifre (tekrar)" required error={errors.repeat?.message}>
            {(props) => (
              <TextInput
                {...props}
                {...register('repeat')}
                type="password"
                autoComplete="new-password"
              />
            )}
          </Field>
          {error ? (
            <div className="alert alert--danger" role="alert">
              <p className="alert__title">{error}</p>
            </div>
          ) : null}
          <Button type="submit" block loading={isSubmitting}>
            <Icon icon={KeyRound} />
            Şifremi Kaydet
          </Button>
        </form>
        <div className="auth-links">
          <Button variant="ghost" size="small" onClick={() => void logout()}>
            <Icon icon={LogOut} />
            Çıkış yap
          </Button>
        </div>
      </div>
    </main>
  );
}
