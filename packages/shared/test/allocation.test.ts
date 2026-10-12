import { describe, expect, it } from 'vitest';
import {
  allocationSumIssue,
  detectExcess,
  excessMessage,
  validateTransactionAllocations,
  type AgreementRef,
} from '../src/index.js';

const tl = (lira: number) => lira * 100;

const agreements = new Map<string, AgreementRef>([
  ['odenecek-a', { direction: 'payable', scope: 'project', projectId: 'A', partyId: 'taseron' }],
  ['odenecek-b', { direction: 'payable', scope: 'project', projectId: 'B', partyId: 'taseron' }],
  ['tahsil-a', { direction: 'receivable', scope: 'project', projectId: 'A', partyId: 'musteri' }],
  ['kira', { direction: 'payable', scope: 'company', partyId: 'ev-sahibi' }],
  ['baslangic', { direction: 'payable', scope: 'company', projectId: null, partyId: 'taseron' }],
]);

describe('allocationSumIssue', () => {
  it('eşitse hata yok', () => {
    expect(
      allocationSumIssue(tl(40_000), [{ amount: tl(25_000) }, { amount: tl(15_000) }]),
    ).toBeNull();
  });

  it('eksik dağıtımda şartnamedeki mesaj', () => {
    expect(allocationSumIssue(tl(40_000), [{ amount: tl(25_000) }, { amount: tl(10_000) }])).toBe(
      'Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı.',
    );
  });

  it('fazla dağıtım ve kuruş farkı', () => {
    expect(allocationSumIssue(tl(40_000), [{ amount: tl(40_000) + 1 }])).toBe(
      'Payların toplamı 40.000 TL olmalı; 0,01 TL fazla dağıtıldı.',
    );
  });
});

describe('validateTransactionAllocations', () => {
  it('basit doğrudan gider geçerli; anlaşma ve kişi gerekmez', () => {
    expect(
      validateTransactionAllocations(
        {
          kind: 'expense',
          amount: tl(10_000),
          allocations: [{ scope: 'company', amount: tl(10_000) }],
        },
        agreements,
      ),
    ).toEqual([]);
  });

  it('paylaştırılmış ödeme iki şantiyedeki anlaşmalara geçerli', () => {
    expect(
      validateTransactionAllocations(
        {
          kind: 'expense',
          amount: tl(40_000),
          partyId: 'taseron',
          allocations: [
            { scope: 'project', projectId: 'A', agreementId: 'odenecek-a', amount: tl(25_000) },
            { scope: 'project', projectId: 'B', agreementId: 'odenecek-b', amount: tl(15_000) },
          ],
        },
        agreements,
      ),
    ).toEqual([]);
  });

  it('başlangıç kaydı da pay hedefi olabilir', () => {
    expect(
      validateTransactionAllocations(
        {
          kind: 'expense',
          amount: tl(25_000),
          partyId: 'taseron',
          allocations: [{ scope: 'company', agreementId: 'baslangic', amount: tl(25_000) }],
        },
        agreements,
      ),
    ).toEqual([]);
  });

  it('pay toplamı tutara eşit değilse hata', () => {
    const issues = validateTransactionAllocations(
      {
        kind: 'expense',
        amount: tl(40_000),
        allocations: [
          { scope: 'project', projectId: 'A', amount: tl(25_000) },
          { scope: 'project', projectId: 'B', amount: tl(10_000) },
        ],
      },
      agreements,
    );
    expect(issues).toEqual([
      {
        code: 'ALLOCATION_SUM_MISMATCH',
        message: 'Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı.',
        path: ['allocations'],
      },
    ]);
  });

  it('gider tahsil edilecek anlaşmaya, gelir ödenecek anlaşmaya bağlanamaz', () => {
    expect(
      validateTransactionAllocations(
        {
          kind: 'expense',
          amount: 100,
          partyId: 'musteri',
          allocations: [{ scope: 'project', projectId: 'A', agreementId: 'tahsil-a', amount: 100 }],
        },
        agreements,
      ).map((issue) => issue.message),
    ).toEqual(['Gider yalnız ödenecek anlaşmaya bağlanabilir.']);

    expect(
      validateTransactionAllocations(
        {
          kind: 'income',
          amount: 100,
          partyId: 'taseron',
          allocations: [
            { scope: 'project', projectId: 'A', agreementId: 'odenecek-a', amount: 100 },
          ],
        },
        agreements,
      ).map((issue) => issue.message),
    ).toEqual(['Gelir yalnız tahsil edilecek anlaşmaya bağlanabilir.']);
  });

  it('pay kapsamı anlaşmanın kapsamıyla aynı olmalı', () => {
    const codes = (allocation: { scope: 'project' | 'company'; projectId?: string }) =>
      validateTransactionAllocations(
        {
          kind: 'expense',
          amount: 100,
          partyId: 'taseron',
          allocations: [{ ...allocation, agreementId: 'odenecek-a', amount: 100 }],
        },
        agreements,
      ).map((issue) => issue.code);

    expect(codes({ scope: 'project', projectId: 'B' })).toEqual(['SCOPE_MISMATCH']);
    expect(codes({ scope: 'company' })).toEqual(['SCOPE_MISMATCH']);
  });

  it('anlaşmaya bağlı payda kişi zorunlu ve anlaşmanın kişisiyle aynı; hata bir kez yazılır', () => {
    const allocations = [
      { scope: 'project' as const, projectId: 'A', agreementId: 'odenecek-a', amount: 50 },
      { scope: 'project' as const, projectId: 'B', agreementId: 'odenecek-b', amount: 50 },
    ];

    expect(
      validateTransactionAllocations({ kind: 'expense', amount: 100, allocations }, agreements),
    ).toEqual([
      {
        code: 'PARTY_REQUIRED',
        message: 'Anlaşmaya bağlı kayıtta kişi/firma seçilmeli.',
        path: ['partyId'],
      },
    ]);
    expect(
      validateTransactionAllocations(
        { kind: 'expense', amount: 100, partyId: 'baska', allocations },
        agreements,
      ).map((issue) => issue.code),
    ).toEqual(['PARTY_MISMATCH']);
  });

  it('bulunamayan anlaşma', () => {
    expect(
      validateTransactionAllocations(
        {
          kind: 'expense',
          amount: 100,
          partyId: 'taseron',
          allocations: [{ scope: 'company', agreementId: 'yok', amount: 100 }],
        },
        agreements,
      ),
    ).toEqual([
      {
        code: 'AGREEMENT_NOT_FOUND',
        message: 'Anlaşma bulunamadı.',
        path: ['allocations', 0, 'agreementId'],
      },
    ]);
  });

  it('kapsam alanları: şantiye kapsamında şantiye zorunlu, firma genelinde şantiye olmaz', () => {
    const messages = validateTransactionAllocations(
      {
        kind: 'expense',
        amount: 200,
        allocations: [
          { scope: 'project', amount: 100 },
          { scope: 'company', projectId: 'A', amount: 100 },
        ],
      },
      agreements,
    ).map((issue) => issue.message);
    expect(messages).toEqual(['Şantiye seçilmeli.', 'Firma geneli kayıtta şantiye seçilemez.']);
  });

  it('sıfır, negatif ve kesirli tutarlar ile boş pay listesi reddedilir', () => {
    expect(
      validateTransactionAllocations(
        { kind: 'expense', amount: 0, allocations: [] },
        agreements,
      ).map((issue) => issue.code),
    ).toEqual(['AMOUNT_INVALID', 'ALLOCATION_REQUIRED']);
    expect(
      validateTransactionAllocations(
        { kind: 'income', amount: 10.5, allocations: [{ scope: 'company', amount: -1 }] },
        agreements,
      ).map((issue) => issue.code),
    ).toEqual(['AMOUNT_INVALID', 'AMOUNT_INVALID']);
  });
});

