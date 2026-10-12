import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp, type AppOptions } from '../../src/app.js';
import type { Config } from '../../src/config.js';
import { connectDatabase, disconnectDatabase } from '../../src/db/connection.js';
import { createDeps, type AppDeps } from '../../src/deps.js';
import type { Clock } from '../../src/lib/clock.js';
import { initModels, models } from '../../src/models/index.js';
import { testDatabaseUri } from './database.js';

export interface TestClock extends Clock {
  set(date: Date | string): void;
  advance(ms: number): void;
}

export function createTestClock(start: Date = new Date()): TestClock {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    set: (date) => {
      current = new Date(date).getTime();
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

const secret = () => randomBytes(32).toString('base64url');

/** Gerçek ayar biçimi; testleri hızlandırmak için yalnız bcrypt maliyeti düşüktür. */
export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    nodeEnv: 'test',
    port: 0,
    mongodbUri: 'mongodb://test',
    webOrigin: 'http://localhost:5173',
    appName: 'Şantiye Hesap',
    jwtAccessSecret: secret(),
    jwtRefreshSecret: secret(),
    totpEncryptionKey: secret(),
    platformBootstrap: null,
    bcryptCost: 4,
    ...overrides,
  };
}

export interface TestApp {
  app: ReturnType<typeof createApp>;
  deps: AppDeps;
  clock: TestClock;
}

export function buildTestApp(
  options: { config?: Partial<Config>; clock?: TestClock } & AppOptions = {},
): TestApp {
  const clock = options.clock ?? createTestClock();
  const deps = createDeps({ config: testConfig(options.config), clock });
  return { app: createApp(deps, options), deps, clock };
}

/** Dosyaya özel veritabanı; her testten önce koleksiyonlar boşaltılır. */
export function useTestDatabase(): void {
  beforeAll(async () => {
    await connectDatabase(testDatabaseUri());
    await initModels();
  });
  beforeEach(async () => {
    await Promise.all(models.map((current) => current.collection.deleteMany({})));
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDatabase();
  });
}
