// Kimlik, profil ve ürün sahibi yönetimi giriş şemaları (şartname 8.1, 8.2, 9.8, 10.1, 10.10).

import { z } from 'zod';
import { isoDateSchema, reasonSchema } from './schemas.js';

/** Kullanıcı adı sistem genelinde tek; kırpılır ve Türkçe kurallarla küçük harfe çevrilir. */
export function normalizeUsername(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

const USERNAME_PATTERN = /^[a-z0-9çğıöşü._-]{3,50}$/u;

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .regex(
        USERNAME_PATTERN,
        'Kullanıcı adı 3–50 karakter olmalı; harf, rakam, nokta, alt çizgi ve tire içerebilir.',
      ),
  );

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
  }
  return bytes;
}

// bcrypt en fazla 72 baytı dikkate alır.
export const passwordSchema = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı.')
  .refine((value) => utf8ByteLength(value) <= 72, 'Şifre çok uzun.');

export const personNameSchema = z
  .string()
  .trim()
  .min(2, 'Ad en az 2 karakter olmalı.')
  .max(100, 'Ad çok uzun.');

const phoneSchema = z.string().trim().max(30, 'Telefon çok uzun.');

const emailSchema = z
  .string()
  .trim()
  .max(200, 'E-posta çok uzun.')
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    'Geçerli bir e-posta girin.',
  );

export const expectedUpdatedAtSchema = z.iso.datetime({
  offset: true,
  message: 'Kaydın son güncellenme zamanı gerekli.',
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Kullanıcı adını girin.'),
  password: z.string().min(1, 'Şifreyi girin.'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Oturum bilgisi eksik.'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifreyi girin.'),
  newPassword: passwordSchema,
});

export const profileUpdateSchema = z.object({
  name: personNameSchema.optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const totpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Doğrulama uygulamasındaki 6 haneli kodu girin.'),
});

export const recoveryCodeSchema = z.object({
  recoveryCode: z.string().trim().min(1, 'Kurtarma kodunu girin.'),
});

const companyNameSchema = z
  .string()
  .trim()
  .min(1, 'Firma adını girin.')
  .max(200, 'Firma adı çok uzun.');

const platformContactSchema = z.object({
  person: z.string().trim().max(100, 'Yetkili adı çok uzun.').default(''),
  phone: phoneSchema.default(''),
  email: emailSchema.default(''),
});

const opsNoteSchema = z.string().trim().max(2000, 'Not çok uzun.');
const optionalReasonSchema = z.string().trim().optional();

export const platformCompanyCreateSchema = z.object({
  name: companyNameSchema,
  contact: platformContactSchema.default({ person: '', phone: '', email: '' }),
  opsNote: opsNoteSchema.default(''),
  reason: optionalReasonSchema,
});

/** Ürün sahibinin kaydettiği ad, iletişim ve işletim notu (şartname 10.10). */
export const platformCompanyUpdateSchema = z.object({
  name: companyNameSchema.optional(),
  contact: platformContactSchema.optional(),
  opsNote: opsNoteSchema.optional(),
  reason: optionalReasonSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const platformUserCreateSchema = z.object({
  name: personNameSchema,
  username: usernameSchema,
  phone: phoneSchema.default(''),
  email: emailSchema.default(''),
  reason: optionalReasonSchema,
});

/**
 * Ad, kullanıcı adı ve aktiflik (şartname 10.10). Aktiflik değişiminde gerekçe zorunlu, ad ve
 * kullanıcı adı değişiminde isteğe bağlı (bölüm 9.8).
 */
export const platformUserUpdateSchema = z
  .object({
    name: personNameSchema.optional(),
    username: usernameSchema.optional(),
    isActive: z.boolean({ message: 'Kullanıcının aktif olup olmayacağı belirtilmeli.' }).optional(),
    reason: optionalReasonSchema,
    expectedUpdatedAt: expectedUpdatedAtSchema,
  })
  .superRefine((value, ctx) => {
    if (value.isActive !== undefined && !value.reason) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Gerekçe girin.' });
    }
  });

export const platformPasswordResetSchema = z.object({
  reason: reasonSchema,
});

/** Kapasite bayt cinsinden; mevcut kullanımın altına inemez (sunucuda denetlenir). */
export const platformQuotaSchema = z.object({
  quotaBytes: z
    .number({ message: 'Kapasiteyi girin.' })
    .int('Kapasite bayt cinsinden tamsayı olmalı.')
    .positive('Kapasite sıfırdan büyük olmalı.')
    .max(Number.MAX_SAFE_INTEGER, 'Kapasite çok büyük.'),
  reason: reasonSchema,
});

export const platformSuspendSchema = z.object({
  suspended: z.boolean({ message: 'Erişimin durdurulup durdurulmayacağı belirtilmeli.' }),
  reason: reasonSchema,
});

/** Önizlemede (`?preview=1`) gerekçe istenmez. */
export const platformEndServiceSchema = z.object({
  effectiveDate: isoDateSchema,
  reason: optionalReasonSchema,
});

export const platformReasonSchema = z.object({
  reason: reasonSchema,
});

export const platformExtendRetentionSchema = z.object({
  retainUntil: isoDateSchema,
  reason: reasonSchema,
});

export const platformCompanyDeleteSchema = z.object({
  confirmName: z.string().trim().min(1, 'Onay için firma adını yazın.'),
  reason: reasonSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PlatformCompanyCreateInput = z.infer<typeof platformCompanyCreateSchema>;
export type PlatformUserCreateInput = z.infer<typeof platformUserCreateSchema>;
export type PlatformCompanyUpdateInput = z.infer<typeof platformCompanyUpdateSchema>;
export type PlatformUserUpdateInput = z.infer<typeof platformUserUpdateSchema>;
export type PlatformQuotaInput = z.infer<typeof platformQuotaSchema>;
export type PlatformSuspendInput = z.infer<typeof platformSuspendSchema>;
export type PlatformEndServiceInput = z.infer<typeof platformEndServiceSchema>;
export type PlatformExtendRetentionInput = z.infer<typeof platformExtendRetentionSchema>;
export type PlatformCompanyDeleteInput = z.infer<typeof platformCompanyDeleteSchema>;
