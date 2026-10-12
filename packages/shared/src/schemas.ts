// API ve web'in ortak giriş şemaları (şartname 8.6, 8.7, 10.6, 10.7).
// Gövde biçimini ve tek kayıt içindeki kuralları denetler; anlaşma uyumu gibi başka kayda
// bağlı kurallar `validateTransactionAllocations` ve `validateRefund` ile denetlenir.

import { z } from 'zod';
import { isIsoDate } from './date.js';
import { CASH_KINDS, DIRECTIONS, SCOPES } from './domain.js';
import { allocationSumIssue, scopeIssue } from './finance/allocation.js';
import { formatTl } from './money.js';

// Şemalardan gelen hazır mesajlar Türkçe olsun.
z.config(z.locales.tr());

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Geçersiz kayıt kimliği.');

export const isoDateSchema = z
  .string()
  .refine(isIsoDate, 'Tarih YYYY-AA-GG biçiminde geçerli bir gün olmalı.');

const kurusBaseSchema = z
  .number()
  .int('Tutar kuruş cinsinden tamsayı olmalı.')
  .max(Number.MAX_SAFE_INTEGER, 'Tutar çok büyük.');

export const kurusSchema = kurusBaseSchema.min(0, 'Tutar negatif olamaz.');

export const positiveKurusSchema = kurusBaseSchema.min(1, 'Tutar 0’dan büyük olmalı.');

export const reasonSchema = z.string().trim().min(1, 'Gerekçe girin.');

const descriptionSchema = z.string().trim().default('');

function refineScope(
  value: { scope: (typeof SCOPES)[number]; projectId?: string | undefined },
  ctx: z.RefinementCtx,
) {
  const message = scopeIssue(value);
  if (message) ctx.addIssue({ code: 'custom', message, path: ['projectId'] });
}

export const allocationInputSchema = z
  .object({
    scope: z.enum(SCOPES),
    projectId: objectIdSchema.optional(),
    agreementId: objectIdSchema.optional(),
    amount: positiveKurusSchema,
  })
  .superRefine(refineScope);

export const transactionCreateSchema = z
  .object({
    kind: z.enum(CASH_KINDS),
    amount: positiveKurusSchema,
    date: isoDateSchema,
    partyId: objectIdSchema.optional(),
    categoryId: objectIdSchema.optional(),
    description: descriptionSchema,
    allocations: z.array(allocationInputSchema).min(1, 'En az bir pay olmalı.'),
    confirmExcess: z.boolean().optional(),
    excessReason: z.string().trim().optional(),
    /** Tamamlanan veya arşivlenen şantiyeye anlaşmasız gider için zorunlu */
    reason: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    const sumMessage = allocationSumIssue(value.amount, value.allocations);
    if (sumMessage) ctx.addIssue({ code: 'custom', message: sumMessage, path: ['allocations'] });
    if (value.categoryId && value.kind !== 'expense') {
      ctx.addIssue({
        code: 'custom',
        message: 'Gider kategorisi yalnız giderde seçilebilir.',
        path: ['categoryId'],
      });
    }
    if (value.confirmExcess && !value.excessReason) {
      ctx.addIssue({
        code: 'custom',
        message: 'Fazla ödeme için gerekçe girin.',
        path: ['excessReason'],
      });
    }
  });

export const refundCreateSchema = z
  .object({
    amount: positiveKurusSchema,
    date: isoDateSchema,
    reason: reasonSchema,
    parts: z
      .array(z.object({ allocationId: objectIdSchema, amount: positiveKurusSchema }))
      .min(1, 'İade edilecek pay seçilmeli.'),
  })
  .superRefine((value, ctx) => {
    const total = value.parts.reduce((sum, part) => sum + part.amount, 0);
    if (total !== value.amount) {
      ctx.addIssue({
        code: 'custom',
        message: `İade paylarının toplamı ${formatTl(value.amount)} olmalı.`,
        path: ['parts'],
      });
    }
  });

const obligationFields = {
  direction: z.enum(DIRECTIONS),
  scope: z.enum(SCOPES),
  projectId: objectIdSchema.optional(),
  partyId: objectIdSchema,
  dueDate: isoDateSchema.optional(),
  description: descriptionSchema,
};

export const agreementInputSchema = z
  .object({
    kind: z.literal('agreement'),
    title: z.string().trim().min(1, 'Anlaşma adı girin.'),
    ...obligationFields,
    /** Toplam bedel */
    initialAmount: positiveKurusSchema,
    agreementDate: isoDateSchema.optional(),
  })
  .superRefine(refineScope);

export const openingInputSchema = z
  .object({
    kind: z.literal('opening'),
    ...obligationFields,
    /** Takip başlangıcında gerçekten açık kalan tutar */
    initialAmount: positiveKurusSchema,
    trackingStartDate: isoDateSchema,
  })
  .superRefine(refineScope);

/** `POST /agreements` gövdesi: anlaşma veya başlangıç kaydı. */
export const agreementCreateSchema = z.discriminatedUnion('kind', [
  agreementInputSchema,
  openingInputSchema,
]);

export type AllocationInputBody = z.infer<typeof allocationInputSchema>;
export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type RefundCreateInput = z.infer<typeof refundCreateSchema>;
export type AgreementInput = z.infer<typeof agreementInputSchema>;
export type OpeningInput = z.infer<typeof openingInputSchema>;
export type AgreementCreateInput = z.infer<typeof agreementCreateSchema>;
