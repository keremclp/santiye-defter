import { describe, it } from 'vitest';
import { buildTestApp, useTestDatabase } from './helpers/app.js';
import { expectCompanyIsolation } from './helpers/isolation.js';
import { companyIsolationCases } from './isolation-cases.js';

useTestDatabase();

describe('firma yalıtımı: bütün firma uçları', () => {
  if (companyIsolationCases.length === 0) {
    it.todo('firma verisi taşıyan uçlar Adım 3 ile eklenecek');
  }
  for (const isolationCase of companyIsolationCases) {
    it(isolationCase.name, async () => {
      await expectCompanyIsolation(buildTestApp(), isolationCase);
    });
  }
});
