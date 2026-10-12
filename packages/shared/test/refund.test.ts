import { describe, expect, it } from 'vitest';
import {
  refundAllocationsFor,
  refundableAmountOf,
  refundKindOf,
  totalRefundableOf,
  validateAllocationChangesAgainstRefunds,
  validateRefund,
  type RefundableAllocation,
} from '../src/index.js';

const tl = (lira: number) => lira * 100;

const simple: RefundableAllocation[] = [
  {
    id: 'p1',
    scope: 'project',
    projectId: 'A',
    agreementId: 'elektrik',
    amount: tl(45_000),
    refundedAmount: tl(35_000),
  },
];

const split: RefundableAllocation[] = [
  {
    id: 'pa',
    scope: 'project',
    projectId: 'A',
    agreementId: 'a-isi',
    amount: tl(25_000),
    refundedAmount: tl(5_000),
  },
  {
    id: 'pb',
    scope: 'project',
    projectId: 'B',
    agreementId: 'b-isi',
    amount: tl(15_000),
    refundedAmount: 0,
  },
];

describe('iade edilebilir tutar', () => {
  it('pay − aktif iadeler', () => {
    expect(refundableAmountOf(simple[0]!)).toBe(tl(10_000));
    expect(totalRefundableOf(split)).toBe(tl(35_000));
  });

  it('iade türü kaynağın yönünü izler', () => {
    expect(refundKindOf('expense')).toBe('expense_refund');
    expect(refundKindOf('income')).toBe('income_refund');
  });
});

describe('validateRefund', () => {
  it('sınırın tamamı iade edilebilir', () => {
    expect(
      validateRefund(
        { kind: 'expense', allocations: simple },
        { amount: tl(10_000), parts: [{ allocationId: 'p1', amount: tl(10_000) }] },
      ),
    ).toEqual([]);
  });

  it('şartname 7.5 mesajı: "Bu kayıttan en fazla 10.000 TL iade edilebilir."', () => {
    expect(
      validateRefund(
        { kind: 'expense', allocations: simple },
        { amount: tl(10_000) + 1, parts: [{ allocationId: 'p1', amount: tl(10_000) + 1 }] },
      ),
    ).toEqual([
      {
        code: 'REFUND_LIMIT_EXCEEDED',
        message: 'Bu kayıttan en fazla 10.000 TL iade edilebilir.',
        path: ['amount'],
      },
    ]);
  });

  it('tamamı iade edilmiş kayda yeni iade eklenemez', () => {
    expect(
      validateRefund(
        { kind: 'income', allocations: [{ ...simple[0]!, refundedAmount: tl(45_000) }] },
        { amount: 1, parts: [{ allocationId: 'p1', amount: 1 }] },
      ).map((issue) => issue.message),
    ).toEqual(['Bu kaydın tamamı iade edildi; yeni iade eklenemez.']);
  });

  it('paylaştırılmış kaynakta pay bazında sınır: toplam uygun olsa da pay sınırı aşılamaz', () => {
    expect(
      validateRefund(
        { kind: 'expense', allocations: split },
        { amount: tl(25_000), parts: [{ allocationId: 'pa', amount: tl(25_000) }] },
      ),
    ).toEqual([
      {
        code: 'REFUND_LIMIT_EXCEEDED',
        message: 'Bu paydan en fazla 20.000 TL iade edilebilir.',
        path: ['parts', 0, 'amount'],
      },
    ]);
  });

  it('aynı paya birden fazla satır toplanarak denetlenir', () => {
    expect(
      validateRefund(
        { kind: 'expense', allocations: split },
        {
          amount: tl(16_000),
          parts: [
            { allocationId: 'pb', amount: tl(8_000) },
            { allocationId: 'pb', amount: tl(8_000) },
          ],
        },
      ).map((issue) => issue.message),
    ).toEqual(['Bu paydan en fazla 15.000 TL iade edilebilir.']);
  });

  it('iki paydan birlikte iade geçerli', () => {
    expect(
      validateRefund(
        { kind: 'expense', allocations: split },
        {
          amount: tl(35_000),
          parts: [
            { allocationId: 'pa', amount: tl(20_000) },
            { allocationId: 'pb', amount: tl(15_000) },
          ],
        },
      ),
    ).toEqual([]);
  });

  it('pay toplamı iade tutarına eşit olmalı', () => {
    expect(
      validateRefund(
        { kind: 'expense', allocations: split },
        { amount: tl(10_000), parts: [{ allocationId: 'pb', amount: tl(9_000) }] },
      ).map((issue) => issue.message),
    ).toEqual(['İade paylarının toplamı 10.000 TL olmalı.']);
  });

  it('iadenin iadesi yapılamaz; bilinmeyen pay ve geçersiz tutar reddedilir', () => {
    expect(
      validateRefund(
        { kind: 'expense_refund', allocations: simple },
        { amount: 1, parts: [{ allocationId: 'p1', amount: 1 }] },
      ).map((issue) => issue.code),
    ).toEqual(['REFUND_SOURCE_INVALID']);
    expect(
      validateRefund(
        { kind: 'expense', allocations: simple },
        { amount: 1, parts: [{ allocationId: 'yok', amount: 1 }] },
      ).map((issue) => issue.code),
    ).toEqual(['REFUND_ALLOCATION_NOT_FOUND']);
    expect(
      validateRefund({ kind: 'expense', allocations: simple }, { amount: 0, parts: [] }).map(
        (issue) => issue.code,
      ),
    ).toEqual(['AMOUNT_INVALID']);
    expect(
      validateRefund({ kind: 'expense', allocations: simple }, { amount: 1, parts: [] }).map(
        (issue) => issue.code,
      ),
    ).toEqual(['REFUND_PART_REQUIRED']);
  });
});

