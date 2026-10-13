import type { ComponentProps } from 'react';
import { formatMoneyInput } from '../../lib/money-input';
import { TextInput } from './Field';

type MoneyInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
};

/** Para girişi: sayısal klavye (`inputMode="decimal"`), tr-TR biçimi, boş başlar. */
export function MoneyInput({ value, onChange, ...props }: MoneyInputProps) {
  return (
    <TextInput
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder="0,00"
      value={value}
      onChange={(event) => onChange(formatMoneyInput(event.target.value))}
      {...props}
    />
  );
}
