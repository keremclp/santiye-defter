import type { ReactNode } from 'react';

export interface ChipOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

/** Tek seçimli chip grubu: seçilmemiş beyaz kenarlı, seçili vurgu zeminli (şartname 4.4). */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <div className="chip-group" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={selected ? 'chip chip--selected' : 'chip'}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Çok seçimli chip grubu (ör. kişi etiketleri). */
export function MultiChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption<T>[];
  value: T[];
  onChange: (value: T[]) => void;
}) {
  return (
    <div className="chip-group" role="group" aria-label={label}>
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            className={selected ? 'chip chip--selected' : 'chip'}
            disabled={option.disabled}
            onClick={() =>
              onChange(
                selected ? value.filter((item) => item !== option.value) : [...value, option.value],
              )
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
