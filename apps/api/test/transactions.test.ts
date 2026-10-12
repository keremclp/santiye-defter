import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { TransactionModel } from '../src/models/transaction.js';
import { buildTestApp, useTestDatabase } from './helpers/app.js';
import { financeSetup, tl, type Api } from './helpers/finance.js';

useTestDatabase();

async function setup() {
  const testApp = buildTestApp();
  const { api, company, user } = await financeSetup(testApp);
  const project = await api.createProject('Kadıköy Villa');
  const party = await api.createParty('Yılmaz Elektrik');
  const agreement = await api.createAgreement({
    title: 'Elektrik işi',
    scope: 'project',
    projectId: project.id,
    partyId: party.id,
    initialAmount: tl(100_000),
  });
  return { testApp, api, company, user, project, party, agreement };
}

const refundBody = (payment: { allocations: { id: string }[] }, amount: number) => ({
  amount,
  date: '2026-04-01',
  reason: 'İade',
  parts: [{ allocationId: payment.allocations[0]!.id, amount }],
});

describe('fazla ödeme', () => {
  it('kalanı aşan ödeme onaysız kaydedilmez: 409 EXCESS_CONFIRMATION_REQUIRED ve aşan tutar', async () => {
    const { api, agreement } = await setup();
    const res = await api.record({ kind: 'expense', amount: tl(105_000), agreement });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'EXCESS_CONFIRMATION_REQUIRED',
      message: 'Bu ödeme anlaşmanın kalanını 5.000 TL aşıyor.',
      details: { excess: tl(5_000) },
    });
    expect(await TransactionModel.collection.countDocuments()).toBe(0);
  });

  it('onay ve gerekçeyle kaydedilir; "Fazla ödeme kaydedildi", fazla anlaşmada ayrı görünür', async () => {
    const { api, agreement } = await setup();
    const res = await api.record({
      kind: 'expense',
      amount: tl(105_000),
      agreement,
      extra: { confirmExcess: true, excessReason: 'Ek malzeme bedeli peşin ödendi' },
    });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Fazla ödeme kaydedildi');
    expect(res.body.data.excess).toEqual({
      amount: tl(5_000),
      reason: 'Ek malzeme bedeli peşin ödendi',
    });
    expect(await api.agreement(agreement.id)).toMatchObject({
      remaining: 0,
      excess: tl(5_000),
      paymentStatus: 'overpaid',
    });
  });

  it('kalanın tam ödenmesi fazla sayılmaz', async () => {
    const { api, agreement } = await setup();
    expect((await api.record({ kind: 'expense', amount: tl(100_000), agreement })).status).toBe(
      201,
    );
  });
});

