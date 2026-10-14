// Firma verisi taşıyan her uç burada; başka firmanın kullanıcısı aynı isteği yaptığında 404 almalı
// ve cevapta kaydın verisi görünmemeli. Yeni bir firma ucu eklendiğinde buraya da eklenir.

import type { CustomerFixture, IsolationCase, IsolationRequest } from './helpers/isolation.js';
import { addDocument, intentBody, pdfFile, startUpload } from './helpers/documents.js';
import { Api, tl } from './helpers/finance.js';
import type { TestApp } from './helpers/app.js';

const SECRET = 'Gizli-7391';

async function fixtures(testApp: TestApp, owner: CustomerFixture) {
  const api = new Api(testApp, owner.accessToken);
  const project = await api.createProject(`Şantiye ${SECRET}`);
  const party = await api.createParty(`Kişi ${SECRET}`);
  const agreement = await api.createAgreement({
    title: `Anlaşma ${SECRET}`,
    scope: 'project',
    projectId: project.id,
    partyId: party.id,
    initialAmount: tl(100_000),
  });
  const payment = await api.pay(agreement, tl(10_000), { description: `Ödeme ${SECRET}` });
  return { api, project, party, agreement, payment };
}

type Fixtures = Awaited<ReturnType<typeof fixtures>>;

function caseFor(
  name: string,
  build: (
    f: Fixtures,
  ) => Omit<IsolationRequest, 'secret'> | Promise<Omit<IsolationRequest, 'secret'>>,
): IsolationCase {
  return {
    name,
    arrange: async ({ testApp, owner }) => ({
      ...(await build(await fixtures(testApp, owner))),
      secret: SECRET,
    }),
  };
}

const v = (record: { updatedAt: string }) => ({ expectedUpdatedAt: record.updatedAt });

const secretPdf = { fileName: `Belge ${SECRET}.pdf`, mimeType: 'application/pdf' };

/** Kaydı siler ve silinmiş halinin sürümünü döner (geri yükleme isteği için). */
async function deletedVersion(
  api: Api,
  path: 'projects' | 'parties' | 'transactions' | 'agreements',
  type: 'project' | 'party' | 'transaction' | 'agreement',
  record: { id: string; updatedAt: string },
): Promise<string> {
  await api.ok(api.delete(`/${path}/${record.id}`, { reason: 'Sil', ...v(record) }));
  const list = await api.ok(api.get('/deleted', { type }));
  return list.items.find((item: { id: string }) => item.id === record.id).updatedAt as string;
}

