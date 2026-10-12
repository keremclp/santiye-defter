// İade sınırları ve iadeli payların korunması (şartname 7.5, 8.6, 9.4).

import type { TransactionKind, ValidationIssue } from '../domain.js';
import { assertKurus, formatTl } from '../money.js';
import type { AllocationInput, AllocationTarget } from './allocation.js';

/** Kaynak hareketin payı; `refundedAmount` o paya bağlı aktif iadelerin toplamıdır. */
export interface RefundableAllocation extends AllocationTarget {
  id: string;
  amount: number;
  refundedAmount: number;
}

export interface RefundPart {
  allocationId: string;
  amount: number;
}

/** Paydan en fazla iade edilebilecek tutar: pay − aktif iadeler. */
export function refundableAmountOf(allocation: { amount: number; refundedAmount: number }): number {
  assertKurus(allocation.amount, 'pay tutarı');
  assertKurus(allocation.refundedAmount, 'iade toplamı');
  return Math.max(allocation.amount - allocation.refundedAmount, 0);
}

export function totalRefundableOf(
  allocations: readonly { amount: number; refundedAmount: number }[],
): number {
  return allocations.reduce((sum, allocation) => sum + refundableAmountOf(allocation), 0);
}

function sumByAllocation(parts: readonly RefundPart[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (const part of parts) {
    sums.set(part.allocationId, (sums.get(part.allocationId) ?? 0) + part.amount);
  }
  return sums;
}

/**
 * İade girişini kaynak harekete göre doğrular. Pay bazında iade, payın kalan iade edilebilir
 * tutarını; toplam iade, kaynağın kalan iade edilebilir tutarını aşamaz.
 */
export function validateRefund(
  source: { kind: TransactionKind; allocations: readonly RefundableAllocation[] },
  input: { amount: number; parts: readonly RefundPart[] },
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: string, message: string, path: (string | number)[]) =>
    issues.push({ code, message, path });

  if (source.kind !== 'income' && source.kind !== 'expense') {
    add('REFUND_SOURCE_INVALID', 'İade yalnız gelir veya gider kaydına yapılabilir.', []);
    return issues;
  }
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    add('AMOUNT_INVALID', 'İade tutarı 0’dan büyük olmalı.', ['amount']);
    return issues;
  }
  if (input.parts.length === 0) {
    add('REFUND_PART_REQUIRED', 'İade edilecek pay seçilmeli.', ['parts']);
    return issues;
  }

  const allocations = new Map(source.allocations.map((allocation) => [allocation.id, allocation]));
  input.parts.forEach((part, index) => {
    if (!Number.isSafeInteger(part.amount) || part.amount <= 0) {
      add('AMOUNT_INVALID', 'Pay iade tutarı 0’dan büyük olmalı.', ['parts', index, 'amount']);
    }
    if (!allocations.has(part.allocationId)) {
      add('REFUND_ALLOCATION_NOT_FOUND', 'İade edilecek pay bulunamadı.', [
        'parts',
        index,
        'allocationId',
      ]);
    }
  });
  if (issues.length > 0) return issues;

  const totalRefundable = totalRefundableOf(source.allocations);
  if (input.amount > totalRefundable) {
    add(
      'REFUND_LIMIT_EXCEEDED',
      totalRefundable === 0
        ? 'Bu kaydın tamamı iade edildi; yeni iade eklenemez.'
        : `Bu kayıttan en fazla ${formatTl(totalRefundable)} iade edilebilir.`,
      ['amount'],
    );
    return issues;
  }

  for (const [allocationId, amount] of sumByAllocation(input.parts)) {
    const allocation = allocations.get(allocationId);
    if (!allocation) continue;
    const refundable = refundableAmountOf(allocation);
    if (amount > refundable) {
      const index = input.parts.findIndex((part) => part.allocationId === allocationId);
      add(
        'REFUND_LIMIT_EXCEEDED',
        refundable === 0
          ? 'Bu payın tamamı iade edildi.'
          : `Bu paydan en fazla ${formatTl(refundable)} iade edilebilir.`,
        ['parts', index, 'amount'],
      );
    }
  }

  const partsTotal = input.parts.reduce((sum, part) => sum + part.amount, 0);
  if (partsTotal !== input.amount) {
    add('REFUND_PARTS_MISMATCH', `İade paylarının toplamı ${formatTl(input.amount)} olmalı.`, [
      'parts',
    ]);
  }
  return issues;
}

/**
 * İade hareketinin payları: geri çevrilen kaynak payların kapsam ve anlaşmasını taşır.
 * Böylece şantiye toplamları iadeyi de paylardan hesaplar. Girdi önce `validateRefund` ile
 * doğrulanmış olmalıdır.
 */
export function refundAllocationsFor(
  sourceAllocations: readonly RefundableAllocation[],
  parts: readonly RefundPart[],
): AllocationInput[] {
  const allocations = new Map(sourceAllocations.map((allocation) => [allocation.id, allocation]));
  return [...sumByAllocation(parts)].map(([allocationId, amount]) => {
    const source = allocations.get(allocationId);
    if (!source) throw new RangeError(`İade edilecek pay bulunamadı: ${allocationId}`);
    return {
      scope: source.scope,
      projectId: source.projectId ?? null,
      agreementId: source.agreementId ?? null,
      amount,
    };
  });
}

function sameTarget(a: AllocationTarget, b: AllocationTarget): boolean {
  return (
    a.scope === b.scope &&
    (a.projectId ?? null) === (b.projectId ?? null) &&
    (a.agreementId ?? null) === (b.agreementId ?? null)
  );
}

/**
 * Düzeltmede iadesi olan paylar korunur: kaldırılamaz, hedefi değiştirilemez ve tutarı bağlı
 * iade toplamının altına indirilemez. Böylece ana tutar da iade toplamının altına inemez.
 */
export function validateAllocationChangesAgainstRefunds(
  current: readonly RefundableAllocation[],
  next: readonly (AllocationInput & { id?: string | null })[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const allocation of current) {
    if (allocation.refundedAmount <= 0) continue;
    const index = next.findIndex((candidate) => candidate.id === allocation.id);
    const replacement = next[index];

    if (!replacement) {
      issues.push({
        code: 'REFUNDED_ALLOCATION_REMOVED',
        message: 'Bağlı iadesi olan pay kaldırılamaz.',
        path: ['allocations'],
      });
      continue;
    }
    if (!sameTarget(allocation, replacement)) {
      issues.push({
        code: 'REFUNDED_ALLOCATION_RETARGETED',
        message: 'Bağlı iadesi olan payın şantiyesi veya anlaşması değiştirilemez.',
        path: ['allocations', index],
      });
    }
    if (replacement.amount < allocation.refundedAmount) {
      issues.push({
        code: 'ALLOCATION_BELOW_REFUNDS',
        message: `Pay tutarı bağlı iadelerin toplamının (${formatTl(allocation.refundedAmount)}) altına indirilemez.`,
        path: ['allocations', index, 'amount'],
      });
    }
  }
  return issues;
}
