/**
 * Data encoding: mode selection, the segment bit stream and the padded
 * data codeword sequence for a given version and error-correction level.
 */

import { charCountBits, ecBlockInfo } from './tables.js';

/** The 45 characters of alphanumeric mode, in value order. */
const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const MODE_INDICATOR = { numeric: 0b0001, alphanumeric: 0b0010, byte: 0b0100 };
const PAD_CODEWORDS = [0xec, 0x11];
const NUMERIC_PATTERN = /^[0-9]*$/;
const ALPHANUMERIC_PATTERN = /^[0-9A-Z $%*+\-./:]*$/;

/**
 * @typedef {'numeric'|'alphanumeric'|'byte'} Mode
 * @typedef {{mode: Mode, length: number, bits: number[]}} Segment
 *   length counts characters (numeric, alphanumeric) or UTF-8 bytes (byte);
 *   bits is the data part only, without mode indicator and character count.
 */

/**
 * Appends the lowest `count` bits of `value`, most significant first.
 * @param {number[]} bits destination
 * @param {number} value unsigned integer
 * @param {number} count number of bits
 */
function appendBits(bits, value, count) {
  for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

/**
 * Most compact single mode that can represent the whole text.
 * @param {string} text
 * @returns {Mode}
 */
export function detectMode(text) {
  if (NUMERIC_PATTERN.test(text)) return 'numeric';
  if (ALPHANUMERIC_PATTERN.test(text)) return 'alphanumeric';
  return 'byte';
}

function numericBits(text) {
  const bits = [];
  for (let i = 0; i < text.length; i += 3) {
    const group = text.slice(i, i + 3);
    appendBits(bits, Number(group), group.length * 3 + 1);
  }
  return bits;
}

function alphanumericBits(text) {
  const bits = [];
  for (let i = 0; i + 1 < text.length; i += 2) {
    const pair = ALPHANUMERIC_CHARSET.indexOf(text[i]) * 45 + ALPHANUMERIC_CHARSET.indexOf(text[i + 1]);
    appendBits(bits, pair, 11);
  }
  if (text.length % 2 === 1) appendBits(bits, ALPHANUMERIC_CHARSET.indexOf(text.at(-1)), 6);
  return bits;
}

function byteBits(bytes) {
  const bits = [];
  for (const byte of bytes) appendBits(bits, byte, 8);
  return bits;
}

/**
 * Encodes text as one segment in the automatically chosen mode
 * (byte mode uses UTF-8).
 * @param {string} text
 * @returns {Segment}
 */
export function encodeSegment(text) {
  const mode = detectMode(text);
  if (mode === 'numeric') return { mode, length: text.length, bits: numericBits(text) };
  if (mode === 'alphanumeric') return { mode, length: text.length, bits: alphanumericBits(text) };
  const bytes = new TextEncoder().encode(text);
  return { mode, length: bytes.length, bits: byteBits(bytes) };
}

/**
 * Total bits of a segment in a given version: mode indicator, character
 * count indicator and data.
 * @param {Segment} segment
 * @param {number} version 1..40
 * @returns {number}
 */
export function segmentBitLength(segment, version) {
  return 4 + charCountBits(segment.mode, version) + segment.bits.length;
}

/**
 * Maximum number of characters (numeric, alphanumeric) or bytes (byte)
 * that fit in a symbol.
 * @param {number} version 1..40
 * @param {string} ecLevel 'L' | 'M' | 'Q' | 'H'
 * @param {Mode} mode
 * @returns {number}
 */
export function capacity(version, ecLevel, mode) {
  const bits = ecBlockInfo(version, ecLevel).dataCodewords * 8 - 4 - charCountBits(mode, version);
  if (mode === 'numeric') {
    const rest = bits % 10;
    return Math.floor(bits / 10) * 3 + (rest >= 7 ? 2 : rest >= 4 ? 1 : 0);
  }
  if (mode === 'alphanumeric') return Math.floor(bits / 11) * 2 + (bits % 11 >= 6 ? 1 : 0);
  return Math.floor(bits / 8);
}

/**
 * Data codewords for a segment: header, data, terminator, zero bits up to a
 * byte boundary, then alternating pad codewords 236 and 17.
 * @param {Segment} segment
 * @param {number} version 1..40
 * @param {string} ecLevel 'L' | 'M' | 'Q' | 'H'
 * @returns {Uint8Array} exactly dataCodewords codewords
 */
export function buildDataCodewords(segment, version, ecLevel) {
  const capacityBits = ecBlockInfo(version, ecLevel).dataCodewords * 8;
  if (segmentBitLength(segment, version) > capacityBits) {
    throw new RangeError(`segment does not fit in version ${version}-${ecLevel}`);
  }
  const bits = [];
  appendBits(bits, MODE_INDICATOR[segment.mode], 4);
  appendBits(bits, segment.length, charCountBits(segment.mode, version));
  for (const bit of segment.bits) bits.push(bit);
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let i = 0; bits.length < capacityBits; i++) appendBits(bits, PAD_CODEWORDS[i % 2], 8);

  const codewords = new Uint8Array(capacityBits / 8);
  bits.forEach((bit, i) => {
    codewords[i >>> 3] |= bit << (7 - (i & 7));
  });
  return codewords;
}
