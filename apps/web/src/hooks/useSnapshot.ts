import { useState } from 'react';

/**
 * Açık formun başlangıç verisi. Sorgu arka planda yenilense de (pencereye dönünce vb.) form sessizce
 * sıfırlanmaz; güncel kayıt yalnız kullanıcı istediğinde (`replace`) forma yüklenir (şartname 11).
 */
export function useSnapshot<T>(data: T | undefined): [T | undefined, (next: T) => void] {
  const [snapshot, setSnapshot] = useState(data);
  if (snapshot === undefined && data !== undefined) setSnapshot(data);
  return [snapshot ?? data, setSnapshot];
}
