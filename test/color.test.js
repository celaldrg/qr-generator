import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_SCAN_CONTRAST, contrastRatio, isHexColor, normalizeHexColor, parseHexColor, relativeLuminance,
} from '../src/color.js';

test('isHexColor accepts #rgb and #rrggbb only', () => {
  for (const valid of ['#fff', '#FFF', '#0f172a', '#4ADE80']) assert.equal(isHexColor(valid), true, valid);
  for (const invalid of ['fff', '#ffff', '#12345', '#gggggg', 'red', '', 42, null]) assert.equal(isHexColor(invalid), false, String(invalid));
});

test('parseHexColor and normalizeHexColor handle short and long forms', () => {
  assert.deepEqual(parseHexColor('#0f172a'), { r: 15, g: 23, b: 42 });
  assert.deepEqual(parseHexColor('#fA0'), { r: 255, g: 170, b: 0 });
  assert.equal(normalizeHexColor('#ABC'), '#aabbcc');
  assert.equal(normalizeHexColor('#4ADE80'), '#4ade80');
  assert.throws(() => parseHexColor('blue'), TypeError);
});

test('relative luminance runs from 0 for black to 1 for white', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  assert.equal(relativeLuminance('#ffffff'), 1);
  assert.ok(Math.abs(relativeLuminance('#808080') - 0.2159) < 1e-3);
});

test('contrast ratio is 21 for black on white, 1 for equal colours, and symmetric', () => {
  assert.equal(contrastRatio('#000', '#fff'), 21);
  assert.equal(contrastRatio('#4ade80', '#4ade80'), 1);
  assert.equal(contrastRatio('#14532d', '#f0fdf4'), contrastRatio('#f0fdf4', '#14532d'));
});

test('light-on-light colour pairs fall below the scanning threshold', () => {
  assert.equal(MIN_SCAN_CONTRAST, 3);
  assert.ok(contrastRatio('#4ade80', '#ffffff') < MIN_SCAN_CONTRAST);
  assert.ok(contrastRatio('#cccccc', '#ffffff') < MIN_SCAN_CONTRAST);
  assert.ok(contrastRatio('#14532d', '#f0fdf4') >= MIN_SCAN_CONTRAST);
  assert.ok(contrastRatio('#0f172a', '#ffffff') >= MIN_SCAN_CONTRAST);
});
