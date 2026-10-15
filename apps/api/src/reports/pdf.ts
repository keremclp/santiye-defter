// PDF (PDFKit): okunabilir özet ve döküm. Türkçe karakterler için DM Sans ve Outfit gömülür
// (şartname 2, 4.2); renkler şartname 4.1 token'larıdır. Yatay A4; uzun tablolar sayfalara bölünür
// ve başlık satırı her sayfada tekrarlanır.

import { fileURLToPath } from 'node:url';
import { formatMoney } from '@santiye/shared';
import PDFDocument from 'pdfkit';
import {
  displayDate,
  type CellValue,
  type Column,
  type ReportDocument,
  type SummarySection,
  type TableSection,
  type Tone,
} from './document.js';

const FONT_DIR = fileURLToPath(new URL('../../assets/fonts/', import.meta.url));
const FONTS = {
  body: 'DMSans-Regular.ttf',
  bold: 'DMSans-Bold.ttf',
  title: 'Outfit-SemiBold.ttf',
} as const;

// Şartname 4.1 renk token'ları (apps/web/src/styles/tokens.css ile aynı değerler).
const COLOR = {
  ink: '#1b1838',
  ink2: '#4a4668',
  muted: '#7a76a8',
  border: '#e7e4f0',
  borderSoft: '#f0eef5',
  surface: '#f7f6fa',
  income: '#166534',
  expense: '#dc2626',
  warn: '#b45309',
} as const;

/**
 * Bitişik harf (fi, fl) kapalı: PDF'den kopyalanan metin "firma" yerine "frma" çıkmasın.
 * fontkit nesne biçimini kabul eder; tip tanımı yalnız dizi bildirdiği için dönüştürülür.
 */
const PLAIN_TEXT = {
  features: { liga: false, clig: false } as unknown as NonNullable<
    PDFKit.Mixins.TextOptions['features']
  >,
};

const MARGIN = 36;
const FOOTER = 20;
const ROW = 15;
const HEAD_ROW = 18;
const CELL_PAD = 4;

/** Bakiye ve fark: negatifse "−" önekli (şartname 4.1). */
function signedMoney(kurus: number): string {
  return kurus < 0 ? `−${formatMoney(-kurus)}` : formatMoney(kurus);
}

const toneColor = (tone: Tone | undefined) => (tone ? COLOR[tone] : COLOR.ink);

function cellText(value: CellValue, type: Column['type']): string {
  if (value === null || value === '') return '';
  if (type === 'money' && typeof value === 'number') return signedMoney(value);
  if (type === 'date' && typeof value === 'string') return displayDate(value);
  return String(value);
}

class Writer {
  private y = MARGIN;

  constructor(private readonly pdf: PDFKit.PDFDocument) {}

  private get left() {
    return MARGIN;
  }

  private get width() {
    return this.pdf.page.width - MARGIN * 2;
  }

  private get bottom() {
    return this.pdf.page.height - MARGIN - FOOTER;
  }

  /** Yer yoksa yeni sayfa; yeni sayfa açıldıysa true. */
  private ensure(height: number): boolean {
    if (this.y + height <= this.bottom) return false;
    this.pdf.addPage();
    this.y = MARGIN;
    return true;
  }

  /** Tek satıra sığmayan metin üç noktayla kısalır. */
  private line(
    text: string,
    x: number,
    y: number,
    width: number,
    options: { align?: 'left' | 'right'; size: number },
  ) {
    this.pdf.text(text, x, y, {
      ...PLAIN_TEXT,
      width,
      height: options.size * 1.35,
      ellipsis: true,
      align: options.align ?? 'left',
      lineGap: 0,
    });
  }

  write(doc: ReportDocument) {
    const { pdf } = this;
    pdf.font('title').fontSize(18).fillColor(COLOR.ink);
    pdf.text(doc.title, this.left, this.y, { ...PLAIN_TEXT, width: this.width });
    this.y = pdf.y + 2;
    if (doc.subject) {
      pdf.font('title').fontSize(13).fillColor(COLOR.ink2);
      pdf.text(doc.subject, this.left, this.y, { ...PLAIN_TEXT, width: this.width });
      this.y = pdf.y + 2;
    }
    this.y += 8;
    this.meta(doc.meta);
    if (doc.warning) this.warning(doc.warning);
    for (const section of doc.sections) {
      if (section.kind === 'summary') this.summary(section);
      else this.table(section);
    }
  }

