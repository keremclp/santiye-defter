import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';

/**
 * Kaydedilmemiş formdan çıkışta sorar (şartname 11). Uyarı, sonucu belirsiz bir gönderimi iptal
 * ettiğini iddia etmez. Başarılı kayıttan sonraki yönlendirme için `allowNavigation` çağrılır.
 */
export function useUnsavedChanges(dirty: boolean, uncertainSubmission = false) {
  const allowed = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !allowed.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowed.current) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const allowNavigation = useCallback(() => {
    allowed.current = true;
  }, []);

  const dialog = (
    <Dialog
      open={blocker.state === 'blocked'}
      title="Kaydedilmemiş değişiklikler"
      onClose={() => blocker.reset?.()}
      actions={
        <>
          <Button variant="secondary" onClick={() => blocker.reset?.()}>
            Formda kal
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()}>
            Çık
          </Button>
        </>
      }
    >
      <p>Kaydedilmemiş değişiklikler. Çıkmak istediğinize emin misiniz?</p>
      {uncertainSubmission ? (
        <p className="meta">
          Gönderdiğiniz kaydın durumu henüz doğrulanmadı. Çıkmanız gönderimi iptal etmez; kaydın
          oluşup oluşmadığını işlem listesinden kontrol edin ve yeni kayıt açmadan önce emin olun.
        </p>
      ) : (
        <p className="meta">Formdaki bilgiler bu sayfadan çıkınca kaybolur.</p>
      )}
    </Dialog>
  );

  return { dialog, allowNavigation };
}
