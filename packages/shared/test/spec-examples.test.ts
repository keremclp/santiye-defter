// Şartname bölüm 9 ve karar belgesi bölüm 6'daki örnek tutarlar, birebir.

import { describe, expect, it } from 'vitest';
import {
  cashTotalsByMonth,
  computeAgreementBalance,
  computeCashTotals,
  dueStateOf,
  overdueAmountOf,
  summarizeAgreements,
  validateRefund,
} from '../src/index.js';
import { Ledger, tl } from './helpers/ledger.js';

const A = 'proje-a';
const B = 'proje-b';

describe('9.2 Anlaşma: 120.000 TL anlaşma, 45.000 TL ödeme', () => {
  function setup() {
    const ledger = new Ledger();
    ledger.add('expense', '2026-03-10', [
      { scope: 'project', projectId: A, agreementId: 'elektrik', amount: tl(45_000) },
    ]);
    return ledger;
  }

  it('gider 45.000, kalan 75.000; anlaşma bedeli gider toplamına eklenmez', () => {
    const ledger = setup();

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(45_000));
    expect(ledger.balance('elektrik', tl(120_000))).toEqual({
      netSettled: tl(45_000),
      remaining: tl(75_000),
      excess: 0,
      paymentStatus: 'partial',
    });
  });

  it('anlaşma oluşturmak tek başına hareket yazmaz: ödeme yokken gider 0, kalan 120.000', () => {
    const ledger = new Ledger();

    expect(computeCashTotals(ledger.active()).netExpense).toBe(0);
    expect(ledger.balance('elektrik', tl(120_000))).toMatchObject({
      remaining: tl(120_000),
      paymentStatus: 'open',
    });
  });

  it('bedel artışı: 20.000 TL ek iş → bedel 140.000, gider değişmez, kalan 95.000', () => {
    const ledger = setup();

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(45_000));
    expect(ledger.balance('elektrik', tl(140_000)).remaining).toBe(tl(95_000));
  });

  it('ek iş sonrası 95.000 TL son ödeme → gider 140.000, kalan 0 (senaryo 1)', () => {
    const ledger = setup();
    ledger.add('expense', '2026-05-02', [
      { scope: 'project', projectId: A, agreementId: 'elektrik', amount: tl(95_000) },
    ]);

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(140_000));
    expect(ledger.balance('elektrik', tl(140_000))).toMatchObject({
      remaining: 0,
      excess: 0,
      paymentStatus: 'settled',
    });
  });

  it('bedel düşüşü: 45.000 ödenmişken bedel 40.000 → gider 45.000, kalan 0, fazla 5.000', () => {
    const ledger = setup();

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(45_000));
    expect(ledger.balance('elektrik', tl(40_000))).toEqual({
      netSettled: tl(45_000),
      remaining: 0,
      excess: tl(5_000),
      paymentStatus: 'overpaid',
    });
  });

  it('iptal: kesin bedel 30.000 → kalan 0, fazla 15.000; 15.000 iade sonrası net 30.000', () => {
    const ledger = setup();
    const payment = ledger.active()[0]!;

    expect(ledger.balance('elektrik', tl(30_000))).toMatchObject({
      remaining: 0,
      excess: tl(15_000),
    });

    ledger.refund(payment.id, '2026-06-01', [
      { allocationId: payment.allocations[0]!.id, amount: tl(15_000) },
    ]);

    expect(ledger.balance('elektrik', tl(30_000))).toEqual({
      netSettled: tl(30_000),
      remaining: 0,
      excess: 0,
      paymentStatus: 'settled',
    });
    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(30_000));
    expect(payment.amount).toBe(tl(45_000));
  });

  it('iş durumu ödeme durumundan ayrıdır: işi tamamlamak borcu sıfırlamaz', () => {
    // Ödeme durumu yalnız bedel ve hareketlerden hesaplanır; iş durumu girdi değildir.
    expect(
      computeAgreementBalance(tl(120_000), [{ amount: tl(45_000), refundedAmount: 0 }]),
    ).toMatchObject({ remaining: tl(75_000), paymentStatus: 'partial' });
  });
});

describe('9.2 Başlangıç kaydı: 75.000 borç, 25.000 ödeme', () => {
  it('yeni gider 25.000, kalan 50.000; başlangıç tutarı gider sayılmaz', () => {
    const ledger = new Ledger();

    expect(computeCashTotals(ledger.active()).netExpense).toBe(0);
    expect(ledger.balance('baslangic', tl(75_000)).remaining).toBe(tl(75_000));

    ledger.add('expense', '2026-04-01', [
      { scope: 'company', agreementId: 'baslangic', amount: tl(25_000) },
    ]);

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(25_000));
    expect(ledger.balance('baslangic', tl(75_000)).remaining).toBe(tl(50_000));
  });
});