  private meta(items: ReportDocument['meta']) {
    const { pdf } = this;
    const columnWidth = this.width / 2;
    const labelWidth = 128;
    for (let index = 0; index < items.length; index += 2) {
      const pair = items.slice(index, index + 2);
      pdf.font('body').fontSize(9);
      const height = Math.max(
        ...pair.map((item) =>
          pdf.heightOfString(item.value, { width: columnWidth - labelWidth - 12 }),
        ),
      );
      this.ensure(height + 4);
      pair.forEach((item, column) => {
        const x = this.left + column * columnWidth;
        pdf.font('bold').fontSize(7.5).fillColor(COLOR.muted);
        pdf.text(item.label, x, this.y + 1, { ...PLAIN_TEXT, width: labelWidth });
        pdf.font('body').fontSize(9).fillColor(COLOR.ink);
        pdf.text(item.value, x + labelWidth, this.y, {
          ...PLAIN_TEXT,
          width: columnWidth - labelWidth - 12,
        });
      });
      this.y += height + 4;
    }
    this.y += 6;
  }

  private warning(text: string) {
    const { pdf } = this;
    pdf.font('bold').fontSize(9);
    const height = pdf.heightOfString(text, { width: this.width - 24 }) + 14;
    this.ensure(height);
    pdf.rect(this.left, this.y, this.width, height).fill(COLOR.surface);
    pdf.rect(this.left, this.y, 3, height).fill(COLOR.warn);
    pdf
      .fillColor(COLOR.warn)
      .text(text, this.left + 14, this.y + 7, { ...PLAIN_TEXT, width: this.width - 24 });
    this.y += height + 12;
  }

  private sectionTitle(title: string) {
    const { pdf } = this;
    pdf.font('title').fontSize(12).fillColor(COLOR.ink);
    pdf.text(title, this.left, this.y, { ...PLAIN_TEXT, width: this.width });
    this.y = pdf.y + 6;
  }

  private summary(section: SummarySection) {
    const { pdf } = this;
    const perRow = 4;
    const boxHeight = 36;
    const gap = 8;
    const boxWidth = (this.width - gap * (perRow - 1)) / perRow;
    this.ensure(22 + boxHeight);
    this.sectionTitle(section.title);
    section.items.forEach((item, index) => {
      const column = index % perRow;
      if (column === 0 && index > 0) this.y += boxHeight + gap;
      if (column === 0) this.ensure(boxHeight);
      const x = this.left + column * (boxWidth + gap);
      pdf.roundedRect(x, this.y, boxWidth, boxHeight, 6).lineWidth(0.8).stroke(COLOR.border);
      pdf.font('body').fontSize(7.5).fillColor(COLOR.muted);
      this.line(item.label, x + 8, this.y + 6, boxWidth - 16, { size: 7.5 });
      pdf.font('bold').fontSize(11).fillColor(toneColor(item.tone));
      this.line(signedMoney(item.value), x + 8, this.y + 18, boxWidth - 16, { size: 11 });
    });
    this.y += boxHeight + 16;
  }

