import { addDays, compareIsoDates, todayInIstanbul } from '@santiye/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { adminPatch, adminPost } from '../../api/admin-client';
import { invalidatePlatform } from '../../api/admin-queries';
import type { EndServicePreview, PlatformCompany } from '../../api/admin-types';
import { errorMessage, isApiError } from '../../api/client';
import { ActionDialog } from '../../components/ui/ActionDialog';
import { Button } from '../../components/ui/Button';
import { ConflictView } from '../../components/ui/ConflictView';
import { Dialog } from '../../components/ui/Dialog';
import { DateInput, Field, TextArea, TextInput } from '../../components/ui/Field';
import { Loading } from '../../components/ui/States';
import { formatBytes, formatLongDate } from '../../lib/format';
import { toast } from '../../stores/ui';
import { issuesByPath } from './admin-utils';
import { ChangePreview } from './admin-parts';

const GB = 1024 ** 3;
const companyPath = (id: string, action = '') => `/platform/companies/${id}${action}`;

function useAfterSuccess(onClose: () => void) {
  const queryClient = useQueryClient();
  return async (message: string) => {
    await invalidatePlatform(queryClient);
    toast(message);
    onClose();
  };
}

const formValues = (company: PlatformCompany) => ({
  name: company.name,
  person: company.contact.person,
  phone: company.contact.phone,
  email: company.contact.email,
  opsNote: company.opsNote,
});

/**
 * Firma düzenle (şartname 7.13): ad, iletişim, işletim notu; gerekçe isteğe bağlı. Kayıt bu arada
 * değiştiyse güncel kayıt ile değişiklik yan yana gösterilir, sessizce üzerine yazılmaz.
 */
