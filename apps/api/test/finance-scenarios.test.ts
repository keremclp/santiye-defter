// Şartname bölüm 9 ve karar belgesi bölüm 6 örnekleri API üzerinden uçtan uca, birebir tutarlarla.

import { addDays } from '@santiye/shared';
import { describe, expect, it } from 'vitest';
import { businessToday } from '../src/lib/clock.js';
import { buildTestApp, useTestDatabase } from './helpers/app.js';
import { financeSetup, tl, type Api } from './helpers/finance.js';

useTestDatabase();

async function setup() {
  const testApp = buildTestApp();
  const { api } = await financeSetup(testApp);
  const project = await api.createProject('Kadıköy Villa');
  const party = await api.createParty('Yılmaz Elektrik', { tags: ['subcontractor'] });
  return { testApp, api, project, party };
}

async function payable(
  api: Api,
  project: { id: string } | null,
  party: { id: string },
  amount: number,
  title = 'Elektrik işi',
) {
  return api.createAgreement({
    title,
    direction: 'payable',
    scope: project ? 'project' : 'company',
    ...(project ? { projectId: project.id } : {}),
    partyId: party.id,
    initialAmount: amount,
  });
}

function editable(agreement: { updatedAt: string }) {
  return { expectedUpdatedAt: agreement.updatedAt };
}

describe('9.2 anlaşma: 120.000 TL anlaşma, 45.000 TL ödeme', () => {
  it('anlaşma oluşturmak hareket yazmaz; ödeme gideri yalnız 45.000 artırır, kalan 75.000', async () => {
    const { api, project, party } = await setup();
    const agreement = await payable(api, project, party, tl(120_000));

    expect(agreement).toMatchObject({
      currentAmount: tl(120_000),
      remaining: tl(120_000),
      paymentStatus: 'open',
      workStatus: 'ongoing',
    });
    expect((await api.totals()).netExpense).toBe(0);

    await api.pay(agreement, tl(45_000));
    expect(await api.agreement(agreement.id)).toMatchObject({
      netSettled: tl(45_000),
      remaining: tl(75_000),
      excess: 0,
      paymentStatus: 'partial',
    });
    expect((await api.totals()).netExpense).toBe(tl(45_000));
    expect((await api.ok(api.get('/dashboard'))).totals).toMatchObject({
      netExpense: tl(45_000),
      remainingPayable: tl(75_000),
    });
  });

  it('ek iş: bedel 140.000, gider değişmez, kalan 95.000; 95.000 son ödemeyle kalan 0', async () => {
    const { api, project, party } = await setup();
    let agreement = await payable(api, project, party, tl(120_000));
    await api.pay(agreement, tl(45_000));
    agreement = await api.agreement(agreement.id);

    agreement = await api.ok(
      api.post(`/agreements/${agreement.id}/amount`, {
        newAmount: tl(140_000),
        reason: '20.000 TL ek iş',
        ...editable(agreement),
      }),
    );
    expect(agreement).toMatchObject({ currentAmount: tl(140_000), remaining: tl(95_000) });
    expect((await api.totals()).netExpense).toBe(tl(45_000));

    await api.pay(agreement, tl(95_000));
    expect(await api.agreement(agreement.id)).toMatchObject({
      remaining: 0,
      excess: 0,
      paymentStatus: 'settled',
    });
    expect((await api.totals()).netExpense).toBe(tl(140_000));
  });

  it('bedel düşüşü: 45.000 ödenmişken bedel 40.000 → gider 45.000, kalan 0, fazla 5.000', async () => {
    const { api, project, party } = await setup();
    let agreement = await payable(api, project, party, tl(120_000));
    await api.pay(agreement, tl(45_000));
    agreement = await api.agreement(agreement.id);

    const preview = await api.ok(
      api.post(`/agreements/${agreement.id}/amount?preview=1`, { newAmount: tl(40_000) }),
    );
    expect(preview.after).toMatchObject({
      currentAmount: tl(40_000),
      remaining: 0,
      excess: tl(5_000),
    });
    expect((await api.agreement(agreement.id)).currentAmount).toBe(tl(120_000));

    agreement = await api.ok(
      api.post(`/agreements/${agreement.id}/amount`, {
        newAmount: tl(40_000),
        reason: 'Kapsam daraldı',
        ...editable(agreement),
      }),
    );
    expect(agreement).toMatchObject({ remaining: 0, excess: tl(5_000), paymentStatus: 'overpaid' });
    expect((await api.totals()).netExpense).toBe(tl(45_000));
  });

  it('iptal: kesin bedel 30.000 → kalan 0, fazla 15.000; 15.000 iade sonrası net 30.000', async () => {
    const { api, project, party } = await setup();
    let agreement = await payable(api, project, party, tl(120_000));
    const payment = await api.pay(agreement, tl(45_000));
    agreement = await api.agreement(agreement.id);

    agreement = await api.ok(
      api.post(`/agreements/${agreement.id}/cancel`, {
        finalAmount: tl(30_000),
        reason: 'İş iptal edildi',
        ...editable(agreement),
      }),
    );
    expect(agreement).toMatchObject({
      workStatus: 'cancelled',
      currentAmount: tl(30_000),
      remaining: 0,
      excess: tl(15_000),
      settlementPending: false,
    });

    await api.ok(
      api.post(`/transactions/${payment.id}/refunds`, {
        amount: tl(15_000),
        date: '2026-04-01',
        reason: 'Fazla ödeme geri alındı',
        parts: [{ allocationId: payment.allocations[0].id, amount: tl(15_000) }],
      }),
      201,
    );
    expect(await api.agreement(agreement.id)).toMatchObject({
      netSettled: tl(30_000),
      remaining: 0,
      excess: 0,
      paymentStatus: 'settled',
    });
    expect(await api.totals()).toMatchObject({
      expense: tl(45_000),
      expenseRefund: tl(15_000),
      netExpense: tl(30_000),
    });
    expect((await api.transaction(payment.id)).amount).toBe(tl(45_000));
  });

  it('kesin bedeli belli olmayan iptal "hesap kesinleşmedi" kalır ve kalan gizlenmez', async () => {
    const { api, project, party } = await setup();
    let agreement = await payable(api, project, party, tl(120_000));
    await api.pay(agreement, tl(45_000));
    agreement = await api.agreement(agreement.id);

    agreement = await api.ok(
      api.post(`/agreements/${agreement.id}/cancel`, {
        reason: 'İş durdu',
        ...editable(agreement),
      }),
    );
    expect(agreement).toMatchObject({
      workStatus: 'cancelled',
      settlementPending: true,
      remaining: tl(75_000),
    });

    agreement = await api.ok(
      api.post(`/agreements/${agreement.id}/amount`, {
        newAmount: tl(50_000),
        reason: 'Hesaplaşıldı',
        ...editable(agreement),
      }),
    );
    expect(agreement).toMatchObject({ settlementPending: false, remaining: tl(5_000) });
  });
});

