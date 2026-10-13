import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { apiPostFull } from '../../api/client';
import { invalidateRecords } from '../../api/queries';
import { useCreateSubmission } from '../../api/submission';
import type { Agreement } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { DocumentPlaceholder } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/Chips';
import { DateInput, Field, TextArea, TextInput } from '../../components/ui/Field';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { applyServerErrors, toKurus } from '../../lib/forms';
import { toast } from '../../stores/ui';
import { PartyPicker, ScopePicker } from '../common/Pickers';
import { OBLIGATION_FIELDS, obligationSchema, type ObligationValues } from './obligation-form';

/**
 * Anlaşma veya başlangıç borç/alacak formu (şartname 7.6). Oluşturmak gelir/gider hareketi yazmaz;
 * ilk ödeme/tahsilat kayıttan sonra ayrı eylemle girilir.
 */
export function ObligationForm({ initial }: { initial: ObligationValues }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const opening = initial.mode === 'opening';
  const [formError, setFormError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<ObligationValues>({
    resolver: zodResolver(obligationSchema),
    defaultValues: initial,
  });
  // Bütün form değerleri; React Compiler ile uyumlu abonelik.
  const values = useWatch({ control, compute: (all) => all });
  const submission = useCreateSubmission<Agreement>();
  const { dialog, allowNavigation } = useUnsavedChanges(
    isDirty && submission.state.status !== 'saved',
    submission.state.status === 'verifying',
  );

  const onSubmit = handleSubmit(async (form) => {
    setFormError(null);
    const common = {
      direction: form.direction,
      scope: form.scope,
      ...(form.scope === 'project' ? { projectId: form.projectId } : {}),
      partyId: form.party!.id,
      initialAmount: toKurus(form.amount),
      ...(form.dueDate ? { dueDate: form.dueDate } : {}),
      description: form.description.trim(),
    };
    const body = opening
      ? { kind: 'opening', ...common, trackingStartDate: form.trackingStartDate }
      : {
          kind: 'agreement',
          title: form.title.trim(),
          ...common,
          ...(form.agreementDate ? { agreementDate: form.agreementDate } : {}),
        };
    try {
      const result = await submission.submit((key) =>
        apiPostFull<Agreement>('/agreements', body, { idempotencyKey: key }),
      );
      if (!result) return;
      await invalidateRecords(queryClient);
      toast(opening ? 'Başlangıç kaydı oluşturuldu.' : 'Anlaşma oluşturuldu.');
      allowNavigation();
      await navigate(`/uygulama/anlasmalar/${result.data.id}`, { replace: true });
    } catch (caught) {
      const rest = applyServerErrors(caught, setError, OBLIGATION_FIELDS, {
        partyId: 'party',
        initialAmount: 'amount',
      });
      if (rest.length > 0) setFormError(rest.join(' '));
    }
  });

  return (
    <form className="stack stack--lg" noValidate onSubmit={(event) => void onSubmit(event)}>
      {dialog}
      <div className="alert alert--info">
        {opening
          ? 'Bu tutar yeni gider/gelir sayılmaz. Aynı borcu ayrıca geçmiş anlaşma olarak girmeyin.'
          : 'Anlaşma oluşturmak gelir veya gider yazmaz. İlk ödeme veya tahsilatı kayıttan sonra ayrı eylemle girin.'}
      </div>
      <section className="card stack">
        {!opening ? (
          <Field
            label="Anlaşma adı"
            required
            error={errors.title?.message}
            hint="Örn. Elektrik işi"
          >
            {(props) => <TextInput {...props} {...register('title')} />}
          </Field>
        ) : null}
        <div className="stack stack--sm">
          <span className="field__label">
            Yön
            <span className="field__required" aria-hidden="true">
              *
            </span>
          </span>
          <ChipGroup
            label="Yön"
            options={
              opening
                ? [
                    { value: 'payable', label: 'Başlangıç borcu' },
                    { value: 'receivable', label: 'Başlangıç alacağı' },
                  ]
                : [
                    { value: 'payable', label: 'Ödenecek (taşeron, tedarikçi)' },
                    { value: 'receivable', label: 'Tahsil edilecek (müşteri)' },
                  ]
            }
            value={values.direction}
            onChange={(direction) => setValue('direction', direction, { shouldDirty: true })}
          />
        </div>
        <Controller
          control={control}
          name="party"
          render={({ field }) => (
            <PartyPicker
              value={field.value}
              onChange={field.onChange}
              required
              error={errors.party?.message}
            />
          )}
        />
        <ScopePicker
          value={{ scope: values.scope, projectId: values.projectId }}
          onChange={(next) => {
            setValue('scope', next.scope, { shouldDirty: true });
            setValue('projectId', next.projectId, { shouldDirty: true, shouldValidate: true });
          }}
          error={errors.projectId?.message}
          activeOnly={!opening}
        />
        {!opening ? (
          <p className="meta">
            Tamamlanan veya arşivlenen şantiyeye yeni anlaşma için önce şantiyeyi gerekçeyle yeniden
            aktifleştirin.
          </p>
        ) : null}
        <div className="form-grid">
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <Field
                label={opening ? 'Devreden kalan tutar' : 'Toplam bedel'}
                required
                error={errors.amount?.message}
                hint={
                  opening
                    ? 'O tarihte gerçekten açık kalan tutar; ilk anlaşma bedeli değil.'
                    : undefined
                }
              >
                {(props) => (
                  <MoneyInput
                    {...props}
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              </Field>
            )}
          />
          {opening ? (
            <Field
              label="Takip başlangıç tarihi"
              required
              error={errors.trackingStartDate?.message}
              hint="Uygulamaya geçiş tarihi"
            >
              {(props) => <DateInput {...props} {...register('trackingStartDate')} />}
            </Field>
          ) : (
            <Field
              label="Anlaşma tarihi"
              error={errors.agreementDate?.message}
              hint="Geçmiş tarihli girilebilir."
            >
              {(props) => <DateInput {...props} {...register('agreementDate')} />}
            </Field>
          )}
          <Field label="Vade tarihi" error={errors.dueDate?.message} hint="İsteğe bağlı; tek vade.">
            {(props) => <DateInput {...props} {...register('dueDate')} />}
          </Field>
        </div>
        <Field label="Açıklama" error={errors.description?.message}>
          {(props) => <TextArea {...props} {...register('description')} rows={3} />}
        </Field>
        <DocumentPlaceholder />
      </section>
      {formError ? (
        <div className="alert alert--danger" role="alert">
          {formError}
        </div>
      ) : null}
      {!canWrite ? <div className="alert alert--danger">{closedReason}</div> : null}
      <SaveStatus state={submission.state} onVerify={() => void submission.verify()} />
      <div className="form-actions sticky-actions">
        <Button
          type="submit"
          loading={submission.state.status === 'saving'}
          disabled={submission.busy || !canWrite}
        >
          {opening ? 'Başlangıç Kaydını Oluştur' : 'Anlaşmayı Oluştur'}
        </Button>
      </div>
    </form>
  );
}