describe('detectExcess', () => {
  const remaining = new Map([
    ['odenecek-a', tl(75_000)],
    ['odenecek-b', tl(60_000)],
  ]);

  it('kalanı aşan tutarı verir', () => {
    expect(
      detectExcess(
        [{ scope: 'project', projectId: 'A', agreementId: 'odenecek-a', amount: tl(80_000) }],
        remaining,
      ),
    ).toEqual({
      total: tl(5_000),
      byAgreement: [{ agreementId: 'odenecek-a', amount: tl(5_000) }],
    });
  });

  it('kalanın tamamı fazla değildir; 1 kuruş fazlası fazladır', () => {
    const pay = (amount: number) => [
      { scope: 'project' as const, projectId: 'A', agreementId: 'odenecek-a', amount },
    ];
    expect(detectExcess(pay(tl(75_000)), remaining).total).toBe(0);
    expect(detectExcess(pay(tl(75_000) + 1), remaining).total).toBe(1);
  });

  it('aynı anlaşmaya giden paylar birlikte değerlendirilir; anlaşmasız paylar sayılmaz', () => {
    expect(
      detectExcess(
        [
          { scope: 'project', projectId: 'A', agreementId: 'odenecek-a', amount: tl(50_000) },
          { scope: 'project', projectId: 'A', agreementId: 'odenecek-a', amount: tl(30_000) },
          { scope: 'project', projectId: 'B', agreementId: 'odenecek-b', amount: tl(10_000) },
          { scope: 'company', amount: tl(999_000) },
        ],
        remaining,
      ),
    ).toEqual({
      total: tl(5_000),
      byAgreement: [{ agreementId: 'odenecek-a', amount: tl(5_000) }],
    });
  });

  it('kalanı 0 olan anlaşmaya ödemenin tamamı fazladır', () => {
    expect(
      detectExcess(
        [{ scope: 'company', agreementId: 'kira', amount: tl(1_000) }],
        new Map([['kira', 0]]),
      ).total,
    ).toBe(tl(1_000));
  });

  it('kalanı verilmeyen anlaşma programlama hatasıdır', () => {
    expect(() =>
      detectExcess([{ scope: 'company', agreementId: 'kira', amount: 1 }], remaining),
    ).toThrow(RangeError);
  });

  it('şartname 12 mesajı', () => {
    expect(excessMessage('expense', tl(5_000))).toBe(
      'Bu ödeme anlaşmanın kalanını 5.000 TL aşıyor.',
    );
    expect(excessMessage('income', tl(5_000))).toBe(
      'Bu tahsilat anlaşmanın kalanını 5.000 TL aşıyor.',
    );
  });
});
