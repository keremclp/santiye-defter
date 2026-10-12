import { describe, expect, it } from 'vitest';
import {
  computeAgreementBalance,
  computeNetSettled,
  dueStateOf,
  overdueDaysOf,
  paymentStatusOf,
  summarizeAgreements,
} from '../src/index.js';

const tl = (lira: number) => lira * 100;
const paid = (amount: number, refundedAmount = 0) => ({ amount, refundedAmount });

describe('computeAgreementBalance', () => {
  it('hiç ödeme yokken kalan bedelin tamamı, durum open', () => {
    expect(computeAgreementBalance(tl(120_000), [])).toEqual({
      netSettled: 0,
      remaining: tl(120_000),
      excess: 0,
      paymentStatus: 'open',
    });
  });

  it('kalanın tam ödenmesi: kalan 0, fazla 0, settled', () => {
    expect(computeAgreementBalance(tl(75_000), [paid(tl(75_000))])).toMatchObject({
      remaining: 0,
      excess: 0,
      paymentStatus: 'settled',
    });
  });

  it('1 kuruş eksik ödeme partial, kalan 1 kuruş', () => {
    expect(computeAgreementBalance(tl(75_000), [paid(tl(75_000) - 1)])).toMatchObject({
      remaining: 1,
      excess: 0,
      paymentStatus: 'partial',
    });
  });

  it('1 kuruş fazla ödeme overpaid, fazla 1 kuruş', () => {
    expect(computeAgreementBalance(tl(75_000), [paid(tl(75_000) + 1)])).toMatchObject({
      remaining: 0,
      excess: 1,
      paymentStatus: 'overpaid',
    });
  });

  it('bedel 0 ve ödeme yok: settled (iptal, kesin bedel 0)', () => {
    expect(computeAgreementBalance(0, [])).toEqual({
      netSettled: 0,
      remaining: 0,
      excess: 0,
      paymentStatus: 'settled',
    });
  });

  it('bedel 0 ve ödeme var: ödenenin tamamı fazla', () => {
    expect(computeAgreementBalance(0, [paid(tl(45_000))])).toMatchObject({
      remaining: 0,
      excess: tl(45_000),
      paymentStatus: 'overpaid',
    });
  });

  it('ödemelerin tamamı iade edildiyse net 0, durum open', () => {
    expect(computeAgreementBalance(tl(120_000), [paid(tl(45_000), tl(45_000))])).toEqual({
      netSettled: 0,
      remaining: tl(120_000),
      excess: 0,
      paymentStatus: 'open',
    });
  });

  it('tahsil edilecek anlaşmada aynı ilke: 120.000 bedel, 45.000 tahsilat → kalan 75.000', () => {
    expect(computeAgreementBalance(tl(120_000), [paid(tl(45_000))]).remaining).toBe(tl(75_000));
  });

  it('geçersiz girdileri reddeder', () => {
    expect(() => computeAgreementBalance(-1, [])).toThrow(RangeError);
    expect(() => computeAgreementBalance(10.5, [])).toThrow(RangeError);
    expect(() => computeNetSettled([paid(100, 101)])).toThrow(RangeError);
    expect(() => computeNetSettled([paid(100, -1)])).toThrow(RangeError);
    expect(() => computeNetSettled([paid(0)])).toThrow(RangeError);
  });
});

describe('paymentStatusOf', () => {
  it('fazla, kalandan önce gelir', () => {
    expect(paymentStatusOf({ netSettled: 10, remaining: 0, excess: 5 })).toBe('overpaid');
    expect(paymentStatusOf({ netSettled: 10, remaining: 0, excess: 0 })).toBe('settled');
    expect(paymentStatusOf({ netSettled: 0, remaining: 10, excess: 0 })).toBe('open');
    expect(paymentStatusOf({ netSettled: 5, remaining: 5, excess: 0 })).toBe('partial');
  });
});

describe('dueStateOf', () => {
  const today = '2026-10-12';
  const open = (dueDate: string | null) => ({ dueDate, remaining: tl(1_000) });

  it.each([
    ['2026-10-11', 'overdue'],
    ['2025-01-01', 'overdue'],
    ['2026-10-12', 'upcoming'],
    ['2026-11-11', 'upcoming'],
    ['2026-11-12', 'later'],
  ])('vade %s → %s (varsayılan 30 gün)', (dueDate, expected) => {
    expect(dueStateOf(open(dueDate), today)).toBe(expected);
  });

  it('pano için 14 günlük pencere', () => {
    expect(dueStateOf(open('2026-10-26'), today, 14)).toBe('upcoming');
    expect(dueStateOf(open('2026-10-27'), today, 14)).toBe('later');
  });

  it('vadesiz açık tutar none', () => {
    expect(dueStateOf(open(null), today)).toBe('none');
    expect(dueStateOf({ dueDate: undefined, remaining: 1 }, today)).toBe('none');
  });

  it('kalan 0 ise vadesi geçmiş olsa da hiçbir grupta değil', () => {
    expect(dueStateOf({ dueDate: '2026-01-01', remaining: 0 }, today)).toBeNull();
  });

  it('1 kuruş kalan bile gecikmiş sayılır', () => {
    expect(dueStateOf({ dueDate: '2026-10-11', remaining: 1 }, today)).toBe('overdue');
  });
});

describe('overdueDaysOf', () => {
  it('vadeden bu yana geçen gün; gelecekteki vade için 0', () => {
    expect(overdueDaysOf('2026-10-01', '2026-10-12')).toBe(11);
    expect(overdueDaysOf('2026-10-12', '2026-10-12')).toBe(0);
    expect(overdueDaysOf('2026-10-20', '2026-10-12')).toBe(0);
  });
});

describe('summarizeAgreements', () => {
  it('gecikmiş borç ve alacak ayrı toplanır; fazla ayrı gösterilir', () => {
    const summary = summarizeAgreements(
      [
        {
          direction: 'payable',
          currentAmount: tl(100),
          netSettled: tl(40),
          remaining: tl(60),
          excess: 0,
          dueDate: '2026-10-01',
        },
        {
          direction: 'payable',
          currentAmount: tl(50),
          netSettled: tl(70),
          remaining: 0,
          excess: tl(20),
          dueDate: '2026-10-01',
        },
        {
          direction: 'receivable',
          currentAmount: tl(200),
          netSettled: 0,
          remaining: tl(200),
          excess: 0,
          dueDate: null,
        },
        {
          direction: 'receivable',
          currentAmount: tl(30),
          netSettled: tl(10),
          remaining: tl(20),
          excess: 0,
          dueDate: '2026-09-30',
        },
      ],
      '2026-10-12',
    );

    expect(summary).toEqual({
      payable: {
        totalAmount: tl(150),
        netSettled: tl(110),
        remaining: tl(60),
        excess: tl(20),
        overdue: tl(60),
      },
      receivable: {
        totalAmount: tl(230),
        netSettled: tl(10),
        remaining: tl(220),
        excess: 0,
        overdue: tl(20),
      },
    });
  });

  it('boş listede sıfırlar', () => {
    expect(summarizeAgreements([], '2026-10-12').payable).toEqual({
      totalAmount: 0,
      netSettled: 0,
      remaining: 0,
      excess: 0,
      overdue: 0,
    });
  });
});