describe('9.2 başlangıç kaydı: 75.000 borç, 25.000 ödeme', () => {
  it('başlangıç kaydı gider sayılmaz; sonraki 25.000 ödeme yeni gider, kalan 50.000', async () => {
    const { api, party } = await setup();
    const opening = await api.createAgreement({
      kind: 'opening',
      direction: 'payable',
      scope: 'company',
      partyId: party.id,
      initialAmount: tl(75_000),
      trackingStartDate: '2026-01-01',
    });
    expect(opening).toMatchObject({
      kind: 'opening',
      label: 'Başlangıç borcu',
      remaining: tl(75_000),
      workStatus: null,
    });
    expect((await api.totals()).netExpense).toBe(0);

    await api.pay(opening, tl(25_000));
    expect((await api.totals()).netExpense).toBe(tl(25_000));
    expect((await api.agreement(opening.id)).remaining).toBe(tl(50_000));
  });
});

describe('9.2 paylaştırma: 40.000 TL ödeme A 25.000 + B 15.000', () => {
  it('A 75.000 → 50.000, B 60.000 → 45.000; firma giderinde 40.000 bir kez, şantiye toplamı paylardan', async () => {
    const { api, party } = await setup();
    const a = await api.createProject('A Şantiyesi');
    const b = await api.createProject('B Şantiyesi');
    const agreementA = await payable(api, a, party, tl(120_000), 'A elektrik');
    const agreementB = await payable(api, b, party, tl(80_000), 'B elektrik');
    await api.pay(agreementA, tl(45_000));
    await api.pay(agreementB, tl(20_000));

    const split = await api.ok(
      api.post('/transactions', {
        kind: 'expense',
        amount: tl(40_000),
        date: '2026-03-15',
        partyId: party.id,
        allocations: [
          { scope: 'project', projectId: a.id, agreementId: agreementA.id, amount: tl(25_000) },
          { scope: 'project', projectId: b.id, agreementId: agreementB.id, amount: tl(15_000) },
        ],
      }),
      201,
    );
    expect(split.isSplit).toBe(true);

    expect((await api.agreement(agreementA.id)).remaining).toBe(tl(50_000));
    expect((await api.agreement(agreementB.id)).remaining).toBe(tl(45_000));
    expect((await api.totals({ dateFrom: '2026-03-15', dateTo: '2026-03-15' })).netExpense).toBe(
      tl(40_000),
    );
    expect((await api.totals({ projectId: a.id, dateFrom: '2026-03-15' })).netExpense).toBe(
      tl(25_000),
    );
    expect((await api.totals({ projectId: b.id, dateFrom: '2026-03-15' })).netExpense).toBe(
      tl(15_000),
    );
    expect((await api.ok(api.get(`/projects/${a.id}/summary`))).cash.netExpense).toBe(tl(70_000));

    const listed = await api.ok(
      api.get('/transactions', { projectId: b.id, dateFrom: '2026-03-15' }),
    );
    expect(listed.items[0]).toMatchObject({
      amount: tl(40_000),
      scopedAmount: tl(15_000),
      isSplit: true,
    });
  });

  it('pay toplamı tutara eşit değilse kayıt açılmaz', async () => {
    const { api, project } = await setup();
    const res = await api.post('/transactions', {
      kind: 'expense',
      amount: tl(40_000),
      date: '2026-03-15',
      allocations: [
        { scope: 'project', projectId: project.id, amount: tl(25_000) },
        { scope: 'company', amount: tl(10_000) },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı.');
  });
});

describe('9.4 iade sınırı: 45.000 ödemenin 5.000’i iade edilmiş', () => {
  it('en fazla 40.000 daha iade edilir; fazlası 422 LIMIT_EXCEEDED', async () => {
    const { api, project, party } = await setup();
    const agreement = await payable(api, project, party, tl(120_000));
    const payment = await api.pay(agreement, tl(45_000));
    const allocationId = payment.allocations[0].id;
    const refund = (amount: number) =>
      api.post(`/transactions/${payment.id}/refunds`, {
        amount,
        date: '2026-04-01',
        reason: 'İade',
        parts: [{ allocationId, amount }],
      });

    await api.ok(refund(tl(5_000)), 201);
    expect(await api.agreement(agreement.id)).toMatchObject({
      netSettled: tl(40_000),
      remaining: tl(80_000),
    });
    expect((await api.transaction(payment.id)).allocations[0].refundedAmount).toBe(tl(5_000));

    const over = await refund(tl(40_000) + 1);
    expect(over.status).toBe(422);
    expect(over.body).toMatchObject({
      code: 'LIMIT_EXCEEDED',
      message: 'Bu kayıttan en fazla 40.000 TL iade edilebilir.',
    });

    await api.ok(refund(tl(40_000)), 201);
    expect((await api.transaction(payment.id)).refundable).toBe(0);
  });

  it('ana tutar bağlı iade toplamının altına indirilemez', async () => {
    const { api, project, party } = await setup();
    const agreement = await payable(api, project, party, tl(120_000));
    const payment = await api.pay(agreement, tl(45_000));
    await api.ok(
      api.post(`/transactions/${payment.id}/refunds`, {
        amount: tl(5_000),
        date: '2026-04-01',
        reason: 'İade',
        parts: [{ allocationId: payment.allocations[0].id, amount: tl(5_000) }],
      }),
      201,
    );
    const current = await api.transaction(payment.id);
    const res = await api.patch(`/transactions/${payment.id}`, {
      amount: tl(4_000),
      reason: 'Yanlış tutar',
      expectedUpdatedAt: current.updatedAt,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'Pay tutarı bağlı iadelerin toplamının (5.000 TL) altına indirilemez.',
    );
  });
});

describe('9.1 dönem: ocakta 40.000 ödeme, şubatta 10.000 iade', () => {
  it('ocak 40.000, şubat −10.000, toplam 30.000', async () => {
    const { api, project } = await setup();
    const payment = await api.ok(
      api.record({ kind: 'expense', amount: tl(40_000), date: '2026-01-15', project }),
      201,
    );
    await api.ok(
      api.post(`/transactions/${payment.id}/refunds`, {
        amount: tl(10_000),
        date: '2026-02-10',
        reason: 'Malzeme iadesi',
        parts: [{ allocationId: payment.allocations[0].id, amount: tl(10_000) }],
      }),
      201,
    );
    expect((await api.totals({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })).netExpense).toBe(
      tl(40_000),
    );
    expect((await api.totals({ dateFrom: '2026-02-01', dateTo: '2026-02-28' })).netExpense).toBe(
      -tl(10_000),
    );
    expect((await api.totals()).netExpense).toBe(tl(30_000));
  });
});

describe('9.3 vade: 800.000 TL tahsil edilecek anlaşma (senaryo 2)', () => {
  it('vade öncesi gecikmiş 0; vade geçince kalanın tamamı gecikmiş; kısmi tahsilat gecikmişi azaltır, vadeyi ertelemez', async () => {
    const { testApp, api, project } = await setup();
    const customer = await api.createParty('Ayşe Hanım', { kind: 'person', tags: ['customer'] });
    const today = businessToday(testApp.clock);
    const dueDate = addDays(today, 10);
    const agreement = await api.createAgreement({
      title: 'Villa satışı',
      direction: 'receivable',
      scope: 'project',
      projectId: project.id,
      partyId: customer.id,
      initialAmount: tl(800_000),
      dueDate,
    });
    await api.collect(agreement, tl(300_000));
    const overdue = async () => (await api.ok(api.get('/dashboard'))).totals.overdueReceivable;

    expect(await overdue()).toBe(0);
    expect(
      (await api.ok(api.get('/dues', { direction: 'receivable', group: 'upcoming' }))).items,
    ).toHaveLength(1);

    testApp.clock.advance(11 * 24 * 60 * 60 * 1000);
    const api2 = await api.relogin();
    expect((await api2.ok(api2.get('/dashboard'))).totals.overdueReceivable).toBe(tl(500_000));
    const dues = await api2.ok(api2.get('/dues', { direction: 'receivable', group: 'overdue' }));
    expect(dues.items[0]).toMatchObject({ remaining: tl(500_000), overdueDays: 1, dueDate });

    await api2.collect(agreement, tl(200_000));
    expect((await api2.ok(api2.get('/dashboard'))).totals.overdueReceivable).toBe(tl(300_000));
    expect((await api2.agreement(agreement.id)).dueDate).toBe(dueDate);
  });

  it('pencerenin ötesindeki vade "daha sonra" grubunda, yaklaşanda değil', async () => {
    const { testApp, api, project, party } = await setup();
    const today = businessToday(testApp.clock);
    await api.createAgreement({
      title: 'Uzak vade',
      scope: 'project',
      projectId: project.id,
      partyId: party.id,
      initialAmount: tl(10_000),
      dueDate: addDays(today, 45),
    });
    const group = async (name: string) =>
      (await api.ok(api.get('/dues', { direction: 'payable', group: name }))).items.length;
    expect(await group('upcoming')).toBe(0);
    expect(await group('later')).toBe(1);
  });

  it('vadesiz kayıt gecikmiş sayılmaz, "vadesi belirlenmemiş" grubunda görünür', async () => {
    const { api, project, party } = await setup();
    await payable(api, project, party, tl(10_000));
    expect(
      (await api.ok(api.get('/dues', { direction: 'payable', group: 'none' }))).items,
    ).toHaveLength(1);
    expect(
      (await api.ok(api.get('/dues', { direction: 'payable', group: 'overdue' }))).items,
    ).toHaveLength(0);
  });
});

describe('karar belgesi 6.4: yanlış kayıt, düzeltme, silme, geri yükleme, gerçek iade', () => {
  it('45.000 → 40.000 düzeltme kalan 80.000; silme 120.000; geri yükleme 80.000; gerekçe ve geçmiş kalır', async () => {
    const { api, project, party } = await setup();
    const agreement = await payable(api, project, party, tl(120_000));
    let payment = await api.pay(agreement, tl(45_000));
    const remaining = async () => (await api.agreement(agreement.id)).remaining;
    const expense = async () => (await api.totals()).netExpense;

    payment = await api.ok(
      api.patch(`/transactions/${payment.id}`, {
        amount: tl(40_000),
        reason: 'Tutar yanlış girilmiş',
        expectedUpdatedAt: payment.updatedAt,
      }),
    );
    expect([await expense(), await remaining()]).toEqual([tl(40_000), tl(80_000)]);

    await api.ok(
      api.delete(`/transactions/${payment.id}`, {
        reason: 'Yanlışlıkla silindi',
        expectedUpdatedAt: payment.updatedAt,
      }),
    );
    expect([await expense(), await remaining()]).toEqual([0, tl(120_000)]);

    const deleted = await api.transaction(payment.id);
    await api.ok(
      api.post(`/transactions/${payment.id}/restore`, {
        reason: 'Geri alındı',
        expectedUpdatedAt: deleted.updatedAt,
      }),
    );
    expect([await expense(), await remaining()]).toEqual([tl(40_000), tl(80_000)]);

    const history = (await api.transaction(payment.id)).history;
    expect(history.map((entry: { action: string }) => entry.action)).toEqual([
      'create',
      'correct',
      'delete',
      'restore',
    ]);
    expect(history[1]).toMatchObject({
      reason: 'Tutar yanlış girilmiş',
      changes: expect.arrayContaining([
        expect.objectContaining({ field: 'amount', old: tl(45_000), new: tl(40_000) }),
      ]),
    });
  });

  it('yanlış şantiye ve anlaşma düzeltmesi: eski ve yeni bakiyeler birlikte, firma toplamı değişmez', async () => {
    const { api, party } = await setup();
    const a = await api.createProject('A Şantiyesi');
    const b = await api.createProject('B Şantiyesi');
    const agreementA = await payable(api, a, party, tl(100_000), 'A işi');
    const agreementB = await payable(api, b, party, tl(100_000), 'B işi');
    const payment = await api.pay(agreementA, tl(30_000));

    await api.ok(
      api.patch(`/transactions/${payment.id}`, {
        allocations: [
          {
            id: payment.allocations[0].id,
            scope: 'project',
            projectId: b.id,
            agreementId: agreementB.id,
            amount: tl(30_000),
          },
        ],
        reason: 'Yanlış şantiyeye girilmiş',
        expectedUpdatedAt: payment.updatedAt,
      }),
    );
    expect((await api.agreement(agreementA.id)).remaining).toBe(tl(100_000));
    expect((await api.agreement(agreementB.id)).remaining).toBe(tl(70_000));
    expect((await api.totals()).netExpense).toBe(tl(30_000));
    expect((await api.totals({ projectId: a.id })).netExpense).toBe(0);
    expect((await api.totals({ projectId: b.id })).netExpense).toBe(tl(30_000));
  });
});

describe('karar belgesi 6.6: genel firma giderleri', () => {
  it('A 100.000 + B 60.000 + firma geneli 25.000 = 185.000; 30.000 kira borcuna 10.000 ödeme → 195.000, kalan 20.000', async () => {
    const { api } = await setup();
    const a = await api.createProject('A Şantiyesi');
    const b = await api.createProject('B Şantiyesi');
    await api.ok(api.record({ kind: 'expense', amount: tl(100_000), project: a }), 201);
    await api.ok(api.record({ kind: 'expense', amount: tl(60_000), project: b }), 201);
    await api.ok(api.record({ kind: 'expense', amount: tl(25_000), project: null }), 201);
    expect((await api.totals()).netExpense).toBe(tl(185_000));
    expect((await api.totals({ projectId: a.id })).netExpense).toBe(tl(100_000));
    expect((await api.totals({ scope: 'company' })).netExpense).toBe(tl(25_000));

    const landlord = await api.createParty('Ev Sahibi');
    const rent = await payable(api, null, landlord, tl(30_000), 'Ofis kirası');
    expect((await api.totals()).netExpense).toBe(tl(185_000));
    await api.pay(rent, tl(10_000));
    expect((await api.totals()).netExpense).toBe(tl(195_000));
    expect((await api.agreement(rent.id)).remaining).toBe(tl(20_000));
  });
});

describe('kabul 5: tahsil edilecek anlaşmada aynı ilke ters yönde', () => {
  it('120.000 alacak anlaşmasına 45.000 tahsilat → gelir 45.000, kalan alacak 75.000', async () => {
    const { api, project } = await setup();
    const customer = await api.createParty('Müşteri', { tags: ['customer'] });
    const agreement = await api.createAgreement({
      title: 'Satış',
      direction: 'receivable',
      scope: 'project',
      projectId: project.id,
      partyId: customer.id,
      initialAmount: tl(120_000),
    });
    await api.collect(agreement, tl(45_000));
    expect(await api.totals()).toMatchObject({ netIncome: tl(45_000), netExpense: 0 });
    expect((await api.agreement(agreement.id)).remaining).toBe(tl(75_000));
    expect((await api.ok(api.get('/dashboard'))).totals.remainingReceivable).toBe(tl(75_000));
  });
});
