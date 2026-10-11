import { z } from 'zod';

// Gizli olmayan yerel geliştirme varsayılanları; üretimde kullanılmaz.
const DEVELOPMENT_DEFAULTS = {
  MONGODB_URI: 'mongodb://localhost:27017/santiye_hesap?replicaSet=rs0',
  WEB_ORIGIN: 'http://localhost:5173',
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  MONGODB_URI: z.string().startsWith('mongodb'),
  WEB_ORIGIN: z.url(),
});

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongodbUri: string;
  webOrigin: string;
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

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    mongodbUri: result.data.MONGODB_URI,
    webOrigin: result.data.WEB_ORIGIN,
  };
}
