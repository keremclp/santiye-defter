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
| Web | React 19, TypeScript, Vite | Tek sayfa uygulama |
| Yönlendirme | React Router | Tanıtım, uygulama ve yönetim aynı origin |
| Sunucu durumu | TanStack Query | Liste, detay, mutasyon, yeniden doğrulama |
| İstemci durumu | Zustand | Oturum ve arayüz tercihleri |
| Form | React Hook Form + Zod | API şemalarıyla aynı kurallar |
| Stil | CSS Modules veya tek tasarım token dosyası | Aşağıdaki renkler sabit |
| HTTP | Axios | `Authorization: Bearer` |
| API | Node.js, Express, TypeScript | ESM veya derlenmiş TS |
| Doğrulama | Zod | Gövde ve sorgu |
| Veritabanı | MongoDB (replica set) + Mongoose | Çok dokümanlı transaction zorunlu |
| Kimlik | JWT access + refresh | Access 15 dk, refresh 30 gün, her yenilemede döner |
| Şifre | bcrypt | Maliyet 12 |
| Belge depolama | S3 uyumlu özel bucket (ör. Cloudflare R2) | İmzalı ve süreli bağlantılar |
| Görsel önizleme | sharp (HEIC için heic-convert) | Orijinal dosya korunur |
| İki aşamalı doğrulama | otplib (TOTP, RFC 6238) | Yalnız ürün sahibi hesabı; doğrulama uygulamasıyla 6 haneli kod |
| PDF | PDFKit | Türkçe karakter için gömülü yazı tipi |
| Excel | exceljs | Rapor ve tam veri çıkışı |
| CSV | UTF-8, BOM'lu, Türkçe başlık, `;` ayraç | Excel'de Türkçe karakter bozulmadan açılır |
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
| `STORAGE_ENDPOINT` `STORAGE_BUCKET` `STORAGE_ACCESS_KEY` `STORAGE_SECRET_KEY` | Belge depolama |
| `APP_NAME` | Şantiye Hesap |
| `WEB_ORIGIN` | CORS |
| `VITE_API_URL` | Web'in API adresi |
| `SUPPORT_CONTACT_TEXT` | Şifremi unuttum ve kapasite ekranlarında görünen ürün sahibi iletişim metni |
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
- Her başarılı JSON: `{ success: true, data, message? }`.
- Her hata JSON: `{ success: false, message, code, details? }` ve doğru HTTP kodu.
- Liste cevapları sayfalı olsun: `{ items, page, limit, total }`. Filtreli listelerde `totals` alanı bütün filtrelenmiş sonuçların toplamını taşır, yalnız o sayfanın değil.
- **Firma ayrımı:** Kullanıcı ve ürün sahibi dışındaki her modelde `companyId` zorunludur. Firma kullanıcısının bütün sorgularına `companyId` servis katmanında zorla eklenir; istemciden gelen `companyId` kabul edilmez. Başka firmaya ait kayıt kimliği istenirse 404 dön (403 değil; kaydın varlığı sızmasın). Bütün bileşik indeksler `companyId` ile başlar.
- Silme fiziksel değil. `deletedAt` dolar. Varsayılan sorgular `deletedAt: null`.
- **Para:** Tutarlar kuruş cinsinden tamsayı saklanır ve API'de kuruş tamsayı olarak taşınır (`12.500,50 TL` → `1250050`). Kayan noktalı sayı kullanma. Ekranda `tr-TR` para formatı.
- **Tarih:** İşlem, vade, anlaşma, başlangıç ve takip tarihleri `YYYY-MM-DD` metni olarak saklanır; saat dilimi kayması olmaz. Sistem zamanları (`createdAt` vb.) ISO UTC. "Bugün" ve gecikme hesabı Europe/Istanbul gününe göre yapılır.
- **Atomik işlem:** Bir para hareketinin, payların, bağlı anlaşma bakiyelerinin, iade toplamlarının ve kayıt geçmişinin değiştiği her işlem tek MongoDB transaction'ı içinde tamamlanır. Yarım güncelleme olmaz.
- **Eşzamanlı güncelleme:** Güncelleme isteklerinde `expectedUpdatedAt` zorunlu. Kayıt bu arada değişmişse 409 `CONFLICT`, mesaj "Kayıt başka bir yerde güncellendi" ve güncel kayıt `details` içinde döner. Sessizce üzerine yazma.
- **Güvenli tekrar:** Para hareketi, anlaşma, iade, ödeme ve hesap oluşturan bütün `POST` isteklerinde `Idempotency-Key` başlığı zorunlu. Aynı anahtar ve aynı gövde gelirse ilk sonucu tekrar döndür, yeni kayıt açma. Aynı anahtar farklı gövdeyle gelirse 422 `IDEMPOTENCY_MISMATCH`. Anahtar kaydı işlemle aynı transaction'da yazılır; benzersiz indeks sayesinde aynı anda gelen iki istek çift kayıt üretemez. Anahtar kayıtları 30 gün tutulur, 24 saatten eski anahtar 422 `IDEMPOTENCY_EXPIRED` alır.
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

Bunu token olarak kodla. Yakın renk uydurma.

### 4.1 Renk

| Token | Hex / değer | Kullanım |
| --- | --- | --- |
| `surface` | `#F8F6F6` | Sayfa zemini |
| `surfaceTint` | `#EEECF8` | Input zemini |
| `elevated` / `white` | `#FFFFFF` | Kart, panel, footer |
| `primary` | `#4D12EE` | Ana düğme, vurgu, seçili sekme |
| `navy` | `#2F24C1` | Başlık, koyu kart, metin vurgusu |
| `navyDeep` | `#1E1878` | Tanıtım kahramanının koyu ucu |
| `cyan` | `#3FD1CB` | İkincil vurgu, ikon, gradyan ucu |
| `ink` | `#2F24C1` | Gövde başlığı |
| `muted` | `#7A76A8` | Yardımcı metin, placeholder |
| `border` | `#E4E1F0` | Çizgi, ayırıcı |
| `income` / `success` | `#166534` | Gelir tutarı, başarı |
| `expense` / `danger` | `#DC2626` | Gider tutarı, silme, zorunlu yıldız |
| `onNavy` | `#FFFFFF` | Lacivert üstündeki metin |
| `onNavyMuted` | `rgba(255,255,255,0.72)` | Lacivert üstündeki ikincil metin |
| `overlay` | `rgba(47,36,193,0.45)` | Genel örtü |
| `backdrop` | `rgba(15,23,42,0.72)` | Modal arkası |

