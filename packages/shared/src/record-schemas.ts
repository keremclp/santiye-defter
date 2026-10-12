// Şantiye, kişi, kategori, firma ve kayıt güncelleme şemaları (şartname 7.2–7.6, 7.11, 10.3–10.7).

import { z } from 'zod';
import { expectedUpdatedAtSchema } from './account-schemas.js';
import { SCOPES } from './domain.js';
import { scopeIssue } from './finance/allocation.js';
import {
  isoDateSchema,
  kurusSchema,
  objectIdSchema,
  positiveKurusSchema,
  reasonSchema,
} from './schemas.js';

export const PARTY_KINDS = ['person', 'company'] as const;
export const PARTY_TAGS = ['supplier', 'subcontractor', 'customer'] as const;
export const PROJECT_STATUSES = ['active', 'completed', 'archived'] as const;

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} çok uzun.`);

const emailSchema = z
  .string()
  .trim()
  .max(200, 'E-posta çok uzun.')
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    'Geçerli bir e-posta girin.',
  );

const contactSchema = z.object({
  person: optionalText(100, 'Yetkili adı').default(''),
  phone: optionalText(30, 'Telefon').default(''),
  email: emailSchema.default(''),
});

/** Silme ve geri yükleme: gerekçe ve önizlenen kaydın sürümü. */
export const recordChangeSchema = z.object({
  reason: reasonSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const pinSchema = z.object({ pinned: z.boolean() });

// ── Firma ──────────────────────────────────────────────────────────────────────

export const companyUpdateSchema = z.object({
  displayName: optionalText(200, 'Firma adı').optional(),
  contact: contactSchema.optional(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

// ── Kategori ───────────────────────────────────────────────────────────────────

const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'Kategori adını girin.')
  .max(100, 'Kategori adı çok uzun.');

export const categoryCreateSchema = z.object({ name: categoryNameSchema });

export const categoryUpdateSchema = z.object({
  name: categoryNameSchema.optional(),
  isActive: z.boolean().optional(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

// ── Şantiye ────────────────────────────────────────────────────────────────────

const projectFields = {
  name: z.string().trim().min(1, 'Proje adını girin.').max(200, 'Proje adı çok uzun.'),
  description: optionalText(2000, 'Açıklama'),
  address: optionalText(500, 'Adres'),
  startDate: isoDateSchema.nullable(),
};

export const projectCreateSchema = z.object({
  name: projectFields.name,
  description: projectFields.description.default(''),
  address: projectFields.address.default(''),
  /** Bilinmiyorsa boş kalır; bugün zorla yazılmaz */
  startDate: projectFields.startDate.default(null),
});

export const projectUpdateSchema = z.object({
  name: projectFields.name.optional(),
  description: projectFields.description.optional(),
  address: projectFields.address.optional(),
  startDate: projectFields.startDate.optional(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const projectCompleteSchema = z.object({
  /** Verilmezse bugün (İstanbul) */
  completedAt: isoDateSchema.optional(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const projectReactivateSchema = recordChangeSchema;

export const projectArchiveSchema = z.object({
  archived: z.boolean(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

// ── Kişi / firma ───────────────────────────────────────────────────────────────

const partyFields = {
  name: z.string().trim().min(1, 'Ad / unvan girin.').max(200, 'Ad çok uzun.'),
  kind: z.enum(PARTY_KINDS),
  tags: z.array(z.enum(PARTY_TAGS)).transform((tags) => [...new Set(tags)]),
  phone: optionalText(30, 'Telefon'),
  email: emailSchema,
  address: optionalText(500, 'Adres'),
  note: optionalText(2000, 'Not'),
};

export const partyCreateSchema = z.object({
  name: partyFields.name,
  kind: partyFields.kind.default('company'),
  tags: partyFields.tags.default([]),
  phone: partyFields.phone.default(''),
  email: partyFields.email.default(''),
  address: partyFields.address.default(''),
  note: partyFields.note.default(''),
});

export const partyUpdateSchema = z.object({
  name: partyFields.name.optional(),
  kind: partyFields.kind.optional(),
  tags: partyFields.tags.optional(),
  phone: partyFields.phone.optional(),
  email: partyFields.email.optional(),
  address: partyFields.address.optional(),
  note: partyFields.note.optional(),
  isActive: z.boolean().optional(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

// ── İşlem düzeltme, iade düzeltme, geri yükleme ────────────────────────────────

/** Düzeltmede mevcut paylar kimlikleriyle gelir; iadesi olan pay böylece izlenir. */
export const allocationUpdateSchema = z
  .object({
    id: objectIdSchema.optional(),
    scope: z.enum(SCOPES),
    projectId: objectIdSchema.optional(),
    agreementId: objectIdSchema.optional(),
    amount: positiveKurusSchema,
  })
  .superRefine((value, ctx) => {
    const message = scopeIssue(value);
    if (message) ctx.addIssue({ code: 'custom', message, path: ['projectId'] });
  });

/**
 * `PATCH /transactions/:id`. Gelir/giderde tutar, tarih, kişi, kategori, açıklama ve paylar;
 * iadede tutar, tarih, açıklama ve iade payları değişebilir. Finansal alan değişirse gerekçe zorunlu.
 */
export const transactionCorrectionSchema = z.object({
  amount: positiveKurusSchema.optional(),
  date: isoDateSchema.optional(),
  partyId: objectIdSchema.nullable().optional(),
  categoryId: objectIdSchema.nullable().optional(),
  description: z.string().trim().max(2000, 'Açıklama çok uzun.').optional(),
  allocations: z.array(allocationUpdateSchema).min(1, 'En az bir pay olmalı.').optional(),
  parts: z
    .array(z.object({ allocationId: objectIdSchema, amount: positiveKurusSchema }))
    .min(1, 'İade edilecek pay seçilmeli.')
    .optional(),
  confirmExcess: z.boolean().optional(),
  excessReason: z.string().trim().optional(),
  reason: z.string().trim().optional(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const transactionRestoreSchema = recordChangeSchema.extend({
  confirmExcess: z.boolean().optional(),
  excessReason: z.string().trim().optional(),
});

// ── Anlaşma ────────────────────────────────────────────────────────────────────

export const agreementUpdateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Anlaşma adı girin.')
    .max(200, 'Anlaşma adı çok uzun.')
    .optional(),
  description: z.string().trim().max(2000, 'Açıklama çok uzun.').optional(),
  agreementDate: isoDateSchema.nullable().optional(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const agreementAmountSchema = z.object({
  newAmount: positiveKurusSchema,
  reason: reasonSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const agreementDueDateSchema = z.object({
  /** null vadeyi kaldırır */
  dueDate: isoDateSchema.nullable(),
  reason: reasonSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const agreementWorkStatusSchema = z.object({
  workStatus: z.enum(['ongoing', 'completed']),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const agreementCancelSchema = z.object({
  /** Kesinleşen bedel; verilmezse "İptal — hesap kesinleşmedi" */
  finalAmount: kurusSchema.optional(),
  reason: reasonSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type PartyCreateInput = z.infer<typeof partyCreateSchema>;
export type PartyUpdateInput = z.infer<typeof partyUpdateSchema>;
export type TransactionCorrectionInput = z.infer<typeof transactionCorrectionSchema>;
export type AllocationUpdateInput = z.infer<typeof allocationUpdateSchema>;
