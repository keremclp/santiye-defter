// Form yardımcıları: para metni doğrulaması ve API alan hatalarının forma aktarılması.

import { formatTl, parseMoney } from '@santiye/shared';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { z } from 'zod';
import { isApiError } from '../api/client';

/** Para metni (tr-TR). Kayan noktaya hiç çevrilmez; kuruşa `toKurus` ile geçer. */
export function moneyText(options: { required?: boolean; allowZero?: boolean } = {}) {
  const { required = true, allowZero = false } = options;
  return z.string().superRefine((value, ctx) => {
    if (value.trim() === '') {
      if (required) ctx.addIssue({ code: 'custom', message: 'Tutar girin.' });
      return;
    }
    const parsed = parseMoney(value);
    if (!parsed.ok) {
      ctx.addIssue({ code: 'custom', message: parsed.message });
    } else if (!allowZero && parsed.value <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Tutar 0’dan büyük olmalı.' });
    }
  });
}

/** Doğrulanmış para metnini kuruşa çevirir; boş veya geçersizse null. */
export function toKurus(text: string): number | null {
  if (text.trim() === '') return null;
  const parsed = parseMoney(text);
  return parsed.ok ? parsed.value : null;
}

/** Kuruşu form alanına yazılacak metne çevirir: 1250050 → "12.500,50". */
export function kurusToInput(kurus: number): string {
  return formatTl(kurus).replace(/ TL$/, '');
}

/** API'nin `details.issues` alan hatalarını formdaki aynı adlı alanlara yazar; yazılamayanlar döner. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
  rename: Record<string, string> = {},
): string[] {
  if (!isApiError(error)) return [];
  const unmatched: string[] = [];
  let focused = false;
  for (const issue of error.issues) {
    const path = rename[issue.path] ?? issue.path;
    if (fields.includes(path)) {
      setError(
        path as Path<T>,
        { type: 'server', message: issue.message },
        { shouldFocus: !focused },
      );
      focused = true;
    } else {
      unmatched.push(issue.message);
    }
  }
  return unmatched;
}
