import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vcardPayload, wifiPayload } from '../src/payload.js';
import { encodeQr } from '../src/qr.js';
import { rawDataModules } from '../src/tables.js';

/*
 * A small decoder written separately from the encoder, following the
 * standard's description (and the reading order of common readers). It turns
 * a module matrix back into text, checking format information, function
 * pattern layout, masking, block interleaving and Reed-Solomon syndromes.
 * It takes nothing from src/: the tables below are its own copies of the
 * ISO/IEC 18004 tables and its GF(256) arithmetic is its own, so a bug that
 * the encoder and the decoder shared could not cancel out.
 */

const LEVELS = ['L', 'M', 'Q', 'H'];

// Annex C: format information after the 101010000010010 mask, masks 0-7 per level.
const FORMAT_WORDS = {
  L: ['111011111000100', '111001011110011', '111110110101010', '111100010011101',
    '110011000101111', '110001100011000', '110110001000001', '110100101110110'],
  M: ['101010000010010', '101000100100101', '101111001111100', '101101101001011',
    '100010111111001', '100000011001110', '100111110010111', '100101010100000'],
  Q: ['011010101011111', '011000001101000', '011111100110001', '011101000000110',
    '010010010110100', '010000110000011', '010111011011010', '010101111101101'],
  H: ['001011010001001', '001001110111110', '001110011100111', '001100111010000',
    '000011101100010', '000001001010101', '000110100001100', '000100000111011'],
};

