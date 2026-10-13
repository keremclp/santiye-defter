import { useId, type ComponentProps, type ReactNode } from 'react';

interface FieldProps {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string | undefined;
  /** Alanın kimliği; verilmezse üretilir ve `children` fonksiyonuna geçer. */
  id?: string;
  children: (props: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
    'aria-required': boolean | undefined;
  }) => ReactNode;
  className?: string;
}

/** Üstte etiket, zorunlu alanda kırmızı yıldız, altında yardım ve hata metni (şartname 4.4). */
export function Field({ label, required, hint, error, id, children, className }: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label className="field__label" htmlFor={inputId}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children({
        id: inputId,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy,
        'aria-required': required || undefined,
      })}
      {hint ? (
        <span id={hintId} className="field__hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} className="field__error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function inputClass(invalid: boolean | 'true' | 'false' | 'grammar' | 'spelling' | undefined) {
  return invalid === true || invalid === 'true' ? 'input input--invalid' : 'input';
}

export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={[inputClass(props['aria-invalid']), className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={[inputClass(props['aria-invalid']), className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

export function SelectInput({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={[inputClass(props['aria-invalid']), className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

/** Takvim alanı metin değil tarih seçicidir; seçilen gün YYYY-MM-DD olarak korunur. */
export function DateInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  return <TextInput type="date" {...props} />;
}

export function Checkbox({
  label,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { label: ReactNode }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...props} />
      <span>{label}</span>
    </label>
  );
}
