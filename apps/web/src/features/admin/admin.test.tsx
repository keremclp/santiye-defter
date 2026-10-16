import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  PlatformCompany,
  PlatformCompanyDetail,
  PlatformCompanyList,
} from '../../api/admin-types';
import { useAdminPending, useAdminSession } from '../../stores/admin-session';
import { useSession } from '../../stores/session';
import { fail, mockHttp, ok, type MockRequest } from '../../test/http-mock';
import { renderApp, signIn } from '../../test/render-app';

const ADMIN = { id: 'a'.repeat(24), username: 'sahip' };
const CODES = Array.from({ length: 10 }, (_, i) => `ABCDE-FGH${String(i).padStart(2, '2')}`);
const COMPANY_ID = 'c'.repeat(24);

function signInAdmin() {
  useAdminSession.getState().setSession({ accessToken: 'pa', refreshToken: 'pr', admin: ADMIN });
}

afterEach(() => {
  useAdminSession.getState().clear();
  useAdminPending.getState().setPending(null);
  useSession.getState().clear();
});

function company(overrides: Partial<PlatformCompany> = {}): PlatformCompany {
  return {
    id: COMPANY_ID,
    name: 'İnci Yapı',
    displayName: 'İnci',
    contact: { person: 'Ali Kaya', phone: '', email: '' },
    opsNote: '',
    storage: { usedBytes: 1024 ** 3, quotaBytes: 20 * 1024 ** 3 },
    service: { state: 'active', serviceEndedAt: null, viewUntil: null, retainUntil: null },
    isSuspended: false,
    deletionStatus: 'none',
    userCount: 0,
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

function detail(overrides: Partial<PlatformCompany> = {}): PlatformCompanyDetail {
  return {
    company: company(overrides),
    users: [],
    contents: { transactions: 12, agreements: 3, projects: 2, parties: 5, documents: 7 },
    history: [
      {
        id: 'l1',
        adminId: ADMIN.id,
        companyId: COMPANY_ID,
        action: 'company.create',
        changes: [{ field: 'name', old: null, new: 'İnci Yapı' }],
        reason: 'Yeni müşteri',
        at: '2026-10-01T09:00:00.000Z',
      },
    ],
  };
}

const emptySummary = {
  storageFull: [],
  storageNearFull: [],
  viewEnding: [],
  retentionEnding: [],
  deletionPending: [],
  deletionIncomplete: [],
};

describe('yönetim girişi ve güvenlik kurulumu', () => {
  it('yönetim alanı ürün sahibi oturumu ister; müşteri oturumu yetmez', async () => {
    signIn();
    mockHttp(() => ok({}));
    const { router } = renderApp('/yonetim');
    expect(await screen.findByRole('heading', { name: 'Yönetim girişi' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/yonetim/giris');
  });

  it('ilk girişte QR kurulumu zorunlu; kurtarma kodları bir kez gösterilir ve hiçbir yere yazılmaz', async () => {
    const requests = mockHttp((request) => {
      if (request.url === '/platform/auth/login') {
        return ok({ pendingToken: 'pending-1', totpSetupRequired: true });
      }
      if (request.url === '/platform/auth/totp/setup') {
        return ok({
          otpauthUrl: 'otpauth://totp/Santiye:sahip?secret=JBSWY3DP',
          secret: 'JBSWY3DP',
        });
      }
      if (request.url === '/platform/auth/totp/verify') {
        const { code } = request.body as { code: string };
        if (code !== '123456') return fail(401, 'UNAUTHORIZED', 'Doğrulama kodu hatalı.');
        return ok({ accessToken: 'pa', refreshToken: 'pr', admin: ADMIN, recoveryCodes: CODES });
      }
      if (request.url === '/platform/companies') {
        return ok({ items: [], page: 1, limit: 50, total: 0, summary: emptySummary });
      }
      return fail(404, 'NOT_FOUND', 'Yok');
    });
    const { router } = renderApp('/yonetim/giris');
    await userEvent.type(await screen.findByLabelText(/Kullanıcı adı/), 'sahip');
    await userEvent.type(screen.getByLabelText(/Şifre/), 'Sahip-1234');
    await userEvent.click(screen.getByRole('button', { name: 'Devam' }));

    expect(await screen.findByRole('heading', { name: 'Güvenlik kurulumu' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /QR kodu/ })).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DP')).toBeInTheDocument();
    const setup = requests.find((r) => r.url === '/platform/auth/totp/setup')!;
    expect(setup.headers.authorization).toBe('Bearer pending-1');

    await userEvent.type(screen.getByLabelText(/Doğrulama kodu/), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Kurulumu onayla' }));
    expect(await screen.findByText('Doğrulama kodu hatalı.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Doğrulama kodu/));
    await userEvent.type(screen.getByLabelText(/Doğrulama kodu/), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Kurulumu onayla' }));

    const list = await screen.findByRole('list', { name: 'Kurtarma kodları' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(10);
    expect(
      screen.getByText('Bu kodları çevrimdışı ve güvenli bir yerde saklayın'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kodları indir' })).toBeInTheDocument();
    // Kodlar tarayıcı deposuna ve adres geçmişine yazılmaz.
    expect(JSON.stringify({ ...localStorage })).not.toContain(CODES[0]);
    expect(JSON.stringify(router.state.location.state ?? null)).not.toContain(CODES[0]);

    const go = screen.getByRole('button', { name: 'Yönetim alanına geç' });
    expect(go).toBeDisabled();
    await userEvent.click(screen.getByLabelText('Kodları güvenli bir yere kaydettim.'));
    await userEvent.click(go);
    expect(await screen.findByRole('heading', { name: 'İşletim özeti' })).toBeInTheDocument();
    expect(screen.queryByText(CODES[0]!)).not.toBeInTheDocument();

    // Geri gelinse de kodlar yeniden gösterilmez.
    await router.navigate('/yonetim/guvenlik-kurulumu');
    await waitFor(() => expect(router.state.location.pathname).toBe('/yonetim'));
    expect(screen.queryByText(CODES[0]!)).not.toBeInTheDocument();
  });

  it('kurulu hesapta şifreden sonra kod; telefon yoksa kurtarma koduyla girilir', async () => {
    const requests = mockHttp((request) => {
      if (request.url === '/platform/auth/login') {
        return ok({ pendingToken: 'pending-2', totpSetupRequired: false });
      }
      if (request.url === '/platform/auth/recovery') {
        return ok({
          accessToken: 'pa',
          refreshToken: 'pr',
          admin: ADMIN,
          remainingRecoveryCodes: 9,
        });
      }
      if (request.url === '/platform/companies') {
        return ok({ items: [], page: 1, limit: 50, total: 0, summary: emptySummary });
      }
      return fail(404, 'NOT_FOUND', 'Yok');
    });
    renderApp('/yonetim/giris');
    await userEvent.type(await screen.findByLabelText(/Kullanıcı adı/), 'sahip');
    await userEvent.type(screen.getByLabelText(/Şifre/), 'Sahip-1234');
    await userEvent.click(screen.getByRole('button', { name: 'Devam' }));
    expect(await screen.findByLabelText(/Doğrulama kodu/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /kurtarma kodu kullan/ }));
    await userEvent.type(screen.getByLabelText(/Kurtarma kodu/), 'abcde-fgh22');
    await userEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));
    expect(await screen.findByRole('heading', { name: 'İşletim özeti' })).toBeInTheDocument();
    const recovery = requests.find((r) => r.url === '/platform/auth/recovery')!;
    expect(recovery.body).toEqual({ recoveryCode: 'abcde-fgh22' });
    expect(recovery.headers.authorization).toBe('Bearer pending-2');
    expect(await screen.findByText(/Kalan kod: 9/)).toBeInTheDocument();
  });

  it('kurtarma kodu yenileme yeni kodları bir kez gösterir; kapatınca kaybolur', async () => {
    signInAdmin();
    const requests = mockHttp((request) => {
      if (request.url.endsWith('/platform/auth/refresh')) {
        return ok({ accessToken: 'pa2', refreshToken: 'pr2', admin: ADMIN });
      }
      if (request.url === '/platform/auth/recovery-codes/regenerate') {
        return ok({ recoveryCodes: CODES });
      }
      return fail(404, 'NOT_FOUND', 'Yok');
    });
    renderApp('/yonetim/guvenlik');
    const panel = (
      await screen.findByRole('heading', { name: 'Kurtarma kodlarını yenile' })
    ).closest('section')!;
    await userEvent.type(within(panel).getByLabelText(/Doğrulama kodu/), '654321');
    await userEvent.click(within(panel).getByRole('button', { name: 'Kodları yenile' }));
    expect(await within(panel).findByText(CODES[3]!)).toBeInTheDocument();
    const call = requests.find((r) => r.url === '/platform/auth/recovery-codes/regenerate')!;
    expect(call.headers.authorization).toBe('Bearer pa2');

    await userEvent.click(within(panel).getByLabelText('Kodları güvenli bir yere kaydettim.'));
    await userEvent.click(within(panel).getByRole('button', { name: 'Tamam' }));
    expect(within(panel).queryByText(CODES[3]!)).not.toBeInTheDocument();
  });
});

describe('işletim özeti ve firma listesi', () => {
  it('özet grupları filtreden bağımsız; başarısız silme buradan yeniden başlatılır', async () => {
    signInAdmin();
    const ref = (name: string, extra: object = {}) => ({
      id: name === 'Yarım Silme' ? 'd'.repeat(24) : 'e'.repeat(24),
      name,
      state: 'active',
      deletionStatus: 'none',
      usedBytes: 20 * 1024 ** 3,
      quotaBytes: 20 * 1024 ** 3,
      viewUntil: null,
      retainUntil: null,
      ...extra,
    });
    const requests = mockHttp((request) => {
      if (request.url === '/platform/companies') {
        const list: PlatformCompanyList = {
          items: [company()],
          page: 1,
          limit: 50,
          total: 1,
          summary: {
            ...emptySummary,
            storageFull: [ref('Dolu Yapı')] as PlatformCompanyList['summary']['storageFull'],
            deletionIncomplete: [
              ref('Yarım Silme', { state: 'deleting', deletionStatus: 'failed' }),
            ] as PlatformCompanyList['summary']['deletionIncomplete'],
          },
        };
        return ok(list);
      }
      return fail(404, 'NOT_FOUND', 'Yok');
    });
    renderApp('/yonetim');
    expect(await screen.findByText('Kapasitesi dolan')).toBeInTheDocument();
    expect(screen.getByText('Silmesi tamamlanmayan')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dolu Yapı' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Silmeyi yeniden başlat' })).toHaveAttribute(
      'href',
      `/yonetim/firmalar/${'d'.repeat(24)}/sil`,
    );
    expect(screen.getByText(/Görüntüleme dönemi 7 gün içinde bitiyor/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'İnci Yapı' })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Durum'), 'archived');
    await waitFor(() =>
      expect(requests.at(-1)?.params).toMatchObject({ status: 'archived', page: 1 }),
    );
    // Yönetim alanı açıkça belli.
    expect(screen.getAllByText('Yönetim alanı').length).toBeGreaterThan(0);
  });
});

describe('kullanıcı ekleme ve şifre sıfırlama', () => {
  function detailHandler(onRequest?: (request: MockRequest) => ReturnType<typeof ok> | null) {
    return (request: MockRequest) => {
      const custom = onRequest?.(request);
      if (custom) return custom;
      if (request.url === `/platform/companies/${COMPANY_ID}`) return ok(detail());
      return fail(404, 'NOT_FOUND', 'Yok');
    };
  }

  it('geçici şifre yalnız bir kez gösterilir; anahtarla gider; kapatınca yeniden görünmez', async () => {
    signInAdmin();
    const requests = mockHttp(
      detailHandler((request) =>
        request.url === `/platform/companies/${COMPANY_ID}/users`
          ? ok(
              {
                user: {
                  id: 'u'.repeat(24),
                  companyId: COMPANY_ID,
                  name: 'Ayşe Demir',
                  username: 'ayse.demir',
                  phone: '',
                  email: '',
                  isActive: true,
                  mustChangePassword: true,
                  tempPasswordExpiresAt: '2026-10-19T09:00:00.000Z',
                  createdAt: '2026-10-16T09:00:00.000Z',
                  updatedAt: '2026-10-16T09:00:00.000Z',
                },
                temporaryPassword: 'Gecici-Sifre-42',
                tempPasswordExpiresAt: '2026-10-19T09:00:00.000Z',
              },
              201,
            )
          : null,
      ),
    );
    renderApp(`/yonetim/firmalar/${COMPANY_ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Kullanıcı ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Kullanıcı ekle' });
    await userEvent.type(within(dialog).getByLabelText(/Ad soyad/), 'Ayşe Demir');
    await userEvent.type(within(dialog).getByLabelText(/Kullanıcı adı/), 'ayse.demir');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kullanıcıyı Ekle' }));

    const shown = await screen.findByRole('dialog', { name: 'Geçici şifre' });
    expect(within(shown).getByText('Gecici-Sifre-42')).toBeInTheDocument();
    expect(within(shown).getByText('Bu şifre yalnız şimdi gösterilir')).toBeInTheDocument();
    const create = requests.find((r) => r.method === 'POST' && r.url.endsWith('/users'))!;
    expect(create.headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify({ ...localStorage })).not.toContain('Gecici-Sifre-42');

    const close = within(shown).getByRole('button', { name: 'Kapat' });
    expect(close).toBeDisabled();
    await userEvent.click(within(shown).getByLabelText(/Şifreyi kaydettim/));
    await userEvent.click(close);
    await waitFor(() => expect(screen.queryByText('Gecici-Sifre-42')).not.toBeInTheDocument());
  });

  it('aynı anahtarla tekrar gelen cevapta şifre yoktur; açıklama gösterilir', async () => {
    signInAdmin();
    mockHttp(
      detailHandler((request) =>
        request.url === `/platform/companies/${COMPANY_ID}/users`
          ? {
              status: 201,
              data: {
                success: true,
                message:
                  'Geçici şifre ilk yanıtta gösterildi ve yeniden gösterilemez. Görmediyseniz şifreyi sıfırlayın.',
                data: {
                  user: { id: 'u'.repeat(24), name: 'Ayşe Demir', username: 'ayse.demir' },
                  temporaryPassword: null,
                  tempPasswordExpiresAt: null,
                },
              },
            }
          : null,
      ),
    );
    renderApp(`/yonetim/firmalar/${COMPANY_ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Kullanıcı ekle' }));
    const dialog = await screen.findByRole('dialog', { name: 'Kullanıcı ekle' });
    await userEvent.type(within(dialog).getByLabelText(/Ad soyad/), 'Ayşe Demir');
    await userEvent.type(within(dialog).getByLabelText(/Kullanıcı adı/), 'ayse.demir');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Kullanıcıyı Ekle' }));
    expect(await screen.findByText(/Görmediyseniz şifreyi sıfırlayın/)).toBeInTheDocument();
  });

  it('firma detayı kayıt sayılarını ve Türkçe işletim geçmişini gösterir', async () => {
    signInAdmin();
    mockHttp(detailHandler());
    renderApp(`/yonetim/firmalar/${COMPANY_ID}`);
    expect(await screen.findByRole('heading', { name: 'İnci Yapı' })).toBeInTheDocument();
    expect(screen.getByText('Firma oluşturuldu')).toBeInTheDocument();
    expect(screen.getByText('Gerekçe: Yeni müşteri')).toBeInTheDocument();
    expect(screen.getByText('Hareket').nextElementSibling).toHaveTextContent('12');
  });
});

describe('hizmet yaşam döngüsü ve kalıcı silme', () => {
  it('hizmet sonu dialogu seçili tarihin API önizlemesini gösterir; onay gerekçeyle gider', async () => {
    signInAdmin();
    const requests = mockHttp((request) => {
      if (request.url === `/platform/companies/${COMPANY_ID}`) return ok(detail());
      if (request.url === `/platform/companies/${COMPANY_ID}/end-service`) {
        if (request.params.preview) {
          return ok({
            preview: true,
            name: 'İnci Yapı',
            effectiveDate: (request.body as { effectiveDate: string }).effectiveDate,
            serviceEndedAt: '2026-11-01',
            viewUntil: '2026-12-01',
            retainUntil: '2027-04-30',
          });
        }
        return ok(company());
      }
      return fail(404, 'NOT_FOUND', 'Yok');
    });
    renderApp(`/yonetim/firmalar/${COMPANY_ID}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Hizmeti sonlandır' }));
    const dialog = await screen.findByRole('dialog', { name: 'Hizmeti sonlandır' });
    expect(await within(dialog).findByText('1 Aralık 2026')).toBeInTheDocument();
    expect(within(dialog).getByText('30 Nisan 2027')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Hizmeti Sonlandır' }));
    expect(await within(dialog).findByText('Gerekçe girin.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Gerekçe/), 'Sözleşme bitti');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hizmeti Sonlandır' }));
    await waitFor(() =>
      expect(
        requests.some(
          (r) => r.url.endsWith('/end-service') && !r.params.preview && r.method === 'POST',
        ),
      ).toBe(true),
    );
    const sent = requests.find((r) => r.url.endsWith('/end-service') && !r.params.preview)!;
    expect(sent.body).toMatchObject({ reason: 'Sözleşme bitti' });
  });

  it('kalıcı silme firma adı birebir yazılmadan açılmaz; Türkçe harf farkı kabul edilmez', async () => {
    signInAdmin();
    const requests = mockHttp((request) => {
      if (request.url === `/platform/companies/${COMPANY_ID}`) {
        return ok(
          detail({
            service: {
              state: 'deletion_pending',
              serviceEndedAt: '2025-01-01',
              viewUntil: '2025-01-31',
              retainUntil: '2025-06-30',
            },
          }),
        );
      }
      if (request.url === `/platform/companies/${COMPANY_ID}/delete`) {
        return ok(company({ deletionStatus: 'pending' }), 202);
      }
      return fail(404, 'NOT_FOUND', 'Yok');
    });
    const { router } = renderApp(`/yonetim/firmalar/${COMPANY_ID}/sil`);
    expect(await screen.findByText('Bu işlem geri döndürülemez')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: 'Kalıcı olarak sil' });
    const input = screen.getByLabelText(/Onay için firma adını yazın/);
    await userEvent.type(input, 'Inci Yapi');
    expect(submit).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'İnci Yapı');
    expect(submit).toBeEnabled();
    await userEvent.type(screen.getByLabelText(/Gerekçe/), 'Saklama süresi doldu');
    await userEvent.click(submit);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/yonetim/firmalar/${COMPANY_ID}`),
    );
    expect(requests.find((r) => r.url.endsWith('/delete'))?.body).toEqual({
      confirmName: 'İnci Yapı',
      reason: 'Saklama süresi doldu',
    });
  });

  it('saklama süresi dolmamış firmada kalıcı silme formu açılmaz', async () => {
    signInAdmin();
    mockHttp(() => ok(detail()));
    renderApp(`/yonetim/firmalar/${COMPANY_ID}/sil`);
    expect(await screen.findByText('Bu firma kalıcı olarak silinemez')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Kalıcı olarak sil' })).not.toBeInTheDocument();
  });
});
