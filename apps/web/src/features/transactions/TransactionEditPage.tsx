import { excessMessage, parseMoney } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { apiPatch, errorMessage, isApiError } from '../../api/client';
import { invalidateRecords, useCategories, useTransaction } from '../../api/queries';
import type { Transaction, TransactionDetail } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { ConflictView, type ConflictField } from '../../components/ui/ConflictView';
import {
  Checkbox,
  DateInput,
  Field,
  SelectInput,
  TextArea,
  TextInput,
} from '../../components/ui/Field';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useSnapshot } from '../../hooks/useSnapshot';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { kurusToInput, toKurus } from '../../lib/forms';
import { formatDate, formatMoney, formatTl } from '../../lib/format';
import { KIND_LABEL } from '../../lib/labels';
import type { SaveState } from '../../api/submission';
import { toast } from '../../stores/ui';
import { PartyPicker, ScopePicker } from '../common/Pickers';
import { AllocationEditor } from './AllocationEditor';
import { agreementOptionLabel, agreementsForScope, usePartyAgreements } from './agreement-options';
import { ImpactBlock } from './ImpactBlock';
import { allocationsEffect, useImpactPreview, type ImpactAllocation } from './impact';
import {
  allocationsOf,
  excessOf,
  newRowKey,
  splitSumIssue,
  type TransactionFormValues,
} from './transaction-form';

/** Finansal düzeltme (şartname 7.4): eski/yeni değerler ve bakiye etkisi önizlenir, gerekçe zorunlu. */
export function TransactionEditPage() {
  const { id } = useParams();
  const query = useTransaction(id);
  const [transaction, setTransaction] = useSnapshot(query.data);
  const sourceId = query.data?.refundOf?.transactionId;
  const source = useTransaction(sourceId);
  usePageMeta('Kaydı düzenle');

  let content;
  if (query.isPending || (sourceId && source.isPending)) content = <Loading />;
  else if (query.error || !transaction) {
    content = <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  } else if (transaction.deletedAt) {
    content = (
      <div className="alert alert--danger">Silinmiş kayıt düzenlenemez; önce geri alın.</div>
    );
  } else if (sourceId && (source.error || !source.data)) {
    content = <ErrorState error={source.error} onRetry={() => void source.refetch()} />;
  } else {
    content = (
      <EditForm
        key={transaction.updatedAt}
        transaction={transaction}
        source={source.data ?? null}
        reload={async () => {
          const result = await query.refetch();
          if (result.data) setTransaction(result.data);
        }}
      />
    );
  }
  return (
    <main className="page">
      <PageHeader
        title={query.data ? `#${query.data.recordNo} düzenle` : 'Kaydı düzenle'}
        back={{ to: `/uygulama/islemler/${id}`, label: 'Kayıt' }}
      />
      {content}
    </main>
  );
}

function valuesFrom(t: TransactionDetail): TransactionFormValues {
  const split = t.allocations.length > 1;
  const first = t.allocations[0];
  return {
    kind: t.kind === 'income' || t.kind === 'expense' ? t.kind : 'expense',
    amount: kurusToInput(t.amount),
    date: t.date,
    scope: first?.scope ?? 'project',
    projectId: first?.projectId ?? '',
    party: t.party ? { id: t.party.id, name: t.party.name } : null,
    agreementId: split ? '' : (first?.agreementId ?? ''),
    categoryId: t.categoryId ?? '',
    description: t.description,
    reason: '',
    split,
    allocations: t.allocations.map((allocation) => ({
      key: newRowKey(),
      id: allocation.id,
      scope: allocation.scope,
      projectId: allocation.projectId ?? '',
      agreementId: allocation.agreementId ?? '',
      amount: kurusToInput(allocation.amount),
    })),
    confirmExcess: false,
    excessReason: '',
  };
}