export const companyIsolationCases: IsolationCase[] = [
  // Şantiyeler
  caseFor('GET /projects/:id', ({ project }) => ({
    method: 'get',
    path: `/projects/${project.id}`,
  })),
  caseFor('GET /projects/:id/summary', ({ project }) => ({
    method: 'get',
    path: `/projects/${project.id}/summary`,
  })),
  caseFor('PATCH /projects/:id', ({ project }) => ({
    method: 'patch',
    path: `/projects/${project.id}`,
    body: { name: 'Yeni', ...v(project) },
  })),
  caseFor('POST /projects/:id/complete', ({ project }) => ({
    method: 'post',
    path: `/projects/${project.id}/complete`,
    body: v(project),
  })),
  caseFor('POST /projects/:id/reactivate', ({ project }) => ({
    method: 'post',
    path: `/projects/${project.id}/reactivate`,
    body: { reason: 'r', ...v(project) },
  })),
  caseFor('POST /projects/:id/archive', ({ project }) => ({
    method: 'post',
    path: `/projects/${project.id}/archive`,
    body: { archived: true, ...v(project) },
  })),
  caseFor('POST /projects/:id/pin', ({ project }) => ({
    method: 'post',
    path: `/projects/${project.id}/pin`,
    body: { pinned: true },
  })),
  caseFor('DELETE /projects/:id', ({ project }) => ({
    method: 'delete',
    path: `/projects/${project.id}`,
    body: { reason: 'r', ...v(project) },
  })),
  caseFor('POST /projects/:id/restore', async ({ api }) => {
    const empty = await api.createProject(`Boş ${SECRET}`);
    const expectedUpdatedAt = await deletedVersion(api, 'projects', 'project', empty);
    return {
      method: 'post',
      path: `/projects/${empty.id}/restore`,
      body: { reason: 'r', expectedUpdatedAt },
    };
  }),

  // Kişiler
  caseFor('GET /parties/:id', ({ party }) => ({ method: 'get', path: `/parties/${party.id}` })),
  caseFor('GET /parties/:id/statement', ({ party }) => ({
    method: 'get',
    path: `/parties/${party.id}/statement`,
  })),
  caseFor('PATCH /parties/:id', ({ party }) => ({
    method: 'patch',
    path: `/parties/${party.id}`,
    body: { note: 'n', ...v(party) },
  })),
  caseFor('POST /parties/:id/pin', ({ party }) => ({
    method: 'post',
    path: `/parties/${party.id}/pin`,
    body: { pinned: true },
  })),
  caseFor('DELETE /parties/:id', ({ party }) => ({
    method: 'delete',
    path: `/parties/${party.id}`,
    body: { reason: 'r', ...v(party) },
  })),
  caseFor('POST /parties/:id/restore', async ({ api }) => {
    const empty = await api.createParty(`Boş ${SECRET}`);
    const expectedUpdatedAt = await deletedVersion(api, 'parties', 'party', empty);
    return {
      method: 'post',
      path: `/parties/${empty.id}/restore`,
      body: { reason: 'r', expectedUpdatedAt },
    };
  }),

  // Kategoriler
  caseFor('PATCH /categories/:id', async ({ api }) => {
    const category = await api.ok(api.post('/categories', { name: `Kategori ${SECRET}` }), 201);
    return {
      method: 'patch',
      path: `/categories/${category.id}`,
      body: { name: 'Yeni', ...v(category) },
    };
  }),

  // İşlemler
  caseFor('GET /transactions/:id', ({ payment }) => ({
    method: 'get',
    path: `/transactions/${payment.id}`,
  })),
  caseFor('PATCH /transactions/:id', ({ payment }) => ({
    method: 'patch',
    path: `/transactions/${payment.id}`,
    body: { description: 'd', ...v(payment) },
  })),
  caseFor('POST /transactions/:id/refunds', ({ payment }) => ({
    method: 'post',
    path: `/transactions/${payment.id}/refunds`,
    body: {
      amount: 100,
      date: '2026-04-01',
      reason: 'r',
      parts: [{ allocationId: payment.allocations[0].id, amount: 100 }],
    },
  })),
  caseFor('DELETE /transactions/:id', ({ payment }) => ({
    method: 'delete',
    path: `/transactions/${payment.id}`,
    body: { reason: 'r', ...v(payment) },
  })),
  caseFor('POST /transactions/:id/restore', async ({ api, payment }) => {
    const expectedUpdatedAt = await deletedVersion(api, 'transactions', 'transaction', payment);
    return {
      method: 'post',
      path: `/transactions/${payment.id}/restore`,
      body: { reason: 'r', expectedUpdatedAt },
    };
  }),
  caseFor('POST /transactions/:id/duplicate', ({ payment }) => ({
    method: 'post',
    path: `/transactions/${payment.id}/duplicate`,
  })),

  // Anlaşmalar
  caseFor('GET /agreements/:id', ({ agreement }) => ({
    method: 'get',
    path: `/agreements/${agreement.id}`,
  })),
  caseFor('PATCH /agreements/:id', async ({ api, agreement }) => {
    const current = await api.agreement(agreement.id);
    return {
      method: 'patch',
      path: `/agreements/${agreement.id}`,
      body: { description: 'd', ...v(current) },
    };
  }),
  caseFor('POST /agreements/:id/amount', async ({ api, agreement }) => {
    const current = await api.agreement(agreement.id);
    return {
      method: 'post',
      path: `/agreements/${agreement.id}/amount`,
      body: { newAmount: tl(1), reason: 'r', ...v(current) },
    };
  }),
  caseFor('POST /agreements/:id/amount?preview=1', ({ agreement }) => ({
    method: 'post',
    path: `/agreements/${agreement.id}/amount?preview=1`,
    body: { newAmount: tl(1) },
  })),
  caseFor('POST /agreements/:id/due-date', async ({ api, agreement }) => {
    const current = await api.agreement(agreement.id);
    return {
      method: 'post',
      path: `/agreements/${agreement.id}/due-date`,
      body: { dueDate: '2026-12-31', reason: 'r', ...v(current) },
    };
  }),
  caseFor('POST /agreements/:id/work-status', async ({ api, agreement }) => {
    const current = await api.agreement(agreement.id);
    return {
      method: 'post',
      path: `/agreements/${agreement.id}/work-status`,
      body: { workStatus: 'completed', ...v(current) },
    };
  }),
  caseFor('POST /agreements/:id/cancel', async ({ api, agreement }) => {
    const current = await api.agreement(agreement.id);
    return {
      method: 'post',
      path: `/agreements/${agreement.id}/cancel`,
      body: { reason: 'r', ...v(current) },
    };
  }),
  caseFor('DELETE /agreements/:id', async ({ api, agreement }) => {
    const current = await api.agreement(agreement.id);
    return {
      method: 'delete',
      path: `/agreements/${agreement.id}`,
      body: { reason: 'r', ...v(current) },
    };
  }),
  caseFor('POST /agreements/:id/restore', async ({ api, party }) => {
    const empty = await api.createAgreement({
      title: `Boş ${SECRET}`,
      scope: 'company',
      partyId: party.id,
      initialAmount: tl(1),
    });
    const expectedUpdatedAt = await deletedVersion(api, 'agreements', 'agreement', empty);
    return {
      method: 'post',
      path: `/agreements/${empty.id}/restore`,
      body: { reason: 'r', expectedUpdatedAt },
    };
  }),

  // Belgeler
  caseFor('POST /documents/upload-intent', ({ payment }) => ({
    method: 'post',
    path: '/documents/upload-intent',
    body: intentBody({ ownerType: 'transaction', ownerId: payment.id }, pdfFile(), secretPdf),
  })),
  caseFor('POST /documents/upload-intent (anlaşma)', ({ agreement }) => ({
    method: 'post',
    path: '/documents/upload-intent',
    body: intentBody({ ownerType: 'agreement', ownerId: agreement.id }, pdfFile(), secretPdf),
  })),
  caseFor('POST /documents/:id/complete', async ({ api, payment }) => {
    const intent = await startUpload(
      api,
      { ownerType: 'transaction', ownerId: payment.id },
      pdfFile(),
      secretPdf,
    );
    return { method: 'post', path: `/documents/${intent.document.id}/complete` };
  }),
  caseFor('GET /documents/:id/download', async ({ api, payment }) => {
    const doc = await addDocument(
      api,
      { ownerType: 'transaction', ownerId: payment.id },
      pdfFile(),
      secretPdf,
    );
    return { method: 'get', path: `/documents/${doc.id}/download` };
  }),
  caseFor('GET /documents/:id/preview', async ({ api, agreement }) => {
    const doc = await addDocument(
      api,
      { ownerType: 'agreement', ownerId: agreement.id },
      pdfFile(),
      secretPdf,
    );
    return { method: 'get', path: `/documents/${doc.id}/preview` };
  }),
  caseFor('DELETE /documents/:id', async ({ api, payment }) => {
    const doc = await addDocument(
      api,
      { ownerType: 'transaction', ownerId: payment.id },
      pdfFile(),
      secretPdf,
    );
    return { method: 'delete', path: `/documents/${doc.id}`, body: { reason: 'r', ...v(doc) } };
  }),
  caseFor('POST /documents/:id/restore', async ({ api, payment }) => {
    const doc = await addDocument(
      api,
      { ownerType: 'transaction', ownerId: payment.id },
      pdfFile(),
      secretPdf,
    );
    const deleted = await api.ok(api.delete(`/documents/${doc.id}`, { reason: 'Sil', ...v(doc) }));
    return {
      method: 'post',
      path: `/documents/${doc.id}/restore`,
      body: { reason: 'r', ...v(deleted) },
    };
  }),
];
