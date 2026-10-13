import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiDelete, apiPatch, apiPost } from '../../api/client';
import { invalidateRecords, useAgreement } from '../../api/queries';
import type { AgreementDetail, AmountPreview } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Amount } from '../../components/ui/Amount';
import { Button, ButtonLink, DisabledAction } from '../../components/ui/Button';
import { Card, DocumentPlaceholder, PageHeader } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/Chips';
import { DateInput, Field, TextArea, TextInput } from '../../components/ui/Field';
import { HistoryList } from '../../components/ui/HistoryList';
import { ImpactPreview } from '../../components/ui/ImpactPreview';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { toKurus } from '../../lib/forms';
import { formatDate, formatDateTime, formatMoney, formatTl } from '../../lib/format';
import {
  DUE_STATE_LABEL,
  KIND_LABEL,
  paymentStatusLabel,
  WORK_STATUS_LABEL,
} from '../../lib/labels';
import { toast } from '../../stores/ui';
import { AgreementStatusBadges } from '../common/RecordTables';

type DialogName = 'amount' | 'due' | 'work' | 'cancel' | 'edit' | 'delete' | null;

export function AgreementDetailPage() {
  const { id } = useParams();
  const query = useAgreement(id);
  usePageMeta(query.data?.label ?? 'Anlaşma');
  return (
    <main className="page">
      {query.isPending ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <AgreementView
          agreement={query.data}
          refreshing={query.isFetching}
          reload={() => query.refetch()}
        />
      )}
    </main>
  );
}

/** Bedel değişikliğinin sunucudaki önizlemesi (`?preview=1`); kalan ve fazla yeni bedelle. */
function useAmountPreview(id: string, newAmount: number | null, enabled: boolean) {
  const deferred = useDeferredValue(newAmount);
  return useQuery({
    queryKey: ['agreements', 'amount-preview', id, deferred],
    queryFn: () =>
      apiPost<AmountPreview>(`/agreements/${id}/amount?preview=1`, { newAmount: deferred }),
    enabled: enabled && deferred !== null && deferred >= 0,
    staleTime: 0,
  });
}

function AmountPreviewBlock({
  preview,
  payable,
}: {
  preview: ReturnType<typeof useAmountPreview>;
  payable: boolean;
}) {
  if (!preview.data) {
    return preview.isFetching ? <Loading label="Önizleme hesaplanıyor…" /> : null;
  }
  const { before, after } = preview.data;
  return (
    <ImpactPreview
      groups={[
        {
          rows: [
            { label: 'Bedel', before: before.currentAmount, after: after.currentAmount },
            {
              label: payable ? 'Net ödenen' : 'Net tahsil edilen',
              before: before.netSettled,
              after: after.netSettled,
            },
            {
              label: payable ? 'Kalan borç' : 'Kalan alacak',
              before: before.remaining,
              after: after.remaining,
            },
            {
              label: payable ? 'Fazla ödeme' : 'Fazla tahsilat',
              before: before.excess,
              after: after.excess,
            },
          ],
        },
      ]}
      note="Bedel değişikliği gider veya gelir oluşturmaz; geçmiş ödemeler değişmez."
    />
  );
}

