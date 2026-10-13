import { todayInIstanbul } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiDelete, apiPost } from '../../api/client';
import {
  invalidateRecords,
  useAgreements,
  useProject,
  useProjectSummary,
  useTransactions,
} from '../../api/queries';
import type { Project, ProjectSummary } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Badge } from '../../components/ui/Amount';
import { Button, ButtonLink, DisabledAction } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Card';
import { DateInput, Field } from '../../components/ui/Field';
import { HistoryList } from '../../components/ui/HistoryList';
import { ErrorState, Loading, QueryView, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDate, formatDateTime, formatMoney, formatTl } from '../../lib/format';
import { PROJECT_STATUS_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';
import { AgreementTable, TransactionTable } from '../common/RecordTables';

type DialogName = 'complete' | 'reactivate' | 'archive' | 'delete' | null;

export function ProjectDetailPage() {
  const { id } = useParams();
  const query = useProject(id);
  usePageMeta(query.data?.name ?? 'Şantiye');
  return (
    <main className="page">
      {query.isPending ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <ProjectView
          project={query.data}
          refreshing={query.isFetching}
          reload={() => query.refetch()}
        />
      )}
    </main>
  );
}

/** Lacivert özet: tahsilat, ödeme, fark; borç ve alacak ayrı (şartname 7.2). */
function SummaryHero({ summary }: { summary: ProjectSummary }) {
  const item = (label: string, value: number, hint?: string) => (
    <div className="summary-hero__item">
      <span className="summary-hero__label">{label}</span>
      <span className="summary-hero__value">{formatMoney(value)}</span>
      {hint ? <span className="summary-hero__label">{hint}</span> : null}
    </div>
  );
  const { cash, payable, receivable, openings } = summary;
  return (
    <section className="summary-hero" aria-label="Şantiye özeti">
      {item('Tahsilat (gelir)', cash.netIncome)}
      {item('Ödeme (gider)', cash.netExpense)}
      {item('Gelir − gider farkı', cash.difference)}
      <p className="summary-hero__section">Ödenecek — anlaşmalar ve başlangıç kayıtları</p>
      {item('Anlaşma toplamı', payable.totalAmount)}
      {item('Ödenen', payable.netSettled)}
      {item(
        'Kalan borç',
        payable.remaining,
        openings.payable.totalAmount > 0
          ? `Başlangıç kalanı ${formatMoney(openings.payable.remaining)}`
          : undefined,
      )}
      {payable.excess > 0 ? item('Fazla ödeme', payable.excess) : null}
      <p className="summary-hero__section">Tahsil edilecek — anlaşmalar ve başlangıç kayıtları</p>
      {item('Anlaşma toplamı', receivable.totalAmount)}
      {item('Tahsil edilen', receivable.netSettled)}
      {item(
        'Kalan alacak',
        receivable.remaining,
        openings.receivable.totalAmount > 0
          ? `Başlangıç kalanı ${formatMoney(openings.receivable.remaining)}`
          : undefined,
      )}
      {receivable.excess > 0 ? item('Fazla tahsilat', receivable.excess) : null}
    </section>
  );
}

