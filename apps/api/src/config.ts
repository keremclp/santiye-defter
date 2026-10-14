import { z } from 'zod';
import type { StorageConfig } from './lib/storage.js';

// Gizli olmayan yerel geliştirme varsayılanları; üretimde kullanılmaz.
const DEVELOPMENT_DEFAULTS = {
  MONGODB_URI: 'mongodb://localhost:27017/santiye_hesap?replicaSet=rs0',
  WEB_ORIGIN: 'http://localhost:5173',
};

/** Şartname bölüm 2: bcrypt maliyeti 12. */
export const BCRYPT_COST = 12;

const byteLength = (value: string) => Buffer.byteLength(value, 'utf8');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    MONGODB_URI: z.string().startsWith('mongodb'),
    WEB_ORIGIN: z.url(),
    APP_NAME: z.string().trim().min(1).default('Şantiye Hesap'),
    JWT_ACCESS_SECRET: z.string().min(32, 'En az 32 karakter olmalı.'),
    JWT_REFRESH_SECRET: z.string().min(32, 'En az 32 karakter olmalı.'),
    PLATFORM_TOTP_ENCRYPTION_KEY: z
      .string()
      .refine((value) => byteLength(value) >= 32, 'En az 32 bayt olmalı.'),
    PLATFORM_BOOTSTRAP_USERNAME: z.string().trim().optional(),
    PLATFORM_BOOTSTRAP_PASSWORD: z.string().optional(),
    STORAGE_ENDPOINT: z.url().optional(),
    STORAGE_BUCKET: z.string().trim().optional(),
    STORAGE_ACCESS_KEY: z.string().optional(),
    STORAGE_SECRET_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // Belge deposu üretimde zorunlu; geliştirmede boşsa belge işlemleri açık hatayla reddedilir.
    const storageKeys = [
      'STORAGE_ENDPOINT',
      'STORAGE_BUCKET',
      'STORAGE_ACCESS_KEY',
      'STORAGE_SECRET_KEY',
    ] as const;
    const anyStorage = storageKeys.some((key) => env[key]);
    if (env.NODE_ENV === 'production' || anyStorage) {
      for (const key of storageKeys) {
        if (!env[key])
          ctx.addIssue({ code: 'custom', message: 'Belge deposu için gerekli.', path: [key] });
      }
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        message: 'Access imzasından farklı olmalı.',
        path: ['JWT_REFRESH_SECRET'],
      });
    }
  });

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongodbUri: string;
  webOrigin: string;
  appName: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  totpEncryptionKey: string;
  platformBootstrap: { username: string; password: string } | null;
  bcryptCost: number;
  /** Belge deposu; geliştirmede ayarlanmamışsa null. */
  storage: StorageConfig | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // .env.example'dan kopyalanan boş değerler tanımsız sayılır.
  const provided = Object.fromEntries(
    Object.entries(env).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  const input =
    provided.NODE_ENV === 'production' ? provided : { ...DEVELOPMENT_DEFAULTS, ...provided };

  const result = envSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Ortam değişkenleri geçersiz:\n${z.prettifyError(result.error)}`);
  }
  const data = result.data;

  return {
    nodeEnv: data.NODE_ENV,
    port: data.PORT,
    mongodbUri: data.MONGODB_URI,
    webOrigin: data.WEB_ORIGIN,
    appName: data.APP_NAME,
    jwtAccessSecret: data.JWT_ACCESS_SECRET,
    jwtRefreshSecret: data.JWT_REFRESH_SECRET,
    totpEncryptionKey: data.PLATFORM_TOTP_ENCRYPTION_KEY,
    platformBootstrap:
      data.PLATFORM_BOOTSTRAP_USERNAME && data.PLATFORM_BOOTSTRAP_PASSWORD
        ? {
            username: data.PLATFORM_BOOTSTRAP_USERNAME,
            password: data.PLATFORM_BOOTSTRAP_PASSWORD,
          }
        : null,
    bcryptCost: BCRYPT_COST,
    storage:
      data.STORAGE_ENDPOINT &&
      data.STORAGE_BUCKET &&
      data.STORAGE_ACCESS_KEY &&
      data.STORAGE_SECRET_KEY
        ? {
            endpoint: data.STORAGE_ENDPOINT,
            bucket: data.STORAGE_BUCKET,
            accessKey: data.STORAGE_ACCESS_KEY,
            secretKey: data.STORAGE_SECRET_KEY,
          }
        : null,
  };
}
