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
  it('şartname 4.1 renklerini birebir içerir', () => {
    const expected: Record<string, string> = {
      '--color-surface': '#F8F6F6',
      '--color-surface-tint': '#EEECF8',
      '--color-elevated': '#FFFFFF',
      '--color-white': '#FFFFFF',
      '--color-primary': '#4D12EE',
      '--color-navy': '#2F24C1',
      '--color-navy-deep': '#1E1878',
      '--color-cyan': '#3FD1CB',
      '--color-ink': '#2F24C1',
      '--color-muted': '#7A76A8',
      '--color-border': '#E4E1F0',
      '--color-income': '#166534',
      '--color-success': '#166534',
      '--color-expense': '#DC2626',
      '--color-danger': '#DC2626',
      '--color-on-navy': '#FFFFFF',
      '--color-on-navy-muted': 'rgba(255,255,255,0.72)',
      '--color-overlay': 'rgba(47,36,193,0.45)',
      '--color-backdrop': 'rgba(15,23,42,0.72)',
      '--tint-primary-8': 'rgba(77,18,238,0.08)',
      '--tint-primary-12': 'rgba(77,18,238,0.12)',
      '--tint-navy-12': 'rgba(47,36,193,0.12)',
      '--tint-cyan-12': 'rgba(63,209,203,0.12)',
      '--tint-cyan-18': 'rgba(63,209,203,0.18)',
      '--tint-income-12': 'rgba(22,101,52,0.12)',
      '--tint-expense-12': 'rgba(220,38,38,0.12)',
    };
    for (const [name, value] of Object.entries(expected)) {
      expect(tokens, name).toContain(`${name}:${value.toLowerCase()};`);
    }
  });

  it('ölçü ve gölge değerleri şartname 4.3 ile aynı', () => {
    for (const [name, value] of Object.entries({
      '--space-xs': '6px',
      '--space-sm': '10px',
      '--space-md': '16px',
      '--space-lg': '24px',
      '--space-xl': '32px',
      '--space-xxl': '48px',
      '--radius-sm': '10px',
      '--radius-md': '16px',
      '--radius-lg': '24px',
      '--radius-xl': '32px',
      '--shadow-card': '03px10pxrgba(77,18,238,0.06)',
      '--shadow-modal': '0-4px16pxrgba(0,0,0,0.18)',
    })) {
      expect(tokens, name).toContain(`${name}:${value.toLowerCase()};`);
    }
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
