import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { apiPost, isApiError } from '../../api/client';
import { useMe } from '../../api/queries';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatLongDate } from '../../lib/format';
import { useSession } from '../../stores/session';
import { useUi } from '../../stores/ui';
import { Button, ButtonLink } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Toasts } from '../ui/Toasts';
import { NAV_ITEMS, PHONE_MORE, PHONE_PRIMARY, quickContextFrom, quickLinks } from './nav';

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="nav-list">
      {NAV_ITEMS.map((item) => (
        <li key={item.to}>
          <NavLink className="nav-link" to={item.to} end={item.end} onClick={onNavigate}>
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return async () => {
    const { refreshToken, clear } = useSession.getState();
    try {
      await apiPost('/auth/logout', refreshToken ? { refreshToken } : {});
    } catch {
      // Çıkış sunucuya ulaşmasa da bu cihazdaki oturum kapatılır.
    }
    clear();
    queryClient.clear();
    void navigate('/giris', { replace: true });
  };
}

function NavPanel({ onNavigate }: { onNavigate?: () => void }) {
  const user = useSession((state) => state.user);
  const companyName = useSession((state) => state.companyName);
  const logout = useLogout();
  return (
    <>
      <div className="nav-brand">
        <Link className="nav-brand__name" to="/uygulama" onClick={onNavigate}>
          Şantiye Hesap
        </Link>
        {companyName ? <span className="nav-brand__company">{companyName}</span> : null}
      </div>
      <nav aria-label="Ana menü">
        <NavLinks onNavigate={onNavigate} />
      </nav>
      <div className="nav-user">
        <span>{user?.name}</span>
        <Button variant="ghost" size="small" onClick={() => void logout()}>
          Çıkış yap
        </Button>
      </div>
    </>
  );
}

/** Görüntüleme dönemi bandı ve bağlantı durumu her sayfada görünür (şartname 9.10, 11). */
function Banners() {
  const service = useSession((state) => state.service);
  const offline = useUi((state) => state.offline);
  return (
    <>
      {service?.state === 'view_only' ? (
        <div className="banner" role="status">
          Hizmetiniz sona erdi.
          {service.viewUntil
            ? ` Kayıtlarınızı ${formatLongDate(service.viewUntil)} tarihine kadar görüntüleyip dışa aktarabilirsiniz.`
            : ' Kayıtları görüntüleyip dışa aktarabilirsiniz.'}{' '}
          Değişiklik düğmeleri kapalıdır.
        </div>
      ) : null}
      {offline ? (
        <div className="banner banner--offline" role="alert">
          Bağlantı hatası. İnternetinizi kontrol edin. Bağlantı yokken yeni kayıt sunucuya ulaşmaz.
        </div>
      ) : null}
    </>
  );
}

function QuickAddDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  const links = quickLinks(quickContextFrom(location.pathname));
  const { canWrite, reason } = useWriteAccess();
  return (
    <Dialog open={open} title="Yeni kayıt" onClose={onClose}>
      {canWrite ? (
        <div className="sheet-list">
          <ButtonLink variant="income" block to={links.income} onClick={onClose}>
            Gelir ekle
          </ButtonLink>
          <ButtonLink variant="expense" block to={links.expense} onClick={onClose}>
            Gider ekle
          </ButtonLink>
          <ButtonLink variant="secondary" block to={links.agreement} onClick={onClose}>
            Anlaşma ekle
          </ButtonLink>
        </div>
      ) : (
        <p>{reason}</p>
      )}
    </Dialog>
  );
}

function MoreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} title="Diğer" onClose={onClose}>
      <ul className="nav-list">
        {PHONE_MORE.map((item) => (
          <li key={item.to}>
            <NavLink className="nav-link" to={item.to} onClick={onClose}>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

function BottomNav() {
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const moreActive = PHONE_MORE.some((item) => location.pathname.startsWith(item.to));
  const [first, second, third, fourth] = PHONE_PRIMARY;
  const link = (item: typeof first) =>
    item ? (
      <NavLink className="bottom-nav__link" to={item.to} end={item.end}>
        <span className="bottom-nav__icon" aria-hidden="true">
          {item.icon}
        </span>
        {item.label}
      </NavLink>
    ) : null;

  return (
    <>
      <nav className="bottom-nav" aria-label="Alt menü">
        {link(first)}
        {link(second)}
        <button
          type="button"
          className="bottom-nav__add"
          aria-haspopup="dialog"
          onClick={() => setQuickOpen(true)}
        >
          <span className="bottom-nav__add-plus" aria-hidden="true">
            +
          </span>
          Kayıt
        </button>
        {link(third)}
        {link(fourth)}
        <button
          type="button"
          className="bottom-nav__link"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={moreActive ? 'page' : undefined}
          onClick={() => setMoreOpen(true)}
        >
          <span className="bottom-nav__icon" aria-hidden="true">
            ⋯
          </span>
          Diğer
        </button>
      </nav>
      <QuickAddDialog open={quickOpen} onClose={() => setQuickOpen(false)} />
      <MoreDialog open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      <aside className="drawer" aria-label="Menü">
        <NavPanel onNavigate={onClose} />
      </aside>
    </>
  );
}

/** Firma bilgisi ve hizmet durumu her açılışta yenilenir; ağ hatasında kayıtlı oturum kalır. */
function useSessionRefresh() {
  const me = useMe();
  const setCompany = useSession((state) => state.setCompany);
  const setUser = useSession((state) => state.setUser);
  useEffect(() => {
    if (!me.data) return;
    setCompany(me.data.company, me.data.service);
    setUser(me.data.user);
  }, [me.data, setCompany, setUser]);
  return me.error && isApiError(me.error) && me.error.code === 'ACCESS_CLOSED' ? me.error : null;
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const companyName = useSession((state) => state.companyName);
  const closedError = useSessionRefresh();
  const logout = useLogout();

  if (closedError) {
    return (
      <div className="auth-layout">
        <div className="auth-card" role="alert">
          <p className="auth-card__brand">Şantiye Hesap</p>
          <h1>Erişim kapalı</h1>
          <p>{closedError.message}</p>
          <p className="meta">Kayıtlarınız silinmiş değildir.</p>
          <Button variant="secondary" onClick={() => void logout()}>
            Çıkış yap
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Menü">
        <NavPanel />
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn topbar__menu"
            aria-label="Menüyü aç"
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
          <Link className="topbar__brand" to="/uygulama">
            Şantiye Hesap
          </Link>
          <span className="topbar__company">{companyName}</span>
        </header>
        <Banners />
        <Outlet />
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomNav />
      <Toasts />
    </div>
  );
}
