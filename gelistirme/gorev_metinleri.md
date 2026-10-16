# Şantiye Hesap — Geliştirme adımları için görev metinleri

Bu dosya, geliştirmeyi yapan modele (Claude Code, Codex vb.) her oturumda verilecek kısa görev metinlerini içerir. Şartname [../santiye-hesap-web-prompt.md](../santiye-hesap-web-prompt.md) tek parça kalır; bölünen şey iştir.

Karar belgesindeki planlama aşamalarıyla (Aşama 0–5) karışmasın diye geliştirme parçalarına **Adım 0–10** denir.

## Kullanım

1. Her yeni oturumda aşağıdaki **ortak giriş** metnini, ardından ilgili adımın metnini olduğu gibi yapıştırın.
2. Bir adım bitmeden sonrakine geçmeyin. Bitiş ölçütleri sağlanınca:
   - Testlerin geçtiğini kendiniz görün (`pnpm test`).
   - Değişiklikleri gözden geçirin.
   - Git'e commit atın (örnek mesaj: `Adım 2: API temeli`).
3. Model şartnamede çelişki veya eksik bildirirse kararı siz verin. Karar şartnameyi değiştiriyorsa önce şartnameyi ve karar belgesini güncelleyin, sonra devam edin.
4. Bir adım tek oturuma sığmazsa aynı metni yeni oturumda "kaldığın yerden devam et; önce `git status` ve `git diff --stat` ile ne yapıldığına bak" notuyla tekrar verin.
5. Kullanım limiti için büyük adımlar (4b, 5, 6, 7) ikiye bölünmüştür; her yarı ayrı oturumda yapılıp ayrı commit edilir.

## Ortak giriş (her oturumun başına)

```text
Bu depodaki `santiye-hesap-web-prompt.md` dosyası ürünün şartnamesidir. Adım metninde "Okunacaklar" satırı varsa yalnız orada yazan bölümleri oku; yoksa tamamını oku. Ayrıca AGENTS.md / CLAUDE.md kurallarına uy.
Bu oturumda yalnız aşağıda belirtilen adımı yap. Önceki adımların kodunu yalnız bu adım için gerekiyorsa ve gerekçesini belirterek değiştir; sonraki adımların işine başlama.
Şartnamede çelişki, eksik veya uygulanamaz bir nokta bulursan kendin karar verme: dur, durumu ve seçenekleri yaz, benden karar iste.
Bitince şunları raporla: yapılanlar, eklenen/değişen dosyalar, çalıştırdığın testler ve sonuçları, bilerek bıraktığın açık noktalar.
```

---

## Adım 0 — Proje iskeleti

```text
ADIM 0 — Proje iskeleti
İlgili şartname bölümleri: 2, 3 (yalnız genel yapı ve hata/yanıt biçimi).

Yap:
- pnpm workspaces monorepo: apps/web, apps/api, packages/shared. TypeScript strict, ESLint, Prettier.
- Test altyapısı: Vitest (shared ve api), API entegrasyonu için mongodb-memory-server replica set ve Supertest; web için Vitest + Testing Library.
- docker-compose: yerel MongoDB (tek düğümlü replica set, transaction açık) ve MinIO (S3 uyumlu belge deposu).
- apps/api: Express iskeleti, helmet, cors, json, istek logu, merkezi hata işleyici, `{ success, data }` / `{ success: false, message, code }` yanıt biçimi, GET /health.
- apps/web: Vite + React 19 + React Router iskeleti, boş "Şantiye Hesap" sayfası.
- Kök komutlar: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- `.env.example` (şartname bölüm 2'deki bütün değişkenler, gerçek değer olmadan), `.gitignore`, kısa README (kurulum ve çalıştırma).
- GitHub Actions: lint, typecheck, test, build.

Yapma: veri modeli, iş kuralı, ekran tasarımı.

Bitti sayılması için:
- `docker compose up` sonrası `pnpm dev` ile API ve web ayağa kalkar; /health `{ success: true, status: "ok" }` döner.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` hatasız geçer.
```

## Adım 1 — Finans çekirdeği

```text
ADIM 1 — Finans çekirdeği (saf fonksiyonlar)
İlgili şartname bölümleri: 3 (para ve tarih kuralları), 8.6, 8.7, 9.1–9.4.

Yap (packages/shared içinde, veritabanı ve HTTP bağımlılığı olmadan):
- Para: TL metnini ("12500", "12.500,50") kuruş tamsayıya çevirme ve kuruşu tr-TR biçimine çevirme; en fazla iki ondalık; geçersiz girdiyi reddetme.
- Tarih: YYYY-MM-DD doğrulama, Europe/Istanbul'a göre "bugün", tarih karşılaştırma.
- Hareket ve pay doğrulaması: pay toplamı = tutar, yön–anlaşma uyumu, kapsam uyumu.
- Anlaşma/başlangıç hesabı: net ödenen/tahsil edilen, kalan, fazla, paymentStatus, gecikmiş/yaklaşan/vadesiz.
- İade: pay bazında en fazla iade edilebilir tutar, sınır kontrolü, ana tutarın iade toplamı altına inememesi.
- Toplamlar: dönem net tahsilat/ödeme/fark (iade kendi tarihinin dönemine), şantiye toplamı paylardan, firma toplamı hareket tutarından.
- Fazla ödeme tespiti: verilen ödemenin kalanı ne kadar aştığı.
- Ortak Zod şemaları: hareket, pay, iade, anlaşma, başlangıç kaydı girişleri.

