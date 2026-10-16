import { useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { adminPatch, adminPost, adminPostFull } from '../../api/admin-client';
import { invalidatePlatform } from '../../api/admin-queries';
import type { PlatformUser, TemporaryPasswordResult } from '../../api/admin-types';
import { errorMessage, isApiError } from '../../api/client';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, Field, TextInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { SaveStatus } from '../../components/ui/SaveStatus';
import { formatDateTime } from '../../lib/format';
import { issuesByPath } from './admin-utils';
import { useAdminCreate } from './useAdminCreate';

/**
 * Geçici şifre yalnız bu dialogda bir kez gösterilir (şartname 7.13); hiçbir yere kaydedilmez.
 * Ürün sahibi şifreyi müşteriye kendisi iletir; kapatınca yeniden görüntülenemez.
 */
function OneTimePassword({
  result,
  onClose,
}: {
  result: TemporaryPasswordResult & { message?: string | undefined };
  onClose: () => void;
}) {
  const [noted, setNoted] = useState(false);
  const [copied, setCopied] = useState(false);
  const password = result.temporaryPassword;
  return (
    <Dialog
      open
      title={password ? 'Geçici şifre' : 'Kullanıcı kaydı'}
      onClose={onClose}
      locked={Boolean(password) && !noted}
      actions={
        <Button disabled={Boolean(password) && !noted} onClick={onClose}>
          Kapat
        </Button>
      }
    >
      <div className="stack">
        <dl className="definition-list">
          <dt>Kullanıcı</dt>
          <dd>{result.user.name}</dd>
          <dt>Kullanıcı adı</dt>
          <dd>
            <strong>{result.user.username}</strong>
          </dd>
        </dl>
        {password ? (
          <>
            <div className="one-time">
              <span className="meta">Geçici şifre</span>
              <span className="one-time__value" aria-label="Geçici şifre">
                {password}
              </span>
              <span className="meta">
                {result.tempPasswordExpiresAt
                  ? `${formatDateTime(result.tempPasswordExpiresAt)} tarihine kadar (72 saat) geçerli.`
                  : '72 saat geçerli.'}{' '}
                Kullanıcı ilk girişte kişisel şifresini oluşturur.
              </span>
              <span>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(password)
                      .then(() => setCopied(true))
                      .catch(() => setCopied(false));
                  }}
                >
                  <Icon icon={Copy} />
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </Button>
              </span>
            </div>
            <div className="alert alert--danger" role="alert">
              <p className="alert__title">Bu şifre yalnız şimdi gösterilir</p>
              <p>
                Dialog kapanınca yeniden görüntülenemez. Uygulama müşteriye mesaj göndermez; şifreyi
                kendiniz iletin. Kaybolursa şifreyi yeniden sıfırlayın.
              </p>
            </div>
            <Checkbox
              label="Şifreyi kaydettim veya müşteriye ilettim."
              checked={noted}
              onChange={(event) => setNoted(event.target.checked)}
            />
          </>
        ) : (
          <div className="alert alert--info" role="status">
            {result.message ??
              'Geçici şifre ilk yanıtta gösterildi; görmediyseniz şifreyi sıfırlayın.'}
          </div>
        )}
      </div>
    </Dialog>
  );
}

const EMPTY_USER = { name: '', username: '', phone: '', email: '', reason: '' };

