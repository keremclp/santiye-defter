import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Açılır menü (şartname 4.4, 4.5): Esc ve dışarı tıklama kapatır, açılınca ilk öğeye odaklanır,
 * ok tuşlarıyla öğeler arasında gezilir, kapanınca odak düğmeye döner. Öğeler
 * `.dropdown__item` + `role="menuitem"` ile çağıran tarafından verilir.
 */
export function Menu({
  label,
  buttonClassName,
  buttonContent,
  buttonLabel,
  wrapClassName,
  placement = 'down',
  children,
}: {
  /** Menünün erişilebilir adı. */
  label: string;
  buttonClassName: string;
  buttonContent: ReactNode;
  /** Yalnız ikonlu düğmede `aria-label`. */
  buttonLabel?: string;
  wrapClassName?: string;
  placement?: 'down' | 'up';
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const items = () => [
      ...(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []),
    ];
    items()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        button.current?.focus();
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const list = items();
        if (list.length === 0) return;
        event.preventDefault();
        const index = list.indexOf(document.activeElement as HTMLElement);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        list[(index + step + list.length) % list.length]?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div
      ref={wrap}
      className={['menu-wrap', wrapClassName].filter(Boolean).join(' ')}
      // Tablo satırına tıklama (detaya gitme) menüden tetiklenmesin.
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={button}
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={buttonLabel}
        title={buttonLabel}
        onClick={() => setOpen((value) => !value)}
      >
        {buttonContent}
      </button>
      {open ? (
        <div
          id={menuId}
          className={placement === 'up' ? 'dropdown dropdown--up' : 'dropdown'}
          role="menu"
          aria-label={label}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}
