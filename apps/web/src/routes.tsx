import { lazy, type ComponentType } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { GuestOnly, RequireSession } from './app/guards';
import { Lazy, Root } from './app/Root';
import { AdminGuestOnly, AdminShell } from './components/layout/AdminShell';
import { AppShell } from './components/layout/AppShell';

// Rota bazlı kod bölme (şartname 11).
function page<K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
): ComponentType {
  return lazy<ComponentType>(async () => ({ default: (await load())[name] }));
}

const LoginPage = page(() => import('./features/auth/LoginPage'), 'LoginPage');
const FirstPasswordPage = page(
  () => import('./features/auth/FirstPasswordPage'),
  'FirstPasswordPage',
);
const ForgotPasswordPage = page(
  () => import('./features/auth/ForgotPasswordPage'),
  'ForgotPasswordPage',
);
const DashboardPage = page(() => import('./features/dashboard/DashboardPage'), 'DashboardPage');
const ProjectListPage = page(
  () => import('./features/projects/ProjectListPage'),
  'ProjectListPage',
);
const ProjectFormPage = page(
  () => import('./features/projects/ProjectFormPage'),
  'ProjectFormPage',
);
const ProjectDetailPage = page(
  () => import('./features/projects/ProjectDetailPage'),
  'ProjectDetailPage',
);
const PartyListPage = page(() => import('./features/parties/PartyListPage'), 'PartyListPage');
const PartyFormPage = page(() => import('./features/parties/PartyFormPage'), 'PartyFormPage');
const PartyDetailPage = page(() => import('./features/parties/PartyDetailPage'), 'PartyDetailPage');
const TransactionListPage = page(
  () => import('./features/transactions/TransactionListPage'),
  'TransactionListPage',
);
const TransactionNewPage = page(
  () => import('./features/transactions/TransactionNewPage'),
  'TransactionNewPage',
);
const TransactionDetailPage = page(
  () => import('./features/transactions/TransactionDetailPage'),
  'TransactionDetailPage',
);
const TransactionEditPage = page(
  () => import('./features/transactions/TransactionEditPage'),
  'TransactionEditPage',
);
const RefundPage = page(() => import('./features/transactions/RefundPage'), 'RefundPage');
const AgreementListPage = page(
  () => import('./features/agreements/AgreementListPage'),
  'AgreementListPage',
);
const AgreementFormPage = page(
  () => import('./features/agreements/AgreementFormPage'),
  'AgreementFormPage',
);
const OpeningFormPage = page(
  () => import('./features/agreements/OpeningFormPage'),
  'OpeningFormPage',
);
const AgreementDetailPage = page(
  () => import('./features/agreements/AgreementDetailPage'),
  'AgreementDetailPage',
);
const AgreementPaymentPage = page(
  () => import('./features/transactions/TransactionNewPage'),
  'AgreementPaymentPage',
);
const DuesPage = page(() => import('./features/dues/DuesPage'), 'DuesPage');
const SearchPage = page(() => import('./features/search/SearchPage'), 'SearchPage');
const DeletedPage = page(() => import('./features/deleted/DeletedPage'), 'DeletedPage');
const ReportsPage = page(() => import('./features/reports/ReportsPage'), 'ReportsPage');
const ProjectReportPage = page(
  () => import('./features/reports/ProjectReportPage'),
  'ProjectReportPage',
);
const SettingsMenuPage = page(
  () => import('./features/settings/SettingsMenuPage'),
  'SettingsMenuPage',
);
const ProfilePage = page(() => import('./features/settings/ProfilePage'), 'ProfilePage');
const PasswordPage = page(() => import('./features/settings/PasswordPage'), 'PasswordPage');
const CompanySettingsPage = page(
  () => import('./features/settings/CompanySettingsPage'),
  'CompanySettingsPage',
);
const CategoriesPage = page(() => import('./features/settings/CategoriesPage'), 'CategoriesPage');
const AboutPage = page(() => import('./features/settings/AboutPage'), 'AboutPage');
const AdminLoginPage = page(() => import('./features/admin/AdminLoginPage'), 'AdminLoginPage');
const AdminSetupPage = page(() => import('./features/admin/AdminSetupPage'), 'AdminSetupPage');
const AdminSecurityPage = page(
  () => import('./features/admin/AdminSecurityPage'),
  'AdminSecurityPage',
);
const AdminHomePage = page(() => import('./features/admin/AdminHomePage'), 'AdminHomePage');
const AdminCompanyNewPage = page(
  () => import('./features/admin/AdminCompanyNewPage'),
  'AdminCompanyNewPage',
);
const AdminCompanyDetailPage = page(
  () => import('./features/admin/AdminCompanyDetailPage'),
  'AdminCompanyDetailPage',
);
const AdminCompanyDeletePage = page(
  () => import('./features/admin/AdminCompanyDeletePage'),
  'AdminCompanyDeletePage',
);
const NotFoundPage = page(() => import('./features/NotFoundPage'), 'NotFoundPage');
const DemoPlaceholderPage = page(() => import('./features/NotFoundPage'), 'DemoPlaceholderPage');

