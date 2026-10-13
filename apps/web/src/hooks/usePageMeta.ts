import { useEffect } from 'react';

/** Sayfa başlığı; uygulama ve giriş rotaları arama motorlarına kapalı (şartname 11). */
export function usePageMeta(title: string) {
  useEffect(() => {
    document.title = `${title} — Şantiye Hesap`;
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex, nofollow';
  }, [title]);
}
