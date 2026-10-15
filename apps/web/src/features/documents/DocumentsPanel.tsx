import { DOCUMENT_LIMIT_PER_RECORD } from '@santiye/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore, Download, Eye, Paperclip, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { apiDelete, apiGet, apiPost, errorMessage } from '../../api/client';
import { keys } from '../../api/queries';
import type { DocumentInfo, DocumentLink } from '../../api/types';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Badge } from '../../components/ui/Amount';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { Icon } from '../../components/ui/Icon';
import { ErrorState, Loading } from '../../components/ui/States';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatBytes, formatDateTime } from '../../lib/format';
import { toast } from '../../stores/ui';
import {
  AddDocumentsButtons,
  DocumentThumb,
  UploadItemRow,
  UploadStatusBadge,
} from './DocumentParts';
import { useUploadBlock } from './limits';
import type { DocumentOwner } from './upload';
import { countsTowardLimit, useUploadQueue } from './useUploadQueue';

const OWNER_DELETED_TEXT = 'Kayıt silinmiş. Belge işlemi için önce kaydı geri yükleyin.';
/** İmzalı adresler 5 dakika geçerli; önbellekte süresi dolmadan yenilenir. */
const LINK_STALE_MS = 4 * 60_000;

const linkKey = (id: string, mode: 'preview' | 'download') => ['documents', 'link', id, mode];

function useDocumentLink(id: string, enabled: boolean) {
  return useQuery({
    queryKey: linkKey(id, 'preview'),
    queryFn: () => apiGet<DocumentLink>(`/documents/${id}/preview`),
    enabled,
    staleTime: LINK_STALE_MS,
    gcTime: LINK_STALE_MS,
    retry: false,
  });
}

