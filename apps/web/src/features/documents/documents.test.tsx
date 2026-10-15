import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useSession } from '../../stores/session';
import { fail, mockHttp, ok, type MockReply, type MockRequest } from '../../test/http-mock';
import { renderApp, signIn, TEST_USER } from '../../test/render-app';
import { STORAGE_FULL_TEXT } from './limits';
import { fileProblem, mimeTypeOf } from './upload';

const PROJECT = 'a'.repeat(24);
const TX = 'e'.repeat(24);
const UPLOAD_URL = 'https://depo.test/yukleme?imza=1';
const GB = 1024 * 1024 * 1024;

const project = {
  id: PROJECT,
  name: 'Kadıköy Villa',
  status: 'active',
  description: '',
  address: '',
  startDate: null,
  completedAt: null,
  pinned: false,
  lastUsedAt: null,
  updatedAt: '2026-10-13T10:00:00.000Z',
};

const company = (usedBytes: number, quotaBytes = 20 * GB) => ({
  displayName: 'Deneme İnşaat',
  contact: { person: '', phone: '', email: '' },
  storage: {
    usedBytes,
    quotaBytes,
    breakdown: {
      originalBytes: usedBytes,
      previewBytes: 0,
      deletedBytes: 0,
      pendingBytes: 0,
      exportBytes: 0,
      documentCount: 1,
      deletedDocumentCount: 0,
    },
  },
  service: { state: 'active', serviceEndedAt: null, viewUntil: null, retainUntil: null },
  updatedAt: '2026-10-13T10:00:00.000Z',
});

const doc = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  ownerType: 'transaction',
  ownerId: TX,
  fileName: `fis-${id}.jpg`,
  mimeType: 'image/jpeg',
  sizeBytes: 250_000,
  status: 'uploaded',
  hasPreview: true,
  uploadedBy: { id: TEST_USER.id, name: TEST_USER.name },
  uploadedAt: '2026-10-14T09:00:00.000Z',
  createdAt: '2026-10-14T09:00:00.000Z',
  updatedAt: '2026-10-14T09:00:00.000Z',
  deletedAt: null,
  deletedBy: null,
  deleteReason: null,
  ...overrides,
});

const transaction = (documents: unknown[], overrides: Record<string, unknown> = {}) => ({
  id: TX,
  recordNo: 12,
  kind: 'expense',
  amount: 4_500_000,
  date: '2026-10-14',
  partyId: null,
  party: null,
  categoryId: null,
  category: null,
  description: 'Demir',
  isSplit: false,
  linkedToAgreement: false,
  allocations: [
    {
      id: 'al1',
      scope: 'project',
      projectId: PROJECT,
      project: { id: PROJECT, name: 'Kadıköy Villa', deleted: false, status: 'active' },
      agreementId: null,
      agreement: null,
      amount: 4_500_000,
      refundedAmount: 0,
    },
  ],
  refundOf: null,
  excess: null,
  documentCount: documents.length,
  createdBy: { id: TEST_USER.id, name: TEST_USER.name },
  createdAt: '2026-10-14T09:00:00.000Z',
  updatedBy: { id: TEST_USER.id, name: TEST_USER.name },
  updatedAt: '2026-10-14T09:00:00.000Z',
  deletedAt: null,
  deletedBy: null,
  deleteReason: null,
  history: [],
  refunds: [],
  refundable: 4_500_000,
  documents,
  ...overrides,
});

/** Ortak cevaplar; `extra` önce sorulur. */
function api(extra: (request: MockRequest) => MockReply | undefined, usedBytes = 0) {
  return mockHttp((request) => {
    const reply = extra(request);
    if (reply) return reply;
    if (request.url === '/auth/me') {
      return ok({
        user: { ...TEST_USER, phone: '', email: '', updatedAt: '2026-10-13T10:00:00.000Z' },
        company: { displayName: 'Deneme İnşaat' },
        service: { state: 'active', serviceEndedAt: null, viewUntil: null, retainUntil: null },
      });
    }
    if (request.url === '/company') return ok(company(usedBytes));
    if (request.url === '/projects') return ok({ items: [project], page: 1, limit: 100, total: 1 });
    if (request.url === '/categories') return ok([]);
    if (request.url === '/transactions/suggestions') return ok([]);
    if (request.url === '/parties/suggest') return ok([]);
    return fail(404, 'NOT_FOUND', 'Bu kayda erişilemiyor.');
  });
}

