/**
 * Colour helpers: hex parsing and WCAG contrast, used to warn when the
 * chosen colours are too close for scanners to tell dark from light.
 */

/**
 * Below this foreground/background contrast ratio the UI shows a warning
 * (the WCAG 2.1 minimum for graphical objects).
 */
export const MIN_SCAN_CONTRAST = 3;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Whether a string is a #rgb or #rrggbb colour.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isHexColor(value) {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/**
 * Parses #rgb or #rrggbb.
 * @param {string} hex
 * @returns {{r: number, g: number, b: number}} channels 0..255
 */
export function parseHexColor(hex) {
  if (!isHexColor(hex)) throw new TypeError(`not a hex colour: ${hex}`);
  const digits = hex.length === 4 ? [...hex.slice(1)].map((d) => d + d).join('') : hex.slice(1);
  const channel = (i) => Number.parseInt(digits.slice(i * 2, i * 2 + 2), 16);
  return { r: channel(0), g: channel(1), b: channel(2) };
}

/**
 * Canonical lowercase #rrggbb form (what <input type="color"> expects).
 * @param {string} hex #rgb or #rrggbb
 * @returns {string}
 */
export function normalizeHexColor(hex) {
  const { r, g, b } = parseHexColor(hex);
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function linearChannel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG relative luminance.
 * @param {string} hex
 * @returns {number} 0 (black) .. 1 (white)
 */
export function relativeLuminance(hex) {
  const { r, g, b } = parseHexColor(hex);
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/**
 * WCAG contrast ratio between two colours (order does not matter).
 * @param {string} first
 * @param {string} second
 * @returns {number} 1 .. 21
 */
export function contrastRatio(first, second) {
  const [darker, lighter] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => a - b);
  return (lighter + 0.05) / (darker + 0.05);
}