describe('hareket doğrulaması', () => {
  it('gider tahsil edilecek anlaşmaya bağlanamaz; kişi anlaşmanınkiyle aynı olmalı', async () => {
    const { api, project, agreement } = await setup();
    const customer = await api.createParty('Müşteri');
    const receivable = await api.createAgreement({
      title: 'Satış',
      direction: 'receivable',
      scope: 'project',
      projectId: project.id,
      partyId: customer.id,
      initialAmount: tl(50_000),
    });

    const wrongDirection = await api.record({
      kind: 'expense',
      amount: tl(1_000),
      agreement: receivable,
    });
    expect(wrongDirection.status).toBe(400);
    expect(wrongDirection.body.message).toBe('Gider yalnız ödenecek anlaşmaya bağlanabilir.');

    const wrongParty = await api.record({
      kind: 'expense',
      amount: tl(1_000),
      agreement: { ...agreement, partyId: customer.id },
    });
    expect(wrongParty.status).toBe(400);
    expect(wrongParty.body.details.issues).toContainEqual(
      expect.objectContaining({ code: 'PARTY_MISMATCH' }),
    );
  });

  it('anlaşmasız doğrudan gider anlaşmanın kalanını değiştirmez; kişi seçmek bağlamak sayılmaz', async () => {
    const { api, project, party, agreement } = await setup();
    const direct = await api.ok(
      api.record({ kind: 'expense', amount: tl(10_000), project, party }),
      201,
    );
    expect(direct.linkedToAgreement).toBe(false);
    expect((await api.agreement(agreement.id)).remaining).toBe(tl(100_000));
  });

  it('kategori yalnız giderde ve aktif olmalı; başka firmanın veya olmayan şantiye reddedilir', async () => {
    const { api, project } = await setup();
    const category = await api.ok(api.post('/categories', { name: 'Malzeme' }), 201);
    const income = await api.record({
      kind: 'income',
      amount: tl(1_000),
      project,
      extra: { categoryId: category.id },
    });
    expect(income.status).toBe(400);

    await api.ok(
      api.patch(`/categories/${category.id}`, {
        isActive: false,
        expectedUpdatedAt: category.updatedAt,
      }),
    );
    const inactive = await api.record({
      kind: 'expense',
      amount: tl(1_000),
      project,
      extra: { categoryId: category.id },
    });
    expect(inactive.status).toBe(400);
    expect(inactive.body.message).toBe('Pasif kategori seçilemez.');

    const missing = await api.record({
      kind: 'expense',
      amount: tl(1_000),
      project: { id: '64b000000000000000000000' },
    });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toBe('Şantiye bulunamadı.');
  });

  it('kayıt numarası firma içinde artar', async () => {
    const { api, project } = await setup();
    const first = await api.ok(api.record({ kind: 'expense', amount: tl(1), project }), 201);
    const second = await api.ok(api.record({ kind: 'income', amount: tl(2), project }), 201);
    expect(second.recordNo).toBe(first.recordNo + 1);
  });
});

describe('tamamlanan ve arşivlenen şantiye', () => {
  async function completed(api: Api, project: { id: string; updatedAt: string }) {
    return api.ok(
      api.post(`/projects/${project.id}/complete`, { expectedUpdatedAt: project.updatedAt }),
    );
  }

  it('anlaşmaya ödeme serbest; anlaşmasız gider gerekçe ister; anlaşmasız gelir serbest', async () => {
    const { api, project, agreement } = await setup();
    await completed(api, await api.ok(api.get(`/projects/${project.id}`)));

    expect((await api.record({ kind: 'expense', amount: tl(10_000), agreement })).status).toBe(201);
    const direct = await api.record({ kind: 'expense', amount: tl(500), project });
    expect(direct.status).toBe(400);
    expect(direct.body.details.issues[0].code).toBe('REASON_REQUIRED');
    expect(
      (
        await api.record({
          kind: 'expense',
          amount: tl(500),
          project,
          extra: { reason: 'Geç gelen nakliye faturası' },
        })
      ).status,
    ).toBe(201);
    expect((await api.record({ kind: 'income', amount: tl(500), project })).status).toBe(201);
  });

  it('tamamlanan veya arşivlenen şantiyeye yeni anlaşma açılmaz; arşiv tamamlanan gibi davranır', async () => {
    const { api, project, party } = await setup();
    const current = await api.ok(api.get(`/projects/${project.id}`));
    const archived = await api.ok(
      api.post(`/projects/${project.id}/archive`, {
        archived: true,
        expectedUpdatedAt: current.updatedAt,
      }),
    );
    expect(archived.status).toBe('archived');

    const agreement = await api.post('/agreements', {
      kind: 'agreement',
      title: 'Yeni iş',
      direction: 'payable',
      scope: 'project',
      projectId: project.id,
      partyId: party.id,
      initialAmount: tl(1_000),
    });
    expect(agreement.status).toBe(400);
    expect(agreement.body.message).toMatch(/önce şantiyeyi yeniden aktifleştirin/);
    expect((await api.record({ kind: 'expense', amount: tl(500), project })).status).toBe(400);
  });
});

