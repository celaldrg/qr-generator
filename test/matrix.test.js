import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBits, versionBits } from '../src/format.js';
import {
  MASK_PATTERNS, penaltyBalance, penaltyBlocks, penaltyFinderLike, penaltyRuns, penaltyScore,
} from '../src/matrix.js';
import { encodeQr } from '../src/qr.js';
import { EC_LEVELS, alignmentPositions, symbolSize } from '../src/tables.js';

// ISO/IEC 18004 Annex E: alignment pattern centre coordinates for versions 2-40.
const STANDARD_ALIGNMENT = [
  [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74],
  [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

// "HELLO WORLD" at 1-Q with the automatically chosen mask (0), as rows of dark (#) and light (.) modules.
const HELLO_WORLD_1Q = [
  '#######.##....#######',
  '#.....#.#..#..#.....#',
  '#.###.#.#..##.#.###.#',
  '#.###.#.#.....#.###.#',
  '#.###.#.#.#...#.###.#',
  '#.....#...#...#.....#',
  '#######.#.#.#.#######',
  '........#............',
  '.##.#.##....#.#.#####',
  '.#......####....#...#',
  '..##.###.##...#.##...',
  '.##.##.#..##.#.#.###.',
  '#...#.#.#.###.###.#.#',
  '........##.#..#...#.#',
  '#######.#.#....#.##..',
  '#.....#..#.##.##.#...',
  '#.###.#.#.#...#######',
  '#.###.#..#.#.#.#...#.',
  '#.###.#.#..#.###.#..#',
  '#.....#.#.####...#.##',
  '#######....#.###....#',
];

const VERSION_7_TEXT = 'x'.repeat(120); // 120 bytes need version 7 at level M

const toRows = (modules) => modules.map((row) => row.map((dark) => (dark ? '#' : '.')).join(''));
const fromRows = (rows) => rows.map((row) => [...row].map((char) => char === '#'));

/** Reads 15 format bits, most significant first, in the reading order of a decoder. */
function readFormatCopies(modules) {
  const size = modules.length;
  const read = (positions) => positions.reduce((bits, [x, y]) => (bits << 1) | (modules[y][x] ? 1 : 0), 0);
  const first = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7],
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
  const second = [];
  for (let y = size - 1; y >= size - 7; y--) second.push([8, y]);
  for (let x = size - 8; x < size; x++) second.push([x, 8]);
  return [read(first), read(second)];
}

/** Reads both 18-bit version blocks, most significant first. */
function readVersionCopies(modules) {
  const size = modules.length;
  let topRight = 0;
  let bottomLeft = 0;
  for (let a = 5; a >= 0; a--) {
    for (let b = size - 9; b >= size - 11; b--) {
      topRight = (topRight << 1) | (modules[a][b] ? 1 : 0);
      bottomLeft = (bottomLeft << 1) | (modules[b][a] ? 1 : 0);
    }
  }
  return [topRight, bottomLeft];
}

function assertFinder(modules, left, top) {
  const size = modules.length;
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = left + dx;
      const y = top + dy;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const inside = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      assert.equal(modules[y][x], inside && ring !== 2, `finder module (${x}, ${y})`);
    }
  }
}

function assertAlignment(modules, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      assert.equal(modules[centerY + dy][centerX + dx], ring !== 1, `alignment (${centerX + dx}, ${centerY + dy})`);
    }
  }
}

test('alignment pattern centres match Annex E for every version', () => {
  assert.deepEqual(alignmentPositions(1), []);
  STANDARD_ALIGNMENT.forEach((expected, index) => assert.deepEqual(alignmentPositions(index + 2), expected));
});

test('symbol size is 4 * version + 17', () => {
  assert.equal(symbolSize(1), 21);
  assert.equal(symbolSize(40), 177);
  assert.equal(encodeQr('HELLO', { ecLevel: 'L' }).modules.length, 21);
  assert.ok(encodeQr(VERSION_7_TEXT).modules.every((row) => row.length === 45));
});

test('finder patterns with separators sit in three corners', () => {
  for (const text of ['HELLO WORLD', VERSION_7_TEXT]) {
    const { modules, size } = encodeQr(text);
    assertFinder(modules, 0, 0);
    assertFinder(modules, size - 7, 0);
    assertFinder(modules, 0, size - 7);
  }
});

test('timing patterns alternate between the separators', () => {
  const { modules, size } = encodeQr(VERSION_7_TEXT);
  for (let i = 8; i <= size - 9; i++) {
    assert.equal(modules[6][i], i % 2 === 0, `row timing ${i}`);
    assert.equal(modules[i][6], i % 2 === 0, `column timing ${i}`);
  }
});

test('alignment patterns are drawn at every centre except the three finder corners', () => {
  const { modules } = encodeQr(VERSION_7_TEXT);
  for (const [x, y] of [[22, 6], [6, 22], [22, 22], [38, 22], [22, 38], [38, 38]]) assertAlignment(modules, x, y);
  const version2 = encodeQr('x'.repeat(20), { ecLevel: 'L' });
  assert.equal(version2.version, 2);
  assertAlignment(version2.modules, 18, 18);
});

test('the dark module is at (8, size - 8)', () => {
  for (const text of ['A', VERSION_7_TEXT]) {
    const { modules, size } = encodeQr(text);
    assert.equal(modules[size - 8][8], true);
  }
});

test('both format information copies encode the level and the mask in use', () => {
  for (const ecLevel of EC_LEVELS) {
    for (let mask = 0; mask < 8; mask++) {
      const qr = encodeQr('FORMAT CHECK', { ecLevel, mask });
      assert.equal(qr.mask, mask);
      assert.deepEqual(readFormatCopies(qr.modules), [formatBits(ecLevel, mask), formatBits(ecLevel, mask)]);
    }
  }
});