function AgreementView({
  agreement: a,
  refreshing,
  reload,
}: {
  agreement: AgreementDetail;
  refreshing: boolean;
  reload: () => unknown;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [newAmount, setNewAmount] = useState('');
  const [newDue, setNewDue] = useState(a.dueDate ?? '');
  const [cancelMode, setCancelMode] = useState<'final' | 'pending'>('final');
  const [edit, setEdit] = useState({
    title: a.title,
    description: a.description,
    agreementDate: a.agreementDate ?? '',
  });
  const payable = a.direction === 'payable';
  const isAgreement = a.kind === 'agreement';
  const cancelled = a.workStatus === 'cancelled';
  const finalLocked = cancelled && !a.settlementPending;
  const amountKurus = newAmount.trim() === '' ? null : toKurus(newAmount);
  const amountPreview = useAmountPreview(
    a.id,
    amountKurus,
    dialog === 'amount' || (dialog === 'cancel' && cancelMode === 'final'),
  );
  const close = () => setDialog(null);
  const done = async (message: string) => {
    await invalidateRecords(queryClient);
    setDialog(null);
    toast(message);
  };
  const scopeLink =
    a.scope === 'company' ? (
      'Firma geneli'
    ) : a.project ? (
      <Link to={`/uygulama/projeler/${a.project.id}`}>{a.project.name}</Link>
    ) : (
      'Şantiye'
    );

  return (
    <>
      <PageHeader
        title={a.label}
        subtitle={
          <>
            {a.party ? <Link to={`/uygulama/kisiler/${a.party.id}`}>{a.party.name}</Link> : null} ·{' '}
            {scopeLink}
          </>
        }
        back={{ to: '/uygulama/anlasmalar', label: 'Anlaşmalar' }}
        actions={<Refreshing active={refreshing} />}
      />
      <AgreementStatusBadges agreement={a} />
      {a.settlementPending ? (
        <div className="alert alert--danger" role="status">
          <p className="alert__title">İptal — hesap kesinleşmedi</p>
          <p>
            Kesin bedel girilene kadar kalan tutar görünür kalır. Kesin bedeli “Bedeli değiştir” ile
            kaydedin.
          </p>
        </div>
      ) : null}
      {a.excess > 0 ? (
        <div className="alert alert--danger" role="status">
          <p className="alert__title">
            {payable ? 'Fazla ödeme' : 'Fazla tahsilat'}: {formatTl(a.excess)}
          </p>
          <p>
            Geri gelen para iade eylemiyle kaynak harekete girilir; başka borcu kendiliğinden
            kapatmaz.
          </p>
        </div>
      ) : null}

      <section className="summary-hero" aria-label="Anlaşma özeti">
        <div className="summary-hero__item">
          <span className="summary-hero__label">Güncel bedel</span>
          <span className="summary-hero__value">{formatMoney(a.currentAmount)}</span>
          {a.initialAmount !== a.currentAmount ? (
            <span className="summary-hero__label">İlk bedel {formatMoney(a.initialAmount)}</span>
          ) : null}
        </div>
        <div className="summary-hero__item">
          <span className="summary-hero__label">
            {payable ? 'Net ödenen' : 'Net tahsil edilen'}
          </span>
          <span className="summary-hero__value">{formatMoney(a.netSettled)}</span>
        </div>
        <div className="summary-hero__item">
          <span className="summary-hero__label">{payable ? 'Kalan borç' : 'Kalan alacak'}</span>
          <span className="summary-hero__value">{formatMoney(a.remaining)}</span>
        </div>
        <div className="summary-hero__item">
          <span className="summary-hero__label">{payable ? 'Fazla ödeme' : 'Fazla tahsilat'}</span>
          <span className="summary-hero__value">{formatMoney(a.excess)}</span>
        </div>
        <div className="summary-hero__item">
          <span className="summary-hero__label">Vade</span>
          <span className="summary-hero__value">
            {a.dueDate ? formatDate(a.dueDate) : 'Belirlenmemiş'}
          </span>
          {a.dueState ? (
            <span className="summary-hero__label">{DUE_STATE_LABEL[a.dueState]}</span>
          ) : null}
        </div>
        <div className="summary-hero__item">
          <span className="summary-hero__label">Ödeme durumu</span>
          <span className="summary-hero__value">
            {paymentStatusLabel(a.paymentStatus, a.direction)}
          </span>
          {a.workStatus ? (
            <span className="summary-hero__label">İş: {WORK_STATUS_LABEL[a.workStatus]}</span>
          ) : null}
        </div>
      </section>

      <div className="page__actions">
        {!canWrite && closedReason ? (
          <DisabledAction label="Değişiklik kapalı" reason={closedReason} />
        ) : (
          <>
            <ButtonLink
              variant={payable ? 'expense' : 'income'}
              to={`/uygulama/anlasmalar/${a.id}/odeme`}
            >
              {payable ? 'Ödeme yap' : 'Tahsilat al'}
            </ButtonLink>
            {finalLocked ? (
              <DisabledAction
                label="Bedeli değiştir"
                reason="İptal edilen anlaşmanın kesin bedeli kayıtlı; bedel değiştirilemez."
              />
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setNewAmount('');
                  setDialog('amount');
                }}
              >
                {a.settlementPending ? 'Kesin bedeli kaydet' : 'Bedeli değiştir'}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setNewDue(a.dueDate ?? '');
                setDialog('due');
              }}
            >
              Vadeyi değiştir
            </Button>
            {isAgreement && !cancelled ? (
              <Button variant="secondary" onClick={() => setDialog('work')}>
                {a.workStatus === 'completed'
                  ? 'İşi devam ediyor yap'
                  : 'İşi tamamlandı olarak işaretle'}
              </Button>
            ) : null}
            {isAgreement && !cancelled ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setNewAmount('');
                  setCancelMode('final');
                  setDialog('cancel');
                }}
              >
                İptal et
              </Button>
            ) : null}
            {isAgreement ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setEdit({
                    title: a.title,
                    description: a.description,
                    agreementDate: a.agreementDate ?? '',
                  });
                  setDialog('edit');
                }}
              >
                Bilgileri düzenle
              </Button>
            ) : null}
            <Button variant="danger" onClick={() => setDialog('delete')}>
              Sil
            </Button>
          </>
        )}
      </div>

      <Card title="Bilgiler">
        <dl className="definition-list">
          <dt>Tür</dt>
          <dd>{isAgreement ? 'Anlaşma' : payable ? 'Başlangıç borcu' : 'Başlangıç alacağı'}</dd>
          {isAgreement ? (
            <>
              <dt>Anlaşma tarihi</dt>
              <dd>{formatDate(a.agreementDate)}</dd>
            </>
          ) : (
            <>
              <dt>Takip başlangıcı</dt>
              <dd>{formatDate(a.trackingStartDate)}</dd>
            </>
          )}
          <dt>Açıklama</dt>
          <dd>{a.description || <span className="muted">—</span>}</dd>
          <dt>Oluşturan</dt>
          <dd>
            {a.createdBy?.name ?? 'Bilinmeyen kullanıcı'} · {formatDateTime(a.createdAt)}
          </dd>
        </dl>
        {!isAgreement ? (
          <p className="meta">
            Başlangıç kaydı yeni gelir/gider sayılmaz; ondan açılan ödeme/tahsilat bu kayda
            bağlanır.
          </p>
        ) : null}
      </Card>

      <Card title="Bağlı hareketler ve iadeler">
        {a.transactions.length === 0 ? (
          <p className="muted">Henüz bağlı hareket yok. Anlaşma oluşturmak gelir/gider yazmaz.</p>
        ) : (
          <ul className="item-list">
            {a.transactions.map((t) => (
              <li key={t.id}>
                <Link className="item-card" to={`/uygulama/islemler/${t.id}`}>
                  <div className="item-card__main">
                    <span className="item-card__title">
                      #{t.recordNo} · {KIND_LABEL[t.kind]}
                    </span>
                    <span className="meta">
                      {formatDate(t.date)}
                      {t.description ? ` · ${t.description}` : ''}
                    </span>
                    {t.isSplit ? (
                      <span className="meta">
                        Paylaştırılmış kayıt; bu anlaşmaya düşen pay gösterilir.
                      </span>
                    ) : null}
                  </div>
                  <Amount value={t.agreementShare} kind={t.kind} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {a.amountHistory.length > 0 ? (
        <Card title="Bedel geçmişi">
          <ul className="item-list">
            {a.amountHistory.map((change, index) => (
              <li key={index} className="card">
                <strong>
                  {formatMoney(change.old)} → {formatMoney(change.new)}
                </strong>
                <p className="meta">
                  {formatDateTime(change.at)} · {change.by?.name} · Gerekçe: {change.reason}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {a.dueDateHistory.length > 0 ? (
        <Card title="Vade geçmişi">
          <ul className="item-list">
            {a.dueDateHistory.map((change, index) => (
              <li key={index} className="card">
                <strong>
                  {formatDate(change.old)} → {formatDate(change.new)}
                </strong>
                <p className="meta">
                  {formatDateTime(change.at)} · {change.by?.name} · Gerekçe: {change.reason}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Belgeler">
        <DocumentPlaceholder titled={false} />
      </Card>
      <Card title="Değişiklik geçmişi">
        <HistoryList
          history={a.history}
          formatValue={(field, value) =>
            field === 'currentAmount' && typeof value === 'number'
              ? formatTl(value)
              : field === 'dueDate' || field === 'agreementDate'
                ? formatDate(value as string | null)
                : field === 'workStatus' && typeof value === 'string'
                  ? (WORK_STATUS_LABEL[value as keyof typeof WORK_STATUS_LABEL] ?? value)
                  : null
          }
        />
      </Card>

      <ActionDialog
        open={dialog === 'amount'}
        title={a.settlementPending ? 'Kesin bedeli kaydet' : 'Bedeli değiştir'}
        onClose={close}
        confirmLabel="Bedeli kaydet"
        onConflict={reload}
        confirmDisabled={
          amountKurus === null ||
          amountKurus <= 0 ||
          amountPreview.isFetching ||
          !amountPreview.data
        }
        onConfirm={async (reason) => {
          await apiPost(`/agreements/${a.id}/amount`, {
            newAmount: amountKurus,
            reason,
            expectedUpdatedAt: a.updatedAt,
          });
          await done('Bedel güncellendi.');
        }}
      >
        <p>Eski bedel: {formatMoney(a.currentAmount)}</p>
        <Field label="Yeni bedel" required hint="Ek iş aynı anlaşmanın bedeline eklenebilir.">
          {(props) => <MoneyInput {...props} value={newAmount} onChange={setNewAmount} />}
        </Field>
        <AmountPreviewBlock preview={amountPreview} payable={payable} />
        <p className="meta">
          Ayrı bir iş için{' '}
          <Link
            to={`/uygulama/anlasmalar/yeni?yon=${payable ? 'odenecek' : 'tahsil'}&kisi=${a.partyId}${
              a.projectId ? `&proje=${a.projectId}` : '&genel=1'
            }`}
          >
            yeni anlaşma oluşturun
          </Link>
          .
        </p>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'due'}
        title="Vadeyi değiştir"
        onClose={close}
        confirmLabel="Vadeyi kaydet"
        onConflict={reload}
        confirmDisabled={(newDue || null) === a.dueDate}
        onConfirm={async (reason) => {
          await apiPost(`/agreements/${a.id}/due-date`, {
            dueDate: newDue || null,
            reason,
            expectedUpdatedAt: a.updatedAt,
          });
          await done('Vade güncellendi.');
        }}
      >
        <p>Eski vade: {a.dueDate ? formatDate(a.dueDate) : 'Belirlenmemiş'}</p>
        <Field
          label="Yeni vade"
          hint="Boş bırakılırsa vade kaldırılır; vadesiz kayıt gecikmiş sayılmaz."
        >
          {(props) => (
            <DateInput {...props} value={newDue} onChange={(e) => setNewDue(e.target.value)} />
          )}
        </Field>
        <p className="meta">Gecikme bedeli veya geliri artırmaz; faiz/ceza yoktur.</p>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'work'}
        title={
          a.workStatus === 'completed' ? 'İşi devam ediyor yap' : 'İşi tamamlandı olarak işaretle'
        }
        onClose={close}
        confirmLabel="Kaydet"
        reason="none"
        onConflict={reload}
        onConfirm={async () => {
          await apiPost(`/agreements/${a.id}/work-status`, {
            workStatus: a.workStatus === 'completed' ? 'ongoing' : 'completed',
            expectedUpdatedAt: a.updatedAt,
          });
          await done('İş durumu güncellendi.');
        }}
      >
        <p>
          İş durumu ödeme durumundan ayrıdır. İşi tamamlamak kalan {payable ? 'borcu' : 'alacağı'} (
          {formatTl(a.remaining)}) sıfırlamaz.
        </p>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'cancel'}
        title="Anlaşmayı iptal et"
        onClose={close}
        confirmLabel="İptal et"
        confirmVariant="danger"
        onConflict={reload}
        confirmDisabled={
          cancelMode === 'final' &&
          (amountKurus === null ||
            amountKurus < 0 ||
            amountPreview.isFetching ||
            !amountPreview.data)
        }
        onConfirm={async (reason) => {
          await apiPost(`/agreements/${a.id}/cancel`, {
            ...(cancelMode === 'final' ? { finalAmount: amountKurus } : {}),
            reason,
            expectedUpdatedAt: a.updatedAt,
          });
          await done('Anlaşma iptal edildi.');
        }}
      >
        <p>
          İptal geçmiş hareketleri silmez ve para iadesi oluşturmaz. Geri gelen para iade eylemiyle
          girilir.
          {payable ? ' Ödenen' : ' Tahsil edilen'}: {formatTl(a.netSettled)}.
        </p>
        <ChipGroup
          label="Hesaplaşma"
          options={[
            { value: 'final', label: 'Kesin bedel belli' },
            { value: 'pending', label: 'Kesin bedel belli değil' },
          ]}
          value={cancelMode}
          onChange={setCancelMode}
        />
        {cancelMode === 'final' ? (
          <>
            <Field label="Kesinleşen bedel" required hint="Hiç iş yapılmadıysa 0 girin.">
              {(props) => <MoneyInput {...props} value={newAmount} onChange={setNewAmount} />}
            </Field>
            <AmountPreviewBlock preview={amountPreview} payable={payable} />
          </>
        ) : (
          <p className="alert alert--info">
            Anlaşma “İptal — hesap kesinleşmedi” olarak kalır; kalan {formatTl(a.remaining)}{' '}
            gizlenmez.
          </p>
        )}
      </ActionDialog>

      <ActionDialog
        open={dialog === 'edit'}
        title="Anlaşma bilgileri"
        onClose={close}
        confirmLabel="Kaydet"
        reason="none"
        onConflict={reload}
        confirmDisabled={!edit.title.trim()}
        onConfirm={async () => {
          await apiPatch(`/agreements/${a.id}`, {
            title: edit.title.trim(),
            description: edit.description.trim(),
            agreementDate: edit.agreementDate || null,
            expectedUpdatedAt: a.updatedAt,
          });
          await done('Anlaşma bilgileri güncellendi.');
        }}
      >
        <Field label="Anlaşma adı" required>
          {(props) => (
            <TextInput
              {...props}
              value={edit.title}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            />
          )}
        </Field>
        <Field label="Anlaşma tarihi">
          {(props) => (
            <DateInput
              {...props}
              value={edit.agreementDate}
              onChange={(e) => setEdit({ ...edit, agreementDate: e.target.value })}
            />
          )}
        </Field>
        <Field label="Açıklama">
          {(props) => (
            <TextArea
              {...props}
              rows={3}
              value={edit.description}
              onChange={(e) => setEdit({ ...edit, description: e.target.value })}
            />
          )}
        </Field>
        <p className="meta">Bedel ve vade değişiklikleri kendi eylemleriyle, gerekçeyle yapılır.</p>
      </ActionDialog>

      <ActionDialog
        open={dialog === 'delete'}
        title={`${a.label} kaydını sil`}
        onClose={close}
        confirmLabel="Sil"
        confirmVariant="danger"
        onConflict={reload}
        blockedReason={
          a.transactions.some((t) => !t.deletedAt)
            ? 'Bu anlaşmaya bağlı hareketler var; silmek yerine iptal edin veya bedelini değiştirin.'
            : null
        }
        onConfirm={async (reason) => {
          await apiDelete(`/agreements/${a.id}`, { reason, expectedUpdatedAt: a.updatedAt });
          await invalidateRecords(queryClient);
          toast('Kayıt silindi. Silinenlerden geri alınabilir.');
          await navigate('/uygulama/anlasmalar', { replace: true });
        }}
      >
        <ImpactPreview
          groups={[
            {
              rows: [
                {
                  label: payable ? 'Firma kalan borcu' : 'Firma kalan alacağı',
                  before: a.remaining,
                  after: 0,
                  format: (value) =>
                    value === a.remaining
                      ? formatMoney(a.remaining)
                      : `− ${formatMoney(a.remaining)}`,
                },
              ],
            },
          ]}
          note="Silinen kayıt açık borç/alacak toplamlarından ve vade listelerinden çıkar; gelir/gider değişmez."
        />
      </ActionDialog>
    </>
  );
}
