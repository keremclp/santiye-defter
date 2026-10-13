import { directionOfKind, type TransactionKind } from '@santiye/shared';
import type { ReactNode } from 'react';
import { formatMoney } from '../../lib/format';
import { KIND_LABEL } from '../../lib/labels';

type Tone = 'income' | 'expense' | 'neutral';

/**
 * Tutar gösterimi. Gelir yeşil, gider kırmızı; tutar asla gri değil. İade satırları kendi yönünün
 * (ödeme iadesi → gider tarafı, tahsilat iadesi → gelir tarafı) rengini kullanır, eksi işaretiyle
 * gösterilir ve tür yazısı görünür kalır (şartname 4.1).
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
  /** Tür adını tutarın yanında yazılı gösterir (renk tek başına anlam taşımaz). */
  showKind?: boolean;
  label?: ReactNode;
}) {
  const resolved: Tone = kind ? (directionOfKind(kind) === 'payable' ? 'expense' : 'income') : tone;
  const isRefund = kind === 'expense_refund' || kind === 'income_refund';
  const text = isRefund ? `−${formatMoney(value)}` : formatMoney(value);

  return (
    <span className={`amount amount--${resolved}`}>
      {label ? <span className="amount__label">{label}</span> : null}
      {text}
      {kind && showKind ? <span className="amount__label">{KIND_LABEL[kind]}</span> : null}
    </span>
  );
}

export function KindBadge({ kind }: { kind: TransactionKind }) {
  const payable = directionOfKind(kind) === 'payable';
  return (
    <span className={payable ? 'badge badge--expense' : 'badge badge--income'}>
      {KIND_LABEL[kind]}
    </span>
  );
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'overdue' | 'upcoming' | 'income' | 'expense' | 'cyan' | 'primary' | 'danger';
  children: ReactNode;
}) {
  return <span className={tone === 'neutral' ? 'badge' : `badge badge--${tone}`}>{children}</span>;
}
