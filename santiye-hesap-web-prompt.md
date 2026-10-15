# Şantiye Hesap — Web ürünü uygulama promptu

Bu belgenin tamamını, başka bir modele veya geliştiriciye tek prompt olarak ver. Amaç: müteahhitlere satılacak **Şantiye Hesap** web ürününü, tanıtım sitesi dahil, sıfırdan ve üretime hazır şekilde kurmak. Bu kapsamda mobil uygulama yapılmayacak; web arayüzü önce telefon tarayıcısında günlük kullanım için, sonra masaüstünde inceleme ve raporlama için tasarlanacak. Arayüz dili Türkçe, para birimi Türk lirası. Tasarım dili aşağıdaki renk ve tipografi sistemine birebir uyar. Bu belgede tanımlanmayan ekranı veya iş kuralını uydurma; finans formüllerinden sapma.

---

## 1. Rol ve teslim

Sen kıdemli bir ürün mühendisisin. Tek bir depoda şunları birlikte teslim et:

1. Herkese açık tanıtım sitesi (pazarlama sayfaları) ve hesapsız denenebilen demo.
2. Giriş yapmış firma kullanıcısının şantiye gelir-giderini, anlaşmalarını, borç-alacağını ve belgelerini yönettiği web uygulaması.
3. Ürün sahibinin firma ve kullanıcı hesaplarını yönettiği ayrı bir yönetim alanı.
4. Node.js REST API.
5. MongoDB şemaları, indeksler ve iş kuralları.
6. Kimlik doğrulama, firma ayrımı, yumuşak silme, kayıt geçmişi, belge yükleme, rapor ve veri dışa aktarma.
7. Masaüstü, tablet ve telefon genişliklerinde çalışan arayüz.

Web'de görünen ad her yerde **Şantiye Hesap**. Slogan: **Şantiye parasını net ve hızlı yönetin.**

Ürün farklı müteahhit firmalarına satılır. Her firmanın kayıtları, belgeleri, arama sonuçları ve raporları diğer firmalardan tamamen ayrıdır. Aynı firmanın bütün kullanıcıları eşit yetkilidir; rol matrisi veya şantiye bazlı izin yok. Herkes kendi kişisel hesabıyla girer; `createdBy` ve `updatedBy` kaydı kimin girdiğini tutar. Herkese açık kullanıcı kaydı yoktur. Firma ve kullanıcı hesaplarını ürün sahibi yönetim alanından açar ve giriş bilgilerini müşteriye kendisi iletir.

Ürünün cevaplaması gereken sorular:

1. Hangi şantiyeye ne kadar para girdi, ne kadar çıktı?
2. Hangi kişi/firmaya ne kadar borç kaldı?
3. Kimden ne kadar alacak var?
4. Yakında hangi ödemeler ve tahsilatlar bekleniyor, hangileri gecikti?
5. Bir işlem ne zaman gerçekleşti ve kim tarafından kaydedildi?

---

## 2. Teknoloji

| Katman | Seçim | Not |
| --- | --- | --- |
| Çalışma ortamı | Node.js 24 LTS, pnpm, TypeScript 6.0 | `.nvmrc` ve `engines: >=24`. TypeScript 7, lint aracı desteklediğinde yükseltilebilir |
| Web | React 19, TypeScript, Vite | Tek sayfa uygulama |
| Yönlendirme | React Router | Tanıtım, uygulama ve yönetim aynı origin |
| Sunucu durumu | TanStack Query | Liste, detay, mutasyon, yeniden doğrulama |
| İstemci durumu | Zustand | Oturum ve arayüz tercihleri |
| Form | React Hook Form + Zod | API şemalarıyla aynı kurallar |
| Stil | CSS Modules veya tek tasarım token dosyası | Aşağıdaki renkler sabit |
| İkon | lucide-react | Bölüm 4.4 |
| HTTP | Axios | `Authorization: Bearer` |
| API | Node.js, Express, TypeScript | ESM veya derlenmiş TS |
| Doğrulama | Zod | Gövde ve sorgu. Ortak şemalar yüklenince Zod'un hazır hata mesajları Türkçeye ayarlanır |
| Veritabanı | MongoDB 8.2 (replica set) + Mongoose | Çok dokümanlı transaction zorunlu. API açılışta replica set olduğunu doğrular; değilse başlamaz. Üretim veritabanı da en az 8.2 olmalı |
| Kimlik | JWT access + refresh (`jose`) | Access 15 dk, refresh 30 gün, her yenilemede döner |
| Şifre | bcrypt algoritması (`bcryptjs`) | Maliyet 12. Yük artarsa yerel `bcrypt` paketine geçilebilir |
| Yerel geliştirme | Docker: MongoDB 8.2 replica set, `pgsty/minio` (S3 uyumlu) | Resmi MinIO imajları dağıtılmadığı için topluluk imajı; yalnız yerelde, sürümü sabit. Kod yalnız S3 API'sini kullanır |
| Belge depolama | S3 uyumlu özel bucket (ör. Cloudflare R2); `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | İmzalı ve süreli bağlantılar. Bölge adı `us-east-1`, yol biçimi (path-style) adresleme; yerel MinIO ve R2 bununla çalışır |
| Görsel önizleme | sharp (HEIC için heic-convert) | Orijinal dosya korunur |
| İki aşamalı doğrulama | otplib (TOTP, RFC 6238) | Yalnız ürün sahibi hesabı; doğrulama uygulamasıyla 6 haneli kod |
| PDF | PDFKit | Türkçe karakter için gömülü yazı tipi: DM Sans 400/700 ve Outfit 600 TTF dosyaları OFL lisans metinleriyle `apps/api/assets/fonts` altında; üretim dağıtımında bu klasör de bulunur. Outfit'te ₺ olmadığı için yalnız başlıklarda, tutarlar DM Sans. Bitişik harfler ("fi") kapalı; yoksa kopyalanan metin bozulur. Yatay A4; uzun tablolar sayfalara bölünür, başlık satırı her sayfada tekrarlanır |
| Excel | exceljs | Rapor ve tam veri çıkışı. "Özet" sayfasında başlık bilgileri ve özetler, her tablo ayrı sayfada; tutarlar TL biçimli sayı hücresi, tarihler tarih hücresi |
| CSV | UTF-8, BOM'lu, Türkçe başlık, `;` ayraç | Excel'de Türkçe karakter bozulmadan açılır. Tutar binlik ayraçsız, ondalık virgüllü (`12500,50`); tarih `GG.AA.YYYY` |
| Paketleme | archiver | Tam veri çıkışında belge paketi |

Klasör:

```text
/
  apps/web          React tanıtım + demo + uygulama + yönetim
  apps/api          Express
  packages/shared   Ortak Zod şemaları, para/tarih yardımcıları ve finans hesap fonksiyonları
```

Finans hesap fonksiyonları (`kalan`, `fazla`, `gecikmiş`, `dönem neti`) saf fonksiyon olarak `packages/shared` içinde durur; API ve web aynı fonksiyonu kullanır.

Ortam değişkenleri:

| Anahtar | Amaç |
| --- | --- |
| `PORT` | API portu, varsayılan 3000 |
| `MONGODB_URI` | Ana veritabanı |
| `MONGODB_DEMO_URI` | Demo veritabanı; gerçek veriden ayrı |
| `JWT_ACCESS_SECRET` | Access imzası, en az 32 karakter |
| `JWT_REFRESH_SECRET` | Refresh imzası, access'ten farklı |
| `STORAGE_ENDPOINT` `STORAGE_BUCKET` `STORAGE_ACCESS_KEY` `STORAGE_SECRET_KEY` | Belge depolama. Üretimde zorunlu. Geliştirmede boşsa API yine açılır; yalnız belge işlemleri "Belge deposu yapılandırılmadı" hatasıyla reddedilir |
| `APP_NAME` | Şantiye Hesap |
| `WEB_ORIGIN` | CORS |
| `VITE_API_URL` | Web'in API adresi |
| `SUPPORT_CONTACT_TEXT` | Şifremi unuttum ve kapasite ekranlarında görünen ürün sahibi iletişim metni. Web derlemesine gömülür (Vite `envPrefix`); değişirse web yeniden derlenir, boşsa genel yönlendirme metni gösterilir |
| `PLATFORM_BOOTSTRAP_USERNAME` `PLATFORM_BOOTSTRAP_PASSWORD` | İlk ürün sahibi hesabını bir kez oluşturmak için; ilk girişte TOTP kurulumu zorunlu |
| `PLATFORM_TOTP_ENCRYPTION_KEY` | TOTP gizli anahtarlarını veritabanında şifrelemek için (AES-256-GCM), en az 32 bayt |

Oturum süresi: access 15 dakika, refresh 30 gün. Her refresh kullanımında yeni çift üretilir, eskisi geçersiz olur. Uygulamayı kullanan kişi böylece çıkış yapmadan çalışmaya devam eder. Şifre değişince, sıfırlanınca veya kullanıcı pasifleştirilince o kullanıcının bütün refresh token'larını sil.

---

## 3. Mimari

```text
Tarayıcı
  Tanıtım rotaları (oturumsuz)
  Demo kabuğu (hesapsız, ziyaretçiye özel geçici firma)
  Uygulama kabuğu (firma kullanıcısı)
  Yönetim kabuğu (ürün sahibi)
        │
        ▼
  Axios + access token + Idempotency-Key (yazma isteklerinde)
        │  401 ise bir kez /auth/refresh, sonra isteği tekrarla
        ▼
  Express
    helmet, cors, json, request log, rate limit (giriş ve demo)
    /health
    /auth            oturumsuz + /me oturumlu
    /demo            hesapsız demo açma ve sıfırlama
    ── firma bağlamı: kullanıcı → firma → hizmet durumu ──
    /company
    /projects
    /parties
    /categories
    /transactions
    /agreements
    /documents
    /search
    /dashboard
    /reports
    /exports
    /deleted
    ── ürün sahibi bağlamı ──
    /platform
        │
        ▼
  Servis katmanı
    doğrulama, iş kuralı, özet hesap, transaction
        │
        ▼
  Mongoose modelleri
    Company, User, PlatformAdmin, Project, Party, Category, Transaction,
    Agreement, Document, SearchHistory, IdempotencyRecord, ExportJob, PlatformLog
        │
        ▼
  MongoDB          S3 uyumlu belge depolama
```

Kurallar:

- Rota ince olsun. İş kuralı serviste kalsın.
- Her başarılı JSON: `{ success: true, data, message? }`. Tek istisna `/health`: `{ success: true, status: "ok" }`.
- Her hata JSON: `{ success: false, message, code, details? }` ve doğru HTTP kodu.
- Liste cevapları sayfalı olsun: `{ items, page, limit, total }`. Filtreli listelerde `totals` alanı bütün filtrelenmiş sonuçların toplamını taşır, yalnız o sayfanın değil.
- **Firma ayrımı:** Kullanıcı ve ürün sahibi dışındaki her modelde `companyId` zorunludur. Firma kullanıcısının bütün sorgularına `companyId` servis katmanında zorla eklenir; istemciden gelen `companyId` kabul edilmez. Başka firmaya ait kayıt kimliği istenirse 404 dön (403 değil; kaydın varlığı sızmasın). Bütün bileşik indeksler `companyId` ile başlar. Firma verisi taşıyan modellerde `companyId` filtresi olmayan her sorgu reddedilir; firma kayıtlarına servis katmanındaki `forCompany` yardımcısıyla erişilir. Her yeni firma ucu API testlerindeki ortak firma yalıtım listesine eklenir.
- Silme fiziksel değil. `deletedAt` dolar. Varsayılan sorgular `deletedAt: null`.
- **Para:** Tutarlar kuruş cinsinden tamsayı saklanır ve API'de kuruş tamsayı olarak taşınır (`12.500,50 TL` → `1250050`). Kayan noktalı sayı kullanma.
  - **Giriş katı tr-TR biçimindedir:** Nokta yalnız üç haneli binlik grubunda, virgül ondalık ayracı olarak geçerlidir (`12500`, `12.500`, `12.500,50`). Binlik grubuna uymayan noktalı girdi (`12.5`) reddedilir ve "Ondalık için virgül kullanın" denir. En fazla iki ondalık kabul edilir; fazlası yuvarlanmaz, reddedilir.
  - **Gösterim:** Ekranda tutarlar `Intl` tr-TR para biçimiyle (`₺12.500,50`); hata ve uyarı metinlerinde `40.000 TL` biçiminde.
- **Tarih:** İşlem, vade, anlaşma, başlangıç ve takip tarihleri `YYYY-MM-DD` metni olarak saklanır; saat dilimi kayması olmaz. Sistem zamanları (`createdAt` vb.) ISO UTC. "Bugün" ve gecikme hesabı Europe/Istanbul gününe göre yapılır.
- **Atomik işlem:** Bir para hareketinin, payların, bağlı anlaşma bakiyelerinin, iade toplamlarının ve kayıt geçmişinin değiştiği her işlem tek MongoDB transaction'ı içinde tamamlanır. Yarım güncelleme olmaz.
- **Eşzamanlı güncelleme:** Sabitleme ve arama geçmişini temizleme dışındaki bütün değiştirme işlemlerinde (güncelleme, tamamlama, arşiv, bedel/vade/iş durumu, iptal, silme, geri yükleme) `expectedUpdatedAt` zorunlu. Kayıt bu arada değişmişse 409 `CONFLICT`, mesaj "Kayıt başka bir yerde güncellendi" ve güncel kayıt `details` içinde döner. Sessizce üzerine yazma.
- **Güvenli tekrar:** Para hareketi, anlaşma, başlangıç kaydı, iade ve ürün sahibinin firma/kullanıcı oluşturma `POST` isteklerinde `Idempotency-Key` başlığı zorunlu. Şantiye, kişi, kategori oluşturmada ve belge yükleme niyetinde (`POST /documents/upload-intent`) isteğe bağlıdır; gelirse uygulanır. Web, çift tıklamaya karşı bütün oluşturma isteklerinde anahtar gönderir. Aynı anahtar ve aynı gövde gelirse ilk sonucu tekrar döndür, yeni kayıt açma. Tek istisna yükleme niyetidir: tekrarda aynı bekleyen belge döner ama imzalı yükleme adresi yeniden üretilir; ikinci rezervasyon yapılmaz. Aynı anahtar farklı gövdeyle gelirse 422 `IDEMPOTENCY_MISMATCH`. Anahtar kaydı işlemle aynı transaction'da yazılır; benzersiz indeks sayesinde aynı anda gelen iki istek çift kayıt üretemez. Anahtar kayıtları 30 gün tutulur, 24 saatten eski anahtar 422 `IDEMPOTENCY_EXPIRED` alır.
- **Hizmet durumu her istekte hesaplanır** (bölüm 9.10). Görüntüleme döneminde yazma isteği 403 `READ_ONLY`; kapalı durumlarda 403 `ACCESS_CLOSED`.

Kimlik akışı:

1. `POST /auth/login` kullanıcı adı ve şifreyle access, refresh ve kullanıcı döner.
2. Kullanıcıda `mustChangePassword` varsa yalnız `/auth/password` ve `/auth/logout` açıktır; web `/ilk-sifre` ekranına alır.
3. Access her istekte `Authorization: Bearer` olur.
4. Access 401 verirse web, refresh ile sessizce yeniler ve isteği bir kez tekrarlar.
5. Refresh de 401 ise oturumu temizle ve `/giris`e al.
6. Ağ hatasında token silme. Bağlantı yokken oturum ekranda kalsın ama yeni kaydın sunucuya ulaştığı iddia edilmesin.
7. Ürün sahibi `/platform/auth/login` ile ayrı giriş yapar: önce kullanıcı adı + şifre, sonra zorunlu TOTP kodu (veya bir kurtarma kodu). İkinci adım tamamlanmadan token verilmez. Ürün sahibi token'ı ayrı türdedir ve müşteri rotalarına erişemez. Müşteri token'ı da `/platform` rotalarına erişemez.

---

## 4. Tasarım sistemi

Bunu token olarak kodla. Yakın renk uydurma. Onaylanan görsel başvuru: [`tasarim/taslak_v1.html`](tasarim/taslak_v1.html) (Özet, İşlemler, Şantiyeler; masaüstü ve telefon). Ölçü, renk veya düzen konusunda bu bölüm ile taslak çelişirse bu bölüm geçerlidir; bu bölümde olmayan görsel ayrıntıda taslağa uyulur.

Genel ilke: Metin nötr ve koyu, marka moru yalnız etkileşim ve vurguda. Her şey aynı ağırlıkta olmasın; özet önce, ayrıntı sonra.

### 4.1 Renk

| Token | Hex / değer | Kullanım |
| --- | --- | --- |
| `surface` | `#F7F6FA` | Uygulama zemini |
| `panel` / `white` | `#FFFFFF` | Kart, panel, üst çubuk, kenar menü, tablo |
| `ink` | `#1B1838` | Başlıklar, gövde metni, tablo değerleri |
| `ink2` | `#4A4668` | İkincil metin, etiketler, menü öğeleri |
| `muted` | `#7A76A8` | Yardımcı metin, meta bilgi, placeholder, tablo başlığı |
| `border` | `#E7E4F0` | Kart kenarı, ayırıcı, input kenarı |
| `borderSoft` | `#F0EEF5` | Liste ve tablo satır ayırıcıları, nötr rozet zemini |
| `primary` | `#4D12EE` | Birincil düğme, bağlantı, seçili menü/sekme, odak halkası |
| `primaryHover` | `#3F0CCB` | Birincil düğme üzerine gelince |
| `navy` | `#2F24C1` | Kelime markası "Şantiye Hesap" ve tanıtım sitesi başlıkları |
| `navyDeep` | `#1E1878` | Tanıtım kahramanının koyu ucu |
| `cyan` | `#3FD1CB` | İkincil vurgu, gradyan ucu |
| `cyanInk` | `#0E6E6A` | Cyan zemin üstündeki metin (ör. "Paylaştırıldı" notu) |
| `income` / `success` | `#166534` | Gelir tutarı, başarı |
| `expense` / `danger` | `#DC2626` | Gider tutarı, silme, gecikme, zorunlu yıldız |
| `warn` | `#B45309` | Yaklaşan vade ("11 gün kaldı") |
| `onPrimary` | `#FFFFFF` | Mor ve lacivert üstündeki metin |
| `onNavyMuted` | `rgba(255,255,255,0.72)` | Lacivert üstündeki ikincil metin (tanıtım sitesi) |
| `backdrop` | `rgba(15,23,42,0.72)` | Modal arkası |

