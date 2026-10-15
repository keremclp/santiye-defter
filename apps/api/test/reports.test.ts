// Standart raporlar ve filtreli dışa aktarma (şartname 7.10, 9.1, 10.9): dosyadaki toplamlar ekran ve
// API ile aynı; paylaştırılmış hareket şantiye raporunda payıyla, firma raporunda bir kez; başlangıç
// kayıtları etiketli; görüntüleme dönemindeki firma rapor alır; PDF'de Türkçe karakterler gömülü.

import { addDays, TRACKING_START_WARNING } from '@santiye/shared';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { businessToday } from '../src/lib/clock.js';
import { CompanyModel } from '../src/models/company.js';
import type { ReportDocument } from '../src/reports/document.js';
import { renderPdf } from '../src/reports/pdf.js';
import { buildTestApp, createTestClock, useTestDatabase } from './helpers/app.js';
import { createCustomer } from './helpers/factories.js';
import { Api, financeSetup, tl } from './helpers/finance.js';

useTestDatabase();

function setup() {
  return buildTestApp({ clock: createTestClock(new Date('2026-03-20T09:00:00Z')) });
}

/** İkili cevabı Buffer olarak alır. */
function download(api: Api, path: string, query: Record<string, unknown> = {}) {
  return request(api.testApp.app)
    .get(path)
    .query(query)
    .set('Authorization', `Bearer ${api.accessToken}`)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
    });
}

async function file(api: Api, path: string, query: Record<string, unknown> = {}) {
  const res = await download(api, path, query);
  expect(res.status, res.body.toString('utf8').slice(0, 300)).toBe(200);
  return res;
}

/** `;` ayraçlı, tırnaklı alanları destekleyen küçük CSV ayrıştırıcı. */
function parseCsv(buffer: Buffer): string[][] {
  const text = buffer.toString('utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 1; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ';') {
      row.push(cell);
      cell = '';
    } else if (char === '\r') continue;
    else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  return rows;
}

/** "12500,50" → 1250050 kuruş */
const csvKurus = (text: string) => {
  const negative = text.startsWith('-');
  const [lira = '0', kurus = '00'] = text.replace('-', '').split(',');
  const value = Number(lira) * 100 + Number(kurus.padEnd(2, '0'));
  return negative ? -value : value;
};

/** CSV'de başlığı verilen tablo: sütun başlıkları, veri satırları ve toplam satırları. */
function csvTable(rows: string[][], title: string) {
  const start = rows.findIndex((row) => row[0] === title);
  expect(start, `tablo bulunamadı: ${title}`).toBeGreaterThanOrEqual(0);
  const header = rows[start + 1]!;
  const body: string[][] = [];
  for (let i = start + 2; i < rows.length && rows[i]!.some((cell) => cell !== ''); i += 1) {
    body.push(rows[i]!);
  }
  const data = body.filter((row) => /^\d+$/.test(row[0]!));
  const totals = new Map(
    body.filter((row) => !/^\d+$/.test(row[0]!)).map((row) => [row[0]!, row] as const),
  );
  const column = (name: string) => {
    const index = header.indexOf(name);
    expect(index, `sütun yok: ${name}`).toBeGreaterThanOrEqual(0);
    return index;
  };
  return { header, data, totals, column };
}

/** Excel tablosu sayfasındaki toplam satırının tutarı (kuruş). */
function xlsxTotal(sheet: ExcelJS.Worksheet, label: string, header: string): number {
  const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).map((value) =>
    typeof value === 'string' ? value : '',
  );
  const column = headers.indexOf(header);
  expect(column, `sütun yok: ${header}`).toBeGreaterThan(0);
  let found: number | null = null;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === label) found = Math.round(Number(row.getCell(column).value) * 100);
  });
  expect(found, `toplam satırı yok: ${label}`).not.toBeNull();
  return found!;
}

