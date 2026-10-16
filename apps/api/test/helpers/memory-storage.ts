// Testlerde S3 yerine kullanılan bellek içi depo. İmzalı adresler gerçek ağa çıkmaz; testler
// tarayıcının yapacağı yüklemeyi `upload` ile doğrudan yapar.

import type { DownloadOptions, ObjectStorage } from '../../src/lib/storage.js';

interface StoredObject {
  body: Buffer;
  contentType: string;
}

export class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  /** Kopyalamadan hemen önce çalışır; yarış testlerinde tamamlamayı ortada durdurmak için. */
  beforeCopy: ((sourceKey: string) => Promise<void>) | null = null;

  /** Tarayıcının imzalı adrese yaptığı PUT. */
  upload(key: string, body: Buffer, contentType = 'application/octet-stream') {
    this.objects.set(key, { body, contentType });
  }

  keys(): string[] {
    return [...this.objects.keys()].sort();
  }

  presignUpload(key: string, options: { contentType: string; expiresInSeconds: number }) {
    return Promise.resolve(
      `memory://upload/${key}?type=${encodeURIComponent(options.contentType)}&expires=${options.expiresInSeconds}`,
    );
  }

  presignDownload(key: string, options: DownloadOptions) {
    const mode = options.inline ? 'inline' : 'attachment';
    return Promise.resolve(
      `memory://download/${key}?mode=${mode}&expires=${options.expiresInSeconds}`,
    );
  }

  size(key: string) {
    return Promise.resolve(this.objects.get(key)?.body.length ?? null);
  }

  read(key: string, length?: number) {
    const object = this.objects.get(key);
    if (!object) return Promise.reject(new Error(`Nesne yok: ${key}`));
    return Promise.resolve(length === undefined ? object.body : object.body.subarray(0, length));
  }

  async copy(sourceKey: string, targetKey: string) {
    if (this.beforeCopy) await this.beforeCopy(sourceKey);
    const object = this.objects.get(sourceKey);
    if (!object) throw new Error(`Nesne yok: ${sourceKey}`);
    this.objects.set(targetKey, { ...object });
  }

  put(key: string, body: Buffer, contentType: string) {
    this.objects.set(key, { body, contentType });
    return Promise.resolve();
  }

  /** Akış yazarken her parçada çalışır; hata atarsa yazma başarısız olur ve nesne oluşmaz. */
  onStreamChunk: ((key: string) => void) | null = null;

  async putStream(key: string, body: AsyncIterable<Buffer>, contentType: string) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      this.onStreamChunk?.(key);
      chunks.push(chunk);
    }
    this.objects.set(key, { body: Buffer.concat(chunks), contentType });
  }

  remove(key: string) {
    this.objects.delete(key);
    return Promise.resolve();
  }

  /** Önekli silmede çalışır; hata atarsa silme başarısız olur (kalıcı silme hata testi). */
  beforeRemovePrefix: ((prefix: string) => void) | null = null;

  removePrefix(prefix: string) {
    try {
      this.beforeRemovePrefix?.(prefix);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    const keys = this.keys().filter((key) => key.startsWith(prefix));
    for (const key of keys) this.objects.delete(key);
    return Promise.resolve(keys.length);
  }
}