export function EditCompanyDialog({
  company,
  onClose,
}: {
  company: PlatformCompany;
  onClose: () => void;
}) {
  const done = useAfterSuccess(onClose);
  const [base, setBase] = useState(() => ({
    values: formValues(company),
    updatedAt: company.updatedAt,
  }));
  const [values, setValues] = useState(base.values);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<PlatformCompany | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof values>) => setValues((v) => ({ ...v, ...patch }));
  const keys = Object.keys(values) as (keyof typeof values)[];
  const dirty = keys.some((key) => values[key] !== base.values[key]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (values.name.trim() === '') {
      setErrors({ name: 'Firma adını girin.' });
      return;
    }
    setErrors({});
    setError(null);
    setBusy(true);
    try {
      await adminPatch(companyPath(company.id), {
        name: values.name.trim(),
        contact: {
          person: values.person.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
        },
        opsNote: values.opsNote.trim(),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        expectedUpdatedAt: base.updatedAt,
      });
      await done('Firma bilgileri kaydedildi.');
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'CONFLICT' && caught.current) {
        setConflict(caught.current as PlatformCompany);
      } else {
        setErrors(issuesByPath(caught));
        setError(errorMessage(caught));
      }
      setBusy(false);
    }
  }

  const labels: Record<keyof typeof values, string> = {
    name: 'Firma adı',
    person: 'Yetkili kişi',
    phone: 'Telefon',
    email: 'E-posta',
    opsNote: 'İşletim notu',
  };

  return (
    <Dialog
      open
      wide
      title="Firmayı düzenle"
      onClose={onClose}
      locked={busy}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            type="submit"
            form="edit-company-form"
            loading={busy}
            disabled={!dirty || Boolean(conflict)}
          >
            Kaydet
          </Button>
        </>
      }
    >
      <form id="edit-company-form" className="stack" noValidate onSubmit={(e) => void submit(e)}>
        {conflict ? (
          <ConflictView
            fields={keys.map((key) => {
              const current = formValues(conflict)[key];
              return {
                key,
                label: labels[key],
                current: current || '—',
                mine: values[key] || '—',
                differs: current !== values[key],
              };
            })}
            onUseCurrent={() => {
              const current = formValues(conflict);
              setBase({ values: current, updatedAt: conflict.updatedAt });
              setValues(current);
              setConflict(null);
            }}
            onKeepMine={() => {
              setBase((previous) => ({ ...previous, updatedAt: conflict.updatedAt }));
              setConflict(null);
            }}
          />
        ) : null}
        <Field label="Firma adı" required error={errors.name}>
          {(props) => (
            <TextInput
              {...props}
              value={values.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          )}
        </Field>
        <div className="form-grid">
          <Field label="Yetkili kişi" error={errors['contact.person']}>
            {(props) => (
              <TextInput
                {...props}
                value={values.person}
                onChange={(e) => set({ person: e.target.value })}
              />
            )}
          </Field>
          <Field label="Telefon" error={errors['contact.phone']}>
            {(props) => (
              <TextInput
                {...props}
                type="tel"
                value={values.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            )}
          </Field>
          <Field label="E-posta" error={errors['contact.email']}>
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
        <Field label="İşletim notu" error={errors.opsNote}>
          {(props) => (
            <TextArea
              {...props}
              rows={3}
              value={values.opsNote}
              onChange={(e) => set({ opsNote: e.target.value })}
            />
          )}
        </Field>
        <Field label="Gerekçe" hint="İsteğe bağlı; değişiklikler işletim geçmişine yazılır.">
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

/** "20" veya "20,5" → bayt. Kapasite gösterim için GB (1024³) ile girilir. */
function parseGb(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const bytes = Math.round(Number(normalized) * GB);
  return bytes > 0 ? bytes : null;
}

function gbText(bytes: number): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(bytes / GB);
}

/** Kapasite: gerekçeyle artır veya mevcut kullanımın altına inmeden azalt. */
export function QuotaDialog({
  company,
  onClose,
}: {
  company: PlatformCompany;
  onClose: () => void;
}) {
  const done = useAfterSuccess(onClose);
  const { usedBytes, quotaBytes } = company.storage;
  const [text, setText] = useState(gbText(quotaBytes));
  const next = parseGb(text);
  const below = next !== null && next < usedBytes;
  const inputError =
    text.trim() === ''
      ? 'Kapasiteyi girin.'
      : next === null
        ? 'Geçerli bir GB değeri girin (ör. 20 veya 20,5).'
        : below
          ? 'Kapasite mevcut kullanımın altına indirilemez.'
          : undefined;

  return (
    <ActionDialog
      open
      title="Kapasiteyi değiştir"
      confirmLabel="Kapasiteyi Kaydet"
      onClose={onClose}
      confirmDisabled={Boolean(inputError) || next === quotaBytes}
      onConfirm={async (reason) => {
        if (next === null) return;
        await adminPost(companyPath(company.id, '/quota'), { quotaBytes: next, reason });
        await done('Kapasite kaydedildi.');
      }}
    >
      <p>
        Kullanılan: <strong>{formatBytes(usedBytes)}</strong> / {formatBytes(quotaBytes)}
      </p>
      <Field label="Yeni kapasite (GB)" required error={inputError}>
        {(props) => (
          <TextInput
            {...props}
            inputMode="decimal"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        )}
      </Field>
      {next !== null && !below ? (
        <ChangePreview
          title="Değişiklik"
          rows={[
            {
              label: 'Kapasite',
              before: formatBytes(quotaBytes),
              after: formatBytes(next),
              changed: next !== quotaBytes,
            },
          ]}
          note={next === quotaBytes ? 'Değer aynı; kayıt yapılmaz.' : undefined}
        />
      ) : null}
    </ActionDialog>
  );
}

/** Geçici durdur / durdurmayı kaldır: hizmet sonu tarihlerine dokunmaz; erişim bir sonraki istekte değişir. */
export function SuspendDialog({
  company,
  onClose,
}: {
  company: PlatformCompany;
  onClose: () => void;
}) {
  const done = useAfterSuccess(onClose);
  const suspend = !company.isSuspended;
  return (
    <ActionDialog
      open
      title={suspend ? 'Geçici olarak durdur' : 'Geçici durdurmayı kaldır'}
      confirmLabel={suspend ? 'Durdur' : 'Durdurmayı Kaldır'}
      confirmVariant={suspend ? 'danger' : 'primary'}
      onClose={onClose}
      onConfirm={async (reason) => {
        await adminPost(companyPath(company.id, '/suspend'), { suspended: suspend, reason });
        await done(suspend ? 'Firma geçici olarak durduruldu.' : 'Geçici durdurma kaldırıldı.');
      }}
    >
      <p>
        {suspend
          ? 'Firmanın bütün kullanıcıları bir sonraki istekte erişim mesajı görür; veri silinmez. Hizmet sonu tarihleri değişmez ve hizmet sonu süreci başlamaz.'
          : 'Erişim, hizmet durumunun izin verdiği ölçüde yeniden açılır. Hizmet sonu tarihleri değişmez.'}
      </p>
    </ActionDialog>
  );
}

/**
 * Hizmeti sonlandır: yürürlük günü bugünden önce olamaz; son görüntüleme günü ve saklama bitişi
 * kesin tarih olarak API önizlemesiyle gösterilir. Onay yalnız seçili tarihin önizlemesiyle verilir.
 */
export function EndServiceDialog({
  company,
  onClose,
}: {
  company: PlatformCompany;
  onClose: () => void;
}) {
  const done = useAfterSuccess(onClose);
  const today = todayInIstanbul();
  const [date, setDate] = useState(today);
  const [preview, setPreview] = useState<{
    date: string;
    data: EndServicePreview | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    adminPost<EndServicePreview>(
      companyPath(company.id, '/end-service'),
      { effectiveDate: date },
      { params: { preview: 1 } },
    )
      .then((data) => {
        if (!cancelled) setPreview({ date, data, error: null });
      })
      .catch((caught: unknown) => {
        if (!cancelled) setPreview({ date, data: null, error: errorMessage(caught) });
      });
    return () => {
      cancelled = true;
    };
  }, [company.id, date]);

  const current = preview?.date === date ? preview : null;
  const ready = Boolean(current?.data);

  return (
    <ActionDialog
      open
      title="Hizmeti sonlandır"
      confirmLabel="Hizmeti Sonlandır"
      confirmVariant="danger"
      onClose={onClose}
      confirmDisabled={!ready}
      onConfirm={async (reason) => {
        await adminPost(companyPath(company.id, '/end-service'), { effectiveDate: date, reason });
        await done('Hizmet sonlandırıldı.');
      }}
    >
      <Field
        label="Yürürlük tarihi"
        required
        hint="Bugünden önce olamaz. İleri tarih seçilirse firma o güne kadar aktif kalır."
      >
        {(props) => (
          <DateInput
            {...props}
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        )}
      </Field>
      {!date ? null : !current ? (
        <Loading label="Tarihler hesaplanıyor…" />
      ) : current.error ? (
        <div className="alert alert--danger" role="alert">
          <p className="alert__title">{current.error}</p>
        </div>
      ) : current.data ? (
        <ChangePreview
          title="Hizmet tarihleri"
          rows={[
            {
              label: 'Hizmet sonu (yürürlük)',
              before: '—',
              after: formatLongDate(current.data.serviceEndedAt),
            },
            {
              label: 'Son görüntüleme günü',
              before: '—',
              after: formatLongDate(current.data.viewUntil),
            },
            {
              label: 'Saklama bitişi',
              before: '—',
              after: formatLongDate(current.data.retainUntil),
            },
          ]}
          note={`Müşteri ${formatLongDate(current.data.viewUntil)} dahil kayıtlarını görüntüleyip dışa aktarabilir, değişiklik yapamaz. Ertesi günden ${formatLongDate(current.data.retainUntil)} tarihine kadar arşivde saklanır; sonra silme onayınızı bekler. Tarih değiştirmek için önce yeniden açmak gerekir.`}
        />
      ) : null}
    </ActionDialog>
  );
}

