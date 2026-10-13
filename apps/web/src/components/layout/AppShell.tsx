import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Handshake,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Search,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { apiPost, isApiError } from '../../api/client';
import { useDues, useMe } from '../../api/queries';
import { useWriteAccess } from '../../hooks/useWriteAccess';
import { formatLongDate } from '../../lib/format';
import { useSession } from '../../stores/session';
import { useUi } from '../../stores/ui';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import { Toasts } from '../ui/Toasts';
import {
  isFormPath,
  NAV_BOTTOM,
  NAV_MAIN,
  NAV_TRACK,
  PHONE_MORE,
  PHONE_PRIMARY,
  quickContextFrom,
  quickLinks,
  type NavItem,
} from './nav';

/** Gecikmiş vade sayısı (ödenecek + tahsil edilecek); menüdeki Vadeler rozeti için. */
function useOverdueCount(): number {
  const payable = useDues({ direction: 'payable', group: 'overdue', limit: 1 });
  const receivable = useDues({ direction: 'receivable', group: 'overdue', limit: 1 });
  return (payable.data?.total ?? 0) + (receivable.data?.total ?? 0);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('tr'))
    .join('');
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

function NavItemLink({
  item,
  count,
  onNavigate,
}: {
  item: NavItem;
  count?: number;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <NavLink className="nav-link" to={item.to} end={item.end} onClick={onNavigate}>
        <Icon icon={item.icon} />
        <span>{item.label}</span>
        {count ? (
          <span className="nav-link__count" aria-label={`${count} gecikmiş vade`}>
            {count}
          </span>
        ) : null}
      </NavLink>
    </li>
  );
}