// Annex E: alignment pattern centre coordinates per version (version 1 has none).
const ALIGNMENT_CENTRES = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74],
  [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94],
  [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126],
  [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138],
  [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
  [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
  [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

// Table 9: error-correction blocks per version (rows) and level L, M, Q, H, as
// [EC codewords per block, blocks in group 1, data codewords each, blocks in group 2, data codewords each].
const BLOCKS = [
  [[7, 1, 19], [10, 1, 16], [13, 1, 13], [17, 1, 9]],
  [[10, 1, 34], [16, 1, 28], [22, 1, 22], [28, 1, 16]],
  [[15, 1, 55], [26, 1, 44], [18, 2, 17], [22, 2, 13]],
  [[20, 1, 80], [18, 2, 32], [26, 2, 24], [16, 4, 9]],
  [[26, 1, 108], [24, 2, 43], [18, 2, 15, 2, 16], [22, 2, 11, 2, 12]],
  [[18, 2, 68], [16, 4, 27], [24, 4, 19], [28, 4, 15]],
  [[20, 2, 78], [18, 4, 31], [18, 2, 14, 4, 15], [26, 4, 13, 1, 14]],
  [[24, 2, 97], [22, 2, 38, 2, 39], [22, 4, 18, 2, 19], [26, 4, 14, 2, 15]],
  [[30, 2, 116], [22, 3, 36, 2, 37], [20, 4, 16, 4, 17], [24, 4, 12, 4, 13]],
  [[18, 2, 68, 2, 69], [26, 4, 43, 1, 44], [24, 6, 19, 2, 20], [28, 6, 15, 2, 16]],
  [[20, 4, 81], [30, 1, 50, 4, 51], [28, 4, 22, 4, 23], [24, 3, 12, 8, 13]],
  [[24, 2, 92, 2, 93], [22, 6, 36, 2, 37], [26, 4, 20, 6, 21], [28, 7, 14, 4, 15]],
  [[26, 4, 107], [22, 8, 37, 1, 38], [24, 8, 20, 4, 21], [22, 12, 11, 4, 12]],
  [[30, 3, 115, 1, 116], [24, 4, 40, 5, 41], [20, 11, 16, 5, 17], [24, 11, 12, 5, 13]],
  [[22, 5, 87, 1, 88], [24, 5, 41, 5, 42], [30, 5, 24, 7, 25], [24, 11, 12, 7, 13]],
  [[24, 5, 98, 1, 99], [28, 7, 45, 3, 46], [24, 15, 19, 2, 20], [30, 3, 15, 13, 16]],
  [[28, 1, 107, 5, 108], [28, 10, 46, 1, 47], [28, 1, 22, 15, 23], [28, 2, 14, 17, 15]],
  [[30, 5, 120, 1, 121], [26, 9, 43, 4, 44], [28, 17, 22, 1, 23], [28, 2, 14, 19, 15]],
  [[28, 3, 113, 4, 114], [26, 3, 44, 11, 45], [26, 17, 21, 4, 22], [26, 9, 13, 16, 14]],
  [[28, 3, 107, 5, 108], [26, 3, 41, 13, 42], [30, 15, 24, 5, 25], [28, 15, 15, 10, 16]],
  [[28, 4, 116, 4, 117], [26, 17, 42], [28, 17, 22, 6, 23], [30, 19, 16, 6, 17]],
  [[28, 2, 111, 7, 112], [28, 17, 46], [30, 7, 24, 16, 25], [24, 34, 13]],
  [[30, 4, 121, 5, 122], [28, 4, 47, 14, 48], [30, 11, 24, 14, 25], [30, 16, 15, 14, 16]],
  [[30, 6, 117, 4, 118], [28, 6, 45, 14, 46], [30, 11, 24, 16, 25], [30, 30, 16, 2, 17]],
  [[26, 8, 106, 4, 107], [28, 8, 47, 13, 48], [30, 7, 24, 22, 25], [30, 22, 15, 13, 16]],
  [[28, 10, 114, 2, 115], [28, 19, 46, 4, 47], [28, 28, 22, 6, 23], [30, 33, 16, 4, 17]],
  [[30, 8, 122, 4, 123], [28, 22, 45, 3, 46], [30, 8, 23, 26, 24], [30, 12, 15, 28, 16]],
  [[30, 3, 117, 10, 118], [28, 3, 45, 23, 46], [30, 4, 24, 31, 25], [30, 11, 15, 31, 16]],
  [[30, 7, 116, 7, 117], [28, 21, 45, 7, 46], [30, 1, 23, 37, 24], [30, 19, 15, 26, 16]],
  [[30, 5, 115, 10, 116], [28, 19, 47, 10, 48], [30, 15, 24, 25, 25], [30, 23, 15, 25, 16]],
  [[30, 13, 115, 3, 116], [28, 2, 46, 29, 47], [30, 42, 24, 1, 25], [30, 23, 15, 28, 16]],
  [[30, 17, 115], [28, 10, 46, 23, 47], [30, 10, 24, 35, 25], [30, 19, 15, 35, 16]],
  [[30, 17, 115, 1, 116], [28, 14, 46, 21, 47], [30, 29, 24, 19, 25], [30, 11, 15, 46, 16]],
  [[30, 13, 115, 6, 116], [28, 14, 46, 23, 47], [30, 44, 24, 7, 25], [30, 59, 16, 1, 17]],
  [[30, 12, 121, 7, 122], [28, 12, 47, 26, 48], [30, 39, 24, 14, 25], [30, 22, 15, 41, 16]],
  [[30, 6, 121, 14, 122], [28, 6, 47, 34, 48], [30, 46, 24, 10, 25], [30, 2, 15, 64, 16]],
  [[30, 17, 122, 4, 123], [28, 29, 46, 14, 47], [30, 49, 24, 10, 25], [30, 24, 15, 46, 16]],
  [[30, 4, 122, 18, 123], [28, 13, 46, 32, 47], [30, 48, 24, 14, 25], [30, 42, 15, 32, 16]],
  [[30, 20, 117, 4, 118], [28, 40, 47, 7, 48], [30, 43, 24, 22, 25], [30, 10, 15, 67, 16]],
  [[30, 19, 118, 6, 119], [28, 18, 47, 31, 48], [30, 34, 24, 34, 25], [30, 20, 15, 61, 16]],
];

// Table 1: remainder bits per version.
const REMAINDER_BITS = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3,
  4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0];

const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const BYTE_MODE = 4;
// Character count bits per mode indicator for versions 1-9, 10-26 and 27-40.
const COUNT_BITS = { 1: [10, 12, 14], 2: [9, 11, 13], [BYTE_MODE]: [8, 16, 16] };
const MODE_NAMES = { 1: 'numeric', 2: 'alphanumeric', [BYTE_MODE]: 'byte' };
// Mask conditions as printed in the standard: i = row, j = column.
const MASK_CONDITIONS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

const countBand = (version) => (version <= 9 ? 0 : version <= 26 ? 1 : 2);

/** Product in GF(256) modulo x^8 + x^4 + x^3 + x^2 + 1, by shifting and adding. */
function gfMultiply(a, b) {
  let product = 0;
  let shifted = a;
  for (let rest = b; rest > 0; rest >>>= 1) {
    if (rest & 1) product ^= shifted;
    shifted = (shifted << 1) ^ (shifted & 0x80 ? 0x11d : 0);
  }
  return product;
}

/** Data codewords of every block (group 1 first), EC codewords per block and the totals. */
function blockLayout(version, ecLevel) {
  const [eccPerBlock, count1, length1, count2 = 0, length2 = 0] = BLOCKS[version - 1][LEVELS.indexOf(ecLevel)];
  const dataLengths = [...new Array(count1).fill(length1), ...new Array(count2).fill(length2)];
  const dataCodewords = dataLengths.reduce((sum, length) => sum + length, 0);
  return { eccPerBlock, dataLengths, dataCodewords, totalCodewords: dataCodewords + dataLengths.length * eccPerBlock };
}

/** Longest byte-mode text: the data bits minus the mode indicator and the character count. */
function byteCapacity(version, ecLevel) {
  const headerBits = 4 + COUNT_BITS[BYTE_MODE][countBand(version)];
  return Math.floor((blockLayout(version, ecLevel).dataCodewords * 8 - headerBits) / 8);
}

function readFormat(modules) {
  const size = modules.length;
  const bit = (x, y) => (modules[y][x] ? '1' : '0');
  let first = '';
  for (let x = 0; x <= 5; x++) first += bit(x, 8);
  for (const [x, y] of [[7, 8], [8, 8], [8, 7]]) first += bit(x, y);
  for (let y = 5; y >= 0; y--) first += bit(8, y);
  let second = '';
  for (let y = size - 1; y >= size - 7; y--) second += bit(8, y);
  for (let x = size - 8; x < size; x++) second += bit(x, 8);
  assert.equal(first, second, 'the two format copies differ');
  const ecLevel = LEVELS.find((level) => FORMAT_WORDS[level].includes(first));
  assert.ok(ecLevel, `format information ${first} is not in the standard table`);
  return { ecLevel, mask: FORMAT_WORDS[ecLevel].indexOf(first) };
}

function functionModuleMap(version) {
  const size = version * 4 + 17;
  const map = Array.from({ length: size }, () => new Array(size).fill(false));
  const region = (left, top, width, height) => {
    for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) map[y][x] = true;
  };
  region(0, 0, 9, 9); // finder, separator and format information, top left
  region(size - 8, 0, 8, 9); // top right
  region(0, size - 8, 9, 8); // bottom left, including the dark module
  region(6, 9, 1, size - 17); // vertical timing pattern
  region(9, 6, size - 17, 1); // horizontal timing pattern
  const centres = ALIGNMENT_CENTRES[version - 1];
  const last = centres.length - 1;
  centres.forEach((y, row) => centres.forEach((x, column) => {
    const nearFinder = (row === 0 && (column === 0 || column === last)) || (row === last && column === 0);
    if (!nearFinder) region(x - 2, y - 2, 5, 5);
  }));
  if (version >= 7) {
    region(size - 11, 0, 3, 6);
    region(0, size - 11, 6, 3);
  }
  return map;
}

function readDataBits(modules, isFunction, mask) {
  const size = modules.length;
  const condition = MASK_CONDITIONS[mask];
  const bits = [];
  let upward = true;
  for (let column = size - 1; column > 0; column -= 2) {
    if (column === 6) column--;
    for (let count = 0; count < size; count++) {
      const row = upward ? size - 1 - count : count;
      for (const x of [column, column - 1]) {
        if (!isFunction[row][x]) bits.push(modules[row][x] !== condition(row, x) ? 1 : 0);
      }
    }
    upward = !upward;
  }
  return bits;
}

function toBytes(bits, count) {
  return Array.from({ length: count }, (_, i) => bits.slice(i * 8, i * 8 + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
}

function deinterleave(codewords, { eccPerBlock, dataLengths }) {
  const blocks = dataLengths.map((length) => ({ length, data: [], ecc: [] }));
  const longest = Math.max(...dataLengths);
  let next = 0;
  for (let i = 0; i < longest; i++) for (const block of blocks) if (i < block.length) block.data.push(codewords[next++]);
  for (let i = 0; i < eccPerBlock; i++) for (const block of blocks) block.ecc.push(codewords[next++]);
  return blocks;
}

/** Syndromes S_i = c(alpha^i) for i = 0 .. EC codewords - 1; all zero for an intact block. */
function syndromes(block) {
  const codeword = [...block.data, ...block.ecc];
  const values = [];
  let root = 1;
  for (let i = 0; i < block.ecc.length; i++) {
    values.push(codeword.reduce((acc, value) => gfMultiply(acc, root) ^ value, 0));
    root = gfMultiply(root, 2);
  }
  return values;
}

function readNumeric(read, count) {
  let digits = '';
  while (count - digits.length >= 3) digits += String(read(10)).padStart(3, '0');
  if (count - digits.length === 2) digits += String(read(7)).padStart(2, '0');
  if (count - digits.length === 1) digits += String(read(4));
  return digits;
}

function readAlphanumeric(read, count) {
  let chars = '';
  while (count - chars.length >= 2) {
    const pair = read(11);
    chars += ALPHANUMERIC[Math.floor(pair / 45)] + ALPHANUMERIC[pair % 45];
  }
  if (count - chars.length === 1) chars += ALPHANUMERIC[read(6)];
  return chars;
}

function parseSegments(dataCodewords, version) {
  const bits = dataCodewords.flatMap((byte) => Array.from({ length: 8 }, (_, k) => (byte >>> (7 - k)) & 1));
  let position = 0;
  const read = (count) => {
    let value = 0;
    for (let k = 0; k < count; k++) value = (value << 1) | bits[position++];
    return value;
  };
  const segments = [];
  let text = '';
  while (bits.length - position >= 4) {
    const mode = read(4);
    if (mode === 0) break;
    assert.ok(COUNT_BITS[mode], `unexpected mode indicator ${mode}`);
    const count = read(COUNT_BITS[mode][countBand(version)]);
    segments.push(MODE_NAMES[mode]);
    if (mode === 1) text += readNumeric(read, count);
    else if (mode === 2) text += readAlphanumeric(read, count);
    else text += new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from({ length: count }, () => read(8)));
  }
  return { text, segments };
}

function decodeQr(modules) {
  const size = modules.length;
  const version = (size - 17) / 4;
  assert.ok(Number.isInteger(version) && version >= 1 && version <= 40, `bad size ${size}`);
  assert.ok(modules.every((row) => row.length === size), 'matrix is not square');
  const { ecLevel, mask } = readFormat(modules);
  const layout = blockLayout(version, ecLevel);
  const bits = readDataBits(modules, functionModuleMap(version), mask);
  assert.equal(bits.length, layout.totalCodewords * 8 + REMAINDER_BITS[version - 1], 'codeword area size');
  assert.ok(bits.slice(layout.totalCodewords * 8).every((bit) => bit === 0), 'remainder bits must be zero');
  const blocks = deinterleave(toBytes(bits, layout.totalCodewords), layout);
  blocks.forEach((block, index) => assert.ok(syndromes(block).every((value) => value === 0), `block ${index} is corrupt`));
  return { version, ecLevel, mask, ...parseSegments(blocks.flatMap((block) => block.data), version) };
}

/** Deterministic printable ASCII text (always byte mode: starts with a lowercase letter). */
function seededText(seed, length) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:;/-_?=&%';
  let state = seed >>> 0;
  let text = 'q';
  while (text.length < length) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    text += alphabet[(state >>> 16) % alphabet.length];
  }
  return text.slice(0, length);
}

