/**
 * QR Code encoder (ISO/IEC 18004) written from scratch: picks the mode and
 * the smallest version, adds Reed-Solomon error correction, interleaves the
 * blocks and builds the masked module matrix.
 */

import { rsRemainder } from './gf256.js';
import { MASK_PATTERNS, buildMatrix } from './matrix.js';
import { buildDataCodewords, capacity, encodeSegment, segmentBitLength } from './segment.js';
import { EC_LEVELS, MAX_VERSION, MIN_VERSION, ecBlockInfo } from './tables.js';

/**
 * @typedef {object} QrCode
 * @property {number} version 1..40
 * @property {'L'|'M'|'Q'|'H'} ecLevel error-correction level
 * @property {'numeric'|'alphanumeric'|'byte'} mode
 * @property {number} mask mask pattern 0..7
 * @property {number} size modules per side (4 * version + 17)
 * @property {boolean[][]} modules modules[y][x], true = dark
 * @property {number} length characters (numeric, alphanumeric) or UTF-8 bytes (byte) encoded
 * @property {number} capacity maximum length for this version, level and mode
 */

/** Thrown when the data does not fit even in version 40 at the chosen level. */
export class QrCapacityError extends RangeError {
  /**
   * @param {{mode: string, length: number}} segment
   * @param {string} ecLevel
   */
  constructor(segment, ecLevel) {
    const maxLength = capacity(MAX_VERSION, ecLevel, segment.mode);
    super(`Data too long: ${segment.length} > ${maxLength} (${segment.mode} mode, level ${ecLevel})`);
    this.name = 'QrCapacityError';
    this.length = segment.length;
    this.maxLength = maxLength;
    this.mode = segment.mode;
  }
}

/**
 * Smallest version whose data capacity holds the segment.
 * @param {import('./segment.js').Segment} segment
 * @param {string} ecLevel 'L' | 'M' | 'Q' | 'H'
 * @returns {number} version 1..40
 * @throws {QrCapacityError} when nothing fits
 */
export function selectVersion(segment, ecLevel) {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
    if (segmentBitLength(segment, version) <= ecBlockInfo(version, ecLevel).dataCodewords * 8) return version;
  }
  throw new QrCapacityError(segment, ecLevel);
}

/**
 * Splits data codewords into blocks, appends Reed-Solomon codewords to each
 * and interleaves them: data column by column (the longer blocks' extra
 * codeword last), then error-correction codewords column by column.
 * @param {Uint8Array} data all data codewords
 * @param {number} version 1..40
 * @param {string} ecLevel 'L' | 'M' | 'Q' | 'H'
 * @returns {Uint8Array} final codeword sequence
 */
export function interleaveCodewords(data, version, ecLevel) {
  const { numBlocks, eccPerBlock, totalCodewords } = ecBlockInfo(version, ecLevel);
  const shortDataLength = Math.floor(totalCodewords / numBlocks) - eccPerBlock;
  const firstLongBlock = numBlocks - (totalCodewords % numBlocks);
  const blocks = [];
  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const length = shortDataLength + (b >= firstLongBlock ? 1 : 0);
    const blockData = data.subarray(offset, offset + length);
    blocks.push({ data: blockData, ecc: rsRemainder(blockData, eccPerBlock) });
    offset += length;
  }
  const result = [];
  for (let i = 0; i <= shortDataLength; i++) {
    for (const block of blocks) if (i < block.data.length) result.push(block.data[i]);
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (const block of blocks) result.push(block.ecc[i]);
  }
  return Uint8Array.from(result);
}

function validateOptions(text, ecLevel, mask) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (!EC_LEVELS.includes(ecLevel)) throw new RangeError(`unknown error-correction level: ${ecLevel}`);
  if (mask != null && !(Number.isInteger(mask) && mask >= 0 && mask < MASK_PATTERNS.length)) {
    throw new RangeError(`mask must be an integer 0-7, got ${mask}`);
  }
}

/**
 * Encodes text as a QR Code symbol.
 * @param {string} text content to encode
 * @param {{ecLevel?: 'L'|'M'|'Q'|'H', mask?: number}} [options]
 *   ecLevel defaults to 'M'; mask 0..7 forces a pattern, otherwise the
 *   lowest-penalty mask is chosen
 * @returns {QrCode}
 * @throws {QrCapacityError} when the text is too long for version 40
 */
export function encodeQr(text, { ecLevel = 'M', mask } = {}) {
  validateOptions(text, ecLevel, mask);
  const segment = encodeSegment(text);
  const version = selectVersion(segment, ecLevel);
  const codewords = interleaveCodewords(buildDataCodewords(segment, version, ecLevel), version, ecLevel);
  const matrix = buildMatrix(version, ecLevel, codewords, mask);
  return {
    version,
    ecLevel,
    mode: segment.mode,
    mask: matrix.mask,
    size: matrix.modules.length,
    modules: matrix.modules,
    length: segment.length,
    capacity: capacity(version, ecLevel, segment.mode),
  };
}
