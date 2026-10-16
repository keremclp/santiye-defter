# İnşaat Gelir–Gider Uygulaması — Kapsam ve Planlama Kararları

Son güncelleme: 16 Ekim 2026

Bu belge, proje görüşmelerinde kabul edilen kararları, henüz kesinleşmeyen ayrıntıları ve aşamaların durumunu kaydeder. Mevcut özellik raporunun yerine geçmez; raporun ticari ürün ve web kullanımına uyarlanması için karar kaynağıdır.

Kaynak özellik raporu: [insaat_gelir_gider_uygulamasi_ozellik_raporu.md](insaat_gelir_gider_uygulamasi_ozellik_raporu.md)

## 1. Belgenin kullanım şekli

- Her aşama tamamlandığında sonucu bu belgeye eklenecek ve durumu güncellenecek.
- Kabul edilmiş kararlar, önerilerden ve açık sorulardan ayrı tutulacak.
- Bir karar değişirse eski kararın değiştiği ve gerekçesi karar geçmişine yazılacak.
- Bir yaklaşımın kabul edilmesi, bütün uygulama ayrıntılarının veya teknoloji seçiminin kabul edildiği anlamına gelmez.
- İlk sürüm kapsamı kesinleşmeden kabul edilen her özelliğin ilk sürümde eksiksiz yapılacağı varsayılmayacak.

## 2. Ürünün amacı ve hedefi

Uygulama, müteahhitlerin şantiye bazında gerçekleşen para hareketlerini, kişi/firma bazında borç ve alacaklarını ve anlaşmaların kalan tutarlarını kolayca takip etmesini sağlayacak.

Ürün farklı müteahhitlere satılacak. İlk rapordaki tek firma ve üç kullanıcı varsayımı ticari ürünün kesin sınırı değil. Farklı firmaların kullanıcıları, kayıtları ve belgeleri birbirinden ayrılacak.

Satış/erişim modeli: Herkese açık ve gerçek müşteri hesabına ait olmayan örnek verili bir demo bulunacak. Gerçek müşteri kullanımı için ürün sahibi firma hesabını ve kullanıcıları kontrollü olarak oluşturacak, giriş bilgilerini müşteriye verecek. Herkese açık gerçek kullanıcı kaydı veya otomatik firma açılışı olmayacak.

Güncel kapsam değişikliği (5 Ekim 2026): Avans özelliği şimdilik yapılmayacak. Anlaşma öncesi avans kaydı, avansın sonradan anlaşmaya bağlanması ve özel avans takibi ilk sürümden çıkarıldı. Mevcut anlaşmaya yapılan normal kısmi ödeme/tahsilat ve başlangıç borç/alacak girişi kapsamda kalıyor.

Güncel yetki kararı (5 Ekim 2026): Aynı müşteri firmasının bütün kullanıcıları ilk sürümde eşit işlem yetkisine sahip olacak. Müşteriler hesapları güvendikleri ortaklara veya aile üyelerine istediği için yönetici/çalışan/görüntüleyici ayrımı ve şantiye bazlı erişim kısıtları sonraki sürüme bırakıldı. Firma ayrımı, kişisel hesaplar ve kayıt geçmişi korunacak. Firma/kullanıcı hesabı açma ürün sahibinin platform yetkisi olarak ayrı kalacak.

Web uygulaması telefonda günlük kullanım için tasarlanacak; masaüstünde inceleme, raporlama ve yönetim olanakları genişletilecek. 11 Ekim 2026 kararıyla şimdilik yalnız web ürünü yapılacak; ayrı mobil uygulama yapılmayacak.

Ürünün cevaplaması gereken temel sorular:

1. Hangi şantiyeye ne kadar para girdi ve ne kadar para çıktı?
2. Hangi kişi veya firmaya ne kadar borç kaldı?
3. Kimden ne kadar alacak var?
4. Yakında hangi ödemeler ve tahsilatlar bekleniyor?
5. Bir işlem ne zaman gerçekleşti ve kim tarafından kaydedildi?

Öncelikler: hızlı kayıt, doğru hesaplama, güçlü arama, okunaklı özetler, ortak verilerin güncelliği ve geçmişin korunması.

## 3. Kabul edilen kapsam ve iş yaklaşımı

### 3.1. Gerçekleşen para hareketleri ve anlaşmalar

- Doğrudan gelir ve gider kaydı oluşturulabilecek.
- Ödenecek anlaşmalar ve tahsil edilecek anlaşmalar bulunacak.
- Anlaşma, toplam ödeme veya tahsilat yükümlülüğünü temsil edecek; anlaşma oluşturulması tek başına gerçekleşen para hareketi sayılmayacak.
- Anlaşmaya bağlı ödeme gerçekleşen giderde, anlaşmaya bağlı tahsilat gerçekleşen gelirde görünecek.
- Aynı ödeme veya tahsilat farklı ekranlarda görüntülense de toplamda yalnızca bir kez sayılacak.
- Doğrudan kayıt için önce anlaşma oluşturmak zorunlu olmayacak.
- Anlaşmalara birden fazla kısmi ödeme veya tahsilat bağlanabilecek.
- Doğrudan kayıtta muhatap, gider kategorisi, açıklama ve belge isteğe bağlı olacak. Kapsam, pozitif tutar ve işlem tarihi zorunlu; işlem yönü açılan eylemden hazır olacak.
- Muhatap seçmek tek başına anlaşmaya bağlamak sayılmayacak. Anlaşmasız doğrudan hareket mevcut anlaşmaların kalan tutarını kendiliğinden azaltmayacak; uygun anlaşmalar önerilecek ve bağlantı kullanıcı seçimiyle kurulacak.

Örnek: 120.000 TL tutarlı bir ödeme anlaşmasına 45.000 TL ödendiğinde gerçekleşen gider 45.000 TL, kalan borç 75.000 TL olur. Anlaşma bedeli ayrıca gider toplamına eklenmez.

### 3.2. Finansal göstergeler

- Toplam tahsilat, toplam gerçekleşen ödeme, gelir–gider farkı, kalan borç ve kalan alacak ayrı gösterilecek.
- Ödenecek ve tahsil edilecek anlaşmaların toplamları ayrılacak.
- Gelir–gider farkı otomatik olarak proje kârı veya kasadaki para şeklinde adlandırılmayacak.
- Firma geneli ve şantiye bazında finansal görünüm olacak.
- Geçmiş borç/alacak başlangıçları güncel dönemde gerçekleşmiş para hareketi gibi sayılmayacak.

### 3.3. Kişi/firma ve anlaşma ilişkileri

- Bir kişi/firma birden fazla şantiyeyle ilişkilendirilebilecek.
- Aynı kişi/firma ile aynı şantiyede birden fazla anlaşma yapılabilecek.
- Aynı kişi/firma hem borç hem alacak tarafında bulunabilecek.
- Borç ve alacak ayrı gösterilecek; yalnızca net tutarla yükümlülükler gizlenmeyecek.
- Kişi/firma ekranında proje, anlaşma ve para hareketi geçmişi incelenebilecek.
- Anlaşmaya bağlı hareketin şantiye, anlaşma ve kişi/firma bilgileri uyumlu olacak; seçilen şantiye dışındaki bakiyeler kendiliğinden değişmeyecek.
- Şantiyeler veya borç/alacak arasında otomatik mahsup yapılmayacak. Fazla ödeme başka şantiyenin borcunu kendiliğinden kapatmayacak.
- Tek gerçek ödeme birden fazla anlaşmaya/şantiyeye dağıtılırsa payların toplamı ödeme tutarına eşit olacak; firma toplamında bir kez sayılacak. Paylaştırma ilk sürüm kapsamına alındı; ekran ayrıntıları ayrıca belirlenecek.

### 3.4. Bedel değişiklikleri ve iadeler

- İlk anlaşma bedeli ve sonradan yapılan tutar değişiklikleri korunacak.
- Değişiklik gerekçesi, kullanıcı ve zaman kaydedilecek.
- Kalan tutar güncel anlaşma bedeli üzerinden hesaplanacak.
- Anlaşmanın iş durumu ile ödeme/tahsilat durumu ayrı tutulacak. İşin tamamlanması borcu veya alacağı sıfırlamayacak; ödeme/tahsilat durumu hareketlerden hesaplanacak.
- Ek iş mevcut işin kapsamını genişletiyorsa aynı anlaşmanın bedeli gerekçeyle artırılabilecek; ayrı iş için yeni anlaşma oluşturulabilecek.
- Anlaşma bedeli yapılmış ödemenin altına düşürüldüğünde geçmiş ödemeler değişmeyecek. Kalan borç sıfır, aşan tutar ayrı fazla ödeme olarak gösterilecek; iade veya başka işe aktarma ayrı işlem gerektirecek.
- Fazla ödeme ve iade durumları ele alınacak. Özel avans özelliği şimdilik ertelendi.
- Fazla ödeme kullanıcıya açıkça bildirilecek; her durumda otomatik engelleme yaklaşımı benimsenmeyecek.
- İade hareketi ilgili önceki kayıtla ilişkilendirilebilecek.
- Ödemenin geri dönmesi ile anlaşma bedelinin azaltılması farklı olaylar olarak değerlendirilecek.
- Avansın gelecekteki hesaplama ilkesi 6.8'de korunuyor; güncel ilk sürümde uygulanmayacak.
- Ödemesi/tahsilatı bulunan anlaşmanın iptali geçmiş hareketleri silmeyecek. Kesinleşen bedel gerekçeyle güncellenecek; fazla ödeme/tahsilat ve gerçek iadeler ayrı korunacak. Bedel kesinleşmeden hesap kapanmış sayılmayacak.
- Bir harekete bağlı toplam iadeler o hareketin geçerli tutarını aşamayacak; ana tutar bağlı iade toplamının altına tutarsız biçimde indirilemeyecek.

Temel finansal kurallar Aşama 1'de tamamlandı. İlk sürümde aynı firma kullanıcıları eşit yetkili olacak. Ekran/teknik uygulama ayrıntıları sonraki aşamalarda belirlenecek.

### 3.5. Vade takibi

- Borç ve alacakların vadesi takip edilecek.
- Vadesi geçmiş, yaklaşan ve vadesi belirlenmemiş kalan tutarlar ayırt edilebilecek.
- Vade tarihi isteğe bağlı olacak; vadesi olmayan kayıt gecikmiş sayılmayacak.
- Tek vadeli kayıtta vade günü geçtikten sonra açık tutar gecikmiş gösterilecek. Kısmi ödeme/tahsilat kalan tutarın vadesini otomatik ertelemeyecek.
- Taksitli plan dahil edilirse yalnızca vadesi geçmiş taksitlerin açık kısmı gecikmiş sayılacak.
- Vade değişiklikleri gerekçe, eski/yeni tarih, kullanıcı ve zamanla korunacak.
- Gecikme anlaşma bedelini veya gerçekleşen geliri kendiliğinden artırmayacak; otomatik faiz/ceza uygulanmayacak.
- İlk sürümde tek vade kullanılacak; taksitli plan sonraki sürüme bırakıldı.
- İlk sürümde uygulama içi vade listeleri olacak. E-posta/SMS/telefon bildirimi sonraki sürüme bırakıldı; gönderim ayrıntıları henüz belirlenmedi.

### 3.6. Kullanıcılar ve erişim

- Aynı müşteri firmasındaki bütün kullanıcılar ilk sürümde eşit yetkili olacak; yönetici, çalışan ve görüntüleyici ayrımı yapılmayacak.
- Firma kullanıcıları kendi firmalarının bütün şantiyelerini, genel firma kayıtlarını, belgelerini ve raporlarını görebilecek.
- Bütün firma kullanıcıları kayıt oluşturma/düzenleme, gerekçeli silme/geri yükleme, anlaşma bedeli değişikliği/iptal, ödeme/tahsilat/iade, belge ekleme ve proje tamamlama/arşivleme/yeniden aktifleştirme işlemlerini aynı kurallarla yapabilecek. Başkasının oluşturduğu firmaya ait kaydı düzenlemek yalnızca kaydı oluşturan kişiyle sınırlandırılmayacak.
- Eşit yetki; silme onayını, finansal değişiklik gerekçesini, kayıt geçmişini, iade sınırlarını veya fazla ödeme uyarısını kaldırmayacak.
- İlk gerçek müşteri hesapları ürün sahibi tarafından oluşturulacak; müşteri kendi kendine kayıt olmayacak. Firma oluşturma, kullanıcı hesabı açma/pasifleştirme ve hesap erişimini yönetme ürün sahibinin ayrı platform işlemleri olacak.
- Her kullanıcı kendi kişisel hesabıyla giriş yapacak; kendi profil/parola işlemleri kişisel kalacak. Ayrıntılı müşteri rolleri ve şantiye erişim ataması sonraki sürüme bırakıldı.
- Sisteme kaydı giren kullanıcı otomatik kaydedilecek.
- Kaydı giren kişi ile gerçekte ödemeyi yapan kişi aynı kabul edilmeyecek. Gerçek ödeme yapanı ayrıca takip etme ihtiyacı henüz kesinleşmedi.
- Firmaların verileri ve belgeleri diğer firmaların kullanıcılarına açılmayacak.
- İlk sürümde firma geneli toplamlar o firmanın bütün kullanıcılarına gösterilecek; başka firmalara açılmayacak. İleride şantiye kısıtı eklenirse arama, rapor, belge ve toplamlar aynı kısıta uyacak.

### 3.7. Kayıt geçmişi, silme ve proje durumları

- Düzeltmelerde eski/yeni değer, kullanıcı ve zaman korunacak.
- Hatalı finansal kaydın düzeltilmesi ile gerçek para iadesi ayrı işlenecek. İade, önceki hareketle ilişkili ayrı kayıt olacak; net ödeme/tahsilata etkisi hesaplanacak.
- Finansal alan değişikliklerinde ve silme/geri yüklemede gerekçe istenecek. Yalnızca açıklamadaki yazım düzeltmesinde ayrıca gerekçe zorunlu olmayacak; geçmiş yine korunacak.
- Silinen/geri alınan para hareketinin ilgili toplam ve kalan tutarlara etkisi yeniden hesaplanacak.
- Silme, kaydı aktif toplam/listelerden çıkaracak; geçmişi ve belgeleri geri yükleme için korunacak. Geri yükleme güncel ilişkileri ve izinleri doğrulayacak; toplamları bir kez etkileyecek.
- İade gibi bağlı hareket bulunan ana kayıt tek başına silinmeyecek; ilişkiler birlikte değerlendirilecek.
- Yanlış şantiye/anlaşma bağlantısı düzeltildiğinde eski ve yeni bakiyeler tutarlı biçimde birlikte güncellenecek; tutar değişmiyorsa firma toplamı değişmeyecek.
- İşlem geçmişi bulunan kişi/firma için geçmişi bozmayan pasifleştirme yaklaşımı kullanılacak.
- Ödeme yapılmış anlaşmanın geçmişi tek işlemle yok edilmeyecek.
- Tamamlanma ve arşivleme farklı anlam taşıyacak.
- Tamamlanan şantiyenin kalan ödeme ve tahsilatları kaydedilebilecek.
- Şantiye tamamlanırken açık borç/alacak gösterilecek; kullanıcı onayıyla tamamlanabilecek. Tamamlanma kalan tutarları veya vadeleri değiştirmeyecek.
- Tamamlanan işe ait geç doğrudan giderler gerekçeyle kaydedilebilecek. Yeni iş veya anlaşma için firma kullanıcısı şantiyeyi gerekçeyle yeniden aktifleştirecek; ilk sürümde ayrı yönetici rolü aranmayacak.
- Arşivleme, kayıtları günlük listelerden kaldırma amacı taşıyacak; finansal geçmişi silmeyecek.
- Tamamlanan/arşivlenen şantiyelerin açık tutarları firma toplamı ve bekleyen/gecikmiş tutar listelerinde korunacak; yalnızca aktif şantiyeyi kapsayan özetlerin kapsamı açık belirtilecek.
- Güncel özet yeni hareketlerle güncellenecek. Raporlarda oluşturulma zamanı ve kapsanan işlem tarihi aralığı bulunacak; tamamlanma anındaki otomatik özet kopyası henüz ilk sürüm kararı değil.
- Kesin hesap sonrası kayıt kilitleme sonraki sürüme bırakıldı.

### 3.8. Ek kolaylıklar

- Gider kategorileri.
- Başlangıç borç/alacak girişi.
- Başlangıç borç/alacakları yeni gelir/gider sayılmayacak; sonraki ödeme/tahsilat gerçek para hareketi olarak sayılacak. Aynı yükümlülük geçmiş anlaşma ve başlangıç kaydı üzerinden iki kez hesaplanmayacak.
- Geçmiş eksiksiz aktarılmadıysa raporda takip başlangıcı ve geçmiş kapsamı görünür olacak; kayıtlı dönem bütün proje geçmişi gibi sunulmayacak.
- Olası mükerrer kayıt uyarısı; meşru tekrarları otomatik engellememe.
- İşlem tarihi ile sisteme kayıt zamanının ayrılması.
- Firma geneli finansal görünüm.
- Hızlı kayıt, son kullanılan seçimler, arama, birlikte kullanılabilen filtreler ve dışa aktarma.

### 3.9. Genel firma giderleri

- Bir şantiyeye ait olmayan giderler kaydedilebilecek.
- Bir gider ya bir şantiyeye ya da firma geneline ait olacak.
- Firma toplamı şantiye giderlerini ve genel giderleri içerecek.
- Şantiye özeti yalnızca ilgili şantiyenin giderlerini içerecek.
- Genel giderleri şantiyelere otomatik dağıtmak başlangıç yaklaşımına dahil değil; gerekirse dağıtım yöntemi ayrıca tasarlanacak.
- Kayıt ekranında açık bir "Firma geneli" seçeneği olacak; kategori, kişi/firma, belge ve geçmiş için normal gider mantığı kullanılacak.
- Henüz ödenmemiş genel firma yükümlülükleri firma geneline bağlı anlaşma/borç olarak takip edilebilecek; gerçekleşen gideri yalnızca ödeme artıracak. Başlangıç borçları da firma geneline bağlanabilecek.
- İlk sürümde genel firma kayıtları o firmanın bütün kullanıcılarına açık olacak. İleride rol/şantiye kısıtı eklenirse genel firma kayıtları ve arama/rapor/belge/toplam erişimi ayrıca sınırlandırılabilecek.

### 3.10. Belge yönetimi

- İşlemlere ve anlaşmalara belge eklenebilecek.
- PDF ve yaygın fotoğraf biçimleri desteklenecek.
- Bir kayda birden fazla belge eklenebilecek.
- Telefonda kameradan veya galeriden belge seçilebilecek.
- Önizleme ve indirme olacak.
- Yükleyen kullanıcı ve yükleme zamanı korunacak.
- Belge erişimi bağlı olduğu kaydın izinlerine uyacak.
- Firma başına başlangıç kapasitesi 20 GB, dosya başına üst sınır 20 MB, işlem/anlaşma başına en fazla 10 belge olacak. Ürün sahibi kapasiteyi gerektiğinde artırabilecek; paket ve ek alan fiyatı henüz belirlenmedi.
- Belgeler özel dosya depolamasında, ilişki ve dosya bilgileri veritabanında tutulacak.
- Orijinal dosyalar korunacak; hızlı görüntüleme için küçük önizleme ayrıca oluşturulabilecek. Kesin biçimler, dönüştürme ve optimizasyon yöntemi teknik aşamada seçilecek.

### 3.11. Saklama ve kapasite yaklaşımı

- Aktif abonelik boyunca kayıt ve belgeleri koruma yaklaşımı kabul edildi.
- Proje tamamlamak veya arşivlemek belgeleri silmeyecek.
- Paketlere depolama kapasitesi dahil edilecek; kullanım ve kalan kapasite gösterilecek.
- Kapasite dolduğunda mevcut belgeler erişilebilir kalacak; ek alan seçeneği olacak.
- Kapasite dolması finansal kayıt girişini durdurmayacak; yalnızca yeni belge yükleme duracak. Arşivlenmiş şantiyelerin belgeleri kapasiteye dahil olacak.
- Hizmet sonu tarihinden itibaren ilk 30 gün görüntüleme/dışa aktarma, toplam 180 gün arşiv saklama olacak. İlk 30 gün 180 güne dahildir; 31–180. günlerde müşteri erişimi kapalı olacak. Bu sürede hizmet tekrar açılırsa geçmişle devam edilecek.
- 180 gün sonunda ürün sahibi yönetim alanından kalıcı silme veya açık süreli arşiv uzatma yapacak; onay olmadan sessiz silme olmayacak. Onay beklerken veri korunacak ve depolama maliyeti devam edecek.
- Gerçek kalıcı silmeden sonra kalan yedek kopyalar en geç sonraki 30 gün içinde saklama döngüsünden çıkarılacak; teknik silme/geri yükleme yöntemi Aşama 4'te doğrulanacak.
- Tek kullanıcı hesabını pasifleştirmek, geçici firma erişim durdurma veya tek kayıt silme firma hizmet sonu sürecini otomatik başlatmayacak.
- Veri çıkışında finansal kayıtlar/anlaşmalar/muhataplar/başlangıçlar ve geçmiş ilişkileri anlaşılır Excel/CSV olarak, orijinal belgeler toplu paket olarak alınabilecek. PDF özet tek başına tam veri çıkışı sayılmayacak.
- Geri alınabilir silinen kayıt geçmişi ve belgeleri firmanın saklama süresince korunacak; geri yükleme için tutulan dosyaların kapasiteye etkisi görünür olacak.
- Sınırsız ve süresiz saklama sözü verilmeyecek.
- Uzun süreli arşiv hizmeti ayrıca fiyatlandırılabilecek; paket ve fiyat henüz belirlenmedi.
- Uzun süre saklama ile silme/bozulmaya karşı yedekleme ayrı ele alınacak.

### 3.12. Telefon ve masaüstü kullanımı

- Günlük kayıt akışları önce telefon kullanımına göre tasarlanacak.
- Telefon ekranlarında büyük işlem butonları, kolay proje seçimi, az alanla kayıt ve okunaklı tutarlar öncelikli olacak.
- Masaüstünde tablolar, filtreler, raporlar ve kullanıcı yönetimi genişletilecek.
- Aynı veriler telefonda kart, masaüstünde tablo gibi farklı görünümlerle sunulabilecek.
- Finansal kurallar ve erişim izinleri cihazdan bağımsız aynı olacak.
- Ana ekrana eklenebilen web uygulaması yaklaşımı teknik aşamada değerlendirilecek; henüz seçilmedi.
- Tam çevrimdışı kayıt sonraki sürüme bırakıldı.
- Kaydın sunucuya ulaşıp ulaşmadığı açık gösterilecek; tekrar deneme çift finansal kayıt oluşturmamalı.
- Yanıt alınamayan gönderim kesin başarısız sayılmayacak; bağlantı dönünce sonucu doğrulanacak. Kesin toplamlar yalnızca doğrulanmış finansal kayıtlardan oluşacak.
- Finansal kayıt ve belge yükleme durumu ayrı gösterilecek. Belge hatasında yalnızca belge yeniden denenecek; başarılı finansal kayıt tekrar oluşturulmayacak.
- Bağlantı kesildiğinde açık formdaki bilgiler korunacak; taslak toplamları etkilemeyecek. Tarayıcı kapandıktan sonra kalıcı taslak saklama sonraki sürüme bırakıldı.
- Aynı kayıt başka kullanıcı tarafından değiştirilmişse önceki bilgiler sessizce üzerine yazılmayacak; güncel bilgi kullanıcıya gösterilecek.

### 3.13. Demo ve müşterinin kullanıma başlaması

Kullanıcının kabul ettiği/istediği model:

- Giriş ekranında gerçek müşteri girişi ve demo erişimi bulunacak.
- Demo herkesin ürün içinde gezinebileceği ve işlemleri deneyebileceği bir alan olacak.
- Demoya erişmek için kişisel müşteri hesabı oluşturmak gerekmeyecek; demo hiçbir gerçek kullanıcıya veya müşteri firmasına ait olmayacak.
- Demoda yapay şantiye, kişi/firma, anlaşma ve finansal hareketler kullanılacak; gerçek müşteri verisi kullanılmayacak.
- Satış sonrası ürün sahibi ilgili firma alanını ve kullanıcı hesabını/hesaplarını oluşturacak, giriş bilgilerini müşteriye verecek.
- Gerçek firma kendi kayıtlarıyla çalışmaya başlayacak; demo kayıtları firmanın finansal geçmişine eklenmeyecek.
- Otomatik üyelik, kendi kendine firma açma veya çevrimiçi ödeme ile otomatik hesap açılışı ilk sürümde olmayacak.

Demo değişikliklerinin ziyaretçiler arasında ayrılması, sıfırlama, örnek belge kullanımı, kişisel giriş ve ilk giriş şifre değişimi kabul edildi; 7.5 bölümünde kaydedildi. Teknik yöntem ve geçici demo saklama süresi ayrıca belirlenecek.

## 4. Belge depolaması için ön maliyet araştırması

Araştırma tarihi: 4 Ekim 2026. Bu bölüm teknoloji seçimi veya on yıllık fiyat garantisi değildir.

Resmi fiyat kaynakları:

