import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { apiPatch, apiPostFull, isApiError } from '../../api/client';
import { invalidateRecords, useParties, useParty } from '../../api/queries';
import { useCreateSubmission, type SaveState } from '../../api/submission';
import type { Party, PartyKind, PartyTag } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/Card';
import { ChipGroup, MultiChipGroup } from '../../components/ui/Chips';
import { ConflictView } from '../../components/ui/ConflictView';
import { Field, TextArea, TextInput } from '../../components/ui/Field';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useSnapshot } from '../../hooks/useSnapshot';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { applyServerErrors } from '../../lib/forms';
import { PARTY_KIND_LABEL, PARTY_TAG_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';

const schema = z.object({
  name: z.string().trim().min(1, 'Ad / unvan girin.').max(200, 'Ad çok uzun.'),
  kind: z.enum(['person', 'company']),
  tags: z.array(z.enum(['supplier', 'subcontractor', 'customer'])),
  phone: z.string().max(30, 'Telefon çok uzun.'),
  email: z
    .string()
    .trim()
    .max(200, 'E-posta çok uzun.')
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Geçerli bir e-posta girin.'),
  address: z.string().max(500, 'Adres çok uzun.'),
  note: z.string().max(2000, 'Not çok uzun.'),
});

type Values = z.infer<typeof schema>;
const FIELDS = ['name', 'phone', 'email', 'address', 'note'];

/** Kişi/firma oluştur ve düzenle (şartname 7.3). */
export function PartyFormPage() {
  const { id } = useParams();
  const query = useParty(id);
  const [party, setParty] = useSnapshot(query.data);
  usePageMeta(id ? 'Kişi düzenle' : 'Yeni kişi/firma');
  return (
    <main className="page">
      <PageHeader
        title={id ? 'Kişi/firma düzenle' : 'Yeni kişi/firma'}
        back={
          id
            ? { to: `/uygulama/kisiler/${id}`, label: 'Kişi' }
            : { to: '/uygulama/kisiler', label: 'Kişiler' }
        }
      />
      {!id ? (
        <PartyForm party={null} />
      ) : query.isPending ? (
        <Loading />
      ) : query.error || !party ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <PartyForm
          key={party.updatedAt}
          party={party}
          reload={async () => {
            const result = await query.refetch();
            if (result.data) setParty(result.data);
          }}
        />
      )}
    </main>
  );
}