describe('refundAllocationsFor', () => {
  it('iade payları kaynak payların kapsamını ve anlaşmasını taşır; aynı pay birleşir', () => {
    expect(
      refundAllocationsFor(split, [
        { allocationId: 'pa', amount: tl(3_000) },
        { allocationId: 'pb', amount: tl(1_000) },
        { allocationId: 'pa', amount: tl(2_000) },
      ]),
    ).toEqual([
      { scope: 'project', projectId: 'A', agreementId: 'a-isi', amount: tl(5_000) },
      { scope: 'project', projectId: 'B', agreementId: 'b-isi', amount: tl(1_000) },
    ]);
  });
});

describe('validateAllocationChangesAgainstRefunds', () => {
  const current = split;
  const unchanged = current.map(({ refundedAmount: _refunded, ...allocation }) => allocation);

  it('iadesi olmayan pay serbestçe değişir veya kaldırılır', () => {
    expect(validateAllocationChangesAgainstRefunds(current, [unchanged[0]!])).toEqual([]);
    expect(
      validateAllocationChangesAgainstRefunds(current, [
        unchanged[0]!,
        { ...unchanged[1]!, projectId: 'C', agreementId: null },
      ]),
    ).toEqual([]);
  });

  it('iadeli pay, iade toplamına kadar düşürülebilir', () => {
    expect(
      validateAllocationChangesAgainstRefunds(current, [
        { ...unchanged[0]!, amount: tl(5_000) },
        unchanged[1]!,
      ]),
    ).toEqual([]);
  });

  it('iadeli pay iade toplamının altına inemez', () => {
    expect(
      validateAllocationChangesAgainstRefunds(current, [
        { ...unchanged[0]!, amount: tl(5_000) - 1 },
        unchanged[1]!,
      ]),
    ).toEqual([
      {
        code: 'ALLOCATION_BELOW_REFUNDS',
        message: 'Pay tutarı bağlı iadelerin toplamının (5.000 TL) altına indirilemez.',
        path: ['allocations', 0, 'amount'],
      },
    ]);
  });

  it('iadeli pay kaldırılamaz ve hedefi değiştirilemez', () => {
    expect(
      validateAllocationChangesAgainstRefunds(current, [unchanged[1]!]).map((issue) => issue.code),
    ).toEqual(['REFUNDED_ALLOCATION_REMOVED']);
    expect(
      validateAllocationChangesAgainstRefunds(current, [
        { ...unchanged[0]!, projectId: 'B', agreementId: 'b-isi' },
        unchanged[1]!,
      ]).map((issue) => issue.message),
    ).toEqual(['Bağlı iadesi olan payın şantiyesi veya anlaşması değiştirilemez.']);
  });
});
