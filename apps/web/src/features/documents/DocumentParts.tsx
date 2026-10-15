import { DOCUMENT_LIMIT_PER_RECORD } from '@santiye/shared';
import {
  Camera,
  CircleCheck,
  CircleX,
  Clock,
  FileText,
  Image,
  LoaderCircle,
  Paperclip,
  RotateCcw,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge, type BadgeTone } from '../../components/ui/Amount';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { formatBytes } from '../../lib/format';
import { isImageType, RECORD_FULL_TEXT, useUploadBlock } from './limits';
import type { DocumentOwner } from './upload';
import {
  countsTowardLimit,
  type UploadItem,
  type UploadQueue,
  type UploadStatus,
} from './useUploadQueue';

/** Telefonda kameradan veya galeriden seçim (şartname 11). */
const ACCEPT = 'image/*,application/pdf';

const STATUS: Record<UploadStatus, { label: string; icon: LucideIcon; tone: BadgeTone }> = {
  waiting: { label: 'Bekliyor', icon: Clock, tone: 'neutral' },
  uploading: { label: 'Yükleniyor', icon: LoaderCircle, tone: 'primary' },
  uploaded: { label: 'Yüklendi', icon: CircleCheck, tone: 'income' },
  failed: { label: 'Başarısız', icon: CircleX, tone: 'danger' },
};

/** Dört durum ayrı metin ve ikonla; yalnız renge bırakılmaz (şartname 4.4). */
export function UploadStatusBadge({
  status,
  progress,
}: {
  status: UploadStatus;
  progress?: number | null;
}) {
  const text = STATUS[status];
  const percent =
    status === 'uploading' && typeof progress === 'number' ? ` %${Math.round(progress * 100)}` : '';
  return (
    <Badge tone={text.tone}>
      <Icon icon={text.icon} />
      {text.label}
      {percent}
    </Badge>
  );
}

/** Küçük önizleme; yoksa dosya türü ikonu. */
export function DocumentThumb({ url, mimeType }: { url: string | null; mimeType: string | null }) {
  if (url) {
    return (
      <span className="doc-thumb">
        <img src={url} alt="" loading="lazy" />
      </span>
    );
  }
  return (
    <span className="icon-box icon-box--lg icon-box--neutral">
      <Icon icon={isImageType(mimeType) ? Image : FileText} />
    </span>
  );
}

