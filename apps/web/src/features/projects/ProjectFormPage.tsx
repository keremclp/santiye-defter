import { zodResolver } from '@hookform/resolvers/zod';
import { isIsoDate } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { apiPatch, apiPostFull, isApiError } from '../../api/client';
import { invalidateRecords, useProject, useProjects } from '../../api/queries';
import { useCreateSubmission, type SaveState } from '../../api/submission';
import type { Project } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/Card';
import { ConflictView } from '../../components/ui/ConflictView';
import { DateInput, Field, TextArea, TextInput } from '../../components/ui/Field';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useSnapshot } from '../../hooks/useSnapshot';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { applyServerErrors } from '../../lib/forms';
import { formatDate } from '../../lib/format';
import { toast } from '../../stores/ui';

const schema = z.object({
  name: z.string().trim().min(1, 'Proje adını girin.').max(200, 'Proje adı çok uzun.'),
  description: z.string().max(2000, 'Açıklama çok uzun.'),
  address: z.string().max(500, 'Adres çok uzun.'),
  startDate: z.string().refine((v) => v === '' || isIsoDate(v), 'Geçerli bir tarih seçin.'),
});

type Values = z.infer<typeof schema>;
const FIELDS = ['name', 'description', 'address', 'startDate'];

/** Şantiye oluştur ve düzenle (şartname 7.2). */
export function ProjectFormPage() {
  const { id } = useParams();
  const query = useProject(id);
  const [project, setProject] = useSnapshot(query.data);
  usePageMeta(id ? 'Şantiye düzenle' : 'Yeni şantiye');
  return (
    <main className="page">
      <PageHeader
        title={id ? 'Şantiye düzenle' : 'Yeni şantiye'}
        back={
          id
            ? { to: `/uygulama/projeler/${id}`, label: 'Şantiye' }
            : { to: '/uygulama/projeler', label: 'Şantiyeler' }
        }
      />
      {!id ? (
        <ProjectForm project={null} />
      ) : query.isPending ? (
        <Loading />
      ) : query.error || !project ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <ProjectForm
          key={project.updatedAt}
          project={project}
          reload={async () => {
            const result = await query.refetch();
            if (result.data) setProject(result.data);
          }}
        />
      )}
    </main>
  );
}

