import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAYLOAD_FIELDS, PAYLOAD_TYPES, WIFI_SECURITY, buildPayload, defaultFieldValue, emailPayload,
  escapeVcardText, escapeWifiValue, hasPayloadContent, isFieldUsed, normalizePhone, phonePayload, smsPayload,
  vcardPayload, wifiPayload,
} from '../src/payload.js';

test('Wi-Fi escaping puts a backslash before \\ ; , : and "', () => {
  assert.equal(escapeWifiValue('a\\b;c,d:e"f'), 'a\\\\b\\;c\\,d\\:e\\"f');
  assert.equal(escapeWifiValue('plain text 123'), 'plain text 123');
  assert.equal(escapeWifiValue(';;'), '\\;\\;');
});

test('Wi-Fi payload follows WIFI:T:...;S:...;P:...;;', () => {
  assert.equal(wifiPayload({ ssid: 'Home', password: 'secret', security: 'WPA' }), 'WIFI:T:WPA;S:Home;P:secret;;');
  assert.equal(wifiPayload({ ssid: 'Old', password: '12345', security: 'WEP' }), 'WIFI:T:WEP;S:Old;P:12345;;');
  assert.equal(wifiPayload({ ssid: 'Home', password: 'secret', hidden: true }), 'WIFI:T:WPA;S:Home;P:secret;H:true;;');
  assert.equal(wifiPayload({ ssid: 'Open Cafe', password: 'ignored', security: 'nopass' }), 'WIFI:T:nopass;S:Open Cafe;;');
});

test('Wi-Fi payload escapes the SSID and the password', () => {
  assert.equal(
    wifiPayload({ ssid: 'My;Net,5G', password: 'a:b"c\\' }),
    'WIFI:T:WPA;S:My\\;Net\\,5G;P:a\\:b\\"c\\\\;;',
  );
});

test('e-mail payload is a mailto: URI with encoded subject and CRLF body', () => {
  assert.equal(
    emailPayload({ to: ' ada@example.com ', subject: 'Hi there', body: 'Line 1\nLine 2' }),
    'mailto:ada@example.com?subject=Hi%20there&body=Line%201%0D%0ALine%202',
  );
  assert.equal(emailPayload({ to: 'x@y.z' }), 'mailto:x@y.z');
  assert.equal(emailPayload({ to: 'a+b@c.d', subject: 'Q&A?' }), 'mailto:a%2Bb@c.d?subject=Q%26A%3F');
  assert.equal(emailPayload({ to: 'x@y.z', body: 'ok' }), 'mailto:x@y.z?body=ok');
});

test('phone numbers keep only a leading + and digits', () => {
  assert.equal(normalizePhone('+90 (555) 123-45-67'), '+905551234567');
  assert.equal(normalizePhone(' 0212 555 00 00 '), '02125550000');
  assert.equal(normalizePhone('call 5+5'), '55');
  assert.equal(phonePayload({ number: '+1 555 0100' }), 'tel:+15550100');
});

test('SMS payload uses SMSTO:number:message', () => {
  assert.equal(smsPayload({ number: '+90 555 111 22 33', message: 'On my way: 10 min' }), 'SMSTO:+905551112233:On my way: 10 min');
  assert.equal(smsPayload({ number: '112' }), 'SMSTO:112:');
});

test('vCard text values escape backslash, semicolon, comma and line breaks', () => {
  assert.equal(escapeVcardText('a\\b;c,d\ne\r\nf'), 'a\\\\b\\;c\\,d\\ne\\nf');
});

test('vCard 3.0 payload has the required properties and CRLF line endings', () => {
  const card = vcardPayload({
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: '+44 20 1234 5678',
    email: 'ada@example.com',
    org: 'Analytical Engines, Ltd.',
    title: 'Programmer',
    url: 'https://example.com/ada',
  });
  assert.equal(card, [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Lovelace;Ada;;;',
    'FN:Ada Lovelace',
    'ORG:Analytical Engines\\, Ltd.',
    'TITLE:Programmer',
    'TEL;TYPE=CELL:+44 20 1234 5678',
    'EMAIL;TYPE=INTERNET:ada@example.com',
    'URL:https://example.com/ada',
    'END:VCARD',
  ].join('\r\n'));
});