describe('iade', () => {
  it('paylaştırılmış kaynakta pay bazında iade; iade kendi kapsamındaki toplamı düşürür', async () => {
    const { api, party } = await setup();
    const a = await api.createProject('A');
    const b = await api.createProject('B');
    const payment = await api.ok(
      api.post('/transactions', {
        kind: 'expense',
        amount: tl(40_000),
        date: '2026-03-01',
        partyId: party.id,
        allocations: [
          { scope: 'project', projectId: a.id, amount: tl(25_000) },
          { scope: 'project', projectId: b.id, amount: tl(15_000) },
        ],
      }),
      201,
    );
    const over = await api.post(`/transactions/${payment.id}/refunds`, {
      amount: tl(16_000),
      date: '2026-03-05',
      reason: 'İade',
      parts: [{ allocationId: payment.allocations[1].id, amount: tl(16_000) }],
    });
    expect(over.status).toBe(422);
    expect(over.body.message).toBe('Bu paydan en fazla 15.000 TL iade edilebilir.');

    const refund = await api.ok(
      api.post(`/transactions/${payment.id}/refunds`, {
        amount: tl(5_000),
        date: '2026-03-05',
        reason: 'B malzeme iadesi',
        parts: [{ allocationId: payment.allocations[1].id, amount: tl(5_000) }],
      }),
      201,
    );
    expect(refund).toMatchObject({
      kind: 'expense_refund',
      description: 'B malzeme iadesi',
      partyId: party.id,
    });
    expect(refund.allocations[0]).toMatchObject({ projectId: b.id, amount: tl(5_000) });
    expect((await api.totals({ projectId: b.id })).netExpense).toBe(tl(10_000));
    expect((await api.totals({ projectId: a.id })).netExpense).toBe(tl(25_000));
  });

  it('iade düzeltme ve silme kaynak payın refundedAmount değerini ve anlaşma kalanını günceller', async () => {
    const { api, agreement } = await setup();
    const payment = await api.pay(agreement, tl(45_000));
    let refund = await api.ok(
      api.post(`/transactions/${payment.id}/refunds`, refundBody(payment, tl(5_000))),
      201,
    );

    refund = await api.ok(
      api.patch(`/transactions/${refund.id}`, {
        amount: tl(8_000),
        reason: 'İade tutarı yanlış',
        expectedUpdatedAt: refund.updatedAt,
      }),
    );
    expect((await api.transaction(payment.id)).allocations[0].refundedAmount).toBe(tl(8_000));
    expect((await api.agreement(agreement.id)).remaining).toBe(tl(63_000));

    await api.ok(
      api.delete(`/transactions/${refund.id}`, {
        reason: 'İade gerçekleşmedi',
        expectedUpdatedAt: refund.updatedAt,
      }),
    );
    expect((await api.transaction(payment.id)).allocations[0].refundedAmount).toBe(0);
    expect((await api.agreement(agreement.id)).remaining).toBe(tl(55_000));

    const deleted = await api.transaction(refund.id);
    await api.ok(
      api.post(`/transactions/${refund.id}/restore`, {
        reason: 'Geri alındı',
        expectedUpdatedAt: deleted.updatedAt,
      }),
    );
    expect((await api.transaction(payment.id)).allocations[0].refundedAmount).toBe(tl(8_000));
    expect((await api.totals()).netExpense).toBe(tl(37_000));
  });
});