Tint'ler, dolgu ve seçili chip için:

| Ad | Değer |
| --- | --- |
| primary %8 / %12 | `rgba(77,18,238,0.08)` / `0.12` |
| navy %12 | `rgba(47,36,193,0.12)` |
| cyan %12 / %18 | `rgba(63,209,203,0.12)` / `0.18` |
| income %12 | `rgba(22,101,52,0.12)` |
| expense %12 | `rgba(220,38,38,0.12)` |

Gradyan (tanıtım kahramanı, giriş paneli arkası): `primary` → `navy` → `cyan`, sol üstten sağ alta.

Gelir kartı zemini income %12, gider kartı zemini expense %12. Tutar rengini asla gri yapma. Gelir yeşil, gider kırmızı. İade satırları kendi yönünün rengini kullanır ama "Ödeme iadesi" / "Tahsilat iadesi" yazısı mutlaka görünür.

Durum renkleri yeni token gerektirmez: gecikmiş vade `expense` metin + expense %12 rozet ve "Gecikmiş" yazısı; yaklaşan vade `primary` %12 rozet; fazla ödeme/tahsilat `danger` kenarlı uyarı kutusu; demo ve yalnız görüntüleme bandı `cyan` %18 zemin + `navy` metin.

### 4.2 Tipografi

| Rol | Aile | Ağırlık | Boyut |
| --- | --- | --- | --- |
| Marka ve sayfa başlığı | Outfit | 700 | 40–56 px tanıtım, 28–34 px uygulama |
| Kart başlığı | Outfit | 600 | 18–23 px |
| Gövde | DM Sans | 400 | 16–17 px |
| Etiket ve düğme | DM Sans | 500–700 | 15–16 px |
| Küçük meta | DM Sans | 400 | 14 px |

Google Fonts'tan Outfit ve DM Sans yükle. Satır yüksekliği gövdede 1.45. Başlıklarda harf aralığı hafif negatif (`-0.3px` ile `-1px`).

### 4.3 Ölçü

| Token | px |
| --- | --- |
| xs / sm / md / lg / xl / xxl | 6 / 10 / 16 / 24 / 32 / 48 |
| radius sm / md / lg / xl | 10 / 16 / 24 / 32 |

Gölge kartta çok hafif: `0 3px 10px rgba(77,18,238,0.06)`. Modal daha belirgin: `0 -4px 16px rgba(0,0,0,0.18)`.

### 4.4 Bileşenler

- **Birincil düğme:** zemin `primary`, metin beyaz, yükseklik en az 48 px, radius `md`. Basılınca hafif küçülme.
- **İkincil düğme:** zemin `cyan` veya beyaz + lacivert metin. Gelir kaydetmede yeşil, gider kaydetmede kırmızı varyant serbest; metin beyaz.
- **Hayalet düğme:** zeminsiz, metin `primary`.
- **Tehlike:** zemin `danger`, beyaz metin. Silmede onay ve gerekçe sor.
- **Input:** zemin `surfaceTint`, kenar `border`, radius `sm`, dikey padding 14 px, placeholder `muted`. Hata kenarı `danger`, hata metni alanın altında. Üstte etiket, zorunlu alanda kırmızı yıldız.
- **Chip:** seçilmemiş beyaz kenarlı; seçili zemin vurgu rengi, metin beyaz.
- **Kart:** beyaz, radius `md`, kenar `border`, iç boşluk `md`.
- **Boş durum:** başlık + kısa açıklama + varsa eylem düğmesi. Ortala.
- **Para:** `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })`. Listede kompakt gösterim serbest; detayda kuruşlu.
- **Tarih:** `tr-TR` uzun veya `d MMM yyyy`. Takvim alanı metin inputu değil, tarih seçici.
- **Toast / dialog:** tarayıcı `alert` kullanma. Markalı dialog: başlık, mesaj, Vazgeç ve onay. Kritik veya belirsiz durumlar (kayıt doğrulanıyor, belge yüklenemedi) yalnız kısa toast'ta kalmaz, sayfada kalıcı görünür.
- **Etki önizlemesi:** Bedel değişikliği, iptal, iade, silme, geri yükleme ve düzeltme dialoglarında önce "önce → sonra" kutusu: etkilenen kalan borç/alacak, fazla tutar ve toplamlar. Altında zorunlu gerekçe alanı.
- **Kaydetme durumu:** Kaydediliyor / Kaydedildi / Kaydedilemedi / Kaydın durumu doğrulanıyor. Dördü ayrı metin ve ikonla gösterilir, yalnız renkle değil.
- **Belge satırı:** küçük önizleme veya dosya ikonu, ad, boyut, durum (bekliyor / yükleniyor / yüklendi / başarısız) ve yeniden dene.

### 4.5 Yerleşim

| Genişlik | Davranış |
| --- | --- |
| ≥ 1100 px | Sol sabit menü 240 px, içerik max 1120 px |
| 760–1099 px | Üst çubuk + içerik, menü drawer |
| < 760 px | Tek kolon, alt menü (Özet, Şantiyeler, İşlemler, Kişiler, Diğer), birincil eylemler alta yapışık, tablolar kart listesine döner |

Telefonda alt menünün ortasında veya üstünde her ekrandan erişilen bir **+ Kayıt** eylemi olsun: Gelir ekle, Gider ekle, Anlaşma ekle. Açıldığı bağlamdaki şantiye/anlaşma hazır seçilir.

Klavye ve odak: her input görünür kalsın. Formlar sayfa içinde kayar. Modal uzunsa kendi içinde kayar, arka plan kilitlenir. `Esc` modalı kapatır. Odak tuzağı ve görünür odak halkası olsun.

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

