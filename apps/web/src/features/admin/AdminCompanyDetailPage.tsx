import {
  Archive,
  Building2,
  CalendarClock,
  ChevronDown,
  Database,
  Ellipsis,
  HardDrive,
  History,
  KeyRound,
  Pause,
  Pencil,
  Play,
  Power,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRoundCheck,
  UserRoundX,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { usePlatformCompany } from '../../api/admin-queries';
import type {
  PlatformCompany,
  PlatformCompanyDetail,
  PlatformLogChange,
  PlatformLogEntry,
  PlatformUser,
} from '../../api/admin-types';
import { Badge } from '../../components/ui/Amount';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Metric, PageHeader, Panel } from '../../components/ui/Card';
import { Icon } from '../../components/ui/Icon';
import { Menu } from '../../components/ui/Menu';
import { QueryView, Refreshing } from '../../components/ui/States';
import { usePageMeta } from '../../hooks/usePageMeta';
import {
  DELETION_STATUS_LABEL,
  PLATFORM_FIELD_LABEL,
  PLATFORM_STATE_LABEL,
  platformActionLabel,
} from '../../lib/admin-labels';
import { formatBytes, formatDateTime, formatLongDate } from '../../lib/format';
import { useAdminSession } from '../../stores/admin-session';
import { CompanyStateBadge, StorageText } from './admin-parts';
import { companyState, usagePercent } from './admin-utils';
import {
  EditCompanyDialog,
  EndServiceDialog,
  ExtendRetentionDialog,
  QuotaDialog,
  ReopenDialog,
  SuspendDialog,
} from './CompanyDialogs';
import {
  AddUserDialog,
  EditUserDialog,
  ResetPasswordDialog,
  ToggleUserDialog,
} from './UserDialogs';

type CompanyDialog = 'edit' | 'quota' | 'suspend' | 'end' | 'reopen' | 'extend' | 'addUser';
type UserDialog = 'editUser' | 'reset' | 'toggle';
type OpenDialog = { kind: CompanyDialog } | { kind: UserDialog; userId: string } | null;

/** Firma detay (şartname 5.3, 7.13): kullanıcılar, depolama, hizmet durumu, işletim geçmişi. */
export function AdminCompanyDetailPage() {
  const { id = '' } = useParams();
  const query = usePlatformCompany(id);
  usePageMeta(query.data?.company.name ?? 'Firma');
  return (
    <main className="page">
      <QueryView query={query}>
        {(data) => <CompanyDetail data={data} refreshing={query.isFetching} />}
      </QueryView>
    </main>
  );
}

