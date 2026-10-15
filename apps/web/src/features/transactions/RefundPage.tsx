import {
  refundableAmountOf,
  refundKindOf,
  todayInIstanbul,
  validateRefund,
  type CashKind,
} from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Receipt, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { apiPostFull, isApiError } from '../../api/client';
import { invalidateRecords, useTransaction } from '../../api/queries';
import { useCreateSubmission } from '../../api/submission';
import type { Transaction, TransactionDetail } from '../../api/types';
import { Amount } from '../../components/ui/Amount';
import { Button } from '../../components/ui/Button';
import { PageHeader, Panel } from '../../components/ui/Card';
import { DateInput, Field, TextArea } from '../../components/ui/Field';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { toKurus } from '../../lib/forms';
import { formatDate, formatMoney } from '../../lib/format';
import { KIND_LABEL } from '../../lib/labels';
import { parseMoney } from '@santiye/shared';
import { toast } from '../../stores/ui';
import { DocumentFormField, UploadingNotice, UploadResultNotice } from '../documents/DocumentParts';
import { useUploadQueue } from '../documents/useUploadQueue';
import { ImpactBlock } from './ImpactBlock';
import { useImpactPreview, type ImpactAllocation } from './impact';

/** İade kaydet (şartname 7.5). */
export function RefundPage() {
  const { id } = useParams();
  const query = useTransaction(id);
  usePageMeta('İade kaydet');
  return (
    <main className="page">
      <PageHeader
        title="İade kaydet"
        subtitle="Geri gelen veya geri verilen gerçek para; kaynak hareketin tutarı değişmez"
        back={{ to: `/uygulama/islemler/${id}`, label: 'Kayıt' }}
      />
      {query.isPending ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.kind !== 'income' && query.data.kind !== 'expense' ? (
        <div className="alert alert--danger">İade yalnız gelir veya gider kaydına yapılabilir.</div>
      ) : query.data.deletedAt ? (
        <div className="alert alert--danger">Silinmiş kayda iade yapılamaz.</div>
      ) : (
        <RefundForm source={query.data} />
      )}
    </main>
  );
}