Tint'ler (yumuşak zeminler):

| Ad | Değer | Kullanım |
| --- | --- | --- |
| primary %8 / %14 | `rgba(77,18,238,0.08)` / `0.14` | Seçili menü zemini, filtre etiketi, seçili segment |
| cyan %18 | `rgba(63,209,203,0.18)` | Paylaştırma notu, demo/görüntüleme bandı |
| income %10 | `rgba(22,101,52,0.10)` | Gelir ikon kutusu, yeşil rozet |
| expense %9 | `rgba(220,38,38,0.09)` | Gider ikon kutusu, kırmızı rozet |
| warn %12 | `rgba(217,119,6,0.12)` | Yaklaşan vade rozeti |

Gradyan yalnız tanıtım sitesinde ve giriş ekranı arkasında: `primary` → `navy` → `cyan`, sol üstten sağ alta. Uygulama ekranlarında gradyan yok.

Renk kuralları:

- **Metin rengi:** Gövde, başlık ve rakamlar `ink`; açıklamalar `ink2`/`muted`. Uygulama içinde başlık veya gövde metni mor/lacivert yapılmaz.
- **Tutarlar:** Gelir `income` ve "+" önekli, gider `expense` ve "−" önekli. Tutar rengi asla gri yapılmaz. Gelir − gider farkı ve kalan borç/alacak gibi bakiyeler `ink` renginde; fark negatifse "−" önekli.
- **İade:** İade, kaynak hareketin rengini taşır ve "−" önekiyle gösterilir: ödeme iadesi kırmızı "−₺5.000,00", tahsilat iadesi yeşil "−". Tür yazısı ("Ödeme iadesi" / "Tahsilat iadesi") her zaman görünür.
- **Kartlar beyazdır.** Gelir/gider kutularına renkli zemin verilmez; renk yalnız rakamda ve küçük ikon kutusundadır.
- **Durumlar:** Gecikmiş vade kırmızı rozet + uyarı ikonu + "N gün gecikti"; yaklaşan vade `warn` rozet + saat ikonu + "N gün kaldı"; fazla ödeme/tahsilat `danger` kenarlı uyarı kutusu; demo ve yalnız görüntüleme bandı cyan %18 zemin + `ink` metin. Anlam hiçbir yerde yalnız renge bırakılmaz.

### 4.2 Tipografi

| Rol | Aile | Ağırlık | Boyut |
| --- | --- | --- | --- |
| Tanıtım başlığı | Outfit | 700 | 40–56 px |
| Sayfa başlığı (uygulama) | Outfit | 600 | 28 px masaüstü, 24 px telefon; harf aralığı −0.6 px |
| Panel başlığı | Outfit | 600 | 17 px |
| Ana rakam (özet kutusu) | Outfit | 600 | 28 px (bakiye kutularında 24 px); telefonda 22 / 19 px |
| Gövde, tablo hücresi, liste başlığı | DM Sans | 400–600 | 14–15 px |
| Etiket, düğme, sekme | DM Sans | 500–600 | 13–14 px |
| Meta, alt bilgi | DM Sans | 400 | 12–13 px, `muted` |
| Tablo başlığı, grup etiketi | DM Sans | 600 | 11–11.5 px, büyük harf, harf aralığı 0.05–0.07em, `muted` |

Google Fonts'tan Outfit ve DM Sans yükle. Gövde satır yüksekliği 1.45. Bütün tutarlar `font-variant-numeric: tabular-nums` ile ve satır kırılmadan yazılır. Bu ölçeğin dışına çıkılmaz; açıklama için ek küçük gri metin satırları eklenmez, gerekirse bilgi ikonuna (ipucu) taşınır.

### 4.3 Ölçü

| Token | Değer |
| --- | --- |
| Boşluk | 4 / 6 / 8 / 10 / 12 / 14 / 16 / 22 / 28 / 32 px |
| Radius | rozet 999 px; segment 6–7 px; input ve düğme 9–10 px; ikon kutusu 8–10 px; kart/panel 14 px |
| Kart gölgesi | `0 1px 2px rgba(27,24,56,.04), 0 2px 8px rgba(27,24,56,.04)` |
| Açılır menü gölgesi | `0 12px 32px rgba(20,20,40,.14)` |
| Dokunma alanı | Telefonda düğme ve satırlar en az 44–48 px yükseklik |

### 4.4 Bileşenler

- **İkonlar:** Lucide (`lucide-react`), çizgi kalınlığı 1.9; menüde 18 px, düğmede 17 px, satır ikon kutusunda 15–17 px. İkon yalnız süs değil, anlam taşır; ikonlu düğmenin ya metni ya `aria-label`ı vardır.
- **Birincil düğme:** zemin `primary`, metin beyaz, yükseklik masaüstünde 40 px, telefonda en az 48 px, radius 10 px, ikon + metin.
- **Kenarlı (ghost) düğme:** beyaz zemin, `border` kenar, `ink` metin; ikincil eylemler (Gelir ekle, Gider ekle, indir). Gelir/gider kaydetme düğmesinde yeşil/kırmızı varyant yalnız form içinde serbest.
- **Tehlike:** zemin `danger`, beyaz metin. Silmede onay ve gerekçe sor.
- **Input / select:** zemin `surface`, kenar `border`, radius 9 px, yükseklik 38–40 px (telefonda 44 px), placeholder `muted`. Hata kenarı `danger`, hata metni alanın altında. Üstte etiket (12–13 px, 600), zorunlu alanda kırmızı yıldız.
- **Segment (ör. Bu ay / Tüm zamanlar, Tümü / Gelir / Gider / İade):** beyaz kutu içinde düğme grubu; seçili öğe primary %14 zemin + `primary` metin.
- **Filtre etiketi (chip):** primary %8 zemin, `primary` metin, kaldırmak için × düğmesi; yanında "Filtreleri temizle".
- **Rozet (pill):** 12 px, 600, tam yuvarlak; yeşil, kırmızı, uyarı, nötr ve primary türleri.
- **Kart / panel:** beyaz, radius 14 px, `border` kenar, hafif gölge. Kart içinde kart yok; panel içindeki listeler ince çizgiyle ayrılmış satırlardır.
- **Panel başlığı:** solda ikon + başlık, sağda "Tümü ›" bağlantısı.
- **Gecikme rozeti:** "N gün gecikti"; gün sayısı API'de yoksa `packages/shared` içindeki `overdueDaysOf` ile hesaplanır.
- **Özet kutusu (metrik):** etiket + renkli ikon kutusu, büyük rakam, tek satır alt bilgi. Gecikmiş tutar bakiye kutusunun içinde kırmızı rozet olarak gösterilir, ayrı kutu açılmaz.
- **Liste satırı:** solda 36 px ikon kutusu (tür rengi), ortada başlık (600) ve tek satır meta ("Şantiye · Kişi · Tarih"), sağda tutar ve gerekirse rozet. Uzun metin üç nokta ile kısalır.
- **Tablo:** başlık satırı küçük büyük harf `muted`; satır ayırıcı `borderSoft`; üzerine gelince satır `surface` zemin; tutar sütunları sağa yaslı. İlk sütun bağlantılı ana bilgi + altında meta satırı.
- **Sekmeler:** alt çizgili; seçili sekme `primary` metin ve 2 px alt çizgi; her sekmede sayı rozeti.
- **Bağlantılar:** altı çizili değil; `ink` (600) veya `primary` renkte, üzerine gelince `primary` / alt çizgi.
- **Boş durum:** kısa açıklama + varsa eylem. Boş grup tam kart değil, tek satırdır.
- **Para:** `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })`. Özet sayfasındaki kutularda kuruşsuz (`formatMoneyWhole`, yarım yukarı yuvarlar); liste, tablo, detay sayfası ve detay sayfasının üstündeki özet kutularında kuruşlu (API ile birebir aynı tutar). Paylaştırma notunda kuruş yalnız gerekiyorsa yazılır ("₺25.000 + ₺15.000").
- **Tarih:** `tr-TR` `d MMM yyyy` (13 Eki 2026). Takvim alanı metin inputu değil, tarih seçici.
- **Toast / dialog:** tarayıcı `alert` kullanma. Markalı dialog: başlık, mesaj, Vazgeç ve onay. Kritik veya belirsiz durumlar (kayıt doğrulanıyor, belge yüklenemedi) yalnız kısa toast'ta kalmaz, sayfada kalıcı görünür.
- **Etki önizlemesi:** Bedel değişikliği, iptal, iade, silme, geri yükleme ve düzeltme dialoglarında önce "önce → sonra" kutusu: etkilenen kalan borç/alacak, fazla tutar ve toplamlar. Altında zorunlu gerekçe alanı. Silme, geri yükleme, iade ve düzeltme önizlemeleri `packages/shared` içindeki `previewAgreementBalance` ve `previewCashTotals` ile hesaplanır; bedel değişikliği ve iptalde API önizlemesi (`?preview=1`) kullanılır.
- **Kaydetme durumu:** Kaydediliyor / Kaydedildi / Kaydedilemedi / Kaydın durumu doğrulanıyor. Dördü ayrı metin ve ikonla gösterilir, yalnız renkle değil.
- **Belge satırı:** küçük önizleme veya dosya ikonu, ad, boyut, durum (bekliyor / yükleniyor / yüklendi / başarısız) ve yeniden dene. Görsellerin küçük önizlemesi için 5 dakikalık önizleme adresi alınır. 760 px altında ad ve hata metni tam genişlikte, durum rozeti ve eylemler alt satırdadır.
- **Belge ekleme düğmeleri:** Dokunmatik cihazda iki düğme: "Fotoğraf çek" (`capture="environment"`) ve "Galeriden seç"; Android'de `capture` galeri seçeneğini kaldırdığı için ayrıdırlar. Masaüstünde tek "Dosya ekle" düğmesi. Hepsi `accept="image/*,application/pdf"`. Değişiklik kapalıysa (ör. görüntüleme dönemi), kayıt silinmişse, belge alanı doluysa veya kayıtta 10 belge varsa düğme kapalıdır ve nedeni yanında yazılıdır. Kapasite bilgisi alınamazsa yükleme engellenmez; sınırları sunucu uygular.
- **Belge paneli (işlem ve anlaşma detayı):** Yüklenmiş belgeler; her birinde önizle, indir, sil (gerekçeli). Silinen belgeler aynı panelde "Silinen belgeler" bölümünde silen kişi, zaman ve gerekçeyle listelenir ve oradan gerekçeyle geri alınır. Başka oturumdan kalmış yarım yüklemeler "Bekliyor" olarak, bir saat içinde kendiliğinden kalkacağı notuyla görünür. Silme ve geri alma kapasite veya 10 belge sınırı yüzünden kapanmaz; 10 belgeli kayıtta geri alma dialogu nedeni gösterir. Görüntüleme döneminde silme ve geri alma da kapalıdır.
- **Belge önizleme dialogu:** Görselin önizlemesi dialogda gösterilir. Önizlemesi olmayan belgede (PDF, çözülemeyen görsel, kotaya sığmayan önizleme) dialog "Orijinali aç" bağlantısı ve "Orijinali indir" düğmesi verir; orijinal yeni sekmede kendiliğinden açılmaz (telefon tarayıcılarının açılır pencere engeli). İndirme imzalı adresi `attachment` olarak açar; sayfa değişmez.

### 4.5 Yerleşim

| Genişlik | Davranış |
| --- | --- |
| ≥ 1100 px | Sol sabit menü 232 px + üst çubuk + içerik. **İçerik genişlik sınırı yok**; menünün yanından başlar, iki yanda 32 px boşlukla ekranı doldurur. Formlar ve ayar sayfaları da tam genişliktir ve iki sütunlu düzen kullanır (aşağıda) |
| 760–1099 px | Üst çubuk + içerik, menü drawer; içerik iki yanda 24 px |
| < 760 px | Tek kolon, iki yanda 16 px; kenar menü yok, **alt menü** (Özet, Şantiyeler, İşlemler, Kişiler, Diğer) ve sağ altta yüzen **+** düğmesi; tablolar kart listesine döner; özet kutuları iki sütun |

- **Kenar menü:** üstte logo kutusu + "Şantiye Hesap" + firma adı; ana grup (Özet, Şantiyeler, İşlemler, Kişiler, Anlaşmalar); "Takip" grubu (Vadeler — gecikmiş sayısı rozetiyle, Raporlar); altta Silinenler, Ayarlar ve kullanıcı kartı (baş harfler, ad, çıkış ikonu). Her öğe ikonlu.
- **Üst çubuk:** genel arama kutusu (yer tutucu "Şantiye, kişi, tutar veya kayıt no ara"; `/` kısayolu; sonuçlar `/uygulama/ara` sayfasında) ve sağda **Yeni kayıt** düğmesi (açılır menü: Gelir ekle, Gider ekle, Anlaşma ekle; her biri ikon ve kısa açıklamalı).
- **Sayfa başlığı:** solda başlık ve tek satır açıklama, sağda sayfanın ana eylemleri.
- **+ Kayıt:** Telefonda yüzen + düğmesi aynı menüyü açar. Açıldığı bağlamdaki şantiye/anlaşma hazır seçilir. Form sayfalarında (`/yeni`, `/duzenle`, `/iade`, `/odeme`) kaydet düğmelerini örtmemesi için gizlenir.
- **Telefonda sayfa eylemleri:** Sayfa başlığındaki eylemlerden yüzen + menüsünde bulunanlar (Gelir/Gider ekle) telefonda gizlenir; menüde olmayanlar (ör. "Yeni şantiye") görünür kalır.
- **Form ve ayar sayfaları (iki sütunlu, tam genişlik):** 900 px ve üstünde solda ana bilgiler, sağda ikincil bilgiler; daha dar ekranda tek sütun ve aynı sıra. Tek bir alanın aşırı uzamaması için input/select'lere makul bir üst genişlik verilebilir; sayfanın kendisi daraltılmaz.

  | Sayfa | Sol sütun | Sağ sütun |
  | --- | --- | --- |
  | Gelir/gider, anlaşmaya ödeme | Tutar, tarih, kişi, kapsam, anlaşma, paylar | Kategori, açıklama, belgeler |
  | Anlaşma / başlangıç kaydı | Ad, yön, kişi, kapsam, bedel, tarihler | Açıklama, belgeler |
  | Şantiye formu | Ad, adres, başlangıç tarihi | Açıklama |
  | Kişi formu | Ad, tür, etiketler | İletişim, not |
  | İade | Kaynak hareket | İade formu, etki önizlemesi ve belgeler |
  | Finansal düzeltme | Alanlar | Değişiklik önizlemesi (finansal alan değişmediyse kısa açıklama) |
  | Profil | Görünen ad, telefon, e-posta | Kullanıcı adı ve şifre sayfasına bağlantı |
  | Şifre | Form | Şifre kuralları |
  | Firma | Firma bilgileri | Belge alanı, hizmet durumu |
  | Kategoriler | Yeni kategori ve kurallar | Kategori listesi |
  | Hakkında | Ürün, sürüm, dil | Veriler notu |

  Ayarlar menüsü yan yana panellerdir. Yeni bir form veya ayar sayfası aynı ilkeyle düzenlenir.
- **Detay sayfaları (şantiye, kişi, anlaşma, işlem):** Sık eylemler sayfa başlığında ikonlu düğmeler; seyrek eylemler (düzenle, sabitle, tamamla, arşivle, iptal, sil vb.) "Diğer" menüsünde. Başlığın altında özet kutuları, onun altında iki sütunlu paneller; değişiklik geçmişi en altta. Değişiklik geçmişi, paylar ve belge alanı panel içinde çizgiyle ayrılmış satırlardır; etki önizlemesi kenarsız, `surface` zeminli gömülü kutudur.

Klavye ve odak: her input görünür kalsın. Formlar sayfa içinde kayar. Modal uzunsa kendi içinde kayar, arka plan kilitlenir. `Esc` modalı ve açılır menüyü kapatır. Odak tuzağı ve görünür odak halkası (`primary`, 2 px) olsun.

---

## 5. Bilgi mimarisi

### 5.1 Herkese açık

