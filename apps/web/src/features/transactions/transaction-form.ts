// Gelir/gider formu kuralları (şartname 7.4). Hesap ve doğrulama `packages/shared` fonksiyonlarıyla.

import {
  allocationSumIssue,
  detectExcess,
  isIsoDate,
  parseMoney,
  previewAgreementBalance,
  type AllocationInput,
  type CashKind,
} from '@santiye/shared';
import { z } from 'zod';
import type { Agreement, Project } from '../../api/types';
import { moneyText, toKurus } from '../../lib/forms';

export interface PartyRef {
  id: string;
  name: string;
}

export interface AllocationRowValues {
  /** Satır anahtarı; düzeltmede mevcut payın kimliği. */
  key: string;
  id?: string | undefined;
  scope: 'project' | 'company';
  projectId: string;
  agreementId: string;
  amount: string;
}

export interface TransactionFormValues {
  kind: CashKind;
  amount: string;
  date: string;
  scope: 'project' | 'company';
  projectId: string;
  party: PartyRef | null;
  agreementId: string;
  categoryId: string;
  description: string;
  /** Tamamlanan/arşivlenen şantiyeye anlaşmasız gider gerekçesi */
  reason: string;
  split: boolean;
  allocations: AllocationRowValues[];
  confirmExcess: boolean;
  excessReason: string;
}

let rowCounter = 0;
export function newRowKey(): string {
  rowCounter += 1;
  return `pay-${rowCounter}`;
}

export function emptyRow(
  scope: 'project' | 'company' = 'project',
  projectId = '',
): AllocationRowValues {
  return { key: newRowKey(), scope, projectId, agreementId: '', amount: '' };
}

const partyRefSchema = z.object({ id: z.string(), name: z.string() }).nullable();

const rowSchema = z.object({
  key: z.string(),
  id: z.string().optional(),
  scope: z.enum(['project', 'company']),
  projectId: z.string(),
  agreementId: z.string(),
  amount: z.string(),
});

export const transactionFormSchema = z
  .object({
    kind: z.enum(['income', 'expense']),
    amount: moneyText(),
    date: z.string().refine(isIsoDate, 'İşlem tarihini seçin.'),
    scope: z.enum(['project', 'company']),
    projectId: z.string(),
    party: partyRefSchema,
    agreementId: z.string(),
    categoryId: z.string(),
    description: z.string().max(2000, 'Açıklama çok uzun.'),
    reason: z.string(),
    split: z.boolean(),
    allocations: z.array(rowSchema),
    confirmExcess: z.boolean(),
    excessReason: z.string(),
  })
  .superRefine((value, ctx) => {
    if (!value.split) {
      if (value.scope === 'project' && !value.projectId) {
        ctx.addIssue({ code: 'custom', message: 'Şantiye seçin.', path: ['projectId'] });
      }
    } else {
      if (value.allocations.length < 2) {
        ctx.addIssue({
          code: 'custom',
          message: 'Paylaştırmak için en az iki satır ekleyin.',
          path: ['allocations'],
        });
      }
      value.allocations.forEach((row, index) => {
        if (row.scope === 'project' && !row.projectId) {
          ctx.addIssue({
            code: 'custom',
            message: 'Şantiye seçin.',
            path: ['allocations', index, 'projectId'],
          });
        }
        const parsed = row.amount.trim() === '' ? null : parseMoney(row.amount);
        if (!parsed) {
          ctx.addIssue({
            code: 'custom',
            message: 'Pay tutarı girin.',
            path: ['allocations', index, 'amount'],
          });
        } else if (!parsed.ok) {
          ctx.addIssue({
            code: 'custom',
            message: parsed.message,
            path: ['allocations', index, 'amount'],
          });
        } else if (parsed.value <= 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Pay tutarı 0’dan büyük olmalı.',
            path: ['allocations', index, 'amount'],
          });
        }
      });
      const sumMessage = splitSumIssue(value.amount, value.allocations);
      if (sumMessage) ctx.addIssue({ code: 'custom', message: sumMessage, path: ['allocations'] });
    }
    const linked = value.split
      ? value.allocations.some((row) => row.agreementId)
      : Boolean(value.agreementId);
    if (linked && !value.party) {
      ctx.addIssue({
        code: 'custom',
        message: 'Anlaşmaya bağlı kayıtta kişi/firma seçilmeli.',
        path: ['party'],
      });
    }
    if (value.confirmExcess && value.excessReason.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        message: 'Fazla tutar için gerekçe girin.',
        path: ['excessReason'],
      });
    }
  });