Testler: Şartname bölüm 9'daki her örnek tutar birebir test olsun (120.000/45.000/75.000; ek iş 140.000/95.000; bedel düşüşü 40.000 → fazla 5.000; iptal 30.000 → fazla 15.000 ve iade sonrası net 30.000; başlangıç 75.000/25.000/50.000; paylaştırma 25.000+15.000; iade sınırı 45.000−5.000 → 40.000; ocak 40.000 / şubat −10.000; gecikme ve kısmi ödeme vade kuralları).

Yapma: Mongoose modeli, API rotası, ekran.

Bitti sayılması için: Bütün örnekler testte geçer; fonksiyonların kenar durumları (sıfır, tam kalan, kuruş yuvarlama) testli; `pnpm test` ve `pnpm typecheck` temiz.
```

## Adım 2 — API temeli: kimlik, firma ayrımı, ortak altyapı

```text
ADIM 2 — API temeli
İlgili şartname bölümleri: 3 (kurallar ve kimlik akışı), 8 (ortak alanlar, 8.1, 8.2, 8.10), 9.7, 9.8, 9.10, 10.1, 10.10 (yalnız auth, firma ve kullanıcı uçları).

Yap:
- Mongoose modelleri: Company, User, PlatformAdmin, IdempotencyRecord, PlatformLog ve bütün firma modelleri için ortak alan eklentisi (companyId, deletedAt/By/Reason, createdBy, updatedBy, history).
- Firma bağlamı: kullanıcı → firma → etkin hizmet durumu her istekte hesaplanır; companyId sorgulara servis katmanında zorla eklenir; başka firma kaydı 404.
- Hizmet durumu erişim tablosu (9.10): READ_ONLY ve ACCESS_CLOSED davranışları.
- Müşteri kimliği: kullanıcı adı + şifre girişi, JWT access 15 dk / refresh 30 gün ve dönen refresh, logout, /auth/me, profil, şifre değişimi, mustChangePassword akışı, deneme sınırı, tüm oturumları düşürme.
- Ürün sahibi kimliği: ayrı token türü, bootstrap hesabı, şifre + zorunlu TOTP, ilk girişte TOTP kurulumu, 10 kurtarma kodu, kurtarma koduyla giriş, kodları yenileme, ikinci adım kilidi, `platform:reset-2fa` komutu.
- Yönetim API'si (yalnız temel): firma oluştur/listele/detay, kullanıcı oluştur (bir kez gösterilen geçici şifre), kullanıcı pasifleştir, şifre sıfırla. PlatformLog kayıtları.
- Ortak altyapı: Idempotency-Key ara katmanı (aynı anahtar+gövde → aynı sonuç, farklı gövde → 422, 24 saat sınırı, işlemle aynı transaction), expectedUpdatedAt çakışma kontrolü yardımcıları, transaction yardımcısı.
- Firma yalıtım test altyapısı: sonraki adımlarda her yeni uca kolayca eklenebilen ortak test (başka firma kimliğiyle çağrı → 404, veri sızmaz).

Yapma: şantiye, kişi, işlem, anlaşma uçları; ekranlar.

Bitti sayılması için:
- Giriş, refresh, logout, ilk şifre, şifre değişimi, deneme sınırı testli.
- Ürün sahibi TOTP kurulumu, TOTP ile giriş, kurtarma koduyla giriş (kod tek kullanımlık), kilit ve sıfırlama komutu testli.
- Hizmet durumu tablosunun her satırı testli.
- Aynı Idempotency-Key ile eşzamanlı iki istek tek sonuç üretir.
- Müşteri token'ı /platform'a, ürün sahibi token'ı müşteri uçlarına erişemez.
```

## Adım 3 — Finans API'si

```text
ADIM 3 — Finans API'si
İlgili şartname bölümleri: 8.3–8.7, 8.9, 9 (tamamı), 10.3–10.7, 10.9 (pano, vade, arama, silinenler; raporlar hariç).

Yap:
- Modeller ve indeksler: Project, Party, Category, Transaction (allocations, refundOf, excess), Agreement (agreement/opening, amountHistory, dueDateHistory, önbellek alanları), SearchHistory.
- Uçlar: projeler, kişiler, kategoriler, işlemler (oluştur, düzelt, iade, kopyala, sil, geri al), anlaşmalar (oluştur, bedel değiştir, vade değiştir, iş durumu, iptal, sil, geri al), /idempotency/:key, /dashboard, /dues, /search ve geçmişi, /deleted.
- Bütün finansal değişiklikler tek MongoDB transaction'ında: hareket + paylar + bağlı anlaşma önbellekleri + refundedAmount + history + idempotency kaydı.
- Adım 1'deki saf fonksiyonları kullan; formülleri API'de yeniden yazma.
- Kurallar: anlaşma hareket yazmaz; fazla ödeme onay+gerekçe (EXCESS_CONFIRMATION_REQUIRED); bağımlılığı olan kaydın silinememesi (HAS_DEPENDENCIES); geri yüklemede ilişki ve iade sınırı doğrulaması; gerekçe zorunlulukları; mükerrer uyarısı; şantiye tamamla/yeniden aktifleştir/arşivle; kişi pasifleştirme; yeni firmaya başlangıç kategorileri.
- Liste uçlarında sayfalama ve bütün filtrelenmiş sonuçların `totals` alanı; şantiye filtresinde pay bazlı toplam.
- Arama: Türkçe katlamalı alanlar, tutar araması, firma filtresi, kullanıcıya özel geçmiş.