const SAMPLES = [
  '',
  '0',
  '8675309',
  'HELLO WORLD',
  'AC-42',
  'Hello, World!',
  'https://celaldrg.github.io/qr-generator/',
  'Çağlar şöyle dedi: ğüşıöç İĞÜŞÖÇ',
  'emoji 😀🎉 ok',
  wifiPayload({ ssid: 'Cafe;Guest', password: 'p@ss:"word"', security: 'WPA' }),
  vcardPayload({ firstName: 'Ada', lastName: 'Lovelace', phone: '+44 20 1234 5678', email: 'ada@example.com' }),
];

test('the decoder tables agree: free modules = 8 x codewords + remainder bits = rawDataModules', () => {
  for (let version = 1; version <= 40; version++) {
    const free = functionModuleMap(version).flat().filter((reserved) => !reserved).length;
    assert.equal(free, rawDataModules(version), `version ${version}`);
    for (const ecLevel of LEVELS) {
      const { totalCodewords } = blockLayout(version, ecLevel);
      assert.equal(free, totalCodewords * 8 + REMAINDER_BITS[version - 1], `${version}-${ecLevel}`);
    }
  }
});

test('every sample decodes back to its text at every error-correction level', () => {
  for (const text of SAMPLES) {
    for (const ecLevel of LEVELS) {
      const qr = encodeQr(text, { ecLevel });
      const decoded = decodeQr(qr.modules);
      assert.equal(decoded.text, text);
      assert.equal(decoded.ecLevel, ecLevel);
      assert.equal(decoded.mask, qr.mask);
      assert.equal(decoded.version, qr.version);
      assert.deepEqual(decoded.segments, [qr.mode]);
    }
  }
});