function ProjectView({
  project: p,
  refreshing,
  reload,
}: {
  project: Project;
  refreshing: boolean;
  reload: () => unknown;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [completedAt, setCompletedAt] = useState(todayInIstanbul());
  const summary = useProjectSummary(p.id);
  const transactions = useTransactions({ projectId: p.id, kind: 'all', limit: 5 });
  const agreements = useAgreements({ projectId: p.id, limit: 100 });
  const openAgreements = (agreements.data?.items ?? []).filter((a) => a.remaining > 0);
  const dues = openAgreements.filter((a) => a.dueState === 'overdue' || a.dueState === 'upcoming');
  const hasRecords = (transactions.data?.total ?? 0) + (agreements.data?.total ?? 0) > 0;
  const active = p.status === 'active';
  const close = () => setDialog(null);
  const done = async (message: string) => {
    await invalidateRecords(queryClient);
    setDialog(null);
    toast(message);
  };
  const ctx = `proje=${p.id}`;

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={
          <>
            {p.address ? `${p.address} · ` : ''}
            {p.startDate ? `Başlangıç ${formatDate(p.startDate)}` : 'Başlangıç tarihi girilmedi'}
            {p.completedAt ? ` · Tamamlanma ${formatDate(p.completedAt)}` : ''}
          </>
        }
        back={{ to: '/uygulama/projeler', label: 'Şantiyeler' }}
        actions={<Refreshing active={refreshing} />}
      />
      <span className="row">
        <Badge tone={active ? 'income' : 'neutral'}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
        {p.pinned ? <Badge tone="primary">Sabit</Badge> : null}
      </span>
      {!active ? (
        <div className="alert alert--info">
          Bu şantiye {p.status === 'completed' ? 'tamamlandı' : 'arşivlendi'}. Anlaşmaya bağlı
          ödeme, tahsilat, iade ve düzeltme serbesttir; anlaşmaya bağlı olmayan yeni gider gerekçe
          ister. Yeni anlaşma için önce şantiyeyi yeniden aktifleştirin.
        </div>
      ) : null}

      <QueryView query={summary} loadingLabel="Özet yükleniyor…">
        {(data) => <SummaryHero summary={data} />}
      </QueryView>

      {canWrite ? (
        <div className="page__actions">
          <ButtonLink variant="income" to={`/uygulama/islemler/yeni?tur=gelir&${ctx}`}>
            Gelir ekle
          </ButtonLink>
          <ButtonLink variant="expense" to={`/uygulama/islemler/yeni?tur=gider&${ctx}`}>
            Gider ekle
          </ButtonLink>
          {active ? (
            <ButtonLink variant="secondary" to={`/uygulama/anlasmalar/yeni?${ctx}`}>
              Anlaşma ekle
            </ButtonLink>
          ) : (
            <DisabledAction
              label="Anlaşma ekle"
              reason="Yeni anlaşma için şantiyeyi yeniden aktifleştirin."
            />
          )}
        </div>
      ) : (
        <DisabledAction label="Değişiklik kapalı" reason={closedReason ?? ''} />
      )}

      {canWrite ? (
        <div className="page__actions">
          <ButtonLink variant="ghost" to={`/uygulama/projeler/${p.id}/duzenle`}>
            Düzenle
          </ButtonLink>
          {active ? (
            <Button variant="secondary" onClick={() => setDialog('complete')}>
              Tamamla
            </Button>
          ) : null}
          {p.status === 'completed' ? (
            <Button variant="secondary" onClick={() => setDialog('reactivate')}>
              Yeniden aktifleştir
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => setDialog('archive')}>
            {p.status === 'archived' ? 'Arşivden çıkar' : 'Arşivle'}
          </Button>
          <Button variant="danger" onClick={() => setDialog('delete')}>
            Sil
          </Button>
        </div>
      ) : null}

      <div className="grid grid--2">
        <Card
          title="Son hareketler"
          actions={<Link to={`/uygulama/islemler?kapsam=${p.id}&donem=tumu`}>Tümünü gör</Link>}
        >
          <QueryView query={transactions}>
            {(data) =>
              data.items.length === 0 ? (
                <p className="muted">Bu şantiyede hareket yok.</p>
              ) : (
                <TransactionTable items={data.items} compact showScopedAmount />
              )
            }
          </QueryView>
        </Card>
        <Card title="Vadeler" actions={<Link to="/uygulama/vadeler">Tümünü gör</Link>}>
          {agreements.isPending ? (
            <Loading />
          ) : dues.length === 0 ? (
            <p className="muted">Gecikmiş veya 30 gün içinde vadesi gelen tutar yok.</p>
          ) : (
            <AgreementTable items={dues} />
          )}
        </Card>
      </div>

      <Card
        title="Anlaşmalar ve başlangıç kayıtları"
        actions={<Link to={`/uygulama/anlasmalar?kapsam=${p.id}`}>Tümünü gör</Link>}
      >
        <QueryView query={agreements}>
          {(data) =>
            data.items.length === 0 ? (
              <p className="muted">Bu şantiyede anlaşma yok.</p>
            ) : (
              <AgreementTable items={data.items} />
            )
          }
        </QueryView>
      </Card>

      <Card title="Rapor">
        <p>
          <Link to={`/uygulama/projeler/${p.id}/rapor`}>Şantiye özeti ve hareket dökümü</Link>
        </p>
      </Card>

      <Card title="Değişiklik geçmişi">
        <HistoryList history={p.history ?? []} />
        <p className="meta">
          Oluşturan: {p.createdBy?.name ?? 'Bilinmeyen kullanıcı'} · {formatDateTime(p.createdAt)}
        </p>
      </Card>

      <ActionDialog
        open={dialog === 'complete'}
        title="Şantiyeyi tamamla"
        onClose={close}
        confirmLabel="Tamamla"
        reason="none"
        onConflict={reload}
        confirmDisabled={!completedAt || agreements.isPending}
        onConfirm={async () => {
          await apiPost(`/projects/${p.id}/complete`, {
            completedAt,
            expectedUpdatedAt: p.updatedAt,
          });
          await done('Şantiye tamamlandı.');
        }}
      >
        <p>Tamamlamak tutarları, vadeleri veya kalanları değiştirmez.</p>
        {openAgreements.length > 0 ? (
          <div className="alert alert--danger">
            <p className="alert__title">Açık borç/alacak var</p>
            <ul>
              {openAgreements.map((a) => (
                <li key={a.id}>
                  {a.label} ({a.party?.name}): kalan {formatTl(a.remaining)}
                  {a.dueDate ? `, vade ${formatDate(a.dueDate)}` : ''}
                  {a.dueState === 'overdue' ? ' — Gecikmiş' : ''}
                </li>
              ))}
            </ul>
            <p>Bunlar firma özetinde ve vade listelerinde görünmeye devam eder.</p>
          </div>
        ) : (
          <p className="meta">Açık borç veya alacak yok.</p>
        )}
        <Field label="Tamamlanma tarihi" required>
          {(props) => (
            <DateInput
              {...props}
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
            />
          )}
        </Field>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'reactivate'}
        title="Şantiyeyi yeniden aktifleştir"
        onClose={close}
        confirmLabel="Yeniden aktifleştir"
        onConflict={reload}
        onConfirm={async (reason) => {
          await apiPost(`/projects/${p.id}/reactivate`, { reason, expectedUpdatedAt: p.updatedAt });
          await done('Şantiye yeniden aktif.');
        }}
      >
        <p>Tamamlanma tarihi temizlenir; yeni anlaşma eklenebilir.</p>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'archive'}
        title={p.status === 'archived' ? 'Arşivden çıkar' : 'Şantiyeyi arşivle'}
        onClose={close}
        confirmLabel={p.status === 'archived' ? 'Arşivden çıkar' : 'Arşivle'}
        reason="none"
        onConflict={reload}
        onConfirm={async () => {
          await apiPost(`/projects/${p.id}/archive`, {
            archived: p.status !== 'archived',
            expectedUpdatedAt: p.updatedAt,
          });
          await done(
            p.status === 'archived' ? 'Şantiye arşivden çıkarıldı.' : 'Şantiye arşivlendi.',
          );
        }}
      >
        {p.status === 'archived' ? (
          <p>Şantiye önceki durumuna döner: {p.completedAt ? 'tamamlandı' : 'aktif'}.</p>
        ) : (
          <p>
            Arşiv şantiyeyi günlük listeden kaldırır. Kayıtlar, belgeler ve açık tutarlar firma
            özetinde ve vade listelerinde kalır. Arşivdeki şantiye kayıt kuralları bakımından
            tamamlanan şantiye gibi davranır.
          </p>
        )}
      </ActionDialog>

      <ActionDialog
        open={dialog === 'delete'}
        title="Şantiyeyi sil"
        onClose={close}
        confirmLabel="Sil"
        confirmVariant="danger"
        onConflict={reload}
        confirmDisabled={transactions.isPending || agreements.isPending}
        blockedReason={
          hasRecords
            ? 'Bu şantiyenin hareketleri veya anlaşmaları var; silmek yerine arşivleyin.'
            : null
        }
        onConfirm={async (reason) => {
          await apiDelete(`/projects/${p.id}`, { reason, expectedUpdatedAt: p.updatedAt });
          await invalidateRecords(queryClient);
          toast('Şantiye silindi. Silinenlerden geri alınabilir.');
          await navigate('/uygulama/projeler', { replace: true });
        }}
      >
        <p>Hiç hareketi ve anlaşması olmayan şantiye silinebilir. Toplamlar değişmez.</p>
      </ActionDialog>
    </>
  );
}