describe('9.2 Doğrudan hareket ve ayrı şantiyeler', () => {
  it('anlaşmaya bağlanmayan ödeme anlaşmanın kalanını azaltmaz', () => {
    const ledger = new Ledger();
    ledger.add('expense', '2026-03-10', [{ scope: 'project', projectId: A, amount: tl(10_000) }]);

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(10_000));
    expect(ledger.balance('elektrik', tl(120_000)).remaining).toBe(tl(120_000));
  });

  it('bir şantiyeye bağlanan ödeme diğer şantiyenin bakiyesini değiştirmez; fazla ödeme başka borcu kapatmaz', () => {
    const ledger = new Ledger();
    ledger.add('expense', '2026-03-10', [
      { scope: 'project', projectId: A, agreementId: 'a-isi', amount: tl(130_000) },
    ]);

    expect(ledger.balance('a-isi', tl(120_000))).toMatchObject({
      remaining: 0,
      excess: tl(10_000),
    });
    expect(ledger.balance('b-isi', tl(80_000)).remaining).toBe(tl(80_000));
  });
});

describe('9.2 Paylaştırma: 40.000 TL ödeme, A 25.000 + B 15.000', () => {
  function setup() {
    const ledger = new Ledger();
    ledger.add('expense', '2026-02-01', [
      { scope: 'project', projectId: A, agreementId: 'a-isi', amount: tl(45_000) },
    ]);
    ledger.add('expense', '2026-02-01', [
      { scope: 'project', projectId: B, agreementId: 'b-isi', amount: tl(20_000) },
    ]);
    return ledger;
  }

  it('A 75.000 → 50.000, B 60.000 → 45.000', () => {
    const ledger = setup();
    expect(ledger.balance('a-isi', tl(120_000)).remaining).toBe(tl(75_000));
    expect(ledger.balance('b-isi', tl(80_000)).remaining).toBe(tl(60_000));

    ledger.add('expense', '2026-03-01', [
      { scope: 'project', projectId: A, agreementId: 'a-isi', amount: tl(25_000) },
      { scope: 'project', projectId: B, agreementId: 'b-isi', amount: tl(15_000) },
    ]);

    expect(ledger.balance('a-isi', tl(120_000)).remaining).toBe(tl(50_000));
    expect(ledger.balance('b-isi', tl(80_000)).remaining).toBe(tl(45_000));
  });

  it('firma giderinde 40.000 bir kez; şantiye toplamları paylardan', () => {
    const ledger = new Ledger();
    ledger.add('expense', '2026-03-01', [
      { scope: 'project', projectId: A, agreementId: 'a-isi', amount: tl(25_000) },
      { scope: 'project', projectId: B, agreementId: 'b-isi', amount: tl(15_000) },
    ]);

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(40_000));
    expect(
      computeCashTotals(ledger.active(), { target: { scope: 'project', projectId: A } }).netExpense,
    ).toBe(tl(25_000));
    expect(
      computeCashTotals(ledger.active(), { target: { scope: 'project', projectId: B } }).netExpense,
    ).toBe(tl(15_000));
  });
});

describe('9.4 İade sınırı: 45.000 ödemenin 5.000’i iade edilmiş', () => {
  function setup() {
    const ledger = new Ledger();
    const payment = ledger.add('expense', '2026-03-10', [
      { scope: 'project', projectId: A, agreementId: 'elektrik', amount: tl(45_000) },
    ]);
    const allocationId = payment.allocations[0]!.id;
    ledger.refund(payment.id, '2026-03-20', [{ allocationId, amount: tl(5_000) }]);
    return { ledger, payment, allocationId };
  }

  it('en fazla 40.000 daha iade edilebilir', () => {
    const { ledger, payment, allocationId } = setup();
    const source = { kind: payment.kind, allocations: ledger.refundableAllocations(payment) };

    expect(
      validateRefund(source, { amount: tl(40_000), parts: [{ allocationId, amount: tl(40_000) }] }),
    ).toEqual([]);
    expect(
      validateRefund(source, {
        amount: tl(40_000) + 1,
        parts: [{ allocationId, amount: tl(40_000) + 1 }],
      }),
    ).toEqual([
      {
        code: 'REFUND_LIMIT_EXCEEDED',
        message: 'Bu kayıttan en fazla 40.000 TL iade edilebilir.',
        path: ['amount'],
      },
    ]);
  });

  it('5.000 iade sonrası net ödenen 40.000, kalan 80.000 (senaryo 4)', () => {
    const { ledger } = setup();

    expect(ledger.balance('elektrik', tl(120_000))).toMatchObject({
      netSettled: tl(40_000),
      remaining: tl(80_000),
    });
    expect(computeCashTotals(ledger.active())).toMatchObject({
      expense: tl(45_000),
      expenseRefund: tl(5_000),
      netExpense: tl(40_000),
    });
  });

  it('ana tutar bağlı iade toplamının altına indirilemez', () => {
    const { ledger, payment, allocationId } = setup();

    expect(() =>
      ledger.correct(payment.id, [
        {
          id: allocationId,
          scope: 'project',
          projectId: A,
          agreementId: 'elektrik',
          amount: tl(4_000),
        },
      ]),
    ).toThrow('Pay tutarı bağlı iadelerin toplamının (5.000 TL) altına indirilemez.');
  });
});

