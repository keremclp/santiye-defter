import type { Config } from './config.js';
import { systemClock, type Clock } from './lib/clock.js';
import { silentLogger, type Logger } from './lib/logger.js';
import { LoginLimiter } from './lib/rate-limiter.js';
import { S3Storage, UnconfiguredStorage, type ObjectStorage } from './lib/storage.js';
import { TokenService } from './lib/tokens.js';

/** Uygulama genelinde paylaşılan bağımlılıklar; testlerde saat ve ayarlar değiştirilebilir. */
export interface AppDeps {
  config: Config;
  logger: Logger;
  clock: Clock;
  tokens: TokenService;
  customerLoginLimiter: LoginLimiter;
  platformLoginLimiter: LoginLimiter;
  storage: ObjectStorage;
}

export function createDeps(options: {
  config: Config;
  logger?: Logger;
  clock?: Clock;
  storage?: ObjectStorage;
}): AppDeps {
  const clock = options.clock ?? systemClock;
  const storageConfig = options.config.storage;
  return {
    config: options.config,
    logger: options.logger ?? silentLogger,
    clock,
    tokens: new TokenService(
      {
        accessSecret: options.config.jwtAccessSecret,
        refreshSecret: options.config.jwtRefreshSecret,
      },
      clock,
    ),
    customerLoginLimiter: new LoginLimiter(clock),
    platformLoginLimiter: new LoginLimiter(clock),
    storage:
      options.storage ?? (storageConfig ? new S3Storage(storageConfig) : new UnconfiguredStorage()),
  };
}
