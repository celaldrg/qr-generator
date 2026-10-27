/**
 * Builders for the text that goes into a QR Code: plain text or URL,
 * Wi-Fi network, e-mail, phone call, SMS and vCard 3.0 contact.
 */

/** Payload types in the order the UI offers them. */
export const PAYLOAD_TYPES = Object.freeze(['text', 'wifi', 'email', 'phone', 'sms', 'vcard']);

/** Wi-Fi authentication types understood by phone camera apps. */
export const WIFI_SECURITY = Object.freeze(['WPA', 'WEP', 'nopass']);

/**
 * Form fields of each payload type. `input` names the HTML input kind; the
 * first entry of `options` is the default of a select.
 * @type {Readonly<Record<string, ReadonlyArray<{name: string, input: string, options?: readonly string[]}>>>}
 */
export const PAYLOAD_FIELDS = Object.freeze({
  text: [{ name: 'text', input: 'textarea' }],
  wifi: [
    { name: 'ssid', input: 'text' },
    { name: 'password', input: 'password' },
    { name: 'security', input: 'select', options: WIFI_SECURITY },
    { name: 'hidden', input: 'checkbox' },
  ],
  email: [
    { name: 'to', input: 'email' },
    { name: 'subject', input: 'text' },
    { name: 'body', input: 'textarea' },
  ],
  phone: [{ name: 'number', input: 'tel' }],
  sms: [
    { name: 'number', input: 'tel' },
    { name: 'message', input: 'textarea' },
  ],
  vcard: [
    { name: 'firstName', input: 'text' },
    { name: 'lastName', input: 'text' },
    { name: 'phone', input: 'tel' },
    { name: 'email', input: 'email' },
    { name: 'org', input: 'text' },
    { name: 'title', input: 'text' },
    { name: 'url', input: 'url' },
  ],
});

const VCARD_ESCAPES = { '\\': '\\\\', ';': '\\;', ',': '\\,', '\r\n': '\\n', '\n': '\\n', '\r': '\\n' };

/**
 * Default value of a field: false for checkboxes, the first option for
 * selects, '' otherwise.
 * @param {{input: string, options?: readonly string[]}} field
 * @returns {string|boolean}
 */
export function defaultFieldValue(field) {
  if (field.input === 'checkbox') return false;
  return field.options ? field.options[0] : '';
}

/**
 * Escapes the characters that are special in the WIFI: format: \ ; , : "
 * @param {string} value
 * @returns {string}
 */