function CompanyDetail({ data, refreshing }: { data: PlatformCompanyDetail; refreshing: boolean }) {
  const { company, users, contents, history } = data;
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const close = () => setDialog(null);
  const modifiable = company.deletionStatus === 'none';
  const ended = company.service.serviceEndedAt !== null;
  const canDelete =
    (modifiable && company.service.state === 'deletion_pending') ||
    company.deletionStatus === 'failed';
  const dialogUser =
    dialog && 'userId' in dialog ? users.find((user) => user.id === dialog.userId) : undefined;
  const activeUsers = users.filter((user) => user.isActive).length;

  const actions: { kind: CompanyDialog; label: string; icon: LucideIcon; show: boolean }[] = [
    { kind: 'edit', label: 'Firmayı düzenle', icon: Pencil, show: modifiable },
    { kind: 'quota', label: 'Kapasiteyi değiştir', icon: HardDrive, show: modifiable },
    {
      kind: 'suspend',
      label: company.isSuspended ? 'Geçici durdurmayı kaldır' : 'Geçici olarak durdur',
      icon: company.isSuspended ? Play : Pause,
      show: modifiable,
    },
    { kind: 'end', label: 'Hizmeti sonlandır', icon: Power, show: modifiable && !ended },
    { kind: 'reopen', label: 'Yeniden aç', icon: RotateCcw, show: modifiable && ended },
    { kind: 'extend', label: 'Arşiv saklamasını uzat', icon: Archive, show: modifiable && ended },
  ];

  return (
    <>
      <PageHeader
        title={company.name}
        subtitle={
          <span className="row">
            <CompanyStateBadge {...companyState(company)} />
            {company.isSuspended && company.service.state !== 'suspended' ? (
              <Badge tone="warn">Geçici durdurulmuş</Badge>
            ) : null}
            <span>Açılış {formatDateTime(company.createdAt)}</span>
          </span>
        }
        back={{ to: '/yonetim', label: 'İşletim özeti' }}
        actions={
          <>
            <Refreshing active={refreshing} />
            {modifiable ? (
              <Button onClick={() => setDialog({ kind: 'addUser' })}>
                <Icon icon={UserPlus} />
                Kullanıcı ekle
              </Button>
            ) : null}
            {canDelete ? (
              <ButtonLink variant="danger" to={`/yonetim/firmalar/${company.id}/sil`}>
                <Icon icon={Trash2} />
                {company.deletionStatus === 'failed' ? 'Silmeyi yeniden başlat' : 'Kalıcı silme'}
              </ButtonLink>
            ) : null}
            {modifiable ? (
              <Menu
                label="Diğer işlemler"
                buttonClassName="btn btn--secondary"
                buttonContent={
                  <>
                    <Icon icon={Ellipsis} />
                    Diğer
                    <Icon icon={ChevronDown} />
                  </>
                }
              >
                {(closeMenu) =>
                  actions
                    .filter((action) => action.show)
                    .map((action) => (
                      <button
                        key={action.kind}
                        type="button"
                        className="dropdown__item"
                        role="menuitem"
                        onClick={() => {
                          closeMenu();
                          setDialog({ kind: action.kind });
                        }}
                      >
                        <Icon icon={action.icon} />
                        {action.label}
                      </button>
                    ))
                }
              </Menu>
            ) : null}
          </>
        }
      />

      <DeletionNotice company={company} />

      <div className="metrics metrics--report">
        <Metric
          label="Kullanıcılar"
          icon={Users}
          tone="primary"
          value={company.userCount}
          sub={`${activeUsers} aktif`}
        />
        <Metric
          label="Belge alanı"
          icon={HardDrive}
          tone={company.storage.usedBytes >= company.storage.quotaBytes ? 'expense' : 'neutral'}
          value={formatBytes(company.storage.usedBytes)}
          sub={`Kapasite ${formatBytes(company.storage.quotaBytes)} · kullanım %${usagePercent(
            company.storage.usedBytes,
            company.storage.quotaBytes,
          )}`}
        />
        <Metric
          label="Hizmet"
          icon={ShieldCheck}
          tone={company.service.state === 'active' ? 'income' : 'neutral'}
          value={
            <span className="metric__text">
              {company.deletionStatus !== 'none'
                ? DELETION_STATUS_LABEL[company.deletionStatus]
                : PLATFORM_STATE_LABEL[company.service.state]}
            </span>
          }
          sub={
            company.service.serviceEndedAt
              ? `Hizmet sonu ${formatLongDate(company.service.serviceEndedAt)}`
              : 'Hizmet sonu tarihi yok'
          }
        />
      </div>

      <div className="dash-grid">
        <div className="dash-col">
          <UsersPanel
            users={users}
            modifiable={modifiable}
            onAction={(kind, userId) => setDialog({ kind, userId })}
            onAdd={() => setDialog({ kind: 'addUser' })}
          />
          <InfoPanel company={company} />
        </div>
        <div className="dash-col">
          <ServicePanel
            company={company}
            modifiable={modifiable}
            onAction={(kind) => setDialog({ kind })}
          />
          <StoragePanel
            company={company}
            modifiable={modifiable}
            onQuota={() => setDialog({ kind: 'quota' })}
          />
          <Panel title="Kayıt sayıları" icon={Database}>
            <div className="panel__body stack stack--sm">
              <dl className="definition-list">
                <dt>Hareket</dt>
                <dd>{contents.transactions}</dd>
                <dt>Anlaşma ve başlangıç kaydı</dt>
                <dd>{contents.agreements}</dd>
                <dt>Şantiye</dt>
                <dd>{contents.projects}</dd>
                <dt>Kişi</dt>
                <dd>{contents.parties}</dd>
                <dt>Belge</dt>
                <dd>{contents.documents}</dd>
              </dl>
              <p className="meta">
                Silinmiş ama geri alınabilir kayıtlar dahil. Kayıtların kendisi bu alanda görünmez.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <HistoryPanel history={history} users={users} />

      {dialog?.kind === 'edit' ? <EditCompanyDialog company={company} onClose={close} /> : null}
      {dialog?.kind === 'quota' ? <QuotaDialog company={company} onClose={close} /> : null}
      {dialog?.kind === 'suspend' ? <SuspendDialog company={company} onClose={close} /> : null}
      {dialog?.kind === 'end' ? <EndServiceDialog company={company} onClose={close} /> : null}
      {dialog?.kind === 'reopen' ? <ReopenDialog company={company} onClose={close} /> : null}
      {dialog?.kind === 'extend' ? (
        <ExtendRetentionDialog company={company} onClose={close} />
      ) : null}
      {dialog?.kind === 'addUser' ? <AddUserDialog companyId={company.id} onClose={close} /> : null}
      {dialog?.kind === 'editUser' && dialogUser ? (
        <EditUserDialog user={dialogUser} onClose={close} />
      ) : null}
      {dialog?.kind === 'reset' && dialogUser ? (
        <ResetPasswordDialog user={dialogUser} onClose={close} />
      ) : null}
      {dialog?.kind === 'toggle' && dialogUser ? (
        <ToggleUserDialog user={dialogUser} onClose={close} />
      ) : null}
    </>
  );
}

