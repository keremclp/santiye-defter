import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '../routes';
import { useSession } from '../stores/session';

export const TEST_USER = {
  id: 'f'.repeat(24),
  name: 'Ayşe Yılmaz',
  username: 'ayse',
  companyId: 'c'.repeat(24),
  mustChangePassword: false,
};

export function signIn(user = TEST_USER) {
  useSession.getState().setSession({
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
    user,
    company: { displayName: 'Deneme İnşaat' },
    service: { state: 'active', serviceEndedAt: null, viewUntil: null, retainUntil: null },
  });
}

/** Uygulamayı verilen adreste bellek içi yönlendiriciyle açar. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return { router, ...render(<RouterProvider router={router} />) };
}
