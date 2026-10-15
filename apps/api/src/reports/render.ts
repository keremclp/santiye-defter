// Rapor dosyası: biçime göre içerik, içerik türü ve dosya adı.

import type { ReportFormat } from '@santiye/shared';
import { renderCsv } from './csv.js';
import { displayDateTime, type ReportDocument } from './document.js';
import { renderPdf } from './pdf.js';
import { renderXlsx } from './xlsx.js';

const CONTENT_TYPES: Record<ReportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
};

export interface ReportFile {
  body: Buffer;
  contentType: string;
  fileName: string;
}

export async function renderReport(
  doc: ReportDocument,
  format: ReportFormat,
  generatedAt: string,
): Promise<ReportFile> {
  const body =
    format === 'csv'
      ? renderCsv(doc)
      : format === 'xlsx'
        ? await renderXlsx(doc, new Date(generatedAt))
        : await renderPdf(doc, { generatedAt: displayDateTime(generatedAt) });
  return { body, contentType: CONTENT_TYPES[format], fileName: `${doc.fileBase}.${format}` };
}
