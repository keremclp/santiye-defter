import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { useSession } from '../../stores/session';
import { fail, mockHttp, ok, type MockRequest } from '../../test/http-mock';
import { renderApp, signIn, TEST_USER } from '../../test/render-app';

const PROJECT_A = 'a'.repeat(24);
const PROJECT_B = 'b'.repeat(24);

const project = (id: string, name: string, status = 'active') => ({
  id,
  name,
  status,
  description: '',
  address: '',
  startDate: null,
  completedAt: null,
  pinned: false,
  lastUsedAt: null,
  updatedAt: '2026-10-13T10:00:00.000Z',
});

function api(onCreate: (request: MockRequest) => ReturnType<typeof ok>) {
  return mockHttp((request) => {
    if (request.url === '/auth/me') {
      return ok({
        user: { ...TEST_USER, phone: '', email: '', updatedAt: '2026-10-13T10:00:00.000Z' },
        company: { displayName: 'Deneme İnşaat' },
        service: { state: 'active', serviceEndedAt: null, viewUntil: null, retainUntil: null },
      });
    }
    if (request.url === '/projects') {
      return ok({
        items: [project(PROJECT_A, 'Kadıköy Villa'), project(PROJECT_B, 'Ataşehir Konut')],
        page: 1,
        limit: 100,
        total: 2,
      });
    }
    if (request.url === '/categories') return ok([]);
    if (request.url === '/transactions/suggestions') return ok([]);
    if (request.url === '/parties/suggest') return ok([]);
    if (request.method === 'POST' && request.url === '/transactions') return onCreate(request);
    return fail(404, 'NOT_FOUND', 'Bu kayda erişilemiyor.');
  });
}

afterEach(() => useSession.getState().clear());

describe('gider formu', () => {
  it('şantiye bağlamdan hazır gelir; tutar kuruşa çevrilip Idempotency-Key ile gönderilir', async () => {
    signIn();
    const requests = api(() =>
      ok({ id: 't1', recordNo: 7, kind: 'expense', amount: 4_500_000, warnings: [] }, 201),
    );
    renderApp(`/uygulama/islemler/yeni?tur=gider&proje=${PROJECT_A}`);

    const projectSelect = await screen.findByRole('combobox', { name: /^Şantiye/ });
    await waitFor(() => expect(projectSelect).toHaveValue(PROJECT_A));
    await userEvent.type(screen.getByLabelText(/^Tutar/), '45000');
    expect(screen.getByLabelText(/^Tutar/)).toHaveValue('45.000');
    await userEvent.click(screen.getByRole('button', { name: 'Gideri Kaydet' }));

    await waitFor(() => expect(requests.some((r) => r.method === 'POST')).toBe(true));
    const post = requests.find((r) => r.method === 'POST')!;
    expect(post.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(post.body).toMatchObject({
      kind: 'expense',
      amount: 4_500_000,
      allocations: [{ scope: 'project', projectId: PROJECT_A, amount: 4_500_000 }],
    });
  });

  it('paylaştırmada pay toplamı ana tutara eşit olmadan kayıt gönderilmez', async () => {
    signIn();
    const requests = api(() => ok({}, 201));
    renderApp(`/uygulama/islemler/yeni?tur=gider&proje=${PROJECT_A}`);

    await userEvent.type(await screen.findByLabelText(/^Tutar/), '40000');
    await userEvent.click(screen.getByRole('button', { name: /Paylaştır/ }));
    const shares = screen.getAllByLabelText(/Pay tutarı/);
    await userEvent.clear(shares[0]!);
    await userEvent.type(shares[0]!, '25000');
    const second = screen.getAllByRole('combobox', { name: /^Şantiye/ })[1]!;
    await userEvent.selectOptions(second, PROJECT_B);
    await userEvent.type(shares[1]!, '10000');

    expect(screen.getByText('Dağıtılmamış tutar: 5.000 TL')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Gideri Kaydet' }));
    expect(
      await screen.findByText('Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı.'),
    ).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('ondalık için nokta kullanılırsa alan altında uyarı', async () => {
    signIn();
    api(() => ok({}, 201));
    renderApp('/uygulama/islemler/yeni?tur=gider&genel=1');
    await userEvent.type(await screen.findByLabelText(/^Tutar/), '12.5');
    await userEvent.click(screen.getByRole('button', { name: 'Gideri Kaydet' }));
    const field = screen.getByLabelText(/^Tutar/).closest('.field')!;
    expect(
      await within(field as HTMLElement).findByText(/Ondalık için virgül kullanın/),
    ).toBeInTheDocument();
  });
});
