import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface DialogProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Vazgeç ve onay düğmeleri. */
  actions?: ReactNode;
  wide?: boolean;
  /** Gönderim sürerken Esc ve arka plana tıklama kapatmaz. */
  locked?: boolean;
}

/**
 * Markalı dialog (şartname 4.4, 4.5): uzunsa kendi içinde kayar, arka plan kilitlenir, Esc kapatır,
 * odak dialog içinde kalır ve kapanınca açan öğeye döner.
 */
export function Dialog({ open, title, onClose, children, actions, wide, locked }: DialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const lockedRef = useRef(locked);
  useEffect(() => {
    onCloseRef.current = onClose;
    lockedRef.current = locked;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !lockedRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !locked) onClose();
      }}
    >
      <div
        ref={panel}
        className={wide ? 'dialog dialog--wide' : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="dialog__header">
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="dialog__body">{children}</div>
        {actions ? <div className="dialog__actions">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
