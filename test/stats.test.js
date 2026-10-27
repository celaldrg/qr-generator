import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr } from '../src/qr.js';
import { OPTION_RANGES } from '../src/generator.js';
import {
  MAX_PNG_SIZE, capacityUsage, fitPixelSize, lengthUnit, pngModuleSize, pngSize,
} from '../src/stats.js';
import { MAX_VERSION, MIN_VERSION, symbolSize } from '../src/tables.js';

test('lengths count bytes in byte mode and characters otherwise', () => {
  assert.equal(lengthUnit('byte'), 'bytes');
  assert.equal(lengthUnit('numeric'), 'characters');
  assert.equal(lengthUnit('alphanumeric'), 'characters');
});

test('capacity use is a rounded percentage capped at 100', () => {
  assert.deepEqual(capacityUsage({ length: 49, capacity: 60 }), { used: 49, total: 60, percent: 82 });
  assert.deepEqual(capacityUsage({ length: 60, capacity: 60 }), { used: 60, total: 60, percent: 100 });
  assert.deepEqual(capacityUsage({ length: 0, capacity: 17 }), { used: 0, total: 17, percent: 0 });
  assert.equal(capacityUsage({ length: 1, capacity: 0 }).percent, 100);
});

test('capacity use of HELLO WORLD at 1-Q is 11 of 16 characters', () => {
  const qr = encodeQr('HELLO WORLD', { ecLevel: 'Q' });
  assert.equal(qr.version, 1);
  assert.equal(qr.mode, 'alphanumeric');
  assert.deepEqual(capacityUsage(qr), { used: 11, total: 16, percent: 69 });
});

test('the PNG export keeps the chosen module size while it fits', () => {
  assert.equal(pngModuleSize({ size: 37 }, { moduleSize: 12, quietZone: 4 }), 12);
  assert.equal(pngSize({ size: 37 }, { moduleSize: 12, quietZone: 4 }), 540);
  assert.equal(pngSize({ size: 21 }, { moduleSize: 10, quietZone: 0 }), 210);
});

test('the PNG export of a version 40 symbol is scaled down to fit 4096 px', () => {
  const options = { moduleSize: 40, quietZone: 10 };
  assert.equal(pngModuleSize({ size: 177 }, options), 20);
  assert.equal(pngSize({ size: 177 }, options), 3940);
  assert.equal(pngModuleSize({ size: 5000 }, options), 1);
});

test('no version, quiet zone and module size gives a PNG over the limit', () => {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
    const qr = { size: symbolSize(version) };
    for (let quietZone = OPTION_RANGES.quietZone.min; quietZone <= OPTION_RANGES.quietZone.max; quietZone++) {
      for (let moduleSize = OPTION_RANGES.moduleSize.min; moduleSize <= OPTION_RANGES.moduleSize.max; moduleSize++) {
        const options = { moduleSize, quietZone };
        assert.ok(pngSize(qr, options) <= MAX_PNG_SIZE, `${version}/${quietZone}/${moduleSize}`);
        assert.ok(pngModuleSize(qr, options) >= 1);
      }
    }
  }
});

test('the preview gives every module the same whole number of device pixels', () => {
  assert.equal(fitPixelSize(316, 45), 315);
  assert.equal(fitPixelSize(316, 45, 2), 315);
  assert.equal(fitPixelSize(316, 45, 1.5), 300);
  for (const ratio of [1, 1.25, 1.5, 2, 3]) {
    for (const units of [21, 29, 45, 105, 185]) {
      const size = fitPixelSize(320, units, ratio);
      const perModule = (size * ratio) / units;
      assert.ok(size <= 320, `${ratio}/${units}`);
      if (size !== 320) assert.ok(Math.abs(perModule - Math.round(perModule)) < 1e-9, `${ratio}/${units}`);
    }
  }
});

test('the preview fills the box when fewer than two device pixels per module fit', () => {
  assert.equal(fitPixelSize(60, 45), 60);
  assert.equal(fitPixelSize(320, 185), 320);
  assert.equal(fitPixelSize(320, 185, 2), 277.5);
});
