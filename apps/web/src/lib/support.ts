// Ürün sahibi iletişim metni derleme anında .env'deki SUPPORT_CONTACT_TEXT'ten gelir.
// Boşsa genel bir metin gösterilir; uydurma adres veya telefon yazılmaz.
export const SUPPORT_CONTACT_TEXT =
  import.meta.env.SUPPORT_CONTACT_TEXT?.trim() ||
  'İletişim bilgisi için hesabınızı açan ürün sahibine başvurun.';
