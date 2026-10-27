/**
 * User-interface strings in English and Turkish, {name} placeholder
 * interpolation and locale-aware number formatting. Pure: no DOM.
 */

/** Supported languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

/** Language shown until the visitor picks another one. */
export const DEFAULT_LANGUAGE = LANGUAGES[0];

const LOCALES = Object.freeze({ en: 'en-US', tr: 'tr-TR' });

const EN = {
  'app.title': 'QR Code Generator',
  'header.reset': 'Reset',
  'header.resetTitle': 'Clear all fields and options',
  'lang.switch': 'TR: Switch to Turkish',
  'section.content': 'Content',
  'section.preview': 'Preview',
  'section.options': 'Options',
  'preview.live': 'Live',
  'types.label': 'Content type',
  'type.text': 'Text / URL',
  'type.wifi': 'Wi-Fi',
  'type.email': 'E-mail',
  'type.phone': 'Phone',
  'type.sms': 'SMS',
  'type.vcard': 'vCard',
  'hint.text': 'Links open in the browser; any other text is shown as it is.',
  'hint.wifi': 'Phones join the network when they scan the code, no typing needed.',
  'hint.email': 'Opens a new e-mail with the recipient, subject and message filled in.',
  'hint.phone': 'Starts a call to this number.',
  'hint.sms': 'Opens a text message to this number.',
  'hint.vcard': 'Saves the contact to the address book (vCard 3.0).',
  'field.text.text': 'Text or URL',
  'field.wifi.ssid': 'Network name (SSID)',
  'field.wifi.password': 'Password',
  'field.wifi.security': 'Security',
  'field.wifi.hidden': 'Hidden network',
  'field.email.to': 'Recipient',
  'field.email.subject': 'Subject',
  'field.email.body': 'Message',
  'field.phone.number': 'Phone number',
  'field.sms.number': 'Phone number',
  'field.sms.message': 'Message',
  'field.vcard.firstName': 'First name',
  'field.vcard.lastName': 'Last name',
  'field.vcard.phone': 'Phone',
  'field.vcard.email': 'E-mail',
  'field.vcard.org': 'Organisation',
  'field.vcard.title': 'Job title',
  'field.vcard.url': 'Website',
  'placeholder.text.text': 'https://example.com or any text',
  'placeholder.wifi.ssid': 'Home network',
  'placeholder.email.to': 'name@example.com',
  'placeholder.email.subject': 'Hello',
  'placeholder.phone.number': '+90 555 123 45 67',
  'placeholder.sms.number': '+90 555 123 45 67',
  'placeholder.vcard.phone': '+90 555 123 45 67',
  'placeholder.vcard.email': 'name@example.com',
  'placeholder.vcard.url': 'https://example.com',
  'choice.wifi.security.WPA': 'WPA / WPA2 / WPA3',
  'choice.wifi.security.WEP': 'WEP (legacy)',
  'choice.wifi.security.nopass': 'None (open network)',
  'password.show': 'Show password',
  'empty.title': 'Your QR code appears here',
  'empty.text': 'Type a link or some text to get started.',
  'empty.wifi': 'Enter the network name to get started.',
  'empty.email': 'Enter the recipient address to get started.',
  'empty.phone': 'Enter a phone number to get started.',
  'empty.sms': 'Enter a phone number to get started.',
  'empty.vcard': 'Enter a name or an organisation to get started.',
  'tooLong.title': 'Too long for a QR code',
  'tooLong.detail': 'The content is {length} {unit}; at most {max} fit at level {level}. Shorten it or choose a lower error-correction level.',
  'qr.label': 'QR code, version {version}, {size} by {size} modules',
  'stat.version': 'Version',
  'stat.versionValue': '{version} · {size}×{size}',
  'stat.mode': 'Mode',
  'mode.numeric': 'Numeric',
  'mode.alphanumeric': 'Alphanumeric',
  'mode.byte': 'Byte (UTF-8)',
  'stat.capacity': 'Capacity used',
  'stat.capacityValue': '{used} / {total} {unit}',
  'unit.bytes': 'bytes',
  'unit.characters': 'characters',
  'percent': '{value}%',
  'stat.details': 'Level {level} · mask {mask} · PNG {pixels} × {pixels} px',
  'action.png': 'Download PNG',
  'action.svg': 'Download SVG',
  'action.copy': 'Copy SVG',
  'status.png': 'PNG downloaded.',
  'status.svg': 'SVG downloaded.',
  'status.copied': 'SVG copied to the clipboard.',
  'status.copyFailed': 'Copying failed: the browser blocked clipboard access.',
  'status.pngFailed': 'The PNG could not be created.',
  'status.reset': 'Fields and options cleared.',
  'privacy': 'Made on your device: nothing leaves your browser.',
  'shortcuts': 'Keys: 1–6 type · L M Q H level · O options · P PNG · S SVG · C copy SVG',
  'option.ecLevel': 'Error correction',
  'option.ecValue': '{name} · restores ~{percent}',
  'option.ecHint': 'Higher levels survive more damage but make the code denser.',
  'ec.L': 'Low',
  'ec.M': 'Medium',
  'ec.Q': 'Quartile',
  'ec.H': 'High',
  'option.moduleSize': 'Module size',
  'option.moduleSizeValue': '{value} px',
  'option.quietZone': 'Quiet zone',
  'option.quietZoneValue': '{value} modules',
  'option.foreground': 'Foreground',
  'option.background': 'Background',
  'contrast.ok': 'Contrast {ratio}:1, easy to scan',
  'contrast.low': 'Contrast {ratio}:1 is too low',
  'contrast.warning': 'Low contrast ({ratio}:1): scanners may not read this code. Use at least {min}:1; dark modules on a light background work best.',
  'footer.source': 'MIT · Source on GitHub',
  'footer.trademark': 'QR Code is a registered trademark of DENSO WAVE INCORPORATED.',
};

