// Şantiye, kişi, kategori, firma bilgisi ve anlaşma yaşam döngüsü uçları.

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { CategoryModel } from '../src/models/category.js';
import { buildTestApp, useTestDatabase } from './helpers/app.js';
import { enrollPlatformAdmin, idempotencyKey } from './helpers/factories.js';
import { financeSetup, tl, type Api } from './helpers/finance.js';

useTestDatabase();

async function setup() {
  const testApp = buildTestApp();
  const fixture = await financeSetup(testApp);
  return { testApp, ...fixture };
}

const version = (record: { updatedAt: string }) => ({ expectedUpdatedAt: record.updatedAt });

async function agreementFor(
  api: Api,
  project: { id: string } | null,
  party: { id: string },
  amount = tl(100_000),
) {
  return api.createAgreement({
    title: 'Kaba inşaat',
    scope: project ? 'project' : 'company',
    ...(project ? { projectId: project.id } : {}),
    partyId: party.id,
    initialAmount: amount,
  });
}

describe('şantiyeler', () => {
  it('oluştur: başlangıç tarihi bilinmiyorsa boş kalır; benzer adda uyarır ama engellemez', async () => {
    const { api } = await setup();
    const first = await api.createProject('Kadıköy Villa Şantiyesi');
    expect(first).toMatchObject({ status: 'active', startDate: null, pinned: false, warnings: [] });
    const second = await api.createProject('KADIKÖY VİLLA');
    expect(second.warnings[0]).toMatchObject({ code: 'SIMILAR_NAME', related: [{ id: first.id }] });
  });

  it('tamamla → yeniden aktifleştir (gerekçeyle); arşivden çıkınca önceki duruma döner', async () => {
    const { testApp, api, user } = await setup();
    let project = await api.createProject();
    const party = await api.createParty();
    await agreementFor(api, project, party);

    const completed = await api.ok(
      api.post(`/projects/${project.id}/complete`, {
        completedAt: '2026-06-30',
        ...version(project),
      }),
    );
    expect(completed.project).toMatchObject({ status: 'completed', completedAt: '2026-06-30' });
    expect(completed.openBalances.payable.remaining).toBe(tl(100_000));
    project = completed.project;

    project = await api.ok(
      api.post(`/projects/${project.id}/archive`, { archived: true, ...version(project) }),
    );
    project = await api.ok(
      api.post(`/projects/${project.id}/archive`, { archived: false, ...version(project) }),
    );
    expect(project.status).toBe('completed');

    expect(
      (await api.post(`/projects/${project.id}/reactivate`, version(project), null)).status,
    ).toBe(400);
    project = await api.ok(
      api.post(`/projects/${project.id}/reactivate`, {
        reason: 'Ek iş başladı',
        ...version(project),
      }),
    );
    expect(project).toMatchObject({ status: 'active', completedAt: null });

    project = await api.ok(
      api.post(`/projects/${project.id}/archive`, { archived: true, ...version(project) }),
    );
    project = await api.ok(
      api.post(`/projects/${project.id}/archive`, { archived: false, ...version(project) }),
    );
    expect(project.status).toBe('active');

    const detail = await api.ok(api.get(`/projects/${project.id}`));
    expect(detail.history.map((h: { action: string }) => h.action)).toEqual([
      'create',
      'complete',
      'archive',
      'unarchive',
      'reactivate',
      'archive',
      'unarchive',
    ]);
    expect(detail.history[4]).toMatchObject({
      reason: 'Ek iş başladı',
      by: { id: user._id.toString() },
    });
    void testApp;
  });

  it('liste: varsayılan aktif; sabitlenen önce; kartta fark ve kalan borç/alacak', async () => {
    const { api } = await setup();
    const a = await api.createProject('A');
    const b = await api.createProject('B');
    const c = await api.createProject('C');
    await api.ok(api.post(`/projects/${c.id}/archive`, { archived: true, ...version(c) }));
    await api.ok(api.post(`/projects/${b.id}/pin`, { pinned: true }, null));
    await api.ok(api.record({ kind: 'income', amount: tl(10_000), project: a }), 201);
    await api.ok(api.record({ kind: 'expense', amount: tl(4_000), project: a }), 201);
    await agreementFor(api, a, await api.createParty(), tl(50_000));
    await api.createAgreement({
      title: 'Daire satışı',
      direction: 'receivable',
      scope: 'project',
      projectId: a.id,
      partyId: (await api.createParty('Mert Kaya')).id,
      initialAmount: tl(30_000),
      dueDate: '2020-01-15',
    });

    const list = await api.ok(api.get('/projects'));
    expect(list.items.map((p: { name: string }) => p.name)).toEqual(['B', 'A']);
    expect(list.items[1].summary).toEqual({
      netIncome: tl(10_000),
      netExpense: tl(4_000),
      difference: tl(6_000),
      remainingPayable: tl(50_000),
      remainingReceivable: tl(30_000),
      overdueReceivable: tl(30_000),
    });
    expect((await api.ok(api.get('/projects', { status: 'all' }))).total).toBe(3);
    expect(
      (await api.ok(api.get('/projects', { q: 'a', status: 'all' }))).items.map(
        (p: { name: string }) => p.name,
      ),
    ).toContain('A');
  });

  it('özet: başlangıç kayıtları toplamlara dahil ve ayrıca alt toplam; firma geneli kayıtlar şantiyeye dağıtılmaz', async () => {
    const { api } = await setup();
    const project = await api.createProject();
    const party = await api.createParty();
    await agreementFor(api, project, party, tl(100_000));
    await api.createAgreement({
      kind: 'opening',
      direction: 'payable',
      scope: 'project',
      projectId: project.id,
      partyId: party.id,
      initialAmount: tl(20_000),
      trackingStartDate: '2026-01-01',
    });
    await api.ok(api.record({ kind: 'expense', amount: tl(5_000), project: null }), 201);

    const summary = await api.ok(api.get(`/projects/${project.id}/summary`));
    expect(summary.payable).toMatchObject({ totalAmount: tl(120_000), remaining: tl(120_000) });
    expect(summary.openings.payable).toMatchObject({
      totalAmount: tl(20_000),
      remaining: tl(20_000),
    });
    expect(summary.cash.netExpense).toBe(0);
  });

  it('kaydı olan şantiye silinmez (409 HAS_DEPENDENCIES); boş şantiye silinir ve geri yüklenir', async () => {
    const { api } = await setup();
    const used = await api.createProject('Dolu');
    await api.ok(api.record({ kind: 'expense', amount: tl(1), project: used }), 201);
    const blocked = await api.delete(`/projects/${used.id}`, {
      reason: 'Sil',
      ...version(await api.ok(api.get(`/projects/${used.id}`))),
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({
      code: 'HAS_DEPENDENCIES',
      message: 'Bu şantiyenin hareketleri veya anlaşmaları var; silmek yerine arşivleyin.',
    });

    const empty = await api.createProject('Boş');
    await api.ok(
      api.delete(`/projects/${empty.id}`, { reason: 'Yanlış açıldı', ...version(empty) }),
    );
    expect((await api.get(`/projects/${empty.id}`)).status).toBe(404);
    const deleted = (await api.ok(api.get('/deleted', { type: 'project' }))).items[0];
    expect(deleted).toMatchObject({ id: empty.id, label: 'Boş', deleteReason: 'Yanlış açıldı' });
    await api.ok(
      api.post(
        `/projects/${empty.id}/restore`,
        { reason: 'Geri', expectedUpdatedAt: deleted.updatedAt },
        null,
      ),
    );
    expect((await api.get(`/projects/${empty.id}`)).status).toBe(200);
  });

  it('eski expectedUpdatedAt ile güncelleme 409 ve güncel kayıt', async () => {
    const { api } = await setup();
    const project = await api.createProject('Eski Ad');
    await api.ok(api.patch(`/projects/${project.id}`, { name: 'Yeni Ad', ...version(project) }));
    const stale = await api.patch(`/projects/${project.id}`, {
      name: 'Başka',
      ...version(project),
    });
    expect(stale.status).toBe(409);
    expect(stale.body.details.current).toMatchObject({ name: 'Yeni Ad' });
  });
});

describe('kişiler', () => {
  it('detay: borç, alacak, fazla ödeme ayrı; şantiye/firma geneli dağılımı; doğrudan hareketler ayrı; mahsup yok', async () => {
    const { api } = await setup();
    const party = await api.createParty('Ortak Firma', { tags: ['supplier', 'customer'] });
    const a = await api.createProject('A');
    const debt = await agreementFor(api, a, party, tl(100_000));
    await api.createAgreement({
      title: 'Satış',
      direction: 'receivable',
      scope: 'company',
      partyId: party.id,
      initialAmount: tl(20_000),
    });
    await api.pay(debt, tl(110_000), { confirmExcess: true, excessReason: 'Avans' });
    await api.ok(api.record({ kind: 'expense', amount: tl(3_000), project: a, party }), 201);

    const detail = await api.ok(api.get(`/parties/${party.id}`));
    expect(detail.finance).toMatchObject({
      payable: { remaining: 0, excess: tl(10_000) },
      receivable: { remaining: tl(20_000) },
      overpaid: tl(10_000),
      overcollected: 0,
      directTransactions: { netExpense: tl(3_000) },
    });
    expect(detail.finance.byScope).toHaveLength(2);

    const statement = await api.ok(api.get(`/parties/${party.id}/statement`));
    expect(
      statement.transactions.map((t: { notLinkedToAgreement: boolean }) => t.notLinkedToAgreement),
    ).toEqual([false, true]);
  });

  it('kaydı olan kişi silinmez, pasifleştirilir; pasif kişi önerilmez; kaydı olmayan kişi silinir', async () => {
    const { api } = await setup();
    const party = await api.createParty('Pasif Usta');
    const payment = await api.ok(
      api.record({ kind: 'expense', amount: tl(1_000), project: null, party }),
      201,
    );
    await api.ok(
      api.delete(`/transactions/${payment.id}`, { reason: 'Yanlış', ...version(payment) }),
    );

    const current = await api.ok(api.get(`/parties/${party.id}`));
    const blocked = await api.delete(`/parties/${party.id}`, {
      reason: 'Sil',
      ...version(current),
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.message).toBe('Bu kişinin kayıtları var; silmek yerine pasifleştirin.');

    await api.ok(api.patch(`/parties/${party.id}`, { isActive: false, ...version(current) }));
    expect(await api.ok(api.get('/parties/suggest', { q: 'pasif' }))).toEqual([]);
    expect((await api.ok(api.get('/parties', { active: 'false' }))).total).toBe(1);

    const unused = await api.createParty('Boş Kişi');
    await api.ok(api.delete(`/parties/${unused.id}`, { reason: 'Gereksiz', ...version(unused) }));
    expect((await api.get(`/parties/${unused.id}`)).status).toBe(404);
  });

  it('öneri en fazla 8 ve Türkçe harf farkından etkilenmez; telefonla arama', async () => {
    const { api } = await setup();
    for (let index = 0; index < 10; index += 1) await api.createParty(`Şahin Yapı ${index}`);
    await api.createParty('Telefonlu', { phone: '0532 111 22 33' });
    expect(await api.ok(api.get('/parties/suggest', { q: 'sahin' }))).toHaveLength(8);
    expect((await api.ok(api.get('/parties', { q: '5321112233' }))).items[0].name).toBe(
      'Telefonlu',
    );
  });
});

describe('kategoriler ve firma bilgisi', () => {
  it('yeni firma 6 başlangıç kategorisiyle açılır', async () => {
    const testApp = buildTestApp();
    const { accessToken } = await enrollPlatformAdmin(testApp);
    const res = await request(testApp.app)
      .post('/platform/companies')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', idempotencyKey())
      .send({ name: 'Yeni Firma' });
    const names = await CategoryModel.find({ companyId: res.body.data.id }).sort({ nameFolded: 1 });
    expect(names.map((c) => c.name).sort()).toEqual(
      ['Genel giderler', 'Kira', 'Malzeme', 'Nakliye', 'Taşeron', 'İşçilik'].sort(),
    );
  });

  it('ad firma içinde benzersiz; yeniden adlandır ve pasifleştir; pasifler istenirse listelenir', async () => {
    const { api } = await setup();
    const category = await api.ok(api.post('/categories', { name: 'Malzeme' }), 201);
    const duplicate = await api.post('/categories', { name: 'MALZEME' });
    expect(duplicate.status).toBe(409);

    const renamed = await api.ok(
      api.patch(`/categories/${category.id}`, { name: 'Yapı malzemesi', ...version(category) }),
    );
    await api.ok(api.patch(`/categories/${category.id}`, { isActive: false, ...version(renamed) }));
    expect(await api.ok(api.get('/categories'))).toEqual([]);
    expect(await api.ok(api.get('/categories', { includeInactive: 'true' }))).toEqual([
      expect.objectContaining({ name: 'Yapı malzemesi', isActive: false }),
    ]);
  });

  it('firma görünen adı ve iletişim düzenlenir, geçmiş tutulur; işletim notu dönmez', async () => {
    const { api } = await setup();
    const company = await api.ok(api.get('/company'));
    expect(company).not.toHaveProperty('opsNote');
    const updated = await api.ok(
      api.patch('/company', {
        displayName: 'Yıldız İnşaat',
        contact: { person: 'Ali', phone: '', email: '' },
        ...version(company),
      }),
    );
    expect(updated).toMatchObject({ displayName: 'Yıldız İnşaat', storage: { usedBytes: 0 } });
    const { CompanyModel } = await import('../src/models/company.js');
    const stored = await CompanyModel.findOne();
    expect(stored?.history.at(-1)).toMatchObject({ action: 'update' });
    expect((await api.patch('/company', { displayName: 'X', ...version(company) })).status).toBe(
      409,
    );
  });
});

describe('anlaşma yaşam döngüsü', () => {
  it('vade değişikliği gerekçe ve eski/yeni tarih saklar; iş durumu borcu sıfırlamaz', async () => {
    const { api } = await setup();
    const party = await api.createParty();
    let agreement = await agreementFor(api, null, party);
    agreement = await api.ok(
      api.post(
        `/agreements/${agreement.id}/due-date`,
        { dueDate: '2026-07-01', reason: 'Takvim', ...version(agreement) },
        null,
      ),
    );
    agreement = await api.ok(
      api.post(
        `/agreements/${agreement.id}/work-status`,
        { workStatus: 'completed', ...version(agreement) },
        null,
      ),
    );
    expect(agreement).toMatchObject({
      workStatus: 'completed',
      remaining: tl(100_000),
      dueDate: '2026-07-01',
    });

    const detail = await api.agreement(agreement.id);
    expect(detail.dueDateHistory[0]).toMatchObject({
      old: null,
      new: '2026-07-01',
      reason: 'Takvim',
    });
  });

  it('hareketi olan anlaşma silinmez; iptal edilen anlaşmanın iş durumu değişmez', async () => {
    const { api } = await setup();
    const party = await api.createParty();
    let agreement = await agreementFor(api, null, party);
    await api.pay(agreement, tl(1_000));
    agreement = await api.agreement(agreement.id);

    const blocked = await api.delete(`/agreements/${agreement.id}`, {
      reason: 'Sil',
      ...version(agreement),
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('HAS_DEPENDENCIES');

    agreement = await api.ok(
      api.post(
        `/agreements/${agreement.id}/cancel`,
        { reason: 'Vazgeçildi', ...version(agreement) },
        null,
      ),
    );
    expect(
      (
        await api.post(
          `/agreements/${agreement.id}/work-status`,
          { workStatus: 'ongoing', ...version(agreement) },
          null,
        )
      ).status,
    ).toBe(409);
  });

  it('silinen anlaşma, kişisi silinmişse geri yüklenemez; liste toplamları ve vade filtresi', async () => {
    const { testApp, api } = await setup();
    const party = await api.createParty('Geçici');
    const agreement = await agreementFor(api, null, party, tl(10_000));
    await api.ok(
      api.delete(`/agreements/${agreement.id}`, { reason: 'Yanlış', ...version(agreement) }),
    );
    const partyNow = await api.ok(api.get(`/parties/${party.id}`));
    expect(
      (await api.delete(`/parties/${party.id}`, { reason: 'Sil', ...version(partyNow) })).status,
    ).toBe(409);

    const other = await api.createParty('Diğer');
    const { businessToday } = await import('../src/lib/clock.js');
    const { addDays } = await import('@santiye/shared');
    await agreementFor(api, null, other, tl(30_000));
    await api.createAgreement({
      title: 'Gecikmiş',
      scope: 'company',
      partyId: other.id,
      initialAmount: tl(5_000),
      dueDate: addDays(businessToday(testApp.clock), -3),
    });

    const list = await api.ok(api.get('/agreements'));
    expect(list.total).toBe(2);
    expect(list.totals.payable).toMatchObject({
      totalAmount: tl(35_000),
      remaining: tl(35_000),
      overdue: tl(5_000),
    });
    const overdue = await api.ok(api.get('/agreements', { dueState: 'overdue' }));
    expect(overdue.items.map((a: { label: string }) => a.label)).toEqual(['Gecikmiş']);
    expect((await api.ok(api.get('/agreements', { includeDeleted: 'true' }))).total).toBe(3);
  });
});
