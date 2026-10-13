import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiPatch, errorMessage, isApiError } from '../../api/client';
import { keys, useCompany } from '../../api/queries';
import type { SaveState } from '../../api/submission';
import type { CompanyInfo } from '../../api/types';
import { Building2, HardDrive, ShieldCheck } from 'lucide-react';
import { Badge } from '../../components/ui/Amount';
import { Button } from '../../components/ui/Button';
import { PageHeader, Panel } from '../../components/ui/Card';
import { ConflictView } from '../../components/ui/ConflictView';
import { Field, TextInput } from '../../components/ui/Field';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { QueryView } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatBytes, formatLongDate } from '../../lib/format';
import { SERVICE_STATE_LABEL } from '../../lib/labels';
import { SUPPORT_CONTACT_TEXT } from '../../lib/support';
import { useSession } from '../../stores/session';

/**
 * Firma: ortak görünen ad ve iletişim (bütün firma kullanıcıları düzenleyebilir, geçmiş tutulur),
 * depolama kullanımı ve hizmet durumu (şartname 7.11).
 */
export function CompanySettingsPage() {
  usePageMeta('Firma');
  const company = useCompany();
  return (
    <main className="page">
      <PageHeader title="Firma" back={{ to: '/uygulama/ayarlar', label: 'Ayarlar' }} />
      <QueryView query={company}>
        {(data) => (
          <div className="form-columns">
            <CompanyForm company={data} />
            <div className="dash-col">
              <StorageCard company={data} />
              <ServiceCard company={data} />
            </div>
          </div>
        )}
      </QueryView>
    </main>
  );
}

