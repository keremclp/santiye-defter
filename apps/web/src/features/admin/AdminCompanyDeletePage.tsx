import { useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { adminPost } from '../../api/admin-client';
import { invalidatePlatform, usePlatformCompany } from '../../api/admin-queries';
import type { PlatformCompanyDetail } from '../../api/admin-types';
import { errorMessage, isApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { PageHeader, Panel } from '../../components/ui/Card';
import { Field, TextArea, TextInput } from '../../components/ui/Field';
import { QueryView } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { formatBytes, formatLongDate } from '../../lib/format';
import { toast } from '../../stores/ui';
import { CompanyStateBadge } from './admin-parts';
import { companyState } from './admin-utils';

/**
 * Kalıcı silme onayı (şartname 5.3, 7.13): yalnız saklama süresi dolmuş firmada veya başarısız
 * silmenin yeniden başlatılmasında. Firma adı birebir yazılarak ve gerekçeyle onaylanır.
 */
export function AdminCompanyDeletePage() {
  const { id = '' } = useParams();
  const query = usePlatformCompany(id);
  usePageMeta('Kalıcı silme');
  return (
    <main className="page">
      <QueryView query={query}>{(data) => <DeleteForm data={data} />}</QueryView>
    </main>
  );
}

function DeleteForm({ data }: { data: PlatformCompanyDetail }) {
  const { company, contents, users } = data;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const retry = company.deletionStatus === 'failed';
  const allowed =
    retry || (company.deletionStatus === 'none' && company.service.state === 'deletion_pending');
  const expected = company.name.trim();
  const nameMatches = confirmName.trim() === expected;
  const detailHref = `/yonetim/firmalar/${company.id}`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (reason.trim() === '') {
      setReasonError('Gerekçe girin.');
      return;
    }
    setReasonError(undefined);
    setError(null);
    setBusy(true);
    try {
      await adminPost(`/platform/companies/${company.id}/delete`, {
        confirmName: confirmName.trim(),
        reason: reason.trim(),
      });
      await invalidatePlatform(queryClient);
      toast('Kalıcı silme başlatıldı; durumu firma sayfasından izleyebilirsiniz.');
      void navigate(detailHref, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
      if (isApiError(caught) && caught.code === 'CONFLICT') await invalidatePlatform(queryClient);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={retry ? 'Kalıcı silmeyi yeniden başlat' : 'Kalıcı silme'}
        subtitle={company.name}
        back={{ to: detailHref, label: 'Firma' }}
      />
      {!allowed ? (
        <div className="alert alert--danger" role="alert">
          <p className="alert__title">Bu firma kalıcı olarak silinemez</p>
          <p>
            Kalıcı silme yalnız saklama süresi dolmuş (silme onayı bekleyen) firmada veya başarısız
            silmenin yeniden başlatılmasında yapılabilir.
          </p>
          <p>
            <Link to={detailHref}>Firma sayfasına dön</Link>
          </p>
        </div>
      ) : (
        <div className="form-columns">
          <Panel title="Silinecek olanlar" icon={TriangleAlert} className="danger-zone">
            <div className="panel__body stack">
              <dl className="definition-list">
                <dt>Firma</dt>
                <dd>{company.name}</dd>
                <dt>Durum</dt>
                <dd>
                  <CompanyStateBadge {...companyState(company)} />
                </dd>
                <dt>Saklama bitişi</dt>
                <dd>{formatLongDate(company.service.retainUntil)}</dd>
                <dt>Kullanıcı</dt>
                <dd>{users.length}</dd>
                <dt>Hareket</dt>
                <dd>{contents.transactions}</dd>
                <dt>Anlaşma ve başlangıç kaydı</dt>
                <dd>{contents.agreements}</dd>
                <dt>Şantiye</dt>
                <dd>{contents.projects}</dd>
                <dt>Kişi</dt>
                <dd>{contents.parties}</dd>
                <dt>Belge</dt>
                <dd>
                  {contents.documents} ({formatBytes(company.storage.usedBytes)})
                </dd>
              </dl>
              <div className="alert alert--danger">
                <p className="alert__title">Bu işlem geri döndürülemez</p>
                <p>
                  Firmanın bütün kayıtları (silinmiş ama geri alınabilir olanlar dahil), belgeleri,
                  dışa aktarma paketleri ve kullanıcıları kalıcı olarak silinir; açık dışa aktarma
                  işleri iptal edilir. Kullanıcılar giriş yapamaz. Firma yeniden açılamaz. İşletim
                  geçmişinde yalnız firma adı, tarihler, işlem yapan ve gerekçe kalır.
                </p>
              </div>
            </div>
          </Panel>
          <Panel title="Onay">
            <form className="panel__body stack" noValidate onSubmit={(event) => void submit(event)}>
              <Field
                label="Onay için firma adını yazın"
                required
                hint={
                  <>
                    Birebir yazın: <strong>{expected}</strong> (büyük/küçük ve Türkçe harf farkı
                    kabul edilmez).
                  </>
                }
              >
                {(props) => (
                  <TextInput
                    {...props}
                    autoComplete="off"
                    spellCheck={false}
                    value={confirmName}
                    onChange={(event) => setConfirmName(event.target.value)}
                  />
                )}
              </Field>
              <Field label="Gerekçe" required error={reasonError}>
                {(props) => (
                  <TextArea
                    {...props}
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </Field>
              {error ? (
                <div className="alert alert--danger" role="alert">
                  <p className="alert__title">{error}</p>
                </div>
              ) : null}
              <div className="form-actions">
                <Link className="btn btn--secondary" to={detailHref}>
                  Vazgeç
                </Link>
                <Button
                  type="submit"
                  variant="danger"
                  loading={busy}
                  loadingText="Başlatılıyor…"
                  disabled={!nameMatches}
                >
                  {retry ? 'Silmeyi yeniden başlat' : 'Kalıcı olarak sil'}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </>
  );
}