describe('9.1 Dönem: ocakta 40.000 ödeme, şubatta 10.000 iade', () => {
  function setup() {
    const ledger = new Ledger();
    const payment = ledger.add('expense', '2026-01-15', [{ scope: 'company', amount: tl(40_000) }]);
    ledger.refund(payment.id, '2026-02-10', [
      { allocationId: payment.allocations[0]!.id, amount: tl(10_000) },
    ]);
    return ledger;
  }

  it('ocak 40.000, şubat −10.000, toplam 30.000', () => {
    const ledger = setup();

    expect(
      computeCashTotals(ledger.active(), { from: '2026-01-01', to: '2026-01-31' }).netExpense,
    ).toBe(tl(40_000));
    expect(
      computeCashTotals(ledger.active(), { from: '2026-02-01', to: '2026-02-28' }).netExpense,
    ).toBe(-tl(10_000));
    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(30_000));
  });

  it('aylık dökümde iade kendi ayına yazılır', () => {
    const months = cashTotalsByMonth(setup().active());

    expect(months.map(({ month, totals }) => [month, totals.netExpense])).toEqual([
      ['2026-01', tl(40_000)],
      ['2026-02', -tl(10_000)],
    ]);
  });
});

describe('9.3 Vade ve gecikme (senaryo 2: 800.000 TL tahsil edilecek anlaşma)', () => {
  const dueDate = '2026-06-30';

  it('vade öncesi 300.000 tahsilat: kalan 500.000, gecikmiş 0', () => {
    const balance = computeAgreementBalance(tl(800_000), [
      { amount: tl(300_000), refundedAmount: 0 },
    ]);

    expect(balance.remaining).toBe(tl(500_000));
    expect(overdueAmountOf({ dueDate, remaining: balance.remaining }, '2026-06-30')).toBe(0);
  });

  it('vade günü geçince kalanın tamamı gecikmiş: 500.000', () => {
    expect(dueStateOf({ dueDate, remaining: tl(500_000) }, '2026-07-01')).toBe('overdue');
    expect(overdueAmountOf({ dueDate, remaining: tl(500_000) }, '2026-07-01')).toBe(tl(500_000));
  });

  it('vade sonrası 200.000 kısmi tahsilat gecikmiş tutarı 300.000’e indirir, vadeyi ertelemez', () => {
    const balance = computeAgreementBalance(tl(800_000), [
      { amount: tl(300_000), refundedAmount: 0 },
      { amount: tl(200_000), refundedAmount: 0 },
    ]);

    expect(balance.remaining).toBe(tl(300_000));
    expect(dueStateOf({ dueDate, remaining: balance.remaining }, '2026-07-15')).toBe('overdue');
    expect(overdueAmountOf({ dueDate, remaining: balance.remaining }, '2026-07-15')).toBe(
      tl(300_000),
    );
  });

  it('vadesiz kayıt gecikmiş sayılmaz', () => {
    expect(dueStateOf({ dueDate: null, remaining: tl(500_000) }, '2030-01-01')).toBe('none');
    expect(overdueAmountOf({ dueDate: null, remaining: tl(500_000) }, '2030-01-01')).toBe(0);
  });

  it('gecikme bedeli artırmaz: kalan, gecikmeden bağımsız aynı kalır', () => {
    const balance = computeAgreementBalance(tl(800_000), [
      { amount: tl(300_000), refundedAmount: 0 },
    ]);
    expect(balance.remaining).toBe(tl(500_000));
  });
});

describe('Karar belgesi 6.3: aynı taşeronla iki şantiye', () => {
  it('firma geneli borç 200.000 / 65.000 / 135.000; alacak ayrı kalır, mahsup edilmez', () => {
    const a = computeAgreementBalance(tl(120_000), [{ amount: tl(45_000), refundedAmount: 0 }]);
    const b = computeAgreementBalance(tl(80_000), [{ amount: tl(20_000), refundedAmount: 0 }]);
    const receivable = computeAgreementBalance(tl(20_000), []);

    const summary = summarizeAgreements(
      [
        { direction: 'payable', currentAmount: tl(120_000), ...a },
        { direction: 'payable', currentAmount: tl(80_000), ...b },
        { direction: 'receivable', currentAmount: tl(20_000), ...receivable },
      ],
      '2026-10-12',
    );

    expect(summary.payable).toEqual({
      totalAmount: tl(200_000),
      netSettled: tl(65_000),
      remaining: tl(135_000),
      excess: 0,
      overdue: 0,
    });
    expect(summary.receivable.remaining).toBe(tl(20_000));
  });
});