test('both version information blocks are present from version 7 on', () => {
  for (const [text, ecLevel] of [[VERSION_7_TEXT, 'M'], ['y'.repeat(1000), 'L'], ['z'.repeat(2900), 'L']]) {
    const qr = encodeQr(text, { ecLevel, mask: 3 });
    assert.ok(qr.version >= 7);
    assert.deepEqual(readVersionCopies(qr.modules), [versionBits(qr.version), versionBits(qr.version)]);
  }
});

test('mask conditions follow the standard formulas (x = column, y = row)', () => {
  assert.equal(MASK_PATTERNS.length, 8);
  const sample = (mask) => [[0, 0], [1, 0], [3, 2], [2, 3], [5, 5], [4, 1]].map(([x, y]) => MASK_PATTERNS[mask](x, y));
  assert.deepEqual(sample(0), [true, false, false, false, true, false]);
  assert.deepEqual(sample(1), [true, true, true, false, false, false]);
  assert.deepEqual(sample(2), [true, false, true, false, false, false]);
  assert.deepEqual(sample(3), [true, false, false, false, false, false]);
  assert.deepEqual(sample(4), [true, true, true, false, false, false]);
  assert.deepEqual(sample(5), [true, true, true, true, false, false]);
  assert.deepEqual(sample(6), [true, true, true, true, true, false]);
  assert.deepEqual(sample(7), [true, false, false, false, false, true]);
});

test('penalty rule 1: runs of five or more score 3 plus the excess', () => {
  assert.equal(penaltyRuns(fromRows(['#####.'])), 3);
  assert.equal(penaltyRuns(fromRows(['#######'])), 5);
  assert.equal(penaltyRuns(fromRows(['####.####'])), 0);
  assert.equal(penaltyRuns(fromRows(['#', '#', '#', '#', '#', '#'])), 4);
});

test('penalty rule 2: every 2x2 single-colour block scores 3', () => {
  assert.equal(penaltyBlocks(fromRows(['###', '###'])), 6);
  assert.equal(penaltyBlocks(fromRows(['..', '..'])), 3);
  assert.equal(penaltyBlocks(fromRows(['#.#', '.#.', '#.#'])), 0);
});

test('penalty rule 3: 1:1:3:1:1 patterns next to four light modules score 40', () => {
  assert.equal(penaltyFinderLike(fromRows(['#.###.#....'])), 40);
  assert.equal(penaltyFinderLike(fromRows(['....#.###.#'])), 40);
  assert.equal(penaltyFinderLike(fromRows(['....#.###.#....'])), 40);
  assert.equal(penaltyFinderLike(fromRows(['#.###.#'])), 40); // the quiet zone around the symbol is light
  assert.equal(penaltyFinderLike(fromRows(['#.#.###.#.#'])), 0);
  assert.equal(penaltyFinderLike(fromRows(['#', '.', '#', '#', '#', '.', '#', '.', '.', '.', '.'])), 40);
});

test('penalty rule 4: 10 points per full 5 % away from half dark', () => {
  const matrix = (dark) => fromRows(Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => (y * 10 + x < dark ? '#' : '.')).join('')));
  assert.equal(penaltyBalance(matrix(50)), 0);
  assert.equal(penaltyBalance(matrix(46)), 0);
  assert.equal(penaltyBalance(matrix(45)), 10);
  assert.equal(penaltyBalance(matrix(40)), 20);
  assert.equal(penaltyBalance(matrix(100)), 100);
});

test('penaltyScore adds the four rules', () => {
  const modules = encodeQr('PENALTY', { mask: 2 }).modules;
  const sum = penaltyRuns(modules) + penaltyBlocks(modules) + penaltyFinderLike(modules) + penaltyBalance(modules);
  assert.equal(penaltyScore(modules), sum);
});

test('the automatic mask has the lowest penalty of all eight', () => {
  for (const [text, ecLevel] of [['HELLO WORLD', 'Q'], ['https://example.com/path', 'M'], ['0123456789'.repeat(12), 'H'], [VERSION_7_TEXT, 'L']]) {
    const penalties = MASK_PATTERNS.map((_, mask) => penaltyScore(encodeQr(text, { ecLevel, mask }).modules));
    const best = penalties.indexOf(Math.min(...penalties));
    assert.equal(encodeQr(text, { ecLevel }).mask, best, `${text.slice(0, 12)} at ${ecLevel}`);
  }
});

test('a forced mask changes only the data area', () => {
  const a = encodeQr('MASKS', { mask: 1 });
  const b = encodeQr('MASKS', { mask: 6 });
  assert.equal(a.mask, 1);
  assert.equal(b.mask, 6);
  assert.notDeepEqual(a.modules, b.modules);
  assertFinder(b.modules, 0, 0);
  assert.throws(() => encodeQr('MASKS', { mask: 8 }), RangeError);
  assert.throws(() => encodeQr('MASKS', { mask: 1.5 }), RangeError);
});

test('invalid input is rejected', () => {
  assert.throws(() => encodeQr(42), TypeError);
  assert.throws(() => encodeQr('x', { ecLevel: 'X' }), RangeError);
});

test('DONE: the matrix for a fixed input is deterministic', () => {
  const first = encodeQr('HELLO WORLD', { ecLevel: 'Q' });
  const second = encodeQr('HELLO WORLD', { ecLevel: 'Q' });
  assert.deepEqual(first, second);
  assert.equal(first.mask, 0);
  assert.deepEqual(toRows(first.modules), HELLO_WORLD_1Q);
});
