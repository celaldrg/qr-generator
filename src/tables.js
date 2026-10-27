/**
 * Constants from the QR Code standard (ISO/IEC 18004): error-correction
 * block structure, symbol geometry and character count indicator lengths.
 */

/** Error-correction levels from lowest (~7 % recovery) to highest (~30 %). */
export const EC_LEVELS = Object.freeze(['L', 'M', 'Q', 'H']);

/** Approximate share of damaged codewords each level can restore, in percent. */
export const EC_RECOVERY_PERCENT = Object.freeze({ L: 7, M: 15, Q: 25, H: 30 });

export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

// Error-correction codewords per block, indexed by version - 1.
const ECC_CODEWORDS_PER_BLOCK = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
    28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
    26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30,
    28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28,
    30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

// Number of error-correction blocks, indexed by version - 1.
const NUM_EC_BLOCKS = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8,
    8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
    17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20,
    23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25,
    25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

// Character count indicator length for versions 1-9, 10-26 and 27-40.
const CHAR_COUNT_BITS = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16],
};

/**
 * Side length of a symbol in modules.
 * @param {number} version 1..40
 * @returns {number} 4 * version + 17
 */
export function symbolSize(version) {
  return version * 4 + 17;
}

/**
 * Number of modules left for codewords after all function patterns
 * (finders, separators, timing, alignment, format and version information)
 * are placed. Includes the 0-7 remainder bits.
 * @param {number} version 1..40
 * @returns {number} module count
 */
export function rawDataModules(version) {
  let modules = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignmentCount = Math.floor(version / 7) + 2;
    modules -= (25 * alignmentCount - 10) * alignmentCount - 55;
    if (version >= 7) modules -= 36;
  }
  return modules;
}

/**
 * Block structure for a version and error-correction level. Blocks that
 * carry one extra data codeword ("group 2") come after the short ones.
 * @param {number} version 1..40
 * @param {string} ecLevel 'L' | 'M' | 'Q' | 'H'
 * @returns {{numBlocks: number, eccPerBlock: number, totalCodewords: number, dataCodewords: number}}
 */
export function ecBlockInfo(version, ecLevel) {
  const numBlocks = NUM_EC_BLOCKS[ecLevel][version - 1];
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[ecLevel][version - 1];
  const totalCodewords = Math.floor(rawDataModules(version) / 8);
  return { numBlocks, eccPerBlock, totalCodewords, dataCodewords: totalCodewords - numBlocks * eccPerBlock };
}

/**
 * Row/column coordinates of alignment pattern centres (Annex E): the first
 * is always 6, the last is size - 7 and the ones between are evenly spaced
 * by an even step.
 * @param {number} version 1..40
 * @returns {number[]} ascending coordinates (empty for version 1)
 */
export function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const last = symbolSize(version) - 7;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const positions = [6];
  for (let i = count - 2; i >= 0; i--) positions.push(last - i * step);
  return positions;
}

/**
 * Length of the character count indicator.
 * @param {'numeric'|'alphanumeric'|'byte'} mode
 * @param {number} version 1..40
 * @returns {number} bit count
 */
export function charCountBits(mode, version) {
  const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return CHAR_COUNT_BITS[mode][band];
}
