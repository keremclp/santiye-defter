// Hareket payı doğrulaması ve fazla ödeme tespiti (şartname 7.4, 8.6, 9.2, 9.4).

import {
  directionOfKind,
  type CashKind,
  type Direction,
  type Scope,
  type ValidationIssue,
} from '../domain.js';
import { assertKurus, formatTl } from '../money.js';

export interface AllocationTarget {
  scope: Scope;
  projectId?: string | null;
  agreementId?: string | null;
}

export interface AllocationInput extends AllocationTarget {
  amount: number;
}

/** Pay hedefi olarak kullanılan anlaşma veya başlangıç kaydının ilgili alanları. */
export interface AgreementRef {
  direction: Direction;
  scope: Scope;
  projectId?: string | null;
  partyId: string;
}

/** Proje kapsamında şantiye zorunlu; firma genelinde şantiye olmaz. */
export function scopeIssue(target: AllocationTarget): string | null {
  if (target.scope === 'project' && !target.projectId) return 'Şantiye seçilmeli.';
  if (target.scope === 'company' && target.projectId) {
    return 'Firma geneli kayıtta şantiye seçilemez.';
  }
  return null;
}

/** Pay toplamı ana tutara eşit değilse kullanıcıya gösterilecek mesaj. */
export function allocationSumIssue(
  amount: number,
  allocations: readonly { amount: number }[],
): string | null {
  const total = allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (total === amount) return null;
  const difference = amount - total;
  return difference > 0
    ? `Payların toplamı ${formatTl(amount)} olmalı; ${formatTl(difference)} daha dağıtılmalı.`
    : `Payların toplamı ${formatTl(amount)} olmalı; ${formatTl(-difference)} fazla dağıtıldı.`;
}

function sameProject(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? null) === (b ?? null);
}

/**
 * Gelir/gider hareketinin paylarını doğrular: tutarlar, pay toplamı, kapsam ve anlaşma uyumu.
 * Anlaşmalar `agreements` içinden kimlikle bulunur; bulunamayan anlaşma hata sayılır.
 */
export function validateTransactionAllocations(
  input: {
    kind: CashKind;
    amount: number;
    partyId?: string | null;
    allocations: readonly AllocationInput[];
  },
  agreements: ReadonlyMap<string, AgreementRef>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (code: string, message: string, path: (string | number)[]) =>
    issues.push({ code, message, path });

  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
    add('AMOUNT_INVALID', 'Tutar 0’dan büyük olmalı.', ['amount']);
  }
  if (input.allocations.length === 0) {
    add('ALLOCATION_REQUIRED', 'En az bir pay olmalı.', ['allocations']);
    return issues;
  }

  const direction = directionOfKind(input.kind);
  let partyIssueAdded = false;
  input.allocations.forEach((allocation, index) => {
    const path = ['allocations', index];
    if (!Number.isSafeInteger(allocation.amount) || allocation.amount <= 0) {
      add('AMOUNT_INVALID', 'Pay tutarı 0’dan büyük olmalı.', [...path, 'amount']);
    }
    const scopeMessage = scopeIssue(allocation);
    if (scopeMessage) add('SCOPE_INVALID', scopeMessage, [...path, 'projectId']);

    if (!allocation.agreementId) return;
    const agreement = agreements.get(allocation.agreementId);
    if (!agreement) {
      add('AGREEMENT_NOT_FOUND', 'Anlaşma bulunamadı.', [...path, 'agreementId']);
      return;
    }
    if (agreement.direction !== direction) {
      add(
        'DIRECTION_MISMATCH',
        direction === 'payable'
          ? 'Gider yalnız ödenecek anlaşmaya bağlanabilir.'
          : 'Gelir yalnız tahsil edilecek anlaşmaya bağlanabilir.',
        [...path, 'agreementId'],
      );
    }
    if (
      agreement.scope !== allocation.scope ||
      !sameProject(agreement.projectId, allocation.projectId)
    ) {
      add('SCOPE_MISMATCH', 'Payın kapsamı anlaşmanın kapsamıyla aynı olmalı.', [...path, 'scope']);
    }
    // Kişi hatası, birden fazla pay anlaşmaya bağlı olsa da bir kez yazılır.
    if (partyIssueAdded) return;
    if (!input.partyId) {
      add('PARTY_REQUIRED', 'Anlaşmaya bağlı kayıtta kişi/firma seçilmeli.', ['partyId']);
      partyIssueAdded = true;
    } else if (agreement.partyId !== input.partyId) {
      add('PARTY_MISMATCH', 'Kişi/firma anlaşmanın kişisiyle aynı olmalı.', ['partyId']);
      partyIssueAdded = true;
    }
  });

  if (Number.isSafeInteger(input.amount)) {
    const sumMessage = allocationSumIssue(input.amount, input.allocations);
    if (sumMessage) add('ALLOCATION_SUM_MISMATCH', sumMessage, ['allocations']);
  }

  return issues;
}

export interface ExcessResult {
  total: number;
  byAgreement: { agreementId: string; amount: number }[];
}

/**
 * Hareketin anlaşmalara bağlanan paylarının, anlaşmaların bu hareketten önceki kalanını
 * ne kadar aştığı. Aynı anlaşmaya giden paylar birlikte değerlendirilir.
 */
export function detectExcess(
  allocations: readonly AllocationInput[],
  remainingByAgreement: ReadonlyMap<string, number>,
): ExcessResult {
  const amounts = new Map<string, number>();
  for (const allocation of allocations) {
    if (!allocation.agreementId) continue;
    assertKurus(allocation.amount, 'pay tutarı');
    amounts.set(
      allocation.agreementId,
      (amounts.get(allocation.agreementId) ?? 0) + allocation.amount,
    );
  }

  const byAgreement: ExcessResult['byAgreement'] = [];
  for (const [agreementId, amount] of amounts) {
    const remaining = remainingByAgreement.get(agreementId);
    if (remaining === undefined)
      throw new RangeError(`Anlaşmanın kalanı verilmedi: ${agreementId}`);
    assertKurus(remaining, 'kalan');
    const excess = amount - remaining;
    if (excess > 0) byAgreement.push({ agreementId, amount: excess });
  }
  return { total: byAgreement.reduce((sum, item) => sum + item.amount, 0), byAgreement };
}

/** Şartname 12: "Bu ödeme anlaşmanın kalanını {tutar} aşıyor." */
export function excessMessage(kind: CashKind, excess: number): string {
  const subject = kind === 'expense' ? 'Bu ödeme' : 'Bu tahsilat';
  return `${subject} anlaşmanın kalanını ${formatTl(excess)} aşıyor.`;
}
