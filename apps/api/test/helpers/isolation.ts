// Firma yalıtım testi: başka firmanın kullanıcısı bir kaydın kimliğiyle çağrı yaptığında 404 alır
// ve cevapta kaydın verisi görünmez (şartname 3 ve 13). Her yeni firma ucu için bir durum eklenir.

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect } from 'vitest';
import type { TestApp } from './app.js';
import { createCustomer } from './factories.js';

export type CustomerFixture = Awaited<ReturnType<typeof createCustomer>>;

export interface IsolationRequest {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  body?: object;
  /** Cevapta görünmemesi gereken, kayda özgü bir metin */
  secret: string;
}

export interface IsolationCase {
  name: string;
  /** Sahip firmada kaydı oluşturur ve bu kayda erişen isteği tarif eder. */
  arrange(context: { testApp: TestApp; owner: CustomerFixture }): Promise<IsolationRequest>;
}

function send(testApp: TestApp, target: IsolationRequest, accessToken: string) {
  return request(testApp.app)
    [target.method](target.path)
    .set('Authorization', `Bearer ${accessToken}`)
    .set('Idempotency-Key', randomUUID())
    .send(target.body ?? {});
}

export async function expectCompanyIsolation(
  testApp: TestApp,
  isolationCase: IsolationCase,
): Promise<void> {
  const owner = await createCustomer(testApp);
  const intruder = await createCustomer(testApp);
  const target = await isolationCase.arrange({ testApp, owner });

  const foreign = await send(testApp, target, intruder.accessToken);
  expect(foreign.status, `${isolationCase.name}: ${JSON.stringify(foreign.body)}`).toBe(404);
  expect(foreign.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  expect(JSON.stringify(foreign.body)).not.toContain(target.secret);

  // Aynı istek sahibi firmada 404 vermemeli; aksi halde test yalıtımı değil yanlış yolu ölçer.
  const own = await send(testApp, target, owner.accessToken);
  expect(own.status, `${isolationCase.name} (sahip firma): ${JSON.stringify(own.body)}`).not.toBe(
    404,
  );
}
