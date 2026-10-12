import type { Clock } from './clock.js';

export interface FailureLimiterOptions {
  maxFailures: number;
  windowMs: number;
  blockMs: number;
}

interface Entry {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number;
}

/**
 * Başarısız deneme sınırı (bellek içi). Pencere içinde `maxFailures` hatalı denemeden sonra
 * anahtar `blockMs` boyunca engellenir. Tek sunucu için yeterlidir.
 */
export class FailureLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly options: FailureLimiterOptions,
    private readonly clock: Clock,
  ) {}

  /** Engelliyse kalan süre (ms), değilse 0. */
  blockedFor(key: string): number {
    const entry = this.entries.get(key);
    if (!entry) return 0;
    return Math.max(entry.blockedUntil - this.clock.now().getTime(), 0);
  }

  recordFailure(key: string): void {
    const now = this.clock.now().getTime();
    this.prune(now);
    const current = this.entries.get(key);
    const entry =
      current && now - current.windowStartedAt < this.options.windowMs
        ? current
        : { failures: 0, windowStartedAt: now, blockedUntil: 0 };
    entry.failures += 1;
    if (entry.failures >= this.options.maxFailures) {
      entry.blockedUntil = now + this.options.blockMs;
      entry.failures = 0;
      entry.windowStartedAt = now;
    }
    this.entries.set(key, entry);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  private prune(now: number): void {
    if (this.entries.size < 10_000) return;
    for (const [key, entry] of this.entries) {
      if (entry.blockedUntil < now && now - entry.windowStartedAt >= this.options.windowMs) {
        this.entries.delete(key);
      }
    }
  }
}

/** Kullanıcı adı ve IP başına giriş denemesi sınırı (şartname 9.8). */
export class LoginLimiter {
  private readonly byUsername: FailureLimiter;
  private readonly byIp: FailureLimiter;

  constructor(clock: Clock) {
    const windowMs = 15 * 60 * 1000;
    const blockMs = 5 * 60 * 1000;
    this.byUsername = new FailureLimiter({ maxFailures: 5, windowMs, blockMs }, clock);
    this.byIp = new FailureLimiter({ maxFailures: 30, windowMs, blockMs }, clock);
  }

  blockedFor(username: string, ip: string): number {
    return Math.max(this.byUsername.blockedFor(username), this.byIp.blockedFor(ip));
  }

  recordFailure(username: string, ip: string): void {
    this.byUsername.recordFailure(username);
    this.byIp.recordFailure(ip);
  }

  recordSuccess(username: string): void {
    this.byUsername.reset(username);
  }
}