test('vCard leaves out empty properties and falls back to the organisation for FN', () => {
  assert.equal(vcardPayload({ org: ' Acme ', phone: '', url: '' }), 'BEGIN:VCARD\r\nVERSION:3.0\r\nN:;;;;\r\nFN:Acme\r\nORG:Acme\r\nEND:VCARD');
  assert.ok(vcardPayload({ firstName: 'Kim', url: 'https://a.b/\nx' }).includes('\r\nURL:https://a.b/ x\r\n'));
});

test('buildPayload dispatches on the payload type', () => {
  assert.equal(buildPayload('text', { text: 'https://example.com' }), 'https://example.com');
  assert.equal(buildPayload('wifi', { ssid: 'S', password: 'P', security: 'WPA', hidden: false }), 'WIFI:T:WPA;S:S;P:P;;');
  assert.equal(buildPayload('phone', { number: '555' }), 'tel:555');
  assert.throws(() => buildPayload('fax', {}), RangeError);
  assert.throws(() => buildPayload('toString', {}), RangeError);
});

test('hasPayloadContent requires the key field of each type', () => {
  assert.equal(hasPayloadContent('text', { text: '   ' }), false);
  assert.equal(hasPayloadContent('text', { text: 'x' }), true);
  assert.equal(hasPayloadContent('wifi', { ssid: '' }), false);
  assert.equal(hasPayloadContent('wifi', { ssid: '  ' }), false);
  assert.equal(hasPayloadContent('wifi', { ssid: 'Home' }), true);
  assert.equal(hasPayloadContent('email', { to: ' ' }), false);
  assert.equal(hasPayloadContent('phone', { number: 'abc' }), false);
  assert.equal(hasPayloadContent('sms', { number: '+1 2' }), true);
  assert.equal(hasPayloadContent('vcard', { firstName: '', lastName: '', org: '' }), false);
  assert.equal(hasPayloadContent('vcard', { org: 'Acme' }), true);
  assert.throws(() => hasPayloadContent('fax', {}), RangeError);
  assert.throws(() => hasPayloadContent('constructor', {}), RangeError);
});

test('every payload type declares its form fields with sensible defaults', () => {
  assert.deepEqual(Object.keys(PAYLOAD_FIELDS), PAYLOAD_TYPES);
  for (const type of PAYLOAD_TYPES) {
    const names = PAYLOAD_FIELDS[type].map((field) => field.name);
    assert.equal(new Set(names).size, names.length, `${type} field names are unique`);
    const defaults = Object.fromEntries(PAYLOAD_FIELDS[type].map((field) => [field.name, defaultFieldValue(field)]));
    assert.equal(hasPayloadContent(type, defaults), false, `${type} starts empty`);
    assert.equal(typeof buildPayload(type, defaults), 'string');
  }
  const security = PAYLOAD_FIELDS.wifi.find((field) => field.name === 'security');
  assert.equal(defaultFieldValue(security), 'WPA');
  assert.deepEqual(security.options, WIFI_SECURITY);
  assert.equal(defaultFieldValue({ input: 'checkbox' }), false);
});

test('the Wi-Fi password field is unused only for open networks', () => {
  assert.equal(isFieldUsed('wifi', 'password', { security: 'nopass' }), false);
  assert.equal(isFieldUsed('wifi', 'password', { security: 'WPA' }), true);
  assert.equal(isFieldUsed('wifi', 'password', { security: 'WEP' }), true);
  assert.equal(isFieldUsed('wifi', 'ssid', { security: 'nopass' }), true);
  for (const type of PAYLOAD_TYPES) {
    for (const field of PAYLOAD_FIELDS[type]) assert.equal(isFieldUsed(type, field.name, { security: 'WPA' }), true);
  }
});
