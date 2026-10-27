import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadValue, saveValue } from '../src/storage.js';

function memoryStore() {
  const data = new Map();
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const brokenStore = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('values round-trip as JSON under a namespaced key', () => {
  const store = memoryStore();
  assert.equal(saveValue('lang', 'tr', store), true);
  assert.equal(saveValue('options', { ecLevel: 'H', quietZone: 2 }, store), true);
  assert.equal(store.data.get('qr-generator:lang'), '"tr"');
  assert.equal(loadValue('lang', 'en', store), 'tr');
  assert.deepEqual(loadValue('options', {}, store), { ecLevel: 'H', quietZone: 2 });
});

test('missing keys and corrupt JSON return the fallback', () => {
  const store = memoryStore();
  assert.equal(loadValue('missing', 'en', store), 'en');
  store.setItem('qr-generator:lang', '{not json');
  assert.equal(loadValue('lang', 'en', store), 'en');
});

test('storage that throws or is unavailable never crashes', () => {
  assert.equal(loadValue('lang', 'en', brokenStore), 'en');
  assert.equal(saveValue('lang', 'tr', brokenStore), false);
  assert.equal(loadValue('lang', 'en', null), 'en');
  assert.equal(saveValue('lang', 'tr', null), false);
});
