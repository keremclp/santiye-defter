import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTestApp, useTestDatabase } from './helpers/app.js';
import { financeSetup, tl } from './helpers/finance.js';
import { expectCompanyIsolation } from './helpers/isolation.js';
import { companyIsolationCases } from './isolation-cases.js';

useTestDatabase();

describe('firma yalıtımı: kimlikli uçlar', () => {
  for (const isolationCase of companyIsolationCases) {
    it(isolationCase.name, async () => {
      await expectCompanyIsolation(buildTestApp(), isolationCase);
    });
  }
});

describe('firma yalıtımı: listeler, arama, pano ve gövdedeki kimlikler', () => {
  async function twoCompanies() {
    const testApp = buildTestApp();
    const owner = await financeSetup(testApp);
    const intruder = await financeSetup(testApp);
    const project = await owner.api.createProject('Gizli Şantiye 4242');
    const party = await owner.api.createParty('Gizli Kişi 4242');
    const agreement = await owner.api.createAgreement({
      title: 'Gizli Anlaşma 4242',
      scope: 'project',
      projectId: project.id,
      partyId: party.id,
      initialAmount: tl(50_000),
    });
    const key = randomUUID();
    const payment = await owner.api.ok(
      owner.api.post(
        '/transactions',
        {
          kind: 'expense',
          amount: tl(4_242),
          date: '2026-03-10',
          partyId: party.id,
          description: 'Gizli ödeme 4242',
          allocations: [
            {
              scope: 'project',
              projectId: project.id,
              agreementId: agreement.id,
              amount: tl(4_242),
            },
          ],
        },
        key,
      ),
      201,
    );
    await owner.api.ok(owner.api.get('/search', { q: 'gizli', saveHistory: 'true' }));
    await owner.api.ok(
      owner.api.delete(`/projects/${(await owner.api.createProject('Silinen 4242')).id}`, {
        reason: 'x',
        expectedUpdatedAt: (await owner.api.ok(owner.api.get('/projects', { q: 'silinen' })))
          .items[0].updatedAt,
      }),
    );
    return { owner, intruder: intruder.api, project, party, agreement, payment, key };
  }

  it('liste, arama, pano, vade, silinenler ve öneriler başka firmanın verisini göstermez', async () => {
    const { intruder } = await twoCompanies();
    const responses = await Promise.all([
      intruder.get('/projects', { status: 'all' }),
      intruder.get('/parties'),
      intruder.get('/parties/suggest', { q: 'gizli' }),
      intruder.get('/agreements'),
      intruder.get('/transactions'),
      intruder.get('/transactions/suggestions'),
      intruder.get('/dashboard'),
      intruder.get('/dues', { direction: 'payable', group: 'none' }),
      intruder.get('/search', { q: 'gizli' }),
      intruder.get('/search', { q: '4.242' }),
      intruder.get('/search/history'),
      intruder.get('/deleted', { type: 'project' }),
      intruder.get('/categories', { includeInactive: 'true' }),
      intruder.get('/company'),
    ]);
    responses.forEach((res, index) => {
      expect(res.status, `yanıt ${index}`).toBe(200);
      // Aramanın kullanıcının yazdığı sorguyu geri yansıtması sızıntı sayılmaz.
      const text = JSON.stringify(res.body).replace(/"query":"[^"]*"/g, '');
      expect(text, `yanıt ${index}`).not.toMatch(/4242|4\.242|424200/);
    });
    const dashboard = responses[6].body.data;
    expect(dashboard.totals).toMatchObject({ netExpense: 0, remainingPayable: 0 });
  });

  it('firma kullanıcı listesi yalnız aynı firmanın kullanıcılarını, yalnız id/ad/aktiflikle döner', async () => {
    const { owner, intruder } = await twoCompanies();
    const ownerUserId = owner.user._id.toString();
    const intruderUsers = await intruder.ok(intruder.get('/company/users'));
    expect(JSON.stringify(intruderUsers)).not.toContain(ownerUserId);

    const ownUsers = await owner.api.ok(owner.api.get('/company/users'));
    expect(ownUsers).toEqual([{ id: ownerUserId, name: owner.user.name, isActive: true }]);
  });

  it('güvenli tekrar sorgusu başka firmanın anahtarını bulamaz', async () => {
    const { intruder, key, owner } = await twoCompanies();
    expect(await intruder.ok(intruder.get(`/idempotency/${key}`))).toEqual({ status: 'not_found' });
    expect((await owner.api.ok(owner.api.get(`/idempotency/${key}`))).status).toBe('done');
  });

  it('gövdede başka firmanın şantiye, kişi, anlaşma veya kategori kimliği kullanılamaz', async () => {
    const { intruder, project, party, agreement } = await twoCompanies();
    const ownProject = await intruder.createProject('Kendi');
    const ownParty = await intruder.createParty('Kendi Kişi');

    const foreignProject = await intruder.record({ kind: 'expense', amount: tl(1), project });
    expect(foreignProject.status).toBe(400);
    expect(foreignProject.body.message).toBe('Şantiye bulunamadı.');

    const foreignAgreement = await intruder.post('/transactions', {
      kind: 'expense',
      amount: tl(1),
      date: '2026-03-10',
      partyId: party.id,
      allocations: [
        { scope: 'project', projectId: ownProject.id, agreementId: agreement.id, amount: tl(1) },
      ],
    });
    expect(foreignAgreement.status).toBe(400);
    expect(JSON.stringify(foreignAgreement.body)).not.toContain('4242');

    const foreignParty = await intruder.post('/agreements', {
      kind: 'agreement',
      title: 'X',
      direction: 'payable',
      scope: 'project',
      projectId: ownProject.id,
      partyId: party.id,
      initialAmount: tl(1),
    });
    expect(foreignParty.status).toBe(400);
    expect(foreignParty.body.message).toBe('Kişi/firma bulunamadı.');

    const foreignProjectAgreement = await intruder.post('/agreements', {
      kind: 'agreement',
      title: 'X',
      direction: 'payable',
      scope: 'project',
      projectId: project.id,
      partyId: ownParty.id,
      initialAmount: tl(1),
    });
    expect(foreignProjectAgreement.status).toBe(400);
  });

  it('istemciden gelen companyId yok sayılır', async () => {
    const { owner, intruder } = await twoCompanies();
    const created = await intruder.createProject('Sahte', {
      companyId: owner.company._id.toString(),
    });
    expect((await owner.api.get(`/projects/${created.id}`)).status).toBe(404);
    expect((await intruder.get(`/projects/${created.id}`)).status).toBe(200);
  });
});
