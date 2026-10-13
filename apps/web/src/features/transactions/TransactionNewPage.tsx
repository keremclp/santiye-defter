import { todayInIstanbul } from '@santiye/shared';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import { useAgreement, useParty } from '../../api/queries';
import type { Agreement, DuplicateDraft, TransactionDetail } from '../../api/types';
import { PageHeader } from '../../components/ui/Card';
import { ErrorState, Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { kurusToInput } from '../../lib/forms';
import { newRowKey, type TransactionFormValues } from './transaction-form';
import { TransactionForm } from './TransactionForm';

export interface CopyState {
  draft: DuplicateDraft;
  source: Pick<TransactionDetail, 'id' | 'recordNo' | 'party'>;
}

function baseValues(kind: 'income' | 'expense'): TransactionFormValues {
  return {
    kind,
    amount: '',
    date: todayInIstanbul(),
    scope: 'project',
    projectId: '',
    party: null,
    agreementId: '',
    categoryId: '',
    description: '',
    reason: '',
    split: false,
    allocations: [],
    confirmExcess: false,
    excessReason: '',
  };
}

function fromAgreement(agreement: Agreement): TransactionFormValues {
  return {
    ...baseValues(agreement.direction === 'payable' ? 'expense' : 'income'),
    scope: agreement.scope,
    projectId: agreement.projectId ?? '',
    party: { id: agreement.partyId, name: agreement.party?.name ?? '' },
    agreementId: agreement.id,
  };
}

function fromDraft({ draft, source }: CopyState): TransactionFormValues {
  const split = draft.allocations.length > 1;
  const first = draft.allocations[0];
  return {
    ...baseValues(draft.kind),
    amount: kurusToInput(draft.amount),
    date: draft.date,
    scope: first?.scope ?? 'project',
    projectId: first?.projectId ?? '',
    party: draft.partyId && source.party ? { id: draft.partyId, name: source.party.name } : null,
    agreementId: split ? '' : (first?.agreementId ?? ''),
    categoryId: draft.categoryId ?? '',
    description: draft.description,
    split,
    allocations: split
      ? draft.allocations.map((allocation) => ({
          key: newRowKey(),
          scope: allocation.scope,
          projectId: allocation.projectId ?? '',
          agreementId: allocation.agreementId ?? '',
          amount: kurusToInput(allocation.amount),
        }))
      : [],
  };
}

/** Kaydet başarılı olunca geldiği liste/detaya dönülür (şartname 7.4). */
function useReturn(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key !== 'default') void navigate(-1);
    else void navigate(fallback, { replace: true });
  };
}

/**
 * Gelir veya gider formu: `?tur=gelir|gider&proje=&kisi=&anlasma=&genel=1` (şartname 5.2).
 * Bağlamdan gelen şantiye/kişi/anlaşma hazır seçilir ve görünür olur.
 */
export function TransactionNewPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const copy = (location.state as { copy?: CopyState } | null)?.copy ?? null;
  const tur = params.get('tur');
  const projectId = params.get('proje') ?? '';
  const partyId = params.get('kisi');
  const agreementId = params.get('anlasma');
  const general = params.get('genel') === '1';
  const kind = tur === 'gelir' ? 'income' : 'expense';

  const agreement = useAgreement(copy ? null : agreementId);
  const party = useParty(copy || agreementId ? null : partyId);
  const back = useReturn(
    agreementId
      ? `/uygulama/anlasmalar/${agreementId}`
      : projectId
        ? `/uygulama/projeler/${projectId}`
        : '/uygulama/islemler',
  );

  const title = copy
    ? 'Kayıt kopyası'
    : agreement.data
      ? agreement.data.direction === 'payable'
        ? 'Ödeme yap'
        : 'Tahsilat al'
      : kind === 'income'
        ? 'Gelir ekle'
        : 'Gider ekle';
  usePageMeta(title);

  let content;
  if (
    (agreementId && !copy && agreement.isPending) ||
    (partyId && party.isPending && !copy && !agreementId)
  ) {
    content = <Loading />;
  } else if (agreementId && !copy && agreement.error) {
    content = <ErrorState error={agreement.error} onRetry={() => void agreement.refetch()} />;
  } else {
    let initial: TransactionFormValues;
    if (copy) initial = fromDraft(copy);
    else if (agreement.data) initial = fromAgreement(agreement.data);
    else {
      initial = baseValues(kind);
      if (general) initial.scope = 'company';
      else if (projectId) initial.projectId = projectId;
      if (party.data) initial.party = { id: party.data.id, name: party.data.name };
    }
    content = (
      <TransactionForm
        initial={initial}
        lockKind={Boolean(tur) && !copy}
        lockedAgreement={copy ? null : (agreement.data ?? null)}
        agreementConfirmationRequired={copy?.draft.agreementConfirmationRequired ?? false}
        copiedFrom={copy ? { id: copy.source.id, recordNo: copy.source.recordNo } : null}
        onDone={back}
      />
    );
  }

  return (
    <main className="page page--narrow">
      <PageHeader
        title={title}
        subtitle={
          agreement.data
            ? `${agreement.data.label} — ${agreement.data.party?.name ?? ''}`
            : undefined
        }
      />
      {content}
    </main>
  );
}

/** Bu anlaşmaya ödeme veya tahsilat: işlem formunun anlaşmaya kilitli hali (şartname 7.6). */
export function AgreementPaymentPage() {
  const { id } = useParams();
  const agreement = useAgreement(id);
  const back = useReturn(`/uygulama/anlasmalar/${id}`);
  const title = agreement.data?.direction === 'receivable' ? 'Tahsilat al' : 'Ödeme yap';
  usePageMeta(title);

  return (
    <main className="page page--narrow">
      <PageHeader
        title={title}
        subtitle={
          agreement.data
            ? `${agreement.data.label} — ${agreement.data.party?.name ?? ''}`
            : undefined
        }
        back={{ to: `/uygulama/anlasmalar/${id}`, label: 'Anlaşma' }}
      />
      {agreement.isPending ? (
        <Loading />
      ) : agreement.error || !agreement.data ? (
        <ErrorState error={agreement.error} onRetry={() => void agreement.refetch()} />
      ) : (
        <TransactionForm
          initial={fromAgreement(agreement.data)}
          lockKind
          lockedAgreement={agreement.data}
          onDone={back}
        />
      )}
    </main>
  );
}
