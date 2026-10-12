// Finans uçlarını senaryo diliyle çağıran test yardımcısı.

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect } from 'vitest';
import type { TestApp } from './app.js';
import { createCustomer, loginCustomer } from './factories.js';

export const tl = (lira: number) => lira * 100;

type Body = Record<string, unknown>;

export class Api {
  constructor(
    readonly testApp: TestApp,
    readonly accessToken: string,
    readonly username = '',
  ) {}

  /** Saat ilerletilip access token süresi dolunca aynı kullanıcıyla yeni oturum. */
  async relogin(): Promise<Api> {
    const session = await loginCustomer(this.testApp, this.username);
    return new Api(this.testApp, session.accessToken, this.username);
  }

  private auth() {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  get(path: string, query: Record<string, unknown> = {}) {
    return request(this.testApp.app).get(path).query(query).set(this.auth());
  }

  post(path: string, body: Body = {}, key: string | null = randomUUID()) {
    const req = request(this.testApp.app).post(path).set(this.auth());
    if (key) req.set('Idempotency-Key', key);
    return req.send(body);
  }

  patch(path: string, body: Body) {
    return request(this.testApp.app).patch(path).set(this.auth()).send(body);
  }

  delete(path: string, body: Body) {
    return request(this.testApp.app).delete(path).set(this.auth()).send(body);
  }

  /** Başarılı cevabın verisi; değilse cevabı gösterip testi düşürür. */
  async ok<T = any>(promise: PromiseLike<request.Response>, status = 200): Promise<T> {
    const res = await promise;
    expect(res.status, JSON.stringify(res.body)).toBe(status);
    return res.body.data as T;
  }

  createProject(name = 'Kadıköy Villa', extra: Body = {}) {
    return this.ok(this.post('/projects', { name, ...extra }), 201);
  }

  createParty(name = 'Yılmaz Elektrik', extra: Body = {}) {
    return this.ok(this.post('/parties', { name, ...extra }), 201);
  }

  createAgreement(body: Body) {
    return this.ok(
      this.post('/agreements', { kind: 'agreement', direction: 'payable', ...body }),
      201,
    );
  }

  /** Tek paylı gelir/gider; `agreement` verilirse anlaşmanın kapsamına bağlanır. */
  async record(options: {
    kind: 'income' | 'expense';
    amount: number;
    date?: string;
    project?: { id: string } | null;
    party?: { id: string } | null;
    agreement?: { id: string; projectId: string | null; partyId: string } | null;
    extra?: Body;
  }) {
    const agreement = options.agreement ?? null;
    const projectId = agreement ? agreement.projectId : (options.project?.id ?? null);
    return this.post('/transactions', {
      kind: options.kind,
      amount: options.amount,
      date: options.date ?? '2026-03-10',
      ...(agreement
        ? { partyId: agreement.partyId }
        : options.party
          ? { partyId: options.party.id }
          : {}),
      allocations: [
        {
          scope: projectId ? 'project' : 'company',
          ...(projectId ? { projectId } : {}),
          ...(agreement ? { agreementId: agreement.id } : {}),
          amount: options.amount,
        },
      ],
      ...options.extra,
    });
  }

  pay(
    agreement: { id: string; projectId: string | null; partyId: string },
    amount: number,
    extra: Body = {},
  ) {
    return this.ok(this.record({ kind: 'expense', amount, agreement, extra }), 201);
  }

  collect(
    agreement: { id: string; projectId: string | null; partyId: string },
    amount: number,
    extra: Body = {},
  ) {
    return this.ok(this.record({ kind: 'income', amount, agreement, extra }), 201);
  }

  agreement(id: string) {
    return this.ok(this.get(`/agreements/${id}`));
  }

  transaction(id: string) {
    return this.ok(this.get(`/transactions/${id}`));
  }

  totals(query: Record<string, unknown> = {}) {
    return this.ok(this.get('/transactions', query)).then((data) => data.totals);
  }
}

/** Firma, oturum açmış kullanıcı ve API yardımcısı. */
export async function financeSetup(testApp: TestApp) {
  const customer = await createCustomer(testApp);
  return { ...customer, api: new Api(testApp, customer.accessToken, customer.user.username) };
}
