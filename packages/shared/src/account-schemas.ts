// Kimlik, profil ve ürün sahibi yönetimi giriş şemaları (şartname 8.1, 8.2, 9.8, 10.1, 10.10).

import { z } from 'zod';
import { reasonSchema } from './schemas.js';

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

export const platformCompanyCreateSchema = z.object({
  name: z.string().trim().min(1, 'Firma adını girin.').max(200, 'Firma adı çok uzun.'),
  contact: z
    .object({
      person: z.string().trim().max(100, 'Yetkili adı çok uzun.').default(''),
      phone: phoneSchema.default(''),
      email: emailSchema.default(''),
    })
    .default({ person: '', phone: '', email: '' }),
  opsNote: z.string().trim().max(2000, 'Not çok uzun.').default(''),
  reason: z.string().trim().optional(),
});

export const platformUserCreateSchema = z.object({
  name: personNameSchema,
  username: usernameSchema,
  phone: phoneSchema.default(''),
  email: emailSchema.default(''),
  reason: z.string().trim().optional(),
});

export const platformUserActivationSchema = z.object({
  isActive: z.boolean({ message: 'Kullanıcının aktif olup olmayacağı belirtilmeli.' }),
  reason: reasonSchema,
  expectedUpdatedAt: expectedUpdatedAtSchema,
});

export const platformPasswordResetSchema = z.object({
  reason: reasonSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PlatformCompanyCreateInput = z.infer<typeof platformCompanyCreateSchema>;
export type PlatformUserCreateInput = z.infer<typeof platformUserCreateSchema>;
export type PlatformUserActivationInput = z.infer<typeof platformUserActivationSchema>;
