import { describe, expect, it } from 'vitest';
import { loginCustomer } from './helpers/factories.js';
import { createUser } from './helpers/factories.js';
import { buildTestApp, useTestDatabase } from './helpers/app.js';
import { Api, financeSetup, tl } from './helpers/finance.js';

useTestDatabase();

async function setup() {
  const testApp = buildTestApp();
  const fixture = await financeSetup(testApp);
  return { testApp, ...fixture };
}

describe('GET /dashboard', () => {
  it('firma geneli kutular, bu ay şeridi, listeler; tamamlanan şantiyenin açık borcu kaybolmaz', async () => {
    const { api } = await setup();
    const project = await api.createProject('Biten Şantiye');
    const party = await api.createParty();
    const agreement = await api.createAgreement({
      title: 'İş',
      scope: 'project',
      projectId: project.id,
      partyId: party.id,
      initialAmount: tl(80_000),
    });
    await api.pay(agreement, tl(30_000));
    await api.ok(api.record({ kind: 'income', amount: tl(100_000), project }), 201);
    const current = await api.ok(api.get(`/projects/${project.id}`));
    await api.ok(
      api.post(`/projects/${project.id}/complete`, { expectedUpdatedAt: current.updatedAt }),
    );

    const dashboard = await api.ok(api.get('/dashboard'));
    expect(dashboard.scope).toBe('Firma geneli — tüm şantiyeler');
    expect(dashboard.totals).toMatchObject({
      netIncome: tl(100_000),
      netExpense: tl(30_000),
      difference: tl(70_000),
      remainingPayable: tl(50_000),
      remainingReceivable: 0,
    });
    expect(dashboard.activeProjectCount).toBe(0);
    expect(dashboard.recentTransactions).toHaveLength(2);
    expect(dashboard.openAgreements[0]).toMatchObject({ id: agreement.id, remaining: tl(50_000) });
    expect(dashboard.recentProjects[0]).toMatchObject({ id: project.id });
    expect(dashboard.generatedAt).toEqual(expect.any(String));
  });

  it('bu ay şeridi işlem tarihine göredir', async () => {
    const { testApp, api } = await setup();
    const { businessToday } = await import('../src/lib/clock.js');
    const today = businessToday(testApp.clock);
    await api.ok(
      api.record({ kind: 'expense', amount: tl(1_000), project: null, date: today }),
      201,
    );
    await api.ok(
      api.record({ kind: 'expense', amount: tl(9_000), project: null, date: '2020-01-01' }),
      201,
    );
    const dashboard = await api.ok(api.get('/dashboard'));
    expect(dashboard.monthly).toMatchObject({ month: today.slice(0, 7), netExpense: tl(1_000) });
    expect(dashboard.totals.netExpense).toBe(tl(10_000));
  });
});

describe('GET /search', () => {
  it('dört grupta sonuç; Türkçe harf farkı engel olmaz; silinenler hariç', async () => {
    const { api } = await setup();
    const project = await api.createProject('Şişli Konut');
    const party = await api.createParty('Şişli Nalbur');
    await api.createAgreement({
      title: 'Şişli boya işi',
      scope: 'project',
      projectId: project.id,
      partyId: party.id,
      initialAmount: tl(7_500),
    });
    const t = await api.ok(
      api.record({
        kind: 'expense',
        amount: tl(250),
        project,
        party,
        extra: { description: 'Şişli nakliye' },
      }),
      201,
    );
    const gone = await api.ok(
      api.record({
        kind: 'expense',
        amount: tl(1),
        project: null,
        extra: { description: 'Şişli silinen' },
      }),
      201,
    );
    await api.ok(
      api.delete(`/transactions/${gone.id}`, { reason: 'x', expectedUpdatedAt: gone.updatedAt }),
    );

    const result = await api.ok(api.get('/search', { q: 'SISLI' }));
    expect(result.projects.map((p: { name: string }) => p.name)).toEqual(['Şişli Konut']);
    expect(result.parties.map((p: { name: string }) => p.name)).toEqual(['Şişli Nalbur']);
    expect(result.agreements.map((a: { label: string }) => a.label)).toEqual(['Şişli boya işi']);
    expect(result.transactions.map((x: { id: string }) => x.id)).toEqual([t.id]);

    expect((await api.ok(api.get('/search', { q: '7.500' }))).agreements).toHaveLength(1);
    expect(
      (await api.ok(api.get('/search', { q: '200-300' }))).transactions.map(
        (x: { id: string }) => x.id,
      ),
    ).toEqual([t.id]);
    expect((await api.ok(api.get('/search', { q: 'şişli', type: 'party' }))).projects).toEqual([]);
  });

  it('geçmiş kullanıcıya özel, en fazla üç, temizlenir', async () => {
    const { testApp, api, company } = await setup();
    for (const q of ['bir', 'iki', 'üç', 'dört', 'iki']) {
      await api.ok(api.get('/search', { q, saveHistory: 'true' }));
    }
    expect(
      (await api.ok(api.get('/search/history'))).map((h: { query: string }) => h.query),
    ).toEqual(['iki', 'dört', 'üç']);

    const { user } = await createUser(company);
    const other = new Api(testApp, (await loginCustomer(testApp, user.username)).accessToken);
    expect(await other.ok(other.get('/search/history'))).toEqual([]);

    await api.ok(api.delete('/search/history', {}));
    expect(await api.ok(api.get('/search/history'))).toEqual([]);
  });
});

describe('GET /deleted', () => {
  it('silen kişi, zaman ve gerekçeyle türe göre listelenir; silinenler normal toplamlara girmez', async () => {
    const { api, user } = await setup();
    const t = await api.ok(
      api.record({
        kind: 'expense',
        amount: tl(500),
        project: null,
        extra: { description: 'Çay' },
      }),
      201,
    );
    await api.ok(
      api.delete(`/transactions/${t.id}`, { reason: 'Mükerrer', expectedUpdatedAt: t.updatedAt }),
    );

    const list = await api.ok(api.get('/deleted', { type: 'transaction' }));
    expect(list.items[0]).toMatchObject({
      id: t.id,
      label: `#${t.recordNo} Çay`,
      amount: tl(500),
      deleteReason: 'Mükerrer',
      deletedBy: { id: user._id.toString(), name: user.name },
    });
    expect((await api.totals()).netExpense).toBe(0);
  });
});

describe('aynı firmanın kullanıcıları eşit yetkili; oluşturan/değiştiren ayrı tutulur', () => {
  it('ikinci kullanıcı ilk kullanıcının kaydını düzeltir; geçmişte ikisi ayrı görünür', async () => {
    const { testApp, api, company, user } = await setup();
    const t = await api.ok(api.record({ kind: 'expense', amount: tl(100), project: null }), 201);
    const { user: second } = await createUser(company, { name: 'İkinci Kullanıcı' });
    const other = new Api(testApp, (await loginCustomer(testApp, second.username)).accessToken);

    await other.ok(
      other.patch(`/transactions/${t.id}`, {
        description: 'Düzeltildi',
        expectedUpdatedAt: t.updatedAt,
      }),
    );
    const detail = await api.transaction(t.id);
    expect(detail.createdBy).toMatchObject({ id: user._id.toString() });
    expect(detail.updatedBy).toMatchObject({ id: second._id.toString(), name: 'İkinci Kullanıcı' });
  });
});