| Rota | Sayfa |
| --- | --- |
| `/` | Tanıtım ana sayfa |
| `/ozellikler` | Özellik anlatımı |
| `/nasil-calisir` | Üç adımlı akış |
| `/fiyatlandirma` | Kullanım modeli: demo serbest, firma hesabı ürün sahibiyle görüşülerek açılır |
| `/sss` | Sık sorulan sorular |
| `/gizlilik` | Gizlilik metni |
| `/kosullar` | Kullanım koşulları |
| `/giris` | Kullanıcı adı + şifre ile giriş ve "Demoyu dene" |
| `/ilk-sifre` | Geçici şifre sonrası kişisel şifre oluşturma (oturumlu) |
| `/sifremi-unuttum` | Ürün sahibine nasıl ulaşılacağını anlatan bilgi sayfası |
| `/demo` | Demo açılışı; ziyaretçiye özel geçici demo firmasına alır |

Giriş yapmış kullanıcı giriş ve demo sayfalarına gelirse `/uygulama`ya yönlendir.

### 5.2 Uygulama

Demo aynı rotaları `/demo/uygulama/...` altında, demo bandıyla kullanır.

| Rota | Sayfa |
| --- | --- |
| `/uygulama` | Özet pano |
| `/uygulama/projeler` | Şantiye listesi |
| `/uygulama/projeler/yeni` | Şantiye oluştur |
| `/uygulama/projeler/:id` | Şantiye detay |
| `/uygulama/projeler/:id/duzenle` | Şantiye düzenle |
| `/uygulama/projeler/:id/rapor` | Şantiye özeti ve hareket dökümü |
| `/uygulama/kisiler` | Kişi / firma listesi |
| `/uygulama/kisiler/yeni` | Kişi oluştur |
| `/uygulama/kisiler/:id` | Kişi detay ve hesap dökümü |
| `/uygulama/kisiler/:id/duzenle` | Kişi düzenle |
| `/uygulama/islemler` | Gelir, gider ve iade listesi |
| `/uygulama/islemler/yeni` | Gelir veya gider formu, `?tur=gelir\|gider&proje=&kisi=&anlasma=&genel=1` |
| `/uygulama/islemler/:id` | İşlem detay |
| `/uygulama/islemler/:id/duzenle` | Finansal düzeltme |
| `/uygulama/islemler/:id/iade` | İade kaydet |
| `/uygulama/anlasmalar` | Anlaşma ve başlangıç borç/alacak listesi |
| `/uygulama/anlasmalar/yeni` | Anlaşma formu, `?yon=odenecek\|tahsil&proje=&kisi=&genel=1` |
| `/uygulama/anlasmalar/baslangic/yeni` | Başlangıç borç/alacak formu |
| `/uygulama/anlasmalar/:id` | Anlaşma veya başlangıç kaydı detay |
| `/uygulama/anlasmalar/:id/odeme` | Bu anlaşmaya ödeme veya tahsilat ekle |
| `/uygulama/vadeler` | Gecikmiş, yaklaşan ve vadesiz açık tutarlar |
| `/uygulama/raporlar` | Standart raporlar ve tam firma veri çıkışı |
| `/uygulama/ara` | Genel arama |
| `/uygulama/silinenler` | Silinen kayıtlar |
| `/uygulama/ayarlar` | Ayarlar menüsü |
| `/uygulama/ayarlar/profil` | Görünen ad ve iletişim |
| `/uygulama/ayarlar/sifre` | Şifre |
| `/uygulama/ayarlar/firma` | Ortak firma görünen adı, iletişim, depolama kullanımı, hizmet durumu |
| `/uygulama/ayarlar/kategoriler` | Gider kategorileri |
| `/uygulama/ayarlar/hakkinda` | Sürüm ve ürün notu |

Sol menü (bölüm 4.5): Özet, Şantiyeler, İşlemler, Kişiler, Anlaşmalar; "Takip" grubunda Vadeler ve Raporlar; altta Silinenler, Ayarlar ve kullanıcı kartı. Arama menüde değil, üst çubuktaki arama kutusundadır; sonuçlar `/uygulama/ara` sayfasında açılır. Telefonda "Diğer" sekmesi Anlaşmalar, Vadeler, Raporlar, Ara, Silinenler ve Ayarlar'ı listeler.

### 5.3 Yönetim (ürün sahibi)

| Rota | Sayfa |
| --- | --- |
| `/yonetim/giris` | Ürün sahibi girişi (ayrı hesap türü): şifre, ardından TOTP veya kurtarma kodu |
| `/yonetim/guvenlik-kurulumu` | İlk girişte zorunlu TOTP kurulumu ve kurtarma kodlarının bir kez gösterimi |
| `/yonetim/guvenlik` | TOTP'yi yeniden kurma ve kurtarma kodlarını yenileme |
| `/yonetim` | İşletim özeti ve firma listesi |
| `/yonetim/firmalar/yeni` | Firma oluştur |
| `/yonetim/firmalar/:id` | Firma detay: kullanıcılar, depolama, hizmet durumu, işletim geçmişi |
| `/yonetim/firmalar/:id/sil` | Kalıcı silme onayı (yalnız saklama süresi dolmuşsa) |

Müşteri menüsünde hesap açma ekranı yoktur. Yönetim rotaları `noindex`.

---

## 6. Tanıtım sitesi

Üst çubuk: solda kelime markası **Şantiye Hesap**, sağda Özellikler, Nasıl çalışır, Kullanım, SSS, **Giriş yap** (hayalet), **Demoyu dene** (birincil, `/demo`). Mobilde hamburger.

Altbilgi: kısa tanım, gizlilik, koşullar, iletişim için `SUPPORT_CONTACT_TEXT`. Uydurma adres veya telefon yazma. Telif yılı dinamik.

### 6.1 Ana sayfa bölümleri

1. **Kahraman.** Gradyan zemin, beyaz başlık: "Şantiye parasını net ve hızlı yönetin." Alt metin: şantiyelerdeki gelir, gider, taşeron ve müşteri anlaşmaları, kalan borç ve alacak tek yerde. İki düğme: Demoyu dene, Nasıl çalışır. Sağda (mobilde altta) ürün önizlemesi: lacivert özet kartı, yeşil tahsilat, kırmızı ödeme, gelir–gider farkı ve kalan borç. Rakamlar örnek olsun, canlı veri değil. Örnek: Tahsilat 1.250.000 TL, Ödeme 860.000 TL, Fark 390.000 TL, Kalan borç 145.000 TL, şantiye adı "Kadıköy Villa".
2. **Sorun.** Üç kısa kart: dağınık defter, kimin ne kadar kaldığı belli olmayan anlaşma, şantiye bitince çıkmayan rapor.
3. **Çözüm ızgarası.** Altı özellik, her biri ikon + başlık + iki cümle: şantiye ve firma geneli, kişi/firma hesabı, gelir-gider, anlaşma ve kalan borç/alacak, vade takibi, belge ve PDF/Excel rapor.
4. **Nasıl çalışır.** 1 Şantiyeyi ve anlaşmaları aç. 2 Ödemeleri ve tahsilatları işle. 3 Kalanı ve vadeleri izle, raporu indir.
5. **Kim için.** Müteahhit, şantiye şefi, ofis muhasebesini şantiyeyle birlikte tutan küçük ekip. Kurumsal ERP, e-fatura veya resmi muhasebe vaadi yok.
6. **Güven.** Veriler sunucuda, her firmanın kayıtları ayrı, şifre hash'lenir, her kayıt kimin girdiğiyle saklanır, silinen kayıt geri alınabilir, değişiklik geçmişi korunur.
7. **Son çağrı.** Lacivert bant, beyaz başlık, birincil düğme Demoyu dene; yanında hayalet düğme Giriş yap.

### 6.2 Diğer pazarlama sayfaları

- **Özellikler:** her modül için bir bölüm, solda metin sağda sade arayüz karesi. Renkler uygulama ile aynı. Modüller: şantiyeler ve firma geneli giderler, kişi/firma hesabı, gelir-gider ve iade, ödenecek ve tahsil edilecek anlaşmalar, vade takibi, belgeler, arama ve raporlar.
- **Nasıl çalışır:** üç adım dikey zaman çizelgesi, cyan noktalar.
- **Kullanım (`/fiyatlandirma`):** tek kart. Başlık "Şantiyeniz için tek hesap". Metin: demo hesapsız denenir; firma hesabı ve kullanıcılar görüşme sonrası açılır; bütün modüller açıktır; firma başına 20 GB belge alanıyla başlar. Fiyat rakamı yazma, karşılaştırma tablosu uydurma. Düğmeler: Demoyu dene, İletişim (`SUPPORT_CONTACT_TEXT`).
- **SSS:** en az sekiz soru, accordion. Konular: kim kullanır; nasıl hesap açılır (ürün sahibi açar, giriş bilgisini iletir); veri nerede durur ve diğer firmalar görebilir mi (hayır); silinen kayıt geri gelir mi; anlaşma gider yazar mı (hayır, yalnız gerçek ödeme gider olur); fazla ödeme; rapor formatı; şifremi unuttum; telefonda kullanılır mı (evet, tarayıcıdan; ayrı uygulama yok).
- **Gizlilik ve koşullar:** sade yasal sayfa, beyaz kart, `surface` zemin. Uydurma şirket adresi yazma. Veri sorumlusu metnini "uygulama işletmecisi" diye genel tut, sahte unvan ekleme. Hizmet sonu saklama sürelerini (bölüm 9.10) yaz.

Tanıtım sayfalarında sahte müşteri yorumu, sahte logo duvarı ve sahte istatistik ("10.000 şantiye") koyma.

### 6.3 Demo

- `/demo` ve "Demoyu dene" ziyaretçi için demo veritabanında yeni ve geçici bir firma açar, sabit örnek veri kümesini bu firmaya kopyalar ve hesapsız demo oturumu verir. Gerçek müşteri veritabanına hiç yazmaz.
- Örnek veri tutarlı olsun: iki aktif, bir tamamlanmış şantiye; taşeron ve müşteri anlaşmaları; kısmi ödemeler ve tahsilatlar; bir gecikmiş alacak; bir firma geneli gider; bir başlangıç borcu; bir iade; bir paylaştırılmış ödeme; birkaç örnek belge. Rastgele ad kullanılabilir; tutarlar ve ilişkiler kurallara uymalı.
- Bütün demo ekranlarının üstünde sabit bant: "Örnek veriler — değişiklikler geçicidir. Gerçek firma verisi girmeyin." Bantta **Demoyu sıfırla** (onaylı) ve **Giriş yap**.
- Ziyaretçi kayıt ekleyip düzenleyebilir; başka ziyaretçiyi veya gerçek firmayı etkilemez. Gerçek dosya yükleme kapalıdır; belge eklemede örnek belgelerden seçilir.
- 24 saat hareketsiz kalan demo firması silinir. Demo açma IP başına sınırlıdır. Demo dışa aktarmaları "Örnek veri" etiketi taşır.

---

## 7. Uygulama ekranları

Genel kurallar: Başlangıçta yeni gerçek firma boştur; örnek veri doldurma. Bütün para tutarları kuruş hassasiyetindedir. Bağlamdan açılan formda şantiye/anlaşma hazır seçilir ve görünür olur; kullanıcıdan gizli seçim yapılmaz.

### 7.1 Özet

Düzen onaylanan taslaktaki gibidir (`tasarim/taslak_v1.html`, Özet).

Sayfa başlığı: "Merhaba, {ad}"; altında tek satır kapsam: "Firma geneli · tamamlanan ve arşivlenen şantiyeler dahil". Sağda kenarlı düğmeler: Gelir ekle, Gider ekle.

Özet kutularının üstünde dönem segmenti (**Bu ay** / **Tüm zamanlar**, varsayılan Bu ay) ve sağda "Hesaplandı: {tarih saat}". Ayrı bir "Bu ay şeridi" yoktur; dönem segmenti ilk üç kutunun değerini değiştirir.

| Kutu | Kaynak | Not |
| --- | --- | --- |
| Tahsilat | `monthly.netIncome` / `totals.netIncome` | Yeşil rakam; alt satır dönem adı |
| Ödeme | `monthly.netExpense` / `totals.netExpense` | Kırmızı rakam; alt satır düşülen ödeme iadesi |
| Gelir − gider farkı | `monthly.difference` / `totals.difference` | `ink` rakam, negatifse "−". "Kâr" veya "kasa" diye adlandırma |
| Kalan alacak | `totals.remainingReceivable` | Dönemden bağımsız güncel bakiye; içinde kırmızı rozet "Gecikmiş {overdueReceivable}" |
| Kalan borç | `totals.remainingPayable` | Dönemden bağımsız güncel bakiye; içinde kırmızı rozet "Gecikmiş {overduePayable}" |

Masaüstünde beş kutu tek satırdadır; telefonda iki sütun, "Gelir − gider farkı" tam genişlik. Aktif şantiye sayısı ayrı kutu değildir; "Son kullanılan şantiyeler" panelinde görünür. Kalan alacak/borç anlaşmaları ve başlangıç kayıtlarını birlikte içerir (bölüm 9.1); kutunun ipucunda bu yazılır.

Altında iki satır halinde dört panel (masaüstünde 2×2; ilk satırda sol panel daha geniş), her biri en fazla beş satır ve "Tümü ›" bağlantısı:

- Son hareketler (liste satırı: tür ikonu, açıklama, "şantiye · kişi · tarih", işaretli tutar)
- Vadeler: "Gecikmiş" ve "14 gün içinde" alt grupları; satırda kişi, anlaşma, şantiye, vade, tutar ve "N gün gecikti" / "N gün kaldı" rozeti
- Açık anlaşmalar (kalan > 0): ad, kişi · şantiye, kalan ve "Kalan alacak/borç"; başlangıç kaydı "Başlangıç" rozetiyle
- Son kullanılan şantiyeler: ad, son kullanım, gelir − gider farkı

Hızlı kayıt: sayfa başlığındaki düğmeler ve üst çubuktaki **Yeni kayıt**. Satıra tıklayınca ilgili detaya git. Yüklenirken tutar kutularında `0 TL` gösterme, yükleniyor durumu göster. Hata halinde yeniden dene. Boş veride "İlk şantiyeni oluştur" ve "Başlangıç borç/alacağı gir" eylemlerine yönlendir; şantiye oluşturmak firma geneli kayıt için ön koşul değildir.

### 7.2 Şantiyeler

Düzen onaylanan taslaktaki gibidir (`tasarim/taslak_v1.html`, Şantiyeler).

Sayfa başlığının sağında birincil **Yeni şantiye** düğmesi (listede ayrı "yeni şantiye" kartı yok). Durum sekmeleri sayı rozetli: Aktif (varsayılan) / Tamamlandı / Arşivlendi / Tümü. Altında arama ("Şantiye adı veya adres ara") ve sıralama (son kullanılan, yeniden eskiye, eskiden yeniye, ada göre). Sabitlenenler önce gelir.

Masaüstünde tablo: sabitleme ikonu, şantiye adı (altında adres · son kullanım), tahsilat, ödeme, fark, kalan borç, kalan alacak (gecikmiş varsa altında kırmızı), satır sonunda "Diğer işlemler" menüsü (yalnız sayfa bağlantıları: detay, düzenle, bu şantiyeye gelir/gider ekle; tamamla, arşivle gibi durum eylemleri detay sayfasındadır). Durum sütunu yalnız "Tümü" sekmesinde görünür. Telefonda her şantiye bir kart: ad, adres, sabitleme, fark, son kullanım, kalan borç, kalan alacak.

Form alanları:

| Alan | Zorunlu | Not |
| --- | --- | --- |
| Proje adı | Evet | Örn. Kadıköy Villa Şantiyesi. Benzer ad varsa uyar, engelleme |
| Açıklama | Hayır | Çok satır |
| Adres / konum | Hayır | Serbest metin |
| Başlangıç tarihi | Hayır | Bilinmiyorsa boş kalır; bugün zorla yazılmaz |

Kayıttan sonra detaya git. Düzenlemede aynı alanlar. Sabitle.

Durum eylemleri ayrı düğmelerdir:

- **Tamamla:** Açık borç/alacak ve vadeler dialogda gösterilir; kullanıcı onayıyla tamamlanır. Tamamlanma tarihi bugün önerilir, değiştirilebilir. Tamamlamak tutarları, vadeleri veya kalanları değiştirmez. Tamamlanan şantiyede:
  - Anlaşmaya bağlı ödeme, tahsilat, iade ve düzeltme serbesttir.
  - Anlaşmaya bağlı olmayan yeni gider gerekçe ister (formda gerekçe alanı açılır).
  - Anlaşmaya bağlı olmayan gelir serbesttir.
  - Yeni anlaşma için şantiye önce gerekçeyle yeniden aktifleştirilir.
- **Yeniden aktifleştir:** gerekçe ister; `completedAt` alanını temizler.
- **Arşivle / arşivden çıkar:** Günlük listeden kaldırır; kayıt, belge ve açık tutarlar firma özetinde ve vade listelerinde kalır. Arşivlenen şantiye kayıt kuralları bakımından tamamlanan şantiye gibi davranır. Arşivden çıkınca önceki duruma döner: `completedAt` doluysa tamamlandı, boşsa aktif.
- **Sil:** Yalnız hiç aktif hareketi ve anlaşması olmayan şantiyede, onay ve gerekçeyle, yumuşak. Kaydı olan şantiyede sil yerine arşivle önerilir.

