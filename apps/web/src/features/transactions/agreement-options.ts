import { directionOfKind, type CashKind } from '@santiye/shared';
import { useAgreements } from '../../api/queries';
import type { Agreement } from '../../api/types';
import { formatMoney } from '../../lib/format';

/** Kişinin bu yöndeki anlaşmaları ve başlangıç kayıtları (ödeme önerisi için). */
export function usePartyAgreements(partyId: string | undefined, kind: CashKind) {
  return useAgreements({ partyId, direction: directionOfKind(kind), limit: 100 }, Boolean(partyId));
}

/**
 * Seçilen kişinin aynı kapsam ve yöndeki açık anlaşmaları önerilir; otomatik bağlanmaz
 * (şartname 7.4). Hesabı kesinleşmemiş iptaller de ödeme alabilir.
 */
export function agreementsForScope(
  agreements: Agreement[],
  scope: 'project' | 'company',
  projectId: string,
  selectedId: string,
): Agreement[] {
  return agreements.filter((agreement) => {
    if (agreement.id === selectedId) return true;
    const open = agreement.remaining > 0 || agreement.settlementPending;
    if (!open) return false;
    if (scope === 'company') return agreement.scope === 'company';
    return agreement.scope === 'project' && (!projectId || agreement.projectId === projectId);
  });
}

export function agreementOptionLabel(agreement: Agreement): string {
  return `${agreement.label} — kalan ${formatMoney(agreement.remaining)}`;
}
