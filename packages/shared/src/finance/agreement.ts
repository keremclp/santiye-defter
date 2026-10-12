// Anlaşma ve başlangıç kaydı hesapları (şartname 8.7, 9.2, 9.3).

import { addDays, compareIsoDates, daysBetween } from '../date.js';
import type { Direction, PaymentStatus } from '../domain.js';
import { assertKurus } from '../money.js';

/** Anlaşmaya bağlı, silinmemiş bir hareket payı ve ona yapılan aktif iadelerin toplamı. */
export interface LinkedAllocation {
  amount: number;
  refundedAmount: number;
}

export interface AgreementBalance {
  netSettled: number;
  remaining: number;
  excess: number;
  paymentStatus: PaymentStatus;
}

/** Net ödenen/tahsil edilen: bağlı paylar − bu paylara yapılan aktif iadeler. */
export function computeNetSettled(linked: readonly LinkedAllocation[]): number {
  return linked.reduce((sum, allocation) => {
    assertKurus(allocation.amount, 'pay tutarı');
    assertKurus(allocation.refundedAmount, 'iade toplamı');
    if (allocation.amount <= 0) throw new RangeError('Pay tutarı 0’dan büyük olmalı');
    if (allocation.refundedAmount < 0 || allocation.refundedAmount > allocation.amount) {
      throw new RangeError('İade toplamı 0 ile pay tutarı arasında olmalı');
    }
    return sum + allocation.amount - allocation.refundedAmount;
  }, 0);
}

/**
 * Ödeme durumu yalnız net, kalan ve fazladan hesaplanır:
 * fazla > 0 → overpaid; kalan 0 → settled; net 0 → open; aksi halde partial.
 */
export function paymentStatusOf(balance: {
  netSettled: number;
  remaining: number;
  excess: number;
}): PaymentStatus {
  if (balance.excess > 0) return 'overpaid';
  if (balance.remaining === 0) return 'settled';
  if (balance.netSettled === 0) return 'open';
  return 'partial';
}

/** Kalan = max(bedel − net, 0); fazla = max(net − bedel, 0). */
export function computeAgreementBalance(
  currentAmount: number,
  linked: readonly LinkedAllocation[],
): AgreementBalance {
  assertKurus(currentAmount, 'anlaşma bedeli');
  if (currentAmount < 0) throw new RangeError('Anlaşma bedeli negatif olamaz');

  const netSettled = computeNetSettled(linked);
  const remaining = Math.max(currentAmount - netSettled, 0);
  const excess = Math.max(netSettled - currentAmount, 0);
  return {
    netSettled,
    remaining,
    excess,
    paymentStatus: paymentStatusOf({ netSettled, remaining, excess }),
  };
}

export const DEFAULT_UPCOMING_DAYS = 30;

/**
 * Vade grubu. Açık tutarı olmayan kayıt hiçbir gruba girmez (null).
 * - overdue: vade < bugün (İstanbul)
 * - upcoming: bugün ≤ vade ≤ bugün + `upcomingDays`
 * - later: vade daha ileride
 * - none: vadesi belirlenmemiş; gecikmiş sayılmaz
 */
export type DueState = 'overdue' | 'upcoming' | 'later' | 'none';

export function dueStateOf(
  item: { dueDate: string | null | undefined; remaining: number },
  today: string,
  upcomingDays: number = DEFAULT_UPCOMING_DAYS,
): DueState | null {
  assertKurus(item.remaining, 'kalan');
  if (item.remaining <= 0) return null;
  if (!item.dueDate) return 'none';
  if (compareIsoDates(item.dueDate, today) < 0) return 'overdue';
  if (compareIsoDates(item.dueDate, addDays(today, upcomingDays)) <= 0) return 'upcoming';
  return 'later';
}

/** Tek vadede gecikmiş tutar kalanın tamamıdır; kısmi ödeme kalanı azaltır, vadeyi ertelemez. */
export function overdueAmountOf(
  item: { dueDate: string | null | undefined; remaining: number },
  today: string,
): number {
  return dueStateOf(item, today) === 'overdue' ? item.remaining : 0;
}

/** Vade gününden bu yana geçen gün; gecikme yoksa 0. */
export function overdueDaysOf(dueDate: string, today: string): number {
  return Math.max(daysBetween(dueDate, today), 0);
}

export interface AgreementSummaryItem {
  direction: Direction;
  currentAmount: number;
  netSettled: number;
  remaining: number;
  excess: number;
  dueDate?: string | null;
}

export interface DirectionSummary {
  /** Güncel bedellerin toplamı */
  totalAmount: number;
  netSettled: number;
  remaining: number;
  excess: number;
  overdue: number;
}

/** Borç ve alacak ayrı toplanır; birbirinden mahsup edilmez (şartname 9.1). */
export function summarizeAgreements(
  items: readonly AgreementSummaryItem[],
  today: string,
): Record<Direction, DirectionSummary> {
  const empty = (): DirectionSummary => ({
    totalAmount: 0,
    netSettled: 0,
    remaining: 0,
    excess: 0,
    overdue: 0,
  });
  const summary: Record<Direction, DirectionSummary> = { payable: empty(), receivable: empty() };

  for (const item of items) {
    const target = summary[item.direction];
    target.totalAmount += item.currentAmount;
    target.netSettled += item.netSettled;
    target.remaining += item.remaining;
    target.excess += item.excess;
    target.overdue += overdueAmountOf({ dueDate: item.dueDate, remaining: item.remaining }, today);
  }
  return summary;
}