/** Yükleme niyeti, depo ve tamamlama cevapları. */
function uploadReplies(request: MockRequest, putReply: () => MockReply): MockReply | undefined {
  if (request.method === 'POST' && request.url === '/documents/upload-intent') {
    return ok(
      {
        document: doc('d-new', { status: 'pending', sizeBytes: null, hasPreview: false }),
        upload: {
          method: 'PUT',
          url: UPLOAD_URL,
          headers: { 'Content-Type': 'image/jpeg' },
          expiresAt: '2026-10-14T10:15:00.000Z',
        },
      },
      201,
    );
  }
  if (request.method === 'PUT' && request.url === UPLOAD_URL) return putReply();
  if (request.method === 'POST' && request.url === '/documents/d-new/complete') {
    return ok(doc('d-new'));
  }
  return undefined;
}

const photo = (name = 'fis.jpg', size = 1000) => {
  const file = new File(['x'.repeat(Math.min(size, 1000))], name, { type: 'image/jpeg' });
  if (size > 1000) Object.defineProperty(file, 'size', { value: size });
  return file;
};

beforeAll(async () => {
  await Promise.all([
    import('../transactions/TransactionNewPage'),
    import('../transactions/TransactionDetailPage'),
    import('../projects/ProjectDetailPage'),
    import('../settings/CompanySettingsPage'),
  ]);
});

afterEach(() => {
  cleanup();
  useSession.getState().clear();
});

async function openExpenseForm() {
  const rendered = renderApp(`/uygulama/islemler/yeni?tur=gider&proje=${PROJECT}`);
  const amount = await screen.findByLabelText(/^Tutar/);
  const form = within(amount.closest('form')!);
  await waitFor(() =>
    expect(form.getByRole('combobox', { name: /^Şantiye/ })).toHaveValue(PROJECT),
  );
  return { ...rendered, form };
}

describe('dosya türü ve boyutu', () => {
  it('türü vermeyen HEIC uzantıdan tanınır; desteklenmeyen ve 20 MB üstü dosya reddedilir', () => {
    const heic = new File(['x'], 'IMG_0001.HEIC', { type: '' });
    expect(mimeTypeOf(heic)).toBe('image/heic');
    expect(mimeTypeOf(new File(['x'], 'not.txt', { type: 'text/plain' }))).toBeNull();
    expect(fileProblem(heic, null)).toMatch(/Bu dosya türü desteklenmiyor/);
    expect(fileProblem(photo('buyuk.jpg', 21 * 1024 * 1024), 'image/jpeg')).toBe(
      'Dosya en fazla 20 MB olabilir.',
    );
  });
});

