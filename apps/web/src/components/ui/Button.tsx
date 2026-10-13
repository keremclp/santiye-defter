import type { ComponentProps, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

export type ButtonVariant =
  'primary' | 'secondary' | 'cyan' | 'ghost' | 'danger' | 'income' | 'expense';

interface StyleProps {
  variant?: ButtonVariant;
  size?: 'normal' | 'small';
  block?: boolean;
}

function className({ variant = 'primary', size = 'normal', block }: StyleProps, extra?: string) {
  return [
    'btn',
    `btn--${variant}`,
    size === 'small' ? 'btn--small' : '',
    block ? 'btn--block' : '',
    extra ?? '',
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ComponentProps<'button'>, StyleProps {
  /** Gönderim sürerken düğme kilitlenir ve metni değişir. */
  loading?: boolean;
  loadingText?: string;
}

/** Birincil, ikincil, hayalet, tehlike ve gelir/gider düğmeleri (şartname 4.4). */
export function Button({
  variant,
  size,
  block,
  loading = false,
  loadingText = 'Kaydediliyor…',
  disabled,
  children,
  className: extra,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={className({ variant, size, block }, extra)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? loadingText : children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  className: extra,
  ...rest
}: LinkProps & StyleProps) {
  return <Link className={className({ variant, size, block }, extra)} {...rest} />;
}

/**
 * Kapalı eylem: düğme görünür ama basılamaz; neden yazılı gösterilir (şartname 9.10, 11).
 */
export function DisabledAction({ label, reason }: { label: ReactNode; reason: string }) {
  return (
    <span className="stack stack--sm">
      <button type="button" className="btn btn--secondary" aria-disabled="true" disabled>
        {label}
      </button>
      <span className="meta">{reason}</span>
    </span>
  );
}
