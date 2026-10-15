// Excel (exceljs): "Özet" sayfasında başlık bilgileri ve özetler, her tablo kendi sayfasında.
// Tutarlar TL cinsinden sayı hücresidir; değer kuruşun ondalık metninden okunur (kayan nokta hesabı yok).

import { kurusToDecimalString } from '@santiye/shared';
import ExcelJS from 'exceljs';
import type { CellValue, Column, ReportDocument, TableSection } from './document.js';

const MONEY_FORMAT = '#,##0.00 "₺"';
const DATE_FORMAT = 'dd.mm.yyyy';

const money = (kurus: number) => Number(kurusToDecimalString(kurus));

function dateCell(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

function value(raw: CellValue, type: Column['type']): ExcelJS.CellValue {
  if (raw === null || raw === '') return null;
  if (type === 'money' && typeof raw === 'number') return money(raw);
  if (type === 'date' && typeof raw === 'string') return dateCell(raw);
  return raw;
}

/** Excel sayfa adı: en fazla 31 karakter, `[]:*?/\` yok, benzersiz. */
function sheetName(title: string, used: Set<string>): string {
  const clean = title.replace(/[[\]:*?/\\]/g, ' ').trim();
  let name = clean.slice(0, 31);
  for (let n = 2; used.has(name.toLocaleLowerCase('tr-TR')); n += 1) {
    const suffix = ` ${n}`;
    name = `${clean.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(name.toLocaleLowerCase('tr-TR'));
  return name;
}

function addTable(workbook: ExcelJS.Workbook, section: TableSection, name: string) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = section.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: Math.max(column.width, column.header.length + 2),
    style:
      column.type === 'money'
        ? { numFmt: MONEY_FORMAT }
        : column.type === 'date'
          ? { numFmt: DATE_FORMAT }
          : {},
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of section.rows) {
    sheet.addRow(
      Object.fromEntries(
        section.columns.map((column) => [
          column.key,
          value(row.cells[column.key] ?? null, column.type),
        ]),
      ),
    );
  }
  if (section.rows.length === 0) sheet.addRow([section.empty]);
  if (section.totals.length > 0) sheet.addRow([]);
  for (const total of section.totals) {
    const added = sheet.addRow(
      Object.fromEntries([
        [section.columns[0]!.key, total.label],
        ...Object.entries(total.values).map(([key, kurus]) => [key, money(kurus)]),
      ]),
    );
    added.font = { bold: true };
  }
  if (section.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: section.columns.length },
    };
  }
}

export async function renderXlsx(doc: ReportDocument, createdAt: Date): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Şantiye Hesap';
  workbook.created = createdAt;

  const used = new Set<string>();
  const summary = workbook.addWorksheet(sheetName('Özet', used));
  summary.columns = [{ width: 44 }, { width: 70 }];
  const title = summary.addRow([doc.title]);
  title.font = { bold: true, size: 14 };
  if (doc.subject) summary.addRow([doc.subject]).font = { bold: true, size: 12 };
  summary.addRow([]);
  for (const item of doc.meta) {
    const row = summary.addRow([item.label, item.value]);
    row.getCell(1).font = { bold: true };
  }
  if (doc.warning) {
    const row = summary.addRow(['Uyarı', doc.warning]);
    row.font = { bold: true };
  }

  for (const section of doc.sections) {
    if (section.kind === 'summary') {
      summary.addRow([]);
      summary.addRow([section.title]).font = { bold: true };
      for (const item of section.items) {
        const row = summary.addRow([item.label, money(item.value)]);
        row.getCell(2).numFmt = MONEY_FORMAT;
        row.getCell(2).alignment = { horizontal: 'left' };
      }
    }
  }
  for (const section of doc.sections) {
    if (section.kind === 'table') addTable(workbook, section, sheetName(section.title, used));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
