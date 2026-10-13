// Renkler yalnız token dosyasından gelir (şartname 4, AGENTS kural 9).

import { describe, expect, it } from 'vitest';
import tokensSource from './tokens.css?raw';

const tokens = tokensSource.replace(/\s+/g, '').toLowerCase();

// Kaynak dosyalar metin olarak (Vite); testler ve token dosyası hariç denetlenir.
const sources = import.meta.glob<string>(['../**/*.css', '../**/*.ts', '../**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('tasarım token dosyası', () => {
  it('şartname 4.1 renk ve tint değerlerini birebir içerir', () => {
    const expected: Record<string, string> = {
      '--color-surface': '#F7F6FA',
      '--color-panel': '#FFFFFF',
      '--color-white': '#FFFFFF',
      '--color-ink': '#1B1838',
      '--color-ink2': '#4A4668',
      '--color-muted': '#7A76A8',
      '--color-border': '#E7E4F0',
      '--color-border-soft': '#F0EEF5',
      '--color-primary': '#4D12EE',
      '--color-primary-hover': '#3F0CCB',
      '--color-navy': '#2F24C1',
      '--color-navy-deep': '#1E1878',
      '--color-cyan': '#3FD1CB',
      '--color-cyan-ink': '#0E6E6A',
      '--color-income': '#166534',
      '--color-success': '#166534',
      '--color-expense': '#DC2626',
      '--color-danger': '#DC2626',
      '--color-warn': '#B45309',
      '--color-on-primary': '#FFFFFF',
      '--color-on-navy-muted': 'rgba(255,255,255,0.72)',
      '--color-backdrop': 'rgba(15,23,42,0.72)',
      '--tint-primary-8': 'rgba(77,18,238,0.08)',
      '--tint-primary-14': 'rgba(77,18,238,0.14)',
      '--tint-cyan-18': 'rgba(63,209,203,0.18)',
      '--tint-income-10': 'rgba(22,101,52,0.1)',
      '--tint-expense-9': 'rgba(220,38,38,0.09)',
      '--tint-warn-12': 'rgba(217,119,6,0.12)',
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(tokens, name).toContain(`${name}:${value.toLowerCase()};`);
    }
  });

  it('ölçü, gölge ve tipografi değerleri şartname 4.2–4.3 ile aynı', () => {
    for (const [name, value] of Object.entries({
      '--space-4': '4px',
      '--space-6': '6px',
      '--space-8': '8px',
      '--space-10': '10px',
      '--space-12': '12px',
      '--space-14': '14px',
      '--space-16': '16px',
      '--space-22': '22px',
      '--space-28': '28px',
      '--space-32': '32px',
      '--radius-pill': '999px',
      '--radius-input': '9px',
      '--radius-control': '10px',
      '--radius-panel': '14px',
      '--shadow-card': '01px2pxrgba(27,24,56,0.04),02px8pxrgba(27,24,56,0.04)',
      '--shadow-menu': '012px32pxrgba(20,20,40,0.14)',
      '--sidebar-width': '232px',
      '--font-size-page-title': '28px',
      '--font-size-panel-title': '17px',
      '--font-size-metric': '28px',
    })) {
      expect(tokens, name).toContain(`${name}:${value.toLowerCase()};`);
    }
  });

  it('kullanılan her değişken token dosyasında tanımlı', () => {
    const defined = new Set([...tokensSource.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const missing = Object.entries(sources)
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .flatMap(([path, text]) =>
        [...text.matchAll(/var\((--[a-z0-9-]+)/g)]
          .map((m) => m[1])
          .filter((name) => !defined.has(name))
          .map((name) => `${path}: ${name}`),
      );
    expect(missing).toEqual([]);
  });

  it('token dosyası dışında renk değeri yazılmaz', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(40);
    // CSS gerçekten metin olarak okunuyor (boş dönseydi denetim anlamsız olurdu).
    expect(sources['./components.css']).toContain('var(--color-primary)');
    const color = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|:\s*(white|black|red|green|blue|gray|grey)\b/i;
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.endsWith('tokens.css') && !/\.test\.tsx?$/.test(path))
      .filter(([path, text]) =>
        // TS/TSX içinde yalnız stil olabilecek dizgeler denetlenir; "#12" gibi kayıt numaraları renk değildir.
        path.endsWith('.css') ? color.test(text) : /['"`]#[0-9a-f]{6}['"`]|rgba?\(/i.test(text),
      )
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });
});