Yapma: belge yükleme, rapor/dışa aktarma dosyaları, ekranlar.

Bitti sayılması için:
- Bölüm 9'daki bütün örnek senaryolar API üzerinden uçtan uca (entegrasyon testi) aynı tutarları üretir.
- Düzeltme (yanlış şantiye/anlaşma bağlantısı dahil), silme, geri yükleme ve iade sonrası anlaşma önbellekleri ve refundedAmount doğru; aynı hareket iki kez sayılmaz.
- Her yeni uç firma yalıtım testine eklenmiş ve geçiyor.
- expectedUpdatedAt çakışması 409 ve güncel kayıt döndürür.
```

## Adım 4 — Uygulama ekranları

```text
ADIM 4 — Uygulama ekranları
İlgili şartname bölümleri: 4 (tamamı), 5.1 (yalnız /giris, /ilk-sifre, /sifremi-unuttum), 5.2, 7.1–7.9, 7.11, 7.12, 11, 12.

Yap:
- Tasarım token dosyası (bölüm 4'teki hex değerleri birebir), Outfit ve DM Sans, temel bileşenler (düğmeler, input, chip, kart, boş durum, dialog, etki önizlemesi, kaydetme durumu çubuğu).
- Yerleşim: ≥1100 sol menü, 760–1099 drawer, <760 alt menü + "+ Kayıt" eylemi; tablolar telefonda karta döner.
- Axios istemcisi: Bearer, 401'de tek refresh denemesi, Idempotency-Key üretimi ve "Kaydın durumu doğrulanıyor" akışı, ağ hatası davranışı.
- Ekranlar: giriş, ilk şifre, şifremi unuttum, özet, şantiyeler (liste/form/detay/durum eylemleri), kişiler, işlemler (liste/form/paylaştırma/detay/düzeltme/iade/kopyala/sil), anlaşmalar ve başlangıç kayıtları (liste/form/detay/ödeme/bedel/vade/iptal), vadeler, arama, silinenler, ayarlar (profil, şifre, firma, kategoriler, hakkında). Rapor sayfası için yalnız yer tutucu bağlantı.
- Filtrelerin URL'de tutulması, kaydedilmemiş form uyarısı, 409 karşılaştırma ekranı, yükleniyor/boş/hata durumları, görüntüleme dönemi bandı ve kapalı eylemlerin nedeni.
- Belge alanları için yalnız yer tutucu (Adım 5'te bağlanacak).

Yapma: belge yükleme, rapor/dışa aktarma, yönetim ekranları, demo, tanıtım sitesi.

Bitti sayılması için:
- Telefon (375 px) ve masaüstü genişliğinde giriş → ilk şifre → şantiye oluştur → gider kaydet → anlaşma oluştur → anlaşmaya kısmi ödeme → paylaştırılmış ödeme → iade → sil/geri al akışları çalışır; ekrandaki tutarlar API özetiyle aynıdır.
- Renkler yalnız token dosyasından gelir; gelir yeşil, gider kırmızı, iade ve gecikmiş yazıyla da belirtilir.
- Temel bileşen ve form testleri geçer.
```

## Adım 4b — Görsel revizyon (iki oturum: 4b-1 ve 4b-2)

Adım 4'ün ekranları işlevsel olarak kabul edildi; görünüm onaylanan taslağa göre yenilenir. Adım 5'ten önce yapılır ki sonraki ekranlar yeni bileşenlerle gelsin. Kullanım limitine sığması için iki ayrı oturuma bölündü; her biri kendi başına bitirilip commit edilir.

**Token tasarrufu:** Bu iki adımda şartnamenin tamamını okumak gerekmez. Ortak girişteki "tamamını oku" cümlesi yerine adım metnindeki "Okunacaklar" satırı geçerlidir.

### Adım 4b-1 — Temel, yerleşim ve üç ana ekran

```text
ADIM 4b-1 — Görsel revizyon: temel, yerleşim ve üç ana ekran
Okunacaklar: şartnamede yalnız bölüm 4 (tamamı), 5.2'nin son paragrafı (sol menü), 7.1, 7.2 (ilk iki paragraf ve tablo/kart tarifi), 7.4 (ilk tarif bloğu), 11. Şartnamenin geri kalanını okuma; ihtiyaç olursa yalnız ilgili başlığı Grep ile bul.
Görsel başvuru: `tasarim/taslak_v1.html` (onaylanan taslak). Dosyayı baştan sona okumak yerine CSS token'larını (`.app{...}` bloğu) ve ilgili ekran fonksiyonunu (`screenOzet`, `screenIslemler`, `screenSantiyeler`) oku. Şartname bölüm 4 ile taslak çelişirse bölüm 4 geçerlidir.

Yap:
- Tasarım token dosyasını bölüm 4.1–4.3'e göre güncelle: nötr metin renkleri (ink, ink2, muted), surface #F7F6FA, border/borderSoft, warn, yeni tint'ler, radius ve gölgeler, tipografi ölçeği. Başlık ve gövde metnini mor/lacivert yapan ortak stilleri nötre çevir.
- lucide-react ekle.
- Uygulama kabuğu (4.5): içerik genişlik sınırını kaldır (yalnız formlar ve düz metin ~760 px); 232 px kenar menü (gruplar, "Takip", gecikmiş vade sayısı rozeti, kullanıcı kartı, ikonlar); üst çubukta genel arama ve "Yeni kayıt" açılır menüsü; telefonda alt menü ve yüzen + düğmesi.
- Ortak bileşenleri bölüm 4.4'e göre yenile: düğmeler (birincil, kenarlı, tehlike), input/select, segment, filtre etiketi, rozet, panel ve panel başlığı, özet kutusu, liste satırı, tablo, sekmeler, boş durum. Bağlantıların altı çizili olmasın.
- Özet (7.1), Şantiyeler (7.2) ve İşlemler (7.4) ekranlarını taslaktaki düzene getir: dönem segmentli 5 özet kutusu ve 2×2 panel; şantiye sekmeleri + masaüstü tablo + telefon kartı; tek satır araç çubuğu + Filtreler paneli + etiketler + toplam şeridi + yeni tablo sütunları.
- İade gösterimi: kaynak hareketin rengi ve "−" öneki, tür yazısı görünür (bölüm 4.1).

Yapma: diğer ekranların düzenini değiştirme (ortak bileşen değişikliğiyle kendiliğinden yenilenmeleri yeterli; bozulan bir şey olursa yalnız onu düzelt); iş kuralı, API veya veri değişikliği; yeni ekran veya alan.

Bitti sayılması için:
- Özet, İşlemler ve Şantiyeler masaüstünde (1440 ve 1920 px) ve telefonda (375 px) taslakla aynı düzende; geniş ekranda iki yanda büyük boşluk yok.
- Kenar menü, üst çubuk, alt menü ve "Yeni kayıt" menüsü her ekranda çalışıyor.
- Diğer ekranlar açılıyor ve kullanılabilir (görünümleri 4b-2'de tamamlanacak).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz. Üç ekranın masaüstü ve telefon görüntülerini rapora ekle; 4b-2'ye kalan ekranların listesini yaz.
```

### Adım 4b-2 — Kalan ekranların uyarlanması

```text
ADIM 4b-2 — Görsel revizyon: kalan ekranlar
Okunacaklar: şartnamede bölüm 4.1 ve 4.4 (renk kuralları ve bileşenler) ile uyarladığın ekranın bölüm 7 tarifi. Önce 4b-1'de oluşturulan ortak bileşenleri ve Özet/İşlemler ekranlarının kodunu örnek olarak incele; taslak dosyasını yeniden okumana gerek yok.

Yap (4b-1'in bileşenleriyle, yeni bileşen icat etmeden):
- Kişiler (liste, detay, form), Anlaşmalar ve başlangıç kayıtları (liste, detay, formlar, ödeme), Vadeler (boş gruplar tek satır, tarih aralığı küçük seçici), Arama sonuçları, Silinenler, Ayarlar (profil, şifre, firma, kategoriler, hakkında).
- İşlem ve şantiye detay sayfaları, gelir/gider formu ve paylaştırma, iade, düzeltme, bedel/vade/iptal ve silme/geri yükleme dialogları (etki önizlemesi kutusu dahil), 409 karşılaştırma ekranı, kaydetme durumu çubuğu.
- Giriş, ilk şifre ve şifremi unuttum ekranları (giriş arkası gradyan, bölüm 4.1).
- Bütün ekranlarda: beyaz paneller, nötr metin, ikonlar, altı çizgisiz bağlantılar, kart içinde kart yok; telefonda tablolar kart.

Yapma: Özet, İşlemler ve Şantiyeler'in düzenini yeniden değiştirme; iş kuralı, API veya veri değişikliği; yeni ekran veya alan.

Bitti sayılması için:
- Uygulama içinde mor/lacivert gövde metni kalmadı; renkler yalnız token dosyasından geliyor.
- Adım 4'teki akış (giriş → ilk şifre → şantiye → gider → anlaşma → kısmi ödeme → paylaştırma → iade → sil/geri al) yeni görünümle masaüstünde ve 375 px'te çalışıyor; ekran tutarları API ile aynı.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz. Uyarlanan ekranlardan birkaçının masaüstü ve telefon görüntüsünü rapora ekle.
```

## Adım 5 — Belgeler (iki oturum: 5a ve 5b)

### Adım 5a — Belge API'si ve depolama

```text
ADIM 5a — Belgeler: API ve depolama
Okunacaklar: şartnamede bölüm 2 (yalnız teknoloji tablosundaki belge/önizleme satırları ve STORAGE_* ortam değişkenleri), 3 (kurallar), 8.8, 9.6, 10.8. Geri kalanı okuma; gerekirse ilgili başlığı Grep ile bul.

Önce (kısa iş): `apps/web` içindeki `TransactionForm.test.tsx` testi tam test paketi çalışırken ara sıra zamanlama nedeniyle düşüyor (karar belgesi 10.12, "Açık nokta"). Nedenini bul ve gerçek nedeni düzelt (ör. eksik `await`/`findBy`, sızan zamanlayıcı, paylaşılan durum). Testi atlama, beklemeyi sadece uzatma veya beklenen değeri gevşetme. Tam paketi en az 5 kez art arda çalıştırıp her seferinde geçtiğini raporla.

Yap:
- S3 uyumlu depolama istemcisi (yerelde MinIO, ortam değişkenleriyle).
- upload-intent: 20 MB, kayıt başına 10 belge (atomik documentCount), firma kapasitesi (atomik storageUsedBytes) kontrolü; geçici anahtara 15 dk imzalı yükleme adresi.
- complete: koşullu durum geçişi, gerçek boyut ve dosya imzası doğrulaması, değiştirilemeyen nihai anahtara kopyalama, geçici kopyayı silme, kapasite düzeltmesi, sharp/heic-convert ile önizleme.
- Süresi geçen pending yüklemelerin temizliği; tamamlanan yüklemeyle çakışmaması.
- İndirme ve önizleme için 5 dk imzalı adres; belge silme/geri yükleme.
- Firma bilgisi cevabında kullanım dökümü (orijinal, önizleme, geri alınabilir silinmiş belgeler).
- Bütün yeni uçlar firma yalıtım testine eklenir.

Yapma: web ekranları (5b), rapor, dışa aktarma, demo örnek belgeleri.

Bitti sayılması için:
- TransactionForm testi 5 art arda tam çalıştırmada da geçiyor.
- Boyut, sayı ve kapasite sınırları eşzamanlı yüklemelerde bile aşılmaz (test).
- Tamamlama ile temizlik çakışması başarılı belgeyi silmez (test).
- Kapasite doluyken finansal kayıt oluşturma devam eder (test).
- Başka firmanın belgesi indirilemez (yalıtım testi).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz.
```

### Adım 5b — Belge ekranları

```text
ADIM 5b — Belgeler: ekranlar
Okunacaklar: şartnamede bölüm 4.4 (belge satırı, kaydetme durumu), 4.5 (form ve ayar sayfaları tablosu), 7.4 ve 7.6'daki belge alanları, 7.11 (Firma: depolama kullanımı), 9.6, 9.7 (Belge satırı), 10.8, 12 (belge ve kapasite metinleri). Adım 5a'nın API'sini kodundan incele.

Yap:
- İşlem ve anlaşma formlarında (sağ sütun) ve detay sayfalarında belge alanı; telefonda kamera/galeri (`accept="image/*,application/pdf"`, `capture`).
- Dosya başına durum (bekliyor / yükleniyor / yüklendi / başarısız) ve yeniden dene; "İşlem kaydedildi; 1 belge yüklenemedi" akışı; finansal kayıt tekrar oluşturulmaz.
- Önizleme ve indirme; önizleme yoksa orijinali indirme; belge silme/geri yükleme (gerekçeli).
- Firma ayarlarında kullanım dökümü; kapasite dolu, dosya çok büyük, belge sayısı dolu mesajları.

Yapma: API değişikliği (gerekirse dur ve sor), rapor, dışa aktarma, demo.

Bitti sayılması için:
- Masaüstü ve 375 px'te: gidere belge ekle, belge yükleme hatasında yalnız belgeyi yeniden dene, önizle, indir, sil/geri al akışları çalışıyor.
- Kapasite doluyken kayıt girilebiliyor, yükleme düğmesi nedenini gösteriyor.
- Web bileşen testleri; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz.
```

## Adım 6 — Raporlar ve dışa aktarma (iki oturum: 6a ve 6b)

### Adım 6a — Standart raporlar ve filtreli dışa aktarma

```text
ADIM 6a — Raporlar: standart raporlar ve filtreli dışa aktarma
Okunacaklar: şartnamede bölüm 2 (PDF/Excel/CSV satırları), 7.10 (tam firma veri çıkışı paragrafı hariç), 9.1, 10.9 (rapor uçları), 4.4–4.5 (ekran düzeni için). Geri kalanı okuma.

Önce (kısa iş): `pnpm dev` API'yi başlatıyor ama Vite (web) dinlemeye başlamıyor; API ve web ayrı başlatılınca sorun yok (karar belgesi 10.14, "Açık noktalar"). Nedenini bul ve `pnpm dev` ikisini birlikte çalıştıracak biçimde düzelt. Çözüm şartnamede olmayan bir bağımlılık gerektirirse dur ve sor. Düzeltmeyi `pnpm dev` ile web adresinin açıldığını göstererek raporla.

Yap:
- Dört standart rapor verisi ve ekranı: dönem dökümü, şantiye özeti ve hareket dökümü, kişi/firma hesap dökümü, açık borç/alacak ve vade listesi. Raporlar telefonda da görüntülenip indirilebilir.
- Excel (exceljs), CSV (UTF-8 BOM'lu, `;`), PDF (PDFKit, gömülü Türkçe yazı tipi). Başlık bilgileri: firma, kapsam, tarih aralığı, üretim zamanı, güncel kalanın hesaplandığı zaman, takip başlangıcı uyarısı.
- İşlemler sayfasındaki "Bu sonuçları indir" düğmesini etkinleştir: bütün filtrelenmiş sonuçlar; paylaştırılmış kayıtta ana işlem no, toplam tutar ve pay tutarı ayrı; toplamlar aynı satırlardan.
- Başlangıç kayıtlarının raporlarda etiketlenmesi (bölüm 9.1).

Yapma: tam firma veri çıkışı (6b), yönetim ekranları, demo, tanıtım sitesi.

Bitti sayılması için:
- Dosyalardaki toplamlar ekran ve API toplamlarıyla aynı (test).
- Paylaştırılmış hareket şantiye raporunda yalnız payıyla, firma raporunda bir kez sayılır (test).
- PDF'de Türkçe karakterler doğru (ş, ğ, ı, İ, ö, ü, ç).
- Görüntüleme dönemindeki firma rapor alabilir (test).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz.
```

### Adım 6b — Tam firma veri çıkışı

```text
ADIM 6b — Raporlar: tam firma veri çıkışı
Okunacaklar: şartnamede bölüm 2 (yalnız Excel, CSV ve paketleme satırları), 7.10 (son paragraf: tam firma veri çıkışı; dosya biçimi ve dosya adı için "İndir" paragrafı ve altındaki maddeler), 8 girişi (ortak alanlar), 8.8, 8.10 (ExportJob), 9.6 (kapasite hesabı), 10.3 (`storage.breakdown`), 10.9 (/exports uçları). Adım 6a'nın dosya üretim kodunu örnek olarak incele.

Yap:
- `POST /exports/full` ve `GET /exports/:id`: arka plan işi, ilerleme, hazır olunca süreli indirme adresi.
- İçerik: hareketler, paylar, iadeler, anlaşmalar, başlangıç kayıtları, şantiyeler, kişiler, kategoriler ve değişiklik geçmişi (belgelerin kendi geçmişi dahil: ekleme, silme, geri yükleme, kim, ne zaman, gerekçe; şartname 7.4 ve 8.8); ilişkileri açıklanmış Excel sayfaları veya CSV dosyaları; orijinal belgeler dosya–kayıt eşleme tablosuyla zip paketinde (archiver). Silinen ama geri alınabilir kayıtlar durum etiketiyle.
- Firma verisi tek tutarlı okumadan alınır; dosyadaki toplamlar aynı satırlardan.
- Hazır paket 7 gün sonra silinir; bekleyen paket kapasite kullanımında görünür. Hazırlama hatası finansal kayıtları etkilemez.
- Raporlar sayfasında ayrı "Tüm firma verisini dışa aktar" düğmesi, ilerleme ve indirme.

Yapma: yönetim ekranları, demo, tanıtım sitesi.

Bitti sayılması için:
- Tam veri çıkışı başka firma verisi, şifre veya token içermez (test).
- Paket içeriği firma kayıt sayılarıyla tutarlı; belge eşleme tablosu dosyalarla eşleşiyor (test).
- Görüntüleme dönemindeki firma tam veri çıkışı alabilir (test).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz.
```

## Adım 7 — Ürün sahibi yönetimi (iki oturum: 7a ve 7b)

Not: Ürün sahibi girişi, TOTP, kurtarma kodları, firma oluşturma ve kullanıcı oluşturma/sıfırlama/pasifleştirme API'si Adım 2'de yapıldı. 7a kalan API'yi, 7b ekranları tamamlar.

### Adım 7a — Yönetim API'sinin tamamlanması

```text
ADIM 7a — Ürün sahibi yönetimi: kalan API
Okunacaklar: şartnamede bölüm 7.13, 8.1, 8.10 (PlatformLog ve ExportJob), 9.10, 10.10; "Önce" işi için 7.10'daki "Tek etkin iş, tek hazır paket" maddesi ve 9.6'daki "Dışa aktarma paketi" satırı. Adım 2'de yazılan yönetim kodunu incele; yeniden yazma.

Önce (kısa iş, Adım 6b düzeltmesi): Şu an firmada hazır paket varken yeni tam veri çıkışı istenince önceki hazır paket silinmiyor; paketler birikip kapasiteyi ve depolama maliyetini sınırsız büyütebiliyor (karar belgesi 10.18). Yeni paket `ready` olunca aynı firmanın önceki hazır paketlerini sil ve kapasitelerini bir kez iade et (mevcut süre dolumu silme yoluyla aynı kural). Yeni iş başarısız olursa önceki paket süresi dolana kadar indirilebilir kalmalı. Testler: iki ardışık paketten sonra yalnız sonuncusu kalır ve kapasite yalnız onu sayar; yeni iş başarısız olunca önceki paket durur; tarama ile değiştirme çakışınca kapasite iki kez iade edilmez.

Yap:
- Firma listesi: arama, durum filtresi (aktif, geçici durdurulmuş, görüntüleme dönemi, arşiv saklama, silme onayı bekleyen), satır bilgileri ve işletim özeti (kapasitesi dolan/yaklaşan, görüntüleme süresi biten, saklama süresi dolan).
- Kullanıcı adı değiştirme.
- Kapasite artır/azalt (kullanımın altına inmez), gerekçe ve kayıt.
- Hizmet yaşam döngüsü: geçici durdur, hizmeti sonlandır (`?preview=1` ile tarih önizlemesi, geçmişe çekilemez), yeniden aç, arşiv uzat.
- Kalıcı silme: yalnız saklama süresi dolmuşsa; firma adı ile onay; durum takibi (bekliyor / sürüyor / tamamlandı / başarısız); firma verisi, belgeleri ve dışa aktarma paketleri silinir; açık dışa aktarma işleri iptal edilir; asgari PlatformLog kaydı kalır.

Yapma: yönetim ekranları (7b), müşteri finansal kayıtlarını görüntüleme/düzenleme, otomatik mesaj veya faturalama.

Bitti sayılması için:
- Firma açılışından hizmet sonuna kadar akış: görüntüleme dönemi → arşiv → silme onayı → kalıcı silme testli.
- Kalıcı silinen firmanın hiçbir verisi ve belgesi kalmaz; yeniden açılamaz (test).
- Bütün işlemler gerekçe/kim/ne zaman ile PlatformLog'da; şifre hiçbir logda yok (test).
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz.
```

### Adım 7b — Yönetim ekranları

```text
ADIM 7b — Ürün sahibi yönetimi: ekranlar
Okunacaklar: şartnamede bölüm 4 (yalnız 4.4 ve 4.5), 5.3, 7.13, 8.10 (yalnız PlatformLog: işlem adları), 9.10 (yalnız tablonun altındaki maddeler), 10.10, 12. API'yi Adım 2 ve 7a kodundan incele.

Önce (kısa API işi, Adım 7a düzeltmesi): `GET /platform/companies` cevabındaki `summary` yalnız silme başlamamış firmalardan hesaplanıyor; kalıcı silmesi bekleyen, süren veya başarısız olan firmalar hiçbir özet grubunda ve durum filtresinde görünmüyor (karar belgesi 10.20). `summary`'ye bu firmalar için ayrı bir grup ekle (öğe biçimi diğer gruplarla aynı, `deletionStatus` dahil). Tamamlanmış silmeler bu gruba girmez. Firma yalıtımı ve yönetim testlerine ekle; cevap biçimini şartname 10.10'a uygun tut.

Yap:
- Yönetim girişi (şifre, ardından TOTP veya kurtarma kodu), zorunlu güvenlik kurulumu (QR) ve kurtarma kodlarının bir kez gösterilip indirilmesi, güvenlik ayarları (TOTP'yi yeniden kur, kodları yenile).
- İşletim özeti ve firma listesi (arama, filtreler, şartname 7.13'teki özet grupları; silmesi tamamlanmayan firmalardan başarısız silmeyi yeniden başlatma), firma oluştur, firma düzenle, firma detay (kullanıcılar, depolama, hizmet durumu ve tarihleri, işletim geçmişi işlem adlarının Türkçe karşılıklarıyla).
- Kullanıcı ekle (geçici şifre bir kez gösterilir), şifre sıfırla, pasifleştir/aktifleştir, kullanıcı adı değiştir; kapasite; hizmet yaşam döngüsü dialogları (tarih önizlemeli); kalıcı silme ekranı (firma adı yazarak onay).
- Müşteri uygulamasıyla aynı tasarım sistemi; yönetim alanı olduğu açıkça belli olsun.

Yapma: "Önce" işi dışında API değişikliği (gerekirse dur ve sor), müşteri finansal kayıtlarını gösterme.

Bitti sayılması için:
- Masaüstünde ilk kurulumdan kalıcı silmeye kadar akış ekrandan çalışıyor; telefonda temel ekranlar bozulmuyor.
- Geçici şifre ve kurtarma kodları yalnız bir kez gösteriliyor.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz.
```

## Adım 8 — Demo

```text
ADIM 8 — Demo
Okunacaklar: şartnamede bölüm 5.1 (/demo), 5.2 (demo rotaları), 6.3, 10.2, 13 (madde 2); "Önce" işi için bölüm 3'teki "Tek süreç" maddesi ve 9.8 "Deneme sınırı" satırı. Geri kalanı okuma; gerekirse ilgili başlığı Grep ile bul.

Önce (kısa iş): `apps/api/test/customer-auth.test.ts` içindeki "aynı IP'den çok sayıda hatalı deneme" testi tam test paketi çalışırken ara sıra düşüyor (karar belgesi 10.21, "Açık noktalar"). Nedenini bul ve gerçek nedeni düzelt (ör. testler arasında paylaşılan bellek içi deneme sayacı, zaman penceresine bağlı bekleme, eksik `await`). Testi atlama, beklemeyi yalnız uzatma veya beklenen değeri gevşetme. Demo açma sınırı da aynı altyapıyı kullanacağı için bu iş demodan önce yapılır. Tam API paketini en az 5 kez art arda çalıştırıp her seferinde geçtiğini raporla.

Yap:
- Ayrı demo veritabanı bağlantısı (MONGODB_DEMO_URI); demo token'ı gerçek veritabanına hiçbir koşulda erişemez.
- Sürüm kontrollü, tutarlı örnek veri kümesi (6.3'teki içerik). Tutarlar Adım 1 fonksiyonlarıyla doğrulanmış olmalı.
- /demo/start: yeni geçici demo firması + örnek veri; /demo/reset; 24 saat hareketsiz demo temizliği; IP başına demo açma sınırı.
- Web: /demo ve /demo/uygulama/... rotaları, sabit demo bandı, Demoyu sıfırla onayı, gerçek dosya yükleme yerine örnek belge seçimi, dışa aktarmalarda "Örnek veri" etiketi.

Yapma: tanıtım sitesi.

Bitti sayılması için:
- İki ayrı demo oturumunun değişiklikleri birbirini etkilemez (test).
- Demo hiçbir uçtan gerçek firma verisine erişemez ve gerçek veritabanına yazamaz (test).
- Sıfırlama başlangıç verisine döner.
- `customer-auth.test.ts` 5 art arda tam çalıştırmada da geçiyor.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz.
```

## Adım 9 — Tanıtım sitesi

```text
ADIM 9 — Tanıtım sitesi
İlgili şartname bölümleri: 5.1, 6.1, 6.2, 11 (SEO maddesi), 12.

Yap:
- Üst çubuk ve altbilgi; ana sayfa yedi bölümü; özellikler, nasıl çalışır, kullanım (/fiyatlandirma), SSS (en az 8 soru, accordion), gizlilik, koşullar.
- Gradyan kahraman ve örnek rakamlı ürün önizlemesi (canlı veri değil).
- "Demoyu dene" ve "Giriş yap" yönlendirmeleri; kayıt düğmesi yok.
- SEO: başlık, açıklama, Open Graph; uygulama/demo/yönetim rotaları noindex.
- İletişim bilgileri SUPPORT_CONTACT_TEXT'ten; uydurma adres, şirket unvanı, yorum, logo veya istatistik yok.

Bitti sayılması için: Bütün sayfalar 375 px, 768 px ve masaüstünde bozulmadan açılır; erişilebilirlik kontrolü (etiketler, kontrast, odak) temiz.
```

## Adım 10 — Son kabul

```text
ADIM 10 — Uçtan uca testler ve kabul
İlgili şartname bölümleri: 13 (tamamı) ve gerekirse diğer bütün bölümler.

Yap:
- Playwright uçtan uca testleri (telefon ve masaüstü görünümü): giriş, ilk şifre, gider oluşturma, anlaşmaya ödeme, paylaştırma, iade, sil/geri al, belge yükleme hatası, bağlantı kesintisinde "doğrulanıyor" akışı, demo sıfırlama, ürün sahibi TOTP girişi.
- Bölüm 13'teki her kabul maddesini bir teste veya belgelenmiş elle kontrole bağlayan kontrol listesi (docs/kabul_kontrol_listesi.md).
- Önceki adımlarda denenmemiş kalan belge akışlarını kontrol listesine ekle ve dene: anlaşma formu ve detayında belge ekleme, önizleme, sil/geri al (tarayıcıda); indirmenin gerçek dosya kaydetmesi; gerçek telefon kamerasıyla çekim ve gerçek bir HEIC dosyasının önizlemesi (son ikisi elle kontrol olabilir).
- Rapor dosyalarını kontrol listesine ekle: indirilen Excel, CSV ve PDF ile tam veri çıkışı paketindeki `veri.xlsx` ve CSV dosyaları gerçek Excel'de ve gerçek bir telefonda açılıyor, Türkçe karakterler ve toplamlar doğru; paket tarayıcıdan gerçekten indiriliyor (elle kontrol olabilir).
- Kalıcı silmenin depo temizliğini (`removePrefix`, yarım çok parçalı yüklemelerin iptali) yerel MinIO'da gerçek nesnelerle dene; silinen firmanın `companies/<firma>/` altında nesne kalmadığını doğrula.
- Yönetim güvenlik kurulumunda "Kodları indir" düğmesiyle tarayıcıdan gerçek `.txt` dosyası kaydedildiğini ve içeriğin ekrandaki kodlarla aynı olduğunu dene (elle kontrol olabilir).
- Yedekten çıkarma son tarihi: kalıcı silmeden sonra kalan yedek kopyaların en geç 30 gün içinde saklama döngüsünden çıkarılması (karar belgesi 7.7) yedekleme yöntemi seçildiyse takibe bağla; seçilmediyse canlıya hazırlık notunda açık nokta olarak yaz.
- Büyük firma ölçümü: on binlerce hareket ve yaklaşık bin belgelik örnek firmayla tam veri çıkışında tek snapshot okumanın MongoDB transaction süre sınırına (60 sn) takılıp takılmadığını ve Excel üretiminin bellek kullanımını ölç; raporlar için de süreyi kaydet. Sınır aşılıyorsa dur ve seçenekleri sor.
- Eksik veya hatalı çıkan noktaları düzelt; şartnameden sapma gerekiyorsa dur ve sor.
- Canlıya hazırlık notu: gerekli ortam değişkenleri, veritabanı indeksleri, ilk ürün sahibi kurulumu, yedekleme için bekleyen kararlar, üretim deposunda `companies/*/uploads/` için bir günlük yaşam döngüsü kuralı ve `companies/*/exports/` için yarım kalan çok parçalı yüklemeleri temizleyen kural (şartname 9.6), arka plan işleri API sürecinde çalıştığı için sürecin sürekli açık kalması ve ilk sürümde tek süreç çalışması gerektiği (şartname bölüm 3 "Tek süreç"), PDF yazı tipi klasörünün (`apps/api/assets/fonts`) üretim dağıtımına dahil edilmesi (şartname bölüm 2).

Bitti sayılması için: Bölüm 13'ün her maddesi işaretli; bütün testler CI'da geçer.
```