describe('silme ve geri yükleme', () => {
  it('aktif iadesi olan hareket silinemez (409 HAS_DEPENDENCIES)', async () => {
    const { api, agreement } = await setup();
    const payment = await api.pay(agreement, tl(10_000));
    await api.ok(
      api.post(`/transactions/${payment.id}/refunds`, refundBody(payment, tl(1_000))),
      201,
    );
    const current = await api.transaction(payment.id);

    const res = await api.delete(`/transactions/${payment.id}`, {
      reason: 'Sil',
      expectedUpdatedAt: current.updatedAt,
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'HAS_DEPENDENCIES',
      message: 'Bu kayda bağlı iade var; önce iadeyi silin.',
    });
  });

  it('silme ve geri yükleme gerekçe ister', async () => {
    const { api, agreement } = await setup();
    const payment = await api.pay(agreement, tl(10_000));
    expect(
      (await api.delete(`/transactions/${payment.id}`, { expectedUpdatedAt: payment.updatedAt }))
        .status,
    ).toBe(400);
  });

  it('anlaşması silinmiş veya kaynağı silinmiş kayıt geri yüklenemez; neden ve çözüm yolu döner', async () => {
    const { api, agreement } = await setup();
    const payment = await api.pay(agreement, tl(10_000));
    await api.ok(
      api.delete(`/transactions/${payment.id}`, {
        reason: 'Yanlış',
        expectedUpdatedAt: payment.updatedAt,
      }),
    );
    const current = await api.agreement(agreement.id);
    await api.ok(
      api.delete(`/agreements/${agreement.id}`, {
        reason: 'İş yapılmadı',
        expectedUpdatedAt: current.updatedAt,
      }),
    );

    const deleted = await api.transaction(payment.id);
    const res = await api.post(`/transactions/${payment.id}/restore`, {
      reason: 'Geri al',
      expectedUpdatedAt: deleted.updatedAt,
    });
    expect(res.status).toBe(409);
    expect(res.body.details.issues[0].message).toBe(
      'Bağlı anlaşma silinmiş. Önce anlaşmayı geri yükleyin.',
    );
  });

  it('geri yüklenen ödeme kalanı aşıyorsa fazla onayı istenir; finansal etki bir kez uygulanır', async () => {
    const { api, agreement } = await setup();
    const first = await api.pay(agreement, tl(60_000));
    await api.ok(
      api.delete(`/transactions/${first.id}`, {
        reason: 'Yanlış',
        expectedUpdatedAt: first.updatedAt,
      }),
    );
    await api.pay(agreement, tl(70_000));
    const deleted = await api.transaction(first.id);

    const res = await api.post(`/transactions/${first.id}/restore`, {
      reason: 'Geri al',
      expectedUpdatedAt: deleted.updatedAt,
    });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'EXCESS_CONFIRMATION_REQUIRED',
      details: { excess: tl(30_000) },
    });

    await api.ok(
      api.post(`/transactions/${first.id}/restore`, {
        reason: 'Geri al',
        expectedUpdatedAt: deleted.updatedAt,
        confirmExcess: true,
        excessReason: 'İki ödeme de gerçekten yapıldı',
      }),
    );
    expect(await api.agreement(agreement.id)).toMatchObject({
      netSettled: tl(130_000),
      remaining: 0,
      excess: tl(30_000),
    });
    const again = await api.post(`/transactions/${first.id}/restore`, {
      reason: 'Tekrar',
      expectedUpdatedAt: (await api.transaction(first.id)).updatedAt,
    });
    expect(again.status).toBe(409);
    expect((await api.totals()).netExpense).toBe(tl(130_000));
  });
});

