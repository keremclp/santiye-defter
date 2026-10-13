import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Ban,
  CalendarClock,
  CircleCheck,
  Coins,
  Ellipsis,
  HandCoins,
  Handshake,
  History,
  Paperclip,
  Pencil,
  RotateCcw,
  Split,
  Trash2,
  TriangleAlert,
  Wallet,
} from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiDelete, apiPatch, apiPost } from '../../api/client';
import { invalidateRecords, useAgreement } from '../../api/queries';
import type { AgreementDetail, AmountPreview } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Amount, Badge, KindIcon } from '../../components/ui/Amount';
import { Button, ButtonLink, DisabledAction } from '../../components/ui/Button';
import { DocumentPlaceholder, Metric, PageHeader, Panel } from '../../components/ui/Card';
import { ChipGroup } from '../../components/ui/Chips';
import { DateInput, Field, TextArea, TextInput } from '../../components/ui/Field';
import { HistoryList } from '../../components/ui/HistoryList';
import { Icon } from '../../components/ui/Icon';
import { ImpactPreview } from '../../components/ui/ImpactPreview';
import { ListRow, ListRows } from '../../components/ui/ListRow';
import { Menu } from '../../components/ui/Menu';
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
import { AgreementStatusBadges, DueBadge } from '../common/RecordTables';

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

  const openAmount = () => {
    setNewAmount('');
    setDialog('amount');
  };
  const openDue = () => {
    setNewDue(a.dueDate ?? '');
    setDialog('due');
  };

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
        actions={
          <>
            <Refreshing active={refreshing} />
            {canWrite ? (
              <>
                <ButtonLink to={`/uygulama/anlasmalar/${a.id}/odeme`}>
                  <Icon icon={payable ? ArrowUpRight : ArrowDownLeft} />
                  {payable ? 'Ödeme yap' : 'Tahsilat al'}
                </ButtonLink>
                {finalLocked ? null : (
                  <Button variant="secondary" onClick={openAmount}>
                    <Icon icon={Coins} />
                    {a.settlementPending ? 'Kesin bedeli kaydet' : 'Bedeli değiştir'}
                  </Button>
                )}
                <Button variant="secondary" onClick={openDue}>
                  <Icon icon={CalendarClock} />
                  Vadeyi değiştir
                </Button>
                <Menu
                  label="Diğer işlemler"
                  buttonClassName="btn btn--secondary"
                  buttonContent={
                    <>
                      <Icon icon={Ellipsis} />
                      Diğer
                    </>
                  }
                >
                  {(close) => (
                    <>
                      {isAgreement && !cancelled ? (
                        <button
                          type="button"
                          className="dropdown__item"
                          role="menuitem"
                          onClick={() => {
                            close();
                            setDialog('work');
                          }}
                        >
                          <Icon icon={a.workStatus === 'completed' ? RotateCcw : CircleCheck} />
                          {a.workStatus === 'completed'
                            ? 'İşi devam ediyor yap'
                            : 'İşi tamamlandı olarak işaretle'}
                        </button>
                      ) : null}
                      {isAgreement ? (
                        <button
                          type="button"
                          className="dropdown__item"
                          role="menuitem"
                          onClick={() => {
                            close();
                            setEdit({
                              title: a.title,
                              description: a.description,
                              agreementDate: a.agreementDate ?? '',
                            });
                            setDialog('edit');
                          }}
                        >
                          <Icon icon={Pencil} />
                          Bilgileri düzenle
                        </button>
                      ) : null}
                      {finalLocked ? (
                        <button type="button" className="dropdown__item" role="menuitem" disabled>
                          <Icon icon={Coins} />
                          <span>
                            Bedeli değiştir
                            <small>
                              İptal edilen anlaşmanın kesin bedeli kayıtlı; bedel değiştirilemez.
                            </small>
                          </span>
                        </button>
                      ) : null}
                      <div className="dropdown__sep" role="separator" />
                      {isAgreement && !cancelled ? (
                        <button
                          type="button"
                          className="dropdown__item dropdown__item--danger"
                          role="menuitem"
                          onClick={() => {
                            close();
                            setNewAmount('');
                            setCancelMode('final');
                            setDialog('cancel');
                          }}
                        >
                          <Icon icon={Ban} />
                          İptal et
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="dropdown__item dropdown__item--danger"
                        role="menuitem"
                        onClick={() => {
                          close();
                          setDialog('delete');
                        }}
                      >
                        <Icon icon={Trash2} />
                        Sil
                      </button>
                    </>
                  )}
                </Menu>
              </>
            ) : null}
          </>
        }
      />
      <AgreementStatusBadges agreement={a} />
      {!canWrite && closedReason ? (
        <DisabledAction label="Değişiklik kapalı" reason={closedReason} />
      ) : null}
      {a.settlementPending ? (
        <div className="alert alert--danger" role="status">
          <p className="alert__title alert__title--icon">
            <Icon icon={Ban} />
            İptal — hesap kesinleşmedi
          </p>
          <p>
            Kesin bedel girilene kadar kalan tutar görünür kalır. Kesin bedeli “Kesin bedeli kaydet”
            ile kaydedin.
          </p>
        </div>
      ) : null}
      {a.excess > 0 ? (
        <div className="alert alert--danger" role="status">
          <p className="alert__title alert__title--icon">
            <Icon icon={TriangleAlert} />
            {payable ? 'Fazla ödeme' : 'Fazla tahsilat'}: {formatTl(a.excess)}
          </p>
          <p>
            Geri gelen para iade eylemiyle kaynak harekete girilir; başka borcu kendiliğinden
            kapatmaz.
          </p>
        </div>
      ) : null}

      <section className="metrics metrics--4" aria-label="Anlaşma özeti">
        <Metric
          label="Güncel bedel"
          icon={Coins}
          tone="neutral"
          balance
          value={formatMoney(a.currentAmount)}
          sub={
            a.initialAmount !== a.currentAmount
              ? `İlk bedel ${formatMoney(a.initialAmount)}`
              : 'İlk bedelden değişmedi'
          }
        />
        <Metric
          label={payable ? 'Net ödenen' : 'Net tahsil edilen'}
          icon={payable ? ArrowUpRight : ArrowDownLeft}
          tone={payable ? 'expense' : 'income'}
          balance
          value={formatMoney(a.netSettled)}
          valueClassName={payable ? 'amount--expense' : 'amount--income'}
          sub={paymentStatusLabel(a.paymentStatus, a.direction)}
          info={
            payable
              ? 'Bu anlaşmaya bağlı ödemeler − ödeme iadeleri.'
              : 'Bu anlaşmaya bağlı tahsilatlar − tahsilat iadeleri.'
          }
        />
        <Metric
          label={payable ? 'Kalan borç' : 'Kalan alacak'}
          icon={payable ? Wallet : HandCoins}
          tone="primary"
          balance
          value={formatMoney(a.remaining)}
          sub={
            a.excess > 0 ? (
              <Badge tone="danger">
                {payable ? 'Fazla ödeme' : 'Fazla tahsilat'} {formatMoney(a.excess)}
              </Badge>
            ) : a.dueState === 'overdue' ? (
              <DueBadge agreement={a} />
            ) : (
              'Fazla yok'
            )
          }
        />
        <Metric
          label="Vade"
          icon={CalendarClock}
          tone="neutral"
          balance
          value={a.dueDate ? formatDate(a.dueDate) : 'Belirlenmemiş'}
          sub={
            a.dueState === 'overdue' || a.dueState === 'upcoming' ? (
              <DueBadge agreement={a} />
            ) : a.dueState ? (
              DUE_STATE_LABEL[a.dueState]
            ) : (
              'Vade yok'
            )
          }
        />
      </section>

      <div className="dash-grid">
        <div className="dash-col">
          <Panel title="Bağlı hareketler ve iadeler" icon={ArrowLeftRight}>
            {a.transactions.length === 0 ? (
              <p className="list-empty">
                Henüz bağlı hareket yok. Anlaşma oluşturmak gelir/gider yazmaz.
              </p>
            ) : (
              <ListRows label="Bağlı hareketler">
                {a.transactions.map((t) => (
                  <ListRow
                    key={t.id}
                    to={`/uygulama/islemler/${t.id}`}
                    icon={<KindIcon kind={t.kind} />}
                    title={t.description || KIND_LABEL[t.kind]}
                    titleExtra={t.deletedAt ? <Badge tone="danger">Silindi</Badge> : null}
                    meta={
                      <>
                        <span className="record-no">#{t.recordNo}</span> · {formatDate(t.date)} ·{' '}
                        {KIND_LABEL[t.kind]}
                      </>
                    }
                    side={
                      <>
                        <Amount value={t.agreementShare} kind={t.kind} />
                        {t.isSplit ? (
                          <span className="split-note">
                            <Icon icon={Split} />
                            Bu anlaşmaya düşen pay
                          </span>
                        ) : null}
                      </>
                    }
                  />
                ))}
              </ListRows>
            )}
          </Panel>

          {a.amountHistory.length > 0 || a.dueDateHistory.length > 0 ? (
            <Panel title="Bedel ve vade geçmişi" icon={CalendarClock}>
              <div className="panel__body">
                <ol className="history-list">
                  {[
                    ...a.amountHistory.map((change) => ({
                      at: change.at,
                      title: `Bedel: ${formatMoney(change.old)} → ${formatMoney(change.new)}`,
                      by: change.by?.name,
                      reason: change.reason,
                    })),
                    ...a.dueDateHistory.map((change) => ({
                      at: change.at,
                      title: `Vade: ${formatDate(change.old)} → ${formatDate(change.new)}`,
                      by: change.by?.name,
                      reason: change.reason,
                    })),
                  ]
                    .sort((x, y) => (x.at < y.at ? 1 : -1))
                    .map((entry, index) => (
                      <li key={`${entry.at}-${index}`} className="history-list__item">
                        <div className="history-list__head">
                          <span>{entry.title}</span>
                          <span className="meta">
                            {formatDateTime(entry.at)} · {entry.by ?? 'Bilinmeyen kullanıcı'}
                          </span>
                        </div>
                        <p className="meta">Gerekçe: {entry.reason}</p>
                      </li>
                    ))}
                </ol>
              </div>
            </Panel>
          ) : null}
        </div>

        <div className="dash-col">
          <Panel title="Bilgiler" icon={Handshake}>
            <div className="panel__body stack stack--sm">
              <dl className="definition-list">
                <dt>Tür</dt>
                <dd>
                  {isAgreement ? 'Anlaşma' : payable ? 'Başlangıç borcu' : 'Başlangıç alacağı'}
                </dd>
                <dt>Kişi/firma</dt>
                <dd>
                  {a.party ? (
                    <Link to={`/uygulama/kisiler/${a.party.id}`}>{a.party.name}</Link>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>Kapsam</dt>
                <dd>{scopeLink}</dd>
                {a.workStatus ? (
                  <>
                    <dt>İş durumu</dt>
                    <dd>{WORK_STATUS_LABEL[a.workStatus]}</dd>
                  </>
                ) : null}
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
            </div>
          </Panel>

          <Panel title="Belgeler" icon={Paperclip}>
            <div className="panel__body">
              <DocumentPlaceholder titled={false} />
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Değişiklik geçmişi" icon={History}>
        <div className="panel__body">
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
        </div>
      </Panel>

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
