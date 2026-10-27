import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeQr } from '../src/qr.js';
import { outerSize, renderToCanvas, svgPathData, toSvgString } from '../src/render.js';

const qr = encodeQr('HELLO WORLD', { ecLevel: 'Q' });
const darkCount = qr.modules.flat().filter(Boolean).length;

/** Cells covered by "M x y h n v1 h-n z" runs. */
function coveredCells(pathData) {
  const cells = new Set();
  for (const [, x, y, length] of pathData.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    for (let i = 0; i < Number(length); i++) cells.add(`${Number(x) + i},${y}`);
  }
  return cells;
}

function mockCanvas() {
  const calls = [];
  const context = {
    fillStyle: '',
    fillRect(x, y, width, height) {
      calls.push({ color: this.fillStyle, x, y, width, height });
    },
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext(type) {
      assert.equal(type, '2d');
      return context;
    },
  };
  return { canvas, calls };
}

test('outer size adds the quiet zone on both sides', () => {
  assert.equal(outerSize(qr, 4), 29);
  assert.equal(outerSize(qr, 0), 21);
});

test('SVG path covers exactly the dark modules, shifted by the quiet zone', () => {
  const quietZone = 3;
  const expected = new Set();
  qr.modules.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) expected.add(`${x + quietZone},${y + quietZone}`);
  }));
  const pathData = svgPathData(qr, quietZone);
  assert.equal(pathData.replace(/M\d+ \d+h\d+v1h-\d+z/g, ''), '');
  assert.deepEqual(coveredCells(pathData), expected);
});

test('SVG document is crisp, sized by module size and coloured as asked', () => {
  const svg = toSvgString(qr, { moduleSize: 8, quietZone: 4, foreground: '#14532d', background: '#f0fdf4' });
  assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="232" height="232" viewBox="0 0 29 29"'));
  assert.ok(svg.includes('shape-rendering="crispEdges"'));
  assert.ok(svg.includes('<rect width="29" height="29" fill="#f0fdf4"/>'));
  assert.ok(svg.includes(`<path d="${svgPathData(qr, 4)}" fill="#14532d"/>`));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
});

test('SVG defaults to black on white with a 4-module quiet zone', () => {
  const svg = toSvgString(qr);
  assert.ok(svg.includes('viewBox="0 0 29 29"'));
  assert.ok(svg.includes('width="290"'));
  assert.ok(svg.includes('fill="#ffffff"'));
  assert.ok(svg.includes('fill="#000000"'));
});

test('invalid render options are rejected (no markup injection)', () => {
  assert.throws(() => toSvgString(qr, { foreground: 'red"/><script>' }), TypeError);
  assert.throws(() => toSvgString(qr, { background: 'url(#x)' }), TypeError);
  assert.throws(() => toSvgString(qr, { moduleSize: 0 }), RangeError);
  assert.throws(() => toSvgString(qr, { quietZone: -1 }), RangeError);
  assert.throws(() => toSvgString(qr, { quietZone: 1.5 }), RangeError);
});

test('canvas rendering resizes the canvas and paints background then dark runs', () => {
  const { canvas, calls } = mockCanvas();
  const pixels = renderToCanvas(canvas, qr, { moduleSize: 3, quietZone: 2, foreground: '#111111', background: '#eeeeee' });
  assert.equal(pixels, 75);
  assert.equal(canvas.width, 75);
  assert.equal(canvas.height, 75);
  assert.deepEqual(calls[0], { color: '#eeeeee', x: 0, y: 0, width: 75, height: 75 });

  const runs = calls.slice(1);
  assert.ok(runs.every((call) => call.color === '#111111' && call.height === 3));
  assert.equal(runs.reduce((area, call) => area + call.width * call.height, 0), darkCount * 9);
  assert.ok(runs.every((call) => call.x >= 6 && call.y >= 6 && call.x + call.width <= 69 && call.y + call.height <= 69));
  const topLeftFinderRow = runs.find((call) => call.x === 6 && call.y === 6);
  assert.equal(topLeftFinderRow.width, 7 * 3);
});
