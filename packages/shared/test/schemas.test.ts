import { describe, expect, it } from 'vitest';
import {
  agreementCreateSchema,
  refundCreateSchema,
  transactionCreateSchema,
} from '../src/index.js';

const id = (char: string) => char.repeat(24);
const tl = (lira: number) => lira * 100;

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

const validTransaction = {
  kind: 'expense',
  amount: tl(40_000),
  date: '2026-10-12',
  partyId: id('a'),
  categoryId: id('c'),
  allocations: [
    { scope: 'project', projectId: id('1'), agreementId: id('d'), amount: tl(25_000) },
    { scope: 'project', projectId: id('2'), amount: tl(15_000) },
  ],
};

describe('transactionCreateSchema', () => {
  it('geçerli gövdeyi kabul eder; açıklama varsayılanı boş', () => {
    const result = transactionCreateSchema.parse(validTransaction);
    expect(result.description).toBe('');
    expect(result.allocations).toHaveLength(2);
  });

  it('açıklamayı kırpar', () => {
    expect(
      transactionCreateSchema.parse({ ...validTransaction, description: '  demir  ' }).description,
    ).toBe('demir');
  });

  it('pay toplamı tutara eşit olmalı', () => {
    const result = transactionCreateSchema.safeParse({ ...validTransaction, amount: tl(45_000) });
    expect(messages(result)).toEqual([
      'Payların toplamı 45.000 TL olmalı; 5.000 TL daha dağıtılmalı.',
    ]);
  });

  it('gider kategorisi yalnız giderde', () => {
    const result = transactionCreateSchema.safeParse({ ...validTransaction, kind: 'income' });
    expect(messages(result)).toEqual(['Gider kategorisi yalnız giderde seçilebilir.']);
  });

  it('fazla ödeme onayı gerekçe ister', () => {
    expect(
      messages(
        transactionCreateSchema.safeParse({
          ...validTransaction,
          confirmExcess: true,
          excessReason: '  ',
        }),
      ),
    ).toEqual(['Fazla ödeme için gerekçe girin.']);
    expect(
      transactionCreateSchema.safeParse({
        ...validTransaction,
        confirmExcess: true,
        excessReason: 'Ek iş',
      }).success,
    ).toBe(true);
  });

  it('tutar 0’dan büyük kuruş tamsayısı olmalı', () => {
    const allocations = [{ scope: 'company', amount: 0 }];
    expect(
      messages(transactionCreateSchema.safeParse({ ...validTransaction, amount: 0, allocations })),
    ).toContain('Tutar 0’dan büyük olmalı.');
    expect(
      messages(
        transactionCreateSchema.safeParse({
          ...validTransaction,
          amount: 12.5,
          allocations: [{ scope: 'company', amount: 12.5 }],
        }),
      ),
    ).toContain('Tutar kuruş cinsinden tamsayı olmalı.');
  });

  it('iade türü bu uçtan oluşturulamaz', () => {
    expect(
      transactionCreateSchema.safeParse({ ...validTransaction, kind: 'expense_refund' }).success,
    ).toBe(false);
  });

  it('kapsam ve kimlik kuralları', () => {
    expect(
      messages(
        transactionCreateSchema.safeParse({
          ...validTransaction,
          amount: 100,
          allocations: [{ scope: 'project', amount: 100 }],
        }),
      ),
    ).toEqual(['Şantiye seçilmeli.']);
    expect(
      messages(
        transactionCreateSchema.safeParse({
          ...validTransaction,
          amount: 100,
          allocations: [{ scope: 'company', projectId: id('1'), amount: 100 }],
        }),
      ),
    ).toEqual(['Firma geneli kayıtta şantiye seçilemez.']);
    expect(
      messages(transactionCreateSchema.safeParse({ ...validTransaction, partyId: '123' })),
    ).toEqual(['Geçersiz kayıt kimliği.']);
  });

  it('geçersiz tarih ve boş pay listesi', () => {
    expect(
      messages(transactionCreateSchema.safeParse({ ...validTransaction, date: '2026-02-30' })),
    ).toEqual(['Tarih YYYY-AA-GG biçiminde geçerli bir gün olmalı.']);
    expect(
      messages(transactionCreateSchema.safeParse({ ...validTransaction, allocations: [] })),
    ).toContain('En az bir pay olmalı.');
  });

  it('hazır Zod mesajları Türkçe', () => {
    const { date: _date, ...withoutDate } = validTransaction;
    const message = messages(transactionCreateSchema.safeParse(withoutDate))[0];
    expect(message).toMatch(/beklenen/i);
  });
});

