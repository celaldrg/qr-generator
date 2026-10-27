import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rsRemainder } from '../src/gf256.js';
import { interleaveCodewords } from '../src/qr.js';
import { buildDataCodewords, detectMode, encodeSegment, segmentBitLength } from '../src/segment.js';
import { charCountBits } from '../src/tables.js';

const HELLO_DATA = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236];
const HELLO_ECC = [168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16];

const bitString = (segment) => segment.bits.join('');

test('detectMode picks the most compact mode for the whole string', () => {
  assert.equal(detectMode('0123456789'), 'numeric');
  assert.equal(detectMode(''), 'numeric');
  assert.equal(detectMode('HELLO WORLD'), 'alphanumeric');
  assert.equal(detectMode('A B$%*+-./:9'), 'alphanumeric');
  assert.equal(detectMode('12 34'), 'alphanumeric');
  assert.equal(detectMode('Hello'), 'byte');
  assert.equal(detectMode('HTTPS://EXAMPLE.COM/?Q'), 'byte');
  assert.equal(detectMode('ÇAY'), 'byte');
});

test('numeric mode packs digits in groups of three (standard example "01234567")', () => {
  const segment = encodeSegment('01234567');
  assert.equal(segment.mode, 'numeric');
  assert.equal(segment.length, 8);
  assert.equal(bitString(segment), '0000001100' + '0101011001' + '1000011');
  assert.equal(segmentBitLength(segment, 1), 4 + 10 + 27);
});

test('alphanumeric mode packs pairs into 11 bits (standard example "AC-42")', () => {
  const segment = encodeSegment('AC-42');
  assert.equal(segment.mode, 'alphanumeric');
  assert.equal(segment.length, 5);
  assert.equal(bitString(segment), '00111001110' + '11100111001' + '000010');
});

test('byte mode encodes UTF-8 and counts bytes, not characters', () => {
  const turkish = encodeSegment('ğ');
  assert.equal(turkish.mode, 'byte');
  assert.equal(turkish.length, 2);
  assert.equal(bitString(turkish), '11000100' + '10011111');
  assert.equal(encodeSegment('a😀').length, 5);
  assert.equal(encodeSegment('hello').bits.length, 40);
});

test('character count indicator grows at versions 10 and 27', () => {
  assert.deepEqual([1, 9, 10, 26, 27, 40].map((v) => charCountBits('numeric', v)), [10, 10, 12, 12, 14, 14]);
  assert.deepEqual([1, 9, 10, 26, 27, 40].map((v) => charCountBits('alphanumeric', v)), [9, 9, 11, 11, 13, 13]);
  assert.deepEqual([1, 9, 10, 26, 27, 40].map((v) => charCountBits('byte', v)), [8, 8, 16, 16, 16, 16]);
  const segment = encodeSegment('123');
  assert.deepEqual([1, 10, 27].map((v) => segmentBitLength(segment, v)), [24, 26, 28]);
});

test('DONE: "HELLO WORLD" at version 1-Q gives the reference data codewords', () => {
  const data = buildDataCodewords(encodeSegment('HELLO WORLD'), 1, 'Q');
  assert.deepEqual(Array.from(data), HELLO_DATA);
});

test('DONE: "HELLO WORLD" at version 1-Q gives the reference error-correction codewords', () => {
  assert.deepEqual(Array.from(rsRemainder(HELLO_DATA, 13)), HELLO_ECC);
});

test('a single block is not interleaved: 1-Q output is data then error correction', () => {
  const data = buildDataCodewords(encodeSegment('HELLO WORLD'), 1, 'Q');
  assert.deepEqual(Array.from(interleaveCodewords(data, 1, 'Q')), [...HELLO_DATA, ...HELLO_ECC]);
});

test('terminator, bit padding and alternating 236/17 pad codewords fill the capacity', () => {
  const data = Array.from(buildDataCodewords(encodeSegment('1'), 1, 'L'));
  assert.equal(data.length, 19);
  assert.deepEqual(data.slice(0, 3), [0b00010000, 0b00000100, 0b01000000]);
  assert.deepEqual(data.slice(3), [236, 17, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17]);
});

test('a full numeric symbol gets a truncated terminator and no padding', () => {
  // 41 digits at 1-L: 4 + 10 + 13 * 10 + 7 = 151 bits of 152, so one terminator bit.
  const digits = '1234567890'.repeat(4) + '1';
  const data = buildDataCodewords(encodeSegment(digits), 1, 'L');
  assert.equal(data.length, 19);
  // last byte = final group "01" (0000001) + the single terminator bit
  assert.equal(data.at(-1), 0b00000010);
});

test('a 4-bit terminator can spill into its own zero codeword', () => {
  // "12" at 1-L: 4 + 10 + 7 = 21 bits, so the terminator ends at bit 25 and the
  // padding to a byte boundary leaves a whole zero codeword before 236/17.
  const data = Array.from(buildDataCodewords(encodeSegment('12'), 1, 'L'));
  assert.deepEqual(data.slice(0, 6), [0b00010000, 0b00001000, 0b01100000, 0b00000000, 236, 17]);
});

test('buildDataCodewords rejects a segment that does not fit', () => {
  assert.throws(() => buildDataCodewords(encodeSegment('x'.repeat(18)), 1, 'L'), RangeError);
});

test('blocks are interleaved column by column, the longer blocks finishing last (5-Q)', () => {
  // 5-Q has 2 blocks of 15 and 2 blocks of 16 data codewords, 18 EC codewords each.
  const data = Uint8Array.from({ length: 62 }, (_, i) => i);
  const result = Array.from(interleaveCodewords(data, 5, 'Q'));
  assert.equal(result.length, 134);

  const expectedData = [];
  for (let i = 0; i < 15; i++) expectedData.push(i, 15 + i, 30 + i, 46 + i);
  expectedData.push(45, 61);
  assert.deepEqual(result.slice(0, 62), expectedData);

  const blocks = [data.subarray(0, 15), data.subarray(15, 30), data.subarray(30, 46), data.subarray(46, 62)];
  const eccs = blocks.map((block) => rsRemainder(block, 18));
  const expectedEcc = [];
  for (let i = 0; i < 18; i++) for (const ecc of eccs) expectedEcc.push(ecc[i]);
  assert.deepEqual(result.slice(62), expectedEcc);
});
