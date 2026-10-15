import { zodResolver } from '@hookform/resolvers/zod';
import { directionOfKind, excessMessage } from '@santiye/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Split, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { apiGet, apiPostFull, isApiError } from '../../api/client';
import { invalidateRecords, useCategories } from '../../api/queries';
import { useCreateSubmission } from '../../api/submission';
import type { Agreement, Transaction, Warning } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { ChipGroup } from '../../components/ui/Chips';
import { Checkbox, DateInput, Field, SelectInput, TextArea } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { applyServerErrors, kurusToInput } from '../../lib/forms';
import { formatMoney, formatTl } from '../../lib/format';
import { PartyPicker, ScopePicker } from '../common/Pickers';
import { DocumentFormField, UploadingNotice, UploadResultNotice } from '../documents/DocumentParts';
import { useUploadQueue } from '../documents/useUploadQueue';
import { projectById, useProjectOptions } from '../common/project-options';
import { toast } from '../../stores/ui';
import { AllocationEditor } from './AllocationEditor';
import { agreementOptionLabel, agreementsForScope, usePartyAgreements } from './agreement-options';
import {
  buildCreateBody,
  emptyRow,
  excessOf,
  needsClosedProjectReason,
  transactionFormSchema,
  type TransactionFormValues,
} from './transaction-form';

export interface TransactionFormProps {
  initial: TransactionFormValues;
  /** Tür açılan eylemden gelir ve kilitlenir (?tur=). */
  lockKind: boolean;
  /** Anlaşmaya kilitli ödeme/tahsilat (/anlasmalar/:id/odeme). */
  lockedAgreement?: Agreement | null;
  /** Kopyada anlaşma bağlantısı "onay gerekli". */
  agreementConfirmationRequired?: boolean;
  copiedFrom?: { id: string; recordNo: number } | null;
  /** Başarılı kayıttan sonra geldiği liste/detaya dönüş. */
  onDone: (created: Transaction) => void;
}

type RowErrors = Record<number, { projectId?: string; amount?: string }>;

/** RHF'nin dizi alan hatalarını satır numarasına göre düz mesajlara çevirir. */
function rowErrors(value: unknown): RowErrors {
  if (!value || typeof value !== 'object') return {};
  const result: RowErrors = {};
  for (const [key, row] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d+$/.test(key) || !row || typeof row !== 'object') continue;
    const fields = row as { projectId?: { message?: string }; amount?: { message?: string } };
    result[Number(key)] = {
      projectId: fields.projectId?.message,
      amount: fields.amount?.message,
    };
  }
  return result;
}

const FORM_FIELDS = [
  'amount',
  'date',
  'projectId',
  'party',
  'categoryId',
  'description',
  'reason',
  'excessReason',
  'allocations',
];

