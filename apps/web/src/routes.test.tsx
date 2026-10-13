import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { useSession } from './stores/session';
import { fail, mockHttp, ok } from './test/http-mock';
import { renderApp, signIn, TEST_USER } from './test/render-app';

afterEach(() => useSession.getState().clear());

describe('rotalar ve oturum', () => {
  it('oturumsuz kullanıcı uygulamadan girişe alınır', async () => {
    mockHttp(() => ok({}));
    const { router } = renderApp('/uygulama/islemler');
    expect(await screen.findByRole('heading', { name: 'Giriş' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/giris');
  });

  it('giriş yapmış kullanıcı giriş sayfasından uygulamaya yönlendirilir', async () => {
    signIn();
    mockHttp(() => ok({}));
    const { router } = renderApp('/giris');
    await waitFor(() => expect(router.state.location.pathname).toBe('/uygulama'));
  });

  it('geçici şifreli kullanıcı ilk şifre ekranından başka yere geçemez', async () => {
    signIn({ ...TEST_USER, mustChangePassword: true });
    mockHttp(() => ok({}));
    const { router } = renderApp('/uygulama/projeler');
    expect(
      await screen.findByRole('heading', { name: 'Kişisel şifrenizi oluşturun' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ilk-sifre');
  });
});

describe('giriş formu', () => {
  it('boş gönderimde alan hataları; yanlış bilgide hangi alanın yanlış olduğunu söylemeyen mesaj', async () => {
    const requests = mockHttp(() => fail(401, 'UNAUTHORIZED', 'Kullanıcı adı veya şifre hatalı'));
    renderApp('/giris');
    const submit = await screen.findByRole('button', { name: 'Giriş Yap' });
    await userEvent.click(submit);
    expect(await screen.findByText('Kullanıcı adını girin.')).toBeInTheDocument();
    expect(screen.getByText('Şifreyi girin.')).toBeInTheDocument();
    expect(requests).toHaveLength(0);

    await userEvent.type(screen.getByLabelText(/Kullanıcı adı/), 'ayse');
    await userEvent.type(screen.getByLabelText(/Şifre/), 'yanlis-sifre');
    await userEvent.click(submit);
    expect(await screen.findByText('Kullanıcı adı veya şifre hatalı')).toBeInTheDocument();
    expect(requests[0]?.body).toEqual({ username: 'ayse', password: 'yanlis-sifre' });
    expect(screen.getByRole('link', { name: 'Demoyu Dene' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Şifremi unuttum' })).toBeInTheDocument();
  });

  it('geçici şifreyle giriş ilk şifre ekranına, kişisel şifre kaydı özete götürür', async () => {
    mockHttp((request) => {
      if (request.url === '/auth/login') {
        return ok({
          accessToken: 'a1',
          refreshToken: 'r1',
          user: { ...TEST_USER, mustChangePassword: true },
          mustChangePassword: true,
          company: { displayName: 'Deneme İnşaat' },
          service: { state: 'active', serviceEndedAt: null, viewUntil: null, retainUntil: null },
        });
      }
      if (request.url === '/auth/password') {
        return ok({ user: TEST_USER, accessToken: 'a2', refreshToken: 'r2' });
      }
      return fail(404, 'NOT_FOUND', 'Yok');
    });
    const { router } = renderApp('/giris');
    await userEvent.type(await screen.findByLabelText(/Kullanıcı adı/), 'ayse');
    await userEvent.type(screen.getByLabelText(/Şifre/), 'Gecici-1234');
    await userEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));
    await screen.findByRole('heading', { name: 'Kişisel şifrenizi oluşturun' });

    await userEvent.type(screen.getByLabelText(/Geçici şifre/), 'Gecici-1234');
    await userEvent.type(screen.getByLabelText(/^Yeni şifre\*?$/), 'Kisisel-5678');
    await userEvent.type(screen.getByLabelText(/tekrar/), 'Kisisel-5678');
    await userEvent.click(screen.getByRole('button', { name: 'Şifremi Kaydet' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/uygulama'));
    expect(useSession.getState().accessToken).toBe('a2');
  });
});
