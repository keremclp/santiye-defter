import { describe, expect, it } from 'vitest';
import type { Agreement, Project } from '../../api/types';
import {
  buildCreateBody,
  excessOf,
  needsClosedProjectReason,
  splitSumIssue,
  transactionFormSchema,
  type TransactionFormValues,
} from './transaction-form';

const PROJECT_A = 'a'.repeat(24);
const PROJECT_B = 'b'.repeat(24);
const AGREEMENT_A = 'c'.repeat(24);
const AGREEMENT_B = 'd'.repeat(24);
const PARTY = 'e'.repeat(24);

function values(patch: Partial<TransactionFormValues> = {}): TransactionFormValues {
  return {
    kind: 'expense',
    amount: '',
    date: '2026-10-13',
    scope: 'project',
    projectId: PROJECT_A,
    party: null,
    agreementId: '',
    categoryId: '',
    description: '',
    reason: '',
    split: false,
    allocations: [],
    confirmExcess: false,
    excessReason: '',
    ...patch,
  };
}

const row = (projectId: string, agreementId: string, amount: string) => ({
  key: `${projectId}-${amount}`,
  scope: 'project' as const,
  projectId,
  agreementId,
  amount,
});

// Kalan, `excessOf` içinde paylaşılan fonksiyonla bedel ve netten hesaplanır.
const agreement = (currentAmount: number, netSettled: number) =>
  ({ currentAmount, netSettled, remaining: 0 }) as Pick<
    Agreement,
    'remaining' | 'currentAmount' | 'netSettled'
  >;

describe('gelir/gider formu', () => {
  it('basit kayıt tek pay ve kuruş tutarla gönderilir', () => {
    const body = buildCreateBody(values({ amount: '45.000', description: ' demir ' }), {
      needsReason: false,
    });
    expect(body).toEqual({
      kind: 'expense',
      amount: 4_500_000,
      date: '2026-10-13',
      description: 'demir',
      allocations: [{ scope: 'project', projectId: PROJECT_A, amount: 4_500_000 }],
    });
  });

  it('paylaştırma: pay toplamı eksikse şartnamedeki mesaj', () => {
    const rows = [row(PROJECT_A, '', '25.000'), row(PROJECT_B, '', '10.000')];
    expect(splitSumIssue('40.000', rows)).toBe(
      'Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı.',
    );
    const parsed = transactionFormSchema.safeParse(
      values({ amount: '40.000', split: true, allocations: rows }),
    );
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.message)).toContain(
      'Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı.',
    );
  });

  it('paylaştırma: 40.000 → A 25.000 + B 15.000 kabul edilir ve iki pay gönderilir', () => {
    const form = values({
      amount: '40.000',
      split: true,
      party: { id: PARTY, name: 'Yılmaz Elektrik' },
      allocations: [row(PROJECT_A, AGREEMENT_A, '25.000'), row(PROJECT_B, AGREEMENT_B, '15.000')],
    });
    expect(transactionFormSchema.safeParse(form).success).toBe(true);
    expect(buildCreateBody(form, { needsReason: false }).allocations).toEqual([
      { scope: 'project', projectId: PROJECT_A, agreementId: AGREEMENT_A, amount: 2_500_000 },
      { scope: 'project', projectId: PROJECT_B, agreementId: AGREEMENT_B, amount: 1_500_000 },
    ]);
  });

  it('anlaşmaya bağlı kayıtta kişi zorunlu', () => {
    const parsed = transactionFormSchema.safeParse(
      values({ amount: '10', agreementId: AGREEMENT_A }),
    );
    expect(parsed.error?.issues[0]?.message).toBe('Anlaşmaya bağlı kayıtta kişi/firma seçilmeli.');
  });

  it('120.000 anlaşmaya 45.000 ödeme fazla değil; kalan 75.000 iken 80.000 ödeme 5.000 fazla', () => {
    const map = new Map([[AGREEMENT_A, agreement(12_000_000, 0)]]);
    const pay = (amount: string) =>
      values({ amount, agreementId: AGREEMENT_A, party: { id: PARTY, name: 'X' } });
    expect(excessOf(pay('45.000'), map)).toBe(0);
    const afterFirst = new Map([[AGREEMENT_A, agreement(12_000_000, 4_500_000)]]);
    expect(excessOf(pay('80.000'), afterFirst)).toBe(500_000);
  });

  it('düzeltmede kaydın kendi payı kalandan düşülmez', () => {
    const map = new Map([[AGREEMENT_A, agreement(12_000_000, 4_500_000)]]);
    const own = new Map([[AGREEMENT_A, 4_500_000]]);
    const form = values({
      amount: '120.000',
      agreementId: AGREEMENT_A,
      party: { id: PARTY, name: 'X' },
    });
    expect(excessOf(form, map, own)).toBe(0);
  });

  it('tamamlanan şantiyeye anlaşmasız gider gerekçe ister; anlaşmalı gider ve gelir istemez', () => {
    const projects = [{ id: PROJECT_A, status: 'completed' }] as Project[];
    expect(needsClosedProjectReason(values({ amount: '10' }), projects)).toBe(true);
    expect(
      needsClosedProjectReason(values({ amount: '10', agreementId: AGREEMENT_A }), projects),
    ).toBe(false);
    expect(needsClosedProjectReason(values({ kind: 'income', amount: '10' }), projects)).toBe(
      false,
    );
  });

  it('fazla onayı gerekçesiz gönderilemez', () => {
    const parsed = transactionFormSchema.safeParse(values({ amount: '10', confirmExcess: true }));
    expect(parsed.error?.issues[0]?.message).toBe('Fazla tutar için gerekçe girin.');
  });
});