describe('gider formunda belge', () => {
  it('kayıttan sonra belge niyet → depo → tamamlama sırasıyla yüklenir', async () => {
    signIn();
    const requests = api(
      (request) =>
        uploadReplies(request, () => ({ status: 200, data: '' })) ??
        (request.method === 'POST' && request.url === '/transactions'
          ? ok({ id: TX, recordNo: 12, kind: 'expense', amount: 4_500_000, warnings: [] }, 201)
          : undefined),
    );
    const { router, form } = await openExpenseForm();
    await userEvent.type(form.getByLabelText(/^Tutar/), '45000');
    await userEvent.upload(form.getByLabelText('Belge dosyası seç'), photo());
    expect(await form.findByText('Bekliyor')).toBeInTheDocument();
    await userEvent.click(form.getByRole('button', { name: 'Gideri Kaydet' }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/uygulama/projeler/${PROJECT}`),
    );
    const steps = requests.filter((r) => r.method !== 'GET').map((r) => `${r.method} ${r.url}`);
    expect(steps).toEqual([
      'POST /transactions',
      'POST /documents/upload-intent',
      `PUT ${UPLOAD_URL}`,
      'POST /documents/d-new/complete',
    ]);
    const intent = requests.find((r) => r.url === '/documents/upload-intent')!;
    expect(intent.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(intent.body).toMatchObject({
      ownerType: 'transaction',
      ownerId: TX,
      fileName: 'fis.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });
    const put = requests.find((r) => r.method === 'PUT')!;
    expect(put.headers['content-type']).toBe('image/jpeg');
    expect(put.headers.authorization).toBeUndefined();
  });

  it('belge yüklenemezse kayıt tekrar oluşturulmaz; yalnız belge aynı anahtarla yeniden denenir', async () => {
    signIn();
    let putAttempts = 0;
    const requests = api(
      (request) =>
        uploadReplies(request, () => {
          putAttempts += 1;
          return putAttempts === 1 ? 'network' : { status: 200, data: '' };
        }) ??
        (request.method === 'POST' && request.url === '/transactions'
          ? ok({ id: TX, recordNo: 12, kind: 'expense', amount: 4_500_000, warnings: [] }, 201)
          : undefined),
    );
    const { router, form } = await openExpenseForm();
    await userEvent.type(form.getByLabelText(/^Tutar/), '45000');
    await userEvent.upload(form.getByLabelText('Belge dosyası seç'), photo());
    await userEvent.click(form.getByRole('button', { name: 'Gideri Kaydet' }));

    expect(await screen.findByText('İşlem kaydedildi; 1 belge yüklenemedi.')).toBeInTheDocument();
    expect(screen.getByText('Başarısız')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/uygulama/islemler/yeni');

    await userEvent.click(screen.getByRole('button', { name: 'fis.jpg belgesini yeniden dene' }));
    expect(
      await screen.findByText('İşlem kaydedildi; bütün belgeler yüklendi.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Yüklendi')).toBeInTheDocument();

    expect(requests.filter((r) => r.method === 'POST' && r.url === '/transactions')).toHaveLength(
      1,
    );
    const intents = requests.filter((r) => r.url === '/documents/upload-intent');
    expect(intents).toHaveLength(2);
    expect(intents[1]!.headers['idempotency-key']).toBe(intents[0]!.headers['idempotency-key']);

    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/uygulama/projeler/${PROJECT}`),
    );
  });

  it('20 MB üstü dosya gönderilmeden başarısız gösterilir', async () => {
    signIn();
    api(() => undefined);
    const { form } = await openExpenseForm();
    await userEvent.upload(
      form.getByLabelText('Belge dosyası seç'),
      photo('cok-buyuk.jpg', 21 * 1024 * 1024),
    );
    expect(await form.findByText('Dosya en fazla 20 MB olabilir.')).toBeInTheDocument();
    expect(form.getByText('Başarısız')).toBeInTheDocument();
    expect(form.queryByRole('button', { name: /yeniden dene/ })).not.toBeInTheDocument();
  });

  it('belge alanı doluyken kayıt girilebilir; yükleme düğmesi kapalı ve nedeni yazılı', async () => {
    signIn();
    api(() => undefined, 20 * GB);
    const { form } = await openExpenseForm();
    expect(await form.findByText(STORAGE_FULL_TEXT)).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Dosya ekle' })).toBeDisabled();
    expect(form.getByRole('button', { name: 'Gideri Kaydet' })).toBeEnabled();
  });
});

