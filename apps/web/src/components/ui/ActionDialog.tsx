import { useId, useState, type ReactNode } from 'react';
import { errorMessage, isApiError } from '../../api/client';
import { Button, type ButtonVariant } from './Button';
import { Dialog } from './Dialog';
import { Field, TextArea } from './Field';

export interface ActionDialogProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  /** Gerekçe verilir; hata fırlatırsa dialog açık kalır ve hata gösterilir. */
  onConfirm: (reason: string) => Promise<unknown>;
  /** 409 CONFLICT gelince güncel veriyi yeniden yükler; önizleme yeni veriyle yenilenir. */
  onConflict?: () => unknown;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  /** Gerekçe zorunlu mu (silme, geri yükleme, bedel, vade, iptal...). */
  reason?: 'required' | 'optional' | 'none';
  reasonLabel?: string;
  /** Önce → sonra kutusu ve açıklamalar. */
  children?: ReactNode;
  /** Onay engellenmişse nedeni (ör. bağlı iade var). */
  blockedReason?: string | null;
  confirmDisabled?: boolean;
}

/**
 * Onay + gerekçe dialogu (şartname 4.4): önce etki önizlemesi, altında zorunlu gerekçe.
 * Kayıt bu arada değişmişse eski önizlemeyle tamamlanmaz; güncel veri yüklenir ve yeniden onay istenir.
 */
export function ActionDialog(props: ActionDialogProps) {
  // Her açılışta gerekçe, hata ve çakışma durumu sıfırdan başlar.
  return props.open ? <ActionDialogBody {...props} /> : null;
}

function ActionDialogBody({
  open,
  title,
  onClose,
  onConfirm,
  onConflict,
  confirmLabel,
  confirmVariant = 'primary',
  reason: reasonMode = 'required',
  reasonLabel = 'Gerekçe',
  children,
  blockedReason,
  confirmDisabled,
}: ActionDialogProps) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [error, setError] = useState<{ message: string; issues: string[] } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const formId = useId();

  async function confirm() {
    if (reasonMode === 'required' && reason.trim() === '') {
      setReasonError('Gerekçe girin.');
      return;
    }
    setReasonError(undefined);
    setError(null);
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } catch (caught) {
      if (isApiError(caught) && caught.code === 'CONFLICT' && caught.current !== undefined) {
        setConflict(true);
        await onConflict?.();
      } else {
        setError({
          message: errorMessage(caught),
          issues: isApiError(caught)
            ? caught.issues.map((issue) => issue.message).filter((m) => m !== caught.message)
            : [],
        });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      locked={busy}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button
            variant={confirmVariant}
            type="submit"
            form={formId}
            loading={busy}
            loadingText="İşleniyor…"
            disabled={Boolean(blockedReason) || confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void confirm();
        }}
      >
        {conflict ? (
          <div className="alert alert--danger" role="alert">
            <p className="alert__title">Kayıt başka bir yerde güncellendi</p>
            <p>Önizleme güncel bilgiyle yenilendi. Lütfen yeniden değerlendirip onaylayın.</p>
          </div>
        ) : null}
        {children}
        {blockedReason ? (
          <div className="alert alert--danger" role="alert">
            <p className="alert__title">Bu işlem yapılamıyor</p>
            <p>{blockedReason}</p>
          </div>
        ) : null}
        {reasonMode !== 'none' && !blockedReason ? (
          <Field label={reasonLabel} required={reasonMode === 'required'} error={reasonError}>
            {(props) => (
              <TextArea
                {...props}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
          </Field>
        ) : null}
        {error ? (
          <div className="alert alert--danger" role="alert">
            <p className="alert__title">{error.message}</p>
            {error.issues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
