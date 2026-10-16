import { useQueryClient } from '@tanstack/react-query';
import { Building2, LogOut, Menu as MenuIcon, Plus, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { adminPost, configureAdminHandlers } from '../../api/admin-client';
import { useAdminSession } from '../../stores/admin-session';
import { useUi } from '../../stores/ui';
import { Icon } from '../ui/Icon';
import { Toasts } from '../ui/Toasts';

const NAV = [
  { to: '/yonetim', label: 'İşletim özeti', icon: Building2, end: true },
  { to: '/yonetim/firmalar/yeni', label: 'Yeni firma', icon: Plus, end: true },
  { to: '/yonetim/guvenlik', label: 'Güvenlik', icon: ShieldCheck, end: true },
];

function useAdminLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    const { refreshToken, clear } = useAdminSession.getState();
    try {
      await adminPost('/platform/auth/logout', refreshToken ? { refreshToken } : {});
    } catch {
      // Sunucuya ulaşılamasa da bu cihazdaki oturum kapatılır.
    }
    clear();
    queryClient.clear();
    void navigate('/yonetim/giris', { replace: true });
  };
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const admin = useAdminSession((state) => state.admin);
  const logout = useAdminLogout();
  return (
    <div className="nav-panel">
      <Link className="nav-brand" to="/yonetim" onClick={onNavigate}>
        <span className="nav-brand__mark" aria-hidden="true">
          ŞH
        </span>
        <span className="nav-brand__text">
          <span className="nav-brand__name">Şantiye Hesap</span>
          <span className="admin-mark">Yönetim</span>
        </span>
      </Link>
      <nav aria-label="Yönetim menüsü">
        <ul className="nav-group">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink className="nav-link" to={item.to} end={item.end} onClick={onNavigate}>
                <Icon icon={item.icon} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="nav-spacer" />
      <p className="admin-nav__note">
        Ürün sahibi alanı. Müşterilerin finansal kayıtları burada görünmez.
      </p>
      <div className="nav-user">
        <span className="nav-user__avatar" aria-hidden="true">
          {(admin?.username ?? '').slice(0, 2).toLocaleUpperCase('tr')}
        </span>
        <span className="nav-user__text">
          <span className="nav-user__name">{admin?.username}</span>
          <span className="nav-user__company">Ürün sahibi</span>
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Çıkış yap"
          title="Çıkış yap"
          onClick={() => void logout()}
        >
          <Icon icon={LogOut} />
        </button>
      </div>
    </div>
  );
}

function AdminDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer admin-nav" aria-label="Menü">
        <AdminNav onNavigate={onClose} />
      </aside>
    </>
  );
}

/**
 * Yönetim alanı kabuğu (şartname 5.3): müşteri uygulamasıyla aynı tasarım sistemi; lacivert menü ve
 * "Yönetim" işaretiyle ayrılır. Telefonda üst çubuktaki menü düğmesi drawer açar.
 */
export function AdminShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAdminSession((state) => state.accessToken);
  const admin = useAdminSession((state) => state.admin);
  const offline = useUi((state) => state.offline);

  useEffect(() => {
    configureAdminHandlers(() => void navigate('/yonetim/giris', { replace: true }));
  }, [navigate]);

  if (!accessToken || !admin) {
    return <Navigate to="/yonetim/giris" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="app-shell app-shell--admin">
      <aside className="sidebar admin-nav" aria-label="Menü">
        <AdminNav />
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn topbar__menu"
            aria-label="Menüyü aç"
            onClick={() => setDrawerOpen(true)}
          >
            <Icon icon={MenuIcon} />
          </button>
          <span className="badge badge--cyan">
            <Icon icon={ShieldCheck} />
            Yönetim alanı
          </span>
          <span className="meta hide-mobile">Ürün sahibi: {admin.username}</span>
        </header>
        {offline ? (
          <div className="banner banner--offline" role="alert">
            Bağlantı hatası. İnternetinizi kontrol edin.
          </div>
        ) : null}
        <Outlet />
      </div>
      <AdminDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <Toasts />
    </div>
  );
}

/** Oturumlu ürün sahibi giriş sayfasına gelirse yönetim alanına alınır. */
export function AdminGuestOnly({ children }: { children: ReactNode }) {
  const accessToken = useAdminSession((state) => state.accessToken);
  const admin = useAdminSession((state) => state.admin);
  if (accessToken && admin) return <Navigate to="/yonetim" replace />;
  return <>{children}</>;
}
