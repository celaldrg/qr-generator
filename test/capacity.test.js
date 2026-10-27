import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QrCapacityError, encodeQr, interleaveCodewords, selectVersion } from '../src/qr.js';
import { capacity, encodeSegment } from '../src/segment.js';
import { EC_LEVELS, EC_RECOVERY_PERCENT, ecBlockInfo } from '../src/tables.js';

// ISO/IEC 18004 Table 7: byte-mode capacity per version (rows) and level L, M, Q, H.
const STANDARD_BYTE_CAPACITY = [
  [17, 14, 11, 7], [32, 26, 20, 14], [53, 42, 32, 24], [78, 62, 46, 34], [106, 84, 60, 44],
  [134, 106, 74, 58], [154, 122, 86, 64], [192, 152, 108, 84], [230, 180, 130, 98], [271, 213, 151, 119],
  [321, 251, 177, 137], [367, 287, 203, 155], [425, 331, 241, 177], [458, 362, 258, 194], [520, 412, 292, 220],
  [586, 450, 322, 250], [644, 504, 364, 280], [718, 560, 394, 310], [792, 624, 442, 338], [858, 666, 482, 382],
  [929, 711, 509, 403], [1003, 779, 565, 439], [1091, 857, 611, 461], [1171, 911, 661, 511], [1273, 997, 715, 535],
  [1367, 1059, 751, 593], [1465, 1125, 805, 625], [1528, 1190, 868, 658], [1628, 1264, 908, 698], [1732, 1370, 982, 742],
  [1840, 1452, 1030, 790], [1952, 1538, 1112, 842], [2068, 1628, 1168, 898], [2188, 1722, 1228, 958], [2303, 1809, 1283, 983],
  [2431, 1911, 1351, 1051], [2563, 1989, 1423, 1093], [2699, 2099, 1499, 1139], [2809, 2213, 1579, 1219], [2953, 2331, 1663, 1273],
];

// Numeric and alphanumeric capacities for a few versions: [version, level, numeric, alphanumeric].
const STANDARD_TEXT_CAPACITY = [
  [1, 'L', 41, 25], [1, 'M', 34, 20], [1, 'Q', 27, 16], [1, 'H', 17, 10],
  [2, 'L', 77, 47], [2, 'H', 34, 20], [10, 'M', 513, 311], [10, 'H', 288, 174],
  [40, 'L', 7089, 4296], [40, 'M', 5596, 3391], [40, 'Q', 3993, 2420], [40, 'H', 3057, 1852],
];