/** Yeniden aç: hizmet sonu tarihlerini temizler; geçici durdurmaya dokunmaz. */
export function ReopenDialog({
  company,
  onClose,
}: {
  company: PlatformCompany;
  onClose: () => void;
}) {
  const done = useAfterSuccess(onClose);
  const { service } = company;
  const scheduled =
    service.serviceEndedAt !== null &&
    compareIsoDates(service.serviceEndedAt, todayInIstanbul()) > 0;
  return (
    <ActionDialog
      open
      title={scheduled ? 'Planlı sonlandırmayı iptal et' : 'Hizmeti yeniden aç'}
      confirmLabel="Yeniden Aç"
      onClose={onClose}
      onConfirm={async (reason) => {
        await adminPost(companyPath(company.id, '/reopen'), { reason });
        await done('Hizmet yeniden açıldı.');
      }}
    >
      <ChangePreview
        title="Hizmet tarihleri"
        rows={[
          { label: 'Hizmet sonu', before: formatLongDate(service.serviceEndedAt), after: '—' },
          { label: 'Son görüntüleme günü', before: formatLongDate(service.viewUntil), after: '—' },
          { label: 'Saklama bitişi', before: formatLongDate(service.retainUntil), after: '—' },
        ]}
        note={`Firma geçmişiyle devam eder; eski tarihler işletim geçmişinde kalır.${company.isSuspended ? ' Firma geçici olarak durdurulmuş; durdurma ayrıca kaldırılmalı.' : ''}`}
      />
    </ActionDialog>
  );
}

/** Arşiv uzat: yalnız saklama bitişi ileri alınır; görüntüleme süresi ve müşteri erişimi değişmez. */
export function ExtendRetentionDialog({
  company,
  onClose,
}: {
  company: PlatformCompany;
  onClose: () => void;
}) {
  const done = useAfterSuccess(onClose);
  const { retainUntil, viewUntil } = company.service;
  const today = todayInIstanbul();
  const earliest =
    retainUntil && compareIsoDates(addDays(retainUntil, 1), today) > 0
      ? addDays(retainUntil, 1)
      : today;
  const [date, setDate] = useState('');
  const dateError =
    date === ''
      ? undefined
      : compareIsoDates(date, earliest) < 0
        ? `En erken ${formatLongDate(earliest)} seçilebilir.`
        : undefined;

  return (
    <ActionDialog
      open
      title="Arşiv saklamasını uzat"
      confirmLabel="Uzat"
      onClose={onClose}
      confirmDisabled={date === '' || Boolean(dateError)}
      onConfirm={async (reason) => {
        await adminPost(companyPath(company.id, '/extend-retention'), {
          retainUntil: date,
          reason,
        });
        await done('Arşiv saklaması uzatıldı.');
      }}
    >
      <Field
        label="Yeni saklama bitişi"
        required
        error={dateError}
        hint="Mevcut bitişten sonra ve bugünden önce olmamalı."
      >
        {(props) => (
          <DateInput
            {...props}
            min={earliest}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        )}
      </Field>
      {date && !dateError ? (
        <ChangePreview
          title="Hizmet tarihleri"
          rows={[
            {
              label: 'Saklama bitişi',
              before: formatLongDate(retainUntil),
              after: formatLongDate(date),
            },
            {
              label: 'Son görüntüleme günü',
              before: formatLongDate(viewUntil),
              after: formatLongDate(viewUntil),
              changed: false,
            },
          ]}
          note="Uzatma müşteri erişimini açmaz."
        />
      ) : null}
    </ActionDialog>
  );
}
