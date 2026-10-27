/**
 * PNG and SVG downloads and copying the SVG to the clipboard. Files are
 * made in the browser and saved through object URLs; nothing is uploaded.
 */

import { renderToCanvas, toSvgString } from './render.js';
import { pngModuleSize } from './stats.js';

/** Object URLs stay valid this long so slow browsers can start the download. */
const URL_LIFETIME_MS = 10_000;

function fileName(state, extension) {
  return `qr-${state.type}.${extension}`;
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), URL_LIFETIME_MS);
}

function svgDocument(state) {
  return toSvgString(state.qr, state.options);
}

/**
 * Downloads the symbol as an SVG file.
 * @param {import('./generator.js').GeneratorState} state with a symbol
 */
export function downloadSvg(state) {
  saveBlob(new Blob([svgDocument(state)], { type: 'image/svg+xml' }), fileName(state, 'svg'));
}

/**
 * Draws the symbol on an off-screen canvas and downloads it as a PNG file.
 * @param {import('./generator.js').GeneratorState} state with a symbol
 * @returns {Promise<boolean>} false when the browser could not encode the image
 */
export function downloadPng(state) {
  const canvas = document.createElement('canvas');
  renderToCanvas(canvas, state.qr, { ...state.options, moduleSize: pngModuleSize(state.qr, state.options) });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) saveBlob(blob, fileName(state, 'png'));
      resolve(blob !== null);
    }, 'image/png');
  });
}

/**
 * Copies the SVG markup to the clipboard.
 * @param {import('./generator.js').GeneratorState} state with a symbol
 * @returns {Promise<boolean>} false when the clipboard is unavailable or access was denied
 */
export async function copySvg(state) {
  try {
    await navigator.clipboard.writeText(svgDocument(state));
    return true;
  } catch {
    return false;
  }
}