function CompanyForm({ company }: { company: CompanyInfo }) {
  const queryClient = useQueryClient();
  const { canWrite, reason } = useWriteAccess();
  const setCompany = useSession((s) => s.setCompany);
  // Formun dayandığı sürüm; arka plan yenilemesi formu sıfırlamaz.
  const [base, setBase] = useState(() => ({
    values: { displayName: company.displayName, ...company.contact },
    updatedAt: company.updatedAt,
  }));
  const [values, setValues] = useState(base.values);
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  const [conflict, setConflict] = useState<CompanyInfo | null>(null);
  const dirty = (Object.keys(values) as (keyof typeof values)[]).some(
    (key) => values[key] !== base.values[key],
  );
  const { dialog } = useUnsavedChanges(dirty && state.status !== 'saving');
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));

  async function save() {
    setState({ status: 'saving' });
    try {
      const updated = await apiPatch<CompanyInfo>('/company', {
        displayName: values.displayName.trim(),
        contact: {
          person: values.person.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
        },
        expectedUpdatedAt: base.updatedAt,
      });
      setCompany({ displayName: updated.displayName }, updated.service);
      const saved = { displayName: updated.displayName, ...updated.contact };
      setBase({ values: saved, updatedAt: updated.updatedAt });
      setValues(saved);
      setState({ status: 'saved' });
      await queryClient.invalidateQueries({ queryKey: keys.company });
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'CONFLICT' && caught.current) {
        setConflict(caught.current as CompanyInfo);
        setState({ status: 'failed', message: caught.message });
        return;
      }
      setState({
        status: 'failed',
        message: [
          errorMessage(caught),
          ...(isApiError(caught) ? caught.issues.map((i) => i.message) : []),
        ].join(' '),
      });
    }
  }

  return (
    <form
      className="stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {dialog}
      {conflict ? (
        <ConflictView
          fields={(
            [
              ['displayName', 'Firma görünen adı', conflict.displayName],
              ['person', 'Yetkili kişi', conflict.contact.person],
              ['phone', 'Telefon', conflict.contact.phone],
              ['email', 'E-posta', conflict.contact.email],
            ] as const
          ).map(([key, label, current]) => ({
            key,
            label,
            current: current || '—',
            mine: values[key] || '—',
            differs: current !== values[key],
          }))}
          onUseCurrent={() => {
            const current = { displayName: conflict.displayName, ...conflict.contact };
            setBase({ values: current, updatedAt: conflict.updatedAt });
            setValues(current);
            setConflict(null);
            setState({ status: 'idle' });
          }}
          onKeepMine={() => {
            setBase((previous) => ({ ...previous, updatedAt: conflict.updatedAt }));
            setConflict(null);
            setState({ status: 'idle' });
          }}
        />
      ) : null}
      <Panel title="Firma bilgileri" icon={Building2}>
        <div className="panel__body stack">
          <p className="meta">
            Bütün firma kullanıcıları düzenleyebilir; değişiklikler geçmişe yazılır.
          </p>
          <Field label="Firma görünen adı">
            {(props) => (
              <TextInput
                {...props}
                value={values.displayName}
                onChange={(e) => set({ displayName: e.target.value })}
              />
            )}
          </Field>
          <div className="form-grid">
            <Field label="Yetkili kişi">
              {(props) => (
                <TextInput
                  {...props}
                  value={values.person}
                  onChange={(e) => set({ person: e.target.value })}
                />
              )}
            </Field>
            <Field label="Telefon">
              {(props) => (
                <TextInput
                  {...props}
                  type="tel"
                  value={values.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                />
              )}
            </Field>
            <Field label="E-posta">
              {(props) => (
                <TextInput
                  {...props}
                  type="email"
                  value={values.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
              )}
            </Field>
          </div>
          {!canWrite ? <p className="meta">{reason}</p> : null}
          <SaveStatus state={state} />
          <div className="form-actions">
            <Button
              type="submit"
              loading={state.status === 'saving'}
              disabled={!dirty || !canWrite || Boolean(conflict)}
            >
              Kaydet
            </Button>
          </div>
        </div>
      </Panel>
    </form>
  );
}

function StorageCard({ company }: { company: CompanyInfo }) {
  const { usedBytes, quotaBytes } = company.storage;
  const full = usedBytes >= quotaBytes;
  return (
    <Panel title="Belge alanı" icon={HardDrive}>
      <div className="panel__body stack stack--sm">
        <p>
          Kullanılan: <strong>{formatBytes(usedBytes)}</strong> / {formatBytes(quotaBytes)}
        </p>
        <progress
          value={Math.min(usedBytes, quotaBytes)}
          max={quotaBytes}
          aria-label="Belge alanı kullanımı"
        />
        {full ? (
          <div className="alert alert--danger">
            Belge alanı doldu. Kayıt girmeye devam edebilirsiniz; yeni belge için ürün sahibiyle
            görüşün.
          </div>
        ) : null}
        <p className="meta">
          Orijinal, önizleme ve silinmiş ama geri alınabilir belgelerin ayrı dökümü belge yükleme
          açıldığında burada görünecek.
        </p>
        <p className="meta">Kapasite artırımı için: {SUPPORT_CONTACT_TEXT}</p>
      </div>
    </Panel>
  );
}

function ServiceCard({ company }: { company: CompanyInfo }) {
  const { service } = company;
  return (
    <Panel title="Hizmet durumu" icon={ShieldCheck}>
      <div className="panel__body stack stack--sm">
        <p>
          <Badge tone={service.state === 'active' ? 'income' : 'warn'}>
            {SERVICE_STATE_LABEL[service.state]}
          </Badge>
        </p>
        {service.serviceEndedAt ? (
          <dl className="definition-list">
            <dt>Hizmet sonu</dt>
            <dd>{formatLongDate(service.serviceEndedAt)}</dd>
            <dt>Son görüntüleme günü</dt>
            <dd>{formatLongDate(service.viewUntil)}</dd>
            <dt>Saklama bitişi</dt>
            <dd>{formatLongDate(service.retainUntil)}</dd>
          </dl>
        ) : null}
      </div>
    </Panel>
  );
}
