import { useQueryClient } from '@tanstack/react-query';
import { foldTurkish } from '@santiye/shared';
import { Building2, NotebookPen } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { adminGet, adminPostFull } from '../../api/admin-client';
import { invalidatePlatform } from '../../api/admin-queries';
import type { PlatformCompany, PlatformCompanyList } from '../../api/admin-types';
import { Button } from '../../components/ui/Button';
import { PageHeader, Panel } from '../../components/ui/Card';
import { Field, TextArea, TextInput } from '../../components/ui/Field';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import { toast } from '../../stores/ui';
import { issuesByPath } from './admin-utils';
import { useAdminCreate } from './useAdminCreate';

const EMPTY = { name: '', person: '', phone: '', email: '', opsNote: '', reason: '' };
type Values = typeof EMPTY;

/** Benzer ad uyarısı engellemez (şartname 7.13); arama Türkçe harf farkı gözetmez. */
function useSimilarNames(name: string) {
  const [similar, setSimilar] = useState<string[]>([]);
  const needle = name.trim();
  useEffect(() => {
    if (needle.length < 3) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      adminGet<PlatformCompanyList>('/platform/companies', { q: needle, limit: 5 })
        .then((list) => {
          if (!cancelled) setSimilar(list.items.map((item) => item.name));
        })
        .catch(() => undefined);
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [needle]);
  if (needle.length < 3) return [];
  return similar.filter((item) => foldTurkish(item).includes(foldTurkish(needle)));
}

/** Firma oluştur (şartname 7.13): ad zorunlu; yeni firma aktif, boş ve 20 GB kapasiteyle başlar. */
export function AdminCompanyNewPage() {
  usePageMeta('Yeni firma');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useAdminCreate<PlatformCompany>();
  const dirty = Object.values(values).some((value) => value.trim() !== '');
  const { dialog, allowNavigation } = useUnsavedChanges(dirty, create.uncertain);
  const similar = useSimilarNames(values.name);
  const set = (patch: Partial<Values>) => setValues((current) => ({ ...current, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (values.name.trim() === '') {
      setErrors({ name: 'Firma adını girin.' });
      return;
    }
    setErrors({});
    const body = {
      name: values.name.trim(),
      contact: {
        person: values.person.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
      },
      opsNote: values.opsNote.trim(),
      ...(values.reason.trim() ? { reason: values.reason.trim() } : {}),
    };
    try {
      const result = await create.submit((idempotencyKey) =>
        adminPostFull<PlatformCompany>('/platform/companies', body, { idempotencyKey }),
      );
      if (!result) return;
      await invalidatePlatform(queryClient);
      allowNavigation();
      toast('Firma oluşturuldu. Şimdi kullanıcı ekleyebilirsiniz.');
      void navigate(`/yonetim/firmalar/${result.data.id}`, { replace: true });
    } catch (caught) {
      setErrors(issuesByPath(caught));
    }
  }

  return (
    <main className="page">
      {dialog}
      <PageHeader
        title="Yeni firma"
        subtitle="Yeni firma aktif, boş ve 20 GB belge alanıyla başlar; demo verisi aktarılmaz."
        back={{ to: '/yonetim', label: 'İşletim özeti' }}
      />
      <form className="form-columns" noValidate onSubmit={(event) => void submit(event)}>
        <Panel title="Firma bilgileri" icon={Building2}>
          <div className="panel__body stack">
            <Field
              label="Firma adı"
              required
              error={errors.name}
              hint="Kalıcı silmede onay için bu ad birebir yazılır."
            >
              {(props) => (
                <TextInput
                  {...props}
                  value={values.name}
                  onChange={(event) => set({ name: event.target.value })}
                />
              )}
            </Field>
            {similar.length > 0 ? (
              <div className="alert alert--info" role="status">
                <p className="alert__title">Benzer adlı firma var</p>
                <p>{similar.join(', ')}. Aynı müşteri değilse devam edebilirsiniz.</p>
              </div>
            ) : null}
            <Field label="Yetkili kişi" error={errors['contact.person']}>
              {(props) => (
                <TextInput
                  {...props}
                  value={values.person}
                  onChange={(event) => set({ person: event.target.value })}
                />
              )}
            </Field>
            <div className="form-grid">
              <Field label="Telefon" error={errors['contact.phone']}>
                {(props) => (
                  <TextInput
                    {...props}
                    type="tel"
                    value={values.phone}
                    onChange={(event) => set({ phone: event.target.value })}
                  />
                )}
              </Field>
              <Field label="E-posta" error={errors['contact.email']}>
                {(props) => (
                  <TextInput
                    {...props}
                    type="email"
                    value={values.email}
                    onChange={(event) => set({ email: event.target.value })}
                  />
                )}
              </Field>
            </div>
          </div>
        </Panel>
        <div className="dash-col">
          <Panel title="İşletim" icon={NotebookPen}>
            <div className="panel__body stack">
              <Field label="İşletim notu" error={errors.opsNote} hint="Yalnız ürün sahibi görür.">
                {(props) => (
                  <TextArea
                    {...props}
                    rows={4}
                    value={values.opsNote}
                    onChange={(event) => set({ opsNote: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Gerekçe" hint="İsteğe bağlı; işletim geçmişine yazılır.">
                {(props) => (
                  <TextInput
                    {...props}
                    value={values.reason}
                    onChange={(event) => set({ reason: event.target.value })}
                  />
                )}
              </Field>
              <SaveStatus state={create.state} onVerify={() => void create.retry()} />
              <div className="form-actions">
                <Link className="btn btn--secondary" to="/yonetim">
                  Vazgeç
                </Link>
                <Button
                  type="submit"
                  loading={create.state.status === 'saving'}
                  disabled={create.busy}
                >
                  Firmayı Oluştur
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </form>
    </main>
  );
}