/** Kenar menü: marka, ana grup, "Takip" grubu, altta Silinenler, Ayarlar ve kullanıcı kartı. */
function NavPanel({ onNavigate }: { onNavigate?: () => void }) {
  const user = useSession((state) => state.user);
  const companyName = useSession((state) => state.companyName);
  const overdue = useOverdueCount();
  const logout = useLogout();
  return (
    <div className="nav-panel">
      <Link className="nav-brand" to="/uygulama" onClick={onNavigate}>
        <span className="nav-brand__mark" aria-hidden="true">
          ŞH
        </span>
        <span className="nav-brand__text">
          <span className="nav-brand__name">Şantiye Hesap</span>
          {companyName ? <span className="nav-brand__company">{companyName}</span> : null}
        </span>
      </Link>
      <nav aria-label="Ana menü" className="stack stack--lg">
        <ul className="nav-group">
          {NAV_MAIN.map((item) => (
            <NavItemLink key={item.to} item={item} onNavigate={onNavigate} />
          ))}
        </ul>
        <ul className="nav-group" aria-label="Takip">
          <li className="nav-group__label" aria-hidden="true">
            Takip
          </li>
          {NAV_TRACK.map((item) => (
            <NavItemLink
              key={item.to}
              item={item}
              count={item.to === '/uygulama/vadeler' ? overdue : undefined}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>
      <div className="nav-spacer" />
      <ul className="nav-group" aria-label="Diğer">
        {NAV_BOTTOM.map((item) => (
          <NavItemLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </ul>
      <div className="nav-user">
        <span className="nav-user__avatar" aria-hidden="true">
          {initials(user?.name ?? '')}
        </span>
        <span className="nav-user__text">
          <span className="nav-user__name">{user?.name}</span>
          {companyName ? <span className="nav-user__company">{companyName}</span> : null}
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

/**
 * "Yeni kayıt" açılır menüsü: Gelir ekle, Gider ekle, Anlaşma ekle. Üst çubukta düğme, telefonda
 * yüzen + düğmesi aynı menüyü açar; açıldığı sayfanın şantiye/anlaşma bağlamı hazır seçilir.
 */
function NewRecordMenu({ trigger }: { trigger: 'topbar' | 'fab' }) {
  const location = useLocation();
  const links = quickLinks(quickContextFrom(location.pathname));
  const { canWrite, reason } = useWriteAccess();
  const items = [
    {
      to: links.income,
      icon: ArrowDownLeft,
      tone: 'income',
      label: 'Gelir ekle',
      hint: 'Tahsilat veya doğrudan gelir',
    },
    {
      to: links.expense,
      icon: ArrowUpRight,
      tone: 'expense',
      label: 'Gider ekle',
      hint: 'Ödeme veya doğrudan gider',
    },
    {
      to: links.agreement,
      icon: Handshake,
      tone: 'primary',
      label: 'Anlaşma ekle',
      hint: 'Ödenecek veya tahsil edilecek',
    },
  ] as const;
  const fab = trigger === 'fab';

  return (
    <Menu
      label="Yeni kayıt"
      wrapClassName={fab ? 'fab-wrap' : 'topbar__new'}
      buttonClassName={fab ? 'fab' : 'btn btn--primary'}
      buttonLabel={fab ? 'Yeni kayıt' : undefined}
      placement={fab ? 'up' : 'down'}
      buttonContent={
        <>
          <Icon icon={Plus} />
          {fab ? null : (
            <>
              Yeni kayıt
              <Icon icon={ChevronDown} />
            </>
          )}
        </>
      }
    >
      {(close) =>
        canWrite ? (
          items.map((item) => (
            <Link
              key={item.label}
              className="dropdown__item"
              role="menuitem"
              to={item.to}
              onClick={close}
            >
              <span className={`icon-box icon-box--md icon-box--${item.tone}`}>
                <Icon icon={item.icon} />
              </span>
              <span>
                {item.label}
                <small>{item.hint}</small>
              </span>
            </Link>
          ))
        ) : (
          <p className="dropdown__note" role="menuitem" tabIndex={-1}>
            {reason}
          </p>
        )
      }
    </Menu>
  );
}

/** Genel arama: sonuçlar `/uygulama/ara` sayfasında; `/` kısayolu kutuya odaklanır. */
function GlobalSearch() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      input.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = text.trim();
    void navigate(q ? `/uygulama/ara?${new URLSearchParams({ q })}` : '/uygulama/ara');
  }

  return (
    <form className="topbar__search" role="search" onSubmit={submit}>
      <label className="search-box">
        <Icon icon={Search} />
        <input
          ref={input}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Şantiye, kişi, tutar veya kayıt no ara"
          aria-label="Genel arama"
          enterKeyHint="search"
        />
        <kbd aria-hidden="true">/</kbd>
      </label>
    </form>
  );
}

function MoreDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} title="Diğer" onClose={onClose}>
      <ul className="sheet-list">
        {PHONE_MORE.map((item) => (
          <NavItemLink key={item.to} item={item} onNavigate={onClose} />
        ))}
      </ul>
    </Dialog>
  );
}

/** Telefonda alt menü: Özet, Şantiyeler, İşlemler, Kişiler, Diğer. */
function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const moreActive = PHONE_MORE.some((item) => location.pathname.startsWith(item.to));

  return (
    <>
      <nav className="bottom-nav" aria-label="Alt menü">
        {PHONE_PRIMARY.map((item) => (
          <NavLink key={item.to} className="bottom-nav__link" to={item.to} end={item.end}>
            <Icon icon={item.icon} />
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          className="bottom-nav__link"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={moreActive ? 'page' : undefined}
          onClick={() => setMoreOpen(true)}
        >
          <Icon icon={MenuIcon} />
          Diğer
        </button>
      </nav>
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
  const location = useLocation();
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
            <Icon icon={MenuIcon} />
          </button>
          <GlobalSearch />
          <div className="topbar__grow" />
          <NewRecordMenu trigger="topbar" />
        </header>
        <Banners />
        <Outlet />
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <BottomNav />
      {isFormPath(location.pathname) ? null : <NewRecordMenu trigger="fab" />}
      <Toasts />
    </div>
  );
}
