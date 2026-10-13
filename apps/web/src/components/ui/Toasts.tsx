import { useUi } from '../../stores/ui';

/** Kısa bildirimler; tarayıcı `alert` kullanılmaz (şartname 4.4). */
export function Toasts() {
  const toasts = useUi((state) => state.toasts);
  return (
    <div className="toast-region" aria-live="polite" role="status">
      {toasts.map((item) => (
        <div key={item.id} className="toast">
          {item.message}
        </div>
      ))}
    </div>
  );
}