Detay üstünde özet kutuları (bölüm 4.4, beyaz kart): tahsilat, ödeme, fark, ödenecek anlaşma toplamı, ödenen, kalan borç, tahsil edilecek anlaşma toplamı, tahsil edilen, kalan alacak, fazla ödeme/tahsilat varsa ayrı. Bloklar: son hareketler, anlaşmalar, vadeler, rapor bağlantısı. Gelir ekle, gider ekle ve anlaşma ekle bu projeye kilitli açılsın.

### 7.3 Kişiler

Kişi/firma tercihi:

| Kod | Etiket |
| --- | --- |
| `person` | Kişi |
| `company` | Firma |

Etiketler (birden fazla seçilebilir, isteğe bağlı):

| Kod | Etiket |
| --- | --- |
| `supplier` | Tedarikçi |
| `subcontractor` | Taşeron |
| `customer` | Müşteri |

Arama (ad, telefon), etiket filtresi, sıralama, sabitleme. Form: ad/unvan zorunlu; kişi/firma tercihi, etiketler, telefon, e-posta, adres, not isteğe bağlı. Varsayılan firma. Benzer ad varsa öner ve uyar; yalnız ad eşitliği yüzünden engelleme veya birleştirme yapma.

Hızlı ekleme: Gelir/gider veya anlaşma formundan yalnız adla kişi açılabilir; açık formdaki tutar, tarih ve kapsam kaybolmaz.

Detay: ad, tür, etiketler, iletişim, not. Finans, borç ve alacak **ayrı** (netleştirip gizleme):

- Kalan borç, kalan alacak, fazla ödeme, fazla tahsilat
- Şantiye ve firma geneli bazında dağılım
- Anlaşmalar ve başlangıç kayıtları
- Hareket geçmişi; anlaşmaya bağlanmamış doğrudan hareketler ayrı işaretli ("Anlaşmaya bağlı değil")

Eylemler: ilgili anlaşmaya ödeme yap / tahsilat al, yeni anlaşma, hesap dökümü indir.

İşlem geçmişi olan kişi silinmez; **pasifleştirilir**. Silinmiş ama geri yüklenebilir hareketi veya anlaşması olan kişi de bu kapsamdadır. Pasif kişi yeni kayıtta önerilmez, geçmişte görünür, yeniden aktifleştirilebilir. Hiç kaydı olmayan kişi onayla yumuşak silinebilir.

### 7.4 İşlemler

Düzen onaylanan taslaktaki gibidir (`tasarim/taslak_v1.html`, İşlemler): sayfa başlığı (sağda "Bu sonuçları indir"), araç çubuğu paneli, toplam şeridi, tablo.

- **Araç çubuğu tek satır:** arama kutusu; tarih segmenti (Bugün / Bu ay / Tümü / takvim ikonu ile aralık); tür segmenti (Tümü / Gelir / Gider / İade); **Filtreler** düğmesi (etkin ek filtre sayısı rozetli). Altında etkin filtre etiketleri ve "Filtreleri temizle". Diğer filtreler "Filtreler" düğmesiyle açılan panelde.
- **Toplam şeridi:** Tahsilat (net), Ödeme (net, altında düşülen iade), Gelir − gider farkı ve kayıt sayısı; bütün filtrelenmiş sonuçları kapsar.
- **Tablo sütunları:** İşlem (tür ikonu; açıklama bağlantısı; altında "#no · tarih · tür"; paylaştırılmışsa cyan "Paylaştırıldı: ₺25.000 + ₺15.000" notu), Kişi (yoksa "Muhatapsız"), Şantiye (veya "Firma geneli"), Anlaşma (yoksa "Bağlı değil"), Kategori, Tutar (sağa yaslı, işaretli ve renkli). Telefonda her satır kart olur: açıklama ve meta solda, tutar sağda, şantiye · kişi altta.

Filtreler, birlikte çalışır:

- Tarih aralığı (işlem tarihine göre). Hızlı seçenekler: Bugün, Bu ay (varsayılan, görünür), Tümü
- Tür: tümü / gelir / gider / iade
- Kapsam: şantiye(ler) veya firma geneli
- Kişi/firma, gider kategorisi, anlaşma bağlantısı (bağlı / bağlı değil)
- Kategorisiz, muhatapsız
- Kaydı oluşturan kullanıcı
- Tutar alt-üst
- Silinenleri göster

Sıralama: yeniden eskiye, eskiden yeniye, tutar azalan, tutar artan. Arama: açıklama, kişi adı, şantiye/anlaşma adı, kayıt numarası, tutar. Türkçe büyük/küçük harf farkı engellemesin. Sayfalama 50. Liste özeti bütün filtrelenmiş sonuçları toplar. Şantiye filtresinde paylaştırılmış hareketin yalnız o şantiyeye düşen payı toplanır. Seçili filtreler, sonuç sayısı ve "Filtreleri temizle" görünür kalır; detaydan dönünce filtre ve konum korunur (URL sorgusu). Telefonda arama, tarih ve tür segmenti görünür; diğer filtreler açılır panelde.

Form:

| Alan | Zorunlu | Not |
| --- | --- | --- |
| Tür | Evet | Gelir veya gider. Açılan eylemden hazır, URL ile kilitlenebilir |
| Şantiye veya firma geneli | Evet | Aktif şantiyeler chip veya seçim + açık "Firma geneli" seçeneği. Bağlamdan hazır gelebilir, görünür olur. Tamamlanan şantiye de seçilebilir |
| Tutar | Evet | 0'dan büyük, en fazla iki ondalık, yazarken binlik. Boş başlar. Giriş kuralı bölüm 3 "Para" |
| İşlem tarihi | Evet | Bugün hazır, değiştirilebilir |
| Gerekçe | Koşullu | Yalnız tamamlanan veya arşivlenen şantiyeye anlaşmasız gider girilirken görünür ve zorunludur |
| Kişi/firma | Hayır | Yazınca öner, listeden seç, yoksa aynı akışta hızlı ekle |
| Gider kategorisi | Hayır, giderde | Seçilmezse "Kategorisiz" |
| Anlaşma | Hayır | Seçilen kişinin aynı kapsam ve yöndeki açık anlaşmaları önerilir; **otomatik bağlanmaz**. Seçilirse kalan tutar görünür |
| Açıklama | Hayır | Giderde örnek: demir, beton, usta ödemesi |
| Belgeler | Hayır | Kameradan veya galeriden (bölüm 4.4 belge ekleme düğmeleri); en fazla 10 |

Kurallar:

- Doğrudan gelir/gider anlaşma gerektirmez. Kişi seçmek anlaşmaya bağlamak sayılmaz. Kişinin açık anlaşması varsa form "Bu kayıt anlaşmaya bağlı değil; anlaşmanın kalanı değişmez" bilgisini gösterir.
- Anlaşma seçilirse kişi ve kapsam anlaşmadan gelir ve kilitlenir. Tutar kalanla otomatik dolmaz; "Kalanın tamamı" kısayolu vardır.
- Tutar kalanı aşarsa fazla ödeme/tahsilat uyarısı çıkar; kullanıcı onay ve gerekçe girmeden kayıt oluşmaz (bölüm 9.4).
- **Paylaştır:** Tek gerçek ödemeyi birden fazla şantiye/anlaşmaya bölmek için. Satır ekle: kapsam, varsa anlaşma veya başlangıç kaydı, pay tutarı; her satırda hedefin kalanı görünür. Bütün satırlar aynı yönde ve varsa aynı kişiye ait. Dağıtılmamış tutar görünür; pay toplamı ana tutara eşit olmadan kaydetme açılmaz. Hata metni örneği: "Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı." Basit kayıtta paylaştırma satırları görünmez.
- **Mükerrer uyarısı:** Aynı gün, aynı tutar, aynı kişi ve kapsamda başka kayıt varsa kayıt engellenmez. Oluşturma cevabı uyarıyı ve benzer kayıtların numaralarını döner; ekran bunu kayıttan sonra gösterir ve benzer kayıtlara bağlantı verir.
- Kaydet başarılı olunca geldiği liste/detaya dön. "Kaydet ve yeni ekle" tutarı boşaltır, kapsam ve tarihi korur, kişi/anlaşma bağlantısını görünür biçimde yeniden sorar.
- Kayıt finansal kayıt ile belge yüklemesini ayrı gösterir: "İşlem kaydedildi; 1 belge yüklenemedi" → yalnız belge yeniden denenir.
- **Formda belge akışı** (gelir/gider, anlaşmaya ödeme, iade, anlaşma ve başlangıç kaydı formları aynı): Seçilen dosyalar "Bekliyor" olarak listelenir; finansal kayıt oluştuktan sonra sırayla yüklenir (yükleme niyeti → imzalı adrese doğrudan yükleme → tamamlama). Yükleme sürerken kaydet düğmeleri kilitlidir. Bir belge yüklenemezse form "İşlem kaydedildi; 1 belge yüklenemedi." sonuç görünümünde kalır; yalnız o belge yeniden denenir, kayıt tekrar oluşturulmaz. Bütün belgeler yüklenince kayıt sonrası olağan dönüş yapılır. 20 MB üstü, boş veya desteklenmeyen türdeki dosya gönderilmeden "Başarısız" gösterilir ve yeniden denenmez.

Detay: kayıt no, tür, tutar, tarih, kapsam ve paylar, kişi, kategori, anlaşma, açıklama, belgeler (bölüm 4.4 belge paneli; detaydan eklenen belge hemen yüklenir), iadeler, oluşturan ve zaman, son güncelleyen, değişiklik geçmişi (eski → yeni, kim, ne zaman, gerekçe). Belge ekleme, silme ve geri alma kaydın değişiklik geçmişine değil belgenin kendi geçmişine yazılır; silme bilgisi belge panelinde, belgenin bütün geçmişi tam firma veri çıkışında görünür.

Eylemler:

- **Düzenle (finansal düzeltme):** Tutar, tarih, kapsam, kişi, anlaşma, paylar değişirse eski/yeni değerler ve bakiye etkisi önizlenir, gerekçe zorunlu. Yalnız açıklama değişiyorsa gerekçe gerekmez, geçmiş yine yazılır. Yanlış şantiye/anlaşma düzeltmesinde eski ve yeni bakiyeler aynı transaction'da güncellenir; tutar değişmiyorsa firma toplamı değişmez. Bağlı iadeyi tutarsız bırakan değişiklik engellenir:
  - Bağlı aktif iadesi olan pay kaldırılamaz.
  - Böyle bir payın şantiyesi veya anlaşması değiştirilemez.
  - Böyle bir payın tutarı bağlı iade toplamının altına indirilemez.
  - Bağlı iadesi olan hareketin kişisi değiştirilemez.
  - Hedef değişecekse önce iade silinir; ekran bunu açıklar.
- **İade kaydet:** bölüm 7.5.
- **Kopyala:** Kayıt açmaz. Aynı alanlar ve bugünün tarihiyle dolu bir yeni kayıt formu açılır; geçmiş ve belgeler boş, anlaşma bağlantısı "onay gerekli" işaretlidir. Kullanıcı kaydedince normal oluşturma akışı çalışır.
- **Sil:** Tutar, kapsam ve bakiye etkisiyle onay + gerekçe. Bağlı aktif iadesi varsa silinemez; nedeni gösterilir. Paylaştırılmış hareketin bütün payları birlikte kalkar.
- **Geri al:** Silinenlerden; bölüm 7.9.

### 7.5 İade

İlgili ödeme/tahsilat detayından "İade kaydet" açılır. Ödemeden geri gelen paraya **ödeme iadesi**, müşteriye geri verilen tahsilata **tahsilat iadesi** denir.

- Kaynak hareket, önceki iadeler ve en fazla iade edilebilir tutar gösterilir.
- Zorunlu: iade tutarı (pozitif), gerçek tarih, kısa gerekçe. Belge isteğe bağlı. Gerekçe iade kaydının açıklaması olur; kaynak hareketin kişisi ve kategorisi iade kaydına taşınır.
- Kaynak paylaştırılmışsa kullanıcı hangi payı ne kadar geri çevirdiğini seçer; pay bazında iade, payın kalan iade edilebilir tutarını aşamaz.
- Kaydetmeden önce net ödenen/tahsil edilen, kalan ve fazla tutar etkisi önizlenir.
- İade başka anlaşmaya kendiliğinden dağıtılmaz; kaynak hareketin tutarı değişmez.
- Hata metni örneği: "Bu kayıttan en fazla 10.000 TL iade edilebilir."

### 7.6 Anlaşmalar ve başlangıç kayıtları

Liste: yön (ödenecek / tahsil edilecek), kapsam, kişi, iş durumu, ödeme durumu, vade durumu filtreleri. Başlangıç borç/alacakları aynı listede "Başlangıç" rozetiyle yer alır.

**Anlaşma formu:**

| Alan | Zorunlu | Not |
| --- | --- | --- |
| Anlaşma adı | Evet | Örn. Elektrik işi |
| Yön | Evet | Ödenecek (taşeron, tedarikçi) veya tahsil edilecek (müşteri) |
| Şantiye veya firma geneli | Evet | Bağlamdan hazır gelebilir |
| Kişi/firma | Evet | Hızlı ekleme var |
| Toplam bedel | Evet | Pozitif, en fazla iki ondalık |
| Anlaşma tarihi | Hayır | Sistem oluşturma zamanından ayrı; geçmiş tarihli girilebilir |
| Vade tarihi | Hayır | Tek vade |
| Açıklama | Hayır | |
| Belgeler | Hayır | Sözleşme, teklif |

Kayıt olunca anlaşma `ongoing` iş durumunda doğar. **Anlaşma oluşturmak gelir veya gider hareketi yazmaz.** İlk ödeme/tahsilat, kayıttan sonra ayrı eylemle girilir.

**Başlangıç borç/alacak formu:**

| Alan | Zorunlu | Not |
| --- | --- | --- |
| Yön | Evet | Başlangıç borcu veya başlangıç alacağı |
| Kişi/firma | Evet | |
| Şantiye veya firma geneli | Evet | |
| Devreden kalan tutar | Evet | O tarihte gerçekten açık kalan tutar; ilk anlaşma bedeli değil |
| Takip başlangıç tarihi | Evet | Bugün önerilir; uygulamaya geçiş tarihi |
| Vade, açıklama, belgeler | Hayır | |

Formda bilgi: "Bu tutar yeni gider/gelir sayılmaz. Aynı borcu ayrıca geçmiş anlaşma olarak girmeyin." Başlangıç kaydı yeni para hareketi değildir; ondan açılan ödeme/tahsilat bu kayda bağlanır.

**Detay:** güncel bedel (ilk bedel ve değişiklikler), net ödenen/tahsil edilen, kalan, fazla, iş durumu, ödeme durumu, vade ve vade durumu, bağlı hareketler ve iadeler, belgeler (işlem detayındakiyle aynı belge paneli ve formdaki belge akışı, bölüm 4.4 ve 7.4), geçmiş.

Eylemler:

- **Ödeme yap / Tahsilat al:** `/uygulama/anlasmalar/:id/odeme`. İşlem formunun anlaşmaya kilitli hali: kişi, kapsam ve anlaşma hazır; kalan görünür; tutar boş; "Kalanın tamamı" kısayolu.
- **Bedeli değiştir:** Eski bedel, yeni bedel, gerekçe zorunlu. Yeni kalan veya fazla önizlenir. Ek iş aynı anlaşmanın bedeline eklenebilir; ayrı iş için "Yeni anlaşma oluştur" bağlantısı gösterilir. Bedel artışı gider oluşturmaz. Bedel ödenenin altına düşerse geçmiş ödemeler değişmez; kalan 0, aşan tutar fazla ödeme olur.
- **Vadeyi değiştir:** eski/yeni tarih ve gerekçe.
- **İşi tamamlandı olarak işaretle:** iş durumunu değiştirir; borç/alacağı sıfırlamaz.
- **İptal et:** İşin iptalini ve hesaplaşmayı ayırır. Kesinleşen bedel biliniyorsa yeni bedel ve gerekçe alınır; ödenen, kalan ve fazla birlikte gösterilir. Kesin bedel belli değilse anlaşma "İptal — hesap kesinleşmedi" olarak kalır, kalan gizlenmez. İptal para iadesi oluşturmaz; geri gelen para iade eylemiyle girilir.
  - İptal edilen anlaşmaya ödeme/tahsilat bağlanabilir (hesaplaşma için).
  - Hesabı kesinleşmemiş iptalde "Bedeli değiştir" kesin bedeli kaydeder.
  - Kesin bedeli girilmiş iptalde bedel değiştirilemez.
  - İptal edilen anlaşmanın iş durumu değiştirilemez.
- **Sil:** Yalnız hiç aktif bağlı hareketi olmayan anlaşmada, onay ve gerekçeyle. Hareketi olan anlaşmada sil yerine iptal veya bedel değişikliği önerilir.

### 7.7 Vadeler

Üç grup: gecikmiş, yaklaşan (vade tarihi aralığı seçilebilir, varsayılan 30 gün), vadesi belirlenmemiş açık tutarlar. Pencerenin ötesindeki vadeler ayrı "Daha sonra" (`later`) grubunda listelenebilir. Gruplama kuralı bölüm 9.3. Borç ve alacak ayrı sekmeler. Tamamlanan ve arşivlenen şantiyelerin açık tutarları dahil. Satırda kişi, anlaşma, kapsam, vade, kalan, gecikme gün sayısı. Bildirim yok; yalnız uygulama içi liste.

### 7.8 Arama