  private table(section: TableSection) {
    const { pdf } = this;
    const columns = section.columns.filter((column) => column.pdf !== false);
    const totalWeight = columns.reduce((sum, column) => sum + column.width, 0);
    const widths = columns.map((column) => (column.width / totalWeight) * this.width);
    const xs = widths.map((_, index) =>
      widths.slice(0, index).reduce((sum, width) => sum + width, this.left),
    );

    const header = () => {
      pdf.rect(this.left, this.y, this.width, HEAD_ROW).fill(COLOR.surface);
      pdf.font('bold').fontSize(6.8).fillColor(COLOR.muted);
      columns.forEach((column, index) => {
        this.line(
          column.header.toLocaleUpperCase('tr-TR'),
          xs[index]! + CELL_PAD,
          this.y + 5.5,
          widths[index]! - CELL_PAD * 2,
          { size: 6.8, align: column.type === 'money' ? 'right' : 'left' },
        );
      });
      this.y += HEAD_ROW;
    };
    const rule = (color: string) => {
      pdf
        .moveTo(this.left, this.y)
        .lineTo(this.left + this.width, this.y)
        .lineWidth(0.6)
        .stroke(color);
    };

    this.ensure(22 + HEAD_ROW + ROW * 2);
    this.sectionTitle(section.title);
    header();

    if (section.rows.length === 0) {
      pdf.font('body').fontSize(8).fillColor(COLOR.muted);
      pdf.text(section.empty, this.left + CELL_PAD, this.y + 4, {
        ...PLAIN_TEXT,
        width: this.width,
      });
      this.y += ROW + 2;
    }
    for (const row of section.rows) {
      if (this.ensure(ROW)) header();
      columns.forEach((column, index) => {
        const text = cellText(row.cells[column.key] ?? null, column.type);
        const money = column.type === 'money';
        pdf
          .font('body')
          .fontSize(7.5)
          .fillColor(money ? toneColor(row.tone) : COLOR.ink);
        this.line(text, xs[index]! + CELL_PAD, this.y + 4, widths[index]! - CELL_PAD * 2, {
          size: 7.5,
          align: money ? 'right' : 'left',
        });
      });
      this.y += ROW;
      rule(COLOR.borderSoft);
    }

    if (section.totals.length > 0) {
      if (this.ensure(ROW * section.totals.length + 4)) header();
      this.y += 2;
      rule(COLOR.border);
      const firstValue = Math.min(
        ...section.totals.flatMap((total) =>
          Object.keys(total.values).map((key) => columns.findIndex((c) => c.key === key)),
        ),
      );
      const labelWidth = (firstValue > 0 ? xs[firstValue]! : this.left + this.width) - this.left;
      for (const total of section.totals) {
        pdf.font('bold').fontSize(7.5).fillColor(COLOR.ink);
        this.line(total.label, this.left + CELL_PAD, this.y + 4, labelWidth - CELL_PAD * 2, {
          size: 7.5,
        });
        for (const [key, value] of Object.entries(total.values)) {
          const index = columns.findIndex((column) => column.key === key);
          if (index < 0) continue;
          this.line(
            signedMoney(value),
            xs[index]! + CELL_PAD,
            this.y + 4,
            widths[index]! - CELL_PAD * 2,
            {
              size: 7.5,
              align: 'right',
            },
          );
        }
        this.y += ROW;
      }
    }
    this.y += 14;
  }

  /** Her sayfanın altında rapor adı ve sayfa numarası. */
  footers(doc: ReportDocument, generatedAt: string) {
    const { pdf } = this;
    const range = pdf.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      pdf.switchToPage(index);
      // Alt kenar boşluğuna yazarken PDFKit yeni sayfa açmasın.
      const bottomMargin = pdf.page.margins.bottom;
      pdf.page.margins.bottom = 0;
      const y = pdf.page.height - MARGIN - 6;
      pdf.font('body').fontSize(7.5).fillColor(COLOR.muted);
      const left = `Şantiye Hesap · ${doc.subject ? `${doc.title} — ${doc.subject}` : doc.title} · Üretim: ${generatedAt}`;
      pdf.text(left, MARGIN, y, {
        ...PLAIN_TEXT,
        width: this.width - 80,
        lineBreak: false,
        ellipsis: true,
      });
      pdf.text(`Sayfa ${index + 1} / ${range.count}`, MARGIN + this.width - 80, y, {
        ...PLAIN_TEXT,
        width: 80,
        align: 'right',
        lineBreak: false,
      });
      pdf.page.margins.bottom = bottomMargin;
    }
  }
}

export function renderPdf(
  doc: ReportDocument,
  options: { generatedAt: string; compress?: boolean },
): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: MARGIN,
    bufferPages: true,
    compress: options.compress ?? true,
    lang: 'tr-TR',
    info: {
      Title: doc.subject ? `${doc.title} — ${doc.subject}` : doc.title,
      Creator: 'Şantiye Hesap',
    },
  });
  for (const [name, file] of Object.entries(FONTS)) pdf.registerFont(name, `${FONT_DIR}${file}`);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });

  const writer = new Writer(pdf);
  writer.write(doc);
  writer.footers(doc, options.generatedAt);
  pdf.end();
  return done;
}