function PartyForm({ party, reload }: { party: Party | null; reload?: () => unknown }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(party?.updatedAt ?? '');
  const [conflict, setConflict] = useState<Party | null>(null);
  const [editState, setEditState] = useState<SaveState>({ status: 'idle' });
  const submission = useCreateSubmission<Party>();
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: party?.name ?? '',
      kind: party?.kind ?? 'company',
      tags: party?.tags ?? [],
      phone: party?.phone ?? '',
      email: party?.email ?? '',
      address: party?.address ?? '',
      note: party?.note ?? '',
    },
  });
  // Bütün form değerleri; React Compiler ile uyumlu abonelik.
  const values = useWatch({ control, compute: (all) => all });
  const state = party ? editState : submission.state;
  const { dialog, allowNavigation } = useUnsavedChanges(
    isDirty && state.status !== 'saved',
    state.status === 'verifying',
  );

  // Benzer ad önerilir ve uyarılır; yalnız ad eşitliği yüzünden engelleme veya birleştirme yapılmaz.
  const name = useDeferredValue(values.name.trim());
  const similar = useParties({ q: name, limit: 5 }, name.length >= 3);
  const similarItems =
    name.length >= 3 ? (similar.data?.items ?? []).filter((p) => p.id !== party?.id) : [];

  const onSubmit = handleSubmit(async (form) => {
    const body = { ...form, name: form.name.trim() };
    try {
      if (party) {
        setEditState({ status: 'saving' });
        await apiPatch<Party>(`/parties/${party.id}`, { ...body, expectedUpdatedAt });
        setEditState({ status: 'saved' });
        await invalidateRecords(queryClient);
        toast('Kişi/firma güncellendi.');
        allowNavigation();
        await navigate(`/uygulama/kisiler/${party.id}`, { replace: true });
        return;
      }
      const result = await submission.submit((key) =>
        apiPostFull<Party>('/parties', body, { idempotencyKey: key }),
      );
      if (!result) return;
      await invalidateRecords(queryClient);
      toast('Kişi/firma eklendi.');
      allowNavigation();
      await navigate(`/uygulama/kisiler/${result.data.id}`, { replace: true });
    } catch (caught) {
      if (party && isApiError(caught) && caught.code === 'CONFLICT' && caught.current) {
        setConflict(caught.current as Party);
        setEditState({ status: 'failed', message: caught.message });
        return;
      }
      if (party)
        setEditState({
          status: 'failed',
          message: isApiError(caught) ? caught.message : 'Kaydedilemedi.',
        });
      applyServerErrors(caught, setError, FIELDS);
    }
  });

  const text = (value: string) => value || '—';

  return (
    <form className="stack stack--lg" noValidate onSubmit={(event) => void onSubmit(event)}>
      {dialog}
      {conflict ? (
        <ConflictView
          fields={[
            {
              key: 'name',
              label: 'Ad / unvan',
              current: conflict.name,
              mine: values.name,
              differs: conflict.name !== values.name,
            },
            {
              key: 'kind',
              label: 'Tür',
              current: PARTY_KIND_LABEL[conflict.kind],
              mine: PARTY_KIND_LABEL[values.kind],
              differs: conflict.kind !== values.kind,
            },
            {
              key: 'tags',
              label: 'Etiketler',
              current: conflict.tags.map((t) => PARTY_TAG_LABEL[t]).join(', ') || '—',
              mine: values.tags.map((t) => PARTY_TAG_LABEL[t]).join(', ') || '—',
              differs: conflict.tags.join() !== values.tags.join(),
            },
            {
              key: 'phone',
              label: 'Telefon',
              current: text(conflict.phone),
              mine: text(values.phone),
              differs: conflict.phone !== values.phone,
            },
            {
              key: 'email',
              label: 'E-posta',
              current: text(conflict.email),
              mine: text(values.email),
              differs: conflict.email !== values.email,
            },
            {
              key: 'address',
              label: 'Adres',
              current: text(conflict.address),
              mine: text(values.address),
              differs: conflict.address !== values.address,
            },
            {
              key: 'note',
              label: 'Not',
              current: text(conflict.note),
              mine: text(values.note),
              differs: conflict.note !== values.note,
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
          <Field label="Ad / unvan" required error={errors.name?.message}>
            {(props) => <TextInput {...props} {...register('name')} />}
          </Field>
          {similarItems.length > 0 ? (
            <div className="alert alert--info" role="status">
              <p>Benzer adlı kayıt var. Aynı kişiyse yeniden açmak yerine onu kullanın:</p>
              <p>
                {similarItems.map((item, index) => (
                  <span key={item.id}>
                    {index > 0 ? ', ' : ''}
                    <Link to={`/uygulama/kisiler/${item.id}`}>{item.name}</Link>
                  </span>
                ))}
              </p>
            </div>
          ) : null}
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div className="stack stack--sm">
                <span className="field__label">Kişi / firma</span>
                <ChipGroup<PartyKind>
                  label="Kişi / firma"
                  options={[
                    { value: 'company', label: 'Firma' },
                    { value: 'person', label: 'Kişi' },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                />
              </div>
            )}
          />
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <div className="stack stack--sm">
                <span className="field__label">Etiketler (isteğe bağlı)</span>
                <MultiChipGroup<PartyTag>
                  label="Etiketler"
                  options={[
                    { value: 'supplier', label: 'Tedarikçi' },
                    { value: 'subcontractor', label: 'Taşeron' },
                    { value: 'customer', label: 'Müşteri' },
                  ]}
                  value={field.value}
                  onChange={field.onChange}
                />
              </div>
            )}
          />
        </section>
        <section className="card stack" aria-label="İletişim ve not">
          <div className="form-grid">
            <Field label="Telefon" error={errors.phone?.message}>
              {(props) => (
                <TextInput {...props} {...register('phone')} type="tel" autoComplete="tel" />
              )}
            </Field>
            <Field label="E-posta" error={errors.email?.message}>
              {(props) => (
                <TextInput {...props} {...register('email')} type="email" autoComplete="email" />
              )}
            </Field>
          </div>
          <Field label="Adres" error={errors.address?.message}>
            {(props) => <TextInput {...props} {...register('address')} />}
          </Field>
          <Field label="Not" error={errors.note?.message}>
            {(props) => <TextArea {...props} {...register('note')} rows={3} />}
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
          {party ? 'Değişiklikleri Kaydet' : 'Kişiyi Ekle'}
        </Button>
        <Link
          className="btn btn--ghost"
          to={party ? `/uygulama/kisiler/${party.id}` : '/uygulama/kisiler'}
        >
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