Sol menü: Özet, Şantiyeler, İşlemler, Kişiler, Anlaşmalar, Vadeler, Raporlar, Ara, Silinenler, Ayarlar. Üstte marka ve firma adı, altta kullanıcı adı ve çıkış. Telefonda "Diğer" sekmesi Anlaşmalar, Vadeler, Raporlar, Ara, Silinenler ve Ayarlar'ı listeler.

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

Karşılama: "Merhaba, {ad}". Kapsam etiketi: "Firma geneli — tüm şantiyeler" (tamamlanan ve arşivlenenler dahil).

Özet kutuları:

| Kutu | Kaynak |
| --- | --- |
| Tahsilat | `totals.netIncome`, yeşil (tahsilatlar − tahsilat iadeleri) |
| Ödeme | `totals.netExpense`, kırmızı (ödemeler − ödeme iadeleri) |
| Gelir − gider farkı | `totals.difference`. "Kâr" veya "kasa" diye adlandırma |
| Kalan borç | `totals.remainingPayable` |
| Kalan alacak | `totals.remainingReceivable` |
| Gecikmiş | `totals.overduePayable` ve `totals.overdueReceivable` ayrı |
| Aktif şantiye | `activeProjectCount` |

Bu ay şeridi: `monthly.netIncome`, `monthly.netExpense`, `monthly.difference`; işlem tarihine göre.

Listeler, her biri en fazla beş satır ve "tümünü gör":

- Son hareketler
- Gecikmiş ve 14 gün içinde vadesi gelen tutarlar
- Açık anlaşmalar (kalan > 0)
- Son kullanılan şantiyeler

Hızlı kayıt: Gelir ekle, Gider ekle. Satıra tıklayınca ilgili detaya git. Yüklenirken tutar kutularında `0 TL` gösterme, yükleniyor durumu göster. Hata halinde yeniden dene. Boş veride "İlk şantiyeni oluştur" ve "Başlangıç borç/alacağı gir" eylemlerine yönlendir; şantiye oluşturmak firma geneli kayıt için ön koşul değildir.

### 7.2 Şantiyeler

Araç çubuğu: arama ("Proje ara…"), filtre (durum: aktif / tamamlandı / arşivlendi / tümü; varsayılan aktif), sıralama (son kullanılan, yeniden eskiye, eskiden yeniye, ada göre). Sabitleme önce gelsin.

Yeni şantiye kartı listenin başında. Kartta ad, durum rozeti, son kullanım, gelir–gider farkı, kalan borç ve alacak.

Form alanları:

| Alan | Zorunlu | Not |
| --- | --- | --- |
| Proje adı | Evet | Örn. Kadıköy Villa Şantiyesi. Benzer ad varsa uyar, engelleme |
| Açıklama | Hayır | Çok satır |
| Adres / konum | Hayır | Serbest metin |
| Başlangıç tarihi | Hayır | Bilinmiyorsa boş kalır; bugün zorla yazılmaz |

Kayıttan sonra detaya git. Düzenlemede aynı alanlar. Sabitle.

Durum eylemleri ayrı düğmelerdir:

- **Tamamla:** Açık borç/alacak ve vadeler dialogda gösterilir; kullanıcı onayıyla tamamlanır. Tamamlanma tarihi bugün önerilir, değiştirilebilir. Tamamlamak tutarları, vadeleri veya kalanları değiştirmez. Tamamlanan şantiyede ödeme, tahsilat, iade ve düzeltme yapılabilir; yeni doğrudan gider gerekçeyle girilir.
- **Yeniden aktifleştir:** gerekçe ister.
- **Arşivle / arşivden çıkar:** Günlük listeden kaldırır; kayıt, belge ve açık tutarlar firma özetinde ve vade listelerinde kalır.
- **Sil:** Yalnız hiç aktif hareketi ve anlaşması olmayan şantiyede, onay ve gerekçeyle, yumuşak. Kaydı olan şantiyede sil yerine arşivle önerilir.

Detay üstü lacivert özet: tahsilat, ödeme, fark, ödenecek anlaşma toplamı, ödenen, kalan borç, tahsil edilecek anlaşma toplamı, tahsil edilen, kalan alacak, fazla ödeme/tahsilat varsa ayrı. Bloklar: son hareketler, anlaşmalar, vadeler, rapor bağlantısı. Gelir ekle, gider ekle ve anlaşma ekle bu projeye kilitli açılsın.

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

İşlem geçmişi olan kişi silinmez; **pasifleştirilir**. Pasif kişi yeni kayıtta önerilmez, geçmişte görünür, yeniden aktifleştirilebilir. Hiç kaydı olmayan kişi onayla yumuşak silinebilir.

### 7.4 İşlemler

Liste satırında: kayıt no, tarih, tür (gelir / gider / ödeme iadesi / tahsilat iadesi), açıklama, şantiye veya "Firma geneli", kişi, anlaşma, tutar. Paylaştırılmış harekette "Paylaştırıldı" rozeti.

Filtreler, birlikte çalışır:

- Tarih aralığı (işlem tarihine göre). Hızlı seçenekler: Bugün, Bu ay (varsayılan, görünür), Tümü
- Tür: tümü / gelir / gider / iade
- Kapsam: şantiye(ler) veya firma geneli
- Kişi/firma, gider kategorisi, anlaşma bağlantısı (bağlı / bağlı değil)
- Kategorisiz, muhatapsız
- Kaydı oluşturan kullanıcı
- Tutar alt-üst
- Silinenleri göster

Sıralama: yeniden eskiye, eskiden yeniye, tutar azalan, tutar artan. Arama: açıklama, kişi adı, şantiye/anlaşma adı, kayıt numarası, tutar. Türkçe büyük/küçük harf farkı engellemesin. Sayfalama 50. Liste özeti bütün filtrelenmiş sonuçları toplar. Şantiye filtresinde paylaştırılmış hareketin yalnız o şantiyeye düşen payı toplanır. Seçili filtreler, sonuç sayısı ve "Filtreleri temizle" görünür kalır; detaydan dönünce filtre ve konum korunur (URL sorgusu). Telefonda arama ve tarih/kapsam görünür, diğer filtreler açılır panelde.

Form:

| Alan | Zorunlu | Not |
| --- | --- | --- |
| Tür | Evet | Gelir veya gider. Açılan eylemden hazır, URL ile kilitlenebilir |
| Şantiye veya firma geneli | Evet | Aktif şantiyeler chip veya seçim + açık "Firma geneli" seçeneği. Bağlamdan hazır gelebilir, görünür olur. Tamamlanan şantiye de seçilebilir |
| Tutar | Evet | 0'dan büyük, en fazla iki ondalık, yazarken binlik. Boş başlar |
| İşlem tarihi | Evet | Bugün hazır, değiştirilebilir |
| Kişi/firma | Hayır | Yazınca öner, listeden seç, yoksa aynı akışta hızlı ekle |
| Gider kategorisi | Hayır, giderde | Seçilmezse "Kategorisiz" |
| Anlaşma | Hayır | Seçilen kişinin aynı kapsam ve yöndeki açık anlaşmaları önerilir; **otomatik bağlanmaz**. Seçilirse kalan tutar görünür |
| Açıklama | Hayır | Giderde örnek: demir, beton, usta ödemesi |
| Belgeler | Hayır | Kameradan veya galeriden; en fazla 10 |

Kurallar:

- Doğrudan gelir/gider anlaşma gerektirmez. Kişi seçmek anlaşmaya bağlamak sayılmaz. Kişinin açık anlaşması varsa form "Bu kayıt anlaşmaya bağlı değil; anlaşmanın kalanı değişmez" bilgisini gösterir.
- Anlaşma seçilirse kişi ve kapsam anlaşmadan gelir ve kilitlenir. Tutar kalanla otomatik dolmaz; "Kalanın tamamı" kısayolu vardır.
- Tutar kalanı aşarsa fazla ödeme/tahsilat uyarısı çıkar; kullanıcı onay ve gerekçe girmeden kayıt oluşmaz (bölüm 9.4).
- **Paylaştır:** Tek gerçek ödemeyi birden fazla şantiye/anlaşmaya bölmek için. Satır ekle: kapsam, varsa anlaşma veya başlangıç kaydı, pay tutarı; her satırda hedefin kalanı görünür. Bütün satırlar aynı yönde ve varsa aynı kişiye ait. Dağıtılmamış tutar görünür; pay toplamı ana tutara eşit olmadan kaydetme açılmaz. Hata metni örneği: "Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı." Basit kayıtta paylaştırma satırları görünmez.
- Kaydet başarılı olunca geldiği liste/detaya dön. "Kaydet ve yeni ekle" tutarı boşaltır, kapsam ve tarihi korur, kişi/anlaşma bağlantısını görünür biçimde yeniden sorar.
- Kayıt finansal kayıt ile belge yüklemesini ayrı gösterir: "İşlem kaydedildi; 1 belge yüklenemedi" → yalnız belge yeniden denenir.

Detay: kayıt no, tür, tutar, tarih, kapsam ve paylar, kişi, kategori, anlaşma, açıklama, belgeler, iadeler, oluşturan ve zaman, son güncelleyen, değişiklik geçmişi (eski → yeni, kim, ne zaman, gerekçe).

Eylemler:

- **Düzenle (finansal düzeltme):** Tutar, tarih, kapsam, kişi, anlaşma, paylar değişirse eski/yeni değerler ve bakiye etkisi önizlenir, gerekçe zorunlu. Yalnız açıklama değişiyorsa gerekçe gerekmez, geçmiş yine yazılır. Yanlış şantiye/anlaşma düzeltmesinde eski ve yeni bakiyeler aynı transaction'da güncellenir; tutar değişmiyorsa firma toplamı değişmez. Bağlı iadeyi tutarsız bırakan değişiklik engellenir.
- **İade kaydet:** bölüm 7.5.
- **Kopyala:** Yeni kayıt, aynı alanlar, tarih bugün, geçmiş ve belgeler boş, anlaşma bağlantısı yeniden onaylanır.
- **Sil:** Tutar, kapsam ve bakiye etkisiyle onay + gerekçe. Bağlı aktif iadesi varsa silinemez; nedeni gösterilir. Paylaştırılmış hareketin bütün payları birlikte kalkar.
- **Geri al:** Silinenlerden; bölüm 7.9.

### 7.5 İade

İlgili ödeme/tahsilat detayından "İade kaydet" açılır. Ödemeden geri gelen paraya **ödeme iadesi**, müşteriye geri verilen tahsilata **tahsilat iadesi** denir.

- Kaynak hareket, önceki iadeler ve en fazla iade edilebilir tutar gösterilir.
- Zorunlu: iade tutarı (pozitif), gerçek tarih, kısa gerekçe. Belge isteğe bağlı.
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

**Detay:** güncel bedel (ilk bedel ve değişiklikler), net ödenen/tahsil edilen, kalan, fazla, iş durumu, ödeme durumu, vade ve vade durumu, bağlı hareketler ve iadeler, belgeler, geçmiş.

Eylemler:

- **Ödeme yap / Tahsilat al:** `/uygulama/anlasmalar/:id/odeme`. İşlem formunun anlaşmaya kilitli hali: kişi, kapsam ve anlaşma hazır; kalan görünür; tutar boş; "Kalanın tamamı" kısayolu.
- **Bedeli değiştir:** Eski bedel, yeni bedel, gerekçe zorunlu. Yeni kalan veya fazla önizlenir. Ek iş aynı anlaşmanın bedeline eklenebilir; ayrı iş için "Yeni anlaşma oluştur" bağlantısı gösterilir. Bedel artışı gider oluşturmaz. Bedel ödenenin altına düşerse geçmiş ödemeler değişmez; kalan 0, aşan tutar fazla ödeme olur.
- **Vadeyi değiştir:** eski/yeni tarih ve gerekçe.
- **İşi tamamlandı olarak işaretle:** iş durumunu değiştirir; borç/alacağı sıfırlamaz.
- **İptal et:** İşin iptalini ve hesaplaşmayı ayırır. Kesinleşen bedel biliniyorsa yeni bedel ve gerekçe alınır; ödenen, kalan ve fazla birlikte gösterilir. Kesin bedel belli değilse anlaşma "İptal — hesap kesinleşmedi" olarak kalır, kalan gizlenmez. İptal para iadesi oluşturmaz; geri gelen para iade eylemiyle girilir.
- **Sil:** Yalnız hiç aktif bağlı hareketi olmayan anlaşmada, onay ve gerekçeyle. Hareketi olan anlaşmada sil yerine iptal veya bedel değişikliği önerilir.

