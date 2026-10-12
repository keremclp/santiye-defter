import { describe, expect, it } from 'vitest';
import {
  accessDecision,
  computeServiceState,
  SERVICE_STATES,
  type AccessKind,
} from '../src/services/service-state.js';

const base = {
  isSuspended: false,
  serviceEndedAt: null,
  viewUntil: null,
  retainUntil: null,
  deletionStatus: 'none' as const,
};

// Yürürlük 2026-01-01 → görüntüleme 2026-01-31'e kadar, saklama 2026-06-30'a kadar (D+30, D+180).
const ended = {
  ...base,
  serviceEndedAt: '2026-01-01',
  viewUntil: '2026-01-31',
  retainUntil: '2026-06-30',
};

describe('computeServiceState', () => {
  it('hizmet sonu yoksa aktif', () => {
    expect(computeServiceState(base, '2026-10-12')).toBe('active');
  });

  it.each([
    ['2025-12-31', 'active'],
    ['2026-01-01', 'view_only'],
    ['2026-01-31', 'view_only'],
    ['2026-02-01', 'archived'],
    ['2026-06-30', 'archived'],
    ['2026-07-01', 'deletion_pending'],
  ])('hizmet sonu sınırları: %s → %s (uçlar dahil)', (today, expected) => {
    expect(computeServiceState(ended, today)).toBe(expected);
  });

  it('geçici durdurma aktif ve görüntüleme döneminde erişimi kapatır', () => {
    expect(computeServiceState({ ...base, isSuspended: true }, '2026-10-12')).toBe('suspended');
    expect(computeServiceState({ ...ended, isSuspended: true }, '2026-01-10')).toBe('suspended');
  });

  it('arşiv ve silme onayı durumları geçici durdurmadan önce gelir', () => {
    expect(computeServiceState({ ...ended, isSuspended: true }, '2026-03-01')).toBe('archived');
    expect(computeServiceState({ ...ended, isSuspended: true }, '2026-08-01')).toBe(
      'deletion_pending',
    );
  });

  it.each(['pending', 'running', 'failed'] as const)(
    'silme işi %s ise siliniyor',
    (deletionStatus) => {
      expect(computeServiceState({ ...base, deletionStatus }, '2026-10-12')).toBe('deleting');
    },
  );

  it('arşiv uzatması saklama bitişini ileri alır, erişimi açmaz', () => {
    expect(computeServiceState({ ...ended, retainUntil: '2026-12-31' }, '2026-08-01')).toBe(
      'archived',
    );
  });
});

describe('accessDecision (şartname 9.10 tablosu)', () => {
  const kinds: AccessKind[] = ['login', 'read', 'write', 'self'];
  const expected: Record<(typeof SERVICE_STATES)[number], string[]> = {
    active: ['allow', 'allow', 'allow', 'allow'],
    view_only: ['allow', 'allow', 'read_only', 'allow'],
    suspended: ['closed', 'closed', 'closed', 'closed'],
    archived: ['closed', 'closed', 'closed', 'closed'],
    deletion_pending: ['closed', 'closed', 'closed', 'closed'],
    deleting: ['closed', 'closed', 'closed', 'closed'],
  };

  it.each(SERVICE_STATES)('%s satırı', (state) => {
    expect(kinds.map((kind) => accessDecision(state, kind))).toEqual(expected[state]);
  });
});