describe('Karar belgesi 6.4: yanlış kayıt, düzeltme, silme, geri yükleme', () => {
  it('45.000 → 40.000 düzeltme kalan 80.000; silme 120.000; geri yükleme 80.000', () => {
    const ledger = new Ledger();
    const payment = ledger.add('expense', '2026-03-10', [
      { scope: 'project', projectId: A, agreementId: 'elektrik', amount: tl(45_000) },
    ]);
    const allocationId = payment.allocations[0]!.id;
    const remaining = () => ledger.balance('elektrik', tl(120_000)).remaining;
    const expense = () => computeCashTotals(ledger.active()).netExpense;

    expect([expense(), remaining()]).toEqual([tl(45_000), tl(75_000)]);

    ledger.correct(payment.id, [
      {
        id: allocationId,
        scope: 'project',
        projectId: A,
        agreementId: 'elektrik',
        amount: tl(40_000),
      },
    ]);
    expect([expense(), remaining()]).toEqual([tl(40_000), tl(80_000)]);

    payment.deleted = true;
    expect([expense(), remaining()]).toEqual([0, tl(120_000)]);

    payment.deleted = false;
    expect([expense(), remaining()]).toEqual([tl(40_000), tl(80_000)]);
  });

  it('yanlış şantiye düzeltmesinde tutar değişmezse firma toplamı değişmez', () => {
    const ledger = new Ledger();
    const payment = ledger.add('expense', '2026-03-10', [
      { scope: 'project', projectId: A, amount: tl(10_000) },
    ]);
    const projectExpense = (projectId: string) =>
      computeCashTotals(ledger.active(), { target: { scope: 'project', projectId } }).netExpense;

    ledger.correct(payment.id, [{ scope: 'project', projectId: B, amount: tl(10_000) }]);

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(10_000));
    expect([projectExpense(A), projectExpense(B)]).toEqual([0, tl(10_000)]);
  });
});

describe('Karar belgesi 6.6: genel firma giderleri', () => {
  it('A 100.000 + B 60.000 + firma geneli 25.000 = 185.000; kira borcuna 10.000 ödeme → 195.000, kalan 20.000', () => {
    const ledger = new Ledger();
    ledger.add('expense', '2026-03-01', [{ scope: 'project', projectId: A, amount: tl(100_000) }]);
    ledger.add('expense', '2026-03-01', [{ scope: 'project', projectId: B, amount: tl(60_000) }]);
    ledger.add('expense', '2026-03-01', [{ scope: 'company', amount: tl(25_000) }]);

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(185_000));
    expect(
      computeCashTotals(ledger.active(), { target: { scope: 'project', projectId: A } }).netExpense,
    ).toBe(tl(100_000));
    expect(ledger.balance('kira', tl(30_000)).remaining).toBe(tl(30_000));

    ledger.add('expense', '2026-04-01', [
      { scope: 'company', agreementId: 'kira', amount: tl(10_000) },
    ]);

    expect(computeCashTotals(ledger.active()).netExpense).toBe(tl(195_000));
    expect(computeCashTotals(ledger.active(), { target: { scope: 'company' } }).netExpense).toBe(
      tl(35_000),
    );
    expect(ledger.balance('kira', tl(30_000)).remaining).toBe(tl(20_000));
  });
});

describe('Kabul 5: tahsil edilecek anlaşmada aynı ilke ters yönde', () => {
  it('120.000 TL alacak anlaşmasına 45.000 TL tahsilat → gelir 45.000, kalan alacak 75.000; tahsilat iadesi neti düşürür', () => {
    const ledger = new Ledger();
    const income = ledger.add('income', '2026-03-10', [
      { scope: 'project', projectId: A, agreementId: 'villa', amount: tl(45_000) },
    ]);

    expect(computeCashTotals(ledger.active())).toMatchObject({
      netIncome: tl(45_000),
      netExpense: 0,
    });
    expect(ledger.balance('villa', tl(120_000)).remaining).toBe(tl(75_000));

    ledger.refund(income.id, '2026-04-01', [
      { allocationId: income.allocations[0]!.id, amount: tl(5_000) },
    ]);

    expect(computeCashTotals(ledger.active()).netIncome).toBe(tl(40_000));
    expect(ledger.balance('villa', tl(120_000)).remaining).toBe(tl(80_000));
  });
});