/** Gelir veya gider formu (şartname 7.4). */
export function TransactionForm({
  initial,
  lockKind,
  lockedAgreement,
  agreementConfirmationRequired = false,
  copiedFrom,
  onDone,
}: TransactionFormProps) {
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: initial,
  });
  // Bütün form değerleri; React Compiler ile uyumlu abonelik.
  const values = useWatch({ control, compute: (all) => all });
  const [agreementConfirmed, setAgreementConfirmed] = useState(!agreementConfirmationRequired);
  // Kayıttan sonra gösterilen sonuç: mükerrer uyarısı veya yüklenemeyen belge.
  const [created, setCreated] = useState<{
    tx: Transaction;
    warnings: Warning[];
    /** "Kaydet ve yeni ekle" ile kaydedildiyse yeni kayıt için formun değerleri. */
    next: TransactionFormValues | null;
  } | null>(null);
  const documents = useUploadQueue();
  const [uploading, setUploading] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [excessFromServer, setExcessFromServer] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const submission = useCreateSubmission<Transaction>();
  const { dialog, allowNavigation } = useUnsavedChanges(
    (isDirty || documents.items.length > 0) && submission.state.status !== 'saved',
    submission.state.status === 'verifying',
  );

  const projects = useProjectOptions();
  const categories = useCategories(false);
  const partyAgreements = usePartyAgreements(values.party?.id, values.kind);
  const suggestions = useQuery({
    queryKey: ['transactions', 'suggestions', values.kind],
    queryFn: () => apiGet<string[]>('/transactions/suggestions', { kind: values.kind }),
    staleTime: 5 * 60_000,
  });

  const agreementList = useMemo(
    () => [
      ...(lockedAgreement ? [lockedAgreement] : []),
      ...(partyAgreements.data?.items ?? []).filter((a) => a.id !== lockedAgreement?.id),
    ],
    [lockedAgreement, partyAgreements.data],
  );
  const agreementMap = useMemo(
    () => new Map(agreementList.map((agreement) => [agreement.id, agreement])),
    [agreementList],
  );
  const selectedAgreement = values.agreementId ? agreementMap.get(values.agreementId) : undefined;
  const simpleOptions = agreementsForScope(
    agreementList,
    values.scope,
    values.projectId,
    values.agreementId,
  );
  const openAgreementsOfParty = agreementsForScope(
    agreementList,
    values.scope,
    values.projectId,
    '',
  );
  const excess = excessOf(values, agreementMap);
  const showExcess = excess > 0 || excessFromServer !== null;
  const needsReason = needsClosedProjectReason(values, projects.data?.items);
  const isExpense = values.kind === 'expense';
  const direction = directionOfKind(values.kind);
  const agreementLocked = Boolean(lockedAgreement) || Boolean(selectedAgreement && !values.split);
  const selectedProject = projectById(projects.data?.items, values.projectId);

  function selectAgreement(id: string) {
    setValue('agreementId', id, { shouldDirty: true });
    const agreement = agreementMap.get(id);
    if (!agreement) return;
    // Anlaşma seçilirse kişi ve kapsam anlaşmadan gelir ve kilitlenir.
    setValue('scope', agreement.scope, { shouldDirty: true });
    setValue('projectId', agreement.projectId ?? '', { shouldDirty: true });
    if (agreement.party) setValue('party', { id: agreement.partyId, name: agreement.party.name });
  }

  function startSplit() {
    const first = {
      ...emptyRow(values.scope, values.projectId),
      agreementId: values.agreementId,
      amount: values.amount,
    };
    setValue('allocations', [first, emptyRow(values.scope)], { shouldDirty: true });
    setValue('split', true, { shouldDirty: true });
  }

  function stopSplit() {
    const first = values.allocations[0];
    if (first) {
      setValue('scope', first.scope);
      setValue('projectId', first.projectId);
      setValue('agreementId', first.agreementId);
    }
    setValue('split', false, { shouldDirty: true });
  }

  /** Tutar boşalır; kapsam ve tarih korunur; kişi/anlaşma bağlantısı yeniden sorulur. */
  function startNext(formValues: TransactionFormValues, tx: Transaction, warnings: Warning[]) {
    reset({
      ...formValues,
      amount: '',
      party: lockedAgreement ? formValues.party : null,
      agreementId: lockedAgreement ? lockedAgreement.id : '',
      description: '',
      reason: '',
      split: false,
      allocations: [],
      confirmExcess: false,
      excessReason: '',
    });
    submission.reset();
    documents.clear();
    setSavedNote(
      `#${tx.recordNo} kaydedildi.${lockedAgreement ? '' : ' Yeni kayıt için kişi ve anlaşmayı yeniden seçin.'}${
        warnings.length ? ` ${warnings.map((w) => w.message).join(' ')}` : ''
      }`,
    );
  }

  const submit = (andNew: boolean) =>
    handleSubmit(async (formValues) => {
      setFormError(null);
      if (
        !agreementConfirmed &&
        (formValues.agreementId || formValues.allocations.some((a) => a.agreementId))
      ) {
        setFormError('Kopyalanan anlaşma bağlantısını onaylayın veya kaldırın.');
        return;
      }
      if (needsReason && formValues.reason.trim() === '') {
        setError('reason', { message: 'Gerekçe girin.' }, { shouldFocus: true });
        return;
      }
      if (excess > 0 && !formValues.confirmExcess) {
        setError(
          'confirmExcess',
          { message: 'Kaydetmek için fazla tutarı onaylayın.' },
          { shouldFocus: true },
        );
        return;
      }
      const body = buildCreateBody(formValues, { needsReason });
      try {
        const result = await submission.submit((key) =>
          apiPostFull<Transaction>('/transactions', body, { idempotencyKey: key }),
        );
        if (!result) return;
        await invalidateRecords(queryClient);
        const tx = result.data;
        const warnings = tx.warnings ?? [];
        const label = tx.kind === 'expense' ? 'Gider' : 'Gelir';
        toast(result.message ?? `${label} kaydedildi (#${tx.recordNo}).`);
        setExcessFromServer(null);
        // Belgeler finansal kayıttan sonra yüklenir; belge hatası kaydı tekrar oluşturmaz.
        let failedDocuments = 0;
        if (documents.items.length > 0) {
          setUploading(true);
          const summary = await documents
            .uploadAll({ ownerType: 'transaction', ownerId: tx.id })
            .finally(() => setUploading(false));
          failedDocuments = summary.failed;
          if (summary.uploaded > 0) await invalidateRecords(queryClient);
        }
        if (failedDocuments > 0) {
          allowNavigation();
          setCreated({ tx, warnings, next: andNew ? formValues : null });
          return;
        }
        if (andNew) {
          startNext(formValues, tx, warnings);
          return;
        }
        allowNavigation();
        if (warnings.length > 0) setCreated({ tx, warnings, next: null });
        else onDone(tx);
      } catch (caught) {
        if (isApiError(caught) && caught.code === 'EXCESS_CONFIRMATION_REQUIRED') {
          const amount = (caught.details as { excess?: number } | undefined)?.excess ?? 0;
          setExcessFromServer(amount);
          setValue('confirmExcess', false);
          return;
        }
        const rest = applyServerErrors(caught, setError, FORM_FIELDS, {
          partyId: 'party',
          'allocations.0.projectId': values.split ? 'allocations' : 'projectId',
        });
        if (rest.length > 0) setFormError(rest.join(' '));
      }
    });

  if (created) {
    const next = created.next;
    return (
      <div className="stack">
        <div className="alert alert--success" role="status">
          <p className="alert__title">
            {created.tx.kind === 'expense' ? 'Gider' : 'Gelir'} kaydedildi (#{created.tx.recordNo})
          </p>
        </div>
        <UploadResultNotice
          saved="İşlem kaydedildi"
          queue={documents}
          owner={{ ownerType: 'transaction', ownerId: created.tx.id }}
        />
        {created.warnings.map((warning) => (
          <div key={warning.code} className="alert alert--danger" role="alert">
            <p className="alert__title">Olası mükerrer kayıt</p>
            <p>{warning.message}</p>
            <p>
              Benzer kayıtlar:{' '}
              {warning.related.map((related, index) => (
                <span key={related.id}>
                  {index > 0 ? ', ' : ''}
                  <Link to={`/uygulama/islemler/${related.id}`}>#{related.recordNo}</Link>
                </span>
              ))}
            </p>
          </div>
        ))}
        <div className="form-actions">
          {next ? (
            <Button
              disabled={documents.busy}
              onClick={() => {
                startNext(next, created.tx, created.warnings);
                setCreated(null);
              }}
            >
              Yeni kayıt ekle
            </Button>
          ) : (
            <Button disabled={documents.busy} onClick={() => onDone(created.tx)}>
              Devam et
            </Button>
          )}
          <Link className="btn btn--secondary" to={`/uygulama/islemler/${created.tx.id}`}>
            Kaydı aç
          </Link>
        </div>
      </div>
    );
  }

  const saveLabel = lockedAgreement
    ? direction === 'payable'
      ? 'Öde'
      : 'Tahsil Et'
    : isExpense
      ? 'Gideri Kaydet'
      : 'Geliri Kaydet';
  // Belgeler yüklenirken de kilitli: kayıt tamamlandı, ikinci kez gönderilmemeli.
  const busy = submission.busy || uploading;

  return (
    <form
      className="stack stack--lg"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit(false)(event);
      }}
    >
      {dialog}
      {copiedFrom ? (
        <div className="alert alert--info">
          #{copiedFrom.recordNo} kaydından kopyalandı. Tarih bugün olarak ayarlandı; geçmiş ve
          belgeler kopyalanmadı.
        </div>
      ) : null}
      {savedNote ? (
        <div className="alert alert--success" role="status">
          <p className="alert__title">{savedNote}</p>
        </div>
      ) : null}
      {!canWrite ? <div className="alert alert--danger">{closedReason}</div> : null}

      <div className="form-columns">
        <section className="card stack" aria-label="Ana bilgiler">
          {lockKind || lockedAgreement ? (
            <p>
              <span className={isExpense ? 'badge badge--expense' : 'badge badge--income'}>
                <Icon icon={isExpense ? ArrowUpRight : ArrowDownLeft} />
                {lockedAgreement
                  ? direction === 'payable'
                    ? 'Ödeme (gider)'
                    : 'Tahsilat (gelir)'
                  : isExpense
                    ? 'Gider'
                    : 'Gelir'}
              </span>
            </p>
          ) : (
            <div className="stack stack--sm">
              <span className="field__label">
                Tür
                <span className="field__required" aria-hidden="true">
                  *
                </span>
              </span>
              <ChipGroup
                label="Tür"
                options={[
                  { value: 'expense', label: 'Gider' },
                  { value: 'income', label: 'Gelir' },
                ]}
                value={values.kind}
                onChange={(kind) => {
                  setValue('kind', kind, { shouldDirty: true });
                  setValue('agreementId', '');
                  setValue('categoryId', '');
                  setValue(
                    'allocations',
                    values.allocations.map((row) => ({ ...row, agreementId: '' })),
                  );
                }}
              />
            </div>
          )}

          <div className="form-grid">
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <Field
                  label="Tutar"
                  required
                  error={errors.amount?.message}
                  hint={
                    selectedAgreement && !values.split
                      ? `Anlaşmanın kalanı: ${formatMoney(selectedAgreement.remaining)}`
                      : undefined
                  }
                >
                  {(props) => (
                    <div className="stack stack--sm">
                      <MoneyInput
                        {...props}
                        ref={field.ref}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                      {selectedAgreement && !values.split && selectedAgreement.remaining > 0 ? (
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() =>
                            setValue('amount', kurusToInput(selectedAgreement.remaining), {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        >
                          Kalanın tamamı ({formatMoney(selectedAgreement.remaining)})
                        </Button>
                      ) : null}
                    </div>
                  )}
                </Field>
              )}
            />
            <Field label="İşlem tarihi" required error={errors.date?.message}>
              {(props) => <DateInput {...props} {...register('date')} />}
            </Field>
          </div>

          <Controller
            control={control}
            name="party"
            render={({ field }) => (
              <PartyPicker
                value={field.value}
                onChange={(party) => {
                  field.onChange(party);
                  setValue('agreementId', '');
                  setValue(
                    'allocations',
                    values.allocations.map((row) => ({ ...row, agreementId: '' })),
                  );
                }}
                required={Boolean(values.agreementId)}
                error={errors.party?.message}
                locked={agreementLocked}
                lockedReason="Anlaşmanın kişisi; anlaşma seçiliyken değişmez."
              />
            )}
          />

          {!values.split ? (
            <>
              <ScopePicker
                value={{ scope: values.scope, projectId: values.projectId }}
                onChange={(next) => {
                  setValue('scope', next.scope, { shouldDirty: true });
                  setValue('projectId', next.projectId, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  setValue('agreementId', '');
                }}
                error={errors.projectId?.message}
                locked={agreementLocked}
                lockedReason="Anlaşmanın kapsamı; anlaşma seçiliyken değişmez."
              />
              {selectedProject && selectedProject.status !== 'active' ? (
                <p className="meta">
                  Bu şantiye {selectedProject.status === 'completed' ? 'tamamlandı' : 'arşivlendi'}.
                  Anlaşmaya bağlı ödeme/tahsilat serbesttir; anlaşmaya bağlı olmayan gider gerekçe
                  ister.
                </p>
              ) : null}
              {lockedAgreement ? (
                <Field label="Anlaşma" hint={`Kalan: ${formatMoney(lockedAgreement.remaining)}`}>
                  {(props) => (
                    <input {...props} className="input" readOnly value={lockedAgreement.label} />
                  )}
                </Field>
              ) : (
                <Field
                  label="Anlaşma (isteğe bağlı)"
                  hint={
                    values.party
                      ? 'Anlaşma otomatik bağlanmaz; ödeme yalnız seçerseniz anlaşmanın kalanından düşer.'
                      : 'Anlaşmaya bağlamak için önce kişi/firma seçin.'
                  }
                >
                  {(props) => (
                    <SelectInput
                      {...props}
                      disabled={!values.party}
                      value={values.agreementId}
                      onChange={(event) => {
                        if (event.target.value) selectAgreement(event.target.value);
                        else setValue('agreementId', '', { shouldDirty: true });
                      }}
                    >
                      <option value="">Anlaşmaya bağlı değil</option>
                      {simpleOptions.map((agreement) => (
                        <option key={agreement.id} value={agreement.id}>
                          {agreementOptionLabel(agreement)}
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </Field>
              )}
              {values.party && !values.agreementId && openAgreementsOfParty.length > 0 ? (
                <div className="alert alert--info" role="status">
                  Bu kayıt anlaşmaya bağlı değil; anlaşmanın kalanı değişmez.
                </div>
              ) : null}
            </>
          ) : null}

          {agreementConfirmationRequired && !agreementConfirmed ? (
            <div className="alert alert--danger" role="alert">
              <p className="alert__title">Anlaşma bağlantısı onay gerekli</p>
              <p>
                Kopyalanan kayıt bir anlaşmaya bağlıydı. Bu yeni kayıt da aynı anlaşmanın kalanından
                düşecekse bağlantıyı onaylayın; değilse kaldırın.
              </p>
              <div className="form-actions">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setAgreementConfirmed(true)}
                >
                  Bağlantıyı onayla
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => {
                    setValue('agreementId', '', { shouldDirty: true });
                    setValue(
                      'allocations',
                      values.allocations.map((row) => ({ ...row, agreementId: '' })),
                    );
                    setAgreementConfirmed(true);
                  }}
                >
                  Bağlantıyı kaldır
                </Button>
              </div>
            </div>
          ) : null}

          {values.split ? (
            <Controller
              control={control}
              name="allocations"
              render={({ field }) => (
                <AllocationEditor
                  kind={values.kind}
                  amount={values.amount}
                  rows={field.value}
                  onChange={field.onChange}
                  partyId={values.party?.id}
                  errors={rowErrors(errors.allocations)}
                  sumError={errors.allocations?.root?.message ?? errors.allocations?.message}
                />
              )}
            />
          ) : null}

          {!lockedAgreement ? (
            <div>
              {values.split ? (
                <Button variant="ghost" size="small" onClick={stopSplit}>
                  <Icon icon={X} />
                  Paylaştırmayı kaldır
                </Button>
              ) : (
                <Button variant="ghost" size="small" onClick={startSplit}>
                  <Icon icon={Split} />
                  Paylaştır (birden fazla şantiye/anlaşmaya böl)
                </Button>
              )}
            </div>
          ) : null}
        </section>

        <section className="card stack" aria-label="Ek bilgiler">
          {isExpense ? (
            <Field label="Gider kategorisi" hint="Seçilmezse “Kategorisiz” olur.">
              {(props) => (
                <SelectInput {...props} {...register('categoryId')}>
                  <option value="">Kategorisiz</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
          ) : null}
          <Field
            label="Açıklama"
            error={errors.description?.message}
            hint={isExpense ? 'Örn. demir, beton, usta ödemesi' : undefined}
          >
            {(props) => (
              <>
                <input
                  {...props}
                  {...register('description')}
                  className="input"
                  list="aciklama-onerileri"
                  autoComplete="off"
                />
                <datalist id="aciklama-onerileri">
                  {(suggestions.data ?? []).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          {needsReason ? (
            <Field
              label="Gerekçe"
              required
              error={errors.reason?.message}
              hint="Tamamlanan veya arşivlenen şantiyeye anlaşmaya bağlı olmayan gider gerekçe ister."
            >
              {(props) => <TextArea {...props} {...register('reason')} rows={2} />}
            </Field>
          ) : null}
          <DocumentFormField queue={documents} disabled={busy} />
        </section>
      </div>

      {showExcess ? (
        <section className="alert alert--danger" aria-labelledby="excess-title">
          <p id="excess-title" className="alert__title">
            {excessMessage(values.kind, excessFromServer ?? excess)}
          </p>
          <p>
            Fazla {isExpense ? 'ödeme' : 'tahsilat'} engellenmez; onay ve gerekçe girmeden kayıt
            oluşmaz. Aşan tutar anlaşmada ayrıca “fazla” olarak görünür.
          </p>
          <Checkbox
            label={`Fazla ${isExpense ? 'ödemeyi' : 'tahsilatı'} onaylıyorum (${formatTl(excessFromServer ?? excess)})`}
            {...register('confirmExcess')}
          />
          {errors.confirmExcess?.message ? (
            <p className="field__error">{errors.confirmExcess.message}</p>
          ) : null}
          <Field
            label="Fazla tutar gerekçesi"
            required={values.confirmExcess}
            error={errors.excessReason?.message}
          >
            {(props) => <TextArea {...props} {...register('excessReason')} rows={2} />}
          </Field>
        </section>
      ) : null}

      {formError ? (
        <div className="alert alert--danger" role="alert">
          <p className="alert__title">{formError}</p>
        </div>
      ) : null}
      <SaveStatus state={submission.state} onVerify={() => void submission.verify()} />
      {uploading ? <UploadingNotice queue={documents} /> : null}

      <div className="form-actions sticky-actions">
        <Button
          type="submit"
          variant={lockedAgreement ? 'primary' : isExpense ? 'expense' : 'income'}
          loading={submission.state.status === 'saving'}
          disabled={busy || !canWrite}
        >
          {saveLabel}
        </Button>
        {!lockedAgreement ? (
          <Button
            variant="secondary"
            disabled={busy || !canWrite}
            onClick={() => void submit(true)()}
          >
            Kaydet ve yeni ekle
          </Button>
        ) : null}
      </div>
    </form>
  );
}
