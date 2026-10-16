import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ExportJob } from '../../api/types';
import { useSession } from '../../stores/session';
import { fail, mockHttp, ok } from '../../test/http-mock';
import { renderApp, signIn, TEST_USER } from '../../test/render-app';

const JOB = 'b'.repeat(24);
const DOWNLOAD_URL = 'https://depo.test/paket.zip?imza=1';

const job = (overrides: Partial<ExportJob> = {}): ExportJob => ({
  id: JOB,
  type: 'full',
  status: 'queued',
  progress: 0,
  requestedBy: { id: TEST_USER.id, name: TEST_USER.name },
  createdAt: '2026-10-16T09:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  expiresAt: null,
  expired: false,
  fileName: null,
  sizeBytes: null,
  error: null,
  download: null,
  ...overrides,
});

const ready = (download: ExportJob['download'] = null) =>
  job({
    status: 'ready',
    progress: 100,
    finishedAt: '2026-10-16T09:01:00.000Z',
    expiresAt: '2026-10-23T09:01:00.000Z',
    fileName: 'tum-firma-verisi-deneme-insaat-2026-10-16.zip',
    sizeBytes: 3 * 1024 * 1024,
    download,
  });

/** `/exports` cevapları sırayla; son cevap tekrar eder. */
function api(listReplies: ExportJob[][]) {
  let listCalls = 0;
  return mockHttp((request) => {
    if (request.url === '/auth/me') {
      return ok({
        user: { ...TEST_USER, phone: '', email: '', updatedAt: '2026-10-13T10:00:00.000Z' },
        company: { displayName: 'Deneme İnşaat' },
        service: { state: 'active', serviceEndedAt: null, viewUntil: null, retainUntil: null },
      });
    }
    if (request.method === 'GET' && request.url === '/exports') {
      const reply = listReplies[Math.min(listCalls, listReplies.length - 1)]!;
      listCalls += 1;
      return ok(reply);
    }
    if (request.method === 'POST' && request.url === '/exports/full') return ok(job(), 201);
    if (request.method === 'GET' && request.url === `/exports/${JOB}`) {
      return ok(ready({ url: DOWNLOAD_URL, expiresAt: '2026-10-16T09:06:00.000Z' }));
    }
    if (request.url === '/projects') return ok({ items: [], page: 1, limit: 100, total: 0 });
    return fail(404, 'NOT_FOUND', 'Bu kayda erişilemiyor.');
  });
}

beforeAll(async () => {
  await import('./ReportsPage');
});

afterEach(() => {
  cleanup();
  useSession.getState().clear();
  vi.restoreAllMocks();
});

function panel() {
  return within(screen.getByRole('heading', { name: 'Tüm firma verisi' }).closest('section')!);
}

describe('tüm firma verisini dışa aktar', () => {
  it('başlatır, ilerlemeyi gösterir ve hazır paketi indirir', async () => {
    signIn();
    const requests = api([[], [job({ status: 'running', progress: 40 })], [ready()]]);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/uygulama/raporlar?rapor=acik');
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: 'Tüm firma verisi' });
    await user.click(panel().getByRole('button', { name: 'Tüm firma verisini dışa aktar' }));

    expect(await panel().findByText('%40')).toBeInTheDocument();
    expect(panel().getByRole('progressbar', { name: 'Dışa aktarma ilerlemesi' })).toHaveValue(40);
    expect(panel().getByRole('button', { name: 'Tüm firma verisini dışa aktar' })).toBeDisabled();
    const post = requests.find((r) => r.method === 'POST' && r.url === '/exports/full');
    expect(post?.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);

    // Süren iş varken liste kendiliğinden yenilenir.
    const download = await panel().findByRole(
      'button',
      { name: /Paketi indir/ },
      { timeout: 5_000 },
    );
    expect(panel().getByText(/Paket hazır · 3 MB/)).toBeInTheDocument();
    await user.click(download);
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.href).toBe(DOWNLOAD_URL);
  });

  it('başarısız işin nedenini gösterir; yeniden başlatılabilir', async () => {
    signIn();
    api([
      [
        job({
          status: 'failed',
          error:
            'Paket hazırlanamadı. Finansal kayıtlarınız etkilenmedi; yeniden deneyebilirsiniz.',
        }),
      ],
    ]);
    renderApp('/uygulama/raporlar');
    expect(await screen.findByText(/Finansal kayıtlarınız etkilenmedi/)).toBeInTheDocument();
    expect(panel().getByRole('button', { name: 'Tüm firma verisini dışa aktar' })).toBeEnabled();
  });
});