### 7.7 Vadeler

Üç grup: gecikmiş, yaklaşan (vade tarihi aralığı seçilebilir, varsayılan 30 gün), vadesi belirlenmemiş açık tutarlar. Borç ve alacak ayrı sekmeler. Tamamlanan ve arşivlenen şantiyelerin açık tutarları dahil. Satırda kişi, anlaşma, kapsam, vade, kalan, gecikme gün sayısı. Bildirim yok; yalnız uygulama içi liste.

### 7.8 Arama

Tek kutu: şantiye, kişi, anlaşma, tutar, açıklama, kayıt numarası. Sonuçlar dört grup: Şantiyeler, Kişiler / firmalar, Anlaşmalar, İşlemler. Tür filtresi, tarih aralığı. Türkçe büyük/küçük harf ve `ı/i`, `ş/s` gibi karakterler engel olmasın. Arama firmanın bütün kayıtlarında çalışır, yalnız yüklenmiş sayfada değil. Belge içeriğinde arama yok. Boş sorguda son aramalar (en fazla üç, yalnız o kullanıcının) ve temizle. Arama yapılınca geçmişe yaz.

### 7.9 Silinenler

Listeler: işlemler, anlaşmalar, şantiyeler, kişiler. Satırda silen kişi, zaman ve gerekçe. Silinen kayıtlar normal toplamlara girmez.

**Geri al:** Güncel ilişkiler doğrulanır (anlaşma hâlâ aktif mi, kapsam ve kişi uyumlu mu, iade sınırı aşılıyor mu). Bakiye etkisi önizlenir, gerekçe istenir. Geçersiz ilişki varsa sessizce düzeltme; nedeni ve çözüm yolunu göster. Finansal etki bir kez uygulanır. Kalıcı silme eylemi müşteriye sunulmaz.

### 7.10 Raporlar ve veri çıkışı

Dört standart rapor; telefonda da görüntülenir ve indirilir:

1. **Dönem gelir/gider hareket dökümü:** tarih aralığı, kapsam, kategori filtreleri; kategori özeti.
2. **Şantiye özeti ve hareket dökümü** (`/uygulama/projeler/:id/rapor`): özet kutuları (tahsilat, ödeme, fark, anlaşmalar, ödenen, kalan borç/alacak, fazla), altta gelir ve gider listeleri tarihe göre artan.
3. **Kişi/firma hesap dökümü:** borç, alacak, fazla ödeme/tahsilat ve anlaşmaya bağlanmamış doğrudan hareketler ayrı.
4. **Açık borç/alacak ve vade listesi:** başlangıç kayıtları dahil, etiketli.

Her raporda ve indirilen dosyada: firma adı, kapsam, işlem tarihi aralığı, üretim tarihi/saati, "Güncel kalan — hesaplandığı tarih/saat" ve takip başlangıcı. Başlangıç kayıtları varsa "Bu rapor takip başlangıç tarihinden itibaren kayıtlı hareketleri kapsar" uyarısı.

İndir: Excel, CSV ve PDF. PDF başlığı rapor adı ve şantiye/kişi adı. "Bu sonuçları indir" etkin filtrelerin bütün sonuçlarını alır. Paylaştırılmış kayıtta ana işlem no, toplam gerçek tutar ve seçili kapsama düşen pay ayrı sütunlardır; toplamlar paydan hesaplanır, ana tutar tekrar sayılmaz. Dosyadaki toplamlar aynı satırlardan hesaplanır. Borç/alacak ile gerçekleşen hareketler karıştırılmaz.

**Tüm firma verisini dışa aktar:** Filtrelerden bağımsız, ayrı düğme. Arka planda hazırlanır, ilerleme ve hazır olunca indirme gösterilir. İçerik: hareketler, paylar, iadeler, anlaşmalar, başlangıç kayıtları, şantiyeler, kişiler, kategoriler ve değişiklik geçmişi; ilişkileri açıklanmış Excel sayfaları veya CSV dosyaları; orijinal belgeler dosya–kayıt eşleme tablosuyla zip paketinde. Silinen ama geri alınabilir kayıtlar durum etiketiyle. Şifre, token veya başka firma verisi içermez. Hazır paket 7 gün sonra silinir. Hazırlama hatası finansal kayıtları etkilemez.

### 7.11 Ayarlar

- **Profil:** görünen ad, telefon, e-posta. Kullanıcı adını yalnız ürün sahibi değiştirir.
- **Şifre:** mevcut, yeni, tekrar. Yeni en az 8 karakter. Başarılı olunca bütün oturumlar düşer, girişe al.
- **Firma:** ortak firma görünen adı ve iletişim bilgileri (bütün firma kullanıcıları düzenleyebilir, geçmiş tutulur). Depolama kullanımı: kullanılan / toplam, orijinal, önizleme ve silinmiş ama geri alınabilir belgeler ayrı. Hizmet durumu ve varsa bitiş tarihleri. Kapasite artırımı için `SUPPORT_CONTACT_TEXT`; satın alma akışı yok.
- **Kategoriler:** gider kategorisi ekle, yeniden adlandır, pasifleştir. Kullanılmış kategori silinmez, pasifleşir.
- **Hakkında:** ürün adı, slogan, sürüm, "veriler sunucuda, dil Türkçe".

### 7.12 Giriş ve ilk şifre

- Giriş: kullanıcı adı ve şifre. Hata: "Kullanıcı adı veya şifre hatalı". Hangi alanın yanlış olduğunu söyleme. Altında "Demoyu dene" ve "Şifremi unuttum".
- Şifremi unuttum: "Şifrenizi sıfırlamak için hesabınızı açan ürün sahibiyle iletişime geçin" + `SUPPORT_CONTACT_TEXT`. E-posta gönderimi yok.
- İlk şifre: geçici şifreyle giren kullanıcı kişisel şifresini oluşturmadan başka ekrana geçemez; sonra boş firma özetine alınır.
- Oturum bittiyse yeniden giriş istenir. Giriş sonrası önceki form kendiliğinden gönderilmez.

