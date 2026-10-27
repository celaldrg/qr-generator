import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBits, versionBits } from '../src/format.js';

// ISO/IEC 18004 format information strings (after the 101010000010010 mask), masks 0-7.
const STANDARD_FORMAT = {
  L: ['111011111000100', '111001011110011', '111110110101010', '111100010011101',
    '110011000101111', '110001100011000', '110110001000001', '110100101110110'],
  M: ['101010000010010', '101000100100101', '101111001111100', '101101101001011',
    '100010111111001', '100000011001110', '100111110010111', '100101010100000'],
  Q: ['011010101011111', '011000001101000', '011111100110001', '011101000000110',
    '010010010110100', '010000110000011', '010111011011010', '010101111101101'],
  H: ['001011010001001', '001001110111110', '001110011100111', '001100111010000',
    '000011101100010', '000001001010101', '000110100001100', '000100000111011'],
};

// ISO/IEC 18004 version information strings for versions 7-40.
const STANDARD_VERSION = [
  '000111110010010100', '001000010110111100', '001001101010011001', '001010010011010011',
  '001011101111110110', '001100011101100010', '001101100001000111', '001110011000001101',
  '001111100100101000', '010000101101111000', '010001010001011101', '010010101000010111',
  '010011010100110010', '010100100110100110', '010101011010000011', '010110100011001001',
  '010111011111101100', '011000111011000100', '011001000111100001', '011010111110101011',
  '011011000010001110', '011100110000011010', '011101001100111111', '011110110101110101',
  '011111001001010000', '100000100111010101', '100001011011110000', '100010100010111010',
  '100011011110011111', '100100101100001011', '100101010000101110', '100110101001100100',
  '100111010101000001', '101000110001101001',
];

const binary = (value, width) => value.toString(2).padStart(width, '0');

function hammingDistance(a, b) {
  let difference = a ^ b;
  let count = 0;
  while (difference) {
    count += difference & 1;
    difference >>>= 1;
  }
  return count;
}

test('DONE: format information for level L with mask 0 is 111011111000100', () => {
  assert.equal(binary(formatBits('L', 0), 15), '111011111000100');
});

test('DONE: all 32 format information words match the standard table', () => {
  for (const [level, words] of Object.entries(STANDARD_FORMAT)) {
    words.forEach((expected, mask) => assert.equal(binary(formatBits(level, mask), 15), expected, `${level}${mask}`));
  }
});

test('DONE: version information for version 7 is 000111110010010100', () => {
  assert.equal(binary(versionBits(7), 18), '000111110010010100');
});

test('version information for versions 7-40 matches the standard table', () => {
  STANDARD_VERSION.forEach((expected, index) => {
    assert.equal(binary(versionBits(index + 7), 18), expected, `version ${index + 7}`);
  });
});

test('format words are pairwise at least 7 bits apart (BCH(15,5) distance)', () => {
  const words = Object.keys(STANDARD_FORMAT).flatMap((level) => [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => formatBits(level, mask)));
  assert.equal(new Set(words).size, 32);
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) assert.ok(hammingDistance(words[i], words[j]) >= 7);
  }
});

test('version words are pairwise at least 8 bits apart (BCH(18,6) distance)', () => {
  const words = STANDARD_VERSION.map((_, index) => versionBits(index + 7));
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) assert.ok(hammingDistance(words[i], words[j]) >= 8);
  }
});