async function loadXlsx(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

/**
 * Örnek firma (şartname 9.1 örneği dahil): ocakta 40.000 TL anlaşma ödemesi, şubatta 10.000 TL
 * iadesi; iki şantiyeye paylaştırılmış 40.000 TL gider (25.000 + 15.000); şantiye geliri; firma
 * geneli gider; silinmiş gider; firma geneli başlangıç alacağı.
 */
async function seed(api: Api) {
  const villa = await api.createProject('Kadıköy Villa');
  const office = await api.createProject('Şişli Ofis');
  const electric = await api.createParty('Yılmaz Elektrik');
  const customer = await api.createParty('Çağlar İnşaat');
  const material = await api.ok(api.post('/categories', { name: 'Malzeme' }), 201);

  const agreement = await api.createAgreement({
    title: 'Elektrik tesisatı',
    scope: 'project',
    projectId: villa.id,
    partyId: electric.id,
    initialAmount: tl(100_000),
    dueDate: '2026-03-01',
  });
  const opening = await api.ok(
    api.post('/agreements', {
      kind: 'opening',
      direction: 'receivable',
      scope: 'company',
      partyId: customer.id,
      initialAmount: tl(50_000),
      trackingStartDate: '2026-01-01',
    }),
    201,
  );
  const payment = await api.pay(agreement, tl(40_000), { date: '2026-01-15' });
  await api.ok(
    api.post(`/transactions/${payment.id}/refunds`, {
      amount: tl(10_000),
      date: '2026-02-20',
      reason: 'Fazla ödeme geri alındı',
      parts: [{ allocationId: payment.allocations[0].id, amount: tl(10_000) }],
    }),
    201,
  );
  const split = await api.ok(
    api.post('/transactions', {
      kind: 'expense',
      amount: tl(40_000),
      date: '2026-02-10',
      partyId: electric.id,
      categoryId: material.id,
      description: 'Kablo ve şalter',
      allocations: [
        { scope: 'project', projectId: villa.id, amount: tl(25_000) },
        { scope: 'project', projectId: office.id, amount: tl(15_000) },
      ],
    }),
    201,
  );
  await api.ok(
    api.record({
      kind: 'income',
      amount: tl(60_000),
      date: '2026-02-01',
      project: villa,
      party: customer,
    }),
    201,
  );
  await api.ok(api.record({ kind: 'expense', amount: tl(5_000), date: '2026-03-05' }), 201);
  const removed = await api.ok(
    api.record({ kind: 'expense', amount: tl(7_000), date: '2026-02-12', project: villa }),
    201,
  );
  await api.ok(
    api.delete(`/transactions/${removed.id}`, {
      reason: 'Yanlış kayıt',
      expectedUpdatedAt: removed.updatedAt,
    }),
  );
  return { villa, office, electric, customer, material, agreement, opening, payment, split };
}

describe('dönem dökümü', () => {
  it('iade kendi tarihinin dönemine yazılır: ocak 40.000, şubat −10.000, toplam 30.000 (9.1)', async () => {
    const { api } = await financeSetup(setup());
    const { villa } = await seed(api);
    const scope = { projectId: villa.id };

    const january = await api.ok(
      api.get('/reports/period', { ...scope, dateFrom: '2026-01-01', dateTo: '2026-01-31' }),
    );
    const february = await api.ok(
      api.get('/reports/period', { ...scope, dateFrom: '2026-02-01', dateTo: '2026-02-28' }),
    );
    // Şubatta yalnız iade ve bu şantiyenin 25.000 TL payı (silinen 7.000 TL sayılmaz).
    expect(january.totals.netExpense).toBe(tl(40_000));
    expect(february.totals).toMatchObject({
      expense: tl(25_000),
      expenseRefund: tl(10_000),
      netExpense: tl(15_000),
      netIncome: tl(60_000),
    });
    const both = await api.ok(
      api.get('/reports/period', { ...scope, dateFrom: '2026-01-01', dateTo: '2026-02-28' }),
    );
    expect(both.totals.netExpense).toBe(january.totals.netExpense + february.totals.netExpense);
  });

  it('API, ekran listesi, Excel ve CSV toplamları aynı satırlardan; kategori özeti ve güncel kalan', async () => {
    const { api } = await financeSetup(setup());
    await seed(api);
    const range = { dateFrom: '2026-01-01', dateTo: '2026-03-31' };

    const report = await api.ok(api.get('/reports/period', range));
    const listTotals = await api.totals(range);
    expect(report.totals).toEqual(listTotals);
    // Firma raporunda paylaştırılmış 40.000 TL bir kez, silinen 7.000 TL hiç sayılmaz.
    expect(report.totals).toMatchObject({
      income: tl(60_000),
      expense: tl(40_000 + 40_000 + 5_000),
      expenseRefund: tl(10_000),
      netExpense: tl(75_000),
      difference: tl(60_000 - 75_000),
    });
    expect(report.rows).toHaveLength(5);
    expect(report.rows.filter((row: { isSplit: boolean }) => row.isSplit)).toHaveLength(1);
    expect(report.categories).toEqual(
      expect.arrayContaining([
        { category: 'Malzeme', expense: tl(40_000), expenseRefund: 0, netExpense: tl(40_000) },
        {
          category: 'Kategorisiz',
          expense: tl(45_000),
          expenseRefund: tl(10_000),
          netExpense: tl(35_000),
        },
      ]),
    );
    expect(report.obligations.payable.remaining).toBe(tl(70_000));
    expect(report.obligations.openings.receivable.remaining).toBe(tl(50_000));
    expect(report.header).toMatchObject({
      dateFrom: '2026-01-01',
      dateTo: '2026-03-31',
      trackingStart: '2026-01-01',
      scoped: false,
    });

    const csv = parseCsv((await file(api, '/reports/period/export.csv', range)).body);
    const table = csvTable(csv, 'Hareketler (tarihe göre artan)');
    expect(table.data).toHaveLength(5);
    const sumOf = (kind: string) =>
      table.data
        .filter((row) => row[table.column('Tür')]!.startsWith(kind))
        .reduce((sum, row) => sum + csvKurus(row[table.column('Toplam tutar')]!), 0);
    expect(sumOf('Gider')).toBe(report.totals.expense);
    expect(sumOf('Ödeme iadesi')).toBe(report.totals.expenseRefund);
    expect(csvKurus(table.totals.get('Net ödeme')![table.column('Toplam tutar')]!)).toBe(
      report.totals.netExpense,
    );
    expect(csvKurus(table.totals.get('Gelir − gider farkı')![table.column('Toplam tutar')]!)).toBe(
      report.totals.difference,
    );
    const categories = csvTable(csv, 'Kategori özeti (giderler)');
    expect(csvKurus(categories.totals.get('Toplam')![categories.column('Net ödeme')]!)).toBe(
      report.totals.netExpense,
    );
    expect(csv.find((row) => row[0] === 'Uyarı')?.[1]).toBe(TRACKING_START_WARNING);

    const workbook = await loadXlsx((await file(api, '/reports/period/export.xlsx', range)).body);
    const sheet = workbook.worksheets.find((ws) => ws.name.startsWith('Hareketler'))!;
    expect(xlsxTotal(sheet, 'Net tahsilat', 'Toplam tutar')).toBe(report.totals.netIncome);
    expect(xlsxTotal(sheet, 'Net ödeme', 'Toplam tutar')).toBe(report.totals.netExpense);
    expect(xlsxTotal(sheet, 'Gelir − gider farkı', 'Toplam tutar')).toBe(report.totals.difference);
    const summary = workbook.getWorksheet('Özet')!;
    const metaValue = (label: string) => {
      let value: unknown;
      summary.eachRow((row) => {
        if (row.getCell(1).value === label) value = row.getCell(2).value;
      });
      return value;
    };
    expect(metaValue('Firma')).toMatch(/^Örnek Firma/);
    expect(metaValue('İşlem tarihi aralığı')).toBe('1 Oca 2026 – 31 Mar 2026');
    expect(metaValue('Takip başlangıcı')).toBe('1 Oca 2026');
    expect(metaValue('Üretim tarihi/saati')).toBe('20 Mar 2026 12:00');
  });

  it('kategori filtresi yalnız o kategorinin giderlerini ve iadelerini alır', async () => {
    const { api } = await financeSetup(setup());
    const { material } = await seed(api);
    const report = await api.ok(api.get('/reports/period', { categoryId: material.id }));
    expect(report.rows).toHaveLength(1);
    expect(report.totals.netExpense).toBe(tl(40_000));
    expect(report.header.filters).toEqual(['Kategori: Malzeme']);
    const uncategorized = await api.ok(api.get('/reports/period', { uncategorized: 'true' }));
    expect(uncategorized.totals.netExpense).toBe(tl(35_000));
  });

  it('ters tarih aralığı reddedilir', async () => {
    const { api } = await financeSetup(setup());
    const res = await api.get('/reports/period', { dateFrom: '2026-03-01', dateTo: '2026-02-01' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });
});

describe('şantiye raporu', () => {
  it('paylaştırılmış hareket şantiye raporunda yalnız payıyla, firma raporunda bir kez sayılır', async () => {
    const { api } = await financeSetup(setup());
    const { villa, office, split } = await seed(api);

    const villaReport = await api.ok(api.get(`/reports/projects/${villa.id}/summary`));
    const officeReport = await api.ok(api.get(`/reports/projects/${office.id}/summary`));
    const splitIn = (report: { expenseRows: { id: string; amount: number; share: number }[] }) =>
      report.expenseRows.find((row) => row.id === split.id);
    expect(splitIn(villaReport)).toMatchObject({ amount: tl(40_000), share: tl(25_000) });
    expect(splitIn(officeReport)).toMatchObject({ amount: tl(40_000), share: tl(15_000) });
    expect(villaReport.cash).toMatchObject({
      expense: tl(40_000 + 25_000),
      expenseRefund: tl(10_000),
      netExpense: tl(55_000),
      netIncome: tl(60_000),
    });
    expect(officeReport.cash.netExpense).toBe(tl(15_000));

    // Şantiye detayındaki özetle aynı; firma raporunda ana tutar bir kez.
    const detail = await api.ok(api.get(`/projects/${villa.id}/summary`));
    expect(villaReport.cash).toEqual(detail.cash);
    expect(villaReport.payable).toEqual(detail.payable);
    const company = await api.ok(api.get('/reports/period'));
    expect(company.rows.filter((row: { id: string }) => row.id === split.id)).toHaveLength(1);
    expect(company.totals.expense).toBe(tl(85_000));

    // Gelir ve gider listeleri tarihe göre artan.
    expect(villaReport.expenseRows.map((row: { date: string }) => row.date)).toEqual([
      '2026-01-15',
      '2026-02-10',
      '2026-02-20',
    ]);
    expect(villaReport.incomeRows).toHaveLength(1);

    // Dosyada toplamlar paydan: ana tutar sütunu ayrı, toplam satırı pay sütununda.
    const csv = parseCsv((await file(api, '/reports/project/export.csv', { id: villa.id })).body);
    const expenses = csvTable(csv, 'Giderler (tarihe göre artan)');
    const splitRow = expenses.data.find((row) => row[0] === String(split.recordNo))!;
    expect(csvKurus(splitRow[expenses.column('Toplam tutar')]!)).toBe(tl(40_000));
    expect(csvKurus(splitRow[expenses.column('Kapsama düşen pay')]!)).toBe(tl(25_000));
    expect(csvKurus(expenses.totals.get('Net ödeme')![expenses.column('Kapsama düşen pay')]!)).toBe(
      villaReport.cash.netExpense,
    );
    expect(splitRow[expenses.column('Paylar')]).toBe(
      'Kadıköy Villa: 25.000 TL; Şişli Ofis: 15.000 TL',
    );

    const workbook = await loadXlsx(
      (await file(api, '/reports/project/export.xlsx', { id: villa.id })).body,
    );
    const income = workbook.worksheets.find((ws) => ws.name.startsWith('Gelirler'))!;
    expect(xlsxTotal(income, 'Net tahsilat', 'Kapsama düşen pay')).toBe(villaReport.cash.netIncome);
  });

  it('başka şantiyenin olmayan kimliği 404', async () => {
    const { api } = await financeSetup(setup());
    const res = await api.get('/reports/projects/64b7f0000000000000000000/summary');
    expect(res.status).toBe(404);
  });
});

describe('kişi/firma hesap dökümü', () => {
  it('borç, alacak, fazla ve doğrudan hareketler ayrı; başlangıç kaydı etiketli', async () => {
    const { api } = await financeSetup(setup());
    const { electric, customer, payment, split } = await seed(api);

    const statement = await api.ok(api.get(`/reports/parties/${electric.id}/statement`));
    expect(statement.payable).toMatchObject({
      totalAmount: tl(100_000),
      netSettled: tl(30_000),
      remaining: tl(70_000),
      overdue: tl(70_000),
    });
    expect(statement.receivable.remaining).toBe(0);
    expect(statement.linkedRows.map((row: { id: string }) => row.id)).toContain(payment.id);
    expect(statement.directRows.map((row: { id: string }) => row.id)).toEqual([split.id]);
    expect(statement.directTotals.netExpense).toBe(tl(40_000));
    expect(statement.linkedTotals.netExpense).toBe(tl(30_000));
    expect(statement.header.trackingStart).toBeNull();

    const party = await api.ok(api.get(`/parties/${electric.id}`));
    expect(statement.directTotals).toEqual(party.finance.directTransactions);

    const csv = parseCsv((await file(api, '/reports/party/export.csv', { id: electric.id })).body);
    expect(csv.find((row) => row[0] === 'Takip başlangıcı')?.[1]).toBe('Başlangıç kaydı yok');
    expect(csv.some((row) => row[0] === 'Uyarı')).toBe(false);

    const other = await api.ok(api.get(`/reports/parties/${customer.id}/statement`));
    expect(other.header.trackingStart).toBe('2026-01-01');
    expect(other.agreements).toEqual([
      expect.objectContaining({
        kind: 'opening',
        label: 'Başlangıç alacağı',
        remaining: tl(50_000),
      }),
    ]);
    expect(other.openings.receivable.remaining).toBe(tl(50_000));
    const otherCsv = parseCsv(
      (await file(api, '/reports/party/export.csv', { id: customer.id })).body,
    );
    const agreements = csvTable(otherCsv, 'Anlaşmalar ve başlangıç kayıtları');
    expect(agreements.data).toHaveLength(0);
    const rows = otherCsv.slice(otherCsv.findIndex((row) => row[0] === 'Tür'));
    expect(rows.some((row) => row[0] === 'Başlangıç kaydı' && row[1] === 'Başlangıç alacağı')).toBe(
      true,
    );
    expect(otherCsv.find((row) => row[0] === 'Uyarı')?.[1]).toBe(TRACKING_START_WARNING);
  });
});

describe('açık borç/alacak ve vade listesi', () => {
  it('başlangıç kayıtları dahil ve etiketli; vade gruplarına ayrılır', async () => {
    const { api } = await financeSetup(setup());
    const { agreement, opening } = await seed(api);
    const report = await api.ok(api.get('/reports/open-balances'));
    const group = (state: string) =>
      report.groups.find((g: { state: string }) => g.state === state).rows;
    expect(group('overdue').map((row: { id: string }) => row.id)).toEqual([agreement.id]);
    expect(group('overdue')[0]).toMatchObject({ overdueDays: 19, remaining: tl(70_000) });
    expect(group('none')).toEqual([
      expect.objectContaining({ id: opening.id, kind: 'opening', label: 'Başlangıç alacağı' }),
    ]);
    expect(report.summary.payable).toMatchObject({ remaining: tl(70_000), overdue: tl(70_000) });
    expect(report.summary.openings.receivable.remaining).toBe(tl(50_000));
    expect(report.header.trackingStart).toBe('2026-01-01');

    const payableOnly = await api.ok(api.get('/reports/open-balances', { direction: 'payable' }));
    expect(payableOnly.summary.receivable.remaining).toBe(0);
    expect(payableOnly.header.trackingStart).toBeNull();

    const csv = parseCsv((await file(api, '/reports/open-balances/export.csv')).body);
    const none = csvTable(csv, 'Vadesi belirlenmemiş');
    expect(none.data).toHaveLength(0);
    const overdue = csv.findIndex((row) => row[0] === 'Gecikmiş');
    expect(csv[overdue + 2]?.slice(0, 3)).toEqual(['Anlaşma', 'Elektrik tesisatı', 'Ödenecek']);
    expect(csv.some((row) => row[0] === 'Başlangıç kaydı' && row[1] === 'Başlangıç alacağı')).toBe(
      true,
    );
  });
});

describe('Bu sonuçları indir', () => {
  it('bütün filtrelenmiş sonuçlar; ana işlem no, toplam tutar ve pay ayrı; toplamlar listeyle aynı', async () => {
    const { api } = await financeSetup(setup());
    const { villa, split } = await seed(api);
    const filters = { projectId: villa.id, kind: 'all', sort: 'oldest' };
    const list = await api.ok(api.get('/transactions', { ...filters, limit: 2 }));
    expect(list.total).toBe(4);

    const csv = parseCsv((await file(api, '/reports/transactions/export.csv', filters)).body);
    const table = csvTable(csv, 'İşlemler');
    expect(table.data).toHaveLength(list.total);
    const splitRow = table.data.find((row) => row[0] === String(split.recordNo))!;
    expect(csvKurus(splitRow[table.column('Toplam tutar')]!)).toBe(tl(40_000));
    expect(csvKurus(splitRow[table.column('Kapsama düşen pay')]!)).toBe(tl(25_000));
    for (const [label, key] of [
      ['Net tahsilat', 'netIncome'],
      ['Net ödeme', 'netExpense'],
      ['Gelir − gider farkı', 'difference'],
    ] as const) {
      expect(csvKurus(table.totals.get(label)![table.column('Kapsama düşen pay')]!)).toBe(
        list.totals[key],
      );
    }
    const refund = table.data.find((row) => row[table.column('Tür')] === 'Ödeme iadesi')!;
    expect(refund[table.column('Kaynak işlem no')]).not.toBe('');
    expect(csv.find((row) => row[0] === 'Kapsam')?.[1]).toBe('Şantiye: Kadıköy Villa');

    const workbook = await loadXlsx(
      (await file(api, '/reports/transactions/export.xlsx', filters)).body,
    );
    const sheet = workbook.getWorksheet('İşlemler')!;
    expect(xlsxTotal(sheet, 'Net ödeme', 'Kapsama düşen pay')).toBe(list.totals.netExpense);
    expect(sheet.rowCount).toBeGreaterThan(list.total);
  });

  it('silinenler istenirse "Silindi" durumuyla gelir ama toplamlara katılmaz', async () => {
    const { api } = await financeSetup(setup());
    await seed(api);
    const filters = { includeDeleted: 'true' };
    const list = await api.ok(api.get('/transactions', filters));
    const csv = parseCsv((await file(api, '/reports/transactions/export.csv', filters)).body);
    const table = csvTable(csv, 'İşlemler');
    expect(table.data).toHaveLength(list.total);
    expect(table.data.filter((row) => row[table.column('Durum')] === 'Silindi')).toHaveLength(1);
    expect(csvKurus(table.totals.get('Net ödeme')![table.column('Toplam tutar')]!)).toBe(
      list.totals.netExpense,
    );
  });
});

describe('dosya ucu', () => {
  it('içerik türü ve dosya adı; bilinmeyen tür veya biçim reddedilir', async () => {
    const { api } = await financeSetup(setup());
    const { villa } = await seed(api);

    const pdf = await file(api, '/reports/project/export.pdf', { id: villa.id });
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toBe(
      'attachment; filename="santiye-raporu-kadikoy-villa-2026-03-20.pdf"',
    );
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');

    const xlsx = await file(api, '/reports/open-balances/export.xlsx');
    expect(xlsx.headers['content-type']).toContain('spreadsheetml');
    const csv = await file(api, '/reports/period/export.csv');
    expect(csv.headers['content-type']).toBe('text/csv; charset=utf-8');

    expect((await download(api, '/reports/unknown/export.csv')).status).toBe(400);
    expect((await download(api, '/reports/period/export.docx')).status).toBe(400);
    expect((await download(api, '/reports/party/export.pdf', { id: 'yok' })).status).toBe(404);
  });

  it('PDF Türkçe karakterleri gömülü yazı tipiyle yazar (ş, ğ, ı, İ, ö, ü, ç)', async () => {
    const doc: ReportDocument = {
      title: 'Şantiye özeti ve hareket dökümü',
      subject: 'İstanbul Çağlayan Şişli Öğretmenler Sitesi',
      fileBase: 'deneme',
      meta: [{ label: 'Kapsam', value: 'ş ğ ı İ ö ü ç Ş Ğ Ö Ü Ç' }],
      warning: TRACKING_START_WARNING,
      sections: [
        {
          kind: 'table',
          title: 'Giderler',
          columns: [
            { key: 'party', header: 'Kişi/firma', type: 'text', width: 20 },
            { key: 'amount', header: 'Tutar', type: 'money', width: 10 },
          ],
          rows: [{ cells: { party: 'Işık Güneş Çelik', amount: tl(1_250) }, tone: 'expense' }],
          totals: [{ label: 'Net ödeme', values: { amount: tl(1_250) } }],
          empty: '',
        },
      ],
    };
    const pdf = await renderPdf(doc, { generatedAt: '20 Mar 2026 12:00', compress: false });
    const text = pdf.toString('latin1');
    // Standart PDF yazı tipleri (Helvetica vb.) Türkçe harfleri taşımaz; gömülü DM Sans kullanılır.
    expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+DMSans-Regular/);
    expect(text).toMatch(/\/FontFile2/);
    expect(text).not.toMatch(/\/BaseFont \/Helvetica/);
    // Metin seçilip kopyalandığında doğru harfler çıksın: ToUnicode eşlemesinde hepsi var.
    const cmaps = [...text.matchAll(/begincmap[\s\S]*?endcmap/g)].join('\n').toLowerCase();
    for (const char of 'şğıİöüçŞĞÖÜÇ₺') {
      const hex = char.codePointAt(0)!.toString(16).padStart(4, '0');
      expect(cmaps, `${char} (${hex})`).toContain(hex);
    }
  });
});

describe('erişim', () => {
  it('görüntüleme dönemindeki firma rapor görür ve indirir; kayıt değiştiremez', async () => {
    const testApp = setup();
    const { company, api } = await financeSetup(testApp);
    const { villa, electric } = await seed(api);
    const serviceEndedAt = addDays(businessToday(testApp.clock), -5);
    await CompanyModel.updateOne(
      { _id: company._id },
      {
        $set: {
          serviceEndedAt,
          viewUntil: addDays(serviceEndedAt, 30),
          retainUntil: addDays(serviceEndedAt, 180),
        },
      },
    );

    await api.ok(api.get('/reports/period'));
    await api.ok(api.get('/reports/open-balances'));
    await api.ok(api.get(`/reports/projects/${villa.id}/summary`));
    await api.ok(api.get(`/reports/parties/${electric.id}/statement`));
    await file(api, '/reports/period/export.xlsx');
    await file(api, '/reports/project/export.pdf', { id: villa.id });
    await file(api, '/reports/transactions/export.csv', { projectId: villa.id });

    const write = await api.record({ kind: 'expense', amount: tl(1_000) });
    expect(write.status).toBe(403);
    expect(write.body.code).toBe('READ_ONLY');
  });

  it('firma geneli raporlar ve dosyalar başka firmanın kaydını içermez', async () => {
    const testApp = setup();
    const owner = await financeSetup(testApp);
    await seed(owner.api);
    const intruder = await createCustomer(testApp);
    const api = new Api(testApp, intruder.accessToken);

    const period = await api.ok(api.get('/reports/period'));
    expect(period.rows).toEqual([]);
    expect(period.totals.expense).toBe(0);
    const open = await api.ok(api.get('/reports/open-balances'));
    expect(open.groups.flatMap((g: { rows: unknown[] }) => g.rows)).toEqual([]);
    for (const path of [
      '/reports/period/export.csv',
      '/reports/open-balances/export.csv',
      '/reports/transactions/export.csv',
    ]) {
      const body = (await file(api, path)).body.toString('utf8');
      expect(body).not.toContain('Yılmaz Elektrik');
      expect(body).not.toContain('Kadıköy Villa');
    }
  });
});
