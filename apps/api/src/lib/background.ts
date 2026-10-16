import type { Logger } from './logger.js';

/**
 * İstek cevabından sonra süren arka plan işleri (dışa aktarma). Hata loglanır, isteği etkilemez.
 * `idle` testlerde ve kapanışta süren işlerin bitmesini bekler.
 */
export class BackgroundTasks {
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly logger: Logger) {}

  run(name: string, task: () => Promise<unknown>): void {
    const promise: Promise<void> = task()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.error('Arka plan işi başarısız', {
          task: name,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => this.pending.delete(promise));
    this.pending.add(promise);
  }

  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }
}