describe('refundCreateSchema', () => {
  const valid = {
    amount: tl(10_000),
    date: '2026-10-12',
    reason: 'Malzeme iadesi',
    parts: [{ allocationId: id('e'), amount: tl(10_000) }],
  };

  it('geçerli gövde', () => {
    expect(refundCreateSchema.parse(valid)).toEqual(valid);
  });

  it('gerekçe zorunlu', () => {
    expect(messages(refundCreateSchema.safeParse({ ...valid, reason: '   ' }))).toEqual([
      'Gerekçe girin.',
    ]);
  });

  it('pay toplamı iade tutarına eşit olmalı', () => {
    expect(messages(refundCreateSchema.safeParse({ ...valid, amount: tl(12_000) }))).toEqual([
      'İade paylarının toplamı 12.000 TL olmalı.',
    ]);
  });
});

describe('agreementCreateSchema', () => {
  const agreement = {
    kind: 'agreement',
    title: ' Elektrik işi ',
    direction: 'payable',
    scope: 'project',
    projectId: id('1'),
    partyId: id('a'),
    initialAmount: tl(120_000),
    agreementDate: '2026-01-10',
    dueDate: '2026-06-30',
  };

  const opening = {
    kind: 'opening',
    direction: 'payable',
    scope: 'company',
    partyId: id('a'),
    initialAmount: tl(75_000),
    trackingStartDate: '2026-10-12',
  };

  it('anlaşma: adı kırpılır, anlaşma ve vade tarihi isteğe bağlı', () => {
    expect(agreementCreateSchema.parse(agreement)).toMatchObject({
      kind: 'agreement',
      title: 'Elektrik işi',
      description: '',
    });
    const { agreementDate: _a, dueDate: _d, ...minimal } = agreement;
    expect(agreementCreateSchema.safeParse(minimal).success).toBe(true);
  });

  it('anlaşma adı ve kişi zorunlu, bedel pozitif', () => {
    expect(messages(agreementCreateSchema.safeParse({ ...agreement, title: ' ' }))).toEqual([
      'Anlaşma adı girin.',
    ]);
    expect(messages(agreementCreateSchema.safeParse({ ...agreement, initialAmount: 0 }))).toEqual([
      'Tutar 0’dan büyük olmalı.',
    ]);
    const { partyId: _p, ...withoutParty } = agreement;
    expect(agreementCreateSchema.safeParse(withoutParty).success).toBe(false);
  });

  it('başlangıç kaydı: takip başlangıç tarihi zorunlu, ad gerekmez', () => {
    expect(agreementCreateSchema.parse(opening)).toMatchObject({
      kind: 'opening',
      initialAmount: tl(75_000),
    });
    const { trackingStartDate: _t, ...withoutDate } = opening;
    expect(agreementCreateSchema.safeParse(withoutDate).success).toBe(false);
  });

  it('kapsam kuralı her iki türde', () => {
    expect(
      messages(agreementCreateSchema.safeParse({ ...agreement, projectId: undefined })),
    ).toEqual(['Şantiye seçilmeli.']);
    expect(messages(agreementCreateSchema.safeParse({ ...opening, projectId: id('1') }))).toEqual([
      'Firma geneli kayıtta şantiye seçilemez.',
    ]);
  });

  it('bilinmeyen tür reddedilir', () => {
    expect(agreementCreateSchema.safeParse({ ...agreement, kind: 'avans' }).success).toBe(false);
  });
});