/** İmzalı indirme adresini açar; dosya `attachment` olarak gelir, sayfa değişmez. */
function openDownload(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadDocument(doc: DocumentInfo) {
  try {
    const link = await apiGet<DocumentLink>(`/documents/${doc.id}/download`);
    openDownload(link.url);
  } catch (caught) {
    toast(`${doc.fileName} indirilemedi. ${errorMessage(caught)}`);
  }
}

function StoredThumb({ doc }: { doc: DocumentInfo }) {
  const link = useDocumentLink(doc.id, doc.hasPreview && !doc.deletedAt);
  const url = link.data?.isPreview ? link.data.url : null;
  return <DocumentThumb url={url} mimeType={doc.mimeType} />;
}

function StoredDocumentRow({
  doc,
  onPreview,
  onDelete,
  onRestore,
}: {
  doc: DocumentInfo;
  onPreview: () => void;
  onDelete?: (() => void) | undefined;
  onRestore?: (() => void) | undefined;
}) {
  const pending = doc.status === 'pending';
  const deleted = Boolean(doc.deletedAt);
  return (
    <li>
      <div className="list-row list-row--static doc-row">
        <StoredThumb doc={doc} />
        <span className="list-row__main">
          <span className="list-row__title">
            <span className="list-row__title-text">{doc.fileName}</span>
          </span>
          <span className="list-row__meta block">
            {doc.sizeBytes !== null ? `${formatBytes(doc.sizeBytes)} · ` : ''}
            {deleted
              ? `Silindi: ${formatDateTime(doc.deletedAt)} · ${doc.deletedBy?.name || 'Bilinmeyen kullanıcı'}`
              : pending
                ? 'Yarım kalan yükleme; 1 saat içinde tamamlanmazsa kendiliğinden kalkar'
                : `${doc.uploadedBy?.name || 'Bilinmeyen kullanıcı'} · ${formatDateTime(doc.uploadedAt)}`}
          </span>
          {deleted && doc.deleteReason ? (
            <span className="list-row__meta block">Gerekçe: {doc.deleteReason}</span>
          ) : null}
        </span>
        <span className="list-row__side">
          {pending ? (
            <UploadStatusBadge status="waiting" />
          ) : (
            <>
              {deleted ? (
                <Badge tone="danger">Silindi</Badge>
              ) : (
                <UploadStatusBadge status="uploaded" />
              )}
              <span className="doc-row__actions">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${doc.fileName} önizle`}
                  title="Önizle"
                  onClick={onPreview}
                >
                  <Icon icon={Eye} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${doc.fileName} indir`}
                  title="İndir"
                  onClick={() => void downloadDocument(doc)}
                >
                  <Icon icon={Download} />
                </button>
                {onDelete ? (
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    aria-label={`${doc.fileName} sil`}
                    title="Sil"
                    onClick={onDelete}
                  >
                    <Icon icon={Trash2} />
                  </button>
                ) : null}
                {onRestore ? (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${doc.fileName} geri al`}
                    title="Geri al"
                    onClick={onRestore}
                  >
                    <Icon icon={ArchiveRestore} />
                  </button>
                ) : null}
              </span>
            </>
          )}
        </span>
      </div>
    </li>
  );
}

/**
 * Önizleme: görselde küçültülmüş kopya gösterilir. Önizleme yoksa (PDF, çözülemeyen görsel veya
 * kotaya sığmayan önizleme) orijinal açılır veya indirilir (şartname 9.6).
 */
function PreviewDialog({ doc, onClose }: { doc: DocumentInfo; onClose: () => void }) {
  const link = useDocumentLink(doc.id, true);
  return (
    <Dialog
      open
      wide
      title={doc.fileName}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Kapat
          </Button>
          <Button onClick={() => void downloadDocument(doc)}>
            <Icon icon={Download} />
            Orijinali indir
          </Button>
        </>
      }
    >
      {link.isPending ? (
        <Loading label="Önizleme hazırlanıyor…" />
      ) : link.error || !link.data ? (
        <ErrorState error={link.error} onRetry={() => void link.refetch()} />
      ) : link.data.isPreview ? (
        <div className="doc-preview">
          <img src={link.data.url} alt={`${doc.fileName} önizlemesi`} />
        </div>
      ) : (
        <div className="stack">
          <p>
            Bu belgenin önizlemesi yok. Orijinal dosyayı tarayıcıda açabilir veya indirebilirsiniz.
          </p>
          <p>
            <a
              className="btn btn--secondary"
              href={link.data.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon icon={Eye} />
              Orijinali aç
            </a>
          </p>
        </div>
      )}
    </Dialog>
  );
}

/**
 * Detay sayfalarındaki belge alanı (şartname 4.4, 7.4, 7.6, 9.6): dosya başına durum ve yeniden
 * dene, önizleme, indirme, gerekçeli silme ve geri yükleme. Silinmiş kaydın belgeleri yalnız
 * okunur (karar 10.13).
 */
export function DocumentsPanel({
  owner,
  documents,
  ownerDeleted,
  onChanged,
}: {
  owner: DocumentOwner;
  documents: DocumentInfo[];
  ownerDeleted: boolean;
  /** Belge listesi ve kapasite yeniden yüklenir. */
  onChanged: () => unknown;
}) {
  const queryClient = useQueryClient();
  const { canWrite } = useWriteAccess();
  const queue = useUploadQueue();
  const [preview, setPreview] = useState<DocumentInfo | null>(null);
  const [action, setAction] = useState<{ kind: 'delete' | 'restore'; doc: DocumentInfo } | null>(
    null,
  );

  const serverIds = new Set(documents.map((doc) => doc.id));
  // Yerel yükleme sunucu listesine düşünce yerel satır gizlenir; yerelde izlenen bekleyen
  // belge de sunucu listesinden ikinci kez gösterilmez.
  const local = queue.items.filter(
    (item) => !(item.status === 'uploaded' && item.documentId && serverIds.has(item.documentId)),
  );
  const tracked = new Set(local.map((item) => item.documentId).filter(Boolean));
  const active = documents.filter((doc) => !doc.deletedAt && !tracked.has(doc.id));
  const deleted = documents.filter((doc) => doc.deletedAt);
  const used = active.length + local.filter(countsTowardLimit).length;
  const blocked = useUploadBlock(used, ownerDeleted ? OWNER_DELETED_TEXT : null);
  // Kapasite veya 10 belge sınırı silme ve geri yüklemeyi kapatmaz.
  const writable = canWrite && !ownerDeleted;

  const refresh = async () => {
    await Promise.all([onChanged(), queryClient.invalidateQueries({ queryKey: keys.company })]);
  };

  const addFiles = (files: File[]) => {
    queue.add(files);
    void queue.uploadAll(owner).then(refresh);
  };

  return (
    <Panel
      title="Belgeler"
      icon={Paperclip}
      actions={
        <Badge>
          {used}/{DOCUMENT_LIMIT_PER_RECORD}
        </Badge>
      }
    >
      {active.length === 0 && local.length === 0 ? (
        <p className="list-empty">Bu kayda belge eklenmedi.</p>
      ) : (
        <ul className="list-rows" aria-label="Belgeler">
          {active.map((doc) => (
            <StoredDocumentRow
              key={doc.id}
              doc={doc}
              onPreview={() => setPreview(doc)}
              onDelete={
                writable && doc.status === 'uploaded'
                  ? () => setAction({ kind: 'delete', doc })
                  : undefined
              }
            />
          ))}
          {local.map((item) => (
            <UploadItemRow
              key={item.id}
              item={item}
              onRetry={() => void queue.retry(item.id, owner).then(refresh)}
              onRemove={() => queue.remove(item.id)}
            />
          ))}
        </ul>
      )}

      {deleted.length > 0 ? (
        <section className="panel__section" aria-label="Silinen belgeler">
          <div className="subhead">Silinen belgeler</div>
          <ul className="list-rows">
            {deleted.map((doc) => (
              <StoredDocumentRow
                key={doc.id}
                doc={doc}
                onPreview={() => setPreview(doc)}
                onRestore={writable ? () => setAction({ kind: 'restore', doc }) : undefined}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="panel__actions">
        <AddDocumentsButtons
          onFiles={addFiles}
          blockedReason={blocked}
          remaining={DOCUMENT_LIMIT_PER_RECORD - used}
        />
      </div>

      {preview ? <PreviewDialog doc={preview} onClose={() => setPreview(null)} /> : null}

      <ActionDialog
        open={action?.kind === 'delete'}
        title="Belgeyi sil"
        confirmLabel="Sil"
        confirmVariant="danger"
        onClose={() => setAction(null)}
        onConflict={refresh}
        onConfirm={async (reason) => {
          const doc = action!.doc;
          await apiDelete(`/documents/${doc.id}`, { reason, expectedUpdatedAt: doc.updatedAt });
          await refresh();
          setAction(null);
          toast(`${doc.fileName} silindi. Silinen belgelerden geri alınabilir.`);
        }}
      >
        <p>
          <strong>{action?.doc.fileName}</strong> silinecek. Silinen belge bu kaydın “Silinen
          belgeler” bölümünden geri alınabilir; belge alanında yer kaplamaya devam eder.
        </p>
      </ActionDialog>

      <ActionDialog
        open={action?.kind === 'restore'}
        title="Belgeyi geri al"
        confirmLabel="Geri al"
        onClose={() => setAction(null)}
        onConflict={refresh}
        blockedReason={
          used >= DOCUMENT_LIMIT_PER_RECORD
            ? `Bu kayıtta ${DOCUMENT_LIMIT_PER_RECORD} belge var; geri yüklemek için önce birini silin.`
            : null
        }
        onConfirm={async (reason) => {
          const doc = action!.doc;
          await apiPost(`/documents/${doc.id}/restore`, {
            reason,
            expectedUpdatedAt: doc.updatedAt,
          });
          await refresh();
          setAction(null);
          toast(`${doc.fileName} geri alındı.`);
        }}
      >
        <p>
          <strong>{action?.doc.fileName}</strong> kaydın belgelerine geri eklenecek.
        </p>
      </ActionDialog>
    </Panel>
  );
}
