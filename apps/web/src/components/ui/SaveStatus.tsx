import type { SaveState } from '../../api/submission';
import { Button } from './Button';

const TEXT = {
  saving: { icon: '⏳', title: 'Kaydediliyor' },
  saved: { icon: '✓', title: 'Kaydedildi' },
  failed: { icon: '✕', title: 'Kaydedilemedi' },
  verifying: { icon: '↻', title: 'Kaydın durumu doğrulanıyor. Lütfen yeni kayıt açmayın.' },
} as const;

/**
 * Kaydetme durumu (şartname 4.4, 9.7): dört durum ayrı metin ve ikonla, yalnız renge bırakılmaz.
 * "Doğrulanıyor" kesin başarısızlık gibi sunulmaz ve sayfada kalıcı görünür.
 */
export function SaveStatus({
  state,
  onVerify,
}: {
  state: SaveState;
  /** Doğrulanıyor durumunda elle yeniden sorma. */
  onVerify?: () => void;
}) {
  if (state.status === 'idle') return null;
  const text = TEXT[state.status];
  const live = state.status === 'failed' || state.status === 'verifying' ? 'assertive' : 'polite';

  return (
    <div className={`save-status save-status--${state.status}`} role="status" aria-live={live}>
      <span className="save-status__icon" aria-hidden="true">
        {text.icon}
      </span>
      <div className="stack stack--sm">
        <span>{text.title}</span>
        {state.status === 'saved' && state.message ? (
          <span className="meta">{state.message}</span>
        ) : null}
        {state.status === 'failed' ? <span>{state.message}</span> : null}
        {state.status === 'verifying' ? (
          <>
            {state.found === true ? <span>Kayıt sunucuda bulundu; sonuç alınıyor.</span> : null}
            {state.found === false ? (
              <span>Kayıt sunucuya ulaşmamış; aynı gönderim güvenle tekrarlanıyor.</span>
            ) : null}
            <span className="meta">
              Bağlantı dönünce kendiliğinden yeniden denenir. Aynı gönderim iki kayıt açmaz.
            </span>
            {onVerify ? (
              <Button variant="secondary" size="small" onClick={onVerify} disabled={state.checking}>
                {state.checking ? 'Kontrol ediliyor…' : 'Durumu şimdi kontrol et'}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