/** Kullanıcı ekle: ad soyad ve kullanıcı adı zorunlu; telefon/e-posta isteğe bağlı. */
export function AddUserDialog({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState(EMPTY_USER);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<
    (TemporaryPasswordResult & { message?: string | undefined }) | null
  >(null);
  const create = useAdminCreate<TemporaryPasswordResult>();
  const set = (patch: Partial<typeof EMPTY_USER>) => setValues((v) => ({ ...v, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const missing: Record<string, string> = {};
    if (values.name.trim().length < 2) missing.name = 'Ad soyad girin.';
    if (values.username.trim().length < 3) {
      missing.username = 'Kullanıcı adı en az 3 karakter olmalı.';
    }
    setErrors(missing);
    if (Object.keys(missing).length > 0) return;
    const body = {
      name: values.name.trim(),
      username: values.username.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      ...(values.reason.trim() ? { reason: values.reason.trim() } : {}),
    };
    try {
      const outcome = await create.submit((idempotencyKey) =>
        adminPostFull<TemporaryPasswordResult>(`/platform/companies/${companyId}/users`, body, {
          idempotencyKey,
        }),
      );
      if (!outcome) return;
      await invalidatePlatform(queryClient);
      setResult({ ...outcome.data, message: outcome.message });
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'USERNAME_EXISTS') {
        setErrors({ username: caught.message });
      } else {
        setErrors(issuesByPath(caught));
      }
    }
  }

  if (result) return <OneTimePassword result={result} onClose={onClose} />;

  return (
    <Dialog
      open
      title="Kullanıcı ekle"
      onClose={onClose}
      locked={create.busy}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={create.busy}>
            Vazgeç
          </Button>
          <Button
            type="submit"
            form="add-user-form"
            loading={create.state.status === 'saving'}
            disabled={create.busy}
          >
            Kullanıcıyı Ekle
          </Button>
        </>
      }
    >
      <form id="add-user-form" className="stack" noValidate onSubmit={(e) => void submit(e)}>
        <p className="meta">
          Sistem 72 saat geçerli bir geçici şifre üretir ve yalnız bir kez gösterir.
        </p>
        <Field label="Ad soyad" required error={errors.name}>
          {(props) => (
            <TextInput
              {...props}
              value={values.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          )}
        </Field>
        <Field
          label="Kullanıcı adı"
          required
          error={errors.username}
          hint="3–50 karakter; harf, rakam, nokta, alt çizgi ve tire. Sistem genelinde tektir."
        >
          {(props) => (
            <TextInput
              {...props}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              value={values.username}
              onChange={(e) => set({ username: e.target.value })}
            />
          )}
        </Field>
        <div className="form-grid">
          <Field label="Telefon" error={errors.phone}>
            {(props) => (
              <TextInput
                {...props}
                type="tel"
                value={values.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            )}
          </Field>
          <Field label="E-posta" error={errors.email}>
            {(props) => (
              <TextInput
                {...props}
                type="email"
                value={values.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field label="Gerekçe" hint="İsteğe bağlı.">
          {(props) => (
            <TextInput
              {...props}
              value={values.reason}
              onChange={(e) => set({ reason: e.target.value })}
            />
          )}
        </Field>
        <SaveStatus state={create.state} onVerify={() => void create.retry()} />
      </form>
    </Dialog>
  );
}

/** Kullanıcı düzenle: ad ve kullanıcı adı; gerekçe isteğe bağlı; kullanıcı adı çakışması 409. */
export function EditUserDialog({ user, onClose }: { user: PlatformUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = name.trim() !== user.name || username.trim() !== user.username;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      await adminPatch(`/platform/users/${user.id}`, {
        ...(name.trim() !== user.name ? { name: name.trim() } : {}),
        ...(username.trim() !== user.username ? { username: username.trim() } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        expectedUpdatedAt: user.updatedAt,
      });
      await invalidatePlatform(queryClient);
      onClose();
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'USERNAME_EXISTS') {
        setErrors({ username: caught.message });
      } else if (isApiError(caught) && caught.code === 'CONFLICT') {
        await invalidatePlatform(queryClient);
        setError(
          'Kullanıcı başka bir yerde güncellendi. Dialogu kapatıp güncel bilgiyle yeniden açın.',
        );
      } else {
        setErrors(issuesByPath(caught));
        setError(errorMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      title="Kullanıcıyı düzenle"
      onClose={onClose}
      locked={busy}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" form="edit-user-form" loading={busy} disabled={!changed}>
            Kaydet
          </Button>
        </>
      }
    >
      <form id="edit-user-form" className="stack" noValidate onSubmit={(e) => void submit(e)}>
        <Field label="Ad soyad" required error={errors.name}>
          {(props) => (
            <TextInput {...props} value={name} onChange={(e) => setName(e.target.value)} />
          )}
        </Field>
        <Field
          label="Kullanıcı adı"
          required
          error={errors.username}
          hint="Değişirse kullanıcı yeni adla giriş yapar."
        >
          {(props) => (
            <TextInput
              {...props}
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
        </Field>
        <Field label="Gerekçe" hint="İsteğe bağlı.">
          {(props) => (
            <TextInput {...props} value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
        </Field>
        {error ? (
          <div className="alert alert--danger" role="alert">
            <p className="alert__title">{error}</p>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}

/** Şifre sıfırla: gerekçe zorunlu; yeni geçici şifre bir kez gösterilir, bütün oturumlar düşer. */
export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: PlatformUser;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState<TemporaryPasswordResult | null>(null);
  if (result) return <OneTimePassword result={result} onClose={onClose} />;
  return (
    <ActionDialog
      open
      title="Şifreyi sıfırla"
      confirmLabel="Şifreyi Sıfırla"
      confirmVariant="danger"
      onClose={onClose}
      onConfirm={async (reason) => {
        setResult(
          await adminPost<TemporaryPasswordResult>(`/platform/users/${user.id}/reset-password`, {
            reason,
          }),
        );
        await invalidatePlatform(queryClient);
      }}
    >
      <p>
        <strong>{user.name}</strong> ({user.username}) için yeni geçici şifre üretilir. Mevcut şifre
        görüntülenmez; kullanıcının bütün oturumları hemen kapanır.
      </p>
    </ActionDialog>
  );
}

/** Pasifleştir / aktifleştir: gerekçe zorunlu; pasifte giriş ve oturumlar hemen kapanır. */
export function ToggleUserDialog({ user, onClose }: { user: PlatformUser; onClose: () => void }) {
  const queryClient = useQueryClient();
  const deactivate = user.isActive;
  return (
    <ActionDialog
      open
      title={deactivate ? 'Kullanıcıyı pasifleştir' : 'Kullanıcıyı aktifleştir'}
      confirmLabel={deactivate ? 'Pasifleştir' : 'Aktifleştir'}
      confirmVariant={deactivate ? 'danger' : 'primary'}
      onClose={onClose}
      onConflict={() => invalidatePlatform(queryClient)}
      onConfirm={async (reason) => {
        await adminPatch(`/platform/users/${user.id}`, {
          isActive: !user.isActive,
          reason,
          expectedUpdatedAt: user.updatedAt,
        });
        await invalidatePlatform(queryClient);
        onClose();
      }}
    >
      <p>
        <strong>{user.name}</strong> ({user.username}){' '}
        {deactivate
          ? 'artık giriş yapamaz; açık oturumları hemen kapanır. Geçmiş kayıtlardaki adı kalır.'
          : 'yeniden giriş yapabilir.'}
      </p>
    </ActionDialog>
  );
}