const el = (Component: ComponentType) => (
  <Lazy>
    <Component />
  </Lazy>
);

export const routes: RouteObject[] = [
  {
    element: <Root />,
    children: [
      // Tanıtım sitesi Adım 9'da; şimdilik kök giriş ekranına yönlendirir.
      { path: '/', element: <Navigate to="/giris" replace /> },
      {
        path: '/giris',
        element: <GuestOnly>{el(LoginPage)}</GuestOnly>,
      },
      { path: '/ilk-sifre', element: el(FirstPasswordPage) },
      { path: '/sifremi-unuttum', element: el(ForgotPasswordPage) },
      // Demo Adım 8'de; şimdilik "Demoyu dene" bağlantısı yer tutucuya gider.
      { path: '/demo', element: <GuestOnly>{el(DemoPlaceholderPage)}</GuestOnly> },
      {
        element: <RequireSession />,
        children: [
          {
            path: '/uygulama',
            element: <AppShell />,
            children: [
              { index: true, element: el(DashboardPage) },
              { path: 'projeler', element: el(ProjectListPage) },
              { path: 'projeler/yeni', element: el(ProjectFormPage) },
              { path: 'projeler/:id', element: el(ProjectDetailPage) },
              { path: 'projeler/:id/duzenle', element: el(ProjectFormPage) },
              { path: 'projeler/:id/rapor', element: el(ProjectReportPage) },
              { path: 'kisiler', element: el(PartyListPage) },
              { path: 'kisiler/yeni', element: el(PartyFormPage) },
              { path: 'kisiler/:id', element: el(PartyDetailPage) },
              { path: 'kisiler/:id/duzenle', element: el(PartyFormPage) },
              { path: 'islemler', element: el(TransactionListPage) },
              { path: 'islemler/yeni', element: el(TransactionNewPage) },
              { path: 'islemler/:id', element: el(TransactionDetailPage) },
              { path: 'islemler/:id/duzenle', element: el(TransactionEditPage) },
              { path: 'islemler/:id/iade', element: el(RefundPage) },
              { path: 'anlasmalar', element: el(AgreementListPage) },
              { path: 'anlasmalar/yeni', element: el(AgreementFormPage) },
              { path: 'anlasmalar/baslangic/yeni', element: el(OpeningFormPage) },
              { path: 'anlasmalar/:id', element: el(AgreementDetailPage) },
              { path: 'anlasmalar/:id/odeme', element: el(AgreementPaymentPage) },
              { path: 'vadeler', element: el(DuesPage) },
              { path: 'raporlar', element: el(ReportsPage) },
              { path: 'ara', element: el(SearchPage) },
              { path: 'silinenler', element: el(DeletedPage) },
              { path: 'ayarlar', element: el(SettingsMenuPage) },
              { path: 'ayarlar/profil', element: el(ProfilePage) },
              { path: 'ayarlar/sifre', element: el(PasswordPage) },
              { path: 'ayarlar/firma', element: el(CompanySettingsPage) },
              { path: 'ayarlar/kategoriler', element: el(CategoriesPage) },
              { path: 'ayarlar/hakkinda', element: el(AboutPage) },
              { path: '*', element: el(NotFoundPage) },
            ],
          },
        ],
      },
      // Ürün sahibi yönetimi (şartname 5.3): ayrı oturum; müşteri oturumundan bağımsızdır.
      { path: '/yonetim/giris', element: <AdminGuestOnly>{el(AdminLoginPage)}</AdminGuestOnly> },
      { path: '/yonetim/guvenlik-kurulumu', element: el(AdminSetupPage) },
      {
        path: '/yonetim',
        element: <AdminShell />,
        children: [
          { index: true, element: el(AdminHomePage) },
          { path: 'guvenlik', element: el(AdminSecurityPage) },
          { path: 'firmalar/yeni', element: el(AdminCompanyNewPage) },
          { path: 'firmalar/:id', element: el(AdminCompanyDetailPage) },
          { path: 'firmalar/:id/sil', element: el(AdminCompanyDeletePage) },
          { path: '*', element: el(NotFoundPage) },
        ],
      },
      { path: '*', element: el(NotFoundPage) },
    ],
  },
];
