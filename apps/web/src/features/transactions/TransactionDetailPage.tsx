import { useQueryClient } from '@tanstack/react-query';
import {
  ArchiveRestore,
  Building2,
  Copy,
  HardHat,
  History,
  Paperclip,
  Pencil,
  Receipt,
  Split,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { apiDelete, apiPost, errorMessage, isApiError } from '../../api/client';
import { invalidateRecords, useTransaction } from '../../api/queries';
import type { DuplicateDraft, TransactionDetail } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Amount, Badge, KindBadge, KindIcon } from '../../components/ui/Amount';
import { Button, ButtonLink, DisabledAction } from '../../components/ui/Button';
import { DocumentPlaceholder, PageHeader, Panel } from '../../components/ui/Card';
import { Checkbox, Field, TextArea } from '../../components/ui/Field';
import { HistoryList } from '../../components/ui/HistoryList';
import { Icon } from '../../components/ui/Icon';
import { ListRow, ListRows } from '../../components/ui/ListRow';
import { ErrorState, Loading, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatDate, formatDateTime, formatMoney, formatTl } from '../../lib/format';
import { KIND_LABEL } from '../../lib/labels';
import { toast } from '../../stores/ui';
import { ImpactBlock } from './ImpactBlock';
import { allocationsEffect, useImpactPreview } from './impact';
import type { CopyState } from './TransactionNewPage';

function historyValue(field: string, value: unknown): string | null {
  if (value === null || value === undefined) return '—';
  if (field === 'amount' && typeof value === 'number') return formatTl(value);
  if ((field === 'allocations' || field === 'parts') && Array.isArray(value)) {
    return `${value.length} pay`;
  }
  if (field === 'partyId' || field === 'categoryId') return 'değişti';
  if (field === 'date' && typeof value === 'string') return formatDate(value);
  return null;
}

function projectNames(transaction: TransactionDetail): Record<string, string> {
  return Object.fromEntries(
    transaction.allocations
      .filter((a) => a.projectId && a.project)
      .map((a) => [a.projectId!, a.project!.name]),
  );
}

/** İşlem detayı (şartname 7.4): paylar, iadeler, oluşturan, geçmiş ve eylemler. */
export function TransactionDetailPage() {
  const { id } = useParams();
  const query = useTransaction(id);
  usePageMeta(query.data ? `#${query.data.recordNo}` : 'İşlem');

  return (
    <main className="page">
      {query.isPending ? (
        <Loading />
      ) : query.error || !query.data ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <TransactionDetailView
          transaction={query.data}
          refreshing={query.isFetching}
          reload={() => query.refetch()}
        />
      )}
    </main>
  );
}