const TR = {
  'app.title': 'QR Kod Oluşturucu',
  'header.reset': 'Sıfırla',
  'header.resetTitle': 'Tüm alanları ve ayarları temizle',
  'lang.switch': 'EN: İngilizceye geç',
  'section.content': 'İçerik',
  'section.preview': 'Önizleme',
  'section.options': 'Ayarlar',
  'preview.live': 'Canlı',
  'types.label': 'İçerik türü',
  'type.text': 'Metin / URL',
  'type.wifi': 'Wi-Fi',
  'type.email': 'E-posta',
  'type.phone': 'Telefon',
  'type.sms': 'SMS',
  'type.vcard': 'Kartvizit',
  'hint.text': 'Bağlantılar tarayıcıda açılır; diğer metinler olduğu gibi gösterilir.',
  'hint.wifi': 'Kodu okutan telefon, parola yazmadan ağa bağlanır.',
  'hint.email': 'Alıcısı, konusu ve mesajı dolu yeni bir e-posta açar.',
  'hint.phone': 'Bu numarayı arar.',
  'hint.sms': 'Bu numaraya yeni bir kısa mesaj açar.',
  'hint.vcard': 'Kişiyi rehbere kaydeder (vCard 3.0).',
  'field.text.text': 'Metin veya URL',
  'field.wifi.ssid': 'Ağ adı (SSID)',
  'field.wifi.password': 'Parola',
  'field.wifi.security': 'Güvenlik',
  'field.wifi.hidden': 'Gizli ağ',
  'field.email.to': 'Alıcı',
  'field.email.subject': 'Konu',
  'field.email.body': 'Mesaj',
  'field.phone.number': 'Telefon numarası',
  'field.sms.number': 'Telefon numarası',
  'field.sms.message': 'Mesaj',
  'field.vcard.firstName': 'Ad',
  'field.vcard.lastName': 'Soyad',
  'field.vcard.phone': 'Telefon',
  'field.vcard.email': 'E-posta',
  'field.vcard.org': 'Kurum',
  'field.vcard.title': 'Unvan',
  'field.vcard.url': 'Web sitesi',
  'placeholder.text.text': 'https://ornek.com ya da herhangi bir metin',
  'placeholder.wifi.ssid': 'Ev ağı',
  'placeholder.email.to': 'ad@ornek.com',
  'placeholder.email.subject': 'Merhaba',
  'placeholder.phone.number': '+90 555 123 45 67',
  'placeholder.sms.number': '+90 555 123 45 67',
  'placeholder.vcard.phone': '+90 555 123 45 67',
  'placeholder.vcard.email': 'ad@ornek.com',
  'placeholder.vcard.url': 'https://ornek.com',
  'choice.wifi.security.WPA': 'WPA / WPA2 / WPA3',
  'choice.wifi.security.WEP': 'WEP (eski)',
  'choice.wifi.security.nopass': 'Yok (açık ağ)',
  'password.show': 'Parolayı göster',
  'empty.title': 'QR kodun burada görünecek',
  'empty.text': 'Başlamak için bir bağlantı ya da metin yaz.',
  'empty.wifi': 'Başlamak için ağ adını gir.',
  'empty.email': 'Başlamak için alıcı adresini gir.',
  'empty.phone': 'Başlamak için bir telefon numarası gir.',
  'empty.sms': 'Başlamak için bir telefon numarası gir.',
  'empty.vcard': 'Başlamak için bir ad ya da kurum gir.',
  'tooLong.title': 'QR kod için fazla uzun',
  'tooLong.detail': 'İçerik {length} {unit}; {level} seviyesinde en fazla {max} sığar. Kısalt ya da daha düşük bir hata düzeltme seviyesi seç.',
  'qr.label': 'QR kod, sürüm {version}, {size} x {size} modül',
  'stat.version': 'Sürüm',
  'stat.versionValue': '{version} · {size}×{size}',
  'stat.mode': 'Mod',
  'mode.numeric': 'Sayısal',
  'mode.alphanumeric': 'Alfasayısal',
  'mode.byte': 'Bayt (UTF-8)',
  'stat.capacity': 'Kullanılan kapasite',
  'stat.capacityValue': '{used} / {total} {unit}',
  'unit.bytes': 'bayt',
  'unit.characters': 'karakter',
  'percent': '%{value}',
  'stat.details': 'Seviye {level} · maske {mask} · PNG {pixels} × {pixels} px',
  'action.png': 'PNG indir',
  'action.svg': 'SVG indir',
  'action.copy': 'SVG kopyala',
  'status.png': 'PNG indirildi.',
  'status.svg': 'SVG indirildi.',
  'status.copied': 'SVG panoya kopyalandı.',
  'status.copyFailed': 'Kopyalanamadı: tarayıcı panoya erişimi engelledi.',
  'status.pngFailed': 'PNG oluşturulamadı.',
  'status.reset': 'Alanlar ve ayarlar temizlendi.',
  'privacy': 'Cihazında üretilir: hiçbir şey tarayıcından dışarı çıkmaz.',
  'shortcuts': 'Tuşlar: 1–6 tür · L M Q H seviye · O ayarlar · P PNG · S SVG · C SVG kopyala',
  'option.ecLevel': 'Hata düzeltme',
  'option.ecValue': '{name} · ~{percent} onarır',
  'option.ecHint': 'Yüksek seviyeler hasara daha dayanıklıdır ama kodu sıklaştırır.',
  'ec.L': 'Düşük',
  'ec.M': 'Orta',
  'ec.Q': 'Yüksek',
  'ec.H': 'Çok yüksek',
  'option.moduleSize': 'Modül boyutu',
  'option.moduleSizeValue': '{value} px',
  'option.quietZone': 'Sessiz bölge',
  'option.quietZoneValue': '{value} modül',
  'option.foreground': 'Ön plan',
  'option.background': 'Arka plan',
  'contrast.ok': 'Kontrast {ratio}:1, kolay okunur',
  'contrast.low': 'Kontrast {ratio}:1, fazla düşük',
  'contrast.warning': 'Düşük kontrast ({ratio}:1): tarayıcılar bu kodu okuyamayabilir. En az {min}:1 kullan; açık zemin üzerinde koyu modüller en iyi sonucu verir.',
  'footer.source': 'MIT · Kaynak kod GitHub’da',
  'footer.trademark': 'QR Code, DENSO WAVE INCORPORATED’ın tescilli markasıdır.',
};

