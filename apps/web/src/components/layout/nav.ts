// Sol menü ve telefon alt menüsü (şartname 5.2).

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Yalnız tam eşleşmede seçili (Özet). */
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/uygulama', label: 'Özet', icon: '◎', end: true },
  { to: '/uygulama/projeler', label: 'Şantiyeler', icon: '▦' },
  { to: '/uygulama/islemler', label: 'İşlemler', icon: '⇅' },
  { to: '/uygulama/kisiler', label: 'Kişiler', icon: '☺' },
  { to: '/uygulama/anlasmalar', label: 'Anlaşmalar', icon: '✎' },
  { to: '/uygulama/vadeler', label: 'Vadeler', icon: '◷' },
  { to: '/uygulama/raporlar', label: 'Raporlar', icon: '▤' },
  { to: '/uygulama/ara', label: 'Ara', icon: '⌕' },
  { to: '/uygulama/silinenler', label: 'Silinenler', icon: '⌫' },
  { to: '/uygulama/ayarlar', label: 'Ayarlar', icon: '⚙' },
];

/** Telefonda alt menü: Özet, Şantiyeler, İşlemler, Kişiler, Diğer. */
export const PHONE_PRIMARY = NAV_ITEMS.slice(0, 4);
/** "Diğer" sekmesi. */
export const PHONE_MORE = NAV_ITEMS.slice(4);

export interface QuickContext {
  projectId?: string;
  agreementId?: string;
  partyId?: string;
}

/** "+ Kayıt" açıldığı sayfanın bağlamını taşır (şartname 4.5). */
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
