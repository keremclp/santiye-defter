import { directionOfKind, type TransactionKind } from '@santiye/shared';
import { ArrowDownLeft, ArrowUpRight, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatMoney, formatSigned } from '../../lib/format';
import { KIND_LABEL } from '../../lib/labels';
import { Icon } from './Icon';

type Tone = 'income' | 'expense' | 'neutral';

const isRefundKind = (kind: TransactionKind) =>
  kind === 'expense_refund' || kind === 'income_refund';

/**
 * Tutar gösterimi (şartname 4.1). Hareketlerde gelir yeşil "+", gider kırmızı "−"; iade kaynak
 * hareketin rengini taşır (ödeme iadesi kırmızı, tahsilat iadesi yeşil) ve "−" önekiyle gösterilir;
 * tür yazısı ayrıca görünür. Tür verilmeyen bakiyeler işaretsiz, negatifse "−" önekli.
 */
export function Amount({
  value,
  tone = 'neutral',
  kind,
  showKind = false,
  label,
}: {
  value: number;
  tone?: Tone;
  kind?: TransactionKind;
  /** Tür adını tutarın altında yazılı gösterir (renk tek başına anlam taşımaz). */
  showKind?: boolean;
  label?: ReactNode;
}) {
  const resolved: Tone = kind ? (directionOfKind(kind) === 'payable' ? 'expense' : 'income') : tone;
  const text = kind
    ? `${kind === 'income' ? '+' : '−'}${formatMoney(value)}`
    : tone === 'neutral'
      ? formatSigned(value)
      : formatMoney(value);

  return (
    <span className={`amount amount--${resolved}`}>
      {label ? <span className="amount__label">{label}</span> : null}
      {text}
      {kind && showKind ? <span className="amount__label">{KIND_LABEL[kind]}</span> : null}
    </span>
  );
}

/** Hareket türü ikon kutusu: gelir yeşil, gider kırmızı, iade nötr (tutar rengi kaynağı gösterir). */
export function KindIcon({ kind, size = 'lg' }: { kind: TransactionKind; size?: 'lg' | 'md' }) {
  const refund = isRefundKind(kind);
  const tone = refund ? 'neutral' : kind === 'income' ? 'income' : 'expense';
  const glyph = refund ? Undo2 : kind === 'income' ? ArrowDownLeft : ArrowUpRight;
  return (
    <span className={`icon-box icon-box--${size} icon-box--${tone}`}>
      <Icon icon={glyph} />
    </span>
  );
}

export function KindBadge({ kind }: { kind: TransactionKind }) {
  if (isRefundKind(kind)) return <span className="badge">{KIND_LABEL[kind]}</span>;
  const payable = directionOfKind(kind) === 'payable';
  return (
    <span className={payable ? 'badge badge--expense' : 'badge badge--income'}>
      {KIND_LABEL[kind]}
    </span>
  );
}

export type BadgeTone =
  | 'neutral'
  | 'overdue'
  | 'upcoming'
  | 'warn'
  | 'income'
  | 'expense'
  | 'cyan'
  | 'primary'
  | 'danger';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={tone === 'neutral' ? 'badge' : `badge badge--${tone}`}>{children}</span>;
}
