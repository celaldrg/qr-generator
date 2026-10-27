import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  DEFAULT_LANGUAGE, LANGUAGES, STRINGS, formatNumber, hasString, isLanguage, nextLanguage, translate,
} from '../src/i18n.js';
import { PAYLOAD_FIELDS, PAYLOAD_TYPES } from '../src/payload.js';
import { lengthUnit } from '../src/stats.js';
import { EC_LEVELS } from '../src/tables.js';

const ROOT = new URL('../', import.meta.url);
const SOURCE_DIR = new URL('src/', ROOT);

/** Sorted, de-duplicated {name} placeholders of a string. */
function placeholders(text) {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
}

/** Keys bound in index.html through data-i18n, data-i18n-title, data-i18n-aria-label, ... */
function htmlKeys() {
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  return [...html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map((match) => match[1]);
}

/** Literal keys in the UI modules: dotted string literals and the first argument of t('...'). */
function sourceKeys() {
  const keys = [];
  for (const file of readdirSync(SOURCE_DIR).filter((name) => name.endsWith('.js') && name !== 'i18n.js')) {
    const code = readFileSync(new URL(file, SOURCE_DIR), 'utf8');
    keys.push(...[...code.matchAll(/'([a-z][A-Za-z]*(?:\.[A-Za-z]+)+)'/g)].map((match) => match[1]));
    keys.push(...[...code.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1]));
  }
  return keys;
}

test('English is the default and the toggle switches en -> tr -> en', () => {
  assert.deepEqual(LANGUAGES, ['en', 'tr']);
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(nextLanguage('en'), 'tr');
  assert.equal(nextLanguage('tr'), 'en');
});

test('the language button name starts with the code it shows (WCAG 2.5.3 label in name)', () => {
  for (const language of LANGUAGES) {
    const shownCode = nextLanguage(language).toUpperCase(); // the button text set by main.js
    assert.ok(translate(language, 'lang.switch').startsWith(`${shownCode}: `), language);
  }
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  const button = html.match(/<button[^>]*id="lang-button"[^>]*>([^<]*)<\/button>/);
  assert.ok(button, 'index.html has the language button');
  assert.equal(button[1], nextLanguage(DEFAULT_LANGUAGE).toUpperCase());
  assert.ok(button[0].includes(`aria-label="${translate(DEFAULT_LANGUAGE, 'lang.switch')}"`));
});

test('isLanguage accepts only the supported codes', () => {
  assert.equal(isLanguage('en'), true);
  assert.equal(isLanguage('tr'), true);
  for (const value of ['de', 'EN', '', null, undefined, 0, 'toString']) assert.equal(isLanguage(value), false);
});

test('English and Turkish have the same keys and the same placeholders', () => {
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), Object.keys(STRINGS.en).sort());
  for (const [key, text] of Object.entries(STRINGS.en)) {
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(text), key);
  }
});

test('every string is non-empty text without stray spaces', () => {
  for (const language of LANGUAGES) {
    for (const [key, text] of Object.entries(STRINGS[language])) {
      assert.equal(typeof text, 'string', `${language} ${key}`);
      assert.ok(text.length > 0 && text === text.trim(), `${language} ${key}`);
    }
  }
});

test('translate fills placeholders and leaves unknown ones as they are', () => {
  assert.equal(translate('en', 'stat.versionValue', { version: 5, size: 37 }), '5 · 37×37');
  assert.equal(translate('en', 'percent', { value: 82 }), '82%');
  assert.equal(translate('tr', 'percent', { value: 82 }), '%82');
  assert.equal(translate('en', 'option.moduleSizeValue'), '{value} px');
  assert.equal(translate('en', 'option.moduleSizeValue', { other: 1 }), '{value} px');
  assert.equal(translate('tr', 'app.title'), 'QR Kod Oluşturucu');
});

test('translate falls back to English, then to the key itself', () => {
  assert.equal(translate('de', 'app.title'), 'QR Code Generator');
  assert.equal(translate('tr', 'no.such.key'), 'no.such.key');
  assert.equal(translate('en', 'toString'), 'toString');
  assert.equal(translate('tr', 'constructor'), 'constructor');
});

test('hasString knows only real keys', () => {
  assert.equal(hasString('app.title'), true);
  assert.equal(hasString('placeholder.wifi.ssid'), true);
  assert.equal(hasString('placeholder.wifi.password'), false);
  assert.equal(hasString('toString'), false);
});

test('formatNumber uses the digit grouping and decimal mark of the language', () => {
  assert.equal(formatNumber('en', 2953), '2,953');
  assert.equal(formatNumber('tr', 2953), '2.953');
  assert.equal(formatNumber('en', 4.5, 1), '4.5');
  assert.equal(formatNumber('tr', 4.5, 1), '4,5');
  assert.equal(formatNumber('en', 8.66, 1), '8.7');
  assert.equal(formatNumber('en', 8.66), '9');
  assert.equal(formatNumber('xx', 1234), '1,234');
});

test('every content type, field, choice, level, mode and unit has a string', () => {
  const keys = [];
  for (const type of PAYLOAD_TYPES) {
    keys.push(`type.${type}`, `hint.${type}`, `empty.${type}`);
    for (const field of PAYLOAD_FIELDS[type]) {
      keys.push(`field.${type}.${field.name}`);
      for (const value of field.options ?? []) keys.push(`choice.${type}.${field.name}.${value}`);
    }
  }
  for (const level of EC_LEVELS) keys.push(`ec.${level}`);
  for (const mode of ['numeric', 'alphanumeric', 'byte']) keys.push(`mode.${mode}`, `unit.${lengthUnit(mode)}`);
  for (const key of keys) assert.ok(hasString(key), key);
});

test('every key used in index.html and in the UI modules exists', () => {
  const html = htmlKeys();
  const source = sourceKeys();
  assert.ok(html.length > 30, 'index.html binds its strings');
  assert.ok(source.length > 15, 'the UI modules use string keys');
  for (const key of [...html, ...source]) assert.ok(hasString(key), key);
});