function EditForm({
  transaction: t,
  source,
  reload,
}: {
  transaction: TransactionDetail;
  source: TransactionDetail | null;
  reload: () => unknown;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const isRefund = Boolean(t.refundOf);
  const original = useMemo(() => valuesFrom(t), [t]);
  const [values, setValues] = useState<TransactionFormValues>(original);
  const [parts, setParts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (t.refundOf?.parts ?? []).map((p) => [p.allocationId, kurusToInput(p.amount)]),
    ),
  );
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(t.updatedAt);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const [conflict, setConflict] = useState<Transaction | null>(null);
  const [serverExcess, setServerExcess] = useState<number | null>(null);
  const categories = useCategories(false);
  const partyAgreements = usePartyAgreements(values.party?.id, values.kind);
  const set = (patch: Partial<TransactionFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const hasRefunds = t.allocations.some((a) => a.refundedAmount > 0);
  const refundedById = new Map(t.allocations.map((a) => [a.id, a.refundedAmount]));
  const lockedRowIds = new Set(t.allocations.filter((a) => a.refundedAmount > 0).map((a) => a.id));

  // Önce/sonra etkisi.
  const before = allocationsEffect(t);
  const refundParts = (t.refundOf?.parts ?? []).map((p) => ({
    allocationId: p.allocationId,
    amount: toKurus(parts[p.allocationId] ?? '') ?? 0,
  }));
  const after: ImpactAllocation[] = isRefund
    ? refundParts.map((part) => {
        const allocation = source?.allocations.find((a) => a.id === part.allocationId);
        return {
          scope: allocation?.scope ?? 'company',
          projectId: allocation?.projectId ?? null,
          agreementId: allocation?.agreementId ?? null,
          amount: part.amount,
          agreementNet: -part.amount,
        };
      })
    : allocationsOf(values).map((a) => ({
        scope: a.scope,
        projectId: a.projectId ?? null,
        agreementId: a.agreementId ?? null,
        amount: a.amount,
        agreementNet: a.amount - (a.id ? (refundedById.get(a.id) ?? 0) : 0),
      }));
  const names = Object.fromEntries(
    [...t.allocations, ...(source?.allocations ?? [])]
      .filter((a) => a.project)
      .map((a) => [a.projectId!, a.project!.name]),
  );
  const impact = useImpactPreview(t.kind, before, after, { projectNames: names });

  const newAmount = isRefund
    ? refundParts.reduce((sum, p) => sum + p.amount, 0)
    : toKurus(values.amount);
  const allocationKey = (
    list: {
      scope: string;
      projectId?: string | null;
      agreementId?: string | null;
      amount: number;
    }[],
  ) =>
    list.map((a) => `${a.scope}|${a.projectId ?? ''}|${a.agreementId ?? ''}|${a.amount}`).join(';');
  const financialChanged = isRefund
    ? newAmount !== t.amount ||
      values.date !== t.date ||
      refundParts.some(
        (p) =>
          p.amount !== t.refundOf!.parts.find((o) => o.allocationId === p.allocationId)?.amount,
      )
    : newAmount !== t.amount ||
      values.date !== t.date ||
      (values.party?.id ?? null) !== (t.party?.id ?? null) ||
      allocationKey(allocationsOf(values)) !== allocationKey(t.allocations);
  const dirty =
    financialChanged ||
    values.description !== t.description ||
    values.categoryId !== (t.categoryId ?? '');
  const { dialog, allowNavigation } = useUnsavedChanges(dirty && state.status !== 'saved');

  const agreements = useMemo(
    () => new Map((partyAgreements.data?.items ?? []).map((a) => [a.id, a])),
    [partyAgreements.data],
  );
  const ownShare = new Map<string, number>();
  for (const effect of before) {
    if (effect.agreementId)
      ownShare.set(
        effect.agreementId,
        (ownShare.get(effect.agreementId) ?? 0) + effect.agreementNet,
      );
  }
  const excess = isRefund || !financialChanged ? 0 : excessOf(values, agreements, ownShare);
  const shownExcess = serverExcess ?? (excess > 0 ? excess : null);
  const simpleOptions = agreementsForScope(
    partyAgreements.data?.items ?? [],
    values.scope,
    values.projectId,
    values.agreementId,
  );

  async function save() {
    const next: Record<string, string> = {};
    if (!isRefund) {
      const parsed = parseMoney(values.amount);
      if (!parsed.ok) next.amount = parsed.message;
      else if (parsed.value <= 0) next.amount = 'Tutar 0’dan büyük olmalı.';
      if (!values.split && values.scope === 'project' && !values.projectId)
        next.projectId = 'Şantiye seçin.';
      if (values.split) {
        const sum = splitSumIssue(values.amount, values.allocations);
        if (sum) next.allocations = sum;
      }
    }
    if (!values.date) next.date = 'Tarihi seçin.';
    if (financialChanged && !values.reason.trim())
      next.reason = 'Finansal düzeltme için gerekçe girin.';
    if (shownExcess !== null && (!values.confirmExcess || !values.excessReason.trim())) {
      next.excess = 'Fazla tutarı onaylayıp gerekçe girin.';
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const body = isRefund
      ? {
          ...(newAmount !== t.amount ? { amount: newAmount } : {}),
          date: values.date,
          description: values.description.trim(),
          parts: refundParts.filter((p) => p.amount > 0),
          ...(financialChanged ? { reason: values.reason.trim() } : {}),
          expectedUpdatedAt,
        }
      : {
          amount: newAmount,
          date: values.date,
          partyId: values.party?.id ?? null,
          categoryId: values.kind === 'expense' && values.categoryId ? values.categoryId : null,
          description: values.description.trim(),
          allocations: allocationsOf(values).map((a) => ({
            ...(a.id ? { id: a.id } : {}),
            scope: a.scope,
            ...(a.projectId ? { projectId: a.projectId } : {}),
            ...(a.agreementId ? { agreementId: a.agreementId } : {}),
            amount: a.amount,
          })),
          ...(financialChanged ? { reason: values.reason.trim() } : {}),
          ...(values.confirmExcess
            ? { confirmExcess: true, excessReason: values.excessReason.trim() }
            : {}),
          expectedUpdatedAt,
        };
    setState({ status: 'saving' });
    try {
      await apiPatch<Transaction>(`/transactions/${t.id}`, body);
      setState({ status: 'saved' });
      await invalidateRecords(queryClient);
      toast(`#${t.recordNo} güncellendi.`);
      allowNavigation();
      await navigate(`/uygulama/islemler/${t.id}`, { replace: true });
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'CONFLICT' && caught.current) {
        setConflict(caught.current as Transaction);
        setState({ status: 'failed', message: caught.message });
        return;
      }
      if (isApiError(caught) && caught.code === 'EXCESS_CONFIRMATION_REQUIRED') {
        setServerExcess((caught.details as { excess?: number } | undefined)?.excess ?? 0);
      }
      setState({
        status: 'failed',
        message: [
          errorMessage(caught),
          ...(isApiError(caught) ? caught.issues.map((i) => i.message) : []),
        ]
          .filter((m, i, all) => all.indexOf(m) === i)
          .join(' '),
      });
    }
  }

  const conflictFields: ConflictField[] = conflict
    ? [
        {
          key: 'amount',
          label: 'Tutar',
          current: formatMoney(conflict.amount),
          mine: newAmount !== null ? formatMoney(newAmount) : values.amount,
          differs: conflict.amount !== newAmount,
        },
        {
          key: 'date',
          label: 'Tarih',
          current: formatDate(conflict.date),
          mine: formatDate(values.date),
          differs: conflict.date !== values.date,
        },
        {
          key: 'party',
          label: 'Kişi/firma',
          current:
            conflict.partyId === (t.party?.id ?? null)
              ? (t.party?.name ?? '—')
              : 'Başka kişi/firma',
          mine: values.party?.name ?? '—',
          differs: conflict.partyId !== (values.party?.id ?? null),
        },
        {
          key: 'allocations',
          label: 'Paylar',
          current: `${conflict.allocations.length} pay`,
          mine: isRefund ? `${refundParts.length} pay` : `${allocationsOf(values).length} pay`,
          differs:
            conflict.allocations.length !==
            (isRefund ? refundParts.length : allocationsOf(values).length),
        },
        {
          key: 'description',
          label: 'Açıklama',
          current: conflict.description || '—',
          mine: values.description || '—',
          differs: conflict.description !== values.description,
        },
      ]
    : [];

  return (
    <form
      className="stack stack--lg"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {dialog}
      {conflict ? (
        <ConflictView
          fields={conflictFields}
          onUseCurrent={() => {
            allowNavigation();
            setConflict(null);
            void reload();
          }}
          onKeepMine={() => {
            setExpectedUpdatedAt(conflict.updatedAt);
            setConflict(null);
            setState({ status: 'idle' });
            void invalidateRecords(queryClient);
          }}
        />
      ) : null}

      <Card title={`${KIND_LABEL[t.kind]} · #${t.recordNo}`}>
        <div className="stack">
          {isRefund ? (
            <>
              <p className="meta">
                İade kaydında yalnız tutar, tarih, açıklama ve iade payları değiştirilebilir.
              </p>
              {(t.refundOf?.parts ?? []).map((part) => {
                const allocation = source?.allocations.find((a) => a.id === part.allocationId);
                return (
                  <Field
                    key={part.allocationId}
                    label={`İade tutarı${
                      allocation
                        ? ` — ${allocation.scope === 'company' ? 'Firma geneli' : (allocation.project?.name ?? 'Şantiye')}${allocation.agreement ? `, ${allocation.agreement.name}` : ''}`
                        : ''
                    }`}
                    required
                    error={errors.amount}
                  >
                    {(props) => (
                      <MoneyInput
                        {...props}
                        value={parts[part.allocationId] ?? ''}
                        onChange={(value) =>
                          setParts((current) => ({ ...current, [part.allocationId]: value }))
                        }
                      />
                    )}
                  </Field>
                );
              })}
            </>
          ) : (
            <Field label="Tutar" required error={errors.amount}>
              {(props) => (
                <MoneyInput
                  {...props}
                  value={values.amount}
                  onChange={(amount) => set({ amount })}
                />
              )}
            </Field>
          )}
          <Field label="İşlem tarihi" required error={errors.date}>
            {(props) => (
              <DateInput
                {...props}
                value={values.date}
                onChange={(e) => set({ date: e.target.value })}
              />
            )}
          </Field>

          {!isRefund ? (
            <>
              <PartyPicker
                value={values.party}
                onChange={(party) =>
                  set({
                    party,
                    agreementId: '',
                    allocations: values.allocations.map((row) =>
                      row.id && lockedRowIds.has(row.id) ? row : { ...row, agreementId: '' },
                    ),
                  })
                }
                locked={hasRefunds}
                lockedReason="Bağlı iadesi olan kaydın kişisi değiştirilemez."
              />
              {values.split ? (
                <AllocationEditor
                  kind={values.kind}
                  amount={values.amount}
                  rows={values.allocations}
                  onChange={(allocations) => set({ allocations })}
                  partyId={values.party?.id}
                  errors={{}}
                  sumError={errors.allocations}
                  lockedRowIds={lockedRowIds}
                />
              ) : (
                <>
                  <ScopePicker
                    value={{ scope: values.scope, projectId: values.projectId }}
                    onChange={(next) => set({ ...next, agreementId: '' })}
                    error={errors.projectId}
                    locked={hasRefunds}
                    lockedReason="Bağlı iadesi olan payın şantiyesi değiştirilemez. Hedef değişecekse önce iadeyi silin."
                  />
                  <Field label="Anlaşma">
                    {(props) => (
                      <SelectInput
                        {...props}
                        disabled={!values.party || hasRefunds}
                        value={values.agreementId}
                        onChange={(event) => set({ agreementId: event.target.value })}
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
                  {!hasRefunds ? (
                    <div>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() =>
                          set({
                            split: true,
                            allocations: [
                              {
                                key: newRowKey(),
                                id: t.allocations[0]?.id,
                                scope: values.scope,
                                projectId: values.projectId,
                                agreementId: values.agreementId,
                                amount: values.amount,
                              },
                              {
                                key: newRowKey(),
                                scope: values.scope,
                                projectId: '',
                                agreementId: '',
                                amount: '',
                              },
                            ],
                          })
                        }
                      >
                        Paylaştır
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
              {values.kind === 'expense' ? (
                <Field label="Gider kategorisi">
                  {(props) => (
                    <SelectInput
                      {...props}
                      value={values.categoryId}
                      onChange={(e) => set({ categoryId: e.target.value })}
                    >
                      <option value="">Kategorisiz</option>
                      {t.category && !(categories.data ?? []).some((c) => c.id === t.categoryId) ? (
                        <option value={t.categoryId ?? ''}>{t.category.name} (pasif)</option>
                      ) : null}
                      {(categories.data ?? []).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </SelectInput>
                  )}
                </Field>
              ) : null}
            </>
          ) : null}

          <Field label="Açıklama">
            {(props) => (
              <TextInput
                {...props}
                value={values.description}
                onChange={(e) => set({ description: e.target.value })}
              />
            )}
          </Field>
          {hasRefunds ? (
            <p className="meta">
              Bu kaydın bağlı iadesi var: iadeli pay kaldırılamaz, şantiyesi veya anlaşması
              değiştirilemez, tutarı iade toplamının altına indirilemez. Hedef değişecekse önce
              iadeyi silin.
            </p>
          ) : null}
        </div>
      </Card>

      {financialChanged ? (
        <Card title="Değişiklik önizlemesi">
          <div className="stack">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Alan</th>
                  <th scope="col">Eski</th>
                  <th scope="col">Yeni</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Tutar</th>
                  <td>{formatMoney(t.amount)}</td>
                  <td>{newAmount !== null ? formatMoney(newAmount) : '—'}</td>
                </tr>
                <tr>
                  <th scope="row">Tarih</th>
                  <td>{formatDate(t.date)}</td>
                  <td>{formatDate(values.date)}</td>
                </tr>
                {!isRefund ? (
                  <tr>
                    <th scope="row">Kişi/firma</th>
                    <td>{t.party?.name ?? '—'}</td>
                    <td>{values.party?.name ?? '—'}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <ImpactBlock impact={impact} note="Tutar değişmiyorsa firma toplamı değişmez." />
            <Field label="Gerekçe" required error={errors.reason}>
              {(props) => (
                <TextArea
                  {...props}
                  rows={2}
                  value={values.reason}
                  onChange={(e) => set({ reason: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Card>
      ) : (
        <p className="meta">
          Yalnız açıklama veya kategori değişiyorsa gerekçe gerekmez; geçmişe yine yazılır.
        </p>
      )}

      {shownExcess !== null ? (
        <section className="alert alert--danger">
          <p className="alert__title">{excessMessage(values.kind, shownExcess)}</p>
          <Checkbox
            label={`Fazla tutarı onaylıyorum (${formatTl(shownExcess)})`}
            checked={values.confirmExcess}
            onChange={(e) => set({ confirmExcess: e.target.checked })}
          />
          <Field label="Fazla tutar gerekçesi" required error={errors.excess}>
            {(props) => (
              <TextArea
                {...props}
                rows={2}
                value={values.excessReason}
                onChange={(e) => set({ excessReason: e.target.value })}
              />
            )}
          </Field>
        </section>
      ) : null}

      {!canWrite ? <div className="alert alert--danger">{closedReason}</div> : null}
      <SaveStatus state={state} />
      <div className="form-actions sticky-actions">
        <Button
          type="submit"
          loading={state.status === 'saving'}
          disabled={!canWrite || Boolean(conflict) || !dirty}
        >
          Düzeltmeyi Kaydet
        </Button>
      </div>
    </form>
  );
}