function DeletionNotice({ company }: { company: PlatformCompany }) {
  const status = company.deletionStatus;
  if (status === 'none') return null;
  if (status === 'pending' || status === 'running') {
    return (
      <div className="alert alert--info" role="status">
        <p className="alert__title">Kalıcı silme sürüyor</p>
        <p>
          Silme arka planda yürür; bu sayfa durumu kendiliğinden yeniler. Firma bu sırada
          değiştirilemez ve kullanıcıları giriş yapamaz.
        </p>
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="alert alert--danger" role="alert">
        <p className="alert__title">Kalıcı silme başarısız oldu</p>
        <p>
          Firma açılamaz ve değiştirilemez. Hata işletim geçmişindedir; silme baştan güvenle yeniden
          başlatılabilir.
        </p>
      </div>
    );
  }
  return (
    <div className="alert alert--info" role="status">
      <p className="alert__title">Firma kalıcı olarak silindi</p>
      <p>
        Firmanın verisi ve belgeleri silindi; yalnız ad, hizmet tarihleri ve işletim geçmişinin
        asgari kaydı kalır. Kalıcı silinen firma yeniden açılamaz.
      </p>
    </div>
  );
}

function UsersPanel({
  users,
  modifiable,
  onAction,
  onAdd,
}: {
  users: PlatformUser[];
  modifiable: boolean;
  onAction: (kind: UserDialog, userId: string) => void;
  onAdd: () => void;
}) {
  return (
    <Panel
      title="Kullanıcılar"
      icon={Users}
      actions={
        modifiable ? (
          <Button variant="secondary" size="small" onClick={onAdd}>
            <Icon icon={UserPlus} />
            Ekle
          </Button>
        ) : null
      }
    >
      {users.length === 0 ? (
        <p className="list-empty">
          {modifiable
            ? 'Henüz kullanıcı yok. Firma yetkilisi için kullanıcı ekleyin.'
            : 'Kullanıcı yok.'}
        </p>
      ) : (
        <ul className="list-rows">
          {users.map((user) => (
            <li key={user.id}>
              <div className="list-row list-row--static">
                <span className={`icon-box icon-box--${user.isActive ? 'primary' : 'neutral'}`}>
                  <Icon icon={user.isActive ? UserRoundCheck : UserRoundX} />
                </span>
                <div className="list-row__main">
                  <span className="list-row__title">
                    <span className="list-row__title-text">{user.name}</span>
                    {user.isActive ? null : <Badge tone="danger">Pasif</Badge>}
                  </span>
                  <span className="list-row__meta block">
                    {user.username}
                    {user.phone ? ` · ${user.phone}` : ''}
                    {user.email ? ` · ${user.email}` : ''}
                  </span>
                  {user.mustChangePassword ? (
                    <span className="list-row__meta block">
                      Geçici şifre bekliyor
                      {user.tempPasswordExpiresAt
                        ? ` · ${formatDateTime(user.tempPasswordExpiresAt)} tarihine kadar geçerli`
                        : ''}
                    </span>
                  ) : null}
                </div>
                {modifiable ? (
                  <Menu
                    label={`${user.name} işlemleri`}
                    buttonClassName="icon-btn"
                    buttonLabel={`${user.name} işlemleri`}
                    buttonContent={<Icon icon={Ellipsis} />}
                  >
                    {(closeMenu) =>
                      (
                        [
                          ['editUser', 'Düzenle (ad, kullanıcı adı)', Pencil],
                          ['reset', 'Şifreyi sıfırla', KeyRound],
                          [
                            'toggle',
                            user.isActive ? 'Pasifleştir' : 'Aktifleştir',
                            user.isActive ? UserRoundX : UserRoundCheck,
                          ],
                        ] as const
                      ).map(([kind, label, icon]) => (
                        <button
                          key={kind}
                          type="button"
                          className="dropdown__item"
                          role="menuitem"
                          onClick={() => {
                            closeMenu();
                            onAction(kind, user.id);
                          }}
                        >
                          <Icon icon={icon} />
                          {label}
                        </button>
                      ))
                    }
                  </Menu>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function InfoPanel({ company }: { company: PlatformCompany }) {
  const rows: [string, ReactNode][] = [
    ['Firma adı', company.name],
    ['Müşterinin görünen adı', company.displayName || '—'],
    ['Yetkili kişi', company.contact.person || '—'],
    ['Telefon', company.contact.phone || '—'],
    ['E-posta', company.contact.email || '—'],
    ['İşletim notu', company.opsNote || '—'],
  ];
  return (
    <Panel title="Firma bilgileri" icon={Building2}>
      <div className="panel__body">
        <dl className="definition-list">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </Panel>
  );
}

function ServicePanel({
  company,
  modifiable,
  onAction,
}: {
  company: PlatformCompany;
  modifiable: boolean;
  onAction: (kind: CompanyDialog) => void;
}) {
  const { service } = company;
  const ended = service.serviceEndedAt !== null;
  return (
    <Panel title="Hizmet durumu ve tarihler" icon={CalendarClock}>
      <div className="panel__body stack">
        <p className="row">
          <CompanyStateBadge {...companyState(company)} />
          {company.isSuspended ? <Badge tone="warn">Geçici durdurma açık</Badge> : null}
        </p>
        {ended ? (
          <dl className="definition-list">
            <dt>Hizmet sonu (yürürlük)</dt>
            <dd>{formatLongDate(service.serviceEndedAt)}</dd>
            <dt>Son görüntüleme günü</dt>
            <dd>{formatLongDate(service.viewUntil)}</dd>
            <dt>Saklama bitişi</dt>
            <dd>{formatLongDate(service.retainUntil)}</dd>
          </dl>
        ) : (
          <p className="meta">Hizmet sonu planlanmamış.</p>
        )}
        {modifiable ? (
          <div className="form-actions">
            <Button variant="secondary" size="small" onClick={() => onAction('suspend')}>
              <Icon icon={company.isSuspended ? Play : Pause} />
              {company.isSuspended ? 'Durdurmayı kaldır' : 'Geçici durdur'}
            </Button>
            {ended ? (
              <>
                <Button variant="secondary" size="small" onClick={() => onAction('reopen')}>
                  <Icon icon={RotateCcw} />
                  Yeniden aç
                </Button>
                <Button variant="secondary" size="small" onClick={() => onAction('extend')}>
                  <Icon icon={Archive} />
                  Arşivi uzat
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="small" onClick={() => onAction('end')}>
                <Icon icon={Power} />
                Hizmeti sonlandır
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function StoragePanel({
  company,
  modifiable,
  onQuota,
}: {
  company: PlatformCompany;
  modifiable: boolean;
  onQuota: () => void;
}) {
  const { usedBytes, quotaBytes } = company.storage;
  return (
    <Panel title="Belge alanı" icon={HardDrive}>
      <div className="panel__body stack stack--sm">
        <p>
          Kullanılan: <StorageText used={usedBytes} quota={quotaBytes} />
        </p>
        <progress
          value={Math.min(usedBytes, quotaBytes)}
          max={quotaBytes}
          aria-label="Belge alanı kullanımı"
        />
        {usedBytes >= quotaBytes ? (
          <p className="text-danger">Kapasite doldu; müşteri yeni belge yükleyemez.</p>
        ) : null}
        {modifiable ? (
          <div>
            <Button variant="secondary" size="small" onClick={onQuota}>
              Kapasiteyi değiştir
            </Button>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
  if (field === 'storageQuotaBytes' && typeof value === 'number') return formatBytes(value);
  if (field === 'deletionStatus' && typeof value === 'string' && value in DELETION_STATUS_LABEL) {
    return DELETION_STATUS_LABEL[value as keyof typeof DELETION_STATUS_LABEL];
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatLongDate(value);
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const parts = Object.values(value as Record<string, unknown>).filter(
      (part): part is string | number => typeof part === 'string' || typeof part === 'number',
    );
    return parts.filter((part) => part !== '').join(', ') || '—';
  }
  return '—';
}

function changeText(entry: PlatformLogEntry, change: PlatformLogChange): string {
  const label = PLATFORM_FIELD_LABEL[change.field] ?? change.field;
  // Kalıcı silme tamamlanınca silinen kayıt ve dosya sayıları yazılır.
  if (entry.action === 'company.delete_completed') {
    if (typeof change.old === 'number') return `${label}: ${change.old} silindi`;
    if (change.field === 'name') return `Firma adı: ${formatValue(change.field, change.old)}`;
  }
  if (change.old === null && entry.action.endsWith('.create')) {
    return `${label}: ${formatValue(change.field, change.new)}`;
  }
  return `${label}: ${formatValue(change.field, change.old)} → ${formatValue(change.field, change.new)}`;
}

/** İşletim geçmişi: işlem adları Türkçe; kim, ne zaman, gerekçe (şartname 7.13, 8.10). */
function HistoryPanel({ history, users }: { history: PlatformLogEntry[]; users: PlatformUser[] }) {
  const admin = useAdminSession((state) => state.admin);
  const userName = (entry: PlatformLogEntry) => {
    const id = entry.changes.find((change) => change.field === 'userId')?.new;
    if (typeof id !== 'string') return null;
    return users.find((user) => user.id === id)?.name ?? 'Silinmiş kullanıcı';
  };
  return (
    <Panel title="İşletim geçmişi" icon={History}>
      {history.length === 0 ? (
        <p className="list-empty">Kayıt yok.</p>
      ) : (
        <ul className="list-rows">
          {history.map((entry) => {
            const target = entry.action.startsWith('user.') ? userName(entry) : null;
            const changes = entry.changes.filter((change) => change.field !== 'userId');
            return (
              <li key={entry.id}>
                <div className="list-row list-row--static history-row">
                  <div className="list-row__main">
                    <span className="list-row__title">
                      <span className="list-row__title-text">
                        {platformActionLabel(entry.action)}
                        {target ? `: ${target}` : ''}
                      </span>
                    </span>
                    <span className="list-row__meta block">
                      {formatDateTime(entry.at)} ·{' '}
                      {entry.adminId === null
                        ? 'Sistem'
                        : entry.adminId === admin?.id
                          ? admin.username
                          : 'Ürün sahibi'}
                    </span>
                    {changes.length > 0 ? (
                      <span className="history-row__changes">
                        {changes.map((change) => changeText(entry, change)).join(' · ')}
                      </span>
                    ) : null}
                    {entry.reason ? (
                      <span className="history-row__reason">Gerekçe: {entry.reason}</span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {history.length >= 100 ? <p className="list-empty">Son 100 kayıt gösterilir.</p> : null}
    </Panel>
  );
}
