// Anlaşma ve başlangıç kaydı özetleri: borç ve alacak ayrı, mahsup yok (şartname 9.1).

import {
  summarizeAgreements,
  type AgreementSummaryItem,
  type DirectionSummary,
} from '@santiye/shared';
import type { QueryFilter, Types } from 'mongoose';
import { AgreementModel, type Agreement } from '../models/agreement.js';

export interface ObligationSummary {
  payable: DirectionSummary;
  receivable: DirectionSummary;
  /** Başlangıç kayıtları yukarıdaki toplamlara dahildir; burada ayrıca gösterilir. */
  openings: { payable: DirectionSummary; receivable: DirectionSummary };
}

type SummaryRow = AgreementSummaryItem & { kind: Agreement['kind'] };

export function summarizeObligations(rows: SummaryRow[], today: string): ObligationSummary {
  const all = summarizeAgreements(rows, today);
  const openings = summarizeAgreements(
    rows.filter((row) => row.kind === 'opening'),
    today,
  );
  return { payable: all.payable, receivable: all.receivable, openings };
}

/** Filtreye uyan silinmemiş anlaşma ve başlangıç kayıtlarının özeti. */
export async function obligationSummary(
  companyId: Types.ObjectId,
  filter: QueryFilter<Agreement>,
  today: string,
): Promise<ObligationSummary> {
  const rows = await AgreementModel.find(
    { ...filter, companyId, deletedAt: null },
    { kind: 1, direction: 1, currentAmount: 1, netSettled: 1, remaining: 1, excess: 1, dueDate: 1 },
  ).lean<SummaryRow[]>();
  return summarizeObligations(rows, today);
}