/** Dağıtılmamış tutar: ana tutar − pay toplamı (geçersiz tutarlar hesaba katılmaz). */
export function unallocatedAmount(amount: string, rows: AllocationRowValues[]): number | null {
  const total = toKurus(amount);
  if (total === null) return null;
  const allocated = rows.reduce((sum, row) => sum + (toKurus(row.amount) ?? 0), 0);
  return total - allocated;
}

/** "Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı." */
export function splitSumIssue(amount: string, rows: AllocationRowValues[]): string | null {
  const total = toKurus(amount);
  if (total === null) return null;
  const amounts = rows.map((row) => toKurus(row.amount));
  if (amounts.some((value) => value === null)) return null;
  return allocationSumIssue(
    total,
    amounts.map((value) => ({ amount: value! })),
  );
}

/** Formdaki payların API biçimi (kuruş). */
export function allocationsOf(
  values: TransactionFormValues,
): (AllocationInput & { id?: string })[] {
  if (!values.split) {
    return [
      {
        scope: values.scope,
        projectId: values.scope === 'project' ? values.projectId : null,
        agreementId: values.agreementId || null,
        amount: toKurus(values.amount) ?? 0,
      },
    ];
  }
  return values.allocations.map((row) => ({
    ...(row.id ? { id: row.id } : {}),
    scope: row.scope,
    projectId: row.scope === 'project' ? row.projectId : null,
    agreementId: row.agreementId || null,
    amount: toKurus(row.amount) ?? 0,
  }));
}

/**
 * Seçili anlaşmaların bu kayıttan önceki kalanını aşan tutar. Aşıyorsa kullanıcı onay ve gerekçe
 * girmeden kayıt oluşmaz (şartname 9.4). `ownShare` düzeltmede kaydın kendi mevcut payıdır.
 */
export function excessOf(
  values: TransactionFormValues,
  agreements: Map<string, Pick<Agreement, 'remaining' | 'currentAmount' | 'netSettled'>>,
  ownShare: Map<string, number> = new Map(),
): number {
  const allocations = allocationsOf(values).filter((a) => a.agreementId && a.amount > 0);
  if (allocations.length === 0) return 0;
  const remaining = new Map<string, number>();
  for (const allocation of allocations) {
    const id = allocation.agreementId!;
    const agreement = agreements.get(id);
    if (!agreement) return 0;
    // Kaydın kendi mevcut payı çıkarılmış kalan (düzeltmede).
    const own = ownShare.get(id) ?? 0;
    remaining.set(id, previewAgreementBalance(agreement, { netDelta: -own }).remaining);
  }
  return detectExcess(allocations, remaining).total;
}

/** Tamamlanan veya arşivlenen şantiyeye anlaşmaya bağlı olmayan gider gerekçe ister (şartname 7.2). */
export function needsClosedProjectReason(
  values: TransactionFormValues,
  projects: Project[] | undefined,
): boolean {
  if (values.kind !== 'expense') return false;
  const closed = (projectId: string) =>
    projects?.some((project) => project.id === projectId && project.status !== 'active') ?? false;
  return allocationsOf(values).some(
    (a) => a.scope === 'project' && !a.agreementId && a.projectId && closed(a.projectId),
  );
}

/** `POST /transactions` gövdesi. */
export function buildCreateBody(values: TransactionFormValues, options: { needsReason: boolean }) {
  const amount = toKurus(values.amount) ?? 0;
  return {
    kind: values.kind,
    amount,
    date: values.date,
    ...(values.party ? { partyId: values.party.id } : {}),
    ...(values.kind === 'expense' && values.categoryId ? { categoryId: values.categoryId } : {}),
    description: values.description.trim(),
    allocations: allocationsOf(values).map(({ scope, projectId, agreementId, amount: share }) => ({
      scope,
      ...(projectId ? { projectId } : {}),
      ...(agreementId ? { agreementId } : {}),
      amount: share,
    })),
    ...(options.needsReason && values.reason.trim() ? { reason: values.reason.trim() } : {}),
    ...(values.confirmExcess
      ? { confirmExcess: true, excessReason: values.excessReason.trim() }
      : {}),
  };
}