describe('düzeltme', () => {
  it('eski expectedUpdatedAt ile 409 CONFLICT ve güncel kayıt döner', async () => {
    const { api, agreement } = await setup();
    const payment = await api.pay(agreement, tl(10_000));
    await api.ok(
      api.patch(`/transactions/${payment.id}`, {
        description: 'Kablo',
        expectedUpdatedAt: payment.updatedAt,
      }),
    );

    const stale = await api.patch(`/transactions/${payment.id}`, {
      description: 'Başka',
      expectedUpdatedAt: payment.updatedAt,
    });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({
      code: 'CONFLICT',
      message: 'Kayıt başka bir yerde güncellendi',
      details: { current: { description: 'Kablo' } },
    });
  });

  it('yalnız açıklama değişiyorsa gerekçe istenmez ama geçmiş yazılır; finansal değişiklik gerekçe ister', async () => {
    const { api, agreement } = await setup();
    let payment = await api.pay(agreement, tl(10_000));
    payment = await api.ok(
      api.patch(`/transactions/${payment.id}`, {
        description: 'Kablo',
        expectedUpdatedAt: payment.updatedAt,
      }),
    );
    const detail = await api.transaction(payment.id);
    expect(detail.history.at(-1)).toMatchObject({ action: 'update', reason: null });

    const noReason = await api.patch(`/transactions/${payment.id}`, {
      amount: tl(9_000),
      expectedUpdatedAt: payment.updatedAt,
    });
    expect(noReason.status).toBe(400);
    expect(noReason.body.message).toBe('Finansal düzeltme için gerekçe girin.');
  });

  it('düzeltme kalanı aşarsa fazla onayı istenir; kendi eski tutarı kalandan düşülmez', async () => {
    const { api, agreement } = await setup();
    const payment = await api.pay(agreement, tl(90_000));
    expect(
      (
        await api.patch(`/transactions/${payment.id}`, {
          amount: tl(100_000),
          reason: 'Tam ödeme',
          expectedUpdatedAt: payment.updatedAt,
        })
      ).status,
    ).toBe(200);
    const current = await api.transaction(payment.id);
    const over = await api.patch(`/transactions/${payment.id}`, {
      amount: tl(101_000),
      reason: 'Fazla',
      expectedUpdatedAt: current.updatedAt,
    });
    expect(over.status).toBe(409);
    expect(over.body.details.excess).toBe(tl(1_000));
  });
});