- [Cloudflare R2 Standard fiyatları](https://developers.cloudflare.com/r2/pricing/): 0,015 USD / GB-ay. Doğrudan dışarı veri aktarımı ücretsiz; dosya işlemleri ayrıca fiyatlandırılıyor.
- [Backblaze B2 fiyatları](https://www.backblaze.com/cloud-storage/pricing): 6,95 USD / TB-ay. Ortalama aylık depolamanın üç katına kadar dışarı veri aktarımı ücretsiz; üzeri için ek ücret uygulanabiliyor.

Varsayımlar: 100 firma başlangıçtan itibaren 10 yıl kullanıyor; yılda 365 gün belge yüklüyor; belge silinmiyor. Ondalık MB/GB/TB dönüşümleriyle yaklaşık hesap yapılmıştır.

| Firma başına kullanım | 10 yıl sonunda toplam veri | R2 aylık saklama | B2 aylık saklama |
|---|---:|---:|---:|
| Günde 5 belge, ortalama 0,5 MB | 0,91 TB | Yaklaşık 14 USD | Yaklaşık 6 USD |
| Günde 10 belge, ortalama 1 MB | 3,65 TB | Yaklaşık 55 USD | Yaklaşık 25 USD |
| Günde 20 belge, ortalama 2 MB | 14,6 TB | Yaklaşık 219 USD | Yaklaşık 101 USD |

Bu tutarlar onuncu yıl sonunda birikmiş dosyaların bir aylık saklama tahminidir; on yıllık toplam maliyet değildir. Ücretsiz kullanım hakları hesaba katılmadı. Yedekler, sürümler, önizlemeler, dosya işlemleri, görsel işleme, sunucu, veritabanı ve vergiler dahil değil. Sağlayıcıların fiyatları ve faturalama koşulları değişebilir.

Sonuç: Belge özelliği değerlendirilebilir. Ortalama dosya boyutu, kopya/yedek sayısı, müşteri büyümesi ve abonelik sonrası saklama politikası teknik maliyet planında birlikte hesaplanmalı.

## 5. Aşama planı ve mevcut durum

| Aşama | Çıktı | Durum |
|---|---|---|
| 0 — Ürün yönü ve kapsam değerlendirmesi | Kabul edilen yaklaşımlar ve açık konular | Tamamlandı; bu belgeye kaydedildi |
| 1 — Kullanım senaryoları ve finansal kurallar | Yedi senaryo ve dört finansal istisnanın kuralları | Tamamlandı; 5 Ekim 2026 |
| 2 — İlk sürüm kapsamı | Kapsam, demo/hesap modeli, eşit firma yetkisi, belge limitleri, saklama/çıkış kuralları | Tamamlandı; 5 Ekim 2026 |
| 3 — Ekranlar ve kullanıcı akışları | Telefon ve masaüstü ekranları, alanlar ve işlemler | Tamamlandı; 5 Ekim 2026 |
| 4 — Teknik plan | Veri modeli, teknoloji, firma ayrımı, izinler, depolama, yedekleme, test ve maliyet | Tamamlandı; 11 Ekim 2026 itibarıyla teknik plan yerine uygulama promptu esas (bölüm 9) |
| 5 — Geliştirme ve pilot planı | Uygulama sırası, doğrulama ve gerçek kullanıcı pilotu | Geliştirme planı kabul edildi; 11 Ekim 2026 (bölüm 10). Adım 0 (proje iskeleti) tamamlandı; 12 Ekim 2026 (bölüm 10.5). Adım 1 (finans çekirdeği) tamamlandı; 12 Ekim 2026 (bölüm 10.6). Adım 2 (API temeli) tamamlandı; 12 Ekim 2026 (bölüm 10.7). Adım 3 (finans API'si) tamamlandı; 12 Ekim 2026 (bölüm 10.8). Adım 4 (uygulama ekranları) tamamlandı; 13 Ekim 2026 (bölüm 10.9). Adım 4b-1 (görsel revizyon: temel) tamamlandı; 14 Ekim 2026 (bölüm 10.11). Adım 4b-2 (görsel revizyon: kalan ekranlar) tamamlandı; 14 Ekim 2026 (bölüm 10.12). Adım 5a (belge API'si ve depolama) tamamlandı; 14 Ekim 2026 (bölüm 10.13). Adım 5b (belge ekranları) tamamlandı; 15 Ekim 2026 (bölüm 10.14). Adım 6a (standart raporlar ve filtreli dışa aktarma) tamamlandı; 15 Ekim 2026 (bölüm 10.16). Adım 6b (tam firma veri çıkışı) tamamlandı; 16 Ekim 2026 (bölüm 10.17). Adım 7a (yönetim API'si ve tek hazır paket düzeltmesi) tamamlandı; 16 Ekim 2026 (bölüm 10.19). Adım 7b (yönetim ekranları) tamamlandı; 16 Ekim 2026 (bölüm 10.21). Pilot planı bekliyor |

## 6. Aşama 1 — Kabul edilen senaryolar ve finansal kurallar

Yedi temel senaryo ve dört finansal istisnanın iş kuralları kullanıcı tarafından kabul edildi. Sonraki kapsam kararlarıyla avans ertelendi ve müşteri firma kullanıcıları eşit yetkili olarak seçildi. Ekranlar ve teknik uygulama sonraki aşamalara ayrıldı.

5 Ekim 2026 kapsam değişikliği: Avansın hesaplama ilkesi geçmiş karar olarak korunuyor, ancak özel avans özelliği şimdilik yapılmayacak. Mevcut anlaşmanın kısmi ödemesi bu ertelemeden etkilenmez.

1. Taşeron anlaşması, kısmi ödeme, ek iş ve son ödeme.
2. Müşteri anlaşması, kısmi tahsilat ve gecikmiş alacak.
3. Aynı kişi/firma ile iki şantiyede ayrı anlaşmalar.
4. Yanlış para hareketinin düzeltilmesi veya geri alınması.
5. Şantiyenin tamamlanmasından sonra son ödeme veya tahsilat.
6. Genel firma gideri kaydı.
7. Telefon üzerinden belge yüklerken veya kayıt yaparken bağlantı kesilmesi.

### 6.1. Senaryo 1 — Taşeron anlaşması, kısmi ödeme, ek iş ve son ödeme

Bu tablo kabul edilen temel finansal yaklaşımın örneğidir. Açılış borcu, iade, fazla ödeme veya başka hareket olmadığı varsayılmıştır.

| Olay | Güncel anlaşma | Birikmiş gerçekleşen gider | Kalan borç |
|---|---:|---:|---:|
| Taşeronla anlaşma oluşturuldu | 120.000 TL | 0 TL | 120.000 TL |
| Anlaşmaya bağlı 45.000 TL kısmi ödeme yapıldı | 120.000 TL | 45.000 TL | 75.000 TL |
| Aynı işin bedeline 20.000 TL ek iş eklendi | 140.000 TL | 45.000 TL | 95.000 TL |
| Anlaşmaya bağlı 95.000 TL son ödeme yapıldı | 140.000 TL | 140.000 TL | 0 TL |

- Kısmi ödeme ilgili anlaşmaya yapılan gerçek para çıkışıdır; giderde bir kez sayılır. Ayrı avans kaydı gerektirmez.
- Ek iş, bu örnekte aynı anlaşmanın bedelini artırır. Ayrı bir iş için yeni anlaşma oluşturulabilir.
- Bedel artışı tek başına yeni bir para çıkışı oluşturmaz.
- İlk bedel ve 20.000 TL artışın gerekçesi geçmişte korunur.
- Son ödeme sonrası kalan borç sıfırdır. İşin durumu ile ödeme durumu ayrı tutulur; ödeme durumunu para hareketleri belirler.

Kabul edilen ek kurallar:

1. İşin tamamlanması kalan borcu sıfırlamaz. İş devam ederken bedelin tamamı ödenebilir; iş tamamlanırken borç kalabilir.
2. Kullanıcı ek işi mevcut anlaşma bedeline ekleyebilir veya ayrı iş için yeni anlaşma oluşturabilir. Bedel değişikliği gerekçesi ve geçmişi korunur.
3. 45.000 TL ödeme sonrası anlaşma bedeli 40.000 TL'ye düşerse gerçekleşen gider 45.000 TL, kalan borç 0 TL ve fazla ödeme 5.000 TL gösterilir. İade veya başka işe aktarma ayrıca kaydedilir; sistem para geri gelmiş gibi davranmaz.

Durum: Bu örneğin temel akışı ve yukarıdaki üç ek kural kullanıcı tarafından kabul edildi. Temel iade sınırları 6.8'de kabul edildi. Özel avans özelliği sonraki kapsam kararıyla ertelendi. Firma kullanıcıları eşit yetkili seçildi. Aktarma özelliğinin kapsamı ve uygulama ayrıntıları sonraki aşamalara ayrıldı.

### 6.2. Senaryo 2 — Kısmi tahsilat ve gecikmiş alacak

Bu senaryonun aşağıdaki kuralları kullanıcı tarafından kabul edildi. Örnekte 800.000 TL tutarlı bir tahsil edilecek anlaşma, kalan tutarın tamamına uygulanacak tek vade ve başka hareket olmadığı varsayılmıştır. İlk sürümde tek vade seçildi; taksitli plan sonraki sürüme bırakıldı.

| Olay | Anlaşma bedeli | Toplam tahsil edilen | Kalan alacak | Vadesi geçmiş alacak |
|---|---:|---:|---:|---:|
| Anlaşma oluşturuldu; vade henüz gelmedi | 800.000 TL | 0 TL | 800.000 TL | 0 TL |
| Vade öncesi 300.000 TL tahsil edildi | 800.000 TL | 300.000 TL | 500.000 TL | 0 TL |
| Kalan tutarın vade günü geçti | 800.000 TL | 300.000 TL | 500.000 TL | 500.000 TL |
| Vade sonrası 200.000 TL daha tahsil edildi | 800.000 TL | 500.000 TL | 300.000 TL | 300.000 TL |

Kabul edilen temel yaklaşımdan gelen sonuçlar: Anlaşma oluşturmak gerçekleşen geliri artırmaz. Tahsil edilen para gelir toplamında bir kez sayılır. Kalan alacak ile tahsil edilmiş gelir ayrı görünür.

Kabul edilen kurallar:

1. Vade tarihi isteğe bağlı olsun. Vade olmayan kayıtta kalan alacak görülsün; kayıt gecikmiş sayılmasın. Tek vade varsa gecikme, vade gününün geçmesi ve kalan tutarın pozitif olmasıyla belirlensin.
2. Kısmi tahsilat vadesi geçmiş tutarı azaltsın; kalan kısmın vadesini otomatik ertelemesin. Taksitli plan seçilirse yalnızca vadesi geçmiş taksitlerin açık kısmı gecikmiş sayılsın.
3. Vade değiştirme gerekçe, eski/yeni tarih, kullanıcı ve zamanla kaydedilsin. Gecikme kendi başına anlaşma bedelini veya gerçekleşen geliri artırmasın; otomatik faiz/ceza hesaplaması bu öneriye dahil değil.

Ödeme/tahsilat durumu (örneğin kısmen tahsil edildi), vade göstergesiyle (örneğin gecikmiş) birlikte görünecek. Kesin durum adları ekran tasarımında belirlenecek.

### 6.3. Senaryo 3 — Aynı kişi/firma ile iki şantiyede çalışma

Bu senaryonun aşağıdaki kuralları kullanıcı tarafından kabul edildi. Aynı taşeronla iki şantiyede farklı anlaşmalar yapıldığı varsayılmıştır.

| Şantiye | Anlaşma bedeli | Toplam ödenen | Kalan borç |
|---|---:|---:|---:|
| A şantiyesi | 120.000 TL | 45.000 TL | 75.000 TL |
| B şantiyesi | 80.000 TL | 20.000 TL | 60.000 TL |
| Firma geneli | 200.000 TL | 65.000 TL | 135.000 TL |

Kabul edilen kurallar:

1. Anlaşmaya bağlı ödeme/tahsilatta seçilen anlaşma, şantiye ve kişi/firma birbiriyle uyumlu olmalı. Bir şantiyeye bağlanan tutar diğer şantiyenin bakiyesini kendiliğinden değiştirmemeli. Kayıt ekranında anlaşma adı, şantiye ve kalan tutar görünmeli.
2. Otomatik mahsup yapılmamalı. Örneğin aynı firmadan ayrıca 20.000 TL alacak varsa 135.000 TL borç ve 20.000 TL alacak ayrı korunmalı. Fazla ödeme de başka şantiyenin borcunu kendiliğinden kapatmamalı. Mahsup veya aktarma özelliğinin kapsamı ayrıca belirlenecek.
3. Tek gerçek ödeme birden fazla şantiyeye/anlaşmaya dağıtılacaksa payların toplamı gerçek ödeme tutarına eşit olmalı ve firma toplamında bir kez sayılmalı. Örneğin 40.000 TL ödemenin A'ya 25.000 TL, B'ye 15.000 TL ayrılmasıyla borçlar sırasıyla 50.000 TL ve 45.000 TL olur. 40.000 TL'nin tamamı iki şantiyeye birden yazılamaz. Paylaştırma ilk sürüme alındı; ekran ayrıntıları sonraki aşamada belirlenecek.

İlk sürümde aynı firmanın bütün kullanıcıları bütün şantiyeleri ve firma geneli toplamları görebilecek. İleride şantiye erişim kısıtları eklenirse gizli şantiyelerin bilgileri toplamlar üzerinden de açılmamalı. Başka firmaların kayıtları her durumda ayrılacak.

### 6.4. Senaryo 4 — Yanlış kayıt, silme, geri yükleme ve gerçek iade

Bu senaryonun aşağıdaki kuralları kullanıcı tarafından kabul edildi. Örnek: 120.000 TL anlaşmada gerçekte 40.000 TL ödenmiş, ancak sisteme yanlışlıkla 45.000 TL girilmiş. Başka hareket olmadığı varsayılmıştır.

| Olay | Toplamlara dahil ödeme | Kalan borç |
|---|---:|---:|
| Yanlış 45.000 TL kaydı aktif | 45.000 TL | 75.000 TL |
| Kayıt 40.000 TL olarak düzeltildi | 40.000 TL | 80.000 TL |
| Düzeltilmiş kayıt yanlışlıkla silindi | 0 TL | 120.000 TL |
| Silinen kayıt geri yüklendi | 40.000 TL | 80.000 TL |

Kabul edilen kurallar:

1. Yanlış kayıt düzeltildiğinde eski/yeni değerler geçmişte korunmalı; güncel toplamlarda yalnızca geçerli tutar yer almalı. Gerçek iade ise önceki ödemenin tutarını değiştirmek yerine ayrı, ilişkili bir hareket olarak kaydedilmeli. Gerçekte 45.000 TL ödenip 5.000 TL geri geldiyse 45.000 TL ödeme ve 5.000 TL ödeme iadesi ayrı görünmeli; net ödenen 40.000 TL olmalı. Anlaşma bedeli değişmediyse kalan borç 80.000 TL olur. Tahsilat iadesinde aynı yaklaşım ters yönde uygulanmalı. İadeler normal, bağımsız gelir/gider kayıtlarından ayırt edilmeli.
2. Silme kaydı kalıcı yok etmemeli; kayıt aktif toplam ve listelerden çıkarılmalı, geçmişi ve belgeleri geri yükleme için korunmalı. Geri yükleme sırasında güncel ilişkiler ve firma üyeliği kontrol edilmeli; finansal etki yalnızca bir kez uygulanmalı. İade gibi bağlı hareket varsa ana kayıt tek başına silinmemeli; bağımlılıklar birlikte değerlendirilmelidir. Firma kullanıcıları bu işlemlerde eşit yetkili olacak; silinen kayıtların saklama süresi henüz seçilmedi.
3. Yanlış şantiye/anlaşma bağlantısı düzeltilecekse hareket eski bağdan çıkarılıp yeni bağa tutarlı biçimde aktarılmalı. Para miktarı değişmiyorsa firma toplamı değişmemeli; eski/yeni şantiye ve anlaşma bakiyeleri birlikte güncellenmeli. Kısmi güncelleme veya iki yerde birden sayma olmamalı. Paylaştırılmış ya da iade bağlı hareketlerde ilişkiler ayrıca doğrulanmalı.
4. Tutar, işlem tarihi, şantiye, kişi/firma ve anlaşma gibi finansal alanların değişikliği ile silme/geri yüklemede gerekçe istenmeli; kullanıcı ve zaman otomatik tutulmalı. Yalnızca açıklamadaki yazım düzeltmesi için ek gerekçe zorunlu olmayacak; değişiklik geçmişi yine korunmalı. Aynı firmanın bütün kullanıcıları bu işlemleri yapabilecek.

### 6.5. Senaryo 5 — Şantiye tamamlandıktan sonra ödeme ve tahsilat

Bu senaryonun aşağıdaki kuralları kullanıcı tarafından kabul edildi. Şantiyedeki iş bitmiş, 75.000 TL borç ve 100.000 TL alacak açık kalmış varsayılmıştır.

| Olay | İş durumu | Kalan borç | Kalan alacak |
|---|---|---:|---:|
| Şantiye tamamlandı olarak işaretlendi | Tamamlandı | 75.000 TL | 100.000 TL |
| Son 75.000 TL ödeme yapıldı | Tamamlandı | 0 TL | 100.000 TL |
| Son 100.000 TL tahsil edildi | Tamamlandı | 0 TL | 0 TL |

Kabul edilen kurallar:

1. Tamamlanma şantiyedeki işin bitmesini ifade etmeli. Açık borç/alacak varsa tamamlanmadan önce tutarlar gösterilmeli; onayla tamamlamaya izin verilmeli. Tamamlamak finansal kayıtları, vadeleri veya kalan tutarları değiştirmemeli; kalanları kendiliğinden sıfırlamamalı.
2. Tamamlanan projede mevcut borç/alacak için ödeme, tahsilat ve iade kaydedilebilmeli; düzeltmeler yapılabilmeli. Geç ulaşan ve tamamlanan işe ait doğrudan gider gerekçeyle kaydedilebilmeli. Yeni iş veya yeni anlaşma için firma kullanıcısı projeyi gerekçeyle yeniden aktif hale getirebilecek. İlk sürümde bütün firma kullanıcıları eşit yetkili olacak.
3. Tamamlanan/arşivlenen projenin açık borç/alacağı firma geneli toplamlar ile bekleyen/gecikmiş tutar listelerinde görünmeye devam etmeli. Yalnızca aktif şantiye toplamları gösterilen ekranlar kapsamı açıkça belirtmeli. Arşivleme günlük proje listesini sadeleştirmeli; kayıt, belge ve finansal yükümlülükleri silmemeli.
4. Tamamlanma tarihindeki özet o tarihin durumunu göstermeli; sonraki para hareketleri güncel özeti güncellemeli. Dışa aktarılan raporda oluşturulma zamanı ve kapsanan işlem tarihi aralığı bulunmalı. Eski çıktı ile sonraki güncel rapor farklılaşabilir; geçmiş işlemler korunmalı. Kayıt kilitleme ve tamamlanma anında otomatik özet kopyası saklama sonraki sürüme bırakıldı.

### 6.6. Senaryo 6 — Genel firma giderleri

Bu senaryonun aşağıdaki kuralları kullanıcı tarafından kabul edildi. Örnekte iadeler olmadığı ve aşağıdaki tutarların tamamının gerçekten ödendiği varsayılmıştır.

| Kapsam | Gerçekleşen gider |
|---|---:|
| A şantiyesi | 100.000 TL |
| B şantiyesi | 60.000 TL |
| Firma geneli: ödenmiş ofis giderleri | 25.000 TL |
| Firma toplamı | 185.000 TL |

Kabul edilen kurallar:

1. Genel firma gideri kayıt ekranında açık bir kapsam seçeneği olmalı; sahte bir şantiye oluşturmak gerekmemeli. Firma toplamına dahil edilmeli, şantiye toplamlarına kendiliğinden dağıtılmamalı. Kategori, kişi/firma ilişkisi, belge, tarih ve kayıt geçmişi için normal gider mantığı kullanılmalı.
2. Genel firma borcu da gerçekleşen ödeme ile ayrılmalı. Henüz ödenmemiş 30.000 TL ofis kirası firma geneline bağlı ödenecek anlaşma/borç olarak kaydedilebilmeli; gider toplamı 185.000 TL kalırken ilgili kalan borç 30.000 TL gösterilmeli. 10.000 TL ödeme yapıldığında firma toplam gideri 195.000 TL, bu borcun kalan tutarı 20.000 TL olmalı. Bu tutarlar örneğe eklenen kira borcunu ifade eder; başka borçlar olmadığı varsayılmıştır. Başlangıç borçları ayrıca aynı kapsama bağlanabilmeli; yeni ödeme gibi sayılmamalı.
3. Güncel ilk sürüm kararında bütün firma kullanıcıları genel firma kayıtlarını görebilecek ve değiştirebilecek. İleride erişim kısıtları eklenirse genel firma kayıtları ayrı izinle ele alınmalı; arama, rapor, belge ve toplamlar aynı sınıra uymalı.

### 6.7. Senaryo 7 — Telefonda kayıt veya belge yüklerken bağlantı kesilmesi

Bu senaryonun aşağıdaki kuralları kullanıcı tarafından kabul edildi. Örnek: Kullanıcı 10.000 TL gider ve bir dekont fotoğrafı kaydediyor; işlem sırasında internet bağlantısı kesiliyor.

| Durum | Kullanıcıya gösterilecek bilgi | Beklenen davranış |
|---|---|---|
| Kaydın sunucuda oluştuğu doğrulandı | Kayıt kaydedildi | Kesin toplamları bir kez etkiler |
| Gönderim başladı ancak sonuç alınamadı | Kayıt durumu henüz doğrulanamadı | Başarılı/başarısız varsayılmaz; bağlantı dönünce sonucu kontrol edilir |
| Finansal kayıt kaydedildi, belge yüklenemedi | Kayıt kaydedildi; belge yüklenemedi | Yalnızca belge yeniden denenir; finansal kayıt tekrar oluşturulmaz |
| Finansal kayıt gönderilemedi | Kayıt gönderilmedi | Açık formdaki bilgiler korunur; bağlantı sonrası yeniden deneme sunulur |

Kabul edilen kurallar:

1. Kaydetme sonucunu bağlantı hatasından ayırt etmek gerekir. Sunucu onayı gelmeden kesin başarı gösterilmemeli; cevap alınamadığında kayıt kesin başarısız varsayılmamalı. Bağlantı geri geldiğinde işlem sonucu doğrulanmalı. Kesin finansal toplamlar yalnızca doğrulanmış kayıtlardan oluşmalı.
2. Aynı işlemin yeniden denenmesi veya kaydet düğmesine tekrar basılması çift kayıt oluşturmamalı. Teknik planda aynı gönderimin güvenli tekrarını sağlayan bir yöntem tanımlanacak. Kullanıcının bilerek oluşturduğu ayrı ama benzer kayıtlar, mevcut mükerrer kayıt uyarısı kuralıyla ele alınacak.
3. Finansal kaydın ve belge yüklemesinin durumu ayrı gösterilmeli. Belge hatası başarılı finansal kaydı kaybettirmemeli; belge ekleme aynı kayıtta yeniden denenebilmeli. Yüklenmeyen dosya eklenmiş gibi gösterilmemeli. Belge başına yükleme durumu ve tekrar deneme davranışı teknik/ekran planında tanımlanacak.
4. Bağlantı kesildiğinde açık formdaki bilgiler korunmalı ve yeniden deneme sunulmalı; kullanıcıdan bütün bilgileri tekrar girmesi istenmemeli. Taslak, kesinleşmiş finansal kayıt gibi sayılmamalı. Tarayıcı kapandıktan sonra kalıcı taslak saklama ve tam çevrimdışı kayıt sonraki sürüme bırakıldı. Aynı kaydı başka kullanıcı bu sırada değiştirmişse sistem sessizce üzerine yazmamalı; güncel bilgi gösterilerek yeniden değerlendirme istenmeli.

Yedi temel senaryo ve aşağıdaki finansal istisnalar kabul edildi. Aşama 1, 5 Ekim 2026 tarihinde tamamlandı.

### 6.8. Kabul edilen finansal istisnalar

Bu dört kural Aşama 1'de kabul edildi. Daha sonra avans özelliği şimdilik ertelendi; aşağıdaki birinci madde gelecek sürüm için hesaplama ilkesi olarak korunuyor. Diğer üç madde güncel kapsamda.

1. **Anlaşmadan önce avans — ŞİMDİLİK ERTELENDİ:** Anlaşma bedeli henüz belli değilse proje, kişi/firma ve tarih bilgisiyle avans kaydedilebilsin. Gerçek para çıkışı olduğu için giderde bir kez sayılsın; anlaşmaya bağlanmamış avans olarak ayırt edilsin. Sonradan anlaşmaya ilişkilendirildiğinde yeni ödeme/gider oluşturulmasın. Örneğin 10.000 TL avans sonradan 30.000 TL anlaşmaya bağlanırsa gerçekleşen gider 10.000 TL kalır, kalan borç 20.000 TL olur. Aynı ilişkilendirme ilkesi müşteriden önceden alınan avans için ters yönde uygulanır. Bilinmeyen anlaşma bedelinden sahte borç/alacak üretilmez; avans tahsis tutarı ve geçmişi korunur.
2. **Ödemesi bulunan anlaşmanın iptali:** İptal önceki para hareketlerini silmesin ve kalan tutarı gerekçesiz sıfırlamasın. Taraflarla kesinleşen bedel, bedel değişikliği geçmişi korunarak kaydedilsin. Örneğin ilk bedel 120.000 TL, ödenen 45.000 TL ve iptal sonrası kesin bedel 30.000 TL ise kalan borç 0 TL, fazla ödeme 15.000 TL olur. 15.000 TL gerçekten geri alınırsa ayrı iade kaydedilir; net ödenen 30.000 TL olur. Kesin bedel henüz belirlenmediyse hesap kapanmış gibi gösterilmez. Tahsil edilecek anlaşmada bedel düşüşü benzer şekilde müşteriye iade yükümlülüğü/fazla tahsilat doğurabilir.
3. **İade tutar sınırı:** Bir para hareketine bağlı toplam iadeler, o hareketin geçerli tutarını aşamasın. 45.000 TL ödemenin 5.000 TL'si iade edilmişse en fazla 40.000 TL daha ödeme iadesi bağlanabilsin. Daha fazla gerçek para hareketi farklı gerekçe/ilişkiyle ayrıca kaydedilir; aynı ödemenin iadesi olarak gösterilmez. Bağlı iade varken ana ödeme iade toplamının altına düşürülecekse ilişkili kayıtlar tutarlı biçimde düzeltilmeden değişiklik yapılmasın. Bu sınır tahsilat iadeleri için de geçerli olsun.
4. **Eski borç/alacak başlangıcı:** Uygulama öncesinden kalan 75.000 TL borç açılış borcu olarak girilebilsin; yeni gider sayılmasın. Daha sonra 25.000 TL ödeme yapılırsa gerçekleşen yeni gider 25.000 TL, kalan borç 50.000 TL olur. Başlangıç kaydı kişi/firma, şantiye veya firma geneli kapsamı, başlangıç tarihi ve açıklamayla ilişkilendirilsin. Aynı eski yükümlülük hem açılış borcu/alacağı hem geçmiş anlaşma bakiyesi olarak iki kez sayılmasın. Geçmiş eksiksiz aktarılmadıysa proje özetinin bütün proje ömrünü temsil ettiği iddia edilmesin; takip başlangıcı ve geçmiş kapsamı raporda görünür olsun. Açılış alacağı için aynı mantık ters yönde uygulanır.

### 6.9. Kapsam, ekran ve teknik aşamalarına kalan ayrıntılar

- Fazla ödeme/tahsilat uyarısının ekranı; firma kullanıcılarının eşit yetkisi kabul edildi, uyarı ve gerekçe kuralları korunacak.
- Para hareketi paylaştırmanın ekran ayrıntıları; özel avans tahsisi ilk sürümden çıkarıldı.
- Başka işe/şantiyeye aktarma ve mahsup işlemlerinin kapsamı; otomatik mahsup yapılmaması kabul edildi.
- Taksit ve hatırlatma ayrıntıları; temel vade ve kısmi tahsilat kuralları Senaryo 2'de kabul edildi.
- İleride gerekirse ayrıntılı roller ve şantiye erişim kısıtlarının tasarımı; ilk sürümde bütün firma kullanıcıları eşit yetkili.
- Sonraki sürümde kayıt kilitlemenin ayrıntıları; tamamlanma/arşivleme sonrası temel finansal işlemler Senaryo 5'te kabul edildi.
- Sonraki sürümde geçmiş veri/Excel aktarımının ayrıntıları ve doğrulama yöntemi.
- Taslak saklama, belge yükleme tekrarları ve eşzamanlı değişikliklerin teknik uygulaması; temel bağlantı hatası kuralları Senaryo 7'de kabul edildi.

## 7. Aşama 2 — İlk sürüm kapsamı ve açık ayrıntılar

Kullanıcı ilk sürüm/sonraki sürüm/kapsam dışı ayrımını avans hariç kabul etti. Avans çıkarıldı; herkese açık yalıtılmış demo ve ürün sahibinin açtığı müşteri hesapları eklendi. Firma kullanıcıları eşit yetkili seçildi. Belge limitleri ve hizmet sonu saklama süreleri kabul edildi; demo, dosya ve saklama işlemlerinin teknik yöntemi Aşama 4'e ayrıldı. Aşama 2 tamamlandı.

### 7.1. İlk sürüme dahil edilenler

| Alan | Kabul edilen ilk sürüm sınırı |
|---|---|
| Firma ve kullanıcılar | Birbirinden ayrılmış firma hesapları; ürün sahibinin kontrollü hesap açması; giriş/çıkış ve şifre kurtarma. Herkese açık gerçek kullanıcı kaydı yok |
| Demo | Herkese açık, gerçek hesaba ait olmayan, yapay verili gezilebilir/denenebilir ürün alanı |
| Firma erişimi | Aynı firmanın bütün kullanıcıları aynı yetkili; bütün firma şantiyelerine, genel kayıtlarına ve belgelerine erişim. Farklı firmalar ayrılmış; platform hesabı yönetimi ürün sahibinde |
| Şantiyeler | Oluşturma, düzenleme, aktif/tamamlandı durumu, yeniden aktifleştirme ve arşivleme |
| Kişi/firma | Ortak muhatap listesi; proje/anlaşma bazında borç, alacak ve hareket geçmişi |
| Gelir/gider | Hızlı doğrudan kayıt, kategori, tarih, açıklama, şantiye veya firma geneli kapsamı |
| Anlaşmalar | Ödenecek/tahsil edilecek anlaşma; kısmi hareketler, bedel değişikliği, ek iş, iptal ve durum ayrımı |
| Başlangıç kayıtları | Manuel başlangıç borç/alacak girişi. Özel avans kaydı ve sonradan anlaşmaya bağlama ilk sürümde yok |
| İadeler ve paylaştırma | İlişkili ödeme/tahsilat iadesi; tek gerçek hareketi birden fazla anlaşma/şantiyeye tutarı koruyarak paylaştırma |
| Vade | İsteğe bağlı tek vade; kalan, yaklaşan ve gecikmiş tutarlar. Taksit planı sonraki sürüm |
| Belgeler | PDF/fotoğraf ekleme, kameradan seçim, önizleme/indirme, özel erişim, boyut ve kapasite sınırı |
| Özet ve arama | Firma/şantiye özetleri, borç/alacak listeleri; kişi/proje/açıklama araması, tarih/tutar/tür/kullanıcı filtreleri |
| Raporlar | Standart proje özeti ve kişi/firma dökümü; Excel/CSV ve basit PDF dışa aktarma |
| Kayıt güvenliği ve işletim | Değişiklik geçmişi, gerekçeli düzeltme, geri alınabilir silme, güvenli tekrar, çakışma kontrolü, yedekleme ve geri yüklemenin doğrulanması |
| Telefon ve masaüstü | Telefon odaklı web akışları; masaüstü tablo/filtre/yönetim ekranları. İnternetle kayıt; açık formda hata sonrası bilgileri koruma |

Tek hareketi paylaştırma ilk sürümde olacak; aynı taşerona farklı şantiyeler için tek ödeme yapılmasını tutarlı kaydetmek amacıyla. İlk sürüm paylaştırması, borç-alacak mahsuplaşması veya geçmiş avansı başka işe yeniden tahsis etme özelliğiyle aynı kapsam değil.

### 7.2. Sonraki sürüme bırakılanlar

- Özel avans takibi, anlaşma öncesi avans ve sonradan anlaşmaya bağlama; şimdilik yapılmayacak.
- Yönetici/çalışan/görüntüleyici ayrımı, şantiye bazlı erişim kısıtı ve özel işlem izinleri; ihtiyaç oluşursa sonraki sürümde.
- Taksitli ödeme/tahsilat planları.
- E-posta, SMS veya telefon bildirimiyle vade hatırlatma; ilk sürümde uygulama içi vade listeleri olacak.
- Excel içe aktarma; ilk sürümde manuel başlangıç borç/alacak girişi olacak. İlk müşterideki veri hacmi bunu yeniden değerlendirmeyi gerektirebilir.
- Tam çevrimdışı finansal kayıt, bağlantı dönünce otomatik senkronizasyon ve tarayıcı kapandıktan sonra kalıcı taslak saklama.
- Kesin hesap kilidi ve tamamlanma anında otomatik özet kopyası saklama.
- Borç-alacak mahsuplaştırma ve geçmiş avansı/fazla ödemeyi başka işe aktarma için özel iş akışı.
- Genel firma giderlerini şantiyelere dağıtma.
- Ayrıntılı grafikler, özel rapor tasarlama ve gelişmiş kişiselleştirme.
- Otomatik abonelik tahsilatı; ilk müşteriler için satış ve tahsilat dışarıdan yönetilebilir. Paket, kapasite ve erişim durumları yine tanımlanmalı.

### 7.3. Mevcut ürün kapsamının dışında tutulanlar

- Banka/kredi kartı entegrasyonu, kasa ve hesap bakiyesi mutabakatı.
- Çek/senet, çoklu para birimi ve döviz kuru takibi.
- E-fatura, vergi muhasebesi ve resmi muhasebe süreçleri.
- Belgeden otomatik veri çıkarma, OCR ve yapay zekâ özellikleri.
- Ayrı iOS/Android uygulaması ve mağaza dağıtımı; ihtiyaç ayrıca değerlendirilene kadar telefon odaklı web kullanılacak.

### 7.4. Aşama 2 kapanışı ve sonraki aşamalara ayrılan işler

1. Ana kapsam ve demo/ürün sahibinin hesap açma yaklaşımı kabul edildi; teknik uygulama Aşama 4'te seçilecek.
2. Firma içi eşit yetki kabul edildi. Ürün sahibinin platform hesabı işlemleri müşteri firma işlemlerinden ayrı kalacak.
3. Tek vade ve paylaştırma ilk sürümde, Excel aktarımı sonraki sürümde olacak; ilk müşteri ihtiyaçları pilotta doğrulanacak.
4. 20 GB/20 MB/10 belge sınırları ve orijinal koruma kabul edildi. Kesin dosya biçimleri/dönüştürme ve kapasite hesabı Aşama 4'te tanımlanacak.
5. Manuel firma/kullanıcı hesabı açma, kişisel hesap, ilk parola değişimi ve hizmet sonu saklama/çıkış kuralları kabul edildi. Ticari ücretler ve teslim yöntemi ayrıca belirlenecek.
6. İlk sürümün temel kabul ölçütleri 7.8'de toplandı. Ekran alanları Aşama 3, teknoloji/ayrıntılı doğrulama Aşama 4, takvim/pilot Aşama 5'te belirlenecek.

Durum: Aşama 2, 5 Ekim 2026 tarihinde tamamlandı. Açık işler kapsamı yeniden belirsiz hale getirmeden ilgili sonraki aşamaya taşındı.

### 7.5. Kabul edilen demo ve kontrollü hesap açılışı kuralları

- Giriş ekranında kullanıcı adı/e-posta ve şifreyle müşteri girişi yanında "Demoyu dene" seçeneği olsun. Demo için ortak müşteri şifresi veya kişisel kayıt gerekmesin.
- Örnek veri kümesi rastgele isimler içerebilir, ancak tutarlar ve ilişkilendirmeler tutarlı olmalı. Aktif/tamamlanan şantiyeler, kısmi ödemeler, borç/alacak ve gecikmiş vadeler ürünün değerini gösterecek şekilde hazırlanmalı.
- Ziyaretçi örnek kayıtları ekleyip düzenleyebilsin; değişiklikleri başka ziyaretçinin ekranını bozmasın. Aynı başlangıç örnekleri ziyaretçi oturumuna kopyalansın veya eşdeğer yalıtılmış geçici veri yaklaşımı kullanılsın. Teknik yöntem henüz seçilmedi.
- "Demoyu sıfırla" işlemi başlangıç örneklerine dönsün. Değişikliklerin geçici olduğu ve gerçek firma verisi girilmemesi gerektiği açıkça gösterilsin. Demo saklama/temizleme süresi henüz seçilmedi.
- Demoda örnek belgeler kullanılacak; gerçek dosya yükleme başlangıçta kapalı olacak. Belge deneyimi örnek belge seçimiyle gösterilecek; demo depolaması kontrol altında tutulacak.
- Ürün sahibi için sınırlı bir işletim alanı olacak: firma oluşturma, kullanıcı oluşturma ve firmaya bağlama, erişimi aktif/pasif yapma ve parola sıfırlama sürecini başlatma. İlk sürümde müşteriye rol veya şantiye erişimi atama ekranı olmayacak. Müşteri firma kullanıcısı firma/kullanıcı hesabı açamayacak veya başka firmaya erişemeyecek.
- Her gerçek kullanıcı kişisel giriş bilgisi kullansın; bir firmadaki çalışanlar ortak hesap paylaşmasın. Böylece kaydı oluşturan kişi takip edilebilsin.
- Ürün sahibinin verdiği ilk parola geçici olsun; ilk girişte değiştirme istensin. Parola görüntüleme yerine sıfırlama akışı kullanılsın. Kesin giriş kimliği ve teslim yöntemi ayrıca seçilecek; bu planlama sırasında hesap açma veya giriş bilgisi gönderme yapılmıyor.
- Gerçek firma alanı demo verileri taşınmadan başlasın. Müşteri kendi şantiyelerini, muhataplarını ve başlangıç borç/alacaklarını eklesin.

### 7.6. Kabul edilen başlangıç belge limitleri

- Firma başına başlangıç belge kapasitesi: 20 GB; ihtiyaç olursa ürün sahibi artırabilecek. Paket/ek alan fiyatı henüz belirlenmedi.
- Dosya başına üst sınır: 20 MB.
- İşlem veya anlaşma başına en fazla 10 belge.
- PDF ve yaygın telefon fotoğraf biçimleri desteklensin; kesin biçimler ve gerekiyorsa dönüştürme yöntemi teknik aşamada seçilsin.
- Yüklenen orijinal belge korunsun; hızlı görüntüleme için küçük önizleme ayrıca oluşturulabilsin. Orijinal dosyayı önizlemeyle değiştirerek okunaklılık kaybı yaratılmasın.
- Arşivlenen şantiyelerin belgeleri kapasiteye dahil olsun; arşivlemek dosyayı silmesin.
- Kapasite dolduğunda yeni belge yükleme durdurulsun; finansal kayıt oluşturma ve mevcut belge görüntüleme/indirme devam etsin.
- Kullanım hesabında orijinal, önizleme ve geri yüklenebilir silinmiş dosyaların nasıl sayılacağı teknik/işletim planında açıkça tanımlansın. Yedek maliyeti ayrıca hesaplansın.

Bu miktarlar başlangıç ürün sınırları olarak kullanıcı tarafından kabul edildi; gerçek müşteri kullanımıyla doğrulanacak. Satış paketi veya ek alan fiyatı henüz belirlenmedi.

### 7.7. Kabul edilen hizmet sonu erişim ve saklama kuralları

Bu politika kullanıcı tarafından kabul edildi. Süreler firmanın hizmetinin açıkça sona erdirildiği tarihten hesaplanacak. Bir kullanıcının hesabını pasifleştirmek veya firmanın erişimini geçici askıya almak hizmet sonu ve silme sürecini otomatik başlatmayacak.

1. **Aktif hizmet:** Firma aktif kaldığı sürece kayıtlar/belgeler kapasite kapsamında korunsun. Şantiye tamamlama/arşivleme silme başlatmasın. Hizmet 10 yıl devam ederse geçmiş kayıtlar 10 yıl erişilebilir olsun; abonelik sonrası ücretsiz süresiz saklama sözü verilmesin.
2. **İlk 30 gün:** Hizmet sonlandırıldıktan sonra firma kullanıcıları yalnızca görüntüleme, rapor ve dışa aktarma yapabilsin. Yeni finansal kayıt, düzenleme/silme/geri yükleme veya belge yükleme kapansın. Kullanıcının kişisel parola/profil güvenlik işlemleri erişim ihtiyacı ölçüsünde devam etsin.
3. **Toplam 180 gün:** Veriler hizmet sonu tarihinden itibaren toplam 180 gün saklansın; ilk 30 gün bu sürenin içinde olsun. 31–180. günlerde müşteri erişimi kapansın, veriler arşivde kalsın. Hizmet bu süre içinde yeniden açılırsa firma kendi geçmişiyle devam edebilsin.
4. **Silme süreci:** 180 gün sonunda kalıcı silme, ürün sahibinin yönetim alanında görünür bir işlem olsun; ürün sahibi onayı olmadan sessizce silinmesin. Müşteriye süreler baştan bildirilsin; yönetim alanında yaklaşan saklama bitişi ve silme onayı bekleyen firmalar görünsün. Arşiv hizmeti uzatılacaksa açık bir yeni saklama tarihi tanımlansın; onay bekleyen süre boyunca veri korunmaya ve maliyet oluşturmaya devam eder. Ana sistemden kalıcı silme gerçekleştiğinde kalan yedek kopyalar en geç sonraki 30 gün içinde saklama döngüsünden çıkarılsın; geri yükleme silinmiş firmayı yeniden erişime açmamalı. Teknik yöntem Aşama 4'te doğrulanacak.
5. **Veri çıkışı ve geri alınabilir silme:** Firma finansal kayıtları/anlaşmaları/muhatapları/başlangıçlarını ve kayıt geçmişini ilişkileri anlaşılabilir Excel/CSV çıktılarıyla, orijinal belgeleri toplu indirilebilir paketle alabilsin. PDF özet tek başına bütün veri çıkışı sayılmasın. Aktif hizmette kullanıcı tarafından silinen finansal kayıtların geçmişi ve geri yüklenebilir belgeleri firmanın saklama süresince korunsun; geri yükleme için tutulan dosyalar kullanım hesabında görünür olsun. Tek bir finansal kaydı silmek bütün firma için hizmet sonu sürecini başlatmasın.

180 gün otomatik ve garantili silme tarihi olarak sunulmamalı: bu politikada ürün sahibi onayı beklenir. Saklama bitişi ve gerçek kalıcı silme tarihi kullanıcıya/işletim alanına açık biçimde ayrılmalı. Bu görüşme kapsamında gerçek veri silme veya müşteri bildirimi yapılmıyor.

### 7.8. İlk sürümün temel kabul ölçütleri

Bu ölçütler kabul edilen kuralların doğrulanabilir özetidir; yazılımın geliştirildiği veya test edildiği anlamına gelmez.

1. 120.000 TL ödeme anlaşmasına 45.000 TL ödeme kaydı, gideri yalnızca 45.000 TL artırır ve kalan borcu 75.000 TL gösterir. Gelir/tahsilat tarafı aynı ilkeyi ters yönde uygular.
2. Aynı firmanın iki kullanıcısı aynı verilere ve işlem yetkisine sahiptir; işlemi oluşturan/değiştiren kullanıcı ayrı kaydedilir. Başka firma verisi, belge, arama sonucu veya raporu açılmaz.
3. Düzeltme, iade, silme/geri yükleme ve paylaştırma kabul edilen bakiye kurallarını korur; gerekçe/geçmiş kaybolmaz, aynı gerçek hareket çift sayılmaz.
4. Bağlantı hatası veya tekrar deneme çift kayıt üretmez. Kaydetme sonucu belirsizse doğrulanır. Belge yükleme hatası başarılı finansal kaydı tekrar oluşturmaz.
5. Kapasite dolunca yeni belge yükleme durur; finansal kayıt ve mevcut belgelere erişim sürer. Orijinal belgeler korunur; 20 MB ve 10 belge sınırları uygulanır.
6. Bir demo ziyaretçisinin değişikliği diğer ziyaretçiyi veya gerçek firmayı etkilemez. Demo sıfırlanabilir; gerçek dosya yükleme yerine örnek belge kullanılır.
7. Tamamlanan/arşivlenen projelerin açık borç/alacakları firma özetinden kaybolmaz. Proje tamamlamak veya kullanıcı hesabını pasifleştirmek veri silmez.
8. Hizmet sonu ilk 30 gün yalnızca görüntüleme/dışa aktarma, 31–180. gün arşiv saklama ve kapalı müşteri erişimi uygulanır. Ürün sahibi onayı olmadan kalıcı silme yapılmaz. Tekrar açılış ve gerçek silme sonrası yedekten çıkarma kuralları doğrulanır.

## 8. Aşama 3 — Sayfalar ve kullanım akışları

Sayfa haritası, gezinme, formlar, finansal işlem akışları, arama/rapor/veri çıkışı, hata/durum ekranları ve ürün sahibi yönetimi kullanıcı tarafından kabul edildi. Aşama 3, 5 Ekim 2026 tarihinde tamamlandı. Görsel tasarım, kod veya çalışan uygulama oluşturulmadı. Kullanıcının isteğiyle teknik altyapı planlamasına henüz geçilmiyor.

### 8.1. Ana gezinme

- Telefonda alt menü: Özet, Şantiyeler, İşlemler, Kişi/Firmalar, Diğer.
- Masaüstünde aynı ana alanlar sol menüde; işlemler geniş tablo ve filtrelerle.
- Diğer alanından anlaşma listesi, raporlar, profil/ayarlar, depolama ve silinen kayıtlara erişim.
- Gelir/gider ekleme ana alanlardan kolay erişilen ortak bir işlem olsun. Telefonda iki ayrı hızlı buton veya tek ekleme menüsü yaklaşımı ekran tasarımında seçilecek.
- Ürün sahibinin firma/kullanıcı hesap yönetimi ayrı bir işletim alanı olsun; müşteri menüsünde hesap açma ekranı bulunmasın.

### 8.2. Sayfa haritası

| Sayfa/alan | Amaç ve gösterilecek ana bilgiler |
|---|---|
| Giriş, demo, ilk parola değişimi | Kullanıcı adı/parola ile müşteri girişi; hesapsız demo; geçici parola sonrası kişisel parola oluşturma; ürün sahibi aracılığıyla manuel parola kurtarma |
| Özet | Tahsilat, ödeme, gelir–gider farkı, kalan borç/alacak, yaklaşan/gecikmiş tutarlar, son hareketler ve hızlı kayıt |
| Şantiye listesi | Aktif/tamamlanan/arşivlenen projeler, arama, durum ve temel finansal özet |
| Şantiye detayı | Proje özeti, gelir/gider hareketleri, anlaşmalar, kalan borç/alacak, proje durumu ve rapor erişimi |
| İşlem listesi | Firma genelindeki hareketler; proje veya firma geneli, tür, tarih, tutar, kişi/firma ve kullanıcı filtreleri |
| Hızlı gelir/gider formu | Az alanla doğrudan hareket veya seçilen anlaşmaya bağlı ödeme/tahsilat; alan kuralları 8.5'te kabul edildi |
| İşlem detayı | Tutar/tarih/kapsam/muhatap/anlaşma, kayıt kullanıcısı, belgeler, geçmiş, düzeltme, iade ve geri alınabilir silme |
| Kişi/firma listesi ve detayı | Arama, ayrı borç/alacak, şantiye ve anlaşma dağılımı, hareket geçmişi ve ilgili anlaşmaya ödeme/tahsilat |
| Anlaşma listesi ve detayı | Ödenecek/tahsil edilecek bedel, net ödenen/tahsil edilen, kalan, vade, iş/ödeme durumu, bedel geçmişi, iptal ve yeni hareket |
| Raporlar ve veri çıkışı | Standart şantiye/muhatap dökümleri, Excel/CSV/PDF; bütün firma verisini ve belgeleri dışa alma |
| Profil, firma bilgisi ve depolama | Kişisel profil/parola, ortak firma görünen adı ve iletişim bilgileri, kullanım/kapasite, hizmet durumu; düzenleme sınırları 8.10'da kabul edildi |
| Silinen kayıtlar | Geri alınabilir kayıtları inceleme, ilişkileri doğrulayarak gerekçeli geri yükleme |
| Ürün sahibi işletim alanı | Firma/kullanıcı oluşturma ve erişim yönetimi, kapasite artırma, hizmet sonlandırma/arşiv uzatma/silme onayı |

Belgeler ilgili işlem/anlaşma detayında yer alacak; ilk sürüm için ayrı bir genel belge yönetim sistemi önerilmiyor.

### 8.3. Kabul edilen bağlam ve hızlı kayıt yaklaşımı

1. Şantiye içinden kayıt açılırsa o şantiye hazır seçilsin; seçim görünür olsun.
2. Anlaşma içinden ödeme/tahsilat açılırsa kişi/firma, şantiye/firma geneli ve anlaşma hazır seçilsin; kalan tutar gösterilsin.
3. Firma özetinden açılan kayıtta kullanıcıya şantiye veya firma geneli kapsamı açıkça gösterilsin. Son kullanılan seçim önerilebilir; kullanıcıdan gizli seçim yapılmasın.
4. Tarih bugün olarak gelsin, tutar girişi telefonda uygun sayısal girişle çalışsın. Açıklama ve belge ekleme hızlı kayıt akışını gereksiz uzatmasın.
5. Demo ve hizmet sonu görüntüleme dönemi belirgin durum bilgisi taşısın. Kullanıcı yapamadığı işlemin nedenini görebilsin.

### 8.4. Aşama 3 tamamlanma kontrolü

- Sayfa haritası, gezinme ve bağlama göre hızlı kayıt kabul edildi.
- Hızlı gelir/gider, anlaşma, kişi/firma, proje ve başlangıç borç/alacak formlarının alanları kabul edildi.
- Ödeme paylaştırma, iade, finansal düzeltme, bedel değişikliği, iptal ve silme/geri yükleme ekran akışları kabul edildi.
- Arama, filtre, rapor ve veri çıkışı davranışları kabul edildi.
- Boş/yükleniyor/hata/belirsiz kayıt/belge hatası, kapasite dolu, demo ve yalnızca görüntüleme durumları kabul edildi.
- Ürün sahibi firma/kullanıcı/hizmet yönetimi, giriş ve profil ayrıntıları kabul edildi.

Bu aşamanın planlanan bütün başlıkları tamamlandı. Teknik plan ve geliştirme/pilot planı sonraki aşamalar olarak bekliyor; teknik altyapıya kullanıcı yeniden devam edilmesini isteyene kadar geçilmeyecek.

### 8.5. Kabul edilen gelir/gider formu alanları ve davranışları

Bu form ve davranışları kullanıcı tarafından kabul edildi. Aynı temel form doğrudan gelir/gider ile anlaşmaya bağlı ödeme/tahsilatı destekleyecek.

| Alan | Kabul edilen zorunluluk | Davranış |
|---|---|---|
| İşlem türü | Zorunlu; açılan eylemden hazır | Gelir/tahsilat veya gider/ödeme yönü görünür |
| Şantiye veya firma geneli | Zorunlu; bağlama göre hazır olabilir | Seçim açıkça gösterilir; yanlış şantiyeye gizli kayıt yapılmaz |
| Tutar | Zorunlu | Pozitif TL tutarı, en fazla iki ondalık basamak; tutar boş başlar |
| İşlem tarihi | Zorunlu; bugün hazır | Kullanıcı gerçek işlem tarihini değiştirebilir; sisteme kayıt zamanı ayrıca otomatik tutulur |
| Kişi/firma | Doğrudan kayıtta isteğe bağlı | Anlaşmaya bağlı işlemde anlaşmanın muhatabı hazır ve zorunlu; seçili anlaşmayla çelişen muhatap kullanılmaz |
| Gider kategorisi | Giderde isteğe bağlı | Seçilmezse kategorisiz olarak ayırt edilir; sonradan tamamlanabilir |
| Anlaşma | Doğrudan kayıtta isteğe bağlı | Anlaşmaya bağlı ödeme/tahsilatta zorunlu; aynı firma, kapsam, muhatap ve yönle uyumlu olmalı |
| Açıklama | İsteğe bağlı | Hızlı kayıt için zorunlu değil; kritik değişiklik gerekçesiyle aynı alan sayılmaz |
| Belgeler | İsteğe bağlı | Sonradan da eklenebilir; dosya hatası başarılı finansal kaydı tekrar oluşturmaz |
| Kaydı oluşturan kullanıcı/zaman | Otomatik | Kullanıcı elle başka bir kaydı oluşturan kişi seçmez |

Kabul edilen akış ve kontroller:

1. Doğrudan küçük harcamada muhatap veya kategori bilinmiyorsa kayıt yapılabilsin; eksik alanlar ilgili listelerde görünür olsun. Kişi/firma seçimi borç/alacak bağlantısının yerine geçmesin.
2. Seçilen muhatabın aynı kapsamdaki uygun anlaşmaları önerilebilsin; otomatik bağlanmasın. Anlaşmaya bağlanmamış doğrudan hareket, muhatabın geçmişinde görünür ancak mevcut anlaşmaların kalanını kendiliğinden azaltmaz. Açık anlaşma varsa bu etki kullanıcıya açık belirtilsin.
3. Anlaşma ekranından gelen kayıtta muhatap, kapsam ve anlaşma hazır olsun; kalan tutar görünür olsun. Tutar kalan bedelle otomatik doldurulmasın. Kalanın tamamını kaydetmek için açık bir seçim sunulabilir; fazla ödeme/tahsilat uyarıları korunur.
4. Kayıt formundan yeni kişi/firma ekleme gerekirse girilmiş tutar, tarih ve kapsam kaybolmadan aynı akışta yapılabilsin. Kişi/firma formunun alanları 8.6'da kabul edildi.
5. "Kaydet" başarılı olduğunda başlangıç listesi/detayına dönülsün. "Kaydet ve yeni ekle" seçeneğinde yeni tutar boşalsın; kapsam/tarih korunabilsin, muhatap/anlaşma bağlantısı görünür biçimde yeniden değerlendirilsin. Başarı doğrulanmadan yeni kayıt varmış gibi davranılmasın.
6. Sıfır/negatif tutar normal gelir/gider formunda kabul edilmesin; gerçek iadeler ilgili iade akışından pozitif iade tutarıyla kaydedilsin. Belge limitleri veya kapasite dolması finansal kaydı engellemesin.

### 8.6. Kabul edilen şantiye, kişi/firma, anlaşma ve başlangıç formları

Bu dört form kullanıcı tarafından kabul edildi.

#### Şantiye oluşturma

- Zorunlu: şantiye/proje adı.
- İsteğe bağlı: açıklama, adres/konum metni ve gerçek başlangıç tarihi.
- Durum başlangıçta aktif olsun. İş tamamlanırken tamamlanma tarihi bugün olarak önerilsin; kullanıcı gerçek tarihi değiştirebilsin.
- Başlangıç tarihi bilinmiyorsa bugünü gerçek başlangıç gibi zorunlu yazmayalım. Sisteme oluşturma zamanı otomatik tutulur.
- Benzer proje adı uyarı verebilir; benzer isimli meşru projeler otomatik engellenmesin.

#### Kişi/firma oluşturma

- Zorunlu: ad veya firma unvanı.
- İsteğe bağlı: kişi/firma tercihi, telefon, e-posta, adres ve not.
- Tedarikçi/taşeron/müşteri gibi etiketler isteğe bağlı ve birden fazla seçilebilir olsun; aynı muhatap birden fazla işleve sahip olabilir.
- Para hareketi veya anlaşma formundan hızlı eklemede yalnızca ad/unvanla kayıt oluşturulabilsin; önceki formun tutarı/tarihi/kapsamı kaybolmasın.
- Benzer adlar önerilsin; aynı kişinin yeniden açılması azaltılsın. Aynı adlı farklı kişiler olabileceği için yalnızca isim eşitliğiyle kayıt zorla birleştirilmesin.

#### Anlaşma oluşturma

- Zorunlu: anlaşma adı (örneğin "Elektrik işi"), yön (ödenecek/tahsil edilecek), şantiye veya firma geneli, kişi/firma ve toplam bedel.
- İlk bedel pozitif TL ve en fazla iki ondalık basamak olsun. İptal/bedel değişikliği sırasında sıfır bedel gerektiğinde kabul edilen hesaplaşma kuralları ayrıca uygulansın.
- İsteğe bağlı: anlaşma tarihi, tek vade tarihi, açıklama ve belgeler.
- Anlaşma tarihi ile sisteme oluşturulma zamanı ayrı olsun; geçmiş anlaşma girilebilir.
- İş durumu başlangıçta devam ediyor olarak önerilsin; ödeme/tahsilat durumu hareketlerden otomatik hesaplansın.
- Anlaşma oluşturmak tek başına gerçekleşen gelir/gider oluşturmasın. İlk ödeme/tahsilat, anlaşma kaydedildikten sonra ayrı eylemle ve aynı finansal kayıt mantığıyla girilsin.
- Şantiye veya muhatap ekranından açılırsa ilgili seçimler hazır ve görünür olsun.

#### Başlangıç borç/alacak oluşturma

- Zorunlu: yön (borç/alacak), kişi/firma, şantiye veya firma geneli, devreden kalan tutar ve takip başlangıç tarihi.
- Tarih bugün olarak önerilsin; kullanıcı uygulamaya geçiş tarihini değiştirebilsin. Tutar pozitif TL ve en fazla iki ondalık basamak olsun.
- İsteğe bağlı: açıklama, vade ve belgeler.
- Girilecek tutar ilk anlaşma bedeli değil, o tarihte gerçekten açık kalan borç/alacak olsun.
- Kayıt yeni para hareketi sayılmasın. Başlangıç satırından açılan ödeme/tahsilat ilgili başlangıç yükümlülüğüne bağlansın; ödeme hedefi görünür olsun ve yalnızca yeni gerçek para hareketi gelir/gideri etkilesin.
- Kayıt açıkça "Başlangıç borcu/alacağı" etiketi taşısın. Aynı yükümlülüğün geçmiş anlaşma ve başlangıç kaydıyla iki kez sayılmaması kullanıcıya hatırlatılsın; aktarım doğrulaması teknik aşamada tanımlansın.

Kabul edilen ortak yaklaşım: Önce zorunlu alanlar gösterilsin; iletişim/not/belge gibi isteğe bağlı alanlar daha az yer kaplasın. Kayıt başarısı doğrulanmadan form tamamlandı sayılmasın; hata veya kaydedilmemiş değişiklikte mevcut kurallar uygulansın.

### 8.7. Paylaştırma, iade, düzeltme ve kayıt yaşam döngüsü (kabul edildi)

Bu bölümdeki ekran ve işlem akışları kullanıcı tarafından kabul edildi. Hesaplama kuralları önceki aşamalarda kabul edilen kurallarla birlikte uygulanacak.

1. **Ödeme/tahsilat paylaştırma:** Kullanıcı toplam gerçek tutarı girsin; "Paylaştır" ile şantiye/firma geneli ve varsa anlaşma/başlangıç yükümlülüğü satırları eklesin. Tek hareketin payları aynı yönde ve varsa aynı muhataba ait olsun; bağlantılı hedefler muhatapla uyumlu olsun. Her satırda pozitif pay tutarı ve varsa hedefin kalan tutarı görünsün. Pay toplamı ana tutara eşit olana kadar kaydetme tamamlanamasın; dağıtılmamış tutar görünür olsun. Örneğin 40.000 TL toplamın A'ya 25.000 TL, B'ye 15.000 TL payı firma toplamında bir kez sayılsın. Ödeme/tahsilat tarihi ve kaynak kayıt ortak kalsın; belge asıl hareketle ilişkili olsun. Basit tek hedefli kayıtta paylaştırma satırları gereksiz yere açılmasın.
2. **İade:** İlgili ödeme/tahsilat detayından "İade kaydet" açılsın. Kaynak hareket, önceki iadeler ve en fazla iade edilebilir tutar gösterilsin. İade tutarı, gerçek tarih ve kısa gerekçe zorunlu; belge isteğe bağlı olsun. Kaydetmeden önce net ödenen/tahsil edilen ve kalan borç/alacak/fazla tutar etkisi gösterilsin. Kaynak hareket paylaştırılmışsa iade hangi payları geri çevirdiğini kullanıcı seçsin; pay bazında iade kaynak payın kalan iade edilebilir tutarını aşmasın. İade kendi kendine başka anlaşmaya dağıtılmasın; kaynak hareketin tutarı değiştirilmesin.
3. **Finansal kayıt düzeltme:** İşlem detayından "Düzenle" açılsın. Değişen finansal alanlar eski/yeni değerleriyle ve bakiye etkisiyle özetlensin; gerekçe istensin. Tutar değiştiyse paylar da aynı toplamı korusun. Şantiye/anlaşma/muhatap değişikliği varsa bütün ilişkiler yeniden doğrulansın. Bağlı iadeyi tutarsız hale getiren değişiklik tamamlanamasın. İlk kaydı oluşturan kişi/zaman değişmesin; son düzenleyen ve geçmiş ayrıca tutulsun. Yalnızca açıklamada yazım düzeltmesi ek finansal gerekçe gerektirmesin.
4. **Anlaşma bedeli değişikliği:** Anlaşma detayında ayrı "Bedeli değiştir" eylemi olsun. Eski bedel, yeni bedel ve gerekçe gösterilsin; yeni kalan borç/alacak veya fazla ödeme/tahsilat önizlensin. Ek iş aynı anlaşmanın bedeline eklenebilir; ayrı iş için yeni anlaşma açma yolu korunsun. Örneğin 120.000 TL'den 140.000 TL'ye artış kendi başına gider oluşturmasın.
5. **Anlaşma iptali:** Ayrı "İptal et" eylemi işin iptalini ve hesaplaşmanın durumunu ayırsın. Kesin bedel biliniyorsa yeni bedel ve gerekçe alınsın; ödenen/tahsil edilen, kalan ve fazla tutar birlikte gösterilsin. Kesin bedel belli değilse hesap tamamlandı gibi gösterilmesin ve geçmiş/kalanlar gizlenmesin. Para geri geldiyse ayrıca iade eylemi kullanılsın; iptal para iadesi oluşturmasın.
6. **Silme ve geri yükleme:** Silmeden önce kayıt tutarı, kapsamı ve bakiye etkisiyle onay gösterilsin; gerekçe istensin. Bağlı iade varsa ana hareket tek başına silinemesin ve açıklaması gösterilsin. Paylaştırılmış hareket silindiğinde bütün pay etkileri birlikte kalksın. Kayıt/geçmiş/belgeler geri alınabilir alanda korunsun. "Silinen kayıtlar"dan geri yüklemede güncel hedef ilişkileri ve bakiye etkisi önizlensin; gerekçe alınsın. Geçersiz ilişki veya eşzamanlı değişiklikte sessiz düzeltme yapılmasın, kullanıcıya çözüm gösterilsin. Normal kullanıcıya kalıcı kayıt yok etme eylemi sunulmasın; firma hizmet sonu silmesi ürün sahibinin ayrı akışı olarak kalsın.

Kabul edilen ortak yaklaşım: Basit kayıt mümkün olduğunca tek ekranda kalsın. Kritik eylemler ayrı başlık taşısın; kullanıcı onaylamadan önce hangi tutarın/ilişkinin değişeceğini görsün. Her işlem sunucuda bütün etkileriyle tutarlı tamamlanmalı; yalnızca bir payın güncellenmesi, belirsiz başarı veya çift kayıt oluşması mevcut kurallarla engellenmeli. Demo aynı akışları örnek veride sunsun; hizmet sonu görüntüleme döneminde değişiklik eylemleri kapalı olsun.

### 8.8. Arama, filtreler, raporlar ve veri çıkışı (kabul edildi)

Bu bölüm kullanıcı tarafından kabul edildi. Mevcut hesaplama ve veri çıkışı kurallarını ekran davranışına dönüştürür.

1. **Liste içinde arama:** Şantiye listesinde proje adı; kişi/firma listesinde ad/unvan ve girilmiş telefon; anlaşmalarda anlaşma adı ve muhatap; işlemlerde açıklama, muhatap, şantiye/anlaşma adı ve kayıt numarası aranabilsin. Türkçe büyük/küçük harf farkı kullanıcıyı engellemesin. Arama firmanın tüm uygun kayıtlarında çalışsın, yalnızca yüklenen sayfayla sınırlanmasın. İlk sürümde belge içeriğinde arama veya ayrı bir tüm-ürün arama sayfası kapsamı genişletmesin.
2. **Filtreler ve telefon kullanımı:** İşlemlerde gerçek işlem tarihi aralığı, gelir/gider/iade türü, şantiye/firma geneli, kişi/firma, gider kategorisi, anlaşma bağlantısı ve kaydı oluşturan kullanıcı filtreleri olsun. Kategorisiz ve muhatapsız kayıtlar ayrıca bulunabilsin. Anlaşmalarda yön, kapsam/muhatap, iş durumu, hesaplanan ödeme durumu ve vade durumu ayrı filtrelensin; başlangıç yükümlülükleri açık borç/alacak listesine dahil olsun. Şantiyelerde aktif/tamamlanan/arşivlenen durumları seçilsin. Telefonda arama ve temel tarih/kapsam seçimi görünür, ayrıntılı filtreler açılır panelde olsun. Seçili filtreler, sonuç sayısı ve tümünü temizleme görünür kalsın; detaya girip geri dönünce liste konumu/filtreleri korunsun.
3. **Varsayılanlar ve toplamlar:** İşlem listesi görünür "Bu ay" tarih filtresiyle açılabilir; "Bugün", "Bu ay" ve "Tümü" hızlı seçenekleri olsun. Şantiye listesi aktif projelerle açılsın; tamamlanan/arşivlenen seçenekleri kolay erişilsin. Diğer listeler tarih filtresiyle gizlice daraltılmasın. İşlem listesindeki tutar özeti bütün filtrelenmiş sonuçları kapsasın; yalnızca ekrandaki sayfanın toplamı olmasın. Şantiye filtresi paylaştırılmış işlemin sadece ilgili payını toplasın; detayda ana işlem ve diğer paylar görülebilsin. Aynı işlem birden fazla seçili paya sahip olsa da firma toplamında çift sayılmasın. Normal finansal toplamlar silinen kayıtları dışlasın; silinenler ayrı alanda gösterilsin. Arşivlenmiş şantiyelerin açık borç/alacakları genel yükümlülük listesinden otomatik dışlanmasın.
4. **Tarih ile bakiye ayrımı:** Dönem hareketleri işlem tarihine göre seçilsin; sisteme girilme zamanı ayrıca gösterilsin. Geçmiş tarihli kayıt doğru dönemde görünsün. "Ocak hareketleri" ile "güncel kalan borç/alacak — hesaplandığı tarih/saat" ayrı adlandırılsın. Tarih filtresi, dönem öncesi anlaşma veya başlangıç yükümlülüğünün bugünkü açık tutarını yok etmesin. Vade listelerindeki tarih aralığı işlem tarihinden ayrı olsun; vadesi olmayanlar gecikmiş sayılmasın. İlk sürümde geçmiş tarih itibarıyla kesin bakiye üretme taahhüdü verilmesin; tarih/saat taşıyan rapor çıktısı oluşturulduğu andaki veriyi yansıtsın.
5. **İade ve net gösterim:** Normal tahsilat, geri verilen tahsilat, ödeme ve geri alınan ödeme ayrı satır/tür olarak görünür olsun. Dönem net tahsilatı = dönem tahsilatları − aynı dönemdeki tahsilat iadeleri; dönem net ödemesi = dönem ödemeleri − aynı dönemde geri alınan ödemeler. Gelir–gider farkı bu iki net tutarın farkı olsun; kâr/kasa diye adlandırılmasın. Ocakta 40.000 TL ödeme, şubatta 10.000 TL geri iade varsa ocak net ödemesi 40.000 TL, şubat net ödemesi −10.000 TL, iki ay toplamı 30.000 TL olsun. Şubat iadesi ocak hareketini yeniden yazmasın. Anlaşmanın güncel net ödemesi ve kalanı tüm geçerli bağlı hareketlerden hesaplansın. İade sonrası kalan değişse de anlaşma bedeli kendiliğinden değişmesin.
6. **İlk sürüm raporları:** Dört standart görünüm olsun: dönem gelir/gider hareket dökümü; şantiye özeti ve hareket dökümü; kişi/firma hesap dökümü; açık borç/alacak ve vade listesi. Firma geneli kapsamı ve başlangıç yükümlülükleri uygun raporda açık etiketle yer alsın. Muhatap dökümünde borç/alacak, fazla ödeme/tahsilat ve anlaşmaya bağlanmamış doğrudan hareketler ayırt edilsin; doğrudan hareketler anlaşma borcunu kendiliğinden azaltmasın. Netleştirmeyle borç/alacak gizlenmesin. Gider kategorisi mevcut hareket dökümünde filtre/özet olarak kullanılabilsin; özel rapor tasarlama ve ileri grafikler eklenmesin. Raporlar telefondan da görüntülenip indirilebilsin.
7. **Filtreli dışa aktarma:** Excel/CSV detaylı tablo, PDF okunabilir özet/döküm sunsun. "Bu sonuçları indir" etkin filtrelerin bütün sonuçlarını alsın; yalnızca görünen sayfayı indirmesin. Firma adı, kapsam, tarih aralığı, üretim tarihi/saat ve güncel bakiye bilgisi dosyada açık olsun. Paylaştırılmış kayıtta ana işlem numarası, toplam gerçek tutar ve seçili kapsama ait pay tutarı ayrı tanımlansın; pay tutarları toplanırken ana tutar tekrarlı toplanmasın. Basit PDF de borç/alacak ile gerçekleşen hareketleri karıştırmasın; eksik geçmiş/başlangıç kaydı uyarısı korunsun. Çıktı tek bir tutarlı veri görünümünden üretilsin; eşzamanlı değişiklik satırlarla toplamları çeliştirmesin. Çıktıdan sonra yapılan düzeltmeler yeni çıktıda yer alsın; indirilmiş dosya kendiliğinden güncellenmiş gibi sunulmasın.
8. **Tam firma veri çıkışı:** "Tüm firma verisini dışa aktar" filtreli rapordan ayrı ve açık adlandırılmış olsun; mevcut ekran filtreleri bu paketi daraltmasın. Finansal hareketler, paylar/iadeler, anlaşmalar, başlangıçlar, şantiyeler, muhataplar ve kayıt geçmişi ilişkileri açıklanmış Excel sayfaları veya CSV dosyalarıyla verilsin; orijinal belgeler dosya-kayıt eşlemesiyle toplu paketlensin. Silinen ancak geri alınabilir kayıtlar/geçmiş/belgeler durum etiketiyle korunsun; aktif finansal toplamlarla karıştırılmasın. Paket şifreleri, oturum bilgilerini veya başka firma verisini içermesin. Büyük paket hazırlanırken ilerleme/durum ve hazır olunca indirme gösterilsin; hazırlanma hatası finansal kayıtları etkilemesin. Aktif müşteriler ve hizmet sonunun ilk 30 günündeki kullanıcılar bu akışı kullanabilsin. Demo çıktıları örnek veri etiketi taşısın.

Bu bölüm kabul edildi. Ekran durumları ve ürün sahibi yönetimi de sonraki bölümlerde kabul edilerek Aşama 3 tamamlandı.

### 8.9. Ekran durumları, hatalar ve kullanıcıya geri bildirim (kabul edildi)

Bu bölüm kullanıcı tarafından kabul edildi. Mevcut bağlantı, kayıt güvenliği, demo ve hizmet kurallarını ekran davranışına dönüştürür.

1. **Boş ekran ve sonuç bulunamaması:** Gerçek müşterinin yeni firması örnek veriyle doldurulmasın. Henüz şantiye yoksa "İlk şantiyeni oluştur", hareket yoksa "Gelir/gider ekle" gibi ilgili ilk eylem sunulsun; başlangıç borç/alacak girişi uygun alandan erişilsin. Şantiye oluşturmak firma geneli kayıt için ön koşul olmasın. Filtre sonucunun boş olması "Bu filtrelerle kayıt bulunamadı" olarak ayırt edilsin; filtreleri temizleme gösterilsin. Geçerli sorgu sonucu boşsa sıfır tutar gösterilebilir; yükleme veya erişim hatası sıfır tutar diye gösterilmesin. Görüntüleme döneminde oluşturma eylemi önerilmesin; demo örnek veri etiketi taşısın.
2. **Yükleme ve güncellik:** İlk yüklemede tutar kartları ve listeler yükleniyor durumunu açıkça göstersin; geçici 0 TL değerleri üretmesin. Yenilemede eski veri görünüyorsa güncelleniyor/güncellik uyarısı olsun. Kısmi hata halinde başarısız bölümün toplamı kesinmiş gibi gösterilmesin. "Yeniden dene" veri okumasını tekrarlasın; para kaydını yeniden oluşturmasın. Ortak veriler yeniden doğrulanırken açık form sessizce sıfırlanmasın; eşzamanlı değişiklikler mevcut kurallarla ele alınsın.
3. **Kaydetme sonucu:** "Kaydediliyor", "Kaydedildi", "Kaydedilemedi" ve "Kaydın durumu doğrulanıyor" ayrı durumlar olsun. Gönderim sürerken aynı eylem tekrar gönderilmesin. Başarı yalnızca doğrulanmış kayıt için gösterilsin; mümkünse ilgili işlem detayına erişim sunulsun. Sunucu işlemi kesin reddettiyse açıklama, form değerleri ve güvenli düzeltme/yeniden deneme korunsun. Yanıt alınamadıysa kullanıcıya "İşlemin kaydedilip kaydedilmediği kontrol ediliyor" denilsin; kesin başarısızlık gibi sunulmasın. Kontrol tamamlanana kadar yeni bir kopya ödeme oluşturmaya yönlendirilmesin; yeniden kontrol/güvenli tekrar aynı gönderimin durumunu çözsün. Çift kayıt önleme teknik yöntemi Aşama 4'te belirlenecek.
4. **Alan hataları ve eşzamanlı değişiklik:** Hata ilgili alanın yanında açık dille gösterilsin; telefonda ilk hatalı alana erişim sağlansın. Örneğin "Payların toplamı 40.000 TL olmalı; 5.000 TL daha dağıtılmalı" veya "Bu kayıttan en fazla 10.000 TL iade edilebilir" denilsin. Başka kullanıcı form açıkken kaydı değiştirdiyse sessizce üstüne yazılmasın; güncel kayıt ve kullanıcının girdiği değişiklik karşılaştırılıp yeniden değerlendirme yolu sunulsun. Yeni bakiyelerle onay gerektiren eylemler eski önizlemeyle tamamlanmasın. Fazla ödeme gibi izin verilen durumlar uyarı/gerekçeyle, geçersiz ilişkiler ve limit aşımı engelleme/açıklamayla ele alınsın.
5. **Belge ve kapasite durumları:** Her dosyada bekliyor/yükleniyor/yüklendi/başarısız durumu ayrı olsun. Finansal kayıt başarılı ama belge yüklenmediyse "İşlem kaydedildi; 1 belge yüklenemedi" denilsin; yalnızca başarısız belge yeniden denensin veya sonra eklensin. Dosya büyüklüğü/biçimi, belge sayısı ve kapasite sınırlarının nedeni anlaşılır gösterilsin. Kapasite dolduğunda yeni belge ekleme kapansın; para kaydı, okuma ve mevcut belge indirme devam etsin. Kapasite artırımı için ürün sahibine başvurma bilgisi gösterilsin; otomatik mesaj gönderimi veya ücretli paket satın alma akışı eklenmesin. Önizleme desteklenmiyorsa geçerli orijinal dosyayı indirme yolu korunsun.
6. **Formdan ayrılma, bağlantı ve oturum:** Değiştirilmiş ancak gönderilmemiş formdan uygulama içi ayrılmada "Kaydedilmemiş bilgiler var" uyarısıyla formda kalma veya vazgeçme sunulsun. Bu uyarı henüz sonucu belirsiz bir gönderimi iptal ettiğini iddia etmesin. Bağlantı yoksa durum görünür olsun; yeni kaydın sunucuya kaydedildiği iddia edilmesin. Açık sayfadaki form değerleri mümkün olduğunca korunsun; ilk sürümde sayfa kapatma/yenileme veya cihaz kaybından sonra kalıcı taslak/çevrimdışı kuyruk garantisi verilmesin. Oturum bittiyse yeniden giriş istensin; aynı hesap/firma doğrulanmadan saklı form gösterilmesin veya gönderilmesin. Giriş sonrası otomatik para kaydı gönderilmesin; önce önceki gönderimin varsa durumu doğrulansın, sonra kullanıcı kontrollü devam etsin. Koruma ve yeniden giriş yöntemi teknik aşamada seçilecek.
7. **Demo, görüntüleme ve erişim kısıtları:** Demoda sürekli "Örnek veriler — değişiklikler geçici" bilgisi bulunsun. "Demoyu sıfırla" bu ziyaretçinin değişikliklerinin silineceğini açıklayarak onay alsın; gerçek müşteri hesabını etkilemesin. Demo sona erdiğinde örnek başlangıca dönme yolu açık olsun. Hizmet sonunun ilk 30 gününde görüntüleme/dışa aktarma ve erişim bitiş tarihi görünür olsun; kayıt değiştirme/yükleme eylemleri kapalı ve nedeni anlaşılır olsun. Süre dolması veya hesap pasifleştirmesinde boş firma görünümü yerine uygun erişim mesajı gösterilsin. Başka firmaya ait ya da erişilemeyen kayıt bağlantısı, ilgili firmanın/kaydın bilgilerini açmadan genel bir erişememe mesajı versin. Bu durumlar veri silinmiş gibi sunulmasın.

Kabul edilen ortak yaklaşım: Mesajlar hangi işlemin tamamlandığını, hangi kısmın tamamlanmadığını ve kullanıcının yapabileceği sonraki adımı söylesin. Kritik/belirsiz durum bilgisi yalnızca kısa süreli bildirimde kalmasın. Telefonda okunabilir yazı ve rahat dokunulabilir eylemler kullanılsın; hata/başarı ayrımı yalnızca renge dayanmasın. Ekran planının son konusu ürün sahibinin yönetim akışları ve bu akışla bağlantılı giriş/profil ayrıntılarıdır.

### 8.10. Ürün sahibi yönetimi, hesap açılışı ve profil (kabul edildi)

Bu bölüm kullanıcı tarafından kabul edildi. Firma/kullanıcı yönetimi, giriş tercihi, parola kurtarma ve müşteri profil/firma bilgisi sınırlarıyla ekran planının son bölümü tamamlandı.

1. **İşletim özeti ve firma listesi:** Panel yalnızca ürün sahibinin platform hesabına açılsın. Firma adına göre arama; aktif, geçici durdurulmuş, hizmet sonu görüntüleme, arşiv saklama ve silme onayı bekleyen durumlara göre filtre olsun. Satırlarda firma adı, kullanıcı sayısı, kullanılan/toplam depolama, hizmet durumu ve ilgili bitiş tarihleri görünsün. Kapasitesi dolan/yaklaşan, görüntüleme dönemi biten, saklama süresi dolan ve silme işlemi tamamlanmayı bekleyen firmalar özetlensin. Bunlar uygulama içi işletim bilgisi olsun; otomatik müşteri mesajı veya abonelik/faturalama eklenmesin. İşletim panelinin standart kapsamı hesap, kapasite ve hizmet yönetimi olsun; otomatik müşteri hesabına geçiş ve müşteri finansal kayıtlarını düzenleme ilk sürüm kapsamına eklenmesin.
2. **Firma oluşturma ve detay:** Firma adı zorunlu; yetkili kişi, telefon, e-posta ve ürün sahibinin işletim notu isteğe bağlı olsun. Yeni firma kabul edilen 20 GB kapasiteyle, aktif ve boş veriyle başlasın; demo kayıtları aktarılmasın. Benzer isim uyarısı yeni meşru firmayı engellemesin. Firma kaydedilince aynı detaydan ilk kullanıcı ve diğer kullanıcılar eklenebilsin. Firma detayında kullanıcılar, depolama, hizmet durumu/tarihleri ve işletim geçmişi ayrı bölümler olsun. Tekrar gönderim ikinci firma/kullanıcı oluşturmamalı; sonuç belirsizse ortak doğrulama yaklaşımı uygulansın.
3. **Kişisel kullanıcı ve giriş tercihi:** İlk sürüm için firma seçimi gerektirmeyen benzersiz kullanıcı adı + parola önerilsin; müşteri girişinde "Demo dene" ayrı eylem olsun. Kullanıcı açarken ad/soyad, kullanıcı adı ve bağlı firma zorunlu; telefon/e-posta isteğe bağlı olsun. Hesap ilk sürümde tek firmaya bağlı olsun; şirketler arası hesap taşıma veya çoklu firma seçimi eklenmesin. Aynı firmadaki bütün hesaplar eşit yetkili olsun. Sistem geçici ilk parola üretsin; kullanıcı adı ve bu geçici parola yalnızca teslim için gösterilsin, mevcut kişisel parola görüntülenmesin. Giriş bilgilerini ürün sahibi müşterinin doğrulanmış iletişim kanalıyla kendisi teslim etsin; uygulama kendiliğinden mesaj göndermesin. İlk girişte kişisel parola oluşturma zorunlu olsun; sonra boş firma özetine yönlendirsin. Kullanıcı adı normalleştirme, geçici parola geçerlilik süresi ve güvenli teslim ayrıntıları Aşama 4'te belirlenecek.
4. **Parola kurtarma ve kullanıcı erişimi:** "Şifremi unuttum" ilk sürümde ürün sahibine nasıl ulaşılacağını açıklasın. Ürün sahibi kayıtlı kişi/iletişim bilgileriyle talebi doğruladıktan sonra hesabın parolasını sıfırlayıp yeni geçici parola üretebilsin; mevcut parolayı öğrenmesin. Sıfırlamada mevcut oturumlar geçersizleşsin, ilk yeni girişte parola değişimi istensin. Kullanıcı pasifleştirme girişini ve mevcut oturum erişimini kapatsın; geçmişteki kayıtları ve kullanıcı atıfları kalsın. Yeniden aktifleştirme, firmanın hizmet kısıtlarını kaldırmasın. Genel giriş hatası hesabın varlığını ifşa etmesin. Platform sahibinin kendi hesap kurtarma/güvenlik yöntemi Aşama 4'te ayrıca belirlensin.
5. **Depolama yönetimi:** Firma detayında kullanım/limit ve belge yükleme durumu görünsün. Ürün sahibi kapasiteyi gerekçeyle artırabilsin; önceki/yeni limit ve değişiklik yapan/zaman kaydedilsin. Kapasite azaltma mevcut kullanımı aşan geçerli bir limite kadar yapılabilsin; mevcut veriyi silerek yer açma veya kullanımın altına sessiz limit indirme olmasın. 20 MB dosya ve 10 belge sınırları kabul edilen ortak ürün kuralları olarak kalsın; firma limitiyle karıştırılmasın. Kapasite değişikliği otomatik ücret tahsilatı başlatmasın.
6. **Hizmet ve saklama yaşam döngüsü:** "Geçici durdur", "Hizmeti sonlandır" ve "Yeniden aç" farklı işlemler olsun. Geçici durdurma erişimi kapatsın ama hizmet sonu saklama sayacını başlatmasın; zaten hizmeti sonlandırılmış firmada süreleri sıfırlamanın yolu olmasın. Hizmet sonlandırmada firma adı, gerçek yürürlük tarihi, ilk 30 günlük görüntüleme bitişi ve toplam 180 günlük saklama bitişi önizlensin; gerekçe ve onay alınsın. Yanlışlıkla geçmiş tarih seçilerek müşteri çıkış süresi kısaltılmasın; istisna gerekiyorsa ayrı açık işlem/geçmişle teknik planlamada ele alınsın. Veri korunuyorken yeniden açılan firma kendi geçmişiyle devam etsin; eski hizmet tarihleri denetim geçmişinde kalsın. Arşiv uzatmada yeni saklama bitişi ve gerekçe alınsın; uzatma müşteri erişimini kendiliğinden açmasın.
7. **Kalıcı silme ve yönetim geçmişi:** Saklama süresi dolan firma silme onayı bekleyen alana gelsin; kendiliğinden yok edilmesin. Ayrı silme ekranında firma adı, mevcut durum, saklama bitişi, kapsanan finansal kayıt/geçmiş/belgeler ve geri döndürülemeyecek sonuç açık olsun. Firma adını yazarak onay ve gerekçe önerilsin; süre dolmadan normal panel akışı bu işlemi sunmasın. Silme bekliyor/sürüyor/tamamlandı/başarısız ve yedekten çıkarma son tarihi takip edilsin; erişim gerçek silme başladığında kapalı kalsın. Kalıcı silinen firmayı yeniden açma sunulmasın; aynı müşteri tekrar gelirse yeni firma hesabı açılır. Hesap açma/pasifleştirme, parola sıfırlama, kapasite ve hizmet/silme işlemleri yapan kişi, zaman ve gerekçeyle kaydedilsin; işletim geçmişinde parolalar bulunmasın. İşletim geçmişinin silme sonrası gereken asgari kaydı ve teknik saklama yöntemi Aşama 4'te netleşsin.
8. **Müşteri profil/firma ekranı:** Her kullanıcı kendi görünen adını, iletişim bilgilerini ve parolasını değiştirebilsin; kullanıcı adı değişikliğini ürün sahibi yönetsin. Firma içindeki eşit yetkili kullanıcılar ortak firma görünen adı ve iletişim bilgilerini düzenleyebilsin; değişiklik geçmişi tutulsun. Bu düzenleme firma kimliğini, bağlı kullanıcıları, kapasiteyi veya hizmet/saklama politikasını değiştirmesin. Ürün sahibinin özel işletim notları müşteriye açılmasın. Müşteri depolama kullanımını, hizmet durumunu ve destek iletişimini görebilsin; hesap açma ve kapasite artırma ürün sahibinin akışı olarak kalsın.

Bu bölümün kabulüyle Aşama 3 — ekranlar ve kullanım akışları planı tamamlandı. Kullanıcı teknik altyapıya henüz geçilmemesini istedi; Aşama 4 başlatılmadı. Ekran planının tamamlanması görsel tasarımın veya yazılımın tamamlandığı anlamına gelmez.

## 9. Aşama 4 — Teknik plan ve uygulama promptu (kabul edildi; 11 Ekim 2026'da yenilendi)

6 ve 8 Ekim 2026'da kabul edilen ayrıntılı teknik plan (`teknik_plan/asama4_teknik_altyapi_plani.md`) 11 Ekim 2026'da kullanıcı tarafından iptal edildi ve kullanılmayacak. Yerine, geliştirmeye tek prompt olarak verilecek [santiye-hesap-web-prompt.md](santiye-hesap-web-prompt.md) belgesi esas alınacak.

Prompt, mevcut **Şantiye Hesap** ürün tanımının tasarım sistemi ve sayfa yapısıyla bu belgede kabul edilen iş kurallarının birleşimidir. İkisi çelişirse bu belgedeki kabul edilmiş kararlar geçerlidir; prompt da buna göre güncellenmiştir. Kod veya çalışan uygulama henüz oluşturulmadı.

### 9.1. Kapsam kararları

- **Ürün:** Yalnız web ürünü yapılacak. Mobil uygulama şimdilik yapılmayacak; web arayüzü telefon tarayıcısında günlük kullanım için telefon öncelikli tasarlanacak.
- **Marka:** Web'de görünen ad **Şantiye Hesap**; slogan "Şantiye parasını net ve hızlı yönetin."
- **Tanıtım sitesi:** Ana sayfa, özellikler, nasıl çalışır, kullanım, SSS, gizlilik ve koşullar sayfaları ilk sürüme eklendi. Sahte yorum, logo veya istatistik kullanılmayacak. Fiyat rakamı yazılmayacak.
- **Tasarım sistemi:** Promptta tanımlanan renk token'ları, Outfit/DM Sans tipografisi, ölçüler, bileşenler ve üç genişlik kademesi sabittir.
- **Promptla gelen kolaylıklar:** Şantiye ve kişi sabitleme, işlem kopyalama, kullanıcıya özel son aramalar ve mükerrer kayıt uyarısı ilk sürümde olacak.

### 9.2. Teknoloji

| Katman | Seçim |
|---|---|
| Web | React 19, TypeScript, Vite (SPA), React Router, TanStack Query, Zustand, React Hook Form + Zod, Axios, CSS Modules / tasarım token dosyası |
| API | Node.js, Express, TypeScript, Zod |
| Veritabanı | MongoDB (replica set, çok dokümanlı transaction) + Mongoose |
| Kimlik | Kullanıcı adı + şifre; JWT access (15 dk) + refresh (30 gün, her kullanımda yenilenir); bcrypt maliyet 12 |
| Belge | S3 uyumlu özel bucket (ör. Cloudflare R2), imzalı süreli bağlantılar; sharp ile önizleme |
| Rapor | PDFKit, exceljs, BOM'lu CSV, archiver |
| Depo | `apps/web`, `apps/api`, `packages/shared` (ortak şemalar ve finans hesap fonksiyonları) |

Tanıtım, demo, müşteri uygulaması ve ürün sahibi yönetim alanı aynı web uygulamasında, ayrı rota grupları ve ayrı token türleriyle çalışacak.

### 9.3. Promptta somutlaşan teknik kurallar

- **Firma ayrımı:** Her firma kaydında `companyId` zorunlu ve servis katmanında zorla filtrelenir. Başka firmanın kaydı istenirse 404 döner.
- **Para ve tarih:** Para kuruş cinsinden tamsayı olarak saklanır. İş tarihleri `YYYY-MM-DD`; "bugün" Europe/Istanbul gününe göre.
- **Paylı hareket modeli:** Ayrı ödeme modeli yok. Anlaşmaya ödeme, `allocations` alanında anlaşmaya bağlanan bir hareket olarak kaydedilir. Paylaştırılmış harekette şantiye toplamı paylardan, firma toplamı hareket tutarından hesaplanır.
- **Anlaşma ve başlangıç kaydı:** Aynı koleksiyonda tutulur. Kalan, fazla ve ödeme durumu önbelleği, bağlı her hareketle aynı transaction'da güncellenir.
- **Tutarlılık:** Finansal değişiklikler tek transaction'da tamamlanır. `Idempotency-Key` ile güvenli tekrar, `expectedUpdatedAt` ile çakışma kontrolü yapılır.
- **Belge yükleme:** Önce yükleme niyeti alınır; belge sayısı ve kapasite atomik olarak rezerve edilir. Dosya geçici alana yüklenir, sunucu doğrular ve değiştirilemeyen nihai anahtara taşır.
- **Hizmet durumu:** Erişim her istekte tarihlerden hesaplanır. Görüntüleme döneminde değiştirme istekleri `READ_ONLY` hatasıyla reddedilir.
- **Demo:** Gerçek veritabanından ayrı bir demo veritabanında, her ziyaretçiye ayrı geçici firma açılır. 24 saat kullanılmayan demo silinir.

### 9.4. Bu aşamada belirlenen varsayılanlar

Aşağıdaki değerler kabul edilen kurallara aykırı değildir; pilotta değiştirilebilir:

- Geçici şifre 72 saat geçerli.
- Şifre en az 8 karakter.
- Demo 24 saat hareketsizlikte silinir.
- Hazır dışa aktarma paketi 7 gün saklanır.
- Güvenli tekrar anahtarı 24 saat geçerli, kaydı 30 gün tutulur.
- Yeni firma 6 başlangıç gider kategorisiyle açılır: Malzeme, İşçilik, Taşeron, Nakliye, Kira, Genel giderler.

## 10. Aşama 5 — Geliştirme planı (kabul edildi; 11 Ekim 2026)

Geliştirme sırası ve çalışma biçimi kullanıcı tarafından kabul edildi. Pilot müşteri planı, geliştirme ilerledikçe ayrıca belirlenecek.

### 10.1. Çalışma biçimi

- **Şartname tek parça kalır.** [santiye-hesap-web-prompt.md](santiye-hesap-web-prompt.md) bütün oturumlar için tek başvuru kaynağıdır ve parçalara bölünmez. Bölünen şey iştir.
- **Her oturum tek bir adım yapar.** Modele [gelistirme/gorev_metinleri.md](gelistirme/gorev_metinleri.md) içindeki ortak giriş ve ilgili adımın görev metni verilir.
- **Kalıcı kurallar depo kökündedir.** Ajanlar için [AGENTS.md](AGENTS.md) dosyasında tutulur. [CLAUDE.md](CLAUDE.md) aynı kuralları içe aktarır.
- **Her adımın sonunda:** testler geçer, kullanıcı değişiklikleri kontrol eder, git'e commit atılır; sonra bir sonraki adıma geçilir.
- **Çelişki veya eksik:** Model şartnamede bir sorun bulursa kendisi karar vermez, kullanıcıya sorar. Şartnameyi değiştiren kararlar önce şartnameye ve bu belgeye işlenir.
- **Adlandırma:** Planlama aşamalarıyla (Aşama 0–5) karışmaması için geliştirme parçalarına **Adım** denir.

### 10.2. Geliştirme adımları

| Adım | Kapsam | Bitti sayılması için |
|---|---|---|
| 0 — Proje iskeleti | Monorepo, TypeScript, lint ve test altyapısı, yerel MongoDB replica set ve MinIO, `.env.example`, `/health`, CI | Proje çalışır; lint, tip kontrolü, test ve build temiz |
| 1 — Finans çekirdeği | `packages/shared` içindeki saf hesap fonksiyonları ve ortak şemalar | Bölüm 6 ve şartname bölüm 9'daki örnek tutarlar birim testlerde birebir tutar |
| 2 — API temeli | Modeller, müşteri ve ürün sahibi kimliği (TOTP dahil), firma ayrımı, hizmet durumu erişimi, güvenli tekrar, çakışma kontrolü, temel yönetim API'si | Firma yalıtımı, erişim tablosu ve kimlik testleri geçer |
| 3 — Finans API'si | Şantiye, kişi, kategori, işlem (paylar ve iadeler), anlaşma, silme/geri yükleme, pano, vade, arama | Senaryolar API üzerinden aynı tutarları üretir; entegrasyon testleri geçer |
| 4 — Uygulama ekranları | Tasarım sistemi, yerleşim, giriş ekranları ve bütün uygulama ekranları | Telefon ve masaüstünde temel akışlar çalışır; ekran tutarları API ile aynı |
| 4b-1 — Görsel revizyon: temel | Token'lar, ikonlar, uygulama kabuğu, ortak bileşenler; Özet, İşlemler, Şantiyeler | Üç ekran taslakla aynı; geniş ekranda boşluk yok; diğer ekranlar kullanılabilir |
| 4b-2 — Görsel revizyon: kalan ekranlar | Diğer bütün ekranlar, formlar ve dialoglar 4b-1 bileşenleriyle | Mor/lacivert gövde metni kalmadı; akışlar yeni görünümle çalışır |
| 5 — Belgeler (5a API, 5b ekranlar) | Depolama, yükleme akışı, önizleme, kapasite; 5a başında ara sıra düşen testin düzeltilmesi | Sınırlar eşzamanlı yüklemede de korunur; belge hatası kaydı tekrarlamaz |
| 6 — Raporlar (6a standart raporlar, 6b tam veri çıkışı) | Dört standart rapor, Excel/CSV/PDF, filtreli dışa aktarma, tam firma veri çıkışı | Dosya toplamları ekran ve API ile aynı |
| 7 — Ürün sahibi yönetimi (7a API, 7b ekranlar) | Yönetim ekranları, hizmet yaşam döngüsü, kalıcı silme | Firma açılışından kalıcı silmeye kadar akış testli |
| 8 — Demo | Ayrı demo veritabanı, örnek veri, sıfırlama | Ziyaretçiler birbirini ve gerçek firmaları etkilemez |
| 9 — Tanıtım sitesi | Pazarlama sayfaları ve SEO | Sayfalar telefon, tablet ve masaüstünde bozulmaz |
| 10 — Son kabul | Uçtan uca testler, kabul kontrol listesi, canlıya hazırlık notu | Şartname bölüm 13'ün bütün maddeleri karşılanır |

**Sıranın gerekçesi:**
- Para hesapları en riskli kısım ve ekrandan bağımsız doğrulanabiliyor; bu yüzden önce yapılıyor.
- Demo, uygulamanın ekranlarını kullandığı için onlardan sonra geliyor.
- Tanıtım sitesi uygulamaya bağımlı değil; gerekirse ayrı bir oturumda paralel yapılabilir.

### 10.3. Ürün sahibi hesap güvenliği (kabul edildi)

Bütün firmaları yöneten ürün sahibi hesabı için şu yöntem seçildi ve şartnameye işlendi:

- **İki aşamalı giriş:** Şifrenin ardından zorunlu TOTP kodu (doğrulama uygulamasından 6 haneli kod). İki aşamalı doğrulama kapatılamaz; ilk girişte kurulumu zorunludur.
- **Kurtarma kodları:** Kurulumda bir kez gösterilen, çevrimdışı saklanacak 10 tek kullanımlık kod.
- **Telefon ve kodların ikisi de kaybolursa:** Web üzerinden kurtarma yolu yoktur. Yalnız sunucu erişimi olan kişinin çalıştırabileceği bir sıfırlama komutu kullanılır; komut kayıt bırakır.

### 10.4. Açık kararların zamanlaması

| Karar | En geç | Sorumlu ve yöntem |
|---|---|---|
| Barındırma, veritabanı paketi, yedekleme, belge deposu ve maliyet | Adım 3 sonu (internetten deneme kurulumu isteniyorsa), en geç Adım 10 | Claude güncel fiyatlarla 2–3 seçenekli karşılaştırma hazırlar; kullanıcı seçer. Ölçüt (10.18): arka plan işleri (belge temizliği, tam veri çıkışı) API sürecinde çalıştığı için API sürekli açık kalmalıdır; uyuyan veya istek başına çalışan (serverless) barındırma uygun değildir. İlk sürümde API tek süreç olarak çalışır (10.20; şartname bölüm 3) |
| KVKK hukuki değerlendirmesi | Gerçek müşteri verisinden önce; barındırma seçilir seçilmez başlatılmalı | Kullanıcı bir avukat veya KVKK danışmanıyla görüşür. Claude danışmana verilecek veri envanterini hazırlayabilir |
| Alan adı ve iletişim metni | Adım 9'dan önce | Kullanıcı seçer; o zamana kadar yer tutucu metin kullanılır |

### 10.5. Adım 0'da kabul edilen geliştirme ortamı kararları (12 Ekim 2026)

Adım 0 (proje iskeleti) tamamlandı: `docker compose up` sonrası `pnpm dev` ile API ve web açılıyor, `/health` cevap veriyor; `pnpm lint`, `pnpm typecheck`, `pnpm test` ve `pnpm build` temiz. Adım sırasında şartnamenin belirlemediği şu noktalar kararlaştırıldı:

- **Node.js 24 LTS:** Yerel geliştirme ve CI Node 24 ile çalışır (`.nvmrc`, `engines: >=24`). Gerekçe: güncel Vite, Vitest, ESLint, React Router ve jsdom sürümleri Node 22.11'i desteklemiyor; eski ana sürümlere sabitlenmek yükseltme borcu bırakırdı. Paket yöneticisi pnpm 12.
- **Yerel S3 deposu `pgsty/minio`:** MinIO resmi Docker imajlarını dağıtmayı bıraktığı için yerelde MinIO kaynağından derlenen topluluk imajı kullanılır; sürüm sabitlenir. Bu yalnız yerel geliştirme içindir; üretim belge deposu kararı 10.4'teki barındırma kararıyla verilir. Uygulama kodu yalnız S3 API'sini kullanır.
- **TypeScript 6.0:** TypeScript 7 yayımlanmış olsa da lint aracı (typescript-eslint) henüz desteklemediği için 6.0 kullanılır; destek gelince yükseltilebilir.
- **MongoDB 8.2:** Yerel Docker MongoDB ile testlerdeki bellek içi replica set aynı sürümü kullanır. API açılışta veritabanının replica set olduğunu doğrular; değilse başlamaz.
- **`/health` cevabı:** Genel başarılı cevap biçimi `{ success, data }` olsa da şartname 10.9 ve görev metnindeki özel biçim uygulanır: `{ success: true, status: "ok" }`.
- **Ortam değişkenleri:** `.env.example` değersiz tutulur. Geliştirmede boş bırakılan `PORT`, `MONGODB_URI` ve `WEB_ORIGIN` için API gizli olmayan yerel varsayılanları kullanır; üretimde bu değerler zorunludur. Yerel MinIO kimlik bilgileri `.env`'den okunur, koda yazılmaz.

### 10.6. Adım 1'de kabul edilen finans çekirdeği kararları (12 Ekim 2026)

Adım 1 (finans çekirdeği) tamamlandı: para, tarih, pay doğrulaması, anlaşma/başlangıç hesabı, iade sınırları, toplamlar, fazla ödeme tespiti ve ortak giriş şemaları `packages/shared` içinde saf fonksiyon olarak yazıldı. Şartname bölüm 9 ve bu belgenin bölüm 6'sındaki örnek tutarlar birim testlerde birebir tutuyor. Şartnamenin açık bıraktığı şu noktalar kullanıcı tarafından kararlaştırıldı:

- **Ödeme durumu nete göre hesaplanır:** Sıra: fazla > 0 → `overpaid`; kalan 0 → `settled`; net ödenen/tahsil edilen 0 → `open`; aksi halde `partial`. Böylece bedeli 0'a inmiş (ör. iptal, kesin bedel 0) ve ödemesi olmayan anlaşma `settled`; ödemeleri tamamen iade edilmiş anlaşma `open` görünür.
- **Para girişi katı tr-TR biçimindedir:** Nokta yalnız üç haneli binlik grubunda, virgül ondalık ayracı olarak geçerlidir (`12500`, `12.500`, `12.500,50`). `12.5` gibi binlik grubuna uymayan noktalı girdi reddedilir ve "Ondalık için virgül kullanın" denir. En fazla iki ondalık kabul edilir; fazlası yuvarlanmaz, reddedilir.
- **İadesi olan pay korunur:** Bağlı aktif iadesi olan pay düzeltmede kaldırılamaz, şantiyesi veya anlaşması değiştirilemez ve tutarı bağlı iade toplamının altına indirilemez. Hedef değiştirilecekse önce iade silinir.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **İade hareketinin payları:** İade hareketi, geri çevrilen kaynak payların kapsamını ve anlaşmasını taşıyan kendi paylarıyla kaydedilir; şantiye toplamları iadeyi de paylardan hesaplar. Anlaşmanın net ödenen/tahsil edilen tutarı ise kaynak payların `refundedAmount` değerinden hesaplanır; iade iki kez sayılmaz.
- **Vade grupları:** Gecikmiş (vade < bugün), yaklaşan (bugün ≤ vade ≤ bugün + pencere; varsayılan 30 gün, pano için 14 gün), vadesi belirlenmemiş ve pencerenin ötesindeki vadeler (`later`). Açık tutarı olmayan kayıt hiçbir gruba girmez.
- **Mesaj biçimi:** Ekranda tutarlar `₺12.500,50` biçiminde (Intl tr-TR); hata ve uyarı metinlerinde şartnamedeki örnekler gibi `40.000 TL` biçiminde gösterilir.
- **Zod mesajları:** Ortak şemalar yüklendiğinde Zod'un hazır hata mesajları Türkçeye ayarlanır.

### 10.7. Adım 2'de kabul edilen API temeli kararları (12 Ekim 2026)

Adım 2 (API temeli) tamamlandı: firma modelleri için ortak alanlar ve firma ayrımı, her istekte hesaplanan hizmet durumu ve erişim tablosu, müşteri kimliği, ürün sahibi kimliği (TOTP, kurtarma kodları, kilit, sunucu sıfırlama komutu), temel yönetim API'si, güvenli tekrar ve çakışma kontrolü. Şartnamenin açık bıraktığı şu noktalar kullanıcı tarafından kararlaştırıldı:

- **Geçici şifre tekrar gösterilmez:** Kullanıcı oluşturma isteği aynı Idempotency-Key ile tekrar gelirse oluşan kullanıcı şifresiz döner ve "Geçici şifre ilk yanıtta gösterildi; görmediyseniz şifreyi sıfırlayın" denir. Geçici şifre hiçbir yerde düz metin saklanmaz.
- **Oturumlar hemen düşer:** Şifre değişimi, şifre sıfırlama, kullanıcı pasifleştirme ve ürün sahibinde 2FA sıfırlamasında refresh token'lar silinir; ayrıca kullanıcı ve ürün sahibi hesabındaki `tokensValidAfter` alanı sayesinde bu andan önce verilmiş access token'lar 15 dakikayı beklemeden hemen reddedilir.
- **Yönetim işlemlerinde gerekçe:** Kullanıcı pasifleştirme, aktifleştirme ve şifre sıfırlamada zorunlu; firma ve kullanıcı oluşturmada isteğe bağlı. Hepsi işletim geçmişine yazılır.
- **Hizmet sonu gün sınırları:** Yürürlük günü D dahil görüntüleme dönemidir ve `viewUntil` (D+30) günü de dahildir; `viewUntil`+1 … `retainUntil` (D+180) arşiv saklamadır; `retainUntil`'den sonra "silme onayı bekliyor" durumuna geçilir. Görüntüleme bandındaki tarih son görüntüleme günüdür.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **İlk şifre ve şifre değişimi:** Geçici şifreden kişisel şifreye geçişte bütün eski oturumlar düşer ve yeni oturum verilir; kullanıcı firma özetine devam eder (şartname 7.12). Normal şifre değişiminde yeni oturum verilmez; kullanıcı yeniden giriş yapar (7.11).
- **Firma ayrımı koruması:** Firma verisi taşıyan modellerde `companyId` filtresi olmayan her sorgu reddedilir; firma kayıtlarına servis katmanındaki `forCompany` yardımcısıyla erişilir. Her yeni firma ucu, API testlerindeki ortak firma yalıtım listesine eklenir.
- **Deneme sınırı:** Aynı kullanıcı adında 15 dakika içinde 5 hatalı denemede veya aynı IP'den 30 hatalı denemede 5 dakika bekleme. Sınır sunucu belleğinde tutulur; birden fazla sunucuya geçilirse paylaşılan bir depoya taşınmalıdır.
- **Kullanıcı adı biçimi:** 3–50 karakter; harf (Türkçe dahil), rakam, nokta, alt çizgi ve tire.
- **TOTP tekrar engeli:** Aynı kodun ikinci kez kabul edilmemesi için ürün sahibi hesabında son kabul edilen zaman adımı (`totpLastUsedStep`) tutulur.
- **Kütüphaneler:** JWT için `jose`, şifre için bcrypt algoritmasının saf JS sürümü `bcryptjs` (maliyet 12), TOTP için `otplib`.
- **Sıfırlama komutu:** `pnpm --filter api platform:reset-2fa --username <ad>` derlenmiş API ile (`pnpm build` sonrası) yalnız sunucuda çalışır.
- **Canlıya hazırlık notu:** Ters vekil sunucu arkasında deneme sınırının gerçek IP'yi görmesi için Express `trust proxy` ayarı barındırma seçilince yapılmalıdır.

### 10.8. Adım 3'te kabul edilen finans API'si kararları (12 Ekim 2026)

Adım 3 (finans API'si) tamamlandı: şantiye, kişi, kategori, firma bilgisi, işlem (paylar, iadeler, düzeltme, silme, geri yükleme), anlaşma ve başlangıç kaydı uçları ile pano, vade, arama ve silinenler. Bölüm 9'daki örnek tutarlar API üzerinden uçtan uca birebir tutuyor; bütün firma uçları yalıtım testinde. Şartnamenin açık bıraktığı şu noktalar kullanıcı tarafından kararlaştırıldı:

- **Kopyala taslak döner:** `POST /transactions/:id/duplicate` kayıt açmaz; aynı alanlar ve bugünün tarihiyle form taslağı döner, anlaşma bağlantısı "onay gerekli" işaretlidir. Kullanıcı kaydedince normal oluşturma akışı çalışır.
- **Tamamlanan şantiye:** Anlaşmaya bağlı ödeme, tahsilat, iade ve düzeltme serbesttir. Anlaşmaya bağlı olmayan yeni gider gerekçe ister (`POST /transactions` gövdesinde `reason`); anlaşmasız gelir serbesttir. Yeni anlaşma için şantiye gerekçeyle yeniden aktifleştirilir.
- **Arşivlenen şantiye tamamlanan gibi davranır:** Aynı kurallar uygulanır; arşiv yalnız günlük listeden kaldırır.
- **Arşivden çıkış önceki duruma döner:** `completedAt` doluysa tamamlandı, boşsa aktif. Yeniden aktifleştirme `completedAt` alanını temizler.
- **Geri yüklemede fazla ödeme onayı:** Silinmiş ödeme geri yüklenirken anlaşmanın kalanı aşılıyorsa yeni kayıttaki gibi `confirmExcess` ve `excessReason` istenir.
- **Mükerrer uyarısı kayıt sonrası:** Aynı gün, tutar, kişi ve kapsamda kayıt varsa oluşturma cevabında uyarı ve benzer kayıtların numaraları döner; kayıt engellenmez, ayrı kontrol ucu yoktur.
- **Başlangıç kayıtları özetlerde:** Anlaşma toplamı, ödenen, kalan borç/alacak ve gecikmiş tutarlar anlaşma ile başlangıç kayıtlarını birlikte içerir; başlangıç kayıtları ayrıca ayrı alt toplam olarak döner.
- **Kişi silme:** Silinmiş ama geri yüklenebilir hareket veya anlaşması olan kişi de silinmez, pasifleştirilir.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **Formüllerin yeri:** Veritabanı yalnız türe göre toplanmış tutarları getirir; net tahsilat/ödeme ve fark `cashTotalsFromSums`, kalan/fazla/ödeme durumu `computeAgreementBalance`, vade grupları `dueStateOf` ile `packages/shared` içinde hesaplanır.
- **Güvenli tekrar:** Para hareketi, anlaşma ve iade oluşturmada Idempotency-Key zorunlu; şantiye, kişi ve kategori oluşturmada isteğe bağlı (gelirse uygulanır).
- **Sürüm kontrolü:** Sabitleme ve arama geçmişini temizleme dışındaki bütün değiştirme işlemleri (güncelleme, tamamlama, arşiv, bedel/vade/iş durumu, iptal, silme, geri yükleme) `expectedUpdatedAt` ister.
- **İade kaydı:** Açıklaması iade gerekçesidir; kaynak hareketin kişisi ve kategorisi taşınır. Bağlı iadesi olan hareketin kişisi değiştirilemez.
- **İptal ve bedel:** İptal edilen anlaşmaya ödeme/tahsilat bağlanabilir. Hesabı kesinleşmemiş iptalde bedel değişikliği kesin bedeli kaydeder; kesin bedeli girilmiş iptalde bedel değiştirilemez; iptal edilen anlaşmanın iş durumu değişmez.
- **Kategori:** Pasif kategori yeni kayıtta seçilemez, geri yüklemede engel olmaz. Ad firma içinde Türkçe katlamalı olarak benzersizdir.
- **Başlangıç kategorileri:** Firma oluşturulurken aynı transaction'da "Sistem" adına eklenir.
- **Arama:** Tutar tek değer veya `10.000-20.000` biçiminde aralık olarak aranabilir.
- **Firma bilgisi:** Görünen ad ve iletişim değişiklikleri firma kaydında geçmişle tutulur; işletim notu müşteriye dönmez.
- **Performans notu:** Anlaşma listesi toplamları ve vade filtresi eşleşen anlaşmaları bellekte paylaşılan fonksiyonla hesaplar; firma başına binlerce anlaşmaya çıkılırsa gözden geçirilmelidir.

### 10.9. Adım 4'te kabul edilen uygulama ekranları kararları (13 Ekim 2026)

Adım 4 (uygulama ekranları) tamamlandı: tasarım token dosyası ve temel bileşenler, telefon/tablet/masaüstü yerleşimi, güvenli tekrar ve "Kaydın durumu doğrulanıyor" akışlı HTTP istemcisi, giriş ekranları ve bütün uygulama ekranları. Giriş → ilk şifre → şantiye → gider → anlaşma → kısmi ödeme → paylaştırılmış ödeme → iade → sil/geri al akışı 375 px'te ve masaüstünde tarayıcıda denendi; ekrandaki tutarlar API özetiyle aynı. Şartnamenin açık bıraktığı şu noktalar kullanıcı tarafından kararlaştırıldı:

- **Firma kullanıcı listesi:** İşlem listesindeki "Kaydı oluşturan kullanıcı" filtresi için `GET /company/users` ucu eklendi. Yalnız aynı firmanın kullanıcılarını kimlik, görünen ad ve aktiflik bilgisiyle döner (kullanıcı adı ve iletişim dönmez); pasif kullanıcılar da listelenir ki geçmiş kayıtları süzülebilsin. Uç firma yalıtım testindedir.
- **İletişim metninin web'e ulaşması:** `SUPPORT_CONTACT_TEXT` web derlemesine gömülür (Vite `envPrefix`). Yeni API ucu yoktur; metin değişirse web yeniden derlenir. Boşsa genel bir yönlendirme metni gösterilir.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **"Daha sonra" vade grubu:** Şartname 10.9'daki `later` grubu API'de eksikti; `/dues` ucuna eklendi. Yaklaşan penceresinin (varsayılan 30 gün) ötesindeki vadeleri listeler.
- **Etki önizlemesi formülleri:** Silme, geri yükleme, iade ve düzeltme önizlemeleri `packages/shared` içindeki `previewAgreementBalance` ve `previewCashTotals` fonksiyonlarıyla hesaplanır; web formül yazmaz. Bedel değişikliği ve iptalde API önizlemesi (`?preview=1`) kullanılır.
- **İade tutarının rengi:** İade satırları kaynak hareketin yönünün rengini kullanır (ödeme iadesi kırmızı, tahsilat iadesi yeşil); tutar "−" önekiyle gösterilir ve "Ödeme iadesi" / "Tahsilat iadesi" yazısı her zaman görünür.
- **Görüntüleme dönemi bandı:** Tarih ekinin (`'e/'ya`) yanlış çekimlenmemesi için metin "Kayıtlarınızı {tarih} tarihine kadar görüntüleyip dışa aktarabilirsiniz" biçimindedir.
- **Açık formun korunması:** Düzenleme formları arka planda yenilenen veriyle sessizce sıfırlanmaz; kayıt başka yerde değiştiyse 409 karşılaştırma ekranında kullanıcı güncel kaydı yükler veya kendi değişikliğiyle devam eder.
- **Geçici yönlendirmeler:** Tanıtım sitesi (Adım 9) gelene kadar `/` giriş ekranına, demo (Adım 8) gelene kadar "Demoyu dene" bir yer tutucu sayfaya gider. Rapor sayfaları ve belge alanları Adım 5 ve 6'ya kadar yer tutucudur.
- **Silinen işlemi geri alma:** Silinenler listesinde işlemler için "İncele ve geri al" kaydın detayına götürür; geri alma ve etki önizlemesi orada yapılır.
- **Bekleyen elle kontrol:** İngilizce dilli bir telefonda sayısal klavyede ondalık virgül girişi (şartname 11) henüz denenmedi.

### 10.10. Görsel revizyon kararları (13 Ekim 2026)

Adım 4 ekranları işlevsel olarak kabul edildi, ancak kullanıcı görünümü amatör buldu: geniş ekranda iki yanda büyük boşluk, her yerde aynı mor/lacivert metin, eşit ağırlıkta çok sayıda kutu ve ekranın yarısını kaplayan filtreler. Nedenlerin bir kısmı şartnamenin eski tasarım kurallarıydı (içerik en fazla 1120 px, gövde metni rengi = lacivert). Adım 5'ten önce görsel revizyon yapılması kararlaştırıldı.

- **Önce taslak:** Üç renk paleti (A · Marka rafine, B · Lacivert ve kask sarısı, C · Beton ve bakır) ile Özet, İşlemler ve Şantiyeler ekranlarının masaüstü/telefon taslağı hazırlandı. Kullanıcı **A paletini** ve taslağın düzenini olduğu gibi onayladı. Onaylanan taslak: [tasarim/taslak_v1.html](tasarim/taslak_v1.html).
- **Renk:** Marka renkleri (mor, lacivert, cyan, gelir yeşili, gider kırmızısı) korunur. Metin nötr koyu (`#1B1838`) ve gri tonlara geçer; mor yalnız etkileşim ve vurguda. Kartlar beyaz; renk yalnız rakamda ve ikon kutusunda.
- **İkonlar:** Lucide (`lucide-react`) kullanılır.
- **Yerleşim:** İçerik genişlik sınırı kaldırıldı; kenar menü gruplu ve ikonlu; arama ve "Yeni kayıt" üst çubukta; telefonda alt menü ve yüzen + düğmesi.
- **Ekranlar:** Özet'te dönem segmentli 5 kutu ve 2×2 panel; İşlemler'de tek satır araç çubuğu, Filtreler paneli ve yeni tablo; Şantiyeler'de sekmeler ve masaüstü tablo.
- **İade gösterimi:** Uygulamadaki hali korunur: iade kaynak hareketin renginde ve "−" önekiyle, tür yazısı görünür.
- **Uygulama:** Şartname bölüm 4 baştan yazıldı; 5.2, 7.1, 7.2, 7.4 ve 11 güncellendi. 10.9'daki Adım 4 kararları da şartnameye işlendi. Görsel revizyon Adım 5'ten önce yapılacak; kullanım limitine sığması için **Adım 4b-1** (temel, yerleşim ve üç ana ekran) ve **Adım 4b-2** (kalan ekranlar) olarak iki oturuma bölündü. Bu adımlarda şartnamenin yalnız ilgili bölümleri okunur.

### 10.11. Adım 4b-1'de kabul edilen görsel revizyon kararları (14 Ekim 2026)

Adım 4b-1 (tasarım token'ları, uygulama kabuğu, ortak bileşenler; Özet, İşlemler ve Şantiyeler ekranları) tamamlandı ve kabul edildi. Üç ekran 1440 px, 1920 px ve 375 px'te taslakla aynı düzende; geniş ekranda iki yanda boşluk kalmıyor. Kalan ekranlar ortak bileşenlerle açılıyor ve kullanılabiliyor; görünümleri Adım 4b-2'de tamamlanacak. Şartnamenin açık bıraktığı şu nokta kullanıcı tarafından kararlaştırıldı:

- **Ekranların istediği değerler için okuma cevaplarının genişletilmesi:** Şartname 7.1 ve 7.2'nin istediği bazı değerler API cevabında yoktu; adım metni API değişikliğini yasaklasa da kullanıcı yalnız okuma cevaplarına alan eklenmesini onayladı. `GET /projects` kart özetine `netIncome`, `netExpense` ve `overdueReceivable`; panodaki `recentProjects` kayıtlarına aynı özet; pano `totals` ve `monthly` alanlarına `expenseRefund` eklendi. İş kuralı ve veri modeli değişmedi; değerler `packages/shared` fonksiyonlarıyla ve firma filtresiyle hesaplanır, entegrasyon testleri güncellendi. Şantiye başına web'den ayrı özet isteği atma seçeneği reddedildi.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **Kuruşsuz gösterim:** Özet kutuları için `packages/shared` içine `formatMoneyWhole` eklendi (yarım yukarı yuvarlar). Liste, tablo ve detaylarda tutarlar kuruşlu kalır; paylaştırma notunda kuruş yalnız gerekiyorsa yazılır ("₺25.000 + ₺15.000").
- **Bakiye rengi:** Taslak, Açık anlaşmalar ve Vadeler panellerinde kalan tutarı yeşil/kırmızı gösteriyordu; şartname 4.1 gereği kalan borç/alacak, gelir − gider farkı gibi bakiyeler `ink` renginde ve negatifse "−" önekiyle gösterilir. Yön ikon kutusunun renginden ve "Kalan alacak/borç" yazısından anlaşılır.
- **Tutar önekleri:** Hareketlerde gelir "+", gider ve iadeler "−" önekli; iade kaynak hareketin rengini taşır ve tür yazısı görünür.
- **"Bu sonuçları indir":** Dışa aktarma Adım 6'da geleceği için düğme masaüstünde devre dışı, telefonda gizlidir.
- **Şantiye satırındaki "Diğer işlemler" menüsü:** Yalnız mevcut sayfalara bağlantı verir (detay, düzenle, bu şantiyeye gelir/gider ekle). Tamamla, arşivle gibi durum eylemleri detay sayfasındadır.
- **Telefonda sayfa eylemleri:** Taslak telefonda sayfa başlığı eylemlerini gizler. Özet'teki Gelir/Gider ekle düğmeleri telefonda gizlidir (yüzen + aynı işi görür); "Yeni şantiye" yüzen menüde olmadığı için telefonda görünür kalır.
- **Yüzen + düğmesi:** Form sayfalarında (`/yeni`, `/duzenle`, `/iade`, `/odeme`) kaydet düğmelerini örtmemesi için gizlenir.
- **Kart içinde kart yok:** Telefondaki şantiye kartları panel içinde çizgiyle ayrılmış satırlar olarak çizilir; taslaktaki iç içe kart kullanılmadı.
- **Dar sayfalar:** Formlar, ayarlar ve düz metin sayfaları en fazla ~760 px genişliktedir (`page--narrow`). *14 Ekim 2026'da değişti: genişlik sınırı kaldırıldı, formlar ve ayar sayfaları iki sütunlu tam genişlik düzene geçti (bölüm 10.12).*
- **Geliştirme altyapısı:** `lucide-react` eklendi; `tasarim/` klasörü Prettier denetiminden çıkarıldı; web testlerinde asenkron bekleme süresi, paket paralel koşarken tembel yüklenen rotalar için 3 saniyeye çıkarıldı.

### 10.12. Adım 4b-2'de kabul edilen görsel revizyon kararları (14 Ekim 2026)

Adım 4b-2 (kalan ekranların görsel revizyonu) tamamlandı ve kabul edildi. Kişiler, anlaşmalar ve başlangıç kayıtları, Vadeler, Arama, Silinenler, Ayarlar, işlem ve şantiye detayları, formlar, dialoglar, 409 karşılaştırma ekranı, kaydetme durumu çubuğu ve giriş ekranları 4b-1'in bileşenleriyle yenilendi. Adım 4'teki akış (giriş → ilk şifre → şantiye → gider → anlaşma → kısmi ödeme → paylaştırma → iade → sil/geri al) masaüstünde (1440 px) ve telefonda (375 px) arayüz üzerinden çalıştırıldı; ekran tutarları API ile aynı çıktı. Uygulama içinde mor/lacivert gövde metni kalmadı: mor yalnız bağlantı, seçili menü/sekme/segment, filtre etiketi ve rozette; lacivert yalnız kelime markasında.

Teslimden sonra kullanıcının geri bildirimiyle iki değişiklik yapıldı:

- **Form ve ayar sayfalarında iki sütunlu tam genişlik düzen (kullanıcı kararı):** Kullanıcı ~760 px genişlik sınırının geniş ekranda sağda büyük boşluk bıraktığını belirtti. Sunulan üç seçenekten (iki sütunlu form, formu ortalama, tam genişlikte tek kart) **iki sütunlu form** seçildi; ayar sayfalarının düzeni her sayfaya uygun biçimde belirlenmek üzere geliştiriciye bırakıldı. Bölüm 10.11'deki "Dar sayfalar" kararı bununla değişti. Geniş ekranda (900 px ve üstü) solda ana bilgiler, sağda ikincil bilgiler yer alır; daha dar ekranda tek sütundur ve telefondaki sıra değişmez. `page--narrow` sınıfı ve `--readable-max-width` token'ı kaldırıldı, yerine `.form-columns` geldi.

  | Sayfa | Sol sütun | Sağ sütun |
  |---|---|---|
  | Gelir/gider, anlaşmaya ödeme | Tutar, tarih, kişi, kapsam, anlaşma, paylar | Kategori, açıklama, belgeler |
  | Anlaşma / başlangıç kaydı | Ad, yön, kişi, kapsam, bedel, tarihler | Açıklama, belgeler |
  | Şantiye formu | Ad, adres, başlangıç tarihi | Açıklama |
  | Kişi formu | Ad, tür, etiketler | İletişim, not |
  | İade | Kaynak hareket | İade formu ve etki önizlemesi |
  | Finansal düzeltme | Alanlar | Değişiklik önizlemesi |
  | Profil | Görünen ad, telefon, e-posta | Kullanıcı adı ve şifre sayfasına bağlantı |
  | Şifre | Form | Şifre kuralları |
  | Firma | Firma bilgileri | Belge alanı, hizmet durumu |
  | Kategoriler | Yeni kategori ve kurallar | Kategori listesi |
  | Hakkında | Ürün, sürüm, dil | Veriler notu |

  Ayarlar menüsü yan yana panellere, Raporlar yer tutucusu ve "Sayfa bulunamadı" tam genişliğe geçti. Bu düzen için üç küçük ekleme yapıldı: düzeltme sayfasında finansal alan değişmediğinde sağ panelde kısa açıklama, profilde şifre sayfasına bağlantı, kategori kurallarının sayfa alt başlığından yan panele taşınması. Şartname 4.5 bu düzene göre güncellendi (14 Ekim 2026).
- **Yeni kayıt menüsüyle tür değişimi hatası düzeltildi:** Gelir ekle açıkken üst çubuktaki Yeni kayıt menüsünden Gider ekle seçilince (veya tersi) yalnız başlık değişiyor, form ilk açıldığı türde kalıyordu. Neden, iki sayfanın aynı adreste açılıp yalnız `?tur=` sorgusunun değişmesiydi. Form artık her yeni gezintide sıfırdan kurulur; anlaşma ve başlangıç formlarına da aynı düzeltme uygulandı. Formda kaydedilmemiş bilgi varsa mevcut "Kaydedilmemiş değişiklikler" uyarısı geçişten önce sorar.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **Detay sayfası düzeni:** Şantiye, kişi, anlaşma ve işlem detaylarında sık eylemler sayfa başlığında ikonlu düğmelerdir; seyrek eylemler (düzenle, sabitle, tamamla, arşivle, iptal, sil vb.) "Diğer" menüsündedir. Başlığın altında özet kutuları, onun altında iki sütunlu paneller gelir; değişiklik geçmişi en alttadır.
- **Detay sayfalarındaki özet kutuları kuruşludur:** Şartname 4.4 "özet kutularında kuruşsuz, detayda kuruşlu" der. Detay sayfasının üstündeki kutular detay sayıldı ve ekran tutarlarının API ile birebir aynı olması için kuruşlu gösterildi. Özet sayfasındaki kutular kuruşsuz kalır (bölüm 10.11).
- **Bakiyeler bütün listelerde `ink`:** Anlaşma tablosu, vade listesi, kişi detayındaki kapsam dağılımı ve arama sonuçlarında kalan borç/alacak artık yeşil/kırmızı değil, `ink` renktedir. Yön ikon kutusundan ve "Kalan borç/alacak" yazısından anlaşılır. Fazla ödeme/tahsilat kırmızı rozetle gösterilir.
- **Gecikme gün sayısı:** Anlaşma detay cevabında gecikme gün sayısı olmadığı için rozet yalnız "Gecikmiş" yazıyordu. Web, eksik olduğunda gün sayısını `packages/shared` içindeki `overdueDaysOf` ile hesaplar ("13 gün gecikti"). Vadeler listesinde rozet durumu satırın grubundan alınır.
- **Kart içinde kart yok:** Değişiklik geçmişi, paylaştırma payları ve belge alanı panel içinde çizgiyle ayrılmış satırlardır. Etki önizlemesi kenarsız, gömülü bir kutudur (`surface` zemin).
- **Durumlar yalnız renge bırakılmaz:** Kaydetme durumunun dört hali ayrı Lucide ikonu ve metinle gösterilir; 409 karşılaştırmasında farklı alanlar görünür "Farklı" rozeti taşır.
- **Kişi detayında anlaşmasız hareketler:** "Anlaşmaya bağlı değil" işareti nötr rozettir (cyan zemin yalnız paylaştırma notu ve demo/görüntüleme bandında kullanılır).
- **Kişi seçici:** Öneriler ve "yeni kişi/firma ekle" seçeneği alanın altında açılır liste olarak gösterilir.
- **Doğrulama yöntemi:** Uygulama içi tarayıcı paneli görünüm boyutunu kendi kendine sıfırladığı için ekran görüntüleri ve 375 px akışı, yerel Chrome'u başsız çalıştıran ve depoya eklenmeyen bir betikle alındı. Yerel geliştirme veritabanında üç deneme firması kaldı ("E2E Deneme İnşaat (Adım 4b-2)", "E2E Deneme Telefon (Adım 4b-2)", "E2E Deneme Telefon 2 (Adım 4b-2)").
- **Açık nokta:** `TransactionForm.test.tsx` içindeki bir test, tam test paketi üç kez çalıştırıldığında bir kez zamanlama kaynaklı düştü; diğer çalıştırmalarda ve tek başına geçti. Nedeni doğrulanmadı; test değiştirilmedi. Adım 5a'da nedeni bulunup düzeltildi (bölüm 10.13).

### 10.13. Adım 5a'da kabul edilen belge API'si kararları (14 Ekim 2026)

Adım 5a (belge API'si ve depolama) tamamlandı ve kabul edildi. S3 uyumlu depolama istemcisi, yükleme niyeti, tamamlama, süresi geçen yüklemelerin temizliği, indirme/önizleme adresleri, belge silme/geri yükleme ve firma bilgisindeki kullanım dökümü yazıldı. Bütün yeni uçlar firma yalıtım testine eklendi. `pnpm lint`, `pnpm typecheck` ve `pnpm build` temiz; tam test paketi art arda 5 kez çalıştırıldı ve her seferinde geçti. Gerçek S3 yolu ayrıca yerel MinIO'ya karşı uçtan uca denendi.

Şartnamedeki boşluklar için kullanıcı dört karar verdi:

- **Silinen belge 10'luk sınırda sayılmaz:** Belge silmek kaydın `documentCount` değerini bir azaltır; yerine yeni belge eklenebilir. Geri yüklemede kayıtta 10 belge varsa 422 `LIMIT_EXCEEDED`: "Bu kayıtta 10 belge var; geri yüklemek için önce birini silin." Kapasitede ise silinmiş belge (şartname 9.6) sayılmaya devam eder; silme alanı boşaltmaz.
- **Önizleme kotaya sığmazsa üretilmez:** Kapasite yükleme niyetinde bildirilen orijinal boyutla ayrılır; önizlemenin boyutu ancak tamamlamada belli olur. Önizleme kalan kapasiteye sığmazsa saklanmaz ve belge önizlemesiz yüklenir; açarken orijinal kullanılır. Böylece firma kotası hiçbir durumda aşılmaz.
- **Yükleme niyetinde `Idempotency-Key` isteğe bağlıdır:** Şantiye, kişi ve kategori oluşturmadaki gibi gelirse uygulanır. Aynı anahtarla tekrar aynı bekleyen belgeyi ve yeni bir imzalı adresi döner; ikinci rezervasyon yapılmaz. Web her zaman anahtar gönderir.
- **Silinmiş kaydın belgeleri yalnız okunur:** Silinmiş işlem veya anlaşmanın belgeleri indirilebilir ve önizlenebilir (silinmiş kaydın detayı görüntülenebildiği için). Bu kayda yeni belge yükleme, belge silme ve geri yükleme 409 alır: "Kayıt silinmiş. Belge işlemi için önce kaydı geri yükleyin."

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **Uçlar:** `POST /documents/upload-intent` cevabı `{ document, upload: { method, url, headers, expiresAt } }` biçimindedir; istemci dosyayı dönen başlıklarla (`Content-Type` imzaya dahildir) doğrudan depoya yükler, sonra `POST /documents/:id/complete` çağırır. `GET /documents/:id/download` ve `/preview` 5 dakikalık adres, `isPreview`, dosya adı ve türü döner; önizleme yoksa önizleme isteği orijinali tarayıcıda açar (PDF için önizleme üretilmez). Belge silme ve geri yükleme gerekçe ve `expectedUpdatedAt` ister.
- **Kayıt detaylarında belgeler:** `GET /transactions/:id` ve `GET /agreements/:id` cevabındaki `documents` listesi yüklenmiş ve yüklenmekte olan belgeleri içerir; silinmiş ama geri alınabilir belgeler `deletedAt` dolu olarak gelir. Başarısız ve süresi geçmiş yüklemeler listelenmez. Belgeyi anlaşmaya da bağlayabilmek için Agreement modeline `documentCount` eklendi. Belge eklemek veya silmek kaydın sürümünü (`updatedAt`) değiştirmez; açık bir düzenleme formu bu yüzden çakışma almaz.
- **Kullanım dökümü:** `GET /company` cevabındaki `storage.breakdown` orijinal, önizleme, geri alınabilir silinmiş, yüklenmekte olan ve (Adım 6'ya kadar 0 olan) dışa aktarma baytlarını ayrı döner; toplamı `storageUsedBytes` ile aynıdır.
- **Tamamlama ve temizlik çakışması:** Tamamlama belgeyi 5 dakikalık bir kilitle sahiplenir; temizlik kilitli belgeye dokunmaz. Kilit dolup temizlik kazanırsa tamamlama kendi kopyasını siler ve 409 döner; rezervasyon ve sayaç yalnız bir kez iade edilir. Nihai anahtar her tamamlama denemesine özgüdür ve hiç üzerine yazılmaz. Temizlik 10 dakikada bir çalışır ve sorguları firma bazında yapar (firma filtresi koruması delinmez).
- **Dosya doğrulaması:** Tür, istemcinin bildirdiğine değil dosyanın ilk baytlarına göre belirlenir ve kaydedilir. Desteklenmeyen içerik veya 20 MB'tan büyük gerçek boyut yüklemeyi `failed` yapar; rezervasyon ve sayaç iade edilir, geçici dosya silinir. Gerçek boyut bildirilenden büyükse fark da kotaya sığmalıdır (değilse 409 `STORAGE_FULL`); küçükse fark iade edilir. Çözülemeyen görsel (ör. bozuk HEIC) önizlemesiz yüklenir.
- **Depolama ayarları:** `STORAGE_*` üretimde zorunludur; geliştirmede boşsa API açılır, yalnız belge işlemleri "Belge deposu yapılandırılmadı" hatasıyla reddedilir. Yerel MinIO ve R2 için bölge adı `us-east-1`, yol biçimi (path-style) kullanılır; yeni ortam değişkeni eklenmedi.
- **Yeni bağımlılıklar:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `sharp`, `heic-convert` (ve `@types/heic-convert`). pnpm'in yayın yaşı politikası korundu; politikaya takılan en yeni S3 istemcisi sürümü yerine bir önceki sürüm kullanıldı.
- **`TransactionForm.test.tsx` düzeltmesi (10.12 açık noktası):** Hata ek CPU yükü altında tekrarlandı. Nedenler: tembel yüklenen sayfanın ilk derlemesi testin bekleme süresine giriyordu; dosyadaki `afterEach` oturumu ekran kaldırılmadan önce temizleyip giriş sayfasına yönlendirdiği ve kayıt sonrası dönüş test bitince sürdüğü için sonraki teste iş sızıyordu; rol sorguları kenar menü dahil bütün sayfayı tarıyordu. Sayfalar `beforeAll`'da önceden yükleniyor, önce ekran kaldırılıp sonra oturum temizleniyor, kayıt sonrası gezinti testin içinde bekleniyor ve sorgular formla sınırlandı. Beklenen değerler ve süreler değişmedi.
- **Açık noktalar:** Gerçek bir HEIC dosyasıyla önizleme denenmedi (yalnız imza tanıma ve çözülemeyen HEIC). Belge ekleme/silme yalnız belgenin kendi geçmişine yazılır, bağlı kaydın geçmişine yazılmaz. Üretim deposunda geçici yükleme klasörü (`companies/*/uploads/`) için bir günlük yaşam döngüsü kuralı önerilir; reddedilen yüklemenin adresine istemci yeniden dosya koyarsa yetim dosya kalabilir. Bu kararlar 15 Ekim 2026'da şartnameye işlendi (bölüm 10.15).

### 10.14. Adım 5b'de kabul edilen belge ekranları kararları (15 Ekim 2026)

Adım 5b (belge ekranları) tamamlandı ve kabul edildi. İşlem, anlaşmaya ödeme, anlaşma/başlangıç kaydı ve iade formlarının sağ sütununa belge alanı; işlem ve anlaşma detaylarına belge paneli (önizle, indir, gerekçeli sil ve geri al); firma ayarlarına kullanım dökümü eklendi. API değişikliği yapılmadı, yeni bağımlılık eklenmedi. `pnpm lint`, `pnpm typecheck`, `pnpm test` ve `pnpm build` temiz; web testleri art arda üç kez geçti. Gider formuna belge ekleme, yükleme hatasında yalnız belgenin yeniden denenmesi, önizleme, sil/geri al ve kapasite doluyken kayıt girme akışları gerçek API ve yerel MinIO ile masaüstünde (1440 px) ve telefonda (375 px) denendi. Kapasite dökümünün toplamı kullanılan alanla aynı çıktı; aynı anahtarla tekrarlanan yükleme niyeti ikinci kez yer ayırmadı.

Şartnamenin açık bıraktığı şu noktalar geliştirici tarafından belirlendi ve kullanıcı tarafından kabul edildi:

- **Telefonda kamera ve galeri ayrı düğmeler:** Android'de `capture` özniteliği galeri seçeneğini kaldırdığı için dokunmatik cihazda iki düğme vardır: "Fotoğraf çek" (`capture="environment"`) ve "Galeriden seç". İkisi de `accept="image/*,application/pdf"` kullanır. Masaüstünde tek "Dosya ekle" düğmesi görünür.
- **Önizlemesi olmayan belge dialogda açılır:** Görsellerin önizlemesi dialogda gösterilir. Önizlemesi olmayan belgede (PDF, çözülemeyen görsel, kotaya sığmayan önizleme) dialog "Orijinali aç" bağlantısı ve "Orijinali indir" düğmesi verir; orijinal yeni sekmede doğrudan açılmaz, çünkü telefon tarayıcılarının açılır pencere engeline takılır.
- **İade formunda da belge alanı:** Görev metninde sayılmasa da şartname 7.5 "Belge isteğe bağlı" dediği için iade formuna eklendi.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **Kayıt ile belge yüklemesi ayrı:** Formda seçilen dosyalar "Bekliyor" olarak listelenir ve finansal kayıt oluştuktan sonra sırayla yüklenir (niyet → imzalı adrese doğrudan yükleme → tamamlama). Yükleme sürerken kaydet düğmeleri kilitlidir. Bir belge yüklenemezse form "İşlem kaydedildi; 1 belge yüklenemedi." sonuç görünümünde kalır; yalnız o belge yeniden denenir, kayıt tekrar oluşturulmaz. Bütün belgeler yüklenince kayıt sonrası olağan dönüş yapılır.
- **Yeniden denemede kaldığı yerden devam:** Yükleme niyetinin tekrarında aynı `Idempotency-Key` kullanılır; sunucu aynı bekleyen belgeyi ve yeni imzalı adresi döner. Kesin retten veya süresi dolmuş yüklemeden sonra yeni anahtar üretilir. Tamamlama bağlantı hatasında yalnız tamamlama tekrarlanır.
- **Gönderilmeden reddedilen dosyalar:** 20 MB üstü, boş veya desteklenmeyen türdeki dosya istemcide "Başarısız" olarak gösterilir ve yeniden denenmez. Tarayıcı türü vermezse (bazı HEIC dosyaları) tür uzantıdan belirlenir; asıl tür yine sunucuda dosyanın ilk baytlarından doğrulanır.
- **Yükleme düğmesi nedenini gösterir:** Değişiklik kapalıysa, kayıt silinmişse, belge alanı doluysa veya kayıtta 10 belge varsa düğme kapalıdır ve nedeni yazılıdır. Kapasite bilgisi alınamazsa yükleme engellenmez; sınırları sunucu uygular. Silme ve geri yükleme kapasite veya 10 belge sınırı yüzünden kapanmaz; 10 belgeli kayıtta geri yükleme dialogu nedeni gösterir.
- **Detay sayfasında belge paneli:** Detaydan eklenen belge hemen yüklenir. Silinen belgeler aynı panelde "Silinen belgeler" bölümünde silen kişi, zaman ve gerekçeyle listelenir. Başka oturumdan kalmış yarım yüklemeler "Bekliyor" olarak, bir saat içinde kendiliğinden kalkacağı notuyla görünür. Görsellerde küçük önizleme için 5 dakikalık önizleme adresi alınır.
- **İndirme:** İndirme imzalı adresi `attachment` olarak açar; sayfa değişmez.
- **Firma ayarlarında döküm:** Orijinal belgeler (belge sayısıyla), önizlemeler ve silinmiş ama geri alınabilir belgeler her zaman; yüklenmekte olan dosyalar ve dışa aktarma paketleri yalnız varsa gösterilir.
- **Telefonda belge satırı:** 760 px altında ad ve hata metni tam genişlikte, durum rozeti ve eylemler alt satırdadır.
- **Kod yeri:** `apps/web/src/features/documents/`. Kullanılmayan belge yer tutucusu kaldırıldı. Testlerde imzalı depo adresine yükleme de aynı HTTP taklidinden geçer.
- **Açık noktalar:** Anlaşma formu ve detayı aynı bileşenleri kullanır ama tarayıcıda yalnız işlem akışı denendi. İndirme gerçek dosya kaydedilerek denenmedi; yalnız adresin `attachment` döndüğü kontrol edildi. Gerçek telefon kamerası ve gerçek HEIC dosyası denenmedi. Bu oturumda `pnpm dev` ile Vite dinlemeye başlamadı; API ve web ayrı başlatılınca sorun olmadı, nedeni araştırılmadı. Yerel geliştirme veritabanında "E2E Deneme Belge (Adım 5b)" deneme firması kaldı. Bu kararlar 15 Ekim 2026'da şartnameye işlendi (bölüm 10.15).

### 10.15. Belge kararlarının şartnameye işlenmesi (15 Ekim 2026)

10.13 ve 10.14 şartnameye işlendi: bölüm 2 (S3 istemcisi, bölge ve yol biçimi, `STORAGE_*` üretimde zorunlu), 3 (güvenli tekrar), 4.4 (belge satırı, ekleme düğmeleri, belge paneli, önizleme dialogu), 4.5 (iade formunda belgeler), 7.4 ve 7.6 (formda belge akışı, detayda belge paneli), 7.9, 7.11, 8.7 (`documentCount`), 8.8, 9.6, 9.7, 9.10, 10.3, 10.6–10.8, 11 ve 12 (üç yeni metin). Yalnız uygulama ayrıntısı olanlar (bağımlılık sürümleri, test düzeltmesi, kodun yeri, deneme firması) bu belgede kaldı. Silinmiş kayıtta belge işleminin hata kodu kodda `CONFLICT` olarak doğrulandı ve şartnameye öyle yazıldı.

İşleme sırasında kullanıcı dört karar verdi:

- **Belge olayları kaydın geçmişine yazılmaz:** Belge ekleme, silme ve geri yükleme yalnız belgenin kendi geçmişinde kalır; API değişmez. Silme bilgisi detaydaki "Silinen belgeler" bölümünde görünür. Belge geçmişinin tamamı Adım 6b'deki tam firma veri çıkışına eklenir.
- **`Idempotency-Key` kuralı şartnameye bağlandı:** Yükleme niyeti, anahtarın isteğe bağlı olduğu uçlar listesine (şartname bölüm 3) eklendi; tekrarında yeni imzalı adres dönmesi bu kuralın tek istisnası olarak yazıldı. AGENTS.md'deki 6. kural "bütün oluşturan POST istekleri anahtar ister" yerine şartname bölüm 3'teki listeye atıf yapacak biçimde düzeltildi.
- **`pnpm dev` sorunu Adım 6a'nın ilk işi:** Web'in `pnpm dev` ile açılmaması 6a'nın başında kısa bir iş olarak düzeltilecek.
- **Denenmemiş belge akışları Adım 10'a:** Anlaşma formu ve detayında belge akışı, gerçek dosya kaydıyla indirme, gerçek telefon kamerası ve gerçek HEIC önizlemesi Adım 10'un kontrol listesine eklendi. Üretim deposundaki `companies/*/uploads/` için bir günlük yaşam döngüsü kuralı şartname 9.6'ya ve Adım 10'un canlıya hazırlık notuna yazıldı.

### 10.16. Adım 6a'da kabul edilen standart rapor ve filtreli dışa aktarma kararları (15 Ekim 2026)

Adım 6a (standart raporlar ve filtreli dışa aktarma) tamamlandı ve kabul edildi. Dört standart raporun verisi ve ekranı yazıldı: dönem gelir/gider hareket dökümü, şantiye özeti ve hareket dökümü, kişi/firma hesap dökümü, açık borç/alacak ve vade listesi. Her rapor Excel, CSV ve PDF olarak indirilir; İşlemler sayfasındaki "Bu sonuçları indir" düğmesi açıldı. `pnpm lint`, `pnpm typecheck`, `pnpm test` ve `pnpm build` temiz. Dosya toplamlarının ekran ve API ile aynı olduğu, paylaştırılmış hareketin şantiye raporunda yalnız payıyla ve firma raporunda bir kez sayıldığı, görüntüleme dönemindeki firmanın rapor alabildiği ve PDF'de Türkçe karakterlerin gömülü yazı tipiyle yazıldığı testle doğrulandı. Şartname 9.1 örneği (ocak 40.000 TL ödeme, şubat 10.000 TL iade) dönem dökümünde ocak 40.000, şubat −10.000, toplam 30.000 verdi. Ekranlar gerçek API ile masaüstünde (1440 px) ve telefonda (375 px) denendi; PDF ve CSV indirmesi dosya adı, BOM ve toplamlar açısından kontrol edildi.

**`pnpm dev` düzeltmesi (10.15'teki karar):** API'nin `tsx watch` komutu klavye girişini (stdin) sürekli dinliyordu. Windows'ta iki süreç bu girişi paylaşınca Vite açılırken takılıyordu; API ve web ayrı başlatılınca sorun çıkmamasının nedeni buydu. API dev betiği Node'un yerleşik izleme özelliğine geçirildi: `node --watch --watch-preserve-output --import tsx src/index.ts`. Yeni bağımlılık gerekmedi; `pnpm dev` API'yi (3000) ve web'i (5173) birlikte açar, API dosyası değişince yeniden başlar.

Şartnamedeki boşluklar için kullanıcı iki karar verdi:

- **PDF yazı tipleri depoda:** Şartnamedeki DM Sans (400, 700) ve Outfit (600) TTF dosyaları Google Fonts'tan indirilip OFL lisans metinleriyle `apps/api/assets/fonts` altına kondu. Outfit'te ₺ işareti olmadığı için yalnız başlıklarda kullanılır; tutarlar DM Sans'tır. API'nin üretim dağıtımında bu klasör de bulunmalıdır.
- **Başlangıç kaydı yoksa takip başlangıcı:** Takip başlangıcı, raporun kapsamındaki başlangıç kayıtlarının en erken takip başlangıç tarihidir. Kapsamda başlangıç kaydı yoksa satır her raporda bulunur ve "Başlangıç kaydı yok" yazar; "Bu rapor takip başlangıç tarihinden itibaren kayıtlı hareketleri kapsar" uyarısı yalnız başlangıç kaydı varsa çıkar.

Şartnamenin açık bıraktığı şu noktalar geliştirici tarafından belirlendi ve kullanıcı tarafından kabul edildi:

- **Dosya ucunun tür adları:** `GET /reports/:type/export.{xlsx,csv,pdf}` içinde `type` değerleri `period`, `project`, `party`, `open-balances` ve `transactions`'dır. Şantiye ve kişi raporunda kayıt `?id=` ile verilir. `transactions` "Bu sonuçları indir"dir ve `GET /transactions` ile aynı filtreleri sayfasız alır. Bilinmeyen tür veya biçim 400 `VALIDATION`, başka firmanın kaydı 404 döner.
- **Tarih aralığı ve güncel kalan:** Dönem dökümü ekranda "Bu ay" ile, şantiye ve kişi dökümleri bütün tarihlerle açılır. Tarih aralığı yalnız hareketleri daraltır; kalan borç/alacak, gecikmiş ve fazla tutarlar her zaman günceldir ve "Güncel kalan — hesaplandığı" satırındaki ana aittir. Açık borç/alacak listesinde tarih filtresi yoktur; yön (borç, alacak, ikisi) ve kapsam seçilir.
- **Kapsam:** Dönem dökümü ve açık tutar listesinde kapsam tüm firma, firma geneli kayıtlar veya bir şantiyedir (tamamlanan ve arşivlenenler dahil). Kapsam seçilince tutarlar o kapsama düşen paylardan hesaplanır.
- **Kategori filtresi ve özeti:** Kategori filtresi o kategorinin giderlerini ve ödeme iadelerini birlikte alır; "Kategorisiz" seçeneği kategorisiz giderleri ve iadelerini alır. Kategori özeti her kategori için ödeme, ödeme iadesi ve net ödeme verir.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **Tek veri görünümü:** Bir raporun bütün okumaları tek bir tutarlı okuma anından (MongoDB snapshot okuması) yapılır; eşzamanlı değişiklik satırlarla özetleri çelişkiye düşürmez. Ekran, API cevabı ve dosya aynı rapor verisinden üretilir; dosya ayrıca hesap yapmaz.
- **Toplamlar satırlardan:** Hareket toplamları aynı satırlardan `packages/shared` içine eklenen `cashTotalsOfRows` ile, borç/alacak özetleri `summarizeAgreements` ile hesaplanır. Dosyalar için kuruşun ondalık metni `kurusToDecimalString` ile üretilir; kayan noktalı para hesabı yapılmaz.
- **Paylaştırılmış kayıt:** Dönem dökümünde ve "Bu sonuçları indir"de her hareket tek satırdır. "Toplam tutar" hareketin gerçek tutarıdır; kapsam seçildiyse "Kapsama düşen pay" ayrı sütundur ve toplam satırları pay sütunundan hesaplanır. Paylar Excel ve CSV'de ayrıca "Kadıköy Villa: 25.000 TL; Şişli Ofis: 15.000 TL" biçiminde yazılır. İade satırında kaynak hareketin işlem no'su ayrı sütundur.
- **Silinenler:** "Silinenleri göster" açıkken indirilen dosyada silinen kayıtlar "Silindi" durumuyla listelenir ama toplamlara katılmaz.
- **Kişi dökümü:** Borç ve alacak ayrı; anlaşmalar ve başlangıç kayıtları tek tabloda "Başlangıç kaydı" etiketiyle, ödenecek ve tahsil edilecek toplamları ayrı satırlarda (mahsup yok). Hareketler "Anlaşmaya bağlı" ve "Doğrudan (anlaşmaya bağlanmamış; borcu azaltmaz)" diye ayrılır; doğrudan hareket, hiçbir payı anlaşmaya bağlı olmayan harekettir (kişi detayıyla aynı tanım).
- **Açık tutar listesi:** Kalanı olan anlaşmalar ve başlangıç kayıtları vade gruplarına (gecikmiş, yaklaşan 30 gün, daha sonra, vadesi belirlenmemiş) ayrılır; her grupta kalan borç ve kalan alacak ayrı toplanır.
- **Dosya biçimleri:** Excel'de "Özet" sayfasında başlık bilgileri ve özetler, her tablo ayrı sayfada; tutarlar TL sayı hücresi, tarihler tarih hücresidir. CSV UTF-8 BOM'lu ve `;` ayraçlıdır; tutar binlik ayraçsız ondalık virgüllü (`12500,50`), tarih `GG.AA.YYYY` biçimindedir. PDF yatay A4'tür; uzun tablolar sayfalara bölünür ve başlık satırı her sayfada tekrarlanır. PDF okunabilir döküm olduğu için paylar, kaynak işlem no, sisteme girilme zamanı ve takip başlangıcı sütunları yalnız Excel ve CSV'dedir. PDF'de bitişik harfler ("fi") kapalıdır; yoksa kopyalanan metinde "firma" "frma" çıkıyordu. Gelir yeşil, gider kırmızıdır; kalan borç/alacak bakiyedir ve `ink` renginde yazılır.
- **Dosya adı:** Türkçe harfleri sadeleşmiş ASCII ad ve İstanbul günüyle verilir (ör. `santiye-raporu-kadikoy-villa-2026-10-15.pdf`). CORS ayarında `Content-Disposition` başlığı açıldı; web dosya adını sunucudan alır. Dosya ucunun hata cevabı web'de okunup mesaj olarak gösterilir.
- **Web:** `/uygulama/raporlar` dört sekmelidir (dönem dökümü, şantiye raporu, kişi/firma hesap dökümü, açık borç/alacak ve vade); şantiye sekmesi ve `/uygulama/projeler/:id/rapor` aynı görünümü kullanır. Her raporda Excel/CSV/PDF indirme menüsü vardır; tablolar telefonda kart listesine döner. "Bu sonuçları indir" telefonda da görünür, sonuç yoksa kapalıdır. Kişi detayındaki "Hesap dökümü indir" o kişinin hesap dökümünü bütün tarihlerle açar.
- **Yeni bağımlılıklar:** `exceljs`, `pdfkit` ve `@types/pdfkit` (şartname bölüm 2'de seçili kütüphaneler).
- **Firma yalıtımı:** Kimlikli yeni uçlar (şantiye raporu, hesap dökümü ve bunların dosyaları) firma yalıtım testine eklendi; kimliksiz raporların ve dosyaların başka firmanın kaydını içermediği ayrıca test edildi.
- **Kod yeri:** API'de `apps/api/src/services/reports.ts` (rapor verisi) ve `apps/api/src/reports/` (belge modeli, CSV, Excel, PDF yazıcıları); web'de `apps/web/src/features/reports/`. Rapor yer tutucusu kaldırıldı.
- **Açık noktalar:** İndirilen dosyalar gerçek Excel'de ve gerçek telefonda açılarak denenmedi. Yerel geliştirme veritabanında "Rapor Deneme Firması (Adım 6a)" deneme firması kaldı. Bu kararlar 16 Ekim 2026'da şartnameye işlendi: bölüm 2 (PDF, Excel, CSV satırları), 7.10, 9.1 (hesap yeri), 10.9 (dosya ucu) ve 11 (dosya adı ve hata cevabı). `pnpm dev` düzeltmesinin ayrıntısı, kodun yeri ve deneme firması yalnız bu belgede kaldı. Gerçek Excel ve telefonda açma denemesi ile yazı tipi klasörünün üretim dağıtımına dahil edilmesi Adım 10 görev metnine eklendi.

### 10.17. Adım 6b'de kabul edilen tam firma veri çıkışı kararları (16 Ekim 2026)

Adım 6b (tam firma veri çıkışı) tamamlandı ve kabul edildi. `POST /exports/full` işi kuyruğa alır ve arka planda hazırlar; `GET /exports/:id` durum, ilerleme ve paket hazırsa 5 dakika geçerli indirme adresi döner. Raporlar sayfasının altına filtrelerden bağımsız "Tüm firma verisi" paneli eklendi: "Tüm firma verisini dışa aktar" düğmesi, ilerleme çubuğu, hazır paketin boyutu, silineceği tarih ve indirme. `pnpm lint`, `pnpm typecheck`, `pnpm test` ve `pnpm build` temiz. Paketin başka firma verisi, şifre, kullanıcı adı veya token içermediği; içeriğin firma kayıt sayılarıyla tutarlı olduğu; belge eşleme tablosunun paketteki dosyalarla aynı küme ve aynı içerik olduğu; görüntüleme dönemindeki firmanın paket alabildiği; 7 gün sonra paketin silinip kapasitenin iade edildiği ve hazırlama hatasının finansal kayıtları ve kapasiteyi değiştirmediği testle doğrulandı. Panel gerçek API ile masaüstünde ve telefonda (375 px) denendi. Yerel MinIO'da 18 MB'lık belgeli 18,9 MB'lık paket çok parçalı yüklemeyle yazıldı, imzalı adresten indirildi ve standart zip aracıyla hatasız açıldı; kapasite dökümünün toplamı kullanılan alanla aynı çıktı.

Şartnamedeki boşluklar için kullanıcı dört karar verdi:

- **Excel ve CSV birlikte:** Şartnamedeki "Excel sayfaları veya CSV dosyaları" ikisi birden olarak uygulandı. Pakette tek `veri.xlsx` (Özet, "Tablolar ve ilişkiler" ve her tablo ayrı sayfa) ve `csv/` klasöründe her tablo için ayrı CSV dosyası ile `ozet.csv` bulunur. Kullanıcı biçim seçmez.
- **Hazır paket kapasitede sayılır, kota aşılabilir:** Paket her durumda hazırlanır ve firmanın kullanımına eklenir. Kota aşılırsa yeni belge yükleme paket silinene kadar 409 `STORAGE_FULL` alır; veri çıkışı hakkı (görüntüleme dönemi dahil) hiçbir zaman engellenmez. Hazırlanmakta olan paket kapasitede sayılmaz; yalnız hazır paket sayılır.
- **Süren iş varken yeni iş açılmaz:** Firmada bekleyen veya süren iş varsa `POST /exports/full` yeni iş açmaz, o işi 200 ile döner (çift tıklama ve ikinci cihaz). Uç şartname bölüm 3'teki `Idempotency-Key` listelerinde olmadığı için anahtar uygulanmaz; web yine gönderir. Hazır paket varken yeni istek yeni iş açar. Firma başına tek etkin iş veritabanında kısmi benzersiz indeksle korunur.
- **Yeni uç `GET /exports`:** Raporlar sayfası yeniden açıldığında ve başka cihazda son işi bulabilmek için firmanın son 5 işini (durum, ilerleme, boyut, silineceği tarih; indirme adresi olmadan) döner. Şartname 10.9'a eklenmesi gerekir.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **Paket düzeni:** Zip içinde tek kök klasör, adı dosya adıyla aynı: `tum-firma-verisi-<firma>-<İstanbul günü>.zip`. Tablolar: Hareketler, Paylar, İadeler (iade başına kaynak pay satırları), Anlaşmalar, Başlangıç kayıtları, Şantiyeler, Kişiler ve firmalar, Kategoriler, Belgeler (eşleme tablosu) ve Değişiklik geçmişi. Her tabloda "Kimlik" sütunu vardır; ilişkiler "... kimliği" sütunlarıyla kurulur ve "Tablolar ve ilişkiler" tablosunda kayıt sayıları, silinmiş kayıt sayıları ve bağlantılarla açıklanır. Orijinal belgeler `belgeler/<belge kimliği>-<sadeleşmiş ad>.<uzantı>` adıyla konur; asıl dosya adı eşleme tablosundadır. Önizlemeler pakete konmaz.
- **Durum etiketi:** Silinmiş ama geri alınabilir kayıtlar "Silindi (geri alınabilir)", diğerleri "Geçerli" etiketlidir; silen, zaman ve gerekçe ayrı sütunlardadır. Silinmiş kayıtlar toplamlara katılmaz.
- **Belgeler:** Eşleme tablosunda ve pakette yalnız yüklenmiş belgeler (silinmiş ama geri alınabilir olanlar dahil) bulunur. Yüklenmekte olan, başarısız ve süresi geçmiş yüklemeler yalnız değişiklik geçmişinde görünür. Depoda bulunamayan dosya paketi durdurmaz; eşleme tablosunda "Dosya depoda bulunamadı" notuyla listelenir.
- **Değişiklik geçmişi:** Firma, şantiye, kişi, kategori, hareket, anlaşma, başlangıç kaydı ve belgelerin kendi geçmişi (oluşturma, yükleme, silme, geri yükleme dahil) zamana göre tek tabloda; değişen her alan ayrı satır, kim, ne zaman ve gerekçeyle. Tutar alanları "40.000 TL" biçiminde, kişi ve kategori kimlikleri adlarıyla yazılır. Geçmiş işlem ve alan adlarının Türkçe karşılıkları `packages/shared` içine taşındı; ekran ve paket aynı adları kullanır.
- **Dışarıda kalanlar:** Kullanıcı adları, şifre hash'leri, refresh token'lar, ürün sahibinin işletim notu ve iç depo anahtarları pakete yazılmaz; kullanıcılar yalnız adlarıyla geçer.
- **Tek okuma ve toplamlar:** Bütün firma verisi tek MongoDB snapshot okumasından alınır. Özet sayfasındaki gerçekleşen hareket toplamları Hareketler tablosunun silinmemiş satırlarından `cashTotalsOfRows` ile, borç/alacak özetleri `summarizeObligations` ile hesaplanır; tam veri çıkışı dönem dökümüyle aynı toplamı verir.
- **Arka plan işi:** İş API sürecinde çalışır; ilerleme veriler okununca %10, tablolar yazılınca %15, sonra belge baytlarına göre artar. Süren işin 10 dakikalık kilidi ilerledikçe uzatılır. Dakikada bir çalışan tarama kilidi düşen işi (ör. sunucu yeniden başladı) yeniden kuyruğa alır, üçüncü denemeden sonra başarısız sayar; süresi dolan paketleri siler ve bekleyen işleri hazırlar. Sorgular firma bazında yapılır.
- **Depoya yazma:** Paket depoya akışla, 16 MB'lık parçalarla çok parçalı yükleme olarak yazılır (`@aws-sdk/client-s3` komutlarıyla; yeni depo kütüphanesi eklenmedi). Belgeler tek tek okunur; bellekte en fazla bir belge bulunur. Her deneme kendine özgü anahtara yazar; hata olursa yarım yükleme iptal edilir.
- **Hata:** Hazırlama yalnız okur; hata işi `failed` yapar ve "Paket hazırlanamadı. Finansal kayıtlarınız etkilenmedi; yeniden deneyebilirsiniz." gösterilir. Kullanıcı yeni iş başlatabilir.
- **7 gün:** Hazır paketin silineceği an hazır olma + 7 gündür. Süresi geçen paket tarama beklenmeden indirilemez (`expired: true`, indirme adresi yok). Tarama dosyayı siler ve kapasiteyi bir kez iade eder; iş kaydı durumu `ready`, `expired: true` olarak kalır. ExportJob modelinde yeni durum değeri açılmadı.
- **Erişim:** `POST /exports/full` okuma sayılır; görüntüleme döneminde de açıktır. `GET /exports/:id` firma yalıtım testine eklendi; başka firmanın işi 404 döner ve listede görünmez.
- **Web:** Panel bekleyen veya süren iş varken 2 saniyede bir yenilenir; sayfadan ayrılınca iş sürer. İndirme düğmesi her tıklamada yeni 5 dakikalık adres alır ve dosyayı `attachment` olarak açar.
- **Yeni bağımlılıklar:** `archiver` 8 (şartname bölüm 2'de seçili) ve `@types/archiver`. Testlerde zip okumak için yeni bağımlılık eklenmedi; küçük bir test yardımcısı kullanıldı.
- **Kod yeri:** API'de `apps/api/src/services/exports.ts` (iş, tarama, zip), `apps/api/src/reports/full-export.ts` (tablolar ve özet), `apps/api/src/models/export-job.ts`, `apps/api/src/lib/background.ts`; web'de `apps/web/src/features/reports/FullExportPanel.tsx`.
- **Açık noktalar:** Çok büyük firmalarda tek snapshot okumasının MongoDB'nin 60 saniyelik transaction süresini aşma olasılığı ve Excel dosyasının bellekte üretilmesi gerçek hacimle ölçülmedi. Sunucu çökerse yarım kalan çok parçalı yükleme depoda kalabilir; üretim deposunda `companies/*/exports/` için yarım yüklemeleri temizleyen yaşam döngüsü kuralı önerilir. Excel ve CSV dosyaları gerçek Excel'de ve telefonda açılarak denenmedi; tarayıcıdan gerçek dosya kaydı yapılmadı (indirme adresi API üzerinden doğrulandı). Yerel geliştirme veritabanında "Tam Veri Deneme Firması (Adım 6b)" deneme firması kaldı. Bu kararlar 16 Ekim 2026'da şartnameye işlendi (bölüm 10.18).

### 10.18. Tam veri çıkışı kararlarının şartnameye işlenmesi (16 Ekim 2026)

10.17 şartnameye işlendi: bölüm 3 (`POST /exports/full` anahtar listelerinde yok, tek etkin iş kuralıyla korunur), 7.10 (panel, tek etkin iş ve tek hazır paket, paket düzeni, durum etiketi, belgeler, değişiklik geçmişi, dışarıda kalanlar, tek okuma, arka plan işi, hata ve süre), 8.10 (ExportJob'un gerçek alanları; `expired` türetilir), 9.6 (kapasitede yalnız hazır paket sayılır, kota yalnız paket yüzünden aşılabilir; `exports/` yaşam döngüsü kuralı), 10.9 (`POST /exports/full` 200/201, yeni `GET /exports`, `GET /exports/:id`) ve 12 (hata metni). AGENTS.md'nin 6. kuralına tam veri çıkışının korunma biçimi eklendi. Kod yeri, bağımlılıklar ve deneme firması yalnız bu belgede kaldı.

İnceleme sırasında bulunan iki sorun ve kullanıcının kararı:

- **Hazır paketler birikiyordu:** Hazır paket varken yeni istek yeni iş açıyor, önceki paket silinmiyordu; kota da aşılabildiği için firma başına depolama (ve maliyet) sınırsız büyüyebiliyordu. Kullanıcı şu kuralı seçti: yeni paket hazır olunca önceki hazır paket silinir ve kapasitesi iade edilir; firmada en fazla bir hazır paket bulunur, yeni iş başarısız olursa önceki paket süresi dolana kadar indirilebilir kalır. Kod düzeltmesi Adım 7a'nın ilk işi ("Önce") olarak görev metnine eklendi; şartname kuralı şimdiden bu biçimde yazıldı.
- **10.13'teki "kota hiçbir durumda aşılmaz" cümlesi:** 10.17 ile geçersiz kaldı. Şartname 9.6'da "belge yüklemesi kotayı aşmaz; kotayı yalnız hazır dışa aktarma paketi aşabilir" diye düzeltildi.

Ayrıca kabul edildi: büyük firma ölçümü (tek snapshot okumanın 60 saniyelik transaction sınırı ve Excel'in bellek kullanımı), paket içindeki dosyaların gerçek Excel ve telefonda açılması ve tarayıcıdan gerçek indirme Adım 10'a; `companies/*/exports/` yaşam döngüsü kuralı ve API sürecinin sürekli açık kalması gereği Adım 10'un canlıya hazırlık notuna eklendi. Barındırma kararına (10.4) "API sürekli açık kalmalı" ölçütü yazıldı. Kod düzeltmesi Adım 7a'da yapıldı (bölüm 10.19).

### 10.19. Adım 7a'da kabul edilen yönetim API'si kararları (16 Ekim 2026)

Adım 7a (ürün sahibi yönetimi: kalan API) tamamlandı ve kabul edildi. Önce 10.18'deki tek hazır paket düzeltmesi yapıldı; ardından firma listesi ve işletim özeti, firma düzenleme (`PATCH /platform/companies/:id`), kullanıcı adı ve ad değiştirme, kapasite, geçici durdurma, hizmeti sonlandırma (`?preview=1` önizlemesiyle), yeniden açma, arşiv uzatma ve kalıcı silme uçları eklendi. `pnpm lint`, `pnpm typecheck`, `pnpm test` (shared 217, API 291, web 78 test) ve `pnpm build` temiz. Firma açılışından hizmet sonuna kadar akış (görüntüleme dönemi → arşiv → silme onayı → kalıcı silme), kalıcı silinen firmanın hiçbir verisinin ve belgesinin kalmaması, yeniden açılamaması, başka firmanın etkilenmemesi, bütün işlemlerin işlem yapan, zaman ve gerekçeyle işletim geçmişinde olması ve hiçbir kayıtta şifre bulunmaması testle doğrulandı. Silmenin başarısız olup yeniden başlatılması ve müşteri oturumunun yönetim uçlarını kullanamaması da testlidir.

**Tek hazır paket (10.18 düzeltmesi):** Yeni paket `ready` olunca aynı firmanın diğer hazır paketleri süre dolumuyla aynı yoldan silinir ve kapasiteleri bir kez iade edilir; dakikalık tarama da aynı temizliği yapar, böylece sunucu tam o anda durursa bile en geç sonraki taramada tek paket kalır. Değiştirilen paketin iş kaydı `ready`, `expired: true` olarak kalır; yeni durum değeri açılmadı. Yeni iş başarısız olursa önceki paket süresi dolana kadar indirilebilir. İki ardışık paketten sonra yalnız sonuncusunun kaldığı ve kapasitenin yalnız onu saydığı, yeni iş başarısız olunca önceki paketin durduğu, tarama ile değiştirme aynı paketi silmeye çalışınca kapasitenin bir kez iade edildiği testle doğrulandı.

Şartnamedeki boşluklar için kullanıcı altı karar verdi:

- **Kalıcı silinen firmanın asgari iz kaydı:** Company belgesi silinmez; yalnız ad, hizmet tarihleri ve `deletionStatus: done` kalır. Görünen ad, iletişim, işletim notu, firma geçmişi, kullanım ve kayıt sayacı sıfırlanır. Böylece silme durumu (bekliyor / sürüyor / tamamlandı / başarısız) izlenebilir ve yeniden açma 409 ile reddedilir.
- **`PATCH /platform/companies/:id` 7a'da yapıldı:** Ad, iletişim ve işletim notu; `expectedUpdatedAt` ile çakışma kontrolü, gerekçe isteğe bağlı, değişiklikler işletim geçmişine yazılır.
- **Ad ve kullanıcı adı değişiminde gerekçe isteğe bağlı:** Bölüm 9.8'deki listeye uyar. Aktiflik değişiminde gerekçe zorunlu kalır. `PATCH /platform/users/:id` ad, kullanıcı adı ve aktifliği birlikte alır; kullanıcı adı çakışması 409 `USERNAME_EXISTS`.
- **Kapasite eşiği:** Kullanım kotanın %90'ına ulaşınca "yaklaşan", tamamına ulaşınca "dolu".
- **Görüntüleme süresi biten:** Görüntüleme dönemi bugünden itibaren 7 gün içinde bitecek firmalar. Süresi bitmiş olanlar arşiv saklama filtresinde görünür.
- **Yaklaşan saklama bitişi:** İşletim özetinde silme onayı bekleyenlerden ayrı olarak, arşiv saklaması 30 gün içinde bitecek firmalar da gösterilir (7.7'deki "yaklaşan saklama bitişi").

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **Firma listesi:** Arama Türkçe harf ve büyük/küçük harf farkı gözetmez (`foldTurkish`); sıralama Türkçe alfabeye göredir. Adım 2'deki MongoDB `regex` araması bu yüzden bellek içi aramaya çevrildi; durum filtresi zaten bellekteydi. Cevaba filtreden bağımsız `summary` eklendi: `storageFull`, `storageNearFull`, `viewEnding`, `retentionEnding`, `deletionPending`; her öğede kimlik, ad, durum, kullanım, kota, `viewUntil` ve `retainUntil`. Kalıcı silme başlamış firmalar özete girmez. Silinmiş (iz kaydı kalan) firmalar listede `deletionStatus: done` ve `deleting` durumuyla görünür; beş durum filtresinin hiçbirine girmez.
- **Firma detayı:** Kalıcı silme ekranı için `contents` eklendi: hareket, anlaşma (başlangıç kayıtları dahil), şantiye, kişi ve belge (yüklenmiş ve yüklenmekte) sayıları; silinmiş ama geri alınabilir kayıtlar dahil. Ürün sahibi kayıtların kendisini görmez.
- **Kapasite:** `POST /quota` kotayı mevcut kullanımın altına indirmez (409 `CONFLICT` "Kapasite mevcut kullanımın altına indirilemez."); kontrol koşullu güncellemeyle atomiktir. Değer aynıysa kayıt düşülmez.
- **Geçici durdurma:** Hizmet sonu tarihlerine dokunmaz; erişim bir sonraki istekte kapanır. Aynı durum yeniden istenirse işlem ve kayıt yapılmaz.
- **Hizmeti sonlandırma:** Yürürlük günü İstanbul gününe göre bugünden önce olamaz (400). İleri tarih seçilebilir; firma o güne kadar aktif kalır. `?preview=1` yazmaz, gerekçe istemez ve `{ preview, name, effectiveDate, serviceEndedAt, viewUntil, retainUntil }` döner. Hizmeti zaten sonlandırılmış firmada süreler yeniden başlatılamaz (409); tarih değiştirmek için önce yeniden açılır (8.10'daki "süreleri sıfırlamanın yolu olmasın").
- **Yeniden açma:** Kalıcı silme başlamadıkça (silme onayı bekleyen firma dahil) açıktır; hizmet sonu tarihlerini temizler, geçici durdurmaya dokunmaz. Eski tarihler işletim geçmişinde kalır. İleri tarihli sonlandırmayı iptal etmek için de kullanılır.
- **Arşiv uzatma:** Yalnız hizmeti sonlandırılmış firmada; yeni bitiş mevcut bitişten sonra ve bugünden önce olmamalı. `viewUntil` değişmez, müşteri erişimi açılmaz.
- **Kalıcı silme:** Yalnız silme onayı bekleyen firmada veya başarısız silmenin yeniden başlatılmasında. Firma adı (ürün sahibinin kaydettiği `name`) kırpılarak birebir yazılmalıdır; büyük/küçük harf ve Türkçe harf farkı kabul edilmez. Uç 202 döner, silme arka planda sürer: açık dışa aktarma işleri iptal edilir, depoda `companies/<firma>/` altındaki bütün nesneler silinir ve yarım çok parçalı yüklemeler iptal edilir, `companyId` alanı olan bütün koleksiyonlardaki firma verisi (kullanıcılar, güvenli tekrar kayıtları ve arama geçmişi dahil) silinir, son olarak sürmekte olan bir isteğin yazmış olabileceği dosyalar için depo bir kez daha temizlenir. Hata `failed` yapar ve işletim geçmişine yazılır; ürün sahibi silmeyi yeniden başlatabilir, adımlar tekrar çalıştırılabilir. Silme başlamış firmada yeniden açma, düzenleme, kapasite, durdurma, arşiv uzatma ve kullanıcı ekleme 409 döner. Silinen firmanın kullanıcıları kalmadığı için girişleri 401'dir.
- **İşletim geçmişinin asgari kaydı:** Kalıcı silmede firmanın işletim kayıtları silinmez. Ad, tarih, kapasite ve durum içeren kayıtların (firma oluşturma, kapasite, durdurma, hizmet sonu, yeniden açma, arşiv uzatma, silme) ayrıntısı korunur; kişi verisi taşıyan kayıtlarda (kullanıcı işlemleri, firma düzenleme) `changes` temizlenir. İşlem yapan, zaman ve gerekçe her kayıtta kalır. Silme tamamlanınca firma adı ve silinen kayıt/dosya sayılarıyla `company.delete_completed` yazılır.
- **İşletim geçmişi işlem adları:** `company.update`, `company.quota`, `company.suspend`, `company.unsuspend`, `company.end_service`, `company.reopen`, `company.extend_retention`, `company.delete`, `company.delete_completed`, `company.delete_failed`, `user.update` (Adım 2'dekilere ek). Ekranda Türkçe karşılıkları 7b'de verilecek.
- **Güncelleme zamanı:** Kapasite, durdurma ve hizmet yaşam döngüsü işlemleri firmanın `updatedAt` değerini değiştirmez; böylece müşterinin açık firma bilgisi formu çakışma almaz. Ad, iletişim ve not düzenlemesi `updatedAt`'i değiştirir.
- **Yarıda kalan silme:** API açılışta `running` durumundaki silmeleri `pending`'e alır ve bekleyen silmeleri dakikada bir yürütür. Bu, API'nin tek süreçte çalışması varsayımına dayanır (7.10); birden fazla sunucuya geçilirse kilitle korunmalıdır.
- **Depo:** `ObjectStorage`'a `removePrefix` eklendi. Nesneler toplu silme (DeleteObjects) yerine tek tek silinir; R2 ve MinIO'daki sağlama toplamı farkları sorun çıkarmaz, işlem seyrek olduğu için hız önemli değildir. Yeni bağımlılık eklenmedi.
- **Kod yeri:** `apps/api/src/services/platform-management.ts` (liste, özet, düzenleme, kapasite, yaşam döngüsü), `apps/api/src/services/company-deletion.ts` (kalıcı silme ve tarama), `apps/api/src/services/service-state.ts` (`serviceEndDates`), `packages/shared/src/account-schemas.ts` (yeni giriş şemaları; `platformUserActivationSchema` yerine `platformUserUpdateSchema`).
- **Açık noktalar:** `removePrefix` yalnız bellek içi depoyla test edildi; gerçek MinIO/R2 üzerinde denenmedi. 8.10'daki "yedekten çıkarma son tarihi" takibi yapılmadı; yedekleme yöntemi açık olduğu için (bölüm 11) Adım 10'a kalır. Yönetim ekranları ve işlem adlarının Türkçe karşılıkları Adım 7b'dedir. Bu kararlar 16 Ekim 2026'da şartnameye işlendi (bölüm 10.20).

### 10.20. Yönetim API'si kararlarının şartnameye işlenmesi (16 Ekim 2026)

10.19 şartnameye işlendi: bölüm 3 (tek süreç), 7.13 (özet grupları ve eşikleri, arama, firma ve kullanıcı düzenleme, kapasite, yaşam döngüsü, kalıcı silme adımları ve 409'lar), 8.1 (iz kaydı, `updatedAt` kuralı), 8.10 (PlatformLog asgari kaydı ve işlem adları), 9.8 (yönetim gerekçesi), 9.10 (sonlandırma, yeniden açma, arşiv uzatma), 10.10 (`summary`, `contents`, `PATCH` alanları, önizleme cevabı, 400/409, 202) ve 12. Kod yeri, `removePrefix` ayrıntısı ve şema adları yalnız bu belgede kaldı.

İnceleme sırasında kullanıcı üç karar verdi:

- **Silmesi tamamlanmayan firmalar özette:** `summary` yalnız silme başlamamış firmalardan hesaplanıyordu; bekleyen, süren veya başarısız silme hiçbir özet grubunda ve filtrede görünmüyordu (8.10.1 "silme işlemi tamamlanmayı bekleyen firmalar özetlensin"). `summary`'ye bu firmalar için ayrı grup eklenecek; API işi Adım 7b'nin ilk işi ("Önce") oldu. Şartname 7.13 ve 10.10 bu kuralla yazıldı. Tamamlanmış silmeler listede "Silindi" durumuyla kalır, özete girmez.
- **Tek süreç kuralı:** Giriş deneme sınırı, kalıcı silme taraması ve bellek içi firma araması API'nin tek süreçte çalışmasına dayanıyordu ama bu hiçbir yerde açık yazmıyordu. Şartname bölüm 3'e "İlk sürümde API tek süreç olarak çalışır; birden fazla sürece geçilirse deneme sınırı paylaşılan depoya, silme taraması kilide taşınır" kuralı eklendi; 10.4'teki barındırma ölçütüne de yazıldı.
- **"Yeniden aç, sonra sonlandır" yolu kabul edildi:** 8.10.6 "hizmeti sonlandırılmış firmada süreleri sıfırlamanın yolu olmasın" der; doğrudan yeniden sonlandırma 409'dur. Yeniden açıp yeni tarihle sonlandırmak süreleri baştan başlatır; iki ayrı işlem olduğu, ikisi de işletim geçmişine yazıldığı ve yürürlük günü geçmişe çekilemediği için müşterinin görüntüleme süresi yalnız uzayabilir. Bu yol bilinçli olarak kabul edildi ve şartname 9.10'a yazıldı.

Ayrıca: kalıcı silmenin depo temizliğinin gerçek MinIO'da denenmesi ve yedekten çıkarma son tarihinin takibi Adım 10 görev metnine eklendi. İşletim geçmişinde silmeden sonra kalan gerekçe metinleri ve firma adı KVKK değerlendirmesine soru olarak eklendi (bölüm 11).

### 10.21. Adım 7b'de uygulanan yönetim ekranları kararları (16 Ekim 2026)

Adım 7b (ürün sahibi yönetimi: ekranlar) tamamlandı. "Önce" işinde 10.20'deki özet grubu eklendi. Ardından yönetim girişi, zorunlu güvenlik kurulumu, güvenlik sayfası, işletim özeti ve firma listesi, firma oluşturma, firma detayı, kullanıcı, kapasite ve hizmet yaşam döngüsü dialogları ve kalıcı silme ekranı yapıldı. `pnpm lint`, `pnpm typecheck` ve `pnpm build` temiz. `pnpm test`'te shared 217, API 295 ve web 89 test geçti; bir tam çalıştırmada ilgisiz bir müşteri giriş testi bir kez kaldı (açık noktalar). Masaüstünde ilk kurulumdan kalıcı silmeye kadar akış ekrandan çalıştı: kurulum, firma oluşturma, kullanıcı ekleme, kullanıcı adı değiştirme, pasifleştirme, kapasite, önizlemeli hizmet sonu, 180 gün sonra silme onayı, firma adıyla onaylı kalıcı silme. Oturum süresinin dolması ve TOTP yeniden kurulumu da denendi. Bu deneme bellek içi MongoDB replica set, bellek içi depo ve ileri alınabilir saatle çalışan geçici bir API ile yapıldı; geçici sunucu depoya girmedi. Telefonda (375 px) özet, liste, detay ve menü yatay taşma olmadan çalıştı. Geçici şifrenin ve kurtarma kodlarının yalnız bir kez gösterildiği, tarayıcı deposuna ve adres geçmişine yazılmadığı testle ve tarayıcıda doğrulandı.

Şartnamedeki boşluklar için kullanıcı iki karar verdi:

- **Giriş sonrası TOTP yeniden kurulumu için küçük API:** Şartname 7.13 ve 5.3 "giriş sonrası TOTP yeniden kurulabilir" der, ama `/platform/auth/totp/setup` yalnız ara token ile ve kurulum yapılmamışsa çalışıyordu. 7b "Önce işi dışında API değişikliği yapma" dediği için soruldu; iki oturumlu uç eklendi:
  - `POST /platform/auth/totp/reset` yeni anahtar ve QR adresi döner.
  - `POST /platform/auth/totp/reset/confirm` yeni uygulamadaki kodla onaylar.

  Yeni anahtar onaylanana kadar eski anahtar geçerli kalır; onayda eski anahtar geçersizleşir ve PlatformLog'a `admin.totp_reset` yazılır. Kurtarma kodları değişmez; gerekirse ayrıca yenilenir. Hatalı kodlar mevcut deneme sınırına sayılır.
- **QR kütüphanesi:** Web'e `qrcode-generator` eklendi (MIT, bağımlılıksız, kendi TS tipleri var). QR tarayıcıda SVG olarak çizilir; gizli anahtar dış servise gönderilmez ve elle giriş için ayrıca yazılı gösterilir.

Uygulamada belirlenen ve sonraki adımları bağlayan noktalar:

- **Kurtarma koduyla yeniden kurulum:** `totp/reset` başlatma isteği mevcut 6 haneli kodun yanında kullanılmamış bir kurtarma kodunu da kabul eder; kullanılan kod geçersizleşir. Yalnız TOTP koduyla başlatılsaydı, telefonunu kaybedip kurtarma koduyla giren ürün sahibi yeniden kurulum yapamazdı. Bu ayrıntı kullanıcıya sunulan seçenekte yoktu; şartnameye işlenirken onaylanmalı.
- **Özet grubu (`deletionIncomplete`):** `summary`'deki altıncı grubun adı `deletionIncomplete`'tir. Bekleyen, süren ve başarısız silmeler ad sırasıyla bu gruba girer; tamamlanmış silmeler girmez. Bütün özet öğeleri artık `deletionStatus` da taşır. Bu firmalar beş durum filtresinin hiçbirine girmez; listede silme durumlarıyla görünür. Başarısız silme bu gruptan "Silmeyi yeniden başlat" ile kalıcı silme ekranına gider.
- **Ayrı yönetim oturumu:** Ürün sahibi oturumu müşteri oturumundan ayrı saklanır ve ayrı yenilenir (`/platform/auth/refresh`); müşteri oturumu yönetim alanını açmaz. Şifre adımından sonraki ara token yalnız bellekte tutulur. Oturum düşünce "Oturumunuz sona erdi" notuyla yönetim girişine dönülür.
- **Kod doğrulayan oturumlu istekler:** Kurtarma kodu yenileme ve TOTP yeniden kurulumu isteklerinden hemen önce oturum yenilenir. Böylece 401 yalnız "kod hatalı" anlamına gelir; hatalı kod otomatik yeniden denemeyle iki kez sayılmaz.
- **Bir kez gösterim:**
  - Kurtarma kodları ve geçici şifre yalnız bileşen durumunda tutulur; tarayıcı deposuna ve adres geçmişine yazılmaz.
  - Kurtarma kodları indirilebilir (`.txt`) ve kopyalanabilir; "Kodları güvenli bir yere kaydettim" işaretlenmeden devam edilemez.
  - Geçici şifre dialogu "Şifreyi kaydettim veya müşteriye ilettim" işaretlenmeden kapanmaz.
  - Aynı `Idempotency-Key` ile tekrar gelen kullanıcı oluşturma cevabında şifre yoktur; API'nin açıklama mesajı gösterilir.
- **Güvenli tekrar:** Firma ve kullanıcı oluşturma `Idempotency-Key` ile gider. Müşteri tarafındaki `/idempotency/:key` sorgusu yönetimde olmadığı için, cevap alınamazsa aynı istek aynı anahtarla yeniden gönderilir.
- **Yaşam döngüsü dialogları:**
  - Hizmeti sonlandırmada son görüntüleme günü ve saklama bitişi seçili tarihin API önizlemesiyle (`?preview=1`) kesin tarih olarak gösterilir; onay yalnız seçili tarihin önizlemesi gelince açılır.
  - Yeniden açma ve arşiv uzatma "önce → sonra" tarih kutusu gösterir.
  - Kapasite GB olarak girilir (1 GB = 1024³ bayt, virgüllü ondalık kabul edilir); kullanımın altındaki değer ekranda engellenir, sunucu da 409 döner.
  - Geçici durdurma ve kullanıcı pasifleştirme gerekçe ister.
- **Kalıcı silme ekranı:** Firma adı, durum, saklama bitişi, kullanıcı ve kayıt sayıları ile geri döndürülemez sonuç gösterilir. Kayıtlı ad kırpılıp birebir yazılmadan düğme açılmaz; büyük/küçük ve Türkçe harf farkı kabul edilmez. Silme sürerken detay sayfası durumu 3 saniyede bir yeniler.
- **İşletim geçmişi:**
  - İşlem adları Türkçe gösterilir; Adım 2'deki hesap işlemleri ve `admin.*` olayları da etiketlidir.
  - Kullanıcı işlemlerinde hedef kullanıcının adı yazılır.
  - Kalıcı silme tamamlanınca silinen kayıt ve dosya sayıları koleksiyon adlarının Türkçe karşılıklarıyla gösterilir.
  - İşlem yapan, oturumdaki ürün sahibi ise kullanıcı adıyla, değilse "Ürün sahibi" olarak yazılır; API yalnız kimlik döndürür.
- **Görünüm:** Müşteri uygulamasıyla aynı token'lar ve bileşenler kullanılır. Yönetim alanı lacivert (`navy-deep`) menü, "Yönetim" işareti ve üst çubuktaki "Yönetim alanı" rozetiyle ayrılır. 1100 px altında menü drawer'dır; alt menü ve yüzen düğme yoktur. Yeni renk değeri eklenmedi.
- **Rotalar:** Şartname 5.3'teki rotalar kullanıldı. Firma düzenleme ayrı rota yerine firma detayında dialogdur, çünkü 5.3'te düzenleme rotası yok.
- **Kod yeri:**
  - API: `apps/api/src/services/platform-auth.ts` (yeniden kurulum), `apps/api/src/services/platform-management.ts` (özet grubu), `apps/api/src/models/platform-admin.ts` (`pendingTotpSecretEncrypted`)
  - Paylaşılan paket: `packages/shared/src/account-schemas.ts` (`totpResetStartSchema`)
  - Web: `apps/web/src/features/admin/`, `apps/web/src/components/layout/AdminShell.tsx`, `apps/web/src/api/admin-client.ts`, `admin-queries.ts`, `admin-types.ts`, `apps/web/src/stores/admin-session.ts`, `apps/web/src/lib/admin-labels.ts`, `apps/web/src/styles/admin.css`
- **Açık noktalar:**
  - `apps/api/test/customer-auth.test.ts` içindeki "aynı IP'den çok sayıda hatalı deneme" testi bir tam çalıştırmada kaldı; tek başına üç kez ve tam API paketinde yeniden geçti. 7b o koda dokunmadı; yük altında kararsız görünüyor.
  - "Kodları indir" düğmesiyle tarayıcıdan gerçek dosya kaydı yapılmadı; yalnız düğme test edildi.
  - Bu kararlar 16 Ekim 2026'da şartnameye işlendi (bölüm 10.22).

### 10.22. Yönetim ekranları kararlarının şartnameye işlenmesi (16 Ekim 2026)

10.21 şartnameye işlendi: bölüm 2 (`qrcode-generator`), 5.3 (firma düzenleme dialogu, başarısız silmenin yeniden başlatılması, yönetim alanının görünümü), 7.13 (`deletionIncomplete` grubu; TOTP yeniden kurulumu; kurtarma kodlarının indirilmesi ve onay kutusu; kod doğrulayan isteklerden önce oturum yenileme; ayrı yönetim oturumu; bir kez gösterim; yönetimde güvenli tekrar; kapasitenin GB = 1024³ bayt girilmesi; yaşam döngüsü ve silme dialogları; işletim geçmişinin gösterimi), 8.10 (`pendingTotpSecretEncrypted`, `admin.totp_reset`) ve 10.10 (`/platform/auth/totp/reset` ve `/reset/confirm`, `summary.deletionIncomplete`, özet öğelerinde `deletionStatus`). 10.20'de şartnameye "silmesi tamamlanmayanlar" diye yazılan grubun adı `deletionIncomplete` olarak düzeltildi. Kod yeri yalnız bu belgede kaldı.

İnceleme sırasında kullanıcı iki karar verdi:

- **Kurtarma koduyla yeniden kurulum onaylandı:** TOTP yeniden kurulumu mevcut 6 haneli kodla veya kullanılmamış bir kurtarma koduyla başlatılabilir. Şartname 7.13'teki "telefon kaybolunca kurtarma koduyla gir, sonra TOTP'yi yeniden kur" akışı ancak böyle mümkündür. Yeni bir açık getirmez: şifreyi ve kurtarma kodunu bilen zaten girebilir, yeniden kurulum ayrıca bir kurtarma kodu harcar.
- **Kararsız `customer-auth` testi Adım 8'in ilk işi:** "Aynı IP'den çok sayıda hatalı deneme" testinin ara sıra düşmesinin gerçek nedeni Adım 8'in başında ("Önce") bulunup düzeltilecek; demo açma sınırı da aynı altyapıyı kullanır. Adım 8 görev metnine ayrıca "Okunacaklar" satırı ve lint/typecheck/test/build bitiş ölçütü eklendi.

Ayrıca "Kodları indir" düğmesiyle gerçek dosya kaydı Adım 10'un kontrol listesine eklendi.

## 11. Açık ürün ve teknik kararlar

- Barındırma sağlayıcısı, veritabanı paketi, yedekleme yöntemi ve aylık maliyet (zamanlama 10.4). İptal edilen teknik plandaki kademeli düşük maliyet yaklaşımı ve pilotta en fazla 24 saatlik veri kaybı kabulü artık bağlayıcı değil; yeniden kararlaştırılacak.
- Alan adı ve iletişim metni (`SUPPORT_CONTACT_TEXT`).
- KVKK hukuki değerlendirmesi: veri işleme sözleşmesi, aydınlatma metni ve kullanılacak bütün sağlayıcılar için yurt dışı aktarım. Altyapı seçimini etkileyebilir; gerçek müşteri verisinden önce sonuçlanmalı. Danışmana ayrıca sorulacak: kalıcı silmeden sonra işletim geçmişinde kalan firma adı ve serbest metin gerekçeler (kişi adı içerebilir) ne kadar ve hangi biçimde saklanabilir (10.20).
- Hizmet sonu kalıcı silmeden sonra yedekten çıkarma işleminin teknik yöntemi ve son tarihinin takibi (kurallar 7.7'de kabul edildi; ana sistemden kalıcı silme Adım 7a'da yapıldı, bölüm 10.19).
- Sonraki sürümdeki hatırlatma kanalları ve gönderim kuralları.
- Sonraki sürümde gerekirse ayrıntılı müşteri rolleri ve şantiye erişim kısıtları; ilk sürümde bütün firma şantiyelerine eşit erişim.
- Sonraki sürümde Excel içe aktarımının ayrıntıları.
- Sonraki sürümde çevrimdışı kullanım ve kalıcı taslak saklama ayrıntıları.
- Paketler, satış modeli, ücretler ve ek depolama fiyatları.
- Pilot müşteri seçimi, pilot süresi ve pilot başarı ölçütleri.

## 12. Karar geçmişi

| Tarih | Karar / gelişme |
|---|---|
| 4 Ekim 2026 | Mevcut mobil özellik raporu incelendi; farklı müteahhitlere satılacak web ürününe dönüşüm hedefi kaydedildi. |
| 4 Ekim 2026 | Kullanıcı finansal ayrımlar, tahsil edilecek anlaşmalar, borç/alacak, vade, temel roller ve kayıt koruma yaklaşımını kabul etti. |
| 4 Ekim 2026 | Kullanıcı ek kolaylıkları, belge eklemeyi ve genel firma giderlerini kabul etti; uzun süreli depolama maliyetinin değerlendirilmesini istedi. |
| 4 Ekim 2026 | Belge yönetimi, kapasite/saklama yaklaşımı ve telefon odaklı web kullanımı kabul edildi. |
| 4 Ekim 2026 | Kullanım senaryoları → ilk sürüm kapsamı → ekranlar → teknik plan → geliştirme/pilot sırası kabul edildi. |
| 4 Ekim 2026 | Kullanıcı ayrı Markdown karar belgesi oluşturulmasını ve her aşama sonunda güncellenmesini istedi. Belge oluşturuldu; Aşama 1 başlatıldı. |
| 4 Ekim 2026 | Senaryo 1 için iş/ödeme durumu ayrımı, ek işin mevcut veya yeni anlaşmayla takibi ve bedel düşüşünde fazla ödemenin korunması kabul edildi. Senaryo 2 görüşme taslağı eklendi; yeni öneriler henüz onaylanmadı. |
| 4 Ekim 2026 | Senaryo 2 için isteğe bağlı vade, kısmi tahsilatın vadeyi ertelememesi, vade değişiklik geçmişi ve otomatik faiz/ceza uygulanmaması kabul edildi. Senaryo 3 görüşme taslağı eklendi; yeni öneriler henüz onaylanmadı. |
| 4 Ekim 2026 | Senaryo 3 için şantiye/anlaşma uyumu, otomatik mahsup yapılmaması, ödeme paylarının toplam tutarı koruması ve toplamların erişim izinlerine uyması kabul edildi. Senaryo 4 görüşme taslağı eklendi; yeni öneriler henüz onaylanmadı. |
| 4 Ekim 2026 | Senaryo 4 için düzeltme/iade ayrımı, geri alınabilir silme, tutarlı şantiye/anlaşma düzeltmesi ve finansal değişiklik gerekçesi kabul edildi. Senaryo 5 görüşme taslağı eklendi; yeni öneriler henüz onaylanmadı. |
| 4 Ekim 2026 | Senaryo 5 için açık borç/alacakla tamamlama, geç finansal kayıtlar, yeni işte yeniden aktifleştirme, arşivde açık tutarların korunması ve tarihli rapor yaklaşımı kabul edildi. Senaryo 6 görüşme taslağı eklendi; yeni öneriler henüz onaylanmadı. |
| 4 Ekim 2026 | Senaryo 6 için firma geneli kapsamı, ödenmemiş genel firma borçlarının takibi ve ayrı erişim izinleri kabul edildi. Senaryo 7 görüşme taslağı eklendi; yeni öneriler henüz onaylanmadı. |
| 5 Ekim 2026 | Senaryo 7 için belirsiz kaydetme sonucunu doğrulama, güvenli tekrar, belge/finansal kayıt durumlarını ayırma, açık formu koruma ve eşzamanlı değişiklikleri sessizce ezmeme kabul edildi. Yedi temel senaryo tamamlandı; dört finansal istisna önerisi görüşme taslağı olarak eklendi. Aşama 1 henüz kapatılmadı. |
| 5 Ekim 2026 | Anlaşma öncesi avans, ödemeli anlaşma iptali, iade tutar sınırı ve başlangıç borç/alacağında çift saymayı önleme kabul edildi. Aşama 1 tamamlandı. Aşama 2 için ilk sürüm/sonraki sürüm/kapsam dışı önerileri kaydedildi; henüz kullanıcı tarafından kabul edilmedi. |
| 5 Ekim 2026 | Kullanıcı kapsam ayrımını avans hariç kabul etti. Özel avans takibi ve sonradan anlaşmaya bağlama şimdilik ertelendi; normal kısmi ödeme/tahsilat ve başlangıç borç/alacakları kapsamda kaldı. Herkese açık yapay verili demo ve ürün sahibinin manuel açtığı gerçek müşteri hesapları modeli kabul edildi. Demo yalıtımı, sıfırlama, dosya sınırları ve ilk parola değişimi gibi ayrıntılar öneri olarak eklendi; henüz kabul edilmedi. |
| 5 Ekim 2026 | Demo yalıtımı/sıfırlama, tutarlı örnek veri, gerçek yükleme yerine örnek belge, kişisel hesaplar ve geçici ilk parola yaklaşımı kabul edildi. Müşterilerin güvendikleri ortak/aile üyeleriyle çalışması nedeniyle aynı firmadaki bütün kullanıcılar ilk sürümde eşit yetkili seçildi; ayrıntılı roller ve şantiye kısıtları ertelendi. Platform firma/kullanıcı hesabı yönetimi ürün sahibinde kaldı. Belge kapasite/limit önerileri henüz kabul edilmemiş taslak olarak eklendi. |
| 5 Ekim 2026 | Firma başına 20 GB, dosya başına 20 MB, işlem/anlaşma başına 10 belge; orijinal koruma, arşivin kapasiteye dahil olması ve kapasite dolduğunda finansal kayda devam etme kabul edildi. Hizmet sonu için 30 gün görüntüleme/dışa aktarma, toplam 180 gün saklama ve ürün sahibi onaylı silme yaklaşımı yeni öneri olarak kaydedildi; henüz kabul edilmedi. |
| 5 Ekim 2026 | Hizmet sonu için ilk 30 gün görüntüleme/dışa aktarma, toplam 180 gün arşiv, ürün sahibi onaylı silme, gerçek silme sonrası en geç 30 gün yedekten çıkarma ve hesap pasifleştirmeden ayrım kabul edildi. Aşama 2 tamamlandı; temel kabul ölçütleri toplandı. Aşama 3 sayfa haritası/gezinme/hızlı kayıt önerisi olarak başlatıldı; henüz kabul edilmedi. |
| 5 Ekim 2026 | Aşama 3 sayfa haritası, telefon/masaüstü gezinmesi ve şantiye/anlaşma bağlamından hızlı kayıt kabul edildi. Gelir/gider formunun zorunlu/isteğe bağlı alanları ve bağlantı davranışı yeni öneri olarak eklendi; henüz kabul edilmedi. |
| 5 Ekim 2026 | Gelir/gider formunun zorunlu alanları, isteğe bağlı muhatap/kategori/açıklama/belge, açık anlaşma bağlantısı, boş ödeme tutarı ve art arda kayıt yaklaşımı kabul edildi. Şantiye, kişi/firma, anlaşma ve başlangıç borç/alacak formları yeni öneri olarak eklendi; henüz kabul edilmedi. |
| 5 Ekim 2026 | Şantiye, kişi/firma, anlaşma ve başlangıç borç/alacak formları kabul edildi. Paylaştırma, iade, finansal düzeltme, bedel değişikliği, iptal ve silme/geri yükleme ekran akışları yeni öneri olarak eklendi; henüz kabul edilmedi. |
| 5 Ekim 2026 | Paylaştırma, iade, finansal düzeltme, bedel değişikliği, iptal ve silme/geri yükleme ekran akışları kabul edildi. Ekran planında arama/filtre, rapor/veri çıkışı, ekran durumları ve ürün sahibi yönetim akışları kaldı. Ardından teknik plan ve geliştirme/pilot planı hazırlanacak. |
| 5 Ekim 2026 | Kullanıcı ekran planı tamamlandığında açıkça bilgilendirilmesini istedi. Arama, filtreler, dönem hareketi/güncel bakiye ayrımı, iadelerin dönem etkisi, standart raporlar ve filtreli/tam veri çıkışı davranışları 8.8'de görüşme önerisi olarak eklendi; henüz kabul edilmedi. |
| 5 Ekim 2026 | Arama, filtreler, dönem/güncel bakiye ayrımı, iadelerin dönem etkisi, standart raporlar ve veri çıkışı kabul edildi. Boş/yükleniyor/hata ekranları, kaydetme sonucu, eşzamanlı değişiklik, belge hatası/kapasite, formdan ayrılma/oturum ve demo/görüntüleme geri bildirimleri 8.9'da yeni öneri olarak kaydedildi; henüz kabul edilmedi. Ekran planı henüz tamamlanmadı. |
| 5 Ekim 2026 | Ekran durumları, hata geri bildirimi, kaydetme sonucu, belge/kapasite, oturum ve demo/görüntüleme akışları kabul edildi. Ekran planının son bölümü olarak ürün sahibi firma/kullanıcı/kapasite/hizmet yönetimi, kullanıcı adıyla giriş, manuel parola kurtarma ve müşteri profil/firma bilgisi sınırları 8.10'da önerildi; henüz kabul edilmedi. Aşama 3 kapanışı bu bölümün kabulünü bekliyor. |
| 5 Ekim 2026 | Ürün sahibi yönetimi, kullanıcı adı/parola girişi, manuel parola kurtarma ve müşteri profil/firma bilgisi sınırları kabul edildi. Aşama 3 — ekranlar ve kullanım akışları tamamlandı. Kullanıcı teknik altyapıya henüz geçilmemesini istedi; Aşama 4 başlatılmadı. |
| 6 Ekim 2026 | Kullanıcı teknik plana geçti. Node.js + React + MongoDB; TypeScript, Express, yönetilen bulut (Atlas Frankfurt, Render, Cloudflare R2) ve tek deneyimli geliştirici varsayımı seçildi. Kuruş tabanlı para, paylı hareket modeli, transaction içinde önbellek güncellemesi, güvenli tekrar anahtarı, sürüm kontrolü, firma kapsamlı veri erişimi, ayrı demo veritabanı, belge yükleme/önizleme, yedekleme/silme yöntemi, test stratejisi ve maliyet tahmini içeren teknik plan bölüm 9'da kabul edildi. Aşama 4 tamamlandı; Aşama 5 bekliyor. |
| 8 Ekim 2026 | Codex incelemesinin bulguları kabul edildi ve plana işlendi: silme günlüğünün önce yazılması ve ayrı kontrol veritabanında tutulması; geri yükleme sonrası silmelerin yeniden uygulanması; geçici alana yükleyip değiştirilemez nihai anahtara taşıma; atomik belge sayacı ve kapasite rezervasyonu; finansal kaynakların `transactions` + `obligations` olarak tanımlanması; fazla ödemede gerekçe; güvenli tekrar anahtarının içerik bağlı ve 24 saat geçerli olması; her istekte hesaplanan hizmet erişimi ve izin tablosu; iş kuyruğunda kilit süresi, deneme sınırı ve tekrar çalıştırma güvenliği; iki aşamalı büyük dışa aktarma; KVKK'nın altyapıyı etkileyebileceği; Node 24 LTS; arama ölçümü; avansın testlerden çıkarılması; anlaşma ve takip başlangıç tarihlerinin modele eklenmesi. Kullanıcı ayrıca kademeli düşük maliyetli altyapıyı kabul etti: geliştirme/demo 0 USD; pilot ~7–10 USD/ay + alan adı (Atlas M0 + gece şifreli yedek, tek Render Starter sunucusu); pilotta en fazla 24 saatlik veritabanı kaybı riski. Yedekli veritabanı, ayrı worker ve belgelerin B2 kopyası büyüme kademesine bırakıldı. Ayrıntılı plan `teknik_plan/` klasörüne taşındı. |
| 11 Ekim 2026 | Kullanıcı `teknik_plan` klasöründeki teknik planı iptal etti; 6 ve 8 Ekim teknik plan kararları (kademeli altyapı, sağlayıcılar, 24 saatlik veri kaybı kabulü dahil) artık bağlayıcı değil. Yerine `santiye-hesap-web-prompt.md` esas alındı. Prompt, Şantiye Hesap tasarım sistemi ve sayfa yapısı korunarak bu belgedeki kurallarla güncellendi: firma ayrımı, ürün sahibinin açtığı hesaplar ve kullanıcı adıyla giriş, hesapsız demo, anlaşmanın gider yazmaması, ödenecek/tahsil edilecek anlaşmalar, başlangıç kayıtları, vade, iade, paylaştırma, firma geneli gider, kategoriler, belgeler, gerekçe ve geçmiş, güvenli tekrar, raporlar ve tam veri çıkışı, hizmet sonu erişimi, ürün sahibi yönetimi. Yalnız web ürünü yapılacak; mobil uygulama şimdilik yok. Tanıtım sitesi kapsama eklendi. |
| 11 Ekim 2026 | Aşama 5 geliştirme planı kabul edildi (bölüm 10): şartname tek parça kalacak, iş Adım 0–10 olarak oturumlara bölünecek; görev metinleri `gelistirme/gorev_metinleri.md`, ajan kuralları `AGENTS.md` ve `CLAUDE.md` dosyalarında. Ürün sahibi hesabı için zorunlu TOTP, 10 tek kullanımlık kurtarma kodu ve yalnız sunucuda çalışan sıfırlama komutu kabul edildi ve şartnameye işlendi. Açık kararların zamanlaması belirlendi; git deposunu kullanıcı kuracak. |
| 12 Ekim 2026 | Adım 0 (proje iskeleti) tamamlandı ve kabul edildi (bölüm 10.5). Geliştirme ortamı Node.js 24 LTS ve pnpm 12 olarak belirlendi; iptal edilen teknik plandaki Node 24 tercihi bu kez Adım 0 gerekçesiyle yeniden kabul edildi. MinIO resmi imajları dağıtılmadığı için yerel S3 deposu olarak `pgsty/minio` topluluk imajı seçildi; üretim deposu kararı açık kalır. TypeScript 6.0, MongoDB 8.2, `/health` cevap biçimi ve geliştirme ortamı varsayılanları kaydedildi. |
| 12 Ekim 2026 | Adım 1 (finans çekirdeği) tamamlandı ve kabul edildi (bölüm 10.6). Şartnamedeki boşluklar için üç karar alındı: ödeme durumu net ödenen/kalan/fazladan hesaplanır (bedel 0 ve ödeme yok → `settled`, tamamen iade edilmiş → `open`); para girişi katı tr-TR biçimindedir ve `12.5` gibi girdiler reddedilir; iadesi olan pay kaldırılamaz, hedefi değiştirilemez ve iade toplamının altına indirilemez. İade hareketinin kaynak payların kapsamını taşıması ve vade grupları sonraki adımlar için kaydedildi. |
| 12 Ekim 2026 | Adım 2 (API temeli) tamamlandı ve kabul edildi (bölüm 10.7). Şartnamedeki boşluklar için dört karar alındı: kullanıcı oluşturma tekrarında geçici şifre yeniden gösterilmez; şifre değişimi/sıfırlama, pasifleştirme ve 2FA sıfırlamasında oturumlar `tokensValidAfter` ile hemen düşer; yönetimde pasifleştirme, aktifleştirme ve şifre sıfırlama gerekçe ister; hizmet sonu günleri D dahil, bitiş günleri dahil sayılır. İlk şifre akışı, firma ayrımı koruması, deneme sınırı değerleri, kullanıcı adı biçimi ve kütüphane seçimleri sonraki adımlar için kaydedildi. |
| 12 Ekim 2026 | Adım 3 (finans API'si) tamamlandı ve kabul edildi (bölüm 10.8). Şartnamedeki boşluklar için sekiz karar alındı: kopyala kayıt açmaz, taslak döner; tamamlanan şantiyede anlaşmasız gider gerekçe ister, anlaşmasız gelir serbest, yeni anlaşma için yeniden aktifleştirme gerekir; arşivlenen şantiye tamamlanan gibi davranır; arşivden çıkış önceki duruma döner; geri yüklemede kalan aşılırsa fazla onayı istenir; mükerrer uyarısı kayıt sonrası cevapta verilir; özetlerde başlangıç kayıtları toplamlara dahil ve ayrıca alt toplam olarak gösterilir; silinmiş kaydı olan kişi de silinmez, pasifleştirilir. Formüllerin `packages/shared` içinde kalması, güvenli tekrar ve sürüm kontrolü kapsamı, iade ve iptal davranışları sonraki adımlar için kaydedildi. |
| 12 Ekim 2026 | Adım 1–3 sırasında alınan ve 10.5–10.8 bölümlerinde kayıtlı kararlar şartnameye (`santiye-hesap-web-prompt.md`) işlendi; şartname tek kaynak olarak yeniden bu belgeyle uyumlu. İşlenenler: çalışma ortamı ve kütüphaneler, `/health` cevabı, firma ayrımı koruması, katı para girişi ve gösterim biçimi, `expectedUpdatedAt` ve `Idempotency-Key` kapsamı, tamamlanan/arşivlenen şantiye kuralları, iptal edilen anlaşma kuralları, iadeli payın korunması, iade payları, ödeme durumu sırası, vade grupları, başlangıç kayıtlarının özetlerde etiketlenmesi, kopyalamanın taslak dönmesi, mükerrer uyarısı, kişi silme, kategori kuralları, ilk şifre sonrası oturum, oturumların hemen düşmesi, deneme sınırı, kullanıcı adı biçimi, yönetim gerekçeleri, hizmet sonu gün sınırları ve tutar aralığı araması. Ek notlar: İngilizce dilli telefonda ondalık girişinin denenmesi; ekranlarda hizmet sonu süreleri gün sayısı yerine kesin tarihle gösterilir. |
| 13 Ekim 2026 | Adım 4 (uygulama ekranları) tamamlandı ve kabul edildi (bölüm 10.9). Şartnamedeki boşluklar için iki karar alındı: "Kaydı oluşturan kullanıcı" filtresi için firma kullanıcılarını yalnız kimlik, ad ve aktiflikle döndüren `GET /company/users` ucu eklendi; `SUPPORT_CONTACT_TEXT` web derlemesine gömülür. Şartnamede olup API'de eksik kalan `later` vade grubu eklendi; etki önizlemeleri için `packages/shared` içine önizleme fonksiyonları eklendi. İade tutar rengi, görüntüleme bandı metni, açık formun korunması ve demo/tanıtım/rapor yer tutucuları sonraki adımlar için kaydedildi. |
| 13 Ekim 2026 | Adım 4 işlevsel olarak kabul edildi; görünüm için görsel revizyon kararlaştırıldı (bölüm 10.10). Üç paletli taslaktan A paleti (marka renkleri, nötr metin) ve taslak düzeni onaylandı; Lucide ikonları eklenecek; içerik genişlik sınırı kaldırıldı; ödeme iadesi kırmızı ve "−" önekli kalacak. Şartname bölüm 4 yeniden yazıldı, 5.2/7.1/7.2/7.4/11 güncellendi, 10.9 kararları şartnameye işlendi. Adım 4b (görsel revizyon) Adım 5'ten önce yapılacak. |
| 14 Ekim 2026 | Adım 4b-1 (token'lar, uygulama kabuğu, ortak bileşenler; Özet, İşlemler, Şantiyeler) tamamlandı ve kabul edildi (bölüm 10.11). Kullanıcı, şartnamenin istediği değerler için yalnız okuma cevaplarının genişletilmesini onayladı: şantiye kart özetine net tahsilat/ödeme ve gecikmiş alacak, panodaki son şantiyelere özet, pano toplamlarına düşülen ödeme iadesi. Kuruşsuz gösterim fonksiyonu, bakiyelerin `ink` renkte gösterilmesi, tutar önekleri, devre dışı indirme düğmesi, telefonda sayfa eylemleri ve yüzen + davranışı sonraki adımlar için kaydedildi. Sıradaki iş Adım 4b-2. |
| 14 Ekim 2026 | Adım 4b-2 (kalan ekranların görsel revizyonu) tamamlandı ve kabul edildi (bölüm 10.12). Akış masaüstünde ve 375 px'te yeni görünümle çalıştı; mor/lacivert gövde metni kalmadı. Kullanıcının geri bildirimiyle 10.11'deki ~760 px "dar sayfa" kararı değişti: geniş ekranda sağda boşluk kaldığı için formlar ve ayar sayfaları iki sütunlu tam genişlik düzene geçti. Yeni kayıt menüsüyle gelir/gider arasında geçince formun eski türde kalması hatası düzeltildi. Detay sayfası düzeni, detay özet kutularının kuruşlu olması, bakiyelerin bütün listelerde `ink` renkte gösterilmesi ve gecikme gün sayısının ortak fonksiyonla hesaplanması sonraki adımlar için kaydedildi. Şartname 4.5'teki ~760 px kuralı henüz güncellenmedi. |
| 14 Ekim 2026 | Adım 4b-1 ve 4b-2 kararları (10.11, 10.12) şartnameye işlendi: formlar ve ayar sayfaları için ~760 px sınırı kaldırılıp iki sütunlu tam genişlik düzen ve sayfa tablosu eklendi; detay sayfası düzeni, detaydaki özet kutularının kuruşlu olması, `formatMoneyWhole` ve `overdueDaysOf`, form sayfalarında yüzen + düğmesinin gizlenmesi, telefonda sayfa eylemleri, şantiye satırı "Diğer işlemler" menüsü, `/projects` ve `/dashboard` cevaplarındaki ek alanlar, 409 "Farklı" rozeti ve formun yeni gezintide sıfırlanması. Kullanım limiti nedeniyle Adım 5, 6 ve 7 ikişer oturuma bölündü (5a/5b, 6a/6b, 7a/7b) ve her adıma "Okunacaklar" satırı eklendi; ortak giriş buna göre güncellendi. Ara sıra düşen `TransactionForm.test.tsx` testinin gerçek nedeninin düzeltilmesi Adım 5a'nın ilk işi oldu. |
| 14 Ekim 2026 | Adım 5a (belge API'si ve depolama) tamamlandı ve kabul edildi (bölüm 10.13). Şartnamedeki boşluklar için dört karar alındı: silinen belge kayıt başına 10 sınırında sayılmaz (kapasitede sayılır); önizleme kotaya sığmazsa üretilmez, kota hiç aşılmaz; yükleme niyetinde `Idempotency-Key` isteğe bağlıdır; silinmiş kaydın belgeleri yalnız okunur. Anlaşmalara `documentCount` eklendi; kayıt detaylarında belge listesi, firma bilgisinde kullanım dökümü, tamamlama/temizlik çakışma kuralı ve depolama ayarlarının geliştirmede isteğe bağlı olması sonraki adımlar için kaydedildi. 10.12'deki ara sıra düşen `TransactionForm.test.tsx` testinin nedeni bulunup düzeltildi. Sıradaki iş Adım 5b. |
| 15 Ekim 2026 | Adım 5b (belge ekranları) tamamlandı ve kabul edildi (bölüm 10.14). Formlarda belge alanı, detaylarda belge paneli (önizle, indir, gerekçeli sil/geri al) ve firma ayarlarında kullanım dökümü eklendi; API değişmedi. Telefonda kamera ve galeri için ayrı düğmeler, önizlemesi olmayan belgenin dialogda "Orijinali aç" ile açılması ve iade formuna belge alanı eklenmesi kabul edildi. Belgelerin kayıttan sonra yüklenmesi, yalnız belgenin aynı anahtarla yeniden denenmesi, gönderilmeden reddedilen dosyalar ve yükleme düğmesinin nedeni göstermesi sonraki adımlar için kaydedildi. |
| 15 Ekim 2026 | Adım 5a ve 5b kararları (10.13, 10.14) şartnameye işlendi (bölüm 10.15): bölüm 2, 3, 4.4, 4.5, 7.4, 7.6, 7.9, 7.11, 8.7, 8.8, 9.6, 9.7, 9.10, 10.3, 10.6–10.8, 11 ve 12. Kullanıcı dört karar verdi: belge olayları yalnız belgenin kendi geçmişinde kalır, belge geçmişi 6b'deki tam veri çıkışına eklenir; AGENTS.md'deki `Idempotency-Key` kuralı şartname bölüm 3'teki listeye bağlandı; `pnpm dev` sorunu Adım 6a'nın ilk işi oldu; denenmemiş belge akışları ve depo yaşam döngüsü kuralı Adım 10'a eklendi. Bölüm 5'e Adım 5b eklendi. Sıradaki iş Adım 6a. |
| 15 Ekim 2026 | Adım 6a (standart raporlar ve filtreli dışa aktarma) tamamlandı ve kabul edildi (bölüm 10.16). Dört standart rapor ekranda görüntülenir ve Excel, CSV, PDF olarak indirilir; "Bu sonuçları indir" açıldı. `pnpm dev`'de Vite'ın açılmamasının nedeni `tsx watch`'ın stdin'i dinlemesiydi; API dev betiği Node'un yerleşik izlemesine geçirildi. Kullanıcı iki karar verdi: PDF için DM Sans ve Outfit TTF dosyaları OFL lisansıyla depoya eklendi; kapsamda başlangıç kaydı yoksa takip başlangıcı "Başlangıç kaydı yok" yazar ve uyarı çıkmaz. Dosya ucunun tür adları, tarih aralığının yalnız hareketleri daraltması, kategori filtresinin iadeleri de alması, tek veri görünümü, toplamların satırlardan hesaplanması, paylaştırılmış kaydın sütunları ve dosya biçimleri sonraki adımlar için kaydedildi. Kararlar henüz şartnameye işlenmedi. Sıradaki iş Adım 6b. |
| 16 Ekim 2026 | Adım 6a kararları (10.16) şartnameye işlendi: bölüm 2'de PDF yazı tipleri, Excel ve CSV biçimleri; 7.10'da rapor sekmeleri, açılış aralıkları, kapsam ve kategori filtresi, takip başlangıcı ve "Başlangıç kaydı yok", paylaştırılmış kayıt satır düzeni, silinenler, kişi dökümü, açık tutar listesi, PDF sütunları ve dosya adı; 9.1'de tek tutarlı okuma ve satırlardan toplam; 10.9'da dosya ucunun tür adları; 11'de dosya adı ve hata cevabı. Görev metinlerinde 6b'nin okunacakları genişletildi; Adım 10'a gerçek Excel/telefon kontrolü ve yazı tipi klasörü eklendi. Sıradaki iş Adım 6b. |
| 16 Ekim 2026 | Adım 6b (tam firma veri çıkışı) tamamlandı ve kabul edildi (bölüm 10.17). Paket arka planda hazırlanır, ilerlemesi gösterilir ve 5 dakikalık adresle indirilir; tablolar Excel ve CSV olarak, orijinal belgeler eşleme tablosuyla zip'tedir; silinen ama geri alınabilir kayıtlar durum etiketlidir; hazır paket 7 gün sonra silinir. Kullanıcı dört karar verdi: Excel ve CSV birlikte; hazır paket kapasitede sayılır ve kota aşılabilir; süren iş varken yeni istek o işi döner; son işler için yeni `GET /exports` ucu. Paket düzeni, değişiklik geçmişi, dışarıda kalan alanlar, arka plan işi ve çok parçalı depo yazımı sonraki adımlar için kaydedildi. Kararlar henüz şartnameye işlenmedi. |
| 16 Ekim 2026 | Adım 6b kararları (10.17) şartnameye işlendi (bölüm 10.18): bölüm 3, 7.10, 8.10, 9.6, 10.9 ve 12; AGENTS.md'nin 6. kuralı güncellendi. İncelemede hazır paketlerin birikip depolamayı sınırsız büyütebildiği bulundu; kullanıcı "yeni paket hazır olunca önceki silinir, en fazla bir hazır paket" kuralını seçti, kod düzeltmesi Adım 7a'nın ilk işi oldu. Şartname 9.6'daki "kota hiç aşılmaz" cümlesi düzeltildi. Büyük firma ölçümü ve gerçek dosya denemeleri Adım 10'a, `exports/` yaşam döngüsü kuralı ve API'nin sürekli açık kalması canlıya hazırlık notuna ve 10.4'e eklendi. Sıradaki iş Adım 7a. |
| 16 Ekim 2026 | Adım 7a (ürün sahibi yönetimi: kalan API) tamamlandı ve kabul edildi (bölüm 10.19). Önce tek hazır paket düzeltmesi yapıldı: yeni paket hazır olunca önceki silinir, kapasite bir kez iade edilir. Firma listesi ve işletim özeti, firma düzenleme, kullanıcı adı değiştirme, kapasite, geçici durdurma, hizmeti sonlandırma (önizlemeli), yeniden açma, arşiv uzatma ve kalıcı silme uçları eklendi; açılıştan kalıcı silmeye akış testli. Kullanıcı altı karar verdi: kalıcı silinen firmada asgari iz kaydı kalır; `PATCH /platform/companies/:id` 7a'da yapıldı; ad ve kullanıcı adı değişiminde gerekçe isteğe bağlı; kapasite %90'da yaklaşan, %100'de dolu; görüntüleme dönemi 7 gün içinde bitenler ve arşiv saklaması 30 gün içinde bitenler özetlenir. İşletim geçmişinin silme sonrası asgari kaydı, silme adımları, yeniden açma ve arşiv uzatma sınırları ve yarıda kalan silmenin devamı sonraki adımlar için kaydedildi. Kararlar henüz şartnameye işlenmedi. Sıradaki iş kararların şartnameye işlenmesi ve Adım 7b. |
| 16 Ekim 2026 | Adım 7a kararları (10.19) şartnameye işlendi (bölüm 10.20): bölüm 3, 7.13, 8.1, 8.10, 9.8, 9.10, 10.10 ve 12. Kullanıcı üç karar verdi: bekleyen, süren veya başarısız kalıcı silmeler işletim özetinde ayrı grupta görünecek (API işi Adım 7b'nin ilk işi); "API ilk sürümde tek süreç çalışır" kuralı şartnameye ve 10.4'e yazıldı; "yeniden aç, sonra sonlandır" yolu bilinçli olarak kabul edildi. Depo temizliğinin gerçek MinIO'da denenmesi ve yedekten çıkarma takibi Adım 10'a, işletim geçmişinde kalan gerekçeler KVKK sorularına eklendi. Sıradaki iş Adım 7b. |
| 16 Ekim 2026 | Adım 7b (ürün sahibi yönetimi: ekranlar) tamamlandı (bölüm 10.21). "Önce" işinde bekleyen, süren ve başarısız kalıcı silmeler işletim özetinde `deletionIncomplete` grubuna alındı. Yönetim girişi, QR ile zorunlu güvenlik kurulumu, bir kez gösterilen kurtarma kodları, güvenlik sayfası, işletim özeti ve firma listesi, firma oluşturma ve detayı, kullanıcı ve yaşam döngüsü dialogları ve firma adıyla onaylı kalıcı silme ekranı yapıldı; ilk kurulumdan kalıcı silmeye akış ekrandan çalıştı. Kullanıcı iki karar verdi: giriş sonrası TOTP yeniden kurulumu için iki oturumlu uç eklendi (`totp/reset`, `totp/reset/confirm`); QR için `qrcode-generator` eklendi. Yeniden kurulumun kurtarma koduyla da başlatılabilmesi uygulamada eklendi, onay bekliyor. Kararlar henüz şartnameye işlenmedi. |
| 16 Ekim 2026 | Adım 7b kararları (10.21) şartnameye işlendi (bölüm 10.22): bölüm 2, 5.3, 7.13, 8.10 ve 10.10; özet grubunun adı `deletionIncomplete` olarak düzeltildi. Kullanıcı TOTP yeniden kurulumunun kurtarma koduyla da başlatılabilmesini onayladı. Ara sıra düşen `customer-auth` testinin düzeltilmesi Adım 8'in ilk işi oldu; Adım 8 görev metnine "Okunacaklar" satırı ve bitiş ölçütü eklendi. "Kodları indir" ile gerçek dosya kaydı Adım 10'a eklendi. Sıradaki iş Adım 8. |
