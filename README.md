# Şantiye Hesap

Müteahhitler için şantiye gelir-gider, anlaşma, borç-alacak ve vade takibi yapan çok firmalı web ürünü. Ürün şartnamesi [santiye-hesap-web-prompt.md](santiye-hesap-web-prompt.md), çalışma kuralları [AGENTS.md](AGENTS.md) dosyasındadır.

## Yapı

```text
apps/web          React 19 + Vite + React Router (tanıtım, demo, uygulama, yönetim)
apps/api          Express + Mongoose REST API
packages/shared   Ortak tipler, Zod şemaları ve saf finans fonksiyonları
```

## Gereksinimler

- Node.js 24 LTS (`.nvmrc`)
- pnpm 12 (`npm i -g pnpm` veya `corepack enable pnpm`)
- Docker (yerel MongoDB ve MinIO için)

## Kurulum

1. Bağımlılıkları kurun:

   ```bash
   pnpm install
   ```

2. Ortam dosyasını oluşturun ve doldurun:

   ```bash
   cp .env.example .env
   ```

   `docker compose` için `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY` (en az 3 karakter) ve `STORAGE_SECRET_KEY` (en az 8 karakter) zorunludur; yerel MinIO bu değerlerle açılır. Yerelde `STORAGE_ENDPOINT=http://localhost:9000` kullanın.

   API her ortamda şu gizli değerler olmadan başlamaz: `JWT_ACCESS_SECRET` ve `JWT_REFRESH_SECRET` (en az 32 karakter, birbirinden farklı), `PLATFORM_TOTP_ENCRYPTION_KEY` (en az 32 bayt). Rastgele değer üretmek için:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   İlk ürün sahibi hesabı için `PLATFORM_BOOTSTRAP_USERNAME` ve `PLATFORM_BOOTSTRAP_PASSWORD` doldurulur; hesap yoksa API açılışında bir kez oluşturulur ve ilk girişte TOTP kurulumu zorunludur.

   Geliştirmede boş bırakılırsa API şu yerel varsayılanları kullanır: `PORT=3000`, `MONGODB_URI=mongodb://localhost:27017/santiye_hesap?replicaSet=rs0`, `WEB_ORIGIN=http://localhost:5173`. Üretimde (`NODE_ENV=production`) bu değerler zorunludur.

3. Yerel servisleri başlatın:

   ```bash
   docker compose up -d
   ```

   - MongoDB 8.2, tek düğümlü replica set (`rs0`, transaction açık): `localhost:27017`
   - MinIO (S3 uyumlu, kova herkese kapalı): API `localhost:9000`, konsol `localhost:9001`

   Resmi MinIO Docker imajları artık dağıtılmadığı için MinIO kaynağından derlenen topluluk imajı `pgsty/minio` kullanılır.

## Çalıştırma

```bash
pnpm dev
```

- API: http://localhost:3000 (`GET /health` → `{ "success": true, "status": "ok" }`)
- Web: http://localhost:5173

## Komutlar

| Komut            | İş                                                           |
| ---------------- | ------------------------------------------------------------ |
| `pnpm dev`       | API ve web geliştirme sunucuları                             |
| `pnpm test`      | Bütün paketlerde Vitest                                      |
| `pnpm lint`      | ESLint ve Prettier denetimi                                  |
| `pnpm format`    | Prettier ile biçimlendirme                                   |
| `pnpm typecheck` | TypeScript tip denetimi                                      |
| `pnpm build`     | `packages/shared`, `apps/api` ve `apps/web` üretim derlemesi |

Ürün sahibinin telefonu ve kurtarma kodları birlikte kaybolursa iki aşamalı doğrulama yalnız sunucuda, derlenmiş API ile sıfırlanır (`pnpm build` sonrası):

```bash
pnpm --filter api platform:reset-2fa --username <ad>
```

API testleri `mongodb-memory-server` ile bellek içi bir MongoDB replica set açar; ilk çalıştırmada MongoDB ikilisi indirilir (birkaç yüz MB), sonra önbellekten kullanılır. Testler Docker gerektirmez.

GitHub Actions her push ve pull request'te `lint`, `typecheck`, `test` ve `build` çalıştırır.
