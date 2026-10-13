import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

export default defineConfig({
  plugins: [react()],
  // Ortam değişkenleri depo kökündeki .env'den okunur. Tarayıcıya yalnız VITE_ önekliler ve
  // ürün sahibinin iletişim metni (SUPPORT_CONTACT_TEXT) derleme anında geçer.
  envDir: '../..',
  envPrefix: ['VITE_', 'SUPPORT_CONTACT_TEXT'],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@santiye/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    // Token testi CSS dosyalarını ham metin olarak okur; varsayılanda Vitest CSS'i boş döndürür.
    css: true,
  },
});
