import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { createLogger } from './lib/logger.js';

// Yerelde depo kökündeki .env okunur; üretimde değişkenler ortamdan gelir.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const logger = createLogger();

try {
  const config = loadConfig();
  await connectDatabase(config.mongodbUri);

  const app = createApp({ webOrigin: config.webOrigin, logger });
  const server = app.listen(config.port, () => {
    logger.info('API çalışıyor', { port: config.port });
  });
  server.on('error', (error) => {
    logger.error('API başlatılamadı', { error: error.message });
    process.exit(1);
  });

  const shutdown = (signal: string) => {
    logger.info('API kapatılıyor', { signal });
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  logger.error('API başlatılamadı', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}