/** All strings, by language and key. */
export const STRINGS = Object.freeze({ en: Object.freeze(EN), tr: Object.freeze(TR) });

/**
 * Whether a value is a supported language code.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * Whether a string exists for a key (used for optional strings such as placeholders).
 * @param {string} key
 * @returns {boolean}
 */
export function hasString(key) {
  return Object.hasOwn(STRINGS[DEFAULT_LANGUAGE], key);
}

/**
 * The language the toggle switches to.
 * @param {string} language current language
 * @returns {string} the next supported language
 */
export function nextLanguage(language) {
  return LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length];
}

/** The table's own string for a key (inherited names like "toString" do not count). */
function ownString(table, key) {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

/**
 * Looks up a string and fills in its {name} placeholders. Missing keys fall
 * back to English, then to the key itself; unknown placeholders stay as they are.
 * @param {string} language
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function translate(language, key, params = {}) {
  const table = STRINGS[isLanguage(language) ? language : DEFAULT_LANGUAGE];
  const template = ownString(table, key) ?? ownString(STRINGS[DEFAULT_LANGUAGE], key) ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}

/**
 * Formats a number with the language's digit grouping and decimal mark.
 * @param {string} language
 * @param {number} value
 * @param {number} [fractionDigits=0] maximum digits after the decimal mark
 * @returns {string} e.g. "2,953" / "2.953", "4.5" / "4,5"
 */
export function formatNumber(language, value, fractionDigits = 0) {
  const locale = LOCALES[isLanguage(language) ? language : DEFAULT_LANGUAGE];
  return new Intl.NumberFormat(locale, { maximumFractionDigits: fractionDigits }).format(value);
}