### 7.13 Yönetim (ürün sahibi)

- **İşletim özeti ve firma listesi:** Firma adına göre arama; durum filtresi (aktif, geçici durdurulmuş, hizmet sonu görüntüleme, arşiv saklama, silme onayı bekleyen). Satırda firma adı, kullanıcı sayısı, kullanılan/toplam depolama, hizmet durumu ve ilgili bitiş tarihleri. Kapasitesi dolan/yaklaşan, görüntüleme süresi biten ve saklama süresi dolan firmalar üstte özetlenir. Otomatik müşteri mesajı ve faturalama yok.
- **Firma oluştur:** ad zorunlu; yetkili kişi, telefon, e-posta, işletim notu isteğe bağlı. Yeni firma aktif, boş ve 20 GB kapasiteyle başlar; demo verisi aktarılmaz. Benzer ad uyarısı engellemez.
- **Kullanıcı ekle:** ad soyad, kullanıcı adı (sistem genelinde benzersiz, küçük harfe ve Türkçe kurallara göre normalize) ve firma zorunlu; telefon/e-posta isteğe bağlı. Sistem geçici şifre üretir ve **yalnız bir kez** gösterir; 72 saat geçerlidir. Ürün sahibi bunu müşteriye kendisi iletir; uygulama mesaj göndermez. Kullanıcı tek firmaya bağlıdır.
- **Şifre sıfırla:** yeni geçici şifre üretir, mevcut şifre hiç görüntülenmez, bütün oturumlar düşer.
- **Kullanıcıyı pasifleştir / aktifleştir:** giriş ve oturumlar kapanır; geçmişteki kayıt atıfları kalır.
- **Kapasite:** gerekçeyle artır veya mevcut kullanımın altına inmeden azalt; önceki/yeni değer ve kim/ne zaman kaydedilir.
- **Hizmet yaşam döngüsü:** Geçici durdur, Hizmeti sonlandır, Yeniden aç ayrı eylemler. Sonlandırmada yürürlük tarihi (geçmişe çekilemez), 30. gün görüntüleme bitişi ve 180. gün saklama bitişi önizlenir; gerekçe ve onay alınır. Arşiv uzatmada yeni saklama bitişi ve gerekçe; uzatma müşteri erişimini açmaz.
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
| `viewUntil` `retainUntil` | `serviceEndedAt` + 30 gün / + 180 gün; arşiv uzatmada `retainUntil` güncellenir |
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

**PlatformAdmin:** `username`, `passwordHash`, `refreshTokens`, `totpSecretEncrypted` (`PLATFORM_TOTP_ENCRYPTION_KEY` ile şifreli), `totpConfirmedAt` (null ise kurulum zorunlu), `recoveryCodeHashes` (kullanılmamış kodlar), `failedSecondFactorCount` ve `secondFactorLockedUntil`. Ayrı koleksiyon; müşteri firmasına bağlı değildir.

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

Yeni firmaya başlangıç kategorileri: Malzeme, İşçilik, Taşeron, Nakliye, Kira, Genel giderler. Kullanıcı değiştirebilir.

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

`paymentStatus`: `open` (hiç ödeme yok), `partial`, `settled` (kalan 0, fazla 0), `overpaid` (fazla > 0).

İndeksler: `companyId + projectId + partyId + deletedAt`; `companyId + direction + remaining`; `companyId + dueDate + remaining`; `companyId + paymentStatus`.

### 8.8 Document

| Alan | Kural |
| --- | --- |
| `ownerType` `ownerId` | `transaction` veya `agreement` |
| `fileName` `mimeType` | Dosya imzasından doğrulanmış tür |
| `sizeBytes` | Sunucunun ölçtüğü gerçek boyut |
| `storageKey` `previewKey` | Nihai orijinal ve önizleme anahtarları |
| `status` | `pending` `uploaded` `failed` `expired` |
| `uploadedBy` `uploadedAt` | Otomatik |

Desteklenen türler: PDF, JPEG, PNG, WEBP, HEIC/HEIF. Dosya en fazla 20 MB, kayıt başına en fazla 10 belge.

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

### 9.3 Vade

| Kural | Davranış |
| --- | --- |
| Vade | İsteğe bağlı, tek tarih |
| Gecikmiş | `dueDate < bugün (İstanbul)` ve `remaining > 0` |
| Vadesiz | Gecikmiş sayılmaz, "Vadesi belirlenmemiş" grubunda görünür |
| Kısmi ödeme | Gecikmiş tutarı azaltır, vadeyi ertelemez |
| Gecikme | Bedeli veya geliri artırmaz; faiz/ceza yok |
| Vade değişikliği | Gerekçe, eski/yeni tarih, kullanıcı ve zaman tutulur |

### 9.4 Fazla ödeme ve iade

| Kural | Davranış |
| --- | --- |
| Fazla ödeme/tahsilat | Engellenmez ama onaysız kayıt yok. İstek kalanı aşıyorsa ve `confirmExcess` + `excessReason` yoksa 409 `EXCESS_CONFIRMATION_REQUIRED` ve aşan tutar döner. Onaylanırsa kaydedilir, mesaj "Fazla ödeme kaydedildi" |
| İade sınırı | Bir paya bağlı aktif iadelerin toplamı pay tutarını aşamaz. 45.000 ödemenin 5.000'i iade edilmişse en fazla 40.000 daha |
| Ana tutar | Bağlı iade toplamının altına indirilemez |
| İade düzeltme/silme/geri yükleme | Kaynak payın `refundedAmount` değeri ve bağlı anlaşma önbelleği aynı transaction'da güncellenir |
| Düzeltme ile iade farkı | Yanlış girilen tutar düzenleme ile düzeltilir (geçmişte eski/yeni kalır). Gerçekte geri gelen para iade olarak ayrı kaydedilir |

### 9.5 Silme, geri yükleme ve geçmiş

