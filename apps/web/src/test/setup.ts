import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// Tembel yüklenen rotalar, bütün paket paralel koşarken 1 sn'lik varsayılan beklemeyi aşabiliyor.
configure({ asyncUtilTimeout: 3000 });

// jsdom'da yok; varsayılan masaüstü genişliği (telefon sorgusu eşleşmez).
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
