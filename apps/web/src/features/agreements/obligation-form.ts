// Anlaşma ve başlangıç borç/alacak formu kuralları (şartname 7.6).

import { isIsoDate, todayInIstanbul, type Direction } from '@santiye/shared';
import { z } from 'zod';
import { moneyText } from '../../lib/forms';

const optionalDate = z.string().refine((v) => v === '' || isIsoDate(v), 'Geçerli bir tarih seçin.');

export const obligationSchema = z
  .object({
    mode: z.enum(['agreement', 'opening']),
    title: z.string().max(200, 'Anlaşma adı çok uzun.'),
    direction: z.enum(['payable', 'receivable']),
    scope: z.enum(['project', 'company']),
    projectId: z.string(),
    party: z.object({ id: z.string(), name: z.string() }).nullable(),
    amount: moneyText(),
    agreementDate: optionalDate,
    trackingStartDate: optionalDate,
    dueDate: optionalDate,
    description: z.string().max(2000, 'Açıklama çok uzun.'),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'agreement' && !value.title.trim()) {
      ctx.addIssue({ code: 'custom', message: 'Anlaşma adı girin.', path: ['title'] });
    }
    if (value.scope === 'project' && !value.projectId) {
      ctx.addIssue({ code: 'custom', message: 'Şantiye seçin.', path: ['projectId'] });
    }
    if (!value.party) {
      ctx.addIssue({ code: 'custom', message: 'Kişi/firma seçin.', path: ['party'] });
    }
    if (value.mode === 'opening' && !value.trackingStartDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'Takip başlangıç tarihini seçin.',
        path: ['trackingStartDate'],
      });
    }
  });

export type ObligationValues = z.infer<typeof obligationSchema>;

export const OBLIGATION_FIELDS = [
  'title',
  'projectId',
  'party',
  'amount',
  'agreementDate',
  'trackingStartDate',
  'dueDate',
  'description',
];

export function obligationDefaults(
  mode: 'agreement' | 'opening',
  context: {
    direction?: Direction;
    projectId?: string;
    general?: boolean;
    party?: { id: string; name: string } | null;
  },
): ObligationValues {
  return {
    mode,
    title: '',
    direction: context.direction ?? 'payable',
    scope: context.general ? 'company' : 'project',
    projectId: context.general ? '' : (context.projectId ?? ''),
    party: context.party ?? null,
    amount: '',
    agreementDate: '',
    trackingStartDate: mode === 'opening' ? todayInIstanbul() : '',
    dueDate: '',
    description: '',
  };
}
