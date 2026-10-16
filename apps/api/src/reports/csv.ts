// CSV: UTF-8 BOM'lu, Türkçe başlıklı, `;` ayraçlı (şartname 2). Excel'de Türkçe karakter bozulmaz.

import { kurusToDecimalString } from '@santiye/shared';
import type { CellValue, Column, ReportDocument, TableSection } from './document.js';

/** Kuruş → "12500,50" (Türkçe ondalık virgül, binlik ayraçsız). */
export function csvMoney(kurus: number): string {
  return kurusToDecimalString(kurus).replace('.', ',');
}

/** "2026-10-13" → "13.10.2026" */
export function csvDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

/** Excel'in UTF-8 olarak tanıması için bayt sırası işareti. */
const BOM = String.fromCharCode(0xfeff);

function cell(value: CellValue, type: Column['type'] | 'label'): string {
  if (value === null || value === '') return '';
  if (type === 'money' && typeof value === 'number') return csvMoney(value);
  if (type === 'date' && typeof value === 'string') return csvDate(value);
  return String(value);
}

function escape(text: string): string {
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Tek tablo: başlık satırı ve veri satırları (tam veri çıkışındaki her CSV dosyası). */
export function renderCsvTable(section: TableSection): Buffer {
  const lines = [
    section.columns.map((column) => column.header),
    ...section.rows.map((row) =>
      section.columns.map((column) => cell(row.cells[column.key] ?? null, column.type)),
    ),
  ];
  const text = lines.map((line) => line.map(escape).join(';')).join('\r\n');
  return Buffer.from(`${BOM}${text}\r\n`, 'utf8');
}

export function renderCsv(doc: ReportDocument): Buffer {
  const lines: string[][] = [];
  lines.push([doc.subject ? `${doc.title} — ${doc.subject}` : doc.title]);
  for (const item of doc.meta) lines.push([item.label, item.value]);
  if (doc.warning) lines.push(['Uyarı', doc.warning]);

  for (const section of doc.sections) {
    lines.push([]);
    lines.push([section.title]);
    if (section.kind === 'summary') {
      for (const item of section.items) lines.push([item.label, csvMoney(item.value)]);
      continue;
    }
    lines.push(section.columns.map((column) => column.header));
    if (section.rows.length === 0) lines.push([section.empty]);
    for (const row of section.rows) {
      lines.push(section.columns.map((column) => cell(row.cells[column.key] ?? null, column.type)));
    }
    for (const total of section.totals) {
      lines.push(
        section.columns.map((column, index) => {
          const value = total.values[column.key];
          if (value !== undefined) return csvMoney(value);
          return index === 0 ? total.label : '';
        }),
      );
    }
  }

  const text = lines.map((line) => line.map(escape).join(';')).join('\r\n');
  return Buffer.from(`${BOM}${text}\r\n`, 'utf8');
}
