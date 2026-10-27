/**
 * Numbers the UI shows next to the preview: capacity use, export sizes and
 * the on-screen preview size. Pure: no DOM.
 */

import { outerSize } from './render.js';

/** Largest PNG side in pixels; bigger canvases fail on some phones. */
export const MAX_PNG_SIZE = 4096;

/**
 * Unit of a symbol's length: UTF-8 bytes in byte mode, characters otherwise.
 * @param {'numeric'|'alphanumeric'|'byte'} mode
 * @returns {'bytes'|'characters'}
 */
export function lengthUnit(mode) {
  return mode === 'byte' ? 'bytes' : 'characters';
}

/**
 * How much of the chosen version's capacity the data uses.
 * @param {{length: number, capacity: number}} qr
 * @returns {{used: number, total: number, percent: number}} percent is rounded, 0..100
 */
export function capacityUsage(qr) {
  const percent = qr.capacity > 0 ? Math.round((qr.length / qr.capacity) * 100) : 100;
  return { used: qr.length, total: qr.capacity, percent: Math.min(100, percent) };
}

/**
 * Pixels per module of the PNG export: the chosen module size, reduced so
 * the image stays within MAX_PNG_SIZE (but never below 1).
 * @param {{size: number}} qr
 * @param {{moduleSize: number, quietZone: number}} options
 * @returns {number}
 */
export function pngModuleSize(qr, { moduleSize, quietZone }) {
  return Math.max(1, Math.min(moduleSize, Math.floor(MAX_PNG_SIZE / outerSize(qr, quietZone))));
}

/**
 * Side length of the PNG export in pixels.
 * @param {{size: number}} qr
 * @param {{moduleSize: number, quietZone: number}} options
 * @returns {number}
 */
export function pngSize(qr, options) {
  return outerSize(qr, options.quietZone) * pngModuleSize(qr, options);
}

/**
 * On-screen side length (CSS px) of a symbol `units` modules wide in a box
 * `available` CSS px wide. When at least two device pixels per module fit,
 * every module gets the same whole number of device pixels; otherwise the
 * symbol fills the box.
 * @param {number} available box size in CSS px
 * @param {number} units modules per side, quiet zone included
 * @param {number} [pixelRatio=1] device pixels per CSS px
 * @returns {number} CSS px
 */
export function fitPixelSize(available, units, pixelRatio = 1) {
  const perModule = Math.floor((available * pixelRatio) / units);
  return perModule >= 2 ? (perModule * units) / pixelRatio : available;
}
