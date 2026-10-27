import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAYLOAD_TYPES } from '../src/payload.js';
import { rovingIndex, shortcutAction } from '../src/shortcuts.js';
import { EC_LEVELS } from '../src/tables.js';

test('digits 1-6 pick the content types in tab order', () => {
  PAYLOAD_TYPES.forEach((type, index) => {
    assert.deepEqual(shortcutAction({ key: String(index + 1) }), { name: 'type', type });
  });
  for (const key of ['0', '7', '9']) assert.equal(shortcutAction({ key }), null, key);
});

test('L, M, Q and H pick the error-correction level in either case', () => {
  for (const level of EC_LEVELS) {
    assert.deepEqual(shortcutAction({ key: level }), { name: 'ecLevel', level });
    assert.deepEqual(shortcutAction({ key: level.toLowerCase() }), { name: 'ecLevel', level });
  }
});

test('O toggles the options, P and S download, C copies', () => {
  assert.deepEqual(shortcutAction({ key: 'o' }), { name: 'toggleOptions' });
  assert.deepEqual(shortcutAction({ key: 'O' }), { name: 'toggleOptions' });
  assert.deepEqual(shortcutAction({ key: 'p' }), { name: 'downloadPng' });
  assert.deepEqual(shortcutAction({ key: 'S' }), { name: 'downloadSvg' });
  assert.deepEqual(shortcutAction({ key: 'c' }), { name: 'copySvg' });
});

test('presses with Ctrl, Alt or Meta stay with the browser', () => {
  assert.equal(shortcutAction({ key: 'c', ctrlKey: true }), null);
  assert.equal(shortcutAction({ key: 's', metaKey: true }), null);
  assert.equal(shortcutAction({ key: 'p', altKey: true }), null);
  assert.equal(shortcutAction({ key: '1', ctrlKey: true }), null);
});

test('named keys and unbound characters do nothing', () => {
  for (const key of ['Enter', 'Escape', 'ArrowLeft', 'Tab', 'x', 'i', ' ', '', '+']) {
    assert.equal(shortcutAction({ key }), null, JSON.stringify(key));
  }
  assert.equal(shortcutAction({}), null);
});

test('arrow keys move through the tabs and wrap around', () => {
  assert.equal(rovingIndex('ArrowRight', 0, 6), 1);
  assert.equal(rovingIndex('ArrowDown', 5, 6), 0);
  assert.equal(rovingIndex('ArrowLeft', 0, 6), 5);
  assert.equal(rovingIndex('ArrowUp', 3, 6), 2);
});

test('Home and End jump to the first and the last tab', () => {
  assert.equal(rovingIndex('Home', 4, 6), 0);
  assert.equal(rovingIndex('End', 1, 6), 5);
});

test('other keys do not move the tab focus', () => {
  for (const key of ['Enter', ' ', 'a', 'Tab', 'toString', 'constructor']) {
    assert.equal(rovingIndex(key, 2, 6), null, key);
  }
});
