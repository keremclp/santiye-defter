import { useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 759px)';
export const WIDE_QUERY = '(min-width: 1100px)';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** < 760 px: tablolar kart listesine döner (şartname 4.5, 11). */
export const usePhone = () => useMediaQuery(PHONE_QUERY);
