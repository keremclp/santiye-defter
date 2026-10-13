import { useSearchParams } from 'react-router';
import { useParty } from '../../api/queries';
import { PageHeader } from '../../components/ui/Card';
import { Loading } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { obligationDefaults } from './obligation-form';
import { ObligationForm } from './ObligationForm';

function useObligationContext(mode: 'agreement' | 'opening') {
  const [params] = useSearchParams();
  const partyId = params.get('kisi');
  const party = useParty(partyId);
  const yon = params.get('yon');
  const loading = Boolean(partyId) && party.isPending;
  const initial = obligationDefaults(mode, {
    direction: yon === 'tahsil' || yon === 'alacak' ? 'receivable' : 'payable',
    projectId: params.get('proje') ?? '',
    general: params.get('genel') === '1',
    party: party.data ? { id: party.data.id, name: party.data.name } : null,
  });
  return { loading, initial };
}

/** Anlaşma formu: `?yon=odenecek|tahsil&proje=&kisi=&genel=1` (şartname 5.2, 7.6). */
export function AgreementFormPage() {
  usePageMeta('Yeni anlaşma');
  const { loading, initial } = useObligationContext('agreement');
  return (
    <main className="page page--narrow">
      <PageHeader title="Yeni anlaşma" back={{ to: '/uygulama/anlasmalar', label: 'Anlaşmalar' }} />
      {loading ? <Loading /> : <ObligationForm initial={initial} />}
    </main>
  );
}

/** Başlangıç borç/alacak formu (şartname 7.6). */
export function OpeningFormPage() {
  usePageMeta('Başlangıç borç/alacağı');
  const { loading, initial } = useObligationContext('opening');
  return (
    <main className="page page--narrow">
      <PageHeader
        title="Başlangıç borç/alacağı"
        subtitle="Uygulamaya geçtiğiniz tarihte açık kalan borç veya alacak"
        back={{ to: '/uygulama/anlasmalar', label: 'Anlaşmalar' }}
      />
      {loading ? <Loading /> : <ObligationForm initial={initial} />}
    </main>
  );
}
