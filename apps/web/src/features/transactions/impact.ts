// Etki önizlemesi (şartname 4.4, 7.4, 7.5, 7.9): bir hareketin eklenmesi, çıkarılması veya
// düzeltilmesinin firma toplamına, şantiye toplamlarına ve anlaşma bakiyelerine etkisi.
// Hesaplar `previewCashTotals` ve `previewAgreementBalance` ile yapılır.

import {
  directionOfKind,
  previewAgreementBalance,
  previewCashTotals,
  type CashTotals,
  type TransactionKind,
} from '@santiye/shared';
import { useQueries } from '@tanstack/react-query';
import { apiGet } from '../../api/client';
import { keys, useTransactions } from '../../api/queries';
import type { AgreementDetail, ProjectSummary, Transaction } from '../../api/types';
import type { ImpactGroup } from '../../components/ui/ImpactPreview';

export interface ImpactAllocation {
  scope: 'project' | 'company';
  projectId: string | null;
  agreementId: string | null;
  /** Toplamlara giren tutar (pay). */
  amount: number;
  /** Anlaşmanın net ödenen/tahsil edilen tutarına etkisi. */
  agreementNet: number;
}

/** Hareketin mevcut paylarının etkisi: gelir/giderde pay − iadeler, iadede kaynak payı azaltır. */
export function allocationsEffect(transaction: Pick<Transaction, 'kind' | 'allocations'>) {
  const refund = transaction.kind === 'expense_refund' || transaction.kind === 'income_refund';
  return transaction.allocations.map<ImpactAllocation>((allocation) => ({
    scope: allocation.scope,
    projectId: allocation.projectId,
    agreementId: allocation.agreementId,
    amount: allocation.amount,
    agreementNet: refund ? -allocation.amount : allocation.amount - allocation.refundedAmount,
  }));
}

function sumBy(
  items: ImpactAllocation[],
  key: (a: ImpactAllocation) => string | null,
  value: (a: ImpactAllocation) => number,
) {
  const result = new Map<string, number>();
  for (const item of items) {
    const id = key(item);
    if (!id) continue;
    result.set(id, (result.get(id) ?? 0) + value(item));
  }
  return result;
}

/** Önce/sonra pay listelerinden kapsam ve anlaşma bazında değişimler. */
export function impactDeltas(before: ImpactAllocation[], after: ImpactAllocation[]) {
  const diff = (
    key: (a: ImpactAllocation) => string | null,
    value: (a: ImpactAllocation) => number,
  ) => {
    const b = sumBy(before, key, value);
    const a = sumBy(after, key, value);
    const ids = new Set([...b.keys(), ...a.keys()]);
    return new Map([...ids].map((id) => [id, (a.get(id) ?? 0) - (b.get(id) ?? 0)]));
  };
  const total = (items: ImpactAllocation[]) => items.reduce((sum, a) => sum + a.amount, 0);
  return {
    company: total(after) - total(before),
    projects: diff(
      (a) => (a.scope === 'project' ? a.projectId : null),
      (a) => a.amount,
    ),
    agreements: diff(
      (a) => a.agreementId,
      (a) => a.agreementNet,
    ),
  };
}

function withDelta(totals: CashTotals, kind: TransactionKind, delta: number): CashTotals {
  return previewCashTotals(totals, { kind, amount: Math.abs(delta), sign: delta >= 0 ? 1 : -1 });
}

function cashRows(kind: TransactionKind, before: CashTotals, after: CashTotals) {
  const payable = directionOfKind(kind) === 'payable';
  return [
    payable
      ? { label: 'Ödeme (net)', before: before.netExpense, after: after.netExpense }
      : { label: 'Tahsilat (net)', before: before.netIncome, after: after.netIncome },
    { label: 'Gelir − gider farkı', before: before.difference, after: after.difference },
  ];
}

/**
 * Önizleme grupları. Veriler (firma toplamı, şantiye özetleri, anlaşmalar) güncel halleriyle yüklenir;
 * yüklenemezse önizleme kesin gibi gösterilmez.
 */
export function useImpactPreview(
  kind: TransactionKind | undefined,
  before: ImpactAllocation[],
  after: ImpactAllocation[],
  options: { enabled?: boolean; projectNames?: Record<string, string> } = {},
): { groups: ImpactGroup[]; loading: boolean; error: unknown } {
  const { enabled = true, projectNames = {} } = options;
  const deltas = impactDeltas(before, after);
  const projectIds = [...deltas.projects.keys()];
  const agreementIds = [...deltas.agreements.keys()];
  const company = useTransactions({ kind: 'all', limit: 1 }, enabled && Boolean(kind));
  const projectSummaries = useQueries({
    queries: projectIds.map((id) => ({
      queryKey: keys.projectSummary(id),
      queryFn: () => apiGet<ProjectSummary>(`/projects/${id}/summary`),
      enabled,
    })),
  });
  const agreements = useQueries({
    queries: agreementIds.map((id) => ({
      queryKey: keys.agreement(id),
      queryFn: () => apiGet<AgreementDetail>(`/agreements/${id}`),
      enabled,
    })),
  });

  const loading =
    !kind ||
    company.isPending ||
    projectSummaries.some((q) => q.isPending) ||
    agreements.some((q) => q.isPending);
  const error =
    company.error ??
    projectSummaries.find((q) => q.error)?.error ??
    agreements.find((q) => q.error)?.error ??
    null;
  if (loading || error || !kind || !company.data) return { groups: [], loading, error };

  const groups: ImpactGroup[] = [];
  if (deltas.company !== 0) {
    const totals = company.data.totals;
    groups.push({
      title: 'Firma toplamı',
      rows: cashRows(kind, totals, withDelta(totals, kind, deltas.company)),
    });
  }
  projectIds.forEach((id, index) => {
    const delta = deltas.projects.get(id) ?? 0;
    const summary = projectSummaries[index]?.data;
    if (!summary || delta === 0) return;
    groups.push({
      title: `Şantiye: ${projectNames[id] ?? 'şantiye'}`,
      rows: cashRows(kind, summary.cash, withDelta(summary.cash, kind, delta)),
    });
  });
  agreementIds.forEach((id, index) => {
    const delta = deltas.agreements.get(id) ?? 0;
    const agreement = agreements[index]?.data;
    if (!agreement || delta === 0) return;
    // Geçersiz giriş (ör. netten büyük iade) önizlenmez; sunucu zaten reddeder.
    if (agreement.netSettled + delta < 0) return;
    const after = previewAgreementBalance(agreement, { netDelta: delta });
    const payable = agreement.direction === 'payable';
    groups.push({
      title: agreement.label,
      rows: [
        {
          label: payable ? 'Net ödenen' : 'Net tahsil edilen',
          before: agreement.netSettled,
          after: after.netSettled,
        },
        {
          label: payable ? 'Kalan borç' : 'Kalan alacak',
          before: agreement.remaining,
          after: after.remaining,
        },
        {
          label: payable ? 'Fazla ödeme' : 'Fazla tahsilat',
          before: agreement.excess,
          after: after.excess,
        },
      ],
    });
  });
  return { groups, loading: false, error: null };
}
