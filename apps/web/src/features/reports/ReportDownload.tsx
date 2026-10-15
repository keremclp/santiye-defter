import { REPORT_FORMATS, type ReportExportType, type ReportFormat } from '@santiye/shared';
import { Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react';
import { useState } from 'react';
import { apiDownload, errorMessage } from '../../api/client';
import { Icon } from '../../components/ui/Icon';
import { Menu } from '../../components/ui/Menu';
import { toast } from '../../stores/ui';

const FORMAT_LABEL: Record<ReportFormat, { label: string; hint: string; icon: typeof Sheet }> = {
  xlsx: { label: 'Excel', hint: 'Ayrıntılı tablolar (.xlsx)', icon: FileSpreadsheet },
  csv: { label: 'CSV', hint: 'Türkçe karakterli, ; ayraçlı (.csv)', icon: Sheet },
  pdf: { label: 'PDF', hint: 'Okunabilir özet ve döküm (.pdf)', icon: FileText },
};

/** Tarayıcıya dosyayı indirtir; sayfa değişmez. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Rapor indirme menüsü (şartname 7.10): ekrandaki raporla aynı filtrelerle Excel, CSV veya PDF.
 * Dosya o anki veriden üretilir; indirilen dosya sonradan kendiliğinden güncellenmez.
 */
export function ReportDownload({
  type,
  params,
  label = 'İndir',
  disabled = false,
}: {
  type: ReportExportType;
  params: Record<string, unknown>;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<ReportFormat | null>(null);

  async function download(format: ReportFormat) {
    setBusy(format);
    try {
      const { blob, fileName } = await apiDownload(`/reports/${type}/export.${format}`, params);
      saveBlob(blob, fileName ?? `rapor.${format}`);
    } catch (error) {
      toast(`Dosya hazırlanamadı. ${errorMessage(error)}`);
    } finally {
      setBusy(null);
    }
  }

  if (disabled || busy) {
    return (
      <button type="button" className="btn btn--secondary" disabled aria-busy={Boolean(busy)}>
        <Icon icon={Download} />
        {busy ? `${FORMAT_LABEL[busy].label} hazırlanıyor…` : label}
      </button>
    );
  }

  return (
    <Menu
      label={label}
      buttonClassName="btn btn--secondary"
      buttonContent={
        <>
          <Icon icon={Download} />
          {label}
        </>
      }
    >
      {(close) =>
        REPORT_FORMATS.map((format) => (
          <button
            key={format}
            type="button"
            className="dropdown__item"
            role="menuitem"
            onClick={() => {
              close();
              void download(format);
            }}
          >
            <Icon icon={FORMAT_LABEL[format].icon} />
            <span>
              {FORMAT_LABEL[format].label}
              <small>{FORMAT_LABEL[format].hint}</small>
            </span>
          </button>
        ))
      }
    </Menu>
  );
}