| Kural | Davranış |
| --- | --- |
| Gerekçe | Finansal alan değişikliği, silme, geri yükleme, bedel ve vade değişikliği, iptal, şantiye yeniden aktifleştirme gerekçe ister. Yalnız açıklama düzeltmesi istemez |
| İşlem silme | Yumuşak; toplam ve kalanlar yeniden hesaplanır. Aktif iadesi varsa silinemez |
| Paylaştırılmış silme | Bütün paylar birlikte kalkar |
| Anlaşma silme | Yalnız aktif bağlı hareket yoksa |
| Şantiye silme | Yalnız aktif hareket ve anlaşma yoksa; aksi halde arşivle |
| Kişi silme | Yalnız hiç kaydı yoksa; aksi halde pasifleştir |
| Geri yükleme | İlişkiler ve iade sınırları yeniden doğrulanır; geçersizse açıklamalı 409. Etki bir kez uygulanır |
| Kayıt geçmişi | Oluşturan kişi/zaman değişmez; her değişiklik `history`'ye yazılır |
| Hareket kopyala | Yeni kayıt, aynı alanlar, tarih bugün, geçmiş ve belgeler boş |
| Mükerrer uyarısı | Aynı gün, aynı tutar, aynı kişi ve kapsamda kayıt varsa uyar; engelleme |

### 9.6 Belgeler ve kapasite

| Kural | Davranış |
| --- | --- |
| Yükleme niyeti | `POST /documents/upload-intent`: 20 MB, kayıt başına 10 belge (`documentCount` koşullu `$inc`) ve firma kapasitesi (`storageUsedBytes` koşullu `$inc`) atomik kontrol edilir. Geçici anahtara 15 dk geçerli imzalı yükleme adresi döner |
| Tamamlama | `POST /documents/:id/complete`: durum koşullu `pending → uploaded` geçmeden önce sunucu gerçek boyutu ve dosya imzasını kendisi doğrular, dosyayı değiştirilemeyen nihai anahtara kopyalar, geçici kopyayı siler, kapasiteyi gerçek boyuta göre düzeltir. Önizleme üretir |
| Temizlik | 1 saati geçen ve hâlâ `pending` olan yüklemeler `expired` olur; rezervasyon ve sayaç iade edilir |
| Kapasite dolu | Yeni belge yükleme 409 `STORAGE_FULL`; finansal kayıt ve mevcut belgelere erişim devam eder |
| Kapasite hesabı | Orijinaller, önizlemeler, geri alınabilir silinmiş belgeler ve hazır dışa aktarma paketleri sayılır |
| Erişim | Bağlı kaydın firmasıyla sınırlı; indirme için 5 dk geçerli imzalı adres. Bucket herkese kapalı |
| Orijinal | Asla değiştirilmez; önizleme ayrıca üretilir. Önizleme yoksa orijinal indirilir |

### 9.7 Güvenli tekrar ve bağlantı

| Kural | Davranış |
| --- | --- |
| Anahtar | Web, kullanıcı "Kaydet"e bastığında `Idempotency-Key` (UUID) üretir. Aynı gönderimin tekrarlarında aynı anahtar kullanılır |
| Yanıt yok | Ekran "Kaydın durumu doğrulanıyor" gösterir, kesin başarısızlık gibi sunmaz; `GET /idempotency/:key` ile sonucu sorar veya aynı anahtarla tekrar gönderir |
| Kesin ret | Doğrulama hatasında kayıt oluşmaz; kullanıcı formu düzeltip kaydedince yeni anahtar üretilir |
| Düğme | Gönderim sürerken kilitli; çift tıklama iki kayıt açmaz |
| Form | Bağlantı kesilince açık formdaki bilgiler korunur; taslak toplamlara girmez. Tarayıcı kapanınca kalıcı taslak yok |
| Belge | Finansal kayıt başarılıysa belge hatası kaydı tekrar oluşturmaz; yalnız belge yeniden denenir |

### 9.8 Kimlik

| Kural | Davranış |
| --- | --- |
| Şifre | En az 8. Değişince, sıfırlanınca veya kullanıcı pasifleşince bütün oturumlar düşer |
| Geçici şifre | 72 saat; ilk girişte değiştirme zorunlu |
| Giriş hatası | 401 "Kullanıcı adı veya şifre hatalı". Hesabın varlığını ifşa etme |
| Deneme sınırı | Kullanıcı adı ve IP başına; aşılınca kısa bekleme |
| Kullanıcı adı çakışması | Yönetimde 409 "Bu kullanıcı adı kullanılıyor" |
| Ürün sahibi ikinci adım | Şifre doğruysa yalnız 5 dakika geçerli bir ara token verilir; access/refresh ancak geçerli TOTP veya kurtarma koduyla verilir. TOTP ±1 zaman adımı toleranslı, aynı kod ikinci kez kabul edilmez |
| Ürün sahibi kilit | 5 hatalı ikinci adım denemesinde 15 dakika kilit; PlatformLog'a yazılır |

### 9.9 Arama

Firma filtresi zorunlu. Ad ve açıklama alanları Türkçe küçük harf ve karakter katlamalı kopya alanlarda aranır. Tutar araması kuruşa çevrilmiş eşitlik veya aralık olarak çalışır. Arama sonuçları silinmiş kayıtları dışlar.

### 9.10 Hizmet durumu ve erişim

Firmanın etkin durumu her istekte tarihlerden ve işaretlerden hesaplanır; zamanlanmış bir işe bağlı değildir.

| Etkin durum | Giriş | Okuma, rapor, dışa aktarma | Kayıt değiştirme ve belge yükleme | Kendi şifresi ve profili |
| --- | --- | --- | --- | --- |
| Aktif | Açık | Açık | Açık | Açık |
| Hizmet sonu, ilk 30 gün | Açık | Açık | Kapalı (`READ_ONLY`) | Açık |
| Geçici durdurulmuş | Erişim mesajı | Kapalı | Kapalı | Kapalı |
| Arşiv saklama (31–180. gün) | Erişim mesajı | Kapalı | Kapalı | Kapalı |
| Silme onayı bekliyor / siliniyor | Erişim mesajı | Kapalı | Kapalı | Kapalı |
| Kullanıcı pasif | Erişim mesajı | Kapalı | Kapalı | Kapalı |

