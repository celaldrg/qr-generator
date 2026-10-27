/**
 * Format and version information words, protected by BCH codes.
 */

/** Two-bit error-correction level indicators used in the format information. */
const EC_LEVEL_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

const FORMAT_GENERATOR = 0b10100110111; // BCH(15,5): x^10 + x^8 + x^5 + x^4 + x^2 + x + 1
const FORMAT_XOR_MASK = 0b101010000010010;
const VERSION_GENERATOR = 0b1111100100101; // BCH(18,6): x^12 + x^11 + x^10 + x^9 + x^8 + x^5 + x^2 + 1

/**
 * Remainder of value * x^degree divided by a generator polynomial over GF(2).
 * @param {number} value message bits
 * @param {number} generator generator polynomial bits (degree = bit length - 1)
 * @param {number} degree degree of the generator
 * @returns {number} remainder bits
 */
function bchRemainder(value, generator, degree) {
  let remainder = value;
  for (let i = 0; i < degree; i++) {
    remainder = (remainder << 1) ^ ((remainder >>> (degree - 1)) * generator);
  }
  return remainder;
}

/**
 * 15-bit format information: EC level and mask pattern, BCH(15,5) encoded
 * and XORed with 101010000010010 so it is never all light.
 * @param {string} ecLevel 'L' | 'M' | 'Q' | 'H'
 * @param {number} mask 0..7
 * @returns {number} format word, bit 14 first in reading order
 */
export function formatBits(ecLevel, mask) {
  const data = (EC_LEVEL_BITS[ecLevel] << 3) | mask;
  return ((data << 10) | bchRemainder(data, FORMAT_GENERATOR, 10)) ^ FORMAT_XOR_MASK;
}

/**
 * 18-bit version information for versions 7..40: the version number
 * followed by its BCH(18,6) remainder.
 * @param {number} version 7..40
 * @returns {number} version word
 */
export function versionBits(version) {
  return (version << 12) | bchRemainder(version, VERSION_GENERATOR, 12);
}
