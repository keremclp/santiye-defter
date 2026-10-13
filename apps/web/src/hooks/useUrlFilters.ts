import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Liste filtreleri URL sorgusunda tutulur; detaydan dönünce filtre ve sayfa korunur
 * (şartname 7.4, 11). Varsayılan değerler URL'ye yazılmaz.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = params.get(key as string);
      if (value !== null) result[key] = value as T[keyof T];
    }
    return result;
    // defaults her render'da yeni nesne olabilir; anahtarları ve değerleri sabittir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback(
    (patch: Partial<T>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch) as [string, string | undefined][]) {
            if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
            else next.set(key, value);
          }
          // Filtre değişince ilk sayfaya dönülür.
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  const clear = useCallback(() => {
    setParams(new URLSearchParams(), { replace: true });
  }, [setParams]);

  /** Varsayılandan farklı filtre sayısı (sayfa hariç). */
  const activeCount = Object.keys(defaults).filter(
    (key) => key !== 'page' && values[key] !== defaults[key],
  ).length;

  return { values, update, clear, activeCount };
}
