import { randomUUID } from 'node:crypto';
import { inject } from 'vitest';

// Paylaşılan replica set üzerinde bu test dosyasına özel veritabanı adresi.
export function testDatabaseUri(): string {
  const url = new URL(inject('mongoUri'));
  url.pathname = `/test_${randomUUID().replaceAll('-', '')}`;
  return url.toString();
}
