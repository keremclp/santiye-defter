import { zodResolver } from '@hookform/resolvers/zod';
import { personNameSchema } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { apiPatch, errorMessage, isApiError } from '../../api/client';
import { keys, useMe } from '../../api/queries';
import type { SaveState } from '../../api/submission';
import type { Profile } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/Card';
import { ConflictView } from '../../components/ui/ConflictView';
import { Field, TextInput } from '../../components/ui/Field';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { QueryView } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { applyServerErrors } from '../../lib/forms';
import { useSession } from '../../stores/session';

const schema = z.object({
  name: personNameSchema,
  phone: z.string().trim().max(30, 'Telefon çok uzun.'),
  email: z
    .string()
    .trim()
    .max(200, 'E-posta çok uzun.')
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Geçerli bir e-posta girin.'),
});
type Values = z.infer<typeof schema>;

/** Profil: görünen ad, telefon, e-posta. Kullanıcı adını yalnız ürün sahibi değiştirir (şartname 7.11). */
export function ProfilePage() {
  usePageMeta('Profil');
  const me = useMe();
  return (
    <main className="page page--narrow">
      <PageHeader title="Profil" back={{ to: '/uygulama/ayarlar', label: 'Ayarlar' }} />
      <QueryView query={me}>{(data) => <ProfileForm profile={data.user} />}</QueryView>
    </main>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient();
  const setUser = useSession((s) => s.setUser);
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  // Arka plan yenilemesi formu sıfırlamaz; sürüm yalnız kayıtta veya çakışma çözümünde ilerler.
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(profile.updatedAt);
  const [conflict, setConflict] = useState<Profile | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: profile.name, phone: profile.phone, email: profile.email },
  });
  const { dialog } = useUnsavedChanges(isDirty);
  const values = useWatch({ control, compute: (all) => all });

  const onSubmit = handleSubmit(async (values) => {
    setState({ status: 'saving' });
    try {
      const updated = await apiPatch<Profile>('/auth/me', {
        ...values,
        expectedUpdatedAt,
      });
      setUser(updated);
      setExpectedUpdatedAt(updated.updatedAt);
      reset(values);
      setState({ status: 'saved' });
      await queryClient.invalidateQueries({ queryKey: keys.me });
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'CONFLICT' && caught.current) {
        setConflict(caught.current as Profile);
        setState({ status: 'failed', message: caught.message });
        return;
      }
      applyServerErrors(caught, setError, ['name', 'phone', 'email']);
      setState({ status: 'failed', message: errorMessage(caught) });
    }
  });

  return (
    <form className="card stack" noValidate onSubmit={(event) => void onSubmit(event)}>
      {dialog}
      {conflict ? (
        <ConflictView
          fields={(['name', 'phone', 'email'] as const).map((key) => ({
            key,
            label: { name: 'Görünen ad', phone: 'Telefon', email: 'E-posta' }[key],
            current: conflict[key] || '—',
            mine: values[key] || '—',
            differs: conflict[key] !== values[key],
          }))}
          onUseCurrent={() => {
            reset({ name: conflict.name, phone: conflict.phone, email: conflict.email });
            setExpectedUpdatedAt(conflict.updatedAt);
            setConflict(null);
            setState({ status: 'idle' });
          }}
          onKeepMine={() => {
            setExpectedUpdatedAt(conflict.updatedAt);
            setConflict(null);
            setState({ status: 'idle' });
          }}
        />
      ) : null}
      <Field label="Kullanıcı adı" hint="Kullanıcı adını yalnız ürün sahibi değiştirebilir.">
        {(props) => <TextInput {...props} value={profile.username} readOnly />}
      </Field>
      <Field label="Görünen ad" required error={errors.name?.message}>
        {(props) => <TextInput {...props} {...register('name')} autoComplete="name" />}
      </Field>
      <Field label="Telefon" error={errors.phone?.message}>
        {(props) => <TextInput {...props} {...register('phone')} type="tel" autoComplete="tel" />}
      </Field>
      <Field label="E-posta" error={errors.email?.message}>
        {(props) => (
          <TextInput {...props} {...register('email')} type="email" autoComplete="email" />
        )}
      </Field>
      <SaveStatus state={state} />
      <div className="form-actions">
        <Button
          type="submit"
          loading={state.status === 'saving'}
          disabled={!isDirty || Boolean(conflict)}
        >
          Kaydet
        </Button>
      </div>
    </form>
  );
}