/** Kaydedilmeden seçilen veya yüklenmekte olan yerel dosyanın satırı (şartname 4.4). */
export function UploadItemRow({
  item,
  onRetry,
  onRemove,
  disabled = false,
}: {
  item: UploadItem;
  onRetry?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
  disabled?: boolean;
}) {
  const canRetry = item.status === 'failed' && item.retryable && onRetry;
  const canRemove = onRemove && (item.status === 'waiting' || item.status === 'failed');
  return (
    <li>
      <div className="list-row list-row--static doc-row">
        <DocumentThumb url={item.localUrl} mimeType={item.mimeType} />
        <span className="list-row__main">
          <span className="list-row__title">
            <span className="list-row__title-text">{item.name}</span>
          </span>
          <span className="list-row__meta block">{formatBytes(item.size)}</span>
          {item.error ? <span className="doc-row__error">{item.error}</span> : null}
        </span>
        <span className="list-row__side">
          <UploadStatusBadge status={item.status} progress={item.progress} />
          {canRetry || canRemove ? (
            <span className="doc-row__actions">
              {canRetry ? (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={onRetry}
                  disabled={disabled}
                  aria-label={`${item.name} belgesini yeniden dene`}
                >
                  <Icon icon={RotateCcw} />
                  Yeniden dene
                </Button>
              ) : null}
              {canRemove ? (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${item.name} dosyasını listeden kaldır`}
                  title="Listeden kaldır"
                  onClick={onRemove}
                  disabled={disabled}
                >
                  <Icon icon={X} />
                </button>
              ) : null}
            </span>
          ) : null}
        </span>
      </div>
    </li>
  );
}

/**
 * Dosya ekleme düğmeleri. Dokunmatik cihazda kamerayı doğrudan açan ayrı bir düğme vardır; diğer
 * düğme galeriden veya dosyalardan seçtirir. Eklenemiyorsa düğme kapalıdır ve nedeni yazılır.
 */
export function AddDocumentsButtons({
  onFiles,
  blockedReason,
  remaining,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  blockedReason: string | null;
  /** Kayda daha eklenebilecek belge sayısı. */
  remaining: number;
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const touch = useMediaQuery('(pointer: coarse)');
  const off = disabled || Boolean(blockedReason);

  const take = (input: HTMLInputElement) => {
    const files = [...(input.files ?? [])];
    input.value = '';
    if (files.length === 0) return;
    const room = Math.max(remaining, 0);
    setNote(files.length > room ? `${RECORD_FULL_TEXT} Fazla dosyalar eklenmedi.` : null);
    if (room > 0) onFiles(files.slice(0, room));
  };

  return (
    <div className="stack stack--sm">
      <div className="doc-add">
        {touch ? (
          <>
            <Button
              variant="secondary"
              size="small"
              disabled={off}
              onClick={() => cameraInput.current?.click()}
            >
              <Icon icon={Camera} />
              Fotoğraf çek
            </Button>
            <input
              ref={cameraInput}
              className="visually-hidden"
              type="file"
              accept={ACCEPT}
              capture="environment"
              tabIndex={-1}
              aria-label="Kamerayla belge çek"
              disabled={off}
              onChange={(event) => take(event.currentTarget)}
            />
          </>
        ) : null}
        <Button
          variant="secondary"
          size="small"
          disabled={off}
          onClick={() => fileInput.current?.click()}
        >
          <Icon icon={Paperclip} />
          {touch ? 'Galeriden seç' : 'Dosya ekle'}
        </Button>
        <input
          ref={fileInput}
          className="visually-hidden"
          type="file"
          accept={ACCEPT}
          multiple
          tabIndex={-1}
          aria-label="Belge dosyası seç"
          disabled={off}
          onChange={(event) => take(event.currentTarget)}
        />
      </div>
      {blockedReason ? (
        <p className="doc-blocked" role="note">
          {blockedReason}
        </p>
      ) : null}
      {note && !blockedReason ? <p className="doc-blocked">{note}</p> : null}
    </div>
  );
}

/**
 * Formun sağ sütunundaki belge alanı: dosyalar kayıttan sonra yüklenir. Belge eklenemese de
 * kayıt girilebilir.
 */
export function DocumentFormField({
  queue,
  disabled = false,
}: {
  queue: UploadQueue;
  disabled?: boolean;
}) {
  const used = queue.items.filter(countsTowardLimit).length;
  const blocked = useUploadBlock(used);
  return (
    <div className="field">
      <span className="field__label">
        Belgeler
        <Badge>
          {used}/{DOCUMENT_LIMIT_PER_RECORD}
        </Badge>
      </span>
      {queue.items.length > 0 ? (
        <ul className="list-rows doc-list" aria-label="Seçilen belgeler">
          {queue.items.map((item) => (
            <UploadItemRow
              key={item.id}
              item={item}
              onRemove={() => queue.remove(item.id)}
              disabled={disabled || queue.busy}
            />
          ))}
        </ul>
      ) : null}
      <AddDocumentsButtons
        onFiles={queue.add}
        blockedReason={blocked}
        remaining={DOCUMENT_LIMIT_PER_RECORD - used}
        disabled={disabled || queue.busy}
      />
      {!blocked ? (
        <span className="field__hint">
          Kameradan veya galeriden; PDF ya da fotoğraf, dosya başına en fazla 20 MB. Kayıttan sonra
          yüklenir.
        </span>
      ) : null}
    </div>
  );
}

/** Kayıt kaydedildikten sonra belgeler yüklenirken (şartname 9.7). */
export function UploadingNotice({ queue }: { queue: UploadQueue }) {
  const total = queue.items.length;
  const done = queue.items.filter((item) => item.status === 'uploaded').length;
  return (
    <div className="save-status save-status--saving" role="status" aria-live="polite">
      <span className="save-status__icon">
        <Icon icon={LoaderCircle} />
      </span>
      <span>
        Kayıt kaydedildi. Belgeler yükleniyor ({done}/{total})… Lütfen sayfadan ayrılmayın.
      </span>
    </div>
  );
}

/**
 * "İşlem kaydedildi; 1 belge yüklenemedi" (şartname 7.4, 9.7, 12): finansal kayıt ile belge
 * yüklemesi ayrı gösterilir; yalnız belge yeniden denenir, kayıt tekrar oluşturulmaz.
 */
export function UploadResultNotice({
  saved,
  queue,
  owner,
}: {
  /** Ör. "İşlem kaydedildi". */
  saved: string;
  queue: UploadQueue;
  owner: DocumentOwner;
}) {
  if (queue.items.length === 0) return null;
  const failed = queue.items.filter((item) => item.status === 'failed').length;
  return (
    <section
      className={failed > 0 ? 'alert alert--danger' : 'alert alert--success'}
      aria-label="Belge yükleme sonucu"
    >
      <p className="alert__title" role={failed > 0 ? 'alert' : 'status'}>
        {failed > 0
          ? `${saved}; ${failed} belge yüklenemedi.`
          : `${saved}; bütün belgeler yüklendi.`}
      </p>
      {failed > 0 ? (
        <p>
          Kayıt tamam; tekrar kaydetmeyin. Yüklenemeyen belgeyi aşağıdan yeniden deneyin veya daha
          sonra kaydın sayfasından ekleyin.
        </p>
      ) : null}
      <ul className="list-rows doc-list" aria-label="Belgeler">
        {queue.items.map((item) => (
          <UploadItemRow
            key={item.id}
            item={item}
            onRetry={() => void queue.retry(item.id, owner)}
          />
        ))}
      </ul>
    </section>
  );
}