function RefundForm({ source }: { source: TransactionDetail }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const kind = source.kind as CashKind;
  const refundKind = refundKindOf(kind);
  const split = source.allocations.length > 1;
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayInIstanbul());
  const [reason, setReason] = useState('');
  const [parts, setParts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const submission = useCreateSubmission<Transaction>();
  const documents = useUploadQueue();
  const [uploading, setUploading] = useState(false);
  // Belgesi yüklenemeyen iade: kayıt tamam, yalnız belge yeniden denenir.
  const [saved, setSaved] = useState<Transaction | null>(null);
  const dirty =
    amount !== '' ||
    reason !== '' ||
    Object.values(parts).some(Boolean) ||
    documents.items.length > 0;
  const { dialog, allowNavigation } = useUnsavedChanges(
    dirty && submission.state.status !== 'saved',
    submission.state.status === 'verifying',
  );

  const total = toKurus(amount);
  const partAmounts = source.allocations.map((allocation) => ({
    allocationId: allocation.id,
    amount: split ? (toKurus(parts[allocation.id] ?? '') ?? 0) : (total ?? 0),
  }));
  const usedParts = partAmounts.filter((part) => part.amount > 0);

  const effect: ImpactAllocation[] = usedParts.map((part) => {
    const allocation = source.allocations.find((a) => a.id === part.allocationId)!;
    return {
      scope: allocation.scope,
      projectId: allocation.projectId,
      agreementId: allocation.agreementId,
      amount: part.amount,
      agreementNet: -part.amount,
    };
  });
  const names = Object.fromEntries(
    source.allocations.filter((a) => a.project).map((a) => [a.projectId!, a.project!.name]),
  );
  // Önizleme yalnız iade sınırları içindeki girişte gösterilir.
  const previewValid =
    total !== null &&
    total > 0 &&
    validateRefund({ kind, allocations: source.allocations }, { amount: total, parts: usedParts })
      .length === 0;
  const impact = useImpactPreview(refundKind, [], previewValid ? effect : [], {
    enabled: previewValid,
    projectNames: names,
  });

  async function onSubmit() {
    setFormError(null);
    const next: Record<string, string> = {};
    if (!amount.trim()) next.amount = 'İade tutarını girin.';
    else {
      const parsed = parseMoney(amount);
      if (!parsed.ok) next.amount = parsed.message;
      else if (parsed.value <= 0) next.amount = 'Tutar 0’dan büyük olmalı.';
    }
    if (!date) next.date = 'Tarihi seçin.';
    if (!reason.trim()) next.reason = 'Gerekçe girin.';
    if (Object.keys(next).length === 0 && total !== null) {
      const issues = validateRefund(
        { kind, allocations: source.allocations },
        { amount: total, parts: usedParts },
      );
      for (const issue of issues) {
        if (issue.path[0] === 'amount') next.amount = issue.message;
        else if (issue.path[0] === 'parts' && typeof issue.path[1] === 'number') {
          const part = usedParts[issue.path[1]];
          if (part) next[`part-${part.allocationId}`] = issue.message;
        } else next.parts = issue.message;
      }
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      const result = await submission.submit((key) =>
        apiPostFull<Transaction>(
          `/transactions/${source.id}/refunds`,
          { amount: total, date, reason: reason.trim(), parts: usedParts },
          { idempotencyKey: key },
        ),
      );
      if (!result) return;
      await invalidateRecords(queryClient);
      toast(`İade kaydedildi (#${result.data.recordNo}).`);
      allowNavigation();
      if (documents.items.length > 0) {
        setUploading(true);
        const summary = await documents
          .uploadAll({ ownerType: 'transaction', ownerId: result.data.id })
          .finally(() => setUploading(false));
        if (summary.uploaded > 0) await invalidateRecords(queryClient);
        if (summary.failed > 0) {
          setSaved(result.data);
          return;
        }
      }
      await navigate(`/uygulama/islemler/${source.id}`, { replace: true });
    } catch (caught) {
      if (isApiError(caught) && caught.issues.length > 0) {
        setFormError(caught.issues.map((issue) => issue.message).join(' '));
      }
    }
  }

  if (saved) {
    return (
      <div className="stack">
        <UploadResultNotice
          saved={`İade kaydedildi (#${saved.recordNo})`}
          queue={documents}
          owner={{ ownerType: 'transaction', ownerId: saved.id }}
        />
        <div className="form-actions">
          <Button
            disabled={documents.busy}
            onClick={() => void navigate(`/uygulama/islemler/${source.id}`, { replace: true })}
          >
            Kaynak kayda dön
          </Button>
          <Button
            variant="secondary"
            disabled={documents.busy}
            onClick={() => void navigate(`/uygulama/islemler/${saved.id}`, { replace: true })}
          >
            İade kaydını aç
          </Button>
        </div>
      </div>
    );
  }

  const busy = submission.busy || uploading;

  return (
    <form
      className="stack stack--lg"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit();
      }}
    >
      {dialog}
      <div className="form-columns form-columns--side-first">
        <Panel title="Kaynak hareket" icon={Receipt}>
          <div className="panel__body">
            <dl className="definition-list">
              <dt>Kayıt</dt>
              <dd>
                #{source.recordNo} · {KIND_LABEL[source.kind]} · {formatDate(source.date)}
              </dd>
              <dt>Tutar</dt>
              <dd>
                <Amount value={source.amount} kind={source.kind} />
              </dd>
              <dt>Kişi/firma</dt>
              <dd>{source.party?.name ?? 'Muhatapsız'}</dd>
              <dt>Önceki iadeler</dt>
              <dd>
                {source.refunds.filter((r) => !r.deletedAt).length === 0
                  ? 'Yok'
                  : source.refunds
                      .filter((r) => !r.deletedAt)
                      .map((r) => `#${r.recordNo} ${formatMoney(r.amount)}`)
                      .join(', ')}
              </dd>
              <dt>En fazla iade edilebilir</dt>
              <dd>
                <strong>{formatMoney(source.refundable ?? 0)}</strong>
              </dd>
            </dl>
          </div>
        </Panel>

        <Panel title={kind === 'expense' ? 'Ödeme iadesi' : 'Tahsilat iadesi'} icon={Undo2}>
          <div className="panel__body stack">
            <p className="meta">
              {kind === 'expense'
                ? 'Ödemeden geri gelen para. İade başka anlaşmaya kendiliğinden dağıtılmaz; kaynak hareketin tutarı değişmez.'
                : 'Müşteriye geri verilen tahsilat. İade başka anlaşmaya kendiliğinden dağıtılmaz; kaynak hareketin tutarı değişmez.'}
            </p>
            <div className="form-grid">
              <Field label="İade tutarı" required error={errors.amount}>
                {(props) => <MoneyInput {...props} value={amount} onChange={setAmount} />}
              </Field>
              <Field label="Gerçek tarih" required error={errors.date}>
                {(props) => (
                  <DateInput
                    {...props}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                )}
              </Field>
            </div>
            {split ? (
              <fieldset className="stack">
                <legend className="field__label">Hangi paydan ne kadar?</legend>
                {source.allocations.map((allocation) => (
                  <Field
                    key={allocation.id}
                    label={`${allocation.scope === 'company' ? 'Firma geneli' : (allocation.project?.name ?? 'Şantiye')}${
                      allocation.agreement ? ` — ${allocation.agreement.name}` : ''
                    }`}
                    hint={`Pay ${formatMoney(allocation.amount)} · en fazla ${formatMoney(refundableAmountOf(allocation))} iade edilebilir`}
                    error={errors[`part-${allocation.id}`]}
                  >
                    {(props) => (
                      <MoneyInput
                        {...props}
                        value={parts[allocation.id] ?? ''}
                        onChange={(value) =>
                          setParts((current) => ({ ...current, [allocation.id]: value }))
                        }
                      />
                    )}
                  </Field>
                ))}
                {errors.parts ? <p className="field__error">{errors.parts}</p> : null}
              </fieldset>
            ) : null}
            <Field
              label="Kısa gerekçe"
              required
              error={errors.reason}
              hint="İade kaydının açıklaması olur."
            >
              {(props) => (
                <TextArea
                  {...props}
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
            </Field>
            <DocumentFormField queue={documents} disabled={busy} />
            {previewValid ? <ImpactBlock impact={impact} /> : null}
          </div>
        </Panel>
      </div>

      {formError ? (
        <div className="alert alert--danger" role="alert">
          {formError}
        </div>
      ) : null}
      {!canWrite ? <div className="alert alert--danger">{closedReason}</div> : null}
      <SaveStatus state={submission.state} onVerify={() => void submission.verify()} />
      {uploading ? <UploadingNotice queue={documents} /> : null}
      <div className="form-actions sticky-actions">
        <Button
          type="submit"
          loading={submission.state.status === 'saving'}
          disabled={busy || !canWrite || submission.state.status === 'saved'}
        >
          İadeyi Kaydet
        </Button>
      </div>
    </form>
  );
}
