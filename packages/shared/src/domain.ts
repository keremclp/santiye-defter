// Şartname 8.6 ve 8.7'deki sabit değer kümeleri.

export const TRANSACTION_KINDS = ['income', 'expense', 'expense_refund', 'income_refund'] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

/** Doğrudan oluşturulabilen para hareketleri; iadeler kaynak hareketten açılır. */
export const CASH_KINDS = ['income', 'expense'] as const;
export type CashKind = (typeof CASH_KINDS)[number];

export const DIRECTIONS = ['payable', 'receivable'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const SCOPES = ['project', 'company'] as const;
export type Scope = (typeof SCOPES)[number];

export const AGREEMENT_KINDS = ['agreement', 'opening'] as const;
export type AgreementKind = (typeof AGREEMENT_KINDS)[number];

export const WORK_STATUSES = ['ongoing', 'completed', 'cancelled'] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const PAYMENT_STATUSES = ['open', 'partial', 'settled', 'overpaid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Gider ↔ ödenecek, gelir ↔ tahsil edilecek; iade kaynağının yönünü taşır. */
export function directionOfKind(kind: TransactionKind): Direction {
  return kind === 'expense' || kind === 'expense_refund' ? 'payable' : 'receivable';
}

export function refundKindOf(kind: CashKind): 'expense_refund' | 'income_refund' {
  return kind === 'expense' ? 'expense_refund' : 'income_refund';
}

/** Bir hareket sonucu bulunan kural ihlali. `path` istek gövdesindeki alanı gösterir. */
export interface ValidationIssue {
  code: string;
  message: string;
  path: (string | number)[];
}
