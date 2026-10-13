import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Yalnız ikonlu öğede erişilebilir ad. */
  ariaLabel?: string;
}

/**
 * Segment (ör. Bu ay / Tüm zamanlar, Tümü / Gelir / Gider / İade): beyaz kutu içinde düğme grubu;
 * seçili öğe primary %14 zemin + primary metin (şartname 4.4).
 */
export function Segment<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segment" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segment__item"
          aria-pressed={option.value === value}
          aria-label={option.ariaLabel}
          title={option.ariaLabel}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Etkin filtre etiketleri (primary %8, × ile kaldırılır) ve "Filtreleri temizle" (şartname 4.4). */
export function FilterChips({
  chips,
  onClear,
}: {
  chips: { key: string; label: string; onRemove: () => void }[];
  onClear?: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="filter-chips" aria-label="Etkin filtreler" role="group">
      {chips.map((chip) => (
        <span key={chip.key} className="filter-chip">
          {chip.label}
          <button type="button" aria-label={`Kaldır: ${chip.label}`} onClick={chip.onRemove}>
            <Icon icon={X} />
          </button>
        </span>
      ))}
      {onClear ? (
        <button type="button" className="filter-clear" onClick={onClear}>
          Filtreleri temizle
        </button>
      ) : null}
    </div>
  );
}

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
