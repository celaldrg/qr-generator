/**
 * Output helpers for an encoded symbol: crisp SVG markup and canvas drawing.
 * Neither touches the DOM at import time; the canvas is passed in.
 */

import { isHexColor } from './color.js';

/**
 * @typedef {object} RenderOptions
 * @property {number} [moduleSize=10] pixels per module (canvas scale, SVG width/height)
 * @property {number} [quietZone=4] light border in modules (the standard asks for 4)
 * @property {string} [foreground='#000000'] dark module colour, #rgb or #rrggbb
 * @property {string} [background='#ffffff'] light module colour, #rgb or #rrggbb
 */

const DEFAULTS = { moduleSize: 10, quietZone: 4, foreground: '#000000', background: '#ffffff' };
const INTEGER_MINIMUMS = { moduleSize: 1, quietZone: 0 };

function resolveOptions(options) {
  const resolved = { ...DEFAULTS, ...options };
  for (const [key, minimum] of Object.entries(INTEGER_MINIMUMS)) {
    if (!Number.isInteger(resolved[key]) || resolved[key] < minimum) {
      throw new RangeError(`${key} must be an integer >= ${minimum}`);
    }
  }
  for (const key of ['foreground', 'background']) {
    if (!isHexColor(resolved[key])) throw new TypeError(`${key} must be a hex colour`);
  }
  return resolved;
}

/**
 * Calls back once per horizontal run of dark modules.
 * @param {boolean[][]} modules
 * @param {(x: number, y: number, length: number) => void} callback
 */
function forEachDarkRun(modules, callback) {
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x++;
      callback(start, y, x - start);
    }
  });
}

/**
 * Width and height of the symbol including the quiet zone, in modules.
 * @param {{size: number}} qr
 * @param {number} quietZone modules
 * @returns {number}
 */
export function outerSize(qr, quietZone) {
  return qr.size + quietZone * 2;
}

/**
 * SVG path data covering every dark module, in module units, offset by the quiet zone.
 * @param {{modules: boolean[][]}} qr
 * @param {number} quietZone modules
 * @returns {string}
 */
export function svgPathData(qr, quietZone) {
  const parts = [];
  forEachDarkRun(qr.modules, (x, y, length) => {
    parts.push(`M${x + quietZone} ${y + quietZone}h${length}v1h-${length}z`);
  });
  return parts.join('');
}

/**
 * Standalone SVG document (for download or copying).
 * @param {{size: number, modules: boolean[][]}} qr
 * @param {RenderOptions} [options]
 * @returns {string}
 */
export function toSvgString(qr, options = {}) {
  const { moduleSize, quietZone, foreground, background } = resolveOptions(options);
  const units = outerSize(qr, quietZone);
  const pixels = units * moduleSize;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" viewBox="0 0 ${units} ${units}" shape-rendering="crispEdges">`,
    `<rect width="${units}" height="${units}" fill="${background}"/>`,
    `<path d="${svgPathData(qr, quietZone)}" fill="${foreground}"/>`,
    '</svg>',
    '',
  ].join('\n');
}

/**
 * Resizes a canvas to the symbol and draws it at moduleSize pixels per module.
 * @param {{width: number, height: number, getContext: (type: '2d') => CanvasRenderingContext2D}} canvas
 * @param {{size: number, modules: boolean[][]}} qr
 * @param {RenderOptions} [options]
 * @returns {number} the canvas side length in pixels
 */
export function renderToCanvas(canvas, qr, options = {}) {
  const { moduleSize, quietZone, foreground, background } = resolveOptions(options);
  const pixels = outerSize(qr, quietZone) * moduleSize;
  canvas.width = pixels;
  canvas.height = pixels;
  const context = canvas.getContext('2d');
  context.fillStyle = background;
  context.fillRect(0, 0, pixels, pixels);
  context.fillStyle = foreground;
  forEachDarkRun(qr.modules, (x, y, length) => {
    context.fillRect((x + quietZone) * moduleSize, (y + quietZone) * moduleSize, length * moduleSize, moduleSize);
  });
  return pixels;
}