- Görüntüleme döneminde sayfa üstünde bant: "Hizmetiniz sona erdi. {tarih}'e kadar kayıtlarınızı görüntüleyip dışa aktarabilirsiniz." Değişiklik düğmeleri kapalı ve nedeni yazılı.
- Erişim kapalıyken boş firma gösterme; açıklayıcı erişim mesajı göster. Veri silinmiş gibi sunma.
- 180 gün sonunda veri kendiliğinden silinmez; ürün sahibinin onayını bekler. Hizmet bu süre içinde yeniden açılırsa firma geçmişiyle devam eder.
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
| PATCH | `/auth/password` | `currentPassword, newPassword` | oturumlar düşer |

`user`: `{ id, name, username, companyId, mustChangePassword }`.

### 10.2 Demo

| Metot | Yol | Not |
| --- | --- | --- |
| POST | `/demo/start` | Yeni demo firması + örnek veri + demo token'ı |
| POST | `/demo/reset` | Bu ziyaretçinin demo firmasını başlangıç örneklerine döndürür |

### 10.3 Firma ve kategoriler

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/company` | görünen ad, iletişim, depolama kullanımı, hizmet durumu |
| PATCH | `/company` | `displayName, contact`, `expectedUpdatedAt` |
| GET | `/categories` | `includeInactive` |
| POST | `/categories` | oluştur |
| PATCH | `/categories/:id` | ad, `isActive` |

### 10.4 Projeler

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/projects` | `status, q, sort, pinnedFirst, includeDeleted, page, limit` |
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
| POST | `/transactions` | `kind, amount, date, partyId?, categoryId?, description, allocations[], confirmExcess?, excessReason?` |
| GET | `/transactions/:id` | detay, paylar, iadeler, belgeler, geçmiş |
| PATCH | `/transactions/:id` | düzeltme; finansal alan değişirse `reason` zorunlu |
| POST | `/transactions/:id/refunds` | `amount, date, reason, parts[]` |
| DELETE | `/transactions/:id` | `reason`; aktif iade varsa 409 `HAS_DEPENDENCIES` |
| POST | `/transactions/:id/restore` | `reason` |
| POST | `/transactions/:id/duplicate` | kopya |
| GET | `/idempotency/:key` | `{ status: 'done' \| 'not_found', resultRef? }` |

### 10.7 Anlaşmalar

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/agreements` | `kind, direction, projectId, scope, partyId, workStatus, paymentStatus, dueState, remainingOnly` |
| POST | `/agreements` | anlaşma veya başlangıç kaydı oluştur; hareket yazmaz |
| GET | `/agreements/:id` | detay, bağlı hareketler, iadeler, kalan, fazla, geçmiş |
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
| POST | `/documents/upload-intent` | `ownerType, ownerId, fileName, mimeType, sizeBytes`; imzalı yükleme adresi |
| POST | `/documents/:id/complete` | doğrulama ve nihai kayıt |
| GET | `/documents/:id/download` | 5 dk imzalı adres |
| GET | `/documents/:id/preview` | önizleme adresi |
| DELETE | `/documents/:id` | `reason`; yumuşak |
| POST | `/documents/:id/restore` | `reason` |

### 10.9 Arama, pano, vade, rapor, dışa aktarma, silinenler

| Metot | Yol | Not |
| --- | --- | --- |
| GET | `/dashboard` | bölüm 7.1 verisi + `monthly` + `generatedAt` |
| GET | `/dues` | `direction, group (overdue \| upcoming \| none), from, to` |
| GET | `/search` | `q, saveHistory, projectId, type, dateFrom, dateTo` |
| GET | `/search/history` | son aramalar |
| DELETE | `/search/history` | temizle |
| GET | `/reports/period` | dönem dökümü verisi |
| GET | `/reports/projects/:id/summary` | şantiye raporu verisi |
| GET | `/reports/parties/:id/statement` | hesap dökümü verisi |
| GET | `/reports/open-balances` | açık borç/alacak ve vade |
| GET | `/reports/:type/export.{xlsx,csv,pdf}` | aynı filtrelerle dosya |
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
| POST | `/platform/companies/:id/users` | kullanıcı + bir kez gösterilen geçici şifre |
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
- Tanıtım ve uygulama aynı görsel dili kullansın. Tanıtım daha geniş ve gradyanlı, uygulama `surface` zeminli ve sıkı.
- Tabloda masaüstünde satır, 760 px altında kart. Sütunlar: tarih, açıklama, şantiye veya kişi, tutar.
- Form kaydı çift tıklamada iki kayıt açmasın. Düğme gönderim sürerken kilitli; `Idempotency-Key` bölüm 9.7'ye göre.
- Kaydedilmemiş formdan çıkışta sor: "Kaydedilmemiş değişiklikler. Çıkmak istediğinize emin misiniz?" Bu uyarı sonucu belirsiz bir gönderimi iptal ettiğini iddia etmesin.
- Boş liste, hata ve yükleniyor durumları her listede olsun. Sonsuz iskelet koyma. Yükleme veya erişim hatasını `0 TL` gibi gösterme. Filtre sonucu boşsa "Filtrelere uyan kayıt bulunamadı" + filtreleri temizle.
- Yenileme sırasında eski veri gösteriliyorsa "Güncelleniyor" bilgisi. Kısmi hata varsa başarısız bölümün toplamı kesin gibi gösterilmesin.
- 409 `CONFLICT` geldiğinde güncel kayıt ile kullanıcının değişikliği yan yana gösterilsin; kullanıcı yeniden değerlendirsin. Onay gerektiren eylemler eski önizlemeyle tamamlanmasın.
- Hata ilgili alanın yanında açık dille gösterilsin; telefonda ilk hatalı alana kaydırılsın.
- Para inputu sayısal klavye ve `inputMode="decimal"`. Kullanıcı `12500` veya `12.500,50` yazabilir; kuruşa çevrilir. Gösterim `tr-TR`.
- Tarih inputu `type="date"` veya özel takvim. Etiket Türkçe. Seçilen takvim günü korunur.
- Belge seçimi telefonda `accept="image/*,application/pdf"` ve `capture` desteğiyle kameradan veya galeriden.
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
