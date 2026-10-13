import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { apiPatch, errorMessage, isApiError } from '../../api/client';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { PageHeader, Panel } from '../../components/ui/Card';
import { Field, TextInput } from '../../components/ui/Field';
import { usePageMeta } from '../../hooks/usePageMeta';
import { applyServerErrors } from '../../lib/forms';
import { useSession } from '../../stores/session';
import { useUi } from '../../stores/ui';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut şifreyi girin.'),
    newPassword: passwordSchema,
    repeat: z.string().min(1, 'Yeni şifreyi tekrar girin.'),
  })
  .refine((v) => v.newPassword === v.repeat, { message: 'Şifreler aynı değil.', path: ['repeat'] });
type Values = z.infer<typeof schema>;

/** Şifre değişimi: başarılı olunca bütün oturumlar düşer ve girişe alınır (şartname 7.11). */
export function PasswordPage() {
  usePageMeta('Şifre');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', repeat: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setError(null);
    try {
      await apiPatch('/auth/password', { currentPassword, newPassword });
      useUi
        .getState()
        .setLoginNotice(
          'Şifreniz değişti. Bütün oturumlar kapatıldı; yeni şifrenizle giriş yapın.',
        );
      useSession.getState().clear();
      queryClient.clear();
      await navigate('/giris', { replace: true });
    } catch (caught) {
      const rest = applyServerErrors(caught, setFieldError, ['currentPassword', 'newPassword']);
      if (rest.length > 0 || !isApiError(caught) || caught.issues.length === 0)
        setError(errorMessage(caught));
    }
  });

  return (
    <main className="page">
      <PageHeader title="Şifre" back={{ to: '/uygulama/ayarlar', label: 'Ayarlar' }} />
      <div className="form-columns">
        <Panel title="Şifreyi değiştir" icon={KeyRound}>
          <form className="panel__body stack" noValidate onSubmit={(event) => void onSubmit(event)}>
            <Field label="Mevcut şifre" required error={errors.currentPassword?.message}>
              {(props) => (
                <TextInput
                  {...props}
                  {...register('currentPassword')}
                  type="password"
                  autoComplete="current-password"
                />
              )}
            </Field>
            <Field
              label="Yeni şifre"
              required
              error={errors.newPassword?.message}
              hint="En az 8 karakter"
            >
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
                {error}
              </div>
            ) : null}
            <div className="form-actions">
              <Button type="submit" loading={isSubmitting}>
                Şifreyi Değiştir
              </Button>
            </div>
          </form>
        </Panel>
        <Panel title="Bilmeniz gerekenler" icon={ShieldCheck}>
          <ul className="panel__list">
            <li>Yeni şifre en az 8 karakter olmalı.</li>
            <li>Şifre değişince bu ve diğer bütün cihazlardaki oturumlar kapanır.</li>
            <li>Değişiklikten sonra yeni şifrenizle yeniden giriş yaparsınız.</li>
          </ul>
        </Panel>
      </div>
    </main>
  );
}