// ISO/IEC 18004 Table 9: error-correction blocks per version (rows) and level L, M, Q, H, as
// [EC codewords per block, blocks in group 1, data codewords per group-1 block,
//  blocks in group 2, data codewords per group-2 block]; an empty group 2 is left out.
const STANDARD_BLOCKS = [
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

const bytes = (count) => 'a'.repeat(count);

/** Data codewords of every block of a STANDARD_BLOCKS entry, group 1 first. */
function blockLengths([, count1, length1, count2 = 0, length2 = 0]) {
  return [...new Array(count1).fill(length1), ...new Array(count2).fill(length2)];
}

/** Calls check(version, level, entry) for each of the 160 STANDARD_BLOCKS entries. */
function forEachBlockEntry(check) {
  STANDARD_BLOCKS.forEach((row, index) => EC_LEVELS.forEach((level, column) => check(index + 1, level, row[column])));
}

test('byte-mode capacity matches the standard for all 160 version/level pairs', () => {
  STANDARD_BYTE_CAPACITY.forEach((row, index) => {
    EC_LEVELS.forEach((level, column) => {
      assert.equal(capacity(index + 1, level, 'byte'), row[column], `${index + 1}-${level}`);
    });
  });
});

test('numeric and alphanumeric capacities match the standard', () => {
  for (const [version, level, numeric, alphanumeric] of STANDARD_TEXT_CAPACITY) {
    assert.equal(capacity(version, level, 'numeric'), numeric, `${version}-${level} numeric`);
    assert.equal(capacity(version, level, 'alphanumeric'), alphanumeric, `${version}-${level} alphanumeric`);
  }
});

test('error-correction block structure matches the standard for all 160 version/level pairs', () => {
  forEachBlockEntry((version, level, entry) => {
    const [eccPerBlock] = entry;
    const lengths = blockLengths(entry);
    const dataCodewords = lengths.reduce((sum, length) => sum + length, 0);
    assert.deepEqual(ecBlockInfo(version, level), {
      numBlocks: lengths.length,
      eccPerBlock,
      totalCodewords: dataCodewords + lengths.length * eccPerBlock,
      dataCodewords,
    }, `${version}-${level}`);
  });
});

test('data codewords are split into the standard groups and interleaved, for all 160 pairs', () => {
  forEachBlockEntry((version, level, entry) => {
    const lengths = blockLengths(entry);
    // Each data codeword holds the number of its block in the standard, so the output shows the split.
    const data = Uint8Array.from(lengths.flatMap((length, block) => new Array(length).fill(block)));
    const expected = [];
    const longest = Math.max(...lengths);
    for (let i = 0; i < longest; i++) {
      lengths.forEach((length, block) => {
        if (i < length) expected.push(block);
      });
    }
    const result = interleaveCodewords(data, version, level);
    assert.equal(result.length, data.length + lengths.length * entry[0], `${version}-${level} length`);
    assert.deepEqual([...result.subarray(0, data.length)], expected, `${version}-${level}`);
  });
});

test('DONE: one byte over capacity moves to the next version, for every version and level', () => {
  STANDARD_BYTE_CAPACITY.forEach((row, index) => {
    const version = index + 1;
    EC_LEVELS.forEach((level, column) => {
      const fits = row[column];
      assert.equal(selectVersion(encodeSegment(bytes(fits)), level), version, `${fits} bytes at ${level}`);
      if (version < 40) {
        assert.equal(selectVersion(encodeSegment(bytes(fits + 1)), level), version + 1, `${fits + 1} bytes at ${level}`);
      } else {
        assert.throws(() => selectVersion(encodeSegment(bytes(fits + 1)), level), QrCapacityError);
      }
    });
  });
});

test('DONE: full encodes switch version exactly at the capacity boundaries', () => {
  const cases = [
    [bytes(17), 'L', 1], [bytes(18), 'L', 2],
    [bytes(213), 'M', 10], [bytes(214), 'M', 11],
    [bytes(1663), 'Q', 40],
    ['ğ'.repeat(8), 'L', 1], ['ğ'.repeat(9), 'L', 2],
    ['7'.repeat(41), 'L', 1], ['7'.repeat(42), 'L', 2],
    ['Z'.repeat(10), 'H', 1], ['Z'.repeat(11), 'H', 2],
  ];
  for (const [text, ecLevel, version] of cases) {
    const qr = encodeQr(text, { ecLevel, mask: 0 });
    assert.equal(qr.version, version, `${text.length} chars at ${ecLevel}`);
    assert.equal(qr.size, version * 4 + 17);
  }
});

test('text beyond version 40 raises QrCapacityError with the limits', () => {
  assert.throws(() => encodeQr(bytes(1274), { ecLevel: 'H' }), (error) => {
    assert.ok(error instanceof QrCapacityError);
    assert.ok(error instanceof RangeError);
    assert.equal(error.length, 1274);
    assert.equal(error.maxLength, 1273);
    assert.equal(error.mode, 'byte');
    return true;
  });
  assert.throws(() => encodeQr('1'.repeat(7090), { ecLevel: 'L' }), QrCapacityError);
});

test('encodeQr reports length and capacity in the units of its mode', () => {
  const qr = encodeQr('çay', { ecLevel: 'M' });
  assert.equal(qr.mode, 'byte');
  assert.equal(qr.length, 4);
  assert.equal(qr.capacity, 14);
  const numeric = encodeQr('31415926535', { ecLevel: 'H' });
  assert.equal(numeric.mode, 'numeric');
  assert.equal(numeric.length, 11);
  assert.equal(numeric.capacity, 17);
});

test('each level restores the share of codewords the standard quotes (7/15/25/30 %)', () => {
  assert.deepEqual(Object.keys(EC_RECOVERY_PERCENT), [...EC_LEVELS]);
  assert.deepEqual(Object.values(EC_RECOVERY_PERCENT), [7, 15, 25, 30]);
});