export function escapeWifiValue(value) {
  return value.replace(/[\\;,:"]/g, (char) => `\\${char}`);
}

/**
 * Wi-Fi network, e.g. WIFI:T:WPA;S:Home;P:secret;;
 * @param {{ssid?: string, password?: string, security?: string, hidden?: boolean}} values
 * @returns {string}
 */
export function wifiPayload({ ssid = '', password = '', security = 'WPA', hidden = false }) {
  const parts = [`T:${security}`, `S:${escapeWifiValue(ssid)}`];
  if (security !== 'nopass') parts.push(`P:${escapeWifiValue(password)}`);
  if (hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

function encodeMailtoText(text) {
  return encodeURIComponent(text.replace(/\r?\n/g, '\r\n'));
}

/**
 * mailto: URI with optional subject and body (line breaks become %0D%0A).
 * @param {{to?: string, subject?: string, body?: string}} values
 * @returns {string}
 */
export function emailPayload({ to = '', subject = '', body = '' }) {
  const address = encodeURIComponent(to.trim()).replace(/%40/g, '@');
  const query = [];
  if (subject) query.push(`subject=${encodeMailtoText(subject)}`);
  if (body) query.push(`body=${encodeMailtoText(body)}`);
  return `mailto:${address}${query.length > 0 ? `?${query.join('&')}` : ''}`;
}

/**
 * Keeps a leading + and the digits of a phone number.
 * @param {string} number e.g. "+90 (555) 123-45-67"
 * @returns {string} e.g. "+905551234567"
 */
export function normalizePhone(number) {
  const trimmed = number.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * tel: URI.
 * @param {{number?: string}} values
 * @returns {string}
 */
export function phonePayload({ number = '' }) {
  return `tel:${normalizePhone(number)}`;
}

/**
 * SMS in the widely supported SMSTO:number:message form.
 * @param {{number?: string, message?: string}} values
 * @returns {string}
 */
export function smsPayload({ number = '', message = '' }) {
  return `SMSTO:${normalizePhone(number)}:${message}`;
}

/**
 * Escapes a vCard 3.0 text value (RFC 2426): backslash, semicolon, comma
 * and line breaks.
 * @param {string} value
 * @returns {string}
 */
export function escapeVcardText(value) {
  return value.replace(/\r\n|[\\;,\n\r]/g, (match) => VCARD_ESCAPES[match]);
}

function stripLineBreaks(value) {
  return value.replace(/[\r\n]+/g, ' ');
}

const VCARD_OPTIONAL_LINES = [
  ['org', 'ORG', escapeVcardText],
  ['title', 'TITLE', escapeVcardText],
  ['phone', 'TEL;TYPE=CELL', stripLineBreaks],
  ['email', 'EMAIL;TYPE=INTERNET', escapeVcardText],
  ['url', 'URL', stripLineBreaks],
];

/**
 * vCard 3.0 contact with CRLF line endings; empty optional properties are left out.
 * @param {{firstName?: string, lastName?: string, phone?: string, email?: string, org?: string, title?: string, url?: string}} values
 * @returns {string}
 */
export function vcardPayload(values) {
  const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, String(value).trim()]));
  const { firstName = '', lastName = '', org = '' } = trimmed;
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || org;
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVcardText(lastName)};${escapeVcardText(firstName)};;;`,
    `FN:${escapeVcardText(fullName)}`,
  ];
  for (const [key, property, format] of VCARD_OPTIONAL_LINES) {
    if (trimmed[key]) lines.push(`${property}:${format(trimmed[key])}`);
  }
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

const BUILDERS = {
  text: ({ text = '' }) => text,
  wifi: wifiPayload,
  email: emailPayload,
  phone: phonePayload,
  sms: smsPayload,
  vcard: vcardPayload,
};

const HAS_CONTENT = {
  text: ({ text = '' }) => text.trim() !== '',
  wifi: ({ ssid = '' }) => ssid.trim() !== '',
  email: ({ to = '' }) => to.trim() !== '',
  phone: ({ number = '' }) => /\d/.test(number),
  sms: ({ number = '' }) => /\d/.test(number),
  vcard: ({ firstName = '', lastName = '', org = '' }) => `${firstName}${lastName}${org}`.trim() !== '',
};

/**
 * Builds the encoded text for a payload type.
 * @param {string} type one of PAYLOAD_TYPES
 * @param {Record<string, string|boolean>} values form values of that type
 * @returns {string}
 */
export function buildPayload(type, values) {
  if (!Object.hasOwn(BUILDERS, type)) throw new RangeError(`unknown payload type: ${type}`);
  return BUILDERS[type](values);
}

/**
 * Whether the required field of a payload type is filled in (text, SSID,
 * recipient, phone number, or a name / organisation for vCards).
 * @param {string} type one of PAYLOAD_TYPES
 * @param {Record<string, string|boolean>} values
 * @returns {boolean}
 */
export function hasPayloadContent(type, values) {
  if (!Object.hasOwn(HAS_CONTENT, type)) throw new RangeError(`unknown payload type: ${type}`);
  return HAS_CONTENT[type](values);
}

/**
 * Whether a field ends up in the payload with the current values; the UI
 * disables fields that do not (an open Wi-Fi network has no password).
 * @param {string} type one of PAYLOAD_TYPES
 * @param {string} name field name
 * @param {Record<string, string|boolean>} values form values of that type
 * @returns {boolean}
 */
export function isFieldUsed(type, name, values) {
  return !(type === 'wifi' && name === 'password' && values.security === 'nopass');
}
