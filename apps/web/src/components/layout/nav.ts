// Sol menü ve telefon alt menüsü (şartname 4.5, 5.2).

import {
  ArrowLeftRight,
  CalendarClock,
  FileText,
  Handshake,
  HardHat,
  LayoutDashboard,
  Search,
  Settings,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Yalnız tam eşleşmede seçili (Özet). */
  end?: boolean;
}

export const NAV_MAIN: NavItem[] = [
  { to: '/uygulama', label: 'Özet', icon: LayoutDashboard, end: true },
  { to: '/uygulama/projeler', label: 'Şantiyeler', icon: HardHat },
  { to: '/uygulama/islemler', label: 'İşlemler', icon: ArrowLeftRight },
  { to: '/uygulama/kisiler', label: 'Kişiler', icon: Users },
  { to: '/uygulama/anlasmalar', label: 'Anlaşmalar', icon: Handshake },
];

/** "Takip" grubu; Vadeler gecikmiş sayısı rozetiyle. */
export const NAV_TRACK: NavItem[] = [
  { to: '/uygulama/vadeler', label: 'Vadeler', icon: CalendarClock },
  { to: '/uygulama/raporlar', label: 'Raporlar', icon: FileText },
];

export const NAV_BOTTOM: NavItem[] = [
  { to: '/uygulama/silinenler', label: 'Silinenler', icon: Trash2 },
  { to: '/uygulama/ayarlar', label: 'Ayarlar', icon: Settings },
];

/** Telefonda alt menü: Özet, Şantiyeler, İşlemler, Kişiler, Diğer. */
export const PHONE_PRIMARY = NAV_MAIN.slice(0, 4);

/** "Diğer" sekmesi: Anlaşmalar, Vadeler, Raporlar, Ara, Silinenler, Ayarlar. */
export const PHONE_MORE: NavItem[] = [
  NAV_MAIN[4]!,
  ...NAV_TRACK,
  { to: '/uygulama/ara', label: 'Ara', icon: Search },
  ...NAV_BOTTOM,
];

/** Form sayfalarında yüzen + düğmesi formun kaydet düğmelerini örtmesin diye gizlenir. */
export function isFormPath(pathname: string): boolean {
  return /\/(yeni|duzenle|iade|odeme)$/.test(pathname);
}

export interface QuickContext {
  projectId?: string;
  agreementId?: string;
  partyId?: string;
}

/** "Yeni kayıt" açıldığı sayfanın bağlamını taşır (şartname 4.5). */
export function quickContextFrom(pathname: string): QuickContext {
  const id = '([a-f\\d]{24})';
  const project = new RegExp(`^/uygulama/projeler/${id}`).exec(pathname);
  if (project) return { projectId: project[1] };
  const agreement = new RegExp(`^/uygulama/anlasmalar/${id}`).exec(pathname);
  if (agreement) return { agreementId: agreement[1] };
  const party = new RegExp(`^/uygulama/kisiler/${id}`).exec(pathname);
  if (party) return { partyId: party[1] };
  return {};
}

export function quickLinks(context: QuickContext) {
  const params = (extra: Record<string, string>) => {
    const search = new URLSearchParams(extra);
    if (context.projectId) search.set('proje', context.projectId);
    if (context.partyId) search.set('kisi', context.partyId);
    if (context.agreementId) search.set('anlasma', context.agreementId);
    return search.toString();
  };
  const agreementParams = new URLSearchParams();
  if (context.projectId) agreementParams.set('proje', context.projectId);
  if (context.partyId) agreementParams.set('kisi', context.partyId);
  const agreementQuery = agreementParams.toString();
  return {
    income: `/uygulama/islemler/yeni?${params({ tur: 'gelir' })}`,
    expense: `/uygulama/islemler/yeni?${params({ tur: 'gider' })}`,
    agreement: `/uygulama/anlasmalar/yeni${agreementQuery ? `?${agreementQuery}` : ''}`,
  };
}