Tek kutu: şantiye, kişi, anlaşma, tutar, açıklama, kayıt numarası. Sonuçlar dört grup: Şantiyeler, Kişiler / firmalar, Anlaşmalar, İşlemler. Tür filtresi, tarih aralığı. Türkçe büyük/küçük harf ve `ı/i`, `ş/s` gibi karakterler engel olmasın. Arama firmanın bütün kayıtlarında çalışır, yalnız yüklenmiş sayfada değil. Belge içeriğinde arama yok. Tutar tek değer (`12.500`) veya aralık (`10.000-20.000`) olarak aranabilir. Boş sorguda son aramalar (en fazla üç, yalnız o kullanıcının) ve temizle. Arama yapılınca geçmişe yaz.

### 7.9 Silinenler

Listeler: işlemler, anlaşmalar, şantiyeler, kişiler. Satırda silen kişi, zaman ve gerekçe. Silinen kayıtlar normal toplamlara girmez. Silinen belgeler bu sayfada listelenmez; bağlı oldukları işlem veya anlaşmanın detayındaki "Silinen belgeler" bölümünden geri alınır (bölüm 4.4).

**Geri al:** Güncel ilişkiler doğrulanır (anlaşma hâlâ aktif mi, kapsam ve kişi uyumlu mu, iade sınırı aşılıyor mu). Bakiye etkisi önizlenir, gerekçe istenir. Geçersiz ilişki varsa sessizce düzeltme; nedeni ve çözüm yolunu göster. Finansal etki bir kez uygulanır. Kalıcı silme eylemi müşteriye sunulmaz.

### 7.10 Raporlar ve veri çıkışı

Dört standart rapor; telefonda da görüntülenir ve indirilir. `/uygulama/raporlar` dört sekmelidir; şantiye sekmesi ve `/uygulama/projeler/:id/rapor` aynı görünümü kullanır. Her raporda Excel/CSV/PDF indirme menüsü vardır; tablolar telefonda kart listesine döner.

1. **Dönem gelir/gider hareket dökümü:** tarih aralığı (ekran "Bu ay" ile açılır), kapsam, kategori filtreleri; kategori özeti. Kapsam: tüm firma, firma geneli kayıtlar veya bir şantiye (tamamlanan ve arşivlenenler dahil); kapsam seçilince tutarlar o kapsama düşen paylardan hesaplanır. Kategori filtresi o kategorinin giderlerini ve ödeme iadelerini birlikte alır; "Kategorisiz" kategorisiz giderleri ve iadelerini alır. Kategori özeti her kategori için ödeme, ödeme iadesi ve net ödeme verir.
2. **Şantiye özeti ve hareket dökümü** (`/uygulama/projeler/:id/rapor`): özet kutuları (tahsilat, ödeme, fark, anlaşmalar, ödenen, kalan borç/alacak, fazla), altta gelir ve gider listeleri tarihe göre artan. Bütün tarihlerle açılır.
3. **Kişi/firma hesap dökümü:** borç, alacak, fazla ödeme/tahsilat ve anlaşmaya bağlanmamış doğrudan hareketler ayrı. Bütün tarihlerle açılır. Anlaşmalar ve başlangıç kayıtları tek tabloda, başlangıç kayıtları "Başlangıç kaydı" etiketiyle; ödenecek ve tahsil edilecek toplamları ayrı satırlarda (mahsup yok). Hareketler "Anlaşmaya bağlı" ve "Doğrudan (anlaşmaya bağlanmamış; borcu azaltmaz)" diye ayrılır; doğrudan hareket, hiçbir payı anlaşmaya bağlı olmayan harekettir (kişi detayıyla aynı tanım). Kişi detayındaki "Hesap dökümü indir" bu raporu o kişi için bütün tarihlerle açar.
4. **Açık borç/alacak ve vade listesi:** başlangıç kayıtları dahil, etiketli. Kalanı olan anlaşmalar ve başlangıç kayıtları vade gruplarına (gecikmiş, yaklaşan 30 gün, daha sonra, vadesi belirlenmemiş; bölüm 9.3) ayrılır; her grupta kalan borç ve kalan alacak ayrı toplanır. Tarih filtresi yoktur; yön (borç, alacak, ikisi) ve kapsam (dönem dökümüyle aynı seçenekler) seçilir.

Her raporda ve indirilen dosyada: firma adı, kapsam, işlem tarihi aralığı, üretim tarihi/saati, "Güncel kalan — hesaplandığı tarih/saat" ve takip başlangıcı. Tarih aralığı yalnız hareketleri daraltır; kalan borç/alacak, gecikmiş ve fazla tutarlar her zaman günceldir ve "Güncel kalan" satırındaki ana aittir. Takip başlangıcı, raporun kapsamındaki başlangıç kayıtlarının en erken takip başlangıç tarihidir; kapsamda başlangıç kaydı yoksa satır yine bulunur ve "Başlangıç kaydı yok" yazar. "Bu rapor takip başlangıç tarihinden itibaren kayıtlı hareketleri kapsar" uyarısı yalnız başlangıç kaydı varsa çıkar.

İndir: Excel, CSV ve PDF (biçimler bölüm 2). PDF başlığı rapor adı ve şantiye/kişi adı. "Bu sonuçları indir" etkin filtrelerin bütün sonuçlarını alır; telefonda da görünür, sonuç yoksa kapalıdır. Paylaştırılmış kayıtta ana işlem no, toplam gerçek tutar ve seçili kapsama düşen pay ayrı sütunlardır; toplamlar paydan hesaplanır, ana tutar tekrar sayılmaz. Dosyadaki toplamlar aynı satırlardan hesaplanır. Borç/alacak ile gerçekleşen hareketler karıştırılmaz. Ayrıntılar:

- Dönem dökümünde ve "Bu sonuçları indir"de her hareket tek satırdır. "Toplam tutar" hareketin gerçek tutarıdır; kapsam seçildiyse "Kapsama düşen pay" ayrı sütundur ve toplam satırları bu sütundan hesaplanır. Paylar Excel ve CSV'de ayrıca "Kadıköy Villa: 25.000 TL; Şişli Ofis: 15.000 TL" biçiminde yazılır. İade satırında kaynak hareketin işlem no'su ayrı sütundur.
- "Silinenleri göster" açıkken indirilen dosyada silinen kayıtlar "Silindi" durumuyla listelenir ama toplamlara katılmaz.
- PDF okunabilir dökümdür: paylar, kaynak işlem no, sisteme girilme zamanı ve takip başlangıcı sütunları yalnız Excel ve CSV'dedir (takip başlangıcı başlık bilgisi PDF'te de vardır). Gelir yeşil, gider kırmızı; kalan borç/alacak bakiyedir ve `ink` renginde yazılır.
- Dosya adı Türkçe harfleri sadeleştirilmiş ASCII ve İstanbul günüyle verilir (ör. `santiye-raporu-kadikoy-villa-2026-10-15.pdf`).

**Tüm firma verisini dışa aktar:** Filtrelerden bağımsız, ayrı düğme. Arka planda hazırlanır, ilerleme ve hazır olunca indirme gösterilir. İçerik: hareketler, paylar, iadeler, anlaşmalar, başlangıç kayıtları, şantiyeler, kişiler, kategoriler ve değişiklik geçmişi; ilişkileri açıklanmış Excel sayfaları veya CSV dosyaları; orijinal belgeler dosya–kayıt eşleme tablosuyla zip paketinde. Silinen ama geri alınabilir kayıtlar durum etiketiyle. Şifre, token veya başka firma verisi içermez. Hazır paket 7 gün sonra silinir. Hazırlama hatası finansal kayıtları etkilemez.

### 7.11 Ayarlar

- **Profil:** görünen ad, telefon, e-posta. Kullanıcı adını yalnız ürün sahibi değiştirir.
- **Şifre:** mevcut, yeni, tekrar. Yeni en az 8 karakter. Başarılı olunca bütün oturumlar düşer, girişe al.
- **Firma:** ortak firma görünen adı ve iletişim bilgileri (bütün firma kullanıcıları düzenleyebilir, geçmiş tutulur). Depolama kullanımı: kullanılan / toplam; orijinal belgeler (belge sayısıyla), önizlemeler ve silinmiş ama geri alınabilir belgeler her zaman ayrı satırda; yüklenmekte olan dosyalar ve dışa aktarma paketleri yalnız varsa. Satırların toplamı kullanılan alana eşittir (`GET /company` `storage.breakdown`). Hizmet durumu ve varsa bitiş tarihleri. Kapasite artırımı için `SUPPORT_CONTACT_TEXT`; satın alma akışı yok.
- **Kategoriler:** gider kategorisi ekle, yeniden adlandır, pasifleştir. Kullanılmış kategori silinmez, pasifleşir. Ad firma içinde Türkçe harf farkı gözetmeden benzersizdir. Pasif kategori yeni kayıtta seçilemez; pasif kategorili kaydın geri yüklenmesine engel olmaz.
- **Hakkında:** ürün adı, slogan, sürüm, "veriler sunucuda, dil Türkçe".

### 7.12 Giriş ve ilk şifre

- Giriş: kullanıcı adı ve şifre. Hata: "Kullanıcı adı veya şifre hatalı". Hangi alanın yanlış olduğunu söyleme. Altında "Demoyu dene" ve "Şifremi unuttum".
- Şifremi unuttum: "Şifrenizi sıfırlamak için hesabınızı açan ürün sahibiyle iletişime geçin" + `SUPPORT_CONTACT_TEXT`. E-posta gönderimi yok.
- İlk şifre: geçici şifreyle giren kullanıcı kişisel şifresini oluşturmadan başka ekrana geçemez. Kişisel şifre kaydedilince bütün eski oturumlar düşer, yeni oturum verilir ve kullanıcı yeniden giriş yapmadan firma özetine alınır. (Normal şifre değişiminde yeni oturum verilmez; kullanıcı yeniden giriş yapar, bölüm 7.11.)
- Oturum bittiyse yeniden giriş istenir. Giriş sonrası önceki form kendiliğinden gönderilmez.

### 7.13 Yönetim (ürün sahibi)

- **İşletim özeti ve firma listesi:** Firma adına göre arama; durum filtresi (aktif, geçici durdurulmuş, hizmet sonu görüntüleme, arşiv saklama, silme onayı bekleyen). Satırda firma adı, kullanıcı sayısı, kullanılan/toplam depolama, hizmet durumu ve ilgili bitiş tarihleri. Kapasitesi dolan/yaklaşan, görüntüleme süresi biten ve saklama süresi dolan firmalar üstte özetlenir. Otomatik müşteri mesajı ve faturalama yok.
- **Firma oluştur:** ad zorunlu; yetkili kişi, telefon, e-posta, işletim notu isteğe bağlı. Yeni firma aktif, boş ve 20 GB kapasiteyle başlar; demo verisi aktarılmaz. Benzer ad uyarısı engellemez.
- **Kullanıcı ekle:** ad soyad, kullanıcı adı (sistem genelinde benzersiz, küçük harfe ve Türkçe kurallara göre normalize) ve firma zorunlu; telefon/e-posta isteğe bağlı. Sistem geçici şifre üretir ve **yalnız bir kez** gösterir; 72 saat geçerlidir. Ürün sahibi bunu müşteriye kendisi iletir; uygulama mesaj göndermez. Kullanıcı tek firmaya bağlıdır.
  - Kullanıcı adı biçimi: 3–50 karakter; harf (Türkçe dahil), rakam, nokta, alt çizgi ve tire.
  - Geçici şifre hiçbir yerde düz metin saklanmaz. Oluşturma isteği aynı `Idempotency-Key` ile tekrar gelirse kullanıcı şifresiz döner ve "Geçici şifre ilk yanıtta gösterildi; görmediyseniz şifreyi sıfırlayın" denir.
- **Şifre sıfırla:** gerekçe zorunlu. Yeni geçici şifre üretir, mevcut şifre hiç görüntülenmez, bütün oturumlar hemen düşer.
- **Kullanıcıyı pasifleştir / aktifleştir:** gerekçe zorunlu. Giriş ve oturumlar hemen kapanır; geçmişteki kayıt atıfları kalır.
- Firma ve kullanıcı oluşturmada gerekçe isteğe bağlıdır. Bütün yönetim işlemleri işletim geçmişine yazılır.
- **Kapasite:** gerekçeyle artır veya mevcut kullanımın altına inmeden azalt; önceki/yeni değer ve kim/ne zaman kaydedilir.
- **Hizmet yaşam döngüsü:** Geçici durdur, Hizmeti sonlandır, Yeniden aç ayrı eylemler. Sonlandırmada yürürlük tarihi (geçmişe çekilemez), son görüntüleme günü (`viewUntil`) ve saklama bitişi (`retainUntil`) kesin tarih olarak önizlenir (gün sınırları bölüm 9.10); gerekçe ve onay alınır. Arşiv uzatmada yeni saklama bitişi ve gerekçe; uzatma müşteri erişimini açmaz.
- **Kalıcı silme:** Yalnız saklama süresi dolmuş firmada, ayrı ekranda. Firma adı, durum, kapsanan kayıt ve belge sayısı, geri döndürülemeyecek sonuç gösterilir; firma adını yazarak onay ve gerekçe. Durum: bekliyor / sürüyor / tamamlandı / başarısız. Kalıcı silinen firma yeniden açılamaz.
- **İşletim geçmişi:** hesap, şifre sıfırlama, kapasite, hizmet ve silme işlemleri kim, ne zaman, gerekçe ile kaydedilir; şifre hiçbir yerde loglanmaz.
- Ürün sahibi müşteri finansal kayıtlarını görüntülemez ve düzenlemez.
- **Hesap güvenliği:**
  - Giriş iki aşamalıdır: şifre, ardından doğrulama uygulamasındaki 6 haneli TOTP kodu. İki aşamalı doğrulama kapatılamaz.
  - İlk girişte (bootstrap hesabı) QR kodla TOTP kurulumu zorunludur. Kurulum bir doğru kodla onaylanmadan yönetim alanı açılmaz.
  - Kurulum onaylanınca 10 adet tek kullanımlık kurtarma kodu **bir kez** gösterilir ve indirilebilir. Ekranda "Bu kodları çevrimdışı ve güvenli bir yerde saklayın" uyarısı olur. Kodlar yalnız hash olarak saklanır.
  - Telefon kaybolursa giriş, kod yerine bir kurtarma kodu ile yapılır. Kullanılan kod geçersizleşir. Giriş sonrası TOTP yeniden kurulabilir ve kurtarma kodları yenilenebilir; yenileme eski kodları geçersiz kılar.
  - Hem telefon hem kurtarma kodları kaybolursa web üzerinden kurtarma yolu yoktur. Yalnız sunucuya erişimi olan kişi `pnpm --filter api platform:reset-2fa --username <ad>` komutunu çalıştırabilir. Komut TOTP'yi ve kurtarma kodlarını sıfırlar, bütün ürün sahibi oturumlarını düşürür ve PlatformLog'a yazar. Sonraki girişte kurulum yeniden zorunludur.
  - Yanlış TOTP veya kurtarma kodu denemeleri sınırlıdır; aşılınca kısa süreli kilit uygulanır.

---

## 8. Veri modeli

Ortak alanlar (Company, User, PlatformAdmin, SearchHistory, IdempotencyRecord, PlatformLog hariç):

| Alan | Tip | Anlam |
| --- | --- | --- |
| `companyId` | ObjectId → Company | Zorunlu, her sorguda filtre |
| `deletedAt` `deletedBy` `deleteReason` | Date / User / string veya null | Doluysa silinmiş |
| `createdBy` | ObjectId → User | Zorunlu |
| `updatedBy` | ObjectId → User | Zorunlu |
| `createdAt` `updatedAt` | Date | Otomatik |
| `history` | `{ at, by, action, changes: { field, old, new }[], reason }[]` | Oluşturma, düzenleme, durum değişikliği, silme, geri yükleme |

Bütün tutar alanları kuruş cinsinden tamsayıdır. İş tarihleri `YYYY-MM-DD` metnidir.

### 8.1 Company

| Alan | Kural |
| --- | --- |
| `name` | Zorunlu, ürün sahibinin kaydettiği ad |
| `displayName` `contact` | Firma kullanıcılarının düzenleyebildiği görünen ad ve iletişim |
| `opsNote` | Yalnız ürün sahibi görür |
| `storageQuotaBytes` | Varsayılan 20 GB |
| `storageUsedBytes` | Atomik `$inc` ile güncellenir |
| `isSuspended` | Geçici durdurma |
| `serviceEndedAt` | Hizmet sonu yürürlük tarihi veya null |
| `viewUntil` `retainUntil` | `serviceEndedAt` (D) + 30 gün / D + 180 gün; ikisi de dahil edilen son gündür (bölüm 9.10). Arşiv uzatmada `retainUntil` güncellenir |
| `deletionStatus` | `none` `pending` `running` `done` `failed` |
| `isDemo` `demoLastActiveAt` | Yalnız demo veritabanında |
| `recordCounter` | Firma içi artan kayıt numarası |

### 8.2 User

| Alan | Kural |
| --- | --- |
| `companyId` | Zorunlu, tek firma |
| `name` | Zorunlu, trim, en az 2 karakter |
| `username` | Zorunlu, sistem genelinde benzersiz, `tr-TR` küçük harf, trim |
| `phone` `email` | İsteğe bağlı |
| `passwordHash` | bcrypt, asla API'de dönmez |
| `mustChangePassword` | Geçici şifrede true |
| `tempPasswordExpiresAt` | Geçici şifre + 72 saat |
| `isActive` | Pasifleştirmede false |
| `refreshTokens` | Hash'lenmiş token dizisi, en fazla son 10 |
| `tokensValidAfter` | Şifre değişimi, sıfırlama veya pasifleştirmede güncellenir; bu andan önce verilmiş access token'lar süresini beklemeden reddedilir |

