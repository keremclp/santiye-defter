import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Yerelde depo kökündeki .env okunur; üretimde değişkenler ortamdan gelir. */
export function loadLocalEnvFile(): void {
  const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}
