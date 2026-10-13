import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { configureApiHandlers } from '../api/client';
import { keys } from '../api/queries';
import { useSession } from '../stores/session';
import { useUi } from '../stores/ui';

/** API istemcisinin oturum sonu, ilk şifre ve erişim değişikliği davranışlarını yönlendirmeye bağlar. */
export function ApiHandlers({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useEffect(() => {
    configureApiHandlers({
      onSessionExpired: () => {
        useUi.getState().setLoginNotice('Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
        queryClient.clear();
        void navigate('/giris', { replace: true });
      },
      onPasswordChangeRequired: () => {
        const { user, setUser } = useSession.getState();
        if (user) setUser({ ...user, mustChangePassword: true });
        void navigate('/ilk-sifre', { replace: true });
      },
      onAccessChanged: () => void queryClient.invalidateQueries({ queryKey: keys.me }),
    });
  }, [navigate, queryClient]);
  return <>{children}</>;
}

/** Oturumsuz kullanıcı girişe; geçici şifreli kullanıcı ilk şifre ekranına alınır (şartname 7.12). */
export function RequireSession() {
  const location = useLocation();
  const accessToken = useSession((state) => state.accessToken);
  const user = useSession((state) => state.user);
  if (!accessToken || !user) {
    return <Navigate to="/giris" replace state={{ from: location.pathname + location.search }} />;
  }
  if (user.mustChangePassword) return <Navigate to="/ilk-sifre" replace />;
  return <Outlet />;
}

/** Giriş yapmış kullanıcı giriş sayfasına gelirse uygulamaya yönlendirilir (şartname 5.1). */
export function GuestOnly({ children }: { children: ReactNode }) {
  const accessToken = useSession((state) => state.accessToken);
  const user = useSession((state) => state.user);
  if (accessToken && user) {
    return <Navigate to={user.mustChangePassword ? '/ilk-sifre' : '/uygulama'} replace />;
  }
  return <>{children}</>;
}
