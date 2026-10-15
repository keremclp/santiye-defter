# Şantiye Hesap — Ajan kuralları

Bu dosya bu depoda çalışan bütün kod ajanları (Codex, Claude Code vb.) içindir. `CLAUDE.md` bu dosyayı içe aktarır; kuralları yalnız burada güncelleyin.

## Proje

Şantiye Hesap, müteahhitlere satılacak çok firmalı bir web ürünü. Firmalar şantiye gelir-giderini, ödenecek/tahsil edilecek anlaşmaları, borç-alacağı, vadeleri ve belgeleri takip eder. Bu kapsamda mobil uygulama yok; web arayüzü telefon önceliklidir.

## Kaynak belgeler ve öncelik

1. **Kullanıcının o oturumdaki talimatı.**
2. [`santiye-hesap-web-prompt.md`](santiye-hesap-web-prompt.md) — ürün şartnamesi. Ekranlar, veri modeli, iş kuralları, API ve kabul ölçütleri buradadır. Kod buna uyar.
3. [`proje_kapsami_ve_planlama_kararlari.md`](proje_kapsami_ve_planlama_kararlari.md) — kabul edilmiş ürün kararları ve gerekçeleri. Şartnamede açık olmayan bir konunun niyeti buradan anlaşılır.
4. [`gelistirme/gorev_metinleri.md`](gelistirme/gorev_metinleri.md) — geliştirme adımları (Adım 0–10) ve her adımın bitiş ölçütleri.

`teknik_plan/` klasörü iptal edilmiştir; varsa yok sayın.

Şartname ile karar belgesi çelişirse veya şartname eksik ya da uygulanamaz görünürse **kendin karar verme**. Durumu ve seçenekleri yaz, kullanıcıdan karar iste. Şartnameyi, karar belgesini veya görev metinlerini kullanıcı açıkça istemeden değiştirme.

## Çalışma biçimi

- Her oturumda yalnız kullanıcının verdiği adımı yap. Sonraki adımların işine başlama; önceki adımların kodunu yalnız gerekiyorsa ve gerekçesini belirterek değiştir.
- Şartnamede olmayan modül, ekran, alan veya iş kuralı ekleme. Kapsam dışı liste şartnamenin sonundadır.
- İş bitince raporla: yapılanlar, değişen dosyalar, çalıştırılan testler ve sonuçları, bilerek bırakılan açık noktalar. Test çalıştırmadıysan veya bir test başarısızsa bunu açıkça söyle.
- Git'te commit, push veya branch işlemini kullanıcı istemedikçe yapma.

## Dil

- Arayüz metinleri, hata mesajları, rapor ve PDF içerikleri **Türkçe**.
- Kullanıcıya yazılan raporlar ve açıklamalar Türkçe.
- Kod, tanımlayıcılar, veritabanı alanları ve API yolları şartnamedeki gibi İngilizce. Ekran rotaları şartnamedeki Türkçe yollardır (`/uygulama/islemler` vb.).
- Kod yorumları kısa ve yalnız gerekli yerde.

## Teknoloji

pnpm workspaces monorepo: `apps/web` (React 19, TypeScript, Vite, React Router, TanStack Query, Zustand, React Hook Form + Zod, Axios), `apps/api` (Node.js, Express, TypeScript, Zod, Mongoose), `packages/shared` (ortak Zod şemaları ve saf finans fonksiyonları). Ayrıntı şartname bölüm 2'de. Şartnamede olmayan bir bağımlılık eklemeden önce gerekçesini raporda belirt.

## Pazarlık konusu olmayan kurallar

Bunlardan herhangi birini çiğneyen değişiklik hatalıdır:

1. **Firma ayrımı:** Firma verisi taşıyan her sorgu `companyId` ile filtrelenir. Filtre servis katmanında zorla eklenir; istemciden gelen `companyId` kullanılmaz. Başka firmanın kaydı istenirse 404 döner. Her yeni uç, firma yalıtım testine eklenir.
2. **Para:** Tutarlar kuruş cinsinden tamsayıdır. Kayan noktalı sayıyla para hesabı yapılmaz.
3. **Finans formülleri:** Kalan, fazla, gecikme, dönem neti ve iade sınırı yalnız `packages/shared` içindeki saf fonksiyonlarla hesaplanır. API veya web bu formülleri yeniden yazmaz.
4. **Anlaşma gider değildir:** Anlaşma veya başlangıç kaydı oluşturmak gelir/gider hareketi yazmaz. Gelir ve gideri yalnız gerçek para hareketi oluşturur.
5. **Atomiklik:** Hareket, paylar, bağlı anlaşma önbellekleri, `refundedAmount`, kayıt geçmişi ve idempotency kaydı tek MongoDB transaction'ında değişir.
6. **Çift kayıt yok:** Oluşturan `POST` istekleri `Idempotency-Key` kuralına şartname bölüm 3'teki "Güvenli tekrar" listesine göre uyar: para hareketi, anlaşma, başlangıç kaydı, iade ve ürün sahibinin firma/kullanıcı oluşturmasında zorunlu; şantiye, kişi, kategori ve belge yükleme niyetinde isteğe bağlı. Web her oluşturma isteğinde anahtar gönderir. Güncellemeler `expectedUpdatedAt` ile çakışma kontrolü yapar ve sessizce üzerine yazmaz.
7. **Silme yumuşaktır:** Müşteri tarafında fiziksel silme yoktur. Finansal değişiklik, silme ve geri yükleme gerekçe ister ve `history`'ye yazılır. Kalıcı silme yalnız ürün sahibinin firma silme akışındadır.
8. **Tarih:** İş tarihleri `YYYY-MM-DD` metnidir. "Bugün" Europe/Istanbul gününe göre hesaplanır.
9. **Tasarım:** Renkler, yazı tipleri ve ölçüler yalnız şartname bölüm 4'teki token'lardan gelir. Yakın renk uydurulmaz. Gelir yeşil, gider kırmızıdır; anlam yalnız renge bırakılmaz.
10. **Güvenlik:** Gizli anahtar, şifre veya token koda, loga, teste ya da dışa aktarma dosyasına yazılmaz. Gerçek müşteri verisi testte veya örnek veride kullanılmaz. `.env` dosyaları commit edilmez; yeni değişkenler `.env.example`'a değersiz eklenir.

## Testler

- Finans kuralı değişikliği, şartname bölüm 9'daki örnek tutarlarla birim testi olmadan bitmiş sayılmaz.
- API değişiklikleri bellek içi MongoDB replica set üzerinde entegrasyon testiyle doğrulanır; transaction gerektiren davranış replica set olmadan test edilmez.
- Bir işi bitirmeden önce şunlar temiz geçmeli: `pnpm lint`, `pnpm typecheck`, `pnpm test`. Komutlar henüz yoksa (Adım 0 öncesi) bunu raporda belirt.
- Testi geçirmek için testi zayıflatma, atlama veya beklenen değeri koda uydurma. Test yanlışsa nedenini raporla.

## Yerel çalışma

- `docker compose up -d` — yerel MongoDB (replica set) ve MinIO.
- `pnpm dev` — API ve web.
- `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.

Bu komutlar Adım 0'da kurulur. Değişirlerse bu bölümü güncelleme önerisini raporda belirt.
