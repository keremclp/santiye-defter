// Kullanım (yalnız sunucuda): pnpm --filter api platform:reset-2fa --username <ad>
// Ürün sahibinin TOTP'sini ve kurtarma kodlarını sıfırlar, oturumlarını düşürür ve kayıt bırakır.

import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config.js';
import { connectDatabase, disconnectDatabase } from '../db/connection.js';
import { systemClock, type Clock } from '../lib/clock.js';
import { loadLocalEnvFile } from '../load-env.js';
import { resetPlatformTwoFactor } from '../services/platform-auth.js';

export function parseUsernameArg(argv: readonly string[]): string | null {
  const index = argv.indexOf('--username');
  const value = index >= 0 ? argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value : null;
}

/** Veritabanına bağlı ortamda komutu çalıştırır; çıkış kodu döner. */
export async function runResetTwoFactor(
  argv: readonly string[],
  io: { out: (line: string) => void; err: (line: string) => void },
  clock: Clock = systemClock,
): Promise<number> {
  const username = parseUsernameArg(argv);
  if (!username) {
    io.err('Kullanım: pnpm --filter api platform:reset-2fa --username <ad>');
    return 2;
  }
  if (!(await resetPlatformTwoFactor(username, clock))) {
    io.err(`Ürün sahibi hesabı bulunamadı: ${username}`);
    return 1;
  }
  io.out(
    `İki aşamalı doğrulama sıfırlandı: ${username}. Bütün oturumlar kapatıldı; sonraki girişte kurulum zorunlu.`,
  );
  return 0;
}

async function main(): Promise<void> {
  loadLocalEnvFile();
  const config = loadConfig();
  await connectDatabase(config.mongodbUri);
  try {
    process.exitCode = await runResetTwoFactor(process.argv.slice(2), {
      out: (line) => console.log(line),
      err: (line) => console.error(line),
    });
  } finally {
    await disconnectDatabase();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
