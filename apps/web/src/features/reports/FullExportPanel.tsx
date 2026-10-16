import { EXPORT_RETENTION_DAYS } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, Download } from 'lucide-react';
import { useState } from 'react';
import { apiGet, apiPost, errorMessage } from '../../api/client';
import { keys, useExports } from '../../api/queries';
import { newIdempotencyKey } from '../../api/submission';
import type { ExportJob } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { formatBytes, formatDateTime } from '../../lib/format';
import { toast } from '../../stores/ui';

/** İmzalı indirme adresini açar; dosya `attachment` olarak gelir, sayfa değişmez. */
function openDownload(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const isActive = (job: ExportJob | undefined) =>
  job?.status === 'queued' || job?.status === 'running';

function JobStatus({
  job,
  onDownload,
  downloading,
}: {
  job: ExportJob;
  onDownload: () => void;
  downloading: boolean;
}) {
  if (isActive(job)) {
    return (
      <div className="stack stack--sm" role="status">
        <p>
          {job.status === 'queued' ? 'Paket sırada…' : 'Paket hazırlanıyor…'}{' '}
          <strong>%{job.progress}</strong>
        </p>
        <progress value={job.progress} max={100} aria-label="Dışa aktarma ilerlemesi" />
        <p className="meta">Sayfadan ayrılabilirsiniz; paket hazır olunca burada indirilebilir.</p>
      </div>
    );
  }
  if (job.status === 'failed') {
    return (
      <div className="alert alert--danger" role="status">
        {job.error ?? 'Paket hazırlanamadı. Finansal kayıtlarınız etkilenmedi; yeniden deneyin.'}
      </div>
    );
  }
  if (job.expired) {
    return (
      <p className="meta">
        Son paket ({formatDateTime(job.finishedAt)}) {EXPORT_RETENTION_DAYS} gün dolduğu için
        silindi. Yeni paket hazırlayabilirsiniz.
      </p>
    );
  }
  return (
    <div className="alert alert--success stack stack--sm" role="status">
      <p>
        Paket hazır · {job.sizeBytes !== null ? formatBytes(job.sizeBytes) : ''} ·{' '}
        {formatDateTime(job.finishedAt)}
      </p>
      <p className="meta">
        {formatDateTime(job.expiresAt)} tarihine kadar indirilebilir; sonra silinir. Hazır paket
        belge alanında yer kaplar.
      </p>
      <div>
        <Button
          variant="secondary"
          onClick={onDownload}
          loading={downloading}
          loadingText="Adres alınıyor…"
        >
          <Icon icon={Download} />
          Paketi indir (.zip)
        </Button>
      </div>
    </div>
  );
}

/**
 * Tüm firma verisini dışa aktar (şartname 7.10): filtrelerden bağımsız; arka planda hazırlanır,
 * ilerleme gösterilir, hazır olunca indirilir. Görüntüleme döneminde de açıktır.
 */
export function FullExportPanel() {
  const queryClient = useQueryClient();
  const jobs = useExports();
  const latest = jobs.data?.[0];
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function start() {
    setStarting(true);
    try {
      await apiPost<ExportJob>('/exports/full', {}, { idempotencyKey: newIdempotencyKey() });
      await queryClient.invalidateQueries({ queryKey: keys.exports });
    } catch (error) {
      toast(`Dışa aktarma başlatılamadı. ${errorMessage(error)}`);
    } finally {
      setStarting(false);
    }
  }

  async function download(job: ExportJob) {
    setDownloading(true);
    try {
      const current = await apiGet<ExportJob>(`/exports/${job.id}`);
      if (current.download) openDownload(current.download.url);
      else {
        toast('Paket artık indirilemiyor. Yeni paket hazırlayın.');
        await queryClient.invalidateQueries({ queryKey: keys.exports });
      }
    } catch (error) {
      toast(`Paket indirilemedi. ${errorMessage(error)}`);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Panel title="Tüm firma verisi" icon={Archive}>
      <div className="panel__body stack stack--sm">
        <p>
          Hareketler, paylar, iadeler, anlaşmalar, başlangıç kayıtları, şantiyeler, kişiler,
          kategoriler ve değişiklik geçmişi Excel ve CSV olarak; orijinal belgeler eşleme tablosuyla
          birlikte tek zip paketinde. Silinen ama geri alınabilir kayıtlar durum etiketiyle yer
          alır. Filtrelerden bağımsızdır.
        </p>
        {latest ? (
          <JobStatus
            job={latest}
            onDownload={() => void download(latest)}
            downloading={downloading}
          />
        ) : null}
        <div>
          <Button
            variant="secondary"
            onClick={() => void start()}
            loading={starting}
            loadingText="Başlatılıyor…"
            disabled={isActive(latest)}
          >
            <Icon icon={Archive} />
            Tüm firma verisini dışa aktar
          </Button>
        </div>
      </div>
    </Panel>
  );
}