**PlatformAdmin:** `username`, `passwordHash`, `refreshTokens`, `totpSecretEncrypted` (`PLATFORM_TOTP_ENCRYPTION_KEY` ile şifreli), `totpConfirmedAt` (null ise kurulum zorunlu), `recoveryCodeHashes` (kullanılmamış kodlar), `totpLastUsedStep` (aynı kodun tekrar kullanılmaması için), `tokensValidAfter` (2FA sıfırlamasında güncellenir), `failedSecondFactorCount` ve `secondFactorLockedUntil`. Ayrı koleksiyon; müşteri firmasına bağlı değildir.

### 8.3 Project

| Alan | Kural |
| --- | --- |
| `name` | Zorunlu |
| `description` `address` | Varsayılan boş |
| `startDate` | `YYYY-MM-DD` veya null |
| `status` | `active` `completed` `archived`, varsayılan `active` |
| `completedAt` | Tamamlanma tarihi veya null |
| `pinned` | boolean, varsayılan false |
| `lastUsedAt` | Son işlem veya anlaşmada güncellenir |

İndeksler: `companyId + status + deletedAt`; `companyId + pinned + lastUsedAt` azalan; arama için `companyId + nameFolded`.

### 8.4 Party

| Alan | Kural |
| --- | --- |
| `name` | Zorunlu |
| `nameFolded` | Türkçe küçük harf + karakter katlama, arama için |
| `kind` | `person` veya `company`, varsayılan `company` |
| `tags` | `supplier` `subcontractor` `customer` alt kümesi |
| `phone` `email` `address` `note` | Varsayılan boş |
| `isActive` | Pasifleştirmede false |
| `pinned` `lastUsedAt` | Proje ile aynı mantık |

İndeksler: `companyId + nameFolded`; `companyId + tags + deletedAt`; sabitleme + son kullanım.

### 8.5 Category

| Alan | Kural |
| --- | --- |
| `name` | Zorunlu, firma içinde benzersiz |
| `isActive` | Pasifleştirmede false |

Yeni firmaya başlangıç kategorileri: Malzeme, İşçilik, Taşeron, Nakliye, Kira, Genel giderler. Firma oluşturulurken aynı transaction'da "Sistem" adına eklenir; kullanıcı değiştirebilir. Ad firma içinde Türkçe katlamalı olarak benzersizdir.

### 8.6 Transaction

| Alan | Kural |
| --- | --- |
| `recordNo` | Firma içi artan numara |
| `kind` | `income` `expense` `expense_refund` (ödeme iadesi, para girer) `income_refund` (tahsilat iadesi, para çıkar) |
| `amount` | Kuruş, 0'dan büyük |
| `date` | Zorunlu, `YYYY-MM-DD` |
| `partyId` | Opsiyonel; anlaşmaya bağlı payda zorunlu ve anlaşmanın kişisiyle aynı |
| `categoryId` | Opsiyonel, yalnız giderde |
| `description` | Varsayılan boş |
| `allocations` | `{ _id, scope: 'project' \| 'company', projectId?, agreementId?, amount, refundedAmount }[]`, en az bir satır |
| `refundOf` | İadede: `{ transactionId, parts: { allocationId, amount }[] }` |
| `excess` | Fazla ödeme/tahsilat onaylandıysa `{ amount, reason }` |
| `documentCount` | Atomik sayaç, en fazla 10 |

Kurallar: Payların toplamı `amount`'a eşittir. Basit kayıtta tek pay otomatik oluşur. Pay hedefi anlaşmaysa yön uyumlu olmalı (gider ↔ ödenecek, gelir ↔ tahsil edilecek) ve kapsam anlaşmanın kapsamıyla aynı olmalı. `refundedAmount`, o paya bağlı aktif iadelerin toplamıdır ve aynı transaction'da güncellenir.

İade hareketi de kendi paylarıyla kaydedilir: her payı, geri çevirdiği kaynak payın kapsamını ve anlaşmasını taşır. Şantiye toplamları iadeyi bu paylardan hesaplar. Anlaşmanın net ödenen/tahsil edilen tutarı ise kaynak payların `refundedAmount` değerinden hesaplanır; iade iki kez sayılmaz.

İndeksler: `companyId + date` azalan; `companyId + allocations.projectId + date`; `companyId + allocations.agreementId`; `companyId + partyId + deletedAt`; `companyId + kind + date`; `companyId + recordNo` benzersiz; `companyId + createdBy`; `refundOf.transactionId`.

### 8.7 Agreement

Anlaşmalar ve başlangıç borç/alacakları aynı koleksiyondadır.

