import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { createDeps } from './deps.js';
import { createLogger } from './lib/logger.js';
import { loadLocalEnvFile } from './load-env.js';
import { initModels } from './models/index.js';
import { ensureBootstrapAdmin } from './services/platform-auth.js';

loadLocalEnvFile();
const logger = createLogger();

try {
  const deps = createDeps({ config: loadConfig(), logger });
  await connectDatabase(deps.config.mongodbUri);
  await initModels();
  if ((await ensureBootstrapAdmin(deps)) === 'created') {
    logger.info('İlk ürün sahibi hesabı oluşturuldu; ilk girişte TOTP kurulumu zorunlu.');
  }

  const app = createApp(deps);
  const server = app.listen(deps.config.port, () => {
    logger.info('API çalışıyor', { port: deps.config.port });
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