test('all eight masks decode back, with and without version information', () => {
  for (const text of ['MASK TEST 0123', seededText(7, 150)]) {
    for (let mask = 0; mask < 8; mask++) {
      const decoded = decodeQr(encodeQr(text, { ecLevel: 'M', mask }).modules);
      assert.equal(decoded.mask, mask);
      assert.equal(decoded.text, text);
    }
  }
});

test('every version and level (all 160) decodes back when filled to its byte capacity', () => {
  for (let version = 1; version <= 40; version++) {
    LEVELS.forEach((ecLevel, index) => {
      const text = seededText(version * 4 + index, byteCapacity(version, ecLevel));
      const qr = encodeQr(text, { ecLevel, mask: (version + index) % 8 });
      assert.equal(qr.version, version, `${version}-${ecLevel}`);
      assert.equal(decodeQr(qr.modules).text, text, `${version}-${ecLevel}`);
    });
  }
});

test('the longest numeric and alphanumeric texts decode back at version 40', () => {
  const digits = Array.from({ length: 7089 }, (_, i) => String((i * 7) % 10)).join('');
  const letters = Array.from({ length: 4296 }, (_, i) => ALPHANUMERIC[(i * 11) % 45]).join('');
  for (const [text, mode] of [[digits, 'numeric'], [letters, 'alphanumeric']]) {
    const qr = encodeQr(text, { ecLevel: 'L', mask: 5 });
    assert.equal(qr.version, 40);
    assert.equal(qr.mode, mode);
    assert.equal(decodeQr(qr.modules).text, text);
  }
});