function ProjectForm({ project, reload }: { project: Project | null; reload?: () => unknown }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(project?.updatedAt ?? '');
  const [conflict, setConflict] = useState<Project | null>(null);
  const [editState, setEditState] = useState<SaveState>({ status: 'idle' });
  const submission = useCreateSubmission<Project>();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? '',
      description: project?.description ?? '',
      address: project?.address ?? '',
      startDate: project?.startDate ?? '',
    },
  });
  // Bütün form değerleri; React Compiler ile uyumlu abonelik.
  const values = useWatch({ control, compute: (all) => all });
  const state = project ? editState : submission.state;
  const { dialog, allowNavigation } = useUnsavedChanges(
    isDirty && state.status !== 'saved',
    state.status === 'verifying',
  );

  // Benzer ad varsa uyarılır; kayıt engellenmez.
  const name = useDeferredValue(values.name.trim());
  const similar = useProjects({ q: name, status: 'all', limit: 5 }, name.length >= 3);
  const similarNames = (similar.data?.items ?? [])
    .filter((p) => p.id !== project?.id)
    .map((p) => p.name);

  const onSubmit = handleSubmit(async (form) => {
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      address: form.address.trim(),
      startDate: form.startDate || null,
    };
    try {
      if (project) {
        setEditState({ status: 'saving' });
        await apiPatch<Project>(`/projects/${project.id}`, { ...body, expectedUpdatedAt });
        setEditState({ status: 'saved' });
        await invalidateRecords(queryClient);
        toast('Şantiye güncellendi.');
        allowNavigation();
        await navigate(`/uygulama/projeler/${project.id}`, { replace: true });
        return;
      }
      const result = await submission.submit((key) =>
        apiPostFull<Project>('/projects', body, { idempotencyKey: key }),
      );
      if (!result) return;
      await invalidateRecords(queryClient);
      const warning = result.data.warnings?.[0];
      toast(
        warning
          ? `Şantiye oluşturuldu. ${warning.message} (${warning.related.map((r) => r.name).join(', ')})`
          : 'Şantiye oluşturuldu.',
      );
      allowNavigation();
      await navigate(`/uygulama/projeler/${result.data.id}`, { replace: true });
    } catch (caught) {
      if (project && isApiError(caught) && caught.code === 'CONFLICT' && caught.current) {
        setConflict(caught.current as Project);
        setEditState({ status: 'failed', message: caught.message });
        return;
      }
      if (project)
        setEditState({
          status: 'failed',
          message: isApiError(caught) ? caught.message : 'Kaydedilemedi.',
        });
      applyServerErrors(caught, setError, FIELDS);
    }
  });

  return (
    <form className="stack stack--lg" noValidate onSubmit={(event) => void onSubmit(event)}>
      {dialog}
      {conflict ? (
        <ConflictView
          fields={[
            {
              key: 'name',
              label: 'Proje adı',
              current: conflict.name,
              mine: values.name,
              differs: conflict.name !== values.name,
            },
            {
              key: 'description',
              label: 'Açıklama',
              current: conflict.description || '—',
              mine: values.description || '—',
              differs: conflict.description !== values.description,
            },
            {
              key: 'address',
              label: 'Adres',
              current: conflict.address || '—',
              mine: values.address || '—',
              differs: conflict.address !== values.address,
            },
            {
              key: 'startDate',
              label: 'Başlangıç tarihi',
              current: formatDate(conflict.startDate),
              mine: formatDate(values.startDate || null),
              differs: (conflict.startDate ?? '') !== values.startDate,
            },
          ]}
          onUseCurrent={() => {
            allowNavigation();
            setConflict(null);
            void reload?.();
          }}
          onKeepMine={() => {
            setExpectedUpdatedAt(conflict.updatedAt);
            setConflict(null);
            setEditState({ status: 'idle' });
          }}
        />
      ) : null}
      <div className="form-columns">
        <section className="card stack" aria-label="Ana bilgiler">
          <Field
            label="Proje adı"
            required
            error={errors.name?.message}
            hint={
              similarNames.length > 0
                ? `Benzer adlı şantiye var: ${similarNames.join(', ')}. Aynı şantiye değilse devam edebilirsiniz.`
                : 'Örn. Kadıköy Villa Şantiyesi'
            }
          >
            {(props) => <TextInput {...props} {...register('name')} />}
          </Field>
          <Field label="Adres / konum" error={errors.address?.message}>
            {(props) => <TextInput {...props} {...register('address')} />}
          </Field>
          <Field
            label="Başlangıç tarihi"
            error={errors.startDate?.message}
            hint="Bilinmiyorsa boş bırakın."
          >
            {(props) => <DateInput {...props} {...register('startDate')} />}
          </Field>
        </section>
        <section className="card stack" aria-label="Ek bilgiler">
          <Field label="Açıklama" error={errors.description?.message}>
            {(props) => <TextArea {...props} {...register('description')} rows={6} />}
          </Field>
        </section>
      </div>
      {!canWrite ? <div className="alert alert--danger">{closedReason}</div> : null}
      <SaveStatus state={state} onVerify={() => void submission.verify()} />
      <div className="form-actions sticky-actions">
        <Button
          type="submit"
          loading={state.status === 'saving'}
          disabled={!canWrite || submission.busy || Boolean(conflict)}
        >
          {project ? 'Değişiklikleri Kaydet' : 'Projeyi Oluştur'}
        </Button>
        <Link
          className="btn btn--ghost"
          to={project ? `/uygulama/projeler/${project.id}` : '/uygulama/projeler'}
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