| Alan | Kural |
| --- | --- |
| `kind` | `agreement` veya `opening` |
| `direction` | `payable` (ödenecek / borç) veya `receivable` (tahsil edilecek / alacak) |
| `scope` `projectId` | `project` + projectId veya `company` |
| `partyId` | Zorunlu |
| `title` | Anlaşmada zorunlu |
| `description` | Opsiyonel |
| `initialAmount` | Pozitif kuruş; başlangıç kaydında devreden kalan |
| `currentAmount` | Güncel bedel; iptal/hesaplaşmada 0 olabilir |
| `amountHistory` | `{ at, by, old, new, reason }[]` |
| `agreementDate` | Anlaşmada opsiyonel |
| `trackingStartDate` | Başlangıç kaydında zorunlu |
| `dueDate` | Opsiyonel, tek vade |
| `dueDateHistory` | `{ at, by, old, new, reason }[]` |
| `workStatus` | Anlaşmada `ongoing` `completed` `cancelled` |
| `settlementPending` | İptal edildi ama kesin bedel belli değil |
| `netSettled` `remaining` `excess` `paymentStatus` | Önbellek, bağlı her harekette aynı transaction'da yeniden hesaplanır |
| `documentCount` | Atomik sayaç, en fazla 10 (Transaction'daki gibi) |

`paymentStatus` nete göre ve şu sırayla belirlenir: fazla > 0 → `overpaid`; kalan 0 → `settled`; net ödenen/tahsil edilen 0 → `open`; aksi halde `partial`. Böylece bedeli 0'a inmiş ve ödemesi olmayan anlaşma `settled`, ödemeleri tamamen iade edilmiş anlaşma `open` görünür. Hesabı kesinleşmemiş iptal (`settlementPending`) ekranda ayrıca "İptal — hesap kesinleşmedi" olarak gösterilir.

İndeksler: `companyId + projectId + partyId + deletedAt`; `companyId + direction + remaining`; `companyId + dueDate + remaining`; `companyId + paymentStatus`.

### 8.8 Document

| Alan | Kural |
| --- | --- |
| `ownerType` `ownerId` | `transaction` veya `agreement` |
| `fileName` `mimeType` | Tür, istemcinin bildirdiğine değil dosyanın ilk baytlarına (dosya imzası) göre belirlenir ve kaydedilir |
| `sizeBytes` | Sunucunun ölçtüğü gerçek boyut |
| `storageKey` `previewKey` | Nihai orijinal ve önizleme anahtarları. Nihai anahtar her tamamlama denemesine özgüdür ve üzerine yazılmaz. `previewKey` önizleme üretilemediyse boştur |
| `status` | `pending` `uploaded` `failed` `expired` |
| `uploadedBy` `uploadedAt` | Otomatik |
| Ortak alanlar | Silme alanları ve `history` bölüm 8 başındaki gibi; belge silme ve geri yükleme gerekçesiyle belgenin kendi `history`'sine yazılır |

Desteklenen türler: PDF, JPEG, PNG, WEBP, HEIC/HEIF. Dosya en fazla 20 MB, kayıt başına en fazla 10 belge. Bağlı kaydın `documentCount` değeri yalnız silinmemiş `pending` ve `uploaded` belgeleri sayar. Belge eklemek, silmek veya geri yüklemek bağlı kaydın `updatedAt` değerini ve `history`'sini değiştirmez; açık bir düzenleme formu bu yüzden çakışma almaz.

### 8.9 SearchHistory

| Alan | Kural |
| --- | --- |
| `companyId` `userId` | Zorunlu |
| `query` | trim, zorunlu |
| `createdAt` | Var, `updatedAt` yok |

İndeks: `userId + createdAt` azalan. Temizle o kullanıcının hepsini siler.

### 8.10 Yardımcı koleksiyonlar

- **IdempotencyRecord:** `companyId`, `userId`, `key` (benzersiz `companyId + key`), `requestHash`, `resultRef`, `createdAt` (30 gün TTL).
- **ExportJob:** `companyId`, `requestedBy`, `type`, `status` (`queued` `running` `ready` `failed`), `progress`, `fileKey`, `expiresAt` (7 gün).
- **PlatformLog:** `adminId`, `companyId`, `action`, `changes`, `reason`, `at`. Şifre içermez; firma kalıcı silinse de asgari kaydı (firma adı, tarihler, işlem yapan, gerekçe) kalır.

---

## 9. İş kuralları

### 9.1 Toplamlar

| Kural | Davranış |
| --- | --- |
| Gerçekleşen tahsilat | Silinmemiş gelirler − silinmemiş tahsilat iadeleri |
| Gerçekleşen ödeme | Silinmemiş giderler − silinmemiş ödeme iadeleri |
| Gelir − gider farkı | Tahsilat − ödeme. "Kâr" veya "kasa" diye adlandırma |
| Şantiye özeti | Aynı formül, yalnız o şantiyeye ait **paylar** üzerinden. Firma geneli kayıtlar şantiyeye dağıtılmaz |
| Firma toplamı | Hareket tutarları üzerinden; paylaştırılmış hareket bir kez sayılır. Şantiye + firma geneli |
| Dönem | İşlem tarihine göre. İade kendi tarihinin dönemine yazılır: ocakta 40.000 TL ödeme, şubatta 10.000 TL iade → ocak 40.000, şubat −10.000, toplam 30.000 |
| Kişi özeti | O kişiye bağlı borç, alacak, fazla ödeme, fazla tahsilat ve doğrudan hareketler **ayrı**. Otomatik mahsup yok |
| Kapsam | Tamamlanan ve arşivlenen şantiyelerin açık tutarları firma toplamında ve vade listelerinde kalır. Yalnız aktifleri kapsayan özet bunu açıkça yazar |
| Başlangıç kayıtları özetlerde | Anlaşma toplamı, ödenen, kalan borç/alacak ve gecikmiş tutarlar anlaşmaları ve başlangıç kayıtlarını birlikte içerir; başlangıç kayıtları ayrıca ayrı alt toplam olarak döner. Ekran ve raporlarda bu toplamlar "Anlaşmalar ve başlangıç kayıtları" diye etiketlenir, başlangıç alt toplamı ayrıca gösterilir |
| Hesap yeri | Veritabanı yalnız türe göre toplanmış tutarları getirir; net tahsilat/ödeme ve fark `cashTotalsFromSums`, kalan/fazla/ödeme durumu `computeAgreementBalance`, vade grupları `dueStateOf` ile `packages/shared` içinde hesaplanır. Raporlarda bütün okumalar tek tutarlı okuma anından (MongoDB snapshot okuması) yapılır; hareket toplamları aynı satırlardan `cashTotalsOfRows`, borç/alacak özetleri `summarizeAgreements` ile hesaplanır. Ekran, API cevabı ve dosya aynı rapor verisinden üretilir; dosya ayrıca hesap yapmaz. Dosyalar için kuruşun ondalık metni `kurusToDecimalString` ile üretilir |

### 9.2 Anlaşma ve başlangıç kaydı

| Kural | Davranış |
| --- | --- |
| Anlaşma oluşturma | Gelir/gider yazmaz. Yalnız yükümlülük kaydıdır |
| Net ödenen/tahsil edilen | Bağlı paylar − bu paylara yapılan aktif iadeler |
| Kalan | `max(currentAmount − net, 0)` |
| Fazla | `max(net − currentAmount, 0)`; kalan ile ayrı gösterilir |
| Örnek | 120.000 TL anlaşma, 45.000 TL ödeme → gider 45.000, kalan 75.000. Anlaşma bedeli gider toplamına eklenmez |
| Bedel artışı | 20.000 TL ek iş → bedel 140.000, gider değişmez, kalan 95.000 |
| Bedel düşüşü | 45.000 ödenmişken bedel 40.000 → gider 45.000, kalan 0, fazla 5.000. Para geri gelmiş sayılmaz |
| İptal | Geçmiş hareketler silinmez. 120.000 → kesin bedel 30.000, ödenen 45.000 → kalan 0, fazla 15.000. 15.000 geri alınırsa ayrı ödeme iadesi; net 30.000 |
| İş durumu | Ödeme durumundan ayrıdır. İşi tamamlamak borcu sıfırlamaz |
| Başlangıç kaydı | Yeni gelir/gider sayılmaz. 75.000 başlangıç borcu, 25.000 ödeme → yeni gider 25.000, kalan 50.000 |
| Doğrudan hareket | Anlaşmaya bağlanmadıkça hiçbir anlaşmanın kalanını azaltmaz |
| Ayrı şantiyeler | Bir şantiyeye bağlanan ödeme diğer şantiyenin bakiyesini değiştirmez; fazla ödeme başka borcu kendiliğinden kapatmaz |
| Paylaştırma | 40.000 TL ödeme: A'ya 25.000, B'ye 15.000. A 75.000 → 50.000, B 60.000 → 45.000. Firma giderinde 40.000 bir kez |
| Tamamlanan veya arşivlenen şantiye | Anlaşmaya bağlı ödeme, tahsilat, iade ve düzeltme serbest. Anlaşmasız yeni gider gerekçe (`reason`) ister; anlaşmasız gelir serbest. Yeni anlaşma için şantiye gerekçeyle yeniden aktifleştirilir |
| İptal edilen anlaşma | Ödeme/tahsilat bağlanabilir. Hesabı kesinleşmemişse bedel değişikliği kesin bedeli kaydeder; kesin bedel girilmişse bedel değiştirilemez; iş durumu değiştirilemez |

### 9.3 Vade

| Kural | Davranış |
| --- | --- |
| Vade | İsteğe bağlı, tek tarih |
| Gecikmiş | `dueDate < bugün (İstanbul)` ve `remaining > 0` |
| Vadesiz | Gecikmiş sayılmaz, "Vadesi belirlenmemiş" grubunda görünür |
| Kısmi ödeme | Gecikmiş tutarı azaltır, vadeyi ertelemez |
| Gecikme | Bedeli veya geliri artırmaz; faiz/ceza yok |
| Vade değişikliği | Gerekçe, eski/yeni tarih, kullanıcı ve zaman tutulur |
| Vade grupları | Açık tutarı olan kayıt tek gruba girer: gecikmiş (vade < bugün), yaklaşan (bugün ≤ vade ≤ bugün + pencere; varsayılan 30 gün, pano için 14 gün), daha sonra (`later`, pencerenin ötesi), vadesi belirlenmemiş. Açık tutarı olmayan kayıt hiçbir gruba girmez |

### 9.4 Fazla ödeme ve iade

| Kural | Davranış |
| --- | --- |
| Fazla ödeme/tahsilat | Engellenmez ama onaysız kayıt yok. İstek kalanı aşıyorsa ve `confirmExcess` + `excessReason` yoksa 409 `EXCESS_CONFIRMATION_REQUIRED` ve aşan tutar döner. Onaylanırsa kaydedilir, mesaj "Fazla ödeme kaydedildi" |
| İade sınırı | Bir paya bağlı aktif iadelerin toplamı pay tutarını aşamaz. 45.000 ödemenin 5.000'i iade edilmişse en fazla 40.000 daha |
| Ana tutar | Bağlı iade toplamının altına indirilemez |
| İade düzeltme/silme/geri yükleme | Kaynak payın `refundedAmount` değeri ve bağlı anlaşma önbelleği aynı transaction'da güncellenir |
| İadesi olan pay | Düzeltmede kaldırılamaz, şantiyesi veya anlaşması değiştirilemez, tutarı bağlı iade toplamının altına indirilemez. Bağlı iadesi olan hareketin kişisi değiştirilemez. Hedef değişecekse önce iade silinir |
| Geri yüklemede fazla | Silinmiş ödeme/tahsilat geri yüklenirken anlaşmanın kalanı aşılıyorsa yeni kayıttaki gibi `confirmExcess` ve `excessReason` istenir |
| Düzeltme ile iade farkı | Yanlış girilen tutar düzenleme ile düzeltilir (geçmişte eski/yeni kalır). Gerçekte geri gelen para iade olarak ayrı kaydedilir |

### 9.5 Silme, geri yükleme ve geçmiş

| Kural | Davranış |
| --- | --- |
| Gerekçe | Finansal alan değişikliği, silme, geri yükleme, bedel ve vade değişikliği, iptal, şantiye yeniden aktifleştirme gerekçe ister. Yalnız açıklama düzeltmesi istemez |
| İşlem silme | Yumuşak; toplam ve kalanlar yeniden hesaplanır. Aktif iadesi varsa silinemez |
| Paylaştırılmış silme | Bütün paylar birlikte kalkar |
| Anlaşma silme | Yalnız aktif bağlı hareket yoksa |
| Şantiye silme | Yalnız aktif hareket ve anlaşma yoksa; aksi halde arşivle |
| Kişi silme | Yalnız hiç kaydı yoksa (silinmiş ama geri yüklenebilir kayıtlar dahil); aksi halde pasifleştir |
| Geri yükleme | İlişkiler ve iade sınırları yeniden doğrulanır; geçersizse açıklamalı 409. Etki bir kez uygulanır |
| Kayıt geçmişi | Oluşturan kişi/zaman değişmez; her değişiklik `history`'ye yazılır |
| Hareket kopyala | Kayıt açmaz; aynı alanlar ve bugünün tarihiyle form taslağı döner, anlaşma bağlantısı "onay gerekli" işaretlidir. Geçmiş ve belgeler kopyalanmaz. Kaydedilince normal oluşturma akışı çalışır |
| Mükerrer uyarısı | Aynı gün, aynı tutar, aynı kişi ve kapsamda kayıt varsa kayıt engellenmez; oluşturma cevabı uyarıyı ve benzer kayıtların numaralarını döner. Ayrı kontrol ucu yoktur |

### 9.6 Belgeler ve kapasite

| Kural | Davranış |
| --- | --- |
| Yükleme niyeti | `POST /documents/upload-intent`: 20 MB, kayıt başına 10 belge (`documentCount` koşullu `$inc`) ve firma kapasitesi (`storageUsedBytes` koşullu `$inc`) atomik kontrol edilir. Kapasite bildirilen orijinal boyutla ayrılır. Geçici anahtara 15 dk geçerli imzalı yükleme adresi döner. `Idempotency-Key` isteğe bağlıdır; aynı anahtarla tekrar aynı bekleyen belgeyi ve yeni imzalı adresi döner, ikinci rezervasyon yapılmaz (bölüm 3) |
| Tamamlama | `POST /documents/:id/complete`: durum koşullu `pending → uploaded` geçmeden önce sunucu gerçek boyutu ve dosya imzasını kendisi doğrular, dosyayı değiştirilemeyen nihai anahtara kopyalar, geçici kopyayı siler, kapasiteyi gerçek boyuta göre düzeltir. Önizleme üretir |
| Doğrulama sonucu | Desteklenmeyen içerik veya 20 MB'tan büyük gerçek boyut belgeyi `failed` yapar; rezervasyon ve sayaç iade edilir, geçici dosya silinir. Gerçek boyut bildirilenden büyükse fark da kotaya sığmalıdır (değilse 409 `STORAGE_FULL`); küçükse fark iade edilir |
| Önizleme | Görseller için üretilir; PDF için üretilmez. Önizleme kalan kapasiteye sığmazsa saklanmaz ve belge önizlemesiz yüklenir; firma kotası hiçbir durumda aşılmaz. Çözülemeyen görsel (ör. bozuk HEIC) de önizlemesiz yüklenir |
| Temizlik | 1 saati geçen ve hâlâ `pending` olan yüklemeler `expired` olur; rezervasyon ve sayaç iade edilir. İş 10 dakikada bir çalışır ve sorgularını firma bazında yapar |
| Tamamlama–temizlik çakışması | Tamamlama belgeyi 5 dakikalık bir kilitle sahiplenir; temizlik kilitli belgeye dokunmaz. Kilit dolup temizlik kazanırsa tamamlama kendi kopyasını siler ve 409 döner. Rezervasyon ve sayaç yalnız bir kez iade edilir |
| Geçici klasör | Üretim deposunda `companies/*/uploads/` için bir günlük yaşam döngüsü (otomatik silme) kuralı tanımlanır; reddedilen yüklemenin adresine sonradan konan yetim dosyaları temizler |
| Kapasite dolu | Yeni belge yükleme 409 `STORAGE_FULL`; finansal kayıt ve mevcut belgelere erişim devam eder |
| Kapasite hesabı | Orijinaller, önizlemeler, geri alınabilir silinmiş belgeler, yüklenmekte olan dosyaların rezervasyonları ve hazır dışa aktarma paketleri sayılır |
| Belge silme ve geri yükleme | Yumuşak; gerekçe ve `expectedUpdatedAt` ister. Silinen belge kayıt başına 10 sınırında sayılmaz (`documentCount` bir azalır), kapasitede sayılmaya devam eder; silme alanı boşaltmaz. Geri yüklemede kayıtta 10 belge varsa 422 `LIMIT_EXCEEDED`: "Bu kayıtta 10 belge var; geri yüklemek için önce birini silin." |
| Silinmiş kayıt | Silinmiş işlem veya anlaşmanın belgeleri indirilebilir ve önizlenebilir. Bu kayda yeni belge yükleme, belge silme ve geri yükleme 409 `CONFLICT`: "Kayıt silinmiş. Belge işlemi için önce kaydı geri yükleyin." |
| Erişim | Bağlı kaydın firmasıyla sınırlı; indirme ve önizleme için 5 dk geçerli imzalı adres. Bucket herkese kapalı |
| Orijinal | Asla değiştirilmez; önizleme ayrıca üretilir. Önizleme yoksa önizleme isteği orijinali tarayıcıda açılacak (inline) adresle döner; ekran bunu "Orijinali aç" ve "Orijinali indir" ile sunar (bölüm 4.4) |

### 9.7 Güvenli tekrar ve bağlantı

| Kural | Davranış |
| --- | --- |
| Anahtar | Web, kullanıcı "Kaydet"e bastığında `Idempotency-Key` (UUID) üretir. Aynı gönderimin tekrarlarında aynı anahtar kullanılır |
| Yanıt yok | Ekran "Kaydın durumu doğrulanıyor" gösterir, kesin başarısızlık gibi sunmaz; `GET /idempotency/:key` ile sonucu sorar veya aynı anahtarla tekrar gönderir |
| Kesin ret | Doğrulama hatasında kayıt oluşmaz; kullanıcı formu düzeltip kaydedince yeni anahtar üretilir |
| Düğme | Gönderim sürerken kilitli; çift tıklama iki kayıt açmaz |
| Form | Bağlantı kesilince açık formdaki bilgiler korunur; taslak toplamlara girmez. Tarayıcı kapanınca kalıcı taslak yok |
| Belge | Finansal kayıt başarılıysa belge hatası kaydı tekrar oluşturmaz; yalnız belge yeniden denenir. Yükleme niyetinin tekrarında aynı `Idempotency-Key` kullanılır, böylece kaldığı yerden devam eder; kesin retten veya süresi dolmuş yüklemeden sonra yeni anahtar üretilir. Tamamlama bağlantı hatası alırsa yalnız tamamlama tekrarlanır. İstemcide reddedilen dosya (20 MB üstü, boş, desteklenmeyen tür) gönderilmez ve yeniden denenmez. Tarayıcı türü vermezse (bazı HEIC dosyaları) tür uzantıdan belirlenir; asıl tür sunucuda doğrulanır |

### 9.8 Kimlik

| Kural | Davranış |
| --- | --- |
| Şifre | En az 8. Değişince, sıfırlanınca veya kullanıcı pasifleşince bütün oturumlar **hemen** düşer: refresh token'lar silinir, `tokensValidAfter` sayesinde eski access token'lar 15 dakikayı beklemeden reddedilir |
| Geçici şifre | 72 saat; ilk girişte değiştirme zorunlu. İlk şifre değişiminde yeni oturum verilir; normal şifre değişiminde verilmez |
| Giriş hatası | 401 "Kullanıcı adı veya şifre hatalı". Hesabın varlığını ifşa etme |
| Deneme sınırı | Aynı kullanıcı adında 15 dakikada 5 veya aynı IP'den 30 hatalı denemede 5 dakika bekleme. Sınır sunucu belleğinde tutulur; birden fazla sunucuya geçilirse paylaşılan bir depoya taşınmalıdır. Ters vekil sunucu arkasında gerçek IP için Express `trust proxy` barındırma seçilince ayarlanır |
| Kullanıcı adı biçimi | 3–50 karakter; harf (Türkçe dahil), rakam, nokta, alt çizgi, tire. `tr-TR` küçük harfe normalize |
| Yönetim gerekçesi | Kullanıcı pasifleştirme, aktifleştirme ve şifre sıfırlamada zorunlu; firma ve kullanıcı oluşturmada isteğe bağlı |
| Kullanıcı adı çakışması | Yönetimde 409 "Bu kullanıcı adı kullanılıyor" |
| Ürün sahibi ikinci adım | Şifre doğruysa yalnız 5 dakika geçerli bir ara token verilir; access/refresh ancak geçerli TOTP veya kurtarma koduyla verilir. TOTP ±1 zaman adımı toleranslı, aynı kod ikinci kez kabul edilmez |
| Ürün sahibi kilit | 5 hatalı ikinci adım denemesinde 15 dakika kilit; PlatformLog'a yazılır |

### 9.9 Arama

Firma filtresi zorunlu. Ad ve açıklama alanları Türkçe küçük harf ve karakter katlamalı kopya alanlarda aranır. Tutar araması kuruşa çevrilmiş eşitlik (`12.500`) veya aralık (`10.000-20.000`) olarak çalışır. Arama sonuçları silinmiş kayıtları dışlar.

### 9.10 Hizmet durumu ve erişim

Firmanın etkin durumu her istekte tarihlerden ve işaretlerden hesaplanır; zamanlanmış bir işe bağlı değildir.

| Etkin durum | Giriş | Okuma, rapor, dışa aktarma | Kayıt değiştirme, belge yükleme, silme ve geri yükleme | Kendi şifresi ve profili |
| --- | --- | --- | --- | --- |
| Aktif | Açık | Açık | Açık | Açık |
| Görüntüleme dönemi (D … `viewUntil`) | Açık | Açık | Kapalı (`READ_ONLY`) | Açık |
| Geçici durdurulmuş | Erişim mesajı | Kapalı | Kapalı | Kapalı |
| Arşiv saklama (`viewUntil`+1 … `retainUntil`) | Erişim mesajı | Kapalı | Kapalı | Kapalı |
| Silme onayı bekliyor / siliniyor | Erişim mesajı | Kapalı | Kapalı | Kapalı |
| Kullanıcı pasif | Erişim mesajı | Kapalı | Kapalı | Kapalı |

- **Gün sınırları:** D yürürlük günüdür. Görüntüleme dönemi D ile `viewUntil` (D+30) arasıdır ve iki gün de dahildir. `viewUntil`+1 ile `retainUntil` (D+180) arası arşiv saklamadır. `retainUntil`'den sonra durum "silme onayı bekliyor" olur. Ekranlarda ve yasal metinlerde gün sayısı yerine bu kesin tarihler gösterilir.
- Görüntüleme döneminde sayfa üstünde bant: "Hizmetiniz sona erdi. Kayıtlarınızı {tarih} tarihine kadar görüntüleyip dışa aktarabilirsiniz." (Tarih eki yanlış çekimlenmesin diye bu kalıp kullanılır.) Değişiklik düğmeleri kapalı ve nedeni yazılı.
- Erişim kapalıyken boş firma gösterme; açıklayıcı erişim mesajı göster. Veri silinmiş gibi sunma.
- `retainUntil` sonrasında veri kendiliğinden silinmez; ürün sahibinin onayını bekler. Hizmet bu süre içinde yeniden açılırsa firma geçmişiyle devam eder.
- Kullanıcı pasifleştirme, geçici durdurma veya tek kayıt silme hizmet sonu sürecini başlatmaz.

---

## 10. API sözleşmesi

Taban yol `/`. Tümü JSON, dosya indirme hariç. Oturumlu rotalar Bearer ister. Firma rotalarında `companyId` token'daki kullanıcıdan gelir.

### 10.1 Auth

| Metot | Yol | Gövde | Sonuç |
| --- | --- | --- | --- |
| POST | `/auth/login` | `username, password` | tokenlar, user, `mustChangePassword` |
| POST | `/auth/refresh` | `refreshToken` | yeni çift, eskisini geçersiz kıl |
| POST | `/auth/logout` | `refreshToken` opsiyonel | o token veya hepsi silinir |
| GET | `/auth/me` | — | user, firma görünen adı, etkin hizmet durumu |
| PATCH | `/auth/me` | `name, phone, email` | güncel profil |
| PATCH | `/auth/password` | `currentPassword, newPassword` | bütün oturumlar düşer; yalnız ilk şifre değişiminde yeni tokenlar döner |

`user`: `{ id, name, username, companyId, mustChangePassword }`.

### 10.2 Demo

| Metot | Yol | Not |
| --- | --- | --- |
| POST | `/demo/start` | Yeni demo firması + örnek veri + demo token'ı |
| POST | `/demo/reset` | Bu ziyaretçinin demo firmasını başlangıç örneklerine döndürür |

### 10.3 Firma ve kategoriler

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/company` | görünen ad, iletişim, depolama kullanımı, hizmet durumu. `storage.breakdown` orijinal, önizleme, geri alınabilir silinmiş, yüklenmekte olan ve dışa aktarma baytlarını ayrı döner; toplamı `storageUsedBytes` ile aynıdır |
| PATCH | `/company` | `displayName, contact`, `expectedUpdatedAt` |
| GET | `/company/users` | aynı firmanın kullanıcıları: kimlik, görünen ad, aktiflik (pasifler dahil; kullanıcı adı ve iletişim dönmez). "Kaydı oluşturan" filtresi için |
| GET | `/categories` | `includeInactive` |
| POST | `/categories` | oluştur |
| PATCH | `/categories/:id` | ad, `isActive` |

### 10.4 Projeler

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/projects` | `status, q, sort, pinnedFirst, includeDeleted, page, limit`. Her şantiye özetinde `netIncome`, `netExpense`, fark, kalan borç/alacak ve `overdueReceivable` döner |
| POST | `/projects` | oluştur |
| GET | `/projects/:id` | detay |
| GET | `/projects/:id/summary` | finans özeti |
| PATCH | `/projects/:id` | güncelle |
| POST | `/projects/:id/complete` | `completedAt`; cevapta açık borç/alacak |
| POST | `/projects/:id/reactivate` | `reason` |
| POST | `/projects/:id/archive` | `{ archived }` |
| POST | `/projects/:id/pin` | `{ pinned }` |
| DELETE | `/projects/:id` | `reason`; bağlı kayıt varsa 409 `HAS_DEPENDENCIES` |
| POST | `/projects/:id/restore` | `reason` |

`sort`: `newest`, `oldest`, `name_asc`, `name_desc`, `last_used`.

### 10.5 Kişiler

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/parties` | `q, tag, kind, active, sort, pinnedFirst, includeDeleted, page, limit` |
| GET | `/parties/suggest?q=` | en fazla 8, pasifler hariç, benzer adlar |
| POST | `/parties` | oluştur |
| GET | `/parties/:id` | detay + finans (borç ve alacak ayrı) |
| GET | `/parties/:id/statement` | hesap dökümü verisi |
| PATCH | `/parties/:id` | güncelle, `isActive` |
| POST | `/parties/:id/pin` | `{ pinned }` |
| DELETE | `/parties/:id` | `reason`; kaydı varsa 409 `HAS_DEPENDENCIES` |
| POST | `/parties/:id/restore` | `reason` |

### 10.6 İşlemler

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/transactions` | filtreler bölüm 7.4; cevapta `totals` |
| GET | `/transactions/suggestions?kind=` | son açıklama önerileri |
| POST | `/transactions` | `kind, amount, date, partyId?, categoryId?, description, allocations[], confirmExcess?, excessReason?, reason?`. `reason`, tamamlanan/arşivlenen şantiyeye anlaşmasız giderde zorunlu. Cevap mükerrer uyarısı ve benzer kayıt numaralarını içerebilir |
| GET | `/transactions/:id` | detay, paylar, iadeler, belgeler, geçmiş. `documents` yüklenmiş ve yüklenmekte olan belgeleri içerir; silinmiş ama geri alınabilir belgeler `deletedAt` dolu gelir; `failed` ve `expired` listelenmez |
| PATCH | `/transactions/:id` | düzeltme; finansal alan değişirse `reason` zorunlu |
| POST | `/transactions/:id/refunds` | `amount, date, reason, parts[]` |
| DELETE | `/transactions/:id` | `reason`; aktif iade varsa 409 `HAS_DEPENDENCIES` |
| POST | `/transactions/:id/restore` | `reason` |
| POST | `/transactions/:id/duplicate` | kayıt açmaz; form taslağı döner (anlaşma bağlantısı "onay gerekli") |
| GET | `/idempotency/:key` | `{ status: 'done' \| 'not_found', resultRef? }` |

### 10.7 Anlaşmalar

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/agreements` | `kind, direction, projectId, scope, partyId, workStatus, paymentStatus, dueState, remainingOnly` |
| POST | `/agreements` | anlaşma veya başlangıç kaydı oluştur; hareket yazmaz |
| GET | `/agreements/:id` | detay, bağlı hareketler, iadeler, kalan, fazla, belgeler (`/transactions/:id` ile aynı kural), geçmiş |
| PATCH | `/agreements/:id` | ad, açıklama, anlaşma tarihi |
| POST | `/agreements/:id/amount` | `newAmount, reason`; önizleme için `?preview=1` |
| POST | `/agreements/:id/due-date` | `dueDate, reason` |
| POST | `/agreements/:id/work-status` | `ongoing` veya `completed` |
| POST | `/agreements/:id/cancel` | `finalAmount?, reason`; `finalAmount` yoksa `settlementPending` |
| DELETE | `/agreements/:id` | `reason`; bağlı hareket varsa 409 `HAS_DEPENDENCIES` |
| POST | `/agreements/:id/restore` | `reason` |

Anlaşmaya ödeme/tahsilat ayrı uç değil; `POST /transactions` ile `allocations[].agreementId` dolu gönderilir.

### 10.8 Belgeler

| Metot | Yol | Not |
| --- | --- | --- |
| POST | `/documents/upload-intent` | `ownerType, ownerId, fileName, mimeType, sizeBytes`; `Idempotency-Key` isteğe bağlı. Cevap `{ document, upload: { method, url, headers, expiresAt } }`; istemci dosyayı dönen başlıklarla (`Content-Type` imzaya dahil) doğrudan depoya yükler |
| POST | `/documents/:id/complete` | doğrulama ve nihai kayıt |
| GET | `/documents/:id/download` | 5 dk imzalı adres (`attachment`), `isPreview`, dosya adı ve türü |
| GET | `/documents/:id/preview` | 5 dk imzalı önizleme adresi; önizleme yoksa orijinal tarayıcıda açılacak biçimde (`isPreview: false`) |
| DELETE | `/documents/:id` | `reason, expectedUpdatedAt`; yumuşak |
| POST | `/documents/:id/restore` | `reason, expectedUpdatedAt` |

### 10.9 Arama, pano, vade, rapor, dışa aktarma, silinenler

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/dashboard` | bölüm 7.1 verisi + `monthly` + `generatedAt`. `totals` ve `monthly` düşülen ödeme iadesini `expenseRefund` olarak; `recentProjects` kayıtları şantiye özetini (`/projects` ile aynı alanlar) içerir |
| GET | `/dues` | `direction, group (overdue \| upcoming \| later \| none), from, to` |
| GET | `/search` | `q, saveHistory, projectId, type, dateFrom, dateTo` |
| GET | `/search/history` | son aramalar |
| DELETE | `/search/history` | temizle |
| GET | `/reports/period` | dönem dökümü verisi |
| GET | `/reports/projects/:id/summary` | şantiye raporu verisi |
| GET | `/reports/parties/:id/statement` | hesap dökümü verisi |
| GET | `/reports/open-balances` | açık borç/alacak ve vade |
| GET | `/reports/:type/export.{xlsx,csv,pdf}` | aynı filtrelerle dosya. `type`: `period`, `project`, `party`, `open-balances`, `transactions`; şantiye ve kişi raporunda kayıt `?id=` ile. `transactions` "Bu sonuçları indir"dir ve `GET /transactions` filtrelerini sayfasız alır. Bilinmeyen tür veya biçim 400 `VALIDATION`, başka firmanın kaydı 404. Dosya adı `Content-Disposition` başlığında |
| POST | `/exports/full` | tam firma veri çıkışı başlat |
| GET | `/exports/:id` | durum, ilerleme, hazırsa indirme adresi |
| GET | `/deleted` | `type` ile silinen kayıtlar |
| GET | `/health` | `{ success, status: "ok" }` |

### 10.10 Yönetim

Ayrı token türü. Müşteri finansal kayıtlarına uç yok.

| Metot | Yol | Not |
| --- | --- | --- |
| POST | `/platform/auth/login` | `username, password`; ara token ve `totpSetupRequired` döner |
| POST | `/platform/auth/totp/setup` | ara token ile; QR için `otpauth` adresi döner (kurulum gerekliyse) |
| POST | `/platform/auth/totp/verify` | `code`; kurulumu onaylar veya girişi tamamlar; ilk kurulumda kurtarma kodlarını bir kez döner |
| POST | `/platform/auth/recovery` | `recoveryCode`; ara token ile girişi tamamlar |
| POST | `/platform/auth/recovery-codes/regenerate` | oturumlu + geçerli TOTP kodu; yeni 10 kod, eskiler geçersiz |
| POST | `/platform/auth/refresh` `/platform/auth/logout` | |
| GET | `/platform/companies` | `q, status`, kullanım ve tarihler |
| POST | `/platform/companies` | firma oluştur |
| GET | `/platform/companies/:id` | detay, kullanıcılar, depolama, hizmet, işletim geçmişi |
| PATCH | `/platform/companies/:id` | ad, iletişim, işletim notu |
| POST | `/platform/companies/:id/users` | kullanıcı + bir kez gösterilen geçici şifre. Aynı `Idempotency-Key` ile tekrar: kullanıcı şifresiz ve açıklama mesajıyla döner |
| PATCH | `/platform/users/:id` | ad, kullanıcı adı, `isActive` |
| POST | `/platform/users/:id/reset-password` | yeni geçici şifre |
| POST | `/platform/companies/:id/quota` | `quotaBytes, reason` |
| POST | `/platform/companies/:id/suspend` | `{ suspended, reason }` |
| POST | `/platform/companies/:id/end-service` | `effectiveDate, reason`; önizleme için `?preview=1` |
| POST | `/platform/companies/:id/reopen` | `reason` |
| POST | `/platform/companies/:id/extend-retention` | `retainUntil, reason` |
| POST | `/platform/companies/:id/delete` | `confirmName, reason`; yalnız saklama süresi dolmuşsa |

Hata kodları: `VALIDATION` 400, `UNAUTHORIZED` 401, `PASSWORD_CHANGE_REQUIRED` 403, `READ_ONLY` 403, `ACCESS_CLOSED` 403, `NOT_FOUND` 404, `CONFLICT` 409, `EXCESS_CONFIRMATION_REQUIRED` 409, `HAS_DEPENDENCIES` 409, `STORAGE_FULL` 409, `USERNAME_EXISTS` 409, `LIMIT_EXCEEDED` 422 (dosya boyutu, belge sayısı, iade sınırı), `IDEMPOTENCY_MISMATCH` 422, `IDEMPOTENCY_EXPIRED` 422, `RATE_LIMITED` 429, `INTERNAL` 500.

---

## 11. Web davranışı

- İlk açılışta token varsa `/auth/me` dene. Başarılıysa uygulamaya al. Ağ hatasında kayıtlı kullanıcıyla içeri al, sonraki istek yenilensin; bağlantı durumu görünür olsun.
- Tanıtım ve uygulama aynı renk ve yazı tipi sistemini kullansın. Tanıtım gradyanlı ve daha geniş aralıklı; uygulama `surface` zeminli, beyaz panelli ve derli toplu (bölüm 4).
- Tabloda masaüstünde satır, 760 px altında kart. Sütunlar ekranın tarifindeki gibidir (ör. bölüm 7.4).
- Aynı adreste yalnız sorgu değişse de (ör. `?tur=gelir` → `?tur=gider`) form her yeni gezintide sıfırdan kurulur; kaydedilmemiş bilgi varsa önce uyarı sorulur.
- Form kaydı çift tıklamada iki kayıt açmasın. Düğme gönderim sürerken kilitli; `Idempotency-Key` bölüm 9.7'ye göre. API'de anahtarın isteğe bağlı olduğu şantiye, kişi ve kategori oluşturma dahil, web bütün oluşturma isteklerinde anahtar gönderir.
- Kaydedilmemiş formdan çıkışta sor: "Kaydedilmemiş değişiklikler. Çıkmak istediğinize emin misiniz?" Bu uyarı sonucu belirsiz bir gönderimi iptal ettiğini iddia etmesin.
- Boş liste, hata ve yükleniyor durumları her listede olsun. Sonsuz iskelet koyma. Yükleme veya erişim hatasını `0 TL` gibi gösterme. Filtre sonucu boşsa "Filtrelere uyan kayıt bulunamadı" + filtreleri temizle.
- Yenileme sırasında eski veri gösteriliyorsa "Güncelleniyor" bilgisi. Kısmi hata varsa başarısız bölümün toplamı kesin gibi gösterilmesin.
- 409 `CONFLICT` geldiğinde güncel kayıt ile kullanıcının değişikliği yan yana gösterilsin, farklı alanlar "Farklı" rozeti taşısın; kullanıcı güncel kaydı yükler veya kendi değişikliğiyle devam eder. Düzenleme formları arka planda yenilenen veriyle sessizce sıfırlanmaz. Onay gerektiren eylemler eski önizlemeyle tamamlanmasın.
- Hata ilgili alanın yanında açık dille gösterilsin; telefonda ilk hatalı alana kaydırılsın.
- Para inputu sayısal klavye ve `inputMode="decimal"`. Kullanıcı `12500`, `12.500` veya `12.500,50` yazabilir; kuruşa çevrilir. `12.5` gibi girdide alanın altında "Ondalık için virgül kullanın" görünür (bölüm 3 "Para"). Gösterim `tr-TR`. Telefon dili İngilizce olan cihazlarda sayısal klavyede virgül çıkmayabilir; bu durum İngilizce dilli bir telefonda denenmeli. Ondalık girilemiyorsa giriş kuralını değiştirmeden önce kullanıcıya sorulmalı.
- Tarih inputu `type="date"` veya özel takvim. Etiket Türkçe. Seçilen takvim günü korunur.
- Belge seçimi telefonda ayrı "Fotoğraf çek" (`capture="environment"`) ve "Galeriden seç" düğmeleriyle, masaüstünde tek "Dosya ekle" düğmesiyle; hepsi `accept="image/*,application/pdf"` (bölüm 4.4).
- Rapor dosyası indirilirken dosya adı sunucunun `Content-Disposition` başlığından alınır (CORS ayarında bu başlık açıktır). Dosya ucunun hata cevabı okunup mesaj olarak gösterilir.
- Demo ve görüntüleme döneminde bant her sayfada; kapalı eylemlerde neden yazılı.
- Erişilebilirlik: her inputun etiketi var, ikon düğmenin `aria-label`ı var, renk tek başına anlam taşımasın (gelir/gider, gecikmiş, iade yazısı da görünsün), kontrast lacivert üzerinde beyaz metinle kalsın.
- SEO yalnız tanıtım sayfalarında: başlık, açıklama, Open Graph. Uygulama, demo ve yönetim rotaları `noindex`.
- Performans: rota bazlı kod bölme. Liste sorguları önbelleklenir, mutasyon ilgili sorguyu (liste, detay, özet, pano) geçersiz kılar.

---

## 12. Ekran metinleri

Arayüz dili Türkçe. Kısa ve doğrudan yaz. Örnekler:

| Yer | Metin |
| --- | --- |
| Giriş düğmesi | Giriş Yap |
| Demo düğmesi | Demoyu Dene |
| Şantiye oluştur | Projeyi Oluştur |
| Gider kaydet | Gideri Kaydet |
| Gelir kaydet | Geliri Kaydet |
| Anlaşma | Anlaşmayı Oluştur |
| Başlangıç kaydı | Başlangıç Kaydını Oluştur |
| Ödeme | Öde |
| Tahsilat | Tahsil Et |
| İade | İadeyi Kaydet |
| Vazgeç | Vazgeç |
| Zorunlu eksik | Eksik bilgi |
| Ağ | Bağlantı hatası. İnternetinizi kontrol edin. |
| Belirsiz kayıt | Kaydın durumu doğrulanıyor. Lütfen yeni kayıt açmayın. |
| Belge hatası | İşlem kaydedildi; 1 belge yüklenemedi. |
| Fazla ödeme | Bu ödeme anlaşmanın kalanını {tutar} aşıyor. |
| Anlaşmasız kayıt | Bu kayıt anlaşmaya bağlı değil; anlaşmanın kalanı değişmez. |
| Kapasite | Belge alanı doldu. Kayıt girmeye devam edebilirsiniz; yeni belge için ürün sahibiyle görüşün. |
| Belge sayısı dolu | Bu kayda en fazla 10 belge eklenebilir. |
| Belge geri yükleme sınırı | Bu kayıtta 10 belge var; geri yüklemek için önce birini silin. |
| Silinmiş kayıtta belge | Kayıt silinmiş. Belge işlemi için önce kaydı geri yükleyin. |
| Görüntüleme dönemi | Hizmetiniz sona erdi. Kayıtları görüntüleyip dışa aktarabilirsiniz. |
| Demo bandı | Örnek veriler — değişiklikler geçicidir. |
| Boş şantiye | Aktif proje bulunamadı |
| Boş işlem | Filtrelere uyan kayıt bulunamadı |
| Erişim yok | Bu kayda erişilemiyor. |

Ton: şantiye ofisine konuşur gibi, sade, abartısız. Pazarlama cümlesi bile vaat şişirmesin.

---

## 13. Kabul

Bitti sayılması için:

1. Tanıtım ana sayfası, özellikler, nasıl çalışır, kullanım, SSS, gizlilik, koşullar açılır ve mobilde bozulmaz. Herkese açık kayıt yoktur.
2. Demo hesapsız açılır; bir ziyaretçinin değişikliği diğerini veya gerçek firmayı etkilemez; sıfırlanabilir; gerçek dosya yerine örnek belge kullanılır.
3. Ürün sahibi firma ve kullanıcı oluşturur; geçici şifreyle giren kullanıcı şifresini değiştirmeden ilerleyemez. Giriş, çıkış, şifre değişimi ve ürün sahibi sıfırlaması çalışır; şifre değişimi bütün oturumları bitirir.
4. Aynı firmanın iki kullanıcısı aynı verilere ve işlem yetkisine sahiptir; kaydı oluşturan/değiştiren ayrı tutulur. Başka firmanın kaydı, belgesi, arama sonucu ve raporu hiçbir uçtan açılmaz.
5. 120.000 TL ödenecek anlaşmaya 45.000 TL ödeme gideri yalnız 45.000 TL artırır, kalan 75.000 TL görünür. Tahsil edilecek anlaşmada aynı ilke ters yönde çalışır. Anlaşma oluşturmak hareket yazmaz.
6. Bedel artışı, bedel düşüşü (fazla ödeme), iptal, iade, paylaştırma, düzeltme, silme ve geri yükleme bölüm 9'daki örnek tutarları birebir üretir; aynı gerçek hareket iki kez sayılmaz; gerekçe ve geçmiş kaybolmaz.
7. Başlangıç borç/alacağı gider/gelir artırmaz; sonraki ödeme/tahsilat artırır.
8. Vadesi geçmiş, yaklaşan ve vadesiz açık tutarlar doğru gruplanır; kısmi ödeme vadeyi ertelemez.
9. Bağlantı hatası veya tekrar gönderim çift kayıt üretmez; sonucu belirsiz kayıt doğrulanır; belge hatası finansal kaydı tekrar oluşturmaz.
10. Belge 20 MB, kayıt başına 10 ve firma kapasitesi sınırları uygulanır; kapasite dolunca finansal kayıt ve mevcut belgelere erişim sürer; orijinaller değişmez.
11. Tamamlanan/arşivlenen şantiyelerin açık borç/alacakları firma özetinden ve vade listelerinden kaybolmaz.
12. Hizmet sonu ilk 30 gün yalnız görüntüleme/dışa aktarma, sonra kapalı erişim uygulanır; ürün sahibi onayı olmadan kalıcı silme yapılmaz.
13. Pano ve liste toplamları API özetiyle ve dışa aktarılan dosyayla aynıdır; filtreli toplam bütün sonuçları kapsar.
14. Dört standart rapor Excel, CSV ve PDF indirir; tam firma veri çıkışı ilişkili tablolar ve belge paketiyle hazırlanır.
15. Arama dört türde sonuç verir, Türkçe harf farkından etkilenmez ve geçmişi temizler.
16. Ürün sahibi TOTP kurulmadan yönetim alanına giremez; kurtarma kodu tek kullanımlıktır; sıfırlama komutu yalnız sunucuda çalışır ve kayıt bırakır.
17. Renkler bu belgedeki hex değerlerdir. Gelir yeşil, gider kırmızıdır.
18. API hata gövdesi `{ success: false, message, code }` şeklindedir ve form bunu Türkçe gösterir.

Test:

- Servis iş kuralları için birim testler: bölüm 9'daki bütün örnek tablolar (anlaşma/ödeme, ek iş, bedel düşüşü, iptal, iade sınırı, paylaştırma, başlangıç kaydı, dönem iadesi, vade ve gecikme).
- Entegrasyon testleri (bellek içi MongoDB replica set): transaction atomikliği, aynı `Idempotency-Key` ile eşzamanlı iki istek → tek kayıt, `expectedUpdatedAt` çakışması, silme/geri yükleme bakiye etkisi, belge sayacı ve kapasite yarışları, hizmet durumu erişim tablosu.
- Firma yalıtım testi: bütün uçlar başka firmanın kayıt kimlikleriyle çağrılır; hepsi 404 döner ve veri sızmaz.
- Web'de en az giriş, ilk şifre, gider oluşturma, anlaşmaya ödeme, paylaştırma, iade ve demo sıfırlama akışlarını uçtan uca doğrula.

Bu belgede yazılmayan modülü ekleme. Özellikle kapsam dışı: mobil uygulama ve mağaza dağıtımı, stok, puantaj, banka/kart entegrasyonu ve kasa mutabakatı, çek/senet, döviz, e-fatura ve resmi muhasebe, OCR ve yapay zekâ, sohbet, anlaşma öncesi avans takibi, kullanıcı rolleri ve şantiye bazlı izin, taksitli plan, e-posta/SMS hatırlatma, Excel içe aktarma, tam çevrimdışı kayıt, borç-alacak mahsuplaştırma, genel giderleri şantiyelere dağıtma, otomatik abonelik tahsilatı.
