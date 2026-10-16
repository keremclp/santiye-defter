import { KeyRound, LifeBuoy, Smartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { adminCodeCheck } from '../../api/admin-client';
import type { TotpSetupResult } from '../../api/admin-types';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { PageHeader, Panel } from '../../components/ui/Card';
import { Field, TextInput } from '../../components/ui/Field';
import { usePageMeta } from '../../hooks/usePageMeta';
import { useAdminSession } from '../../stores/admin-session';
import { toast } from '../../stores/ui';
import { CodeField, RecoveryCodes, TotpQr } from './TotpParts';
import { validCode } from './admin-utils';

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="alert alert--danger" role="alert">
      <p className="alert__title">{message}</p>
    </div>
  );
}

/** Güvenlik (şartname 7.13): doğrulama uygulamasını yeniden kurma ve kurtarma kodlarını yenileme. */
export function AdminSecurityPage() {
  usePageMeta('Güvenlik');
  return (
    <main className="page">
      <PageHeader
        title="Güvenlik"
        subtitle="İki aşamalı doğrulama kapatılamaz. Yeniden kurabilir ve kurtarma kodlarını yenileyebilirsiniz."
      />
      <div className="form-columns">
        <TotpReset />
        <div className="dash-col">
          <RegenerateCodes />
          <Panel title="Telefon ve kodlar birlikte kaybolursa" icon={LifeBuoy}>
            <div className="panel__body stack stack--sm">
              <p>
                Web üzerinden kurtarma yolu yoktur. Sunucuya erişimi olan kişi şu komutu çalıştırır;
                sonraki girişte kurulum yeniden istenir:
              </p>
              <p className="secret-text">
                pnpm --filter api platform:reset-2fa --username &lt;ad&gt;
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function RegenerateCodes() {
  const username = useAdminSession((state) => state.admin?.username ?? '');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const invalid = validCode(code);
    setFieldError(invalid);
    if (invalid) return;
    setError(null);
    setBusy(true);
    try {
      const { data } = await adminCodeCheck<{ recoveryCodes: string[] }>(
        '/platform/auth/recovery-codes/regenerate',
        { code },
      );
      setCodes(data.recoveryCodes);
      setCode('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Kurtarma kodlarını yenile" icon={KeyRound}>
      <div className="panel__body stack">
        {codes ? (
          <RecoveryCodes
            codes={codes}
            username={username}
            doneLabel="Tamam"
            onDone={() => setCodes(null)}
          />
        ) : (
          <form className="stack" onSubmit={(event) => void submit(event)} noValidate>
            <p className="meta">
              Yeni 10 kod üretilir; eski kodların hepsi hemen geçersiz olur. Yeni kodlar yalnız bir
              kez gösterilir.
            </p>
            <CodeField value={code} onChange={setCode} error={fieldError} />
            <FormError message={error} />
            <div className="form-actions">
              <Button type="submit" loading={busy} loadingText="Yenileniyor…">
                Kodları yenile
              </Button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

/**
 * Doğrulama uygulamasını yeniden kurma: mevcut kod (telefon kaybolduysa bir kurtarma kodu) ile
 * başlatılır, yeni uygulamadaki kodla onaylanır. Onaylanana kadar eski uygulama geçerli kalır.
 */
function TotpReset() {
  const [proof, setProof] = useState<'totp' | 'recovery'>('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<TotpSetupResult | null>(null);

  async function start(event: FormEvent) {
    event.preventDefault();
    const invalid =
      proof === 'totp'
        ? validCode(code)
        : recoveryCode.trim() === ''
          ? 'Kurtarma kodunu girin.'
          : undefined;
    setFieldError(invalid);
    if (invalid) return;
    setError(null);
    setBusy(true);
    try {
      const { data } = await adminCodeCheck<TotpSetupResult>(
        '/platform/auth/totp/reset',
        proof === 'totp' ? { code } : { recoveryCode: recoveryCode.trim() },
      );
      setSetup(data);
      setCode('');
      setRecoveryCode('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    const invalid = validCode(newCode);
    setFieldError(invalid);
    if (invalid) return;
    setError(null);
    setBusy(true);
    try {
      const { message } = await adminCodeCheck<null>('/platform/auth/totp/reset/confirm', {
        code: newCode,
      });
      toast(message ?? 'İki aşamalı doğrulama yeniden kuruldu.');
      setSetup(null);
      setNewCode('');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Doğrulama uygulamasını yeniden kur" icon={Smartphone}>
      <div className="panel__body stack">
        {setup ? (
          <form className="stack" onSubmit={(event) => void confirm(event)} noValidate>
            <p>
              Yeni telefondaki doğrulama uygulamasıyla QR kodunu okutun ve gösterdiği kodu girin.
              Onaylanana kadar eski uygulamanız geçerli kalır.
            </p>
            <TotpQr otpauthUrl={setup.otpauthUrl} secret={setup.secret} />
            <CodeField
              label="Yeni uygulamadaki kod"
              value={newCode}
              onChange={setNewCode}
              error={fieldError}
            />
            <FormError message={error} />
            <div className="form-actions">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setSetup(null);
                  setError(null);
                }}
              >
                Vazgeç
              </Button>
              <Button type="submit" loading={busy} loadingText="Doğrulanıyor…">
                Yeni kurulumu onayla
              </Button>
            </div>
          </form>
        ) : (
          <form className="stack" onSubmit={(event) => void start(event)} noValidate>
            <p className="meta">
              Telefon değiştirdiyseniz veya kaybettiyseniz kullanın. Kurtarma kodlarınız değişmez;
              gerekirse ayrıca yenileyin.
            </p>
            <div className="segment" role="group" aria-label="Kimliğinizi nasıl doğrulayacaksınız">
              <button
                type="button"
                className="segment__item"
                aria-pressed={proof === 'totp'}
                onClick={() => setProof('totp')}
              >
                Mevcut uygulamadaki kod
              </button>
              <button
                type="button"
                className="segment__item"
                aria-pressed={proof === 'recovery'}
                onClick={() => setProof('recovery')}
              >
                Kurtarma kodu
              </button>
            </div>
            {proof === 'totp' ? (
              <CodeField
                label="Mevcut uygulamadaki kod"
                value={code}
                onChange={setCode}
                error={fieldError}
              />
            ) : (
              <Field
                label="Kurtarma kodu"
                required
                error={fieldError}
                hint="Kullanılan kurtarma kodu geçersizleşir."
              >
                {(props) => (
                  <TextInput
                    {...props}
                    className="code-input"
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    value={recoveryCode}
                    onChange={(event) => setRecoveryCode(event.target.value)}
                  />
                )}
              </Field>
            )}
            <FormError message={error} />
            <div className="form-actions">
              <Button type="submit" loading={busy} loadingText="Hazırlanıyor…">
                Yeniden kurulumu başlat
              </Button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}
