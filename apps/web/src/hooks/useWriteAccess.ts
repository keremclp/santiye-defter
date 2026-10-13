import { useSession } from '../stores/session';
import { formatLongDate } from '../lib/format';

/**
 * Hizmet durumuna göre kayıt değiştirme izni (şartname 9.10). Görüntüleme döneminde değişiklik
 * düğmeleri kapalıdır ve nedeni yazılır.
 */
export function useWriteAccess(): { canWrite: boolean; reason: string | null } {
  const service = useSession((state) => state.service);
  if (!service || service.state === 'active') return { canWrite: true, reason: null };
  if (service.state === 'view_only') {
    const until = service.viewUntil ? ` (son gün: ${formatLongDate(service.viewUntil)})` : '';
    return {
      canWrite: false,
      reason: `Hizmetiniz sona erdi; kayıtlar yalnız görüntülenebilir ve dışa aktarılabilir${until}.`,
    };
  }
  return { canWrite: false, reason: 'Firmanızın erişimi kapalı.' };
}
