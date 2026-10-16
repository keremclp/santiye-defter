// `;` ayraçlı, BOM'lu tek tablo CSV'sini başlık adlarıyla nesnelere çevirir.

export function parseCsvRows(buffer: Buffer): string[][] {
  const text = buffer.toString('utf8');
  if (text.charCodeAt(0) !== 0xfeff) throw new Error('CSV BOM ile başlamıyor');
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

export function parseCsvTable(buffer: Buffer): Record<string, string>[] {
  const [header = [], ...rows] = parseCsvRows(buffer);
  return rows.map((row) => Object.fromEntries(header.map((name, i) => [name, row[i] ?? ''])));
}

/** "12500,50" → 1250050 kuruş */
export function csvKurus(text: string): number {
  const negative = text.startsWith('-');
  const [lira = '0', kurus = '00'] = text.replace('-', '').split(',');
  const value = Number(lira) * 100 + Number(kurus.padEnd(2, '0'));
  return negative ? -value : value;
}
