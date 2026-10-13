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
4. Bir adım tek oturuma sığmazsa aynı metni yeni oturumda "kaldığın yerden devam et" notuyla tekrar verin.

## Ortak giriş (her oturumun başına)

```text
Bu depodaki `santiye-hesap-web-prompt.md` dosyası ürünün şartnamesidir. Tamamını oku; ayrıca AGENTS.md / CLAUDE.md kurallarına uy.
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

## Adım 4b — Görsel revizyon

Adım 4'ün ekranları işlevsel olarak kabul edildi; görünüm onaylanan taslağa göre yenilenir. Adım 5'ten önce yapılır ki sonraki ekranlar yeni bileşenlerle gelsin.

```text
ADIM 4b — Görsel revizyon
İlgili şartname bölümleri: 4 (tamamı, yenilendi), 5.2 (sol menü), 7.1, 7.2, 7.4, 11.
Görsel başvuru: `tasarim/taslak_v1.html` (onaylanan taslak; tarayıcıda açıp masaüstü ve telefon görünümüne bak). Ölçü, renk veya düzende şartname bölüm 4 ile taslak çelişirse bölüm 4 geçerlidir.

Yap:
- Tasarım token dosyasını bölüm 4.1–4.3'e göre güncelle: nötr metin renkleri (ink, ink2, muted), surface #F7F6FA, border/borderSoft, warn, yeni tint'ler, radius ve gölgeler, tipografi ölçeği. Uygulama içinde başlık ve gövde metnini mor/lacivert yapan bütün kullanımları kaldır.
- lucide-react ekle; menü, düğmeler, liste satırları, sekmeler ve durum rozetlerinde ikonları bölüm 4.4'e göre kullan.
- Yerleşim (4.5): içerik genişlik sınırını kaldır (yalnız formlar ve düz metin ~760 px); 232 px kenar menü (gruplar, "Takip", gecikmiş vade sayısı rozeti, kullanıcı kartı); üst çubukta genel arama ve "Yeni kayıt" açılır menüsü; telefonda alt menü ve yüzen + düğmesi.
- Ortak bileşenleri bölüm 4.4'e göre yenile: düğmeler (birincil, kenarlı, tehlike), input/select, segment, filtre etiketi, rozet, panel ve panel başlığı, özet kutusu, liste satırı, tablo, sekmeler, boş durum. Kart içinde kart kullanma; bağlantıların altı çizili olmasın.
- Özet (7.1), Şantiyeler (7.2) ve İşlemler (7.4) ekranlarını taslaktaki düzene getir: dönem segmenti ile 5 özet kutusu, 2×2 panel; şantiye sekmeleri + masaüstü tablo + telefon kartı; tek satır araç çubuğu + Filtreler paneli + etiketler + toplam şeridi + yeni tablo sütunları.
- Diğer bütün uygulama ekranlarını (kişiler, anlaşmalar, vadeler, arama, silinenler, ayarlar, detaylar, formlar, dialoglar, giriş ekranları) aynı bileşenlerle tutarlı hale getir: beyaz paneller, nötr metin, ikonlar, boş grupların tek satır olması (ör. Vadeler'de "Gecikmiş (0)").
- İade gösterimi: kaynak hareketin rengi ve "−" öneki, tür yazısı görünür (bölüm 4.1).

Yapma: iş kuralı, API veya veri değişikliği; yeni ekran veya alan ekleme; belge, rapor, demo, yönetim ve tanıtım sitesi işleri.

Bitti sayılması için:
- Özet, İşlemler ve Şantiyeler ekranları masaüstünde (1440 px ve 1920 px) ve telefonda (375 px) taslakla aynı düzende; geniş ekranda iki yanda büyük boşluk yok.
- Uygulama içinde mor/lacivert gövde metni kalmadı; renkler yalnız token dosyasından geliyor.
- Adım 4'te geçen bütün akışlar (giriş → ilk şifre → şantiye → gider → anlaşma → kısmi ödeme → paylaştırma → iade → sil/geri al) yeni görünümle çalışıyor; ekran tutarları API ile aynı.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` temiz. Masaüstü ve telefon ekran görüntülerini rapora ekle.
```

## Adım 5 — Belgeler

```text
ADIM 5 — Belgeler ve kapasite
İlgili şartname bölümleri: 7.4 ve 7.6 (belge alanları), 7.11 (depolama kullanımı), 8.8, 9.6, 10.8.

Yap:
- S3 uyumlu depolama istemcisi (yerelde MinIO, ortam değişkenleriyle).
- upload-intent: 20 MB, kayıt başına 10 belge (atomik documentCount), firma kapasitesi (atomik storageUsedBytes) kontrolü; geçici anahtara 15 dk imzalı yükleme adresi.
- complete: koşullu durum geçişi, gerçek boyut ve dosya imzası doğrulaması, değiştirilemeyen nihai anahtara kopyalama, geçici kopyayı silme, kapasite düzeltmesi, sharp/heic-convert ile önizleme.
- Süresi geçen pending yüklemelerin temizliği; tamamlanan yüklemeyle çakışmaması.
- İndirme ve önizleme için 5 dk imzalı adres; belge silme/geri yükleme.
- Web: işlem ve anlaşma formu/detaylarında belge alanı, telefonda kamera/galeri, dosya başına durum ve yeniden dene, "İşlem kaydedildi; 1 belge yüklenemedi" akışı, firma ayarlarında kullanım dökümü, kapasite dolu mesajı.

Yapma: rapor, dışa aktarma, demo örnek belgeleri.

Bitti sayılması için:
- Boyut, sayı ve kapasite sınırları eşzamanlı yüklemelerde bile aşılmaz (test).
- Tamamlama ile temizlik çakışması başarılı belgeyi silmez (test).
- Belge hatası finansal kaydı tekrar oluşturmaz; kapasite doluyken finansal kayıt devam eder.
- Başka firmanın belgesi indirilemez (yalıtım testi).
```

## Adım 6 — Raporlar ve dışa aktarma

```text
ADIM 6 — Raporlar ve veri çıkışı
İlgili şartname bölümleri: 7.10, 8.10 (ExportJob), 10.9 (rapor ve export uçları).

Yap:
- Dört standart rapor verisi ve ekranı: dönem dökümü, şantiye özeti, kişi/firma hesap dökümü, açık borç/alacak ve vade listesi.
- Excel (exceljs), CSV (UTF-8 BOM'lu, `;`), PDF (PDFKit, gömülü Türkçe yazı tipi). Başlık bilgileri: firma, kapsam, tarih aralığı, üretim zamanı, takip başlangıcı uyarısı.
- Filtreli dışa aktarma: bütün filtrelenmiş sonuçlar; paylaştırılmış kayıtta ana işlem no, toplam tutar, pay tutarı ayrı; toplamlar aynı satırlardan.
- Tam firma veri çıkışı: arka plan işi, ilerleme, ilişkili Excel sayfaları/CSV dosyaları, belge zip paketi ve eşleme tablosu, silinmiş kayıt etiketleri, 7 gün sonra silme. Firma verisi tek tutarlı okumadan alınmalı.
- Rapor ekranları telefonda da görüntülenip indirilebilir.

Yapma: yönetim ekranları, demo, tanıtım sitesi.

Bitti sayılması için:
- Dosyalardaki toplamlar ekran ve API toplamlarıyla aynı (test).
- Paylaştırılmış hareket şantiye raporunda yalnız payıyla, firma raporunda bir kez sayılır (test).
- Tam veri çıkışı başka firma verisi, şifre veya token içermez (test).
- Görüntüleme dönemindeki firma rapor ve dışa aktarma alabilir.
```

## Adım 7 — Ürün sahibi yönetimi

```text
ADIM 7 — Ürün sahibi yönetim alanı
İlgili şartname bölümleri: 5.3, 7.13, 8.1, 9.10, 10.10 (tamamı).

Yap:
- Yönetim ekranları: giriş (şifre + TOTP/kurtarma kodu), zorunlu güvenlik kurulumu ve kurtarma kodlarının bir kez gösterimi/indirilmesi, güvenlik ayarları, işletim özeti ve firma listesi (filtreler, uyarılar), firma oluştur, firma detay (kullanıcılar, depolama, hizmet, işletim geçmişi).
- Kullanıcı ekle (geçici şifre bir kez), şifre sıfırla, pasifleştir/aktifleştir, kullanıcı adı değiştir.
- Kapasite artır/azalt (kullanımın altına inmez), gerekçe ve kayıt.
- Hizmet yaşam döngüsü: geçici durdur, hizmeti sonlandır (tarih önizlemesi, geçmişe çekilemez), yeniden aç, arşiv uzat.
- Kalıcı silme: yalnız saklama süresi dolmuşsa; firma adı yazarak onay; durum takibi; firma verisi ve belgeler silinir; asgari PlatformLog kaydı kalır.

Yapma: müşteri finansal kayıtlarını görüntüleme/düzenleme, otomatik mesaj veya faturalama.

Bitti sayılması için:
- Firma açılışından hizmet sonuna kadar akış: görüntüleme dönemi → arşiv → silme onayı → kalıcı silme testli.
- Kalıcı silinen firmanın hiçbir verisi ve belgesi kalmaz; yeniden açılamaz.
- Bütün işlemler gerekçe/kim/ne zaman ile PlatformLog'da; şifre hiçbir logda yok.
```

## Adım 8 — Demo

```text
ADIM 8 — Demo
İlgili şartname bölümleri: 5.1 (/demo), 5.2 (demo rotaları), 6.3, 10.2, 13 (madde 2).

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
- Eksik veya hatalı çıkan noktaları düzelt; şartnameden sapma gerekiyorsa dur ve sor.
- Canlıya hazırlık notu: gerekli ortam değişkenleri, veritabanı indeksleri, ilk ürün sahibi kurulumu, yedekleme için bekleyen kararlar.

Bitti sayılması için: Bölüm 13'ün her maddesi işaretli; bütün testler CI'da geçer.
```