describe('güvenli tekrar', () => {
  it('aynı anahtar ve gövde ikinci hareket açmaz; aynı anlaşma kalanı bir kez düşer', async () => {
    const { api, agreement } = await setup();
    const key = randomUUID();
    const body = {
      kind: 'expense',
      amount: tl(10_000),
      date: '2026-03-10',
      partyId: agreement.partyId,
      allocations: [
        {
          scope: 'project',
          projectId: agreement.projectId,
          agreementId: agreement.id,
          amount: tl(10_000),
        },
      ],
    };
    const [a, b] = await Promise.all([
      api.post('/transactions', body, key),
      api.post('/transactions', body, key),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.data.id).toBe(b.body.data.id);
    expect(await TransactionModel.collection.countDocuments()).toBe(1);
    expect((await api.agreement(agreement.id)).remaining).toBe(tl(90_000));

    const status = await api.ok(api.get(`/idempotency/${key}`));
    expect(status).toEqual({
      status: 'done',
      resultRef: { type: 'transaction', id: a.body.data.id },
    });
    expect(await api.ok(api.get(`/idempotency/${randomUUID()}`))).toEqual({ status: 'not_found' });
  });

  it('para hareketi Idempotency-Key olmadan kabul edilmez', async () => {
    const { api, project } = await setup();
    const res = await api.post(
      '/transactions',
      {
        kind: 'expense',
        amount: 100,
        date: '2026-03-10',
        allocations: [{ scope: 'project', projectId: project.id, amount: 100 }],
      },
      null,
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Idempotency-Key başlığı gerekli.');
  });
});

describe('mükerrer uyarısı, kopya ve öneriler', () => {
  it('aynı gün, tutar, kişi ve kapsamda kayıt uyarı verir ama engellenmez', async () => {
    const { api, project, party } = await setup();
    const first = await api.ok(
      api.record({ kind: 'expense', amount: tl(2_500), project, party }),
      201,
    );
    expect(first.warnings).toEqual([]);
    const second = await api.ok(
      api.record({ kind: 'expense', amount: tl(2_500), project, party }),
      201,
    );
    expect(second.warnings).toEqual([
      expect.objectContaining({
        code: 'POSSIBLE_DUPLICATE',
        related: [{ id: first.id, recordNo: first.recordNo }],
      }),
    ]);
  });

  it('kopya taslak döner, kayıt açmaz; tarih bugün, anlaşma bağlantısı onay ister', async () => {
    const { testApp, api, agreement } = await setup();
    const payment = await api.pay(agreement, tl(10_000), { description: 'Hakediş' });
    const draft = await api.ok(api.post(`/transactions/${payment.id}/duplicate`, {}, null));
    const { businessToday } = await import('../src/lib/clock.js');
    expect(draft).toMatchObject({
      kind: 'expense',
      amount: tl(10_000),
      date: businessToday(testApp.clock),
      description: 'Hakediş',
      agreementConfirmationRequired: true,
      allocations: [{ agreementId: agreement.id }],
    });
    expect(await TransactionModel.collection.countDocuments()).toBe(1);
  });

  it('son açıklama önerileri tekrarsız ve yeniden eskiye', async () => {
    const { api, project } = await setup();
    for (const description of ['Demir', 'Beton', 'Demir']) {
      await api.ok(
        api.record({ kind: 'expense', amount: tl(1), project, extra: { description } }),
        201,
      );
    }
    expect(await api.ok(api.get('/transactions/suggestions', { kind: 'expense' }))).toEqual([
      'Demir',
      'Beton',
    ]);
  });
});

describe('liste, filtreler ve toplamlar', () => {
  it('filtreler birlikte çalışır; toplam bütün sonuçları kapsar, silinenler toplama girmez', async () => {
    const { api, project, party } = await setup();
    for (let index = 0; index < 3; index += 1) {
      await api.ok(
        api.record({
          kind: 'expense',
          amount: tl(1_000),
          project,
          party,
          date: `2026-05-0${index + 1}`,
        }),
        201,
      );
    }
    const deleted = await api.ok(
      api.record({ kind: 'expense', amount: tl(7_000), project, date: '2026-05-04' }),
      201,
    );
    await api.ok(
      api.delete(`/transactions/${deleted.id}`, {
        reason: 'Yanlış',
        expectedUpdatedAt: deleted.updatedAt,
      }),
    );
    await api.ok(
      api.record({ kind: 'income', amount: tl(5_000), project, date: '2026-05-02' }),
      201,
    );

    const page = await api.ok(
      api.get('/transactions', { kind: 'expense', limit: 2, sort: 'oldest' }),
    );
    expect(page).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.totals.netExpense).toBe(tl(3_000));

    const withDeleted = await api.ok(
      api.get('/transactions', { includeDeleted: 'true', kind: 'expense' }),
    );
    expect(withDeleted.total).toBe(4);
    expect(withDeleted.totals.netExpense).toBe(tl(3_000));

    const ranged = await api.ok(
      api.get('/transactions', { dateFrom: '2026-05-02', dateTo: '2026-05-02' }),
    );
    expect(ranged.totals).toMatchObject({
      netIncome: tl(5_000),
      netExpense: tl(1_000),
      difference: tl(4_000),
    });
    expect((await api.ok(api.get('/transactions', { noParty: 'true' }))).total).toBe(1);
    expect((await api.ok(api.get('/transactions', { amountMin: tl(2_000) }))).total).toBe(1);
  });

  it('arama Türkçe harf farkından etkilenmez; kişi, şantiye, kayıt no ve tutarla bulur', async () => {
    const { api, project, party } = await setup();
    const t = await api.ok(
      api.record({
        kind: 'expense',
        amount: tl(12_500),
        project,
        party,
        extra: { description: 'Çimento ve kum' },
      }),
      201,
    );
    const search = async (q: string) =>
      (await api.ok(api.get('/transactions', { q }))).items.map((item: { id: string }) => item.id);

    expect(await search('CIMENTO')).toEqual([t.id]);
    expect(await search('yilmaz')).toEqual([t.id]);
    expect(await search('kadikoy')).toEqual([t.id]);
    expect(await search(String(t.recordNo))).toContain(t.id);
    expect(await search('12.500')).toEqual([t.id]);
    expect(await search('yok böyle')).toEqual([]);
  });
});