function TransactionDetailView({
  transaction: t,
  refreshing,
  reload,
}: {
  transaction: TransactionDetail;
  refreshing: boolean;
  reload: () => unknown;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite, reason: closedReason } = useWriteAccess();
  const [dialog, setDialog] = useState<'delete' | 'restore' | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [restoreExcess, setRestoreExcess] = useState<number | null>(null);
  const [confirmExcess, setConfirmExcess] = useState(false);
  const [excessReason, setExcessReason] = useState('');
  const isCash = t.kind === 'income' || t.kind === 'expense';
  const deleted = Boolean(t.deletedAt);
  const activeRefunds = t.refunds.filter((refund) => !refund.deletedAt);
  const effect = allocationsEffect(t);
  const names = projectNames(t);
  const deleteImpact = useImpactPreview(t.kind, effect, [], {
    enabled: dialog === 'delete',
    projectNames: names,
  });
  const restoreImpact = useImpactPreview(t.kind, [], effect, {
    enabled: dialog === 'restore',
    projectNames: names,
  });

  async function copy() {
    setCopyError(null);
    try {
      const draft = await apiPost<DuplicateDraft>(`/transactions/${t.id}/duplicate`);
      const state: { copy: CopyState } = {
        copy: { draft, source: { id: t.id, recordNo: t.recordNo, party: t.party } },
      };
      await navigate('/uygulama/islemler/yeni', { state });
    } catch (caught) {
      setCopyError(errorMessage(caught));
    }
  }

  const kindLabel = KIND_LABEL[t.kind];

  return (
    <>
      <PageHeader
        title={`#${t.recordNo} · ${kindLabel}`}
        subtitle={t.description || undefined}
        back={{ to: '/uygulama/islemler', label: 'İşlemler' }}
        actions={
          <>
            <Refreshing active={refreshing} />
            {!canWrite ? null : deleted ? (
              <Button onClick={() => setDialog('restore')}>
                <Icon icon={ArchiveRestore} />
                Geri al
              </Button>
            ) : (
              <>
                <ButtonLink variant="secondary" to={`/uygulama/islemler/${t.id}/duzenle`}>
                  <Icon icon={Pencil} />
                  Düzenle
                </ButtonLink>
                {isCash && (t.refundable ?? 0) > 0 ? (
                  <ButtonLink variant="secondary" to={`/uygulama/islemler/${t.id}/iade`}>
                    <Icon icon={Undo2} />
                    İade kaydet
                  </ButtonLink>
                ) : null}
                {isCash ? (
                  <Button variant="secondary" onClick={() => void copy()}>
                    <Icon icon={Copy} />
                    Kopyala
                  </Button>
                ) : null}
                <Button variant="danger" onClick={() => setDialog('delete')}>
                  <Icon icon={Trash2} />
                  Sil
                </Button>
              </>
            )}
          </>
        }
      />
      {!canWrite && closedReason ? (
        <DisabledAction label="Değişiklik kapalı" reason={closedReason} />
      ) : null}
      {deleted ? (
        <div className="alert alert--danger" role="status">
          <p className="alert__title alert__title--icon">
            <Icon icon={Trash2} />
            Bu kayıt silindi
          </p>
          <p>
            {formatDateTime(t.deletedAt)} · {t.deletedBy?.name ?? 'Bilinmeyen kullanıcı'}
            {t.deleteReason ? ` · Gerekçe: ${t.deleteReason}` : ''}
          </p>
          <p className="meta">Silinen kayıt toplamlara girmez.</p>
        </div>
      ) : null}
      {copyError ? (
        <div className="alert alert--danger" role="alert">
          {copyError}
        </div>
      ) : null}

      <div className="dash-grid">
        <div className="dash-col">
          <Panel title="Kayıt" icon={Receipt}>
            <div className="detail-amount">
              <Amount value={t.amount} kind={t.kind} showKind />
            </div>
            <dl className="definition-list">
              <dt>Tür</dt>
              <dd>
                <span className="status-row">
                  <KindBadge kind={t.kind} />
                  {t.isSplit ? (
                    <Badge tone="cyan">
                      <Icon icon={Split} />
                      Paylaştırıldı
                    </Badge>
                  ) : null}
                </span>
              </dd>
              <dt>İşlem tarihi</dt>
              <dd>{formatDate(t.date)}</dd>
              <dt>Kişi/firma</dt>
              <dd>
                {t.party ? (
                  <Link to={`/uygulama/kisiler/${t.party.id}`}>{t.party.name}</Link>
                ) : (
                  <span className="muted">Muhatapsız</span>
                )}
              </dd>
              {t.kind === 'expense' || t.kind === 'expense_refund' ? (
                <>
                  <dt>Kategori</dt>
                  <dd>{t.category?.name ?? <span className="muted">Kategorisiz</span>}</dd>
                </>
              ) : null}
              <dt>Açıklama</dt>
              <dd>{t.description || <span className="muted">—</span>}</dd>
              {t.refundOf ? (
                <>
                  <dt>İade kaynağı</dt>
                  <dd>
                    <Link to={`/uygulama/islemler/${t.refundOf.transactionId}`}>
                      Kaynak kaydı aç
                    </Link>
                  </dd>
                </>
              ) : null}
              {t.excess ? (
                <>
                  <dt>Fazla tutar</dt>
                  <dd>
                    <span className="text-danger">{formatMoney(t.excess.amount)}</span> — Gerekçe:{' '}
                    {t.excess.reason}
                  </dd>
                </>
              ) : null}
              <dt>Oluşturan</dt>
              <dd>
                {t.createdBy?.name ?? 'Bilinmeyen kullanıcı'} · {formatDateTime(t.createdAt)}
              </dd>
              <dt>Son güncelleyen</dt>
              <dd>
                {t.updatedBy?.name ?? 'Bilinmeyen kullanıcı'} · {formatDateTime(t.updatedAt)}
              </dd>
            </dl>
          </Panel>
        </div>

        <div className="dash-col">
          <Panel title={t.isSplit ? 'Kapsam ve paylar' : 'Kapsam'} icon={HardHat}>
            <ul className="list-rows">
              {t.allocations.map((allocation) => (
                <li key={allocation.id}>
                  <div className="list-row list-row--static">
                    <span className="icon-box icon-box--lg icon-box--neutral">
                      <Icon icon={allocation.scope === 'company' ? Building2 : HardHat} />
                    </span>
                    <span className="list-row__main">
                      <span className="list-row__title">
                        <span className="list-row__title-text">
                          {allocation.scope === 'company' ? (
                            'Firma geneli'
                          ) : allocation.project ? (
                            <Link
                              className="cell-link"
                              to={`/uygulama/projeler/${allocation.project.id}`}
                            >
                              {allocation.project.name}
                            </Link>
                          ) : (
                            'Şantiye'
                          )}
                        </span>
                      </span>
                      <span className="list-row__meta block">
                        {allocation.agreement ? (
                          <Link to={`/uygulama/anlasmalar/${allocation.agreement.id}`}>
                            {allocation.agreement.name}
                          </Link>
                        ) : (
                          'Anlaşmaya bağlı değil'
                        )}
                      </span>
                    </span>
                    <span className="list-row__side">
                      <span className="amount amount--neutral">
                        {formatMoney(allocation.amount)}
                      </span>
                      {allocation.refundedAmount > 0 ? (
                        <span className="list-row__note">
                          İade edilen: {formatMoney(allocation.refundedAmount)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {isCash ? (
            <Panel title="İadeler" icon={Undo2}>
              {t.refunds.length === 0 ? (
                <p className="list-empty">Bu kayda iade yok.</p>
              ) : (
                <ListRows label="İadeler">
                  {t.refunds.map((refund) => (
                    <ListRow
                      key={refund.id}
                      to={`/uygulama/islemler/${refund.id}`}
                      icon={<KindIcon kind={refund.kind} />}
                      title={refund.description || KIND_LABEL[refund.kind]}
                      titleExtra={refund.deletedAt ? <Badge tone="danger">Silindi</Badge> : null}
                      meta={
                        <>
                          <span className="record-no">#{refund.recordNo}</span> ·{' '}
                          {formatDate(refund.date)}
                        </>
                      }
                      side={
                        <>
                          <Amount value={refund.amount} kind={refund.kind} />
                          <span className="list-row__note">{KIND_LABEL[refund.kind]}</span>
                        </>
                      }
                    />
                  ))}
                </ListRows>
              )}
              {t.refundable !== null ? (
                <p className="panel__note">Daha iade edilebilir: {formatMoney(t.refundable)}</p>
              ) : null}
            </Panel>
          ) : null}

          <Panel title="Belgeler" icon={Paperclip}>
            <div className="panel__body">
              <DocumentPlaceholder titled={false} count={t.documentCount} />
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Değişiklik geçmişi" icon={History}>
        <div className="panel__body">
          <HistoryList history={t.history} formatValue={historyValue} />
        </div>
      </Panel>

      <ActionDialog
        open={dialog === 'delete'}
        title={`#${t.recordNo} kaydını sil`}
        onClose={() => setDialog(null)}
        confirmLabel="Sil"
        confirmVariant="danger"
        blockedReason={
          activeRefunds.length > 0
            ? `Bu kayda bağlı iade var (${activeRefunds.map((r) => `#${r.recordNo}`).join(', ')}); önce iadeyi silin.`
            : null
        }
        confirmDisabled={deleteImpact.loading || Boolean(deleteImpact.error)}
        onConflict={reload}
        onConfirm={async (reason) => {
          await apiDelete(`/transactions/${t.id}`, { reason, expectedUpdatedAt: t.updatedAt });
          await invalidateRecords(queryClient);
          setDialog(null);
          toast(`#${t.recordNo} silindi. Silinenlerden geri alınabilir.`);
        }}
      >
        <p>
          {formatTl(t.amount)} tutarındaki {kindLabel.toLocaleLowerCase('tr-TR')} kaydı silinecek.
          {t.isSplit ? ' Paylaştırılmış kaydın bütün payları birlikte kalkar.' : ''}
        </p>
        {activeRefunds.length === 0 ? <ImpactBlock impact={deleteImpact} /> : null}
      </ActionDialog>

      <ActionDialog
        open={dialog === 'restore'}
        title={`#${t.recordNo} kaydını geri al`}
        onClose={() => {
          setDialog(null);
          setRestoreExcess(null);
          setConfirmExcess(false);
          setExcessReason('');
        }}
        confirmLabel="Geri al"
        confirmDisabled={
          restoreImpact.loading ||
          Boolean(restoreImpact.error) ||
          (restoreExcess !== null && (!confirmExcess || !excessReason.trim()))
        }
        onConflict={reload}
        onConfirm={async (reason) => {
          try {
            await apiPost(`/transactions/${t.id}/restore`, {
              reason,
              expectedUpdatedAt: t.updatedAt,
              ...(restoreExcess !== null && confirmExcess
                ? { confirmExcess: true, excessReason: excessReason.trim() }
                : {}),
            });
          } catch (caught) {
            if (isApiError(caught) && caught.code === 'EXCESS_CONFIRMATION_REQUIRED') {
              setRestoreExcess((caught.details as { excess?: number } | undefined)?.excess ?? 0);
            }
            throw caught;
          }
          await invalidateRecords(queryClient);
          setDialog(null);
          toast(`#${t.recordNo} geri alındı.`);
        }}
      >
        <p>
          Kayıt geri yüklenince toplamlara ve bağlı anlaşmanın bakiyesine bir kez eklenir. Güncel
          ilişkiler sunucuda yeniden doğrulanır.
        </p>
        <ImpactBlock impact={restoreImpact} />
        {restoreExcess !== null ? (
          <div className="alert alert--danger">
            <p className="alert__title">
              Geri yükleme anlaşmanın kalanını {formatTl(restoreExcess)} aşıyor.
            </p>
            <Checkbox
              label="Fazla tutarı onaylıyorum"
              checked={confirmExcess}
              onChange={(event) => setConfirmExcess(event.target.checked)}
            />
            <Field label="Fazla tutar gerekçesi" required>
              {(props) => (
                <TextArea
                  {...props}
                  rows={2}
                  value={excessReason}
                  onChange={(event) => setExcessReason(event.target.value)}
                />
              )}
            </Field>
          </div>
        ) : null}
      </ActionDialog>
    </>
  );
}
