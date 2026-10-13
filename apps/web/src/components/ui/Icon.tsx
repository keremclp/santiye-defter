import type { LucideIcon } from 'lucide-react';

/**
 * Lucide ikonu, çizgi kalınlığı 1.9 (şartname 4.4). Boyut CSS'ten gelir; ikon süs olarak ekran
 * okuyucudan gizlenir, anlamı yanındaki metin veya düğmenin `aria-label`ı taşır.
 */
export function Icon({ icon: Glyph, size = 18 }: { icon: LucideIcon; size?: number }) {
  return <Glyph aria-hidden="true" focusable="false" strokeWidth={1.9} size={size} />;
}