describe('işlem detayında belgeler', () => {
  async function openDetail(
    documents: unknown[],
    extra: (r: MockRequest) => MockReply | undefined = () => undefined,
    overrides: Record<string, unknown> = {},
  ) {
    signIn();
    const requests = api((request) => {
      if (request.method === 'GET' && request.url === `/transactions/${TX}`) {
        return ok(transaction(documents, overrides));
      }
      if (
        request.method === 'GET' &&
        /^\/documents\/[^/]+\/(preview|download)$/.test(request.url)
      ) {
        const preview = request.url.endsWith('/preview');
        return ok({
          url: `https://depo.test${request.url}?imza=1`,
          expiresAt: '2026-10-14T10:05:00.000Z',
          isPreview: preview && !request.url.includes('belge-pdf'),
          fileName: 'fis.jpg',
          mimeType: 'image/jpeg',
        });
      }
      return extra(request);
    });
    renderApp(`/uygulama/islemler/${TX}`);
    const panel = within(
      (await screen.findByRole('heading', { name: 'Belgeler' })).closest('section')!,
    );
    return { requests, panel };
  }

  it('önizleme görseli dialogda açılır; önizlemesi olmayan belgede orijinal açılır; indirme imzalı adresi kullanır', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { requests, panel } = await openDetail([
      doc('d1'),
      doc('belge-pdf', {
        fileName: 'sozlesme.pdf',
        mimeType: 'application/pdf',
        hasPreview: false,
      }),
    ]);

    await userEvent.click(panel.getByRole('button', { name: 'fis-d1.jpg önizle' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(await dialog.findByRole('img', { name: 'fis-d1.jpg önizlemesi' })).toHaveAttribute(
      'src',
      'https://depo.test/documents/d1/preview?imza=1',
    );
    await userEvent.click(dialog.getByRole('button', { name: 'Kapat' }));

    await userEvent.click(panel.getByRole('button', { name: 'sozlesme.pdf önizle' }));
    const pdf = within(await screen.findByRole('dialog'));
    expect(await pdf.findByText(/Bu belgenin önizlemesi yok/)).toBeInTheDocument();
    expect(pdf.getByRole('link', { name: 'Orijinali aç' })).toHaveAttribute(
      'href',
      'https://depo.test/documents/belge-pdf/preview?imza=1',
    );
    await userEvent.click(pdf.getByRole('button', { name: 'Kapat' }));

    await userEvent.click(panel.getByRole('button', { name: 'sozlesme.pdf indir' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(requests.some((r) => r.url === '/documents/belge-pdf/download')).toBe(true);
    click.mockRestore();
  });

  it('belge gerekçeyle silinir ve silinen belge gerekçeyle geri alınır', async () => {
    const changes: MockRequest[] = [];
    const { panel } = await openDetail(
      [
        doc('d1'),
        doc('d2', {
          deletedAt: '2026-10-14T09:30:00.000Z',
          deletedBy: { id: TEST_USER.id, name: TEST_USER.name },
          deleteReason: 'Yanlış fiş',
          updatedAt: '2026-10-14T09:30:00.000Z',
        }),
      ],
      (request) => {
        if (request.method === 'DELETE' || request.url.endsWith('/restore')) {
          changes.push(request);
          return ok(doc(request.url.includes('d1') ? 'd1' : 'd2'));
        }
        return undefined;
      },
    );
    expect(panel.getByText('Gerekçe: Yanlış fiş')).toBeInTheDocument();

    await userEvent.click(panel.getByRole('button', { name: 'fis-d1.jpg sil' }));
    let dialog = within(await screen.findByRole('dialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Sil' }));
    expect(await dialog.findByText('Gerekçe girin.')).toBeInTheDocument();
    await userEvent.type(dialog.getByLabelText(/^Gerekçe/), 'Mükerrer fotoğraf');
    await userEvent.click(dialog.getByRole('button', { name: 'Sil' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(changes[0]).toMatchObject({
      method: 'DELETE',
      url: '/documents/d1',
      body: { reason: 'Mükerrer fotoğraf', expectedUpdatedAt: '2026-10-14T09:00:00.000Z' },
    });

    await userEvent.click(panel.getByRole('button', { name: 'fis-d2.jpg geri al' }));
    dialog = within(await screen.findByRole('dialog'));
    await userEvent.type(dialog.getByLabelText(/^Gerekçe/), 'Doğru fişmiş');
    await userEvent.click(dialog.getByRole('button', { name: 'Geri al' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(changes[1]).toMatchObject({
      method: 'POST',
      url: '/documents/d2/restore',
      body: { reason: 'Doğru fişmiş', expectedUpdatedAt: '2026-10-14T09:30:00.000Z' },
    });
  });

  it('detaydan eklenen belge hemen yüklenir; hata olursa yalnız o belge yeniden denenir', async () => {
    let putAttempts = 0;
    const { requests, panel } = await openDetail([], (request) =>
      uploadReplies(request, () => {
        putAttempts += 1;
        return putAttempts === 1 ? { status: 403, data: '' } : { status: 200, data: '' };
      }),
    );
    await userEvent.upload(panel.getByLabelText('Belge dosyası seç'), photo());
    expect(await panel.findByText('Başarısız')).toBeInTheDocument();
    expect(
      panel.getByText('Dosya yüklenemedi. Bağlantınızı kontrol edip yeniden deneyin.'),
    ).toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: 'fis.jpg belgesini yeniden dene' }));
    expect(await panel.findByText('Yüklendi')).toBeInTheDocument();
    expect(requests.filter((r) => r.url === '/documents/d-new/complete')).toHaveLength(1);
  });

  it('10 belgesi olan kayda yeni belge eklenemez; nedeni yazılır', async () => {
    const { panel } = await openDetail(
      Array.from({ length: 10 }, (_, index) => doc(`d${index}`, { hasPreview: false })),
    );
    expect(panel.getByText('10/10')).toBeInTheDocument();
    expect(panel.getByText('Bu kayda en fazla 10 belge eklenebilir.')).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Dosya ekle' })).toBeDisabled();
  });

  it('silinmiş kaydın belgeleri yalnız okunur', async () => {
    const { panel } = await openDetail([doc('d1')], () => undefined, {
      deletedAt: '2026-10-14T09:30:00.000Z',
      deletedBy: { id: TEST_USER.id, name: TEST_USER.name },
      deleteReason: 'Yanlış kayıt',
    });
    expect(
      panel.getByText('Kayıt silinmiş. Belge işlemi için önce kaydı geri yükleyin.'),
    ).toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'fis-d1.jpg indir' })).toBeEnabled();
    expect(panel.queryByRole('button', { name: 'fis-d1.jpg sil' })).not.toBeInTheDocument();
    expect(panel.getByRole('button', { name: 'Dosya ekle' })).toBeDisabled();
  });
});

describe('firma ayarlarında belge alanı', () => {
  it('kullanılan/toplam ve orijinal, önizleme, silinmiş ayrı gösterilir', async () => {
    signIn();
    api((request) =>
      request.url === '/company'
        ? ok({
            ...company(3 * 1024 * 1024),
            storage: {
              usedBytes: 3 * 1024 * 1024,
              quotaBytes: 20 * GB,
              breakdown: {
                originalBytes: 2 * 1024 * 1024,
                previewBytes: 512 * 1024,
                deletedBytes: 512 * 1024,
                pendingBytes: 0,
                exportBytes: 0,
                documentCount: 4,
                deletedDocumentCount: 1,
              },
            },
          })
        : undefined,
    );
    renderApp('/uygulama/ayarlar/firma');
    const breakdown = within(await screen.findByLabelText('Kullanım dökümü'));
    expect(breakdown.getByText('Orijinal belgeler')).toBeInTheDocument();
    expect(breakdown.getByText('2 MB')).toBeInTheDocument();
    expect(breakdown.getByText('Önizlemeler')).toBeInTheDocument();
    expect(breakdown.getByText('Silinmiş, geri alınabilir belgeler')).toBeInTheDocument();
    expect(breakdown.getAllByText('512 KB')).toHaveLength(2);
    expect(breakdown.queryByText('Yüklenmekte olan dosyalar')).not.toBeInTheDocument();
    expect(screen.getByText('3 MB')).toBeInTheDocument();
  });
});
