/**
 * Symbol construction: function patterns, zigzag codeword placement,
 * data masking and mask selection by penalty score.
 *
 * Matrices are arrays of rows: modules[y][x], true = dark.
 */

import { formatBits, versionBits } from './format.js';
import { alignmentPositions, symbolSize } from './tables.js';

/** The eight mask conditions; a data module is inverted where the condition holds. */
export const MASK_PATTERNS = Object.freeze([
  (x, y) => (y + x) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (y + x) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((y * x) % 2) + ((y * x) % 3) === 0,
  (x, y) => (((y * x) % 2) + ((y * x) % 3)) % 2 === 0,
  (x, y) => (((y + x) % 2) + ((y * x) % 3)) % 2 === 0,
]);

const PENALTY_RUN = 3;
const PENALTY_BLOCK = 3;
const PENALTY_FINDER_LIKE = 40;
const PENALTY_BALANCE = 10;
const FINDER_LIKE = [true, false, true, true, true, false, true];

function emptyMatrix(size) {
  return Array.from({ length: size }, () => new Array(size).fill(false));
}

function createGrid(version) {
  const size = symbolSize(version);
  return { version, size, modules: emptyMatrix(size), reserved: emptyMatrix(size) };
}

function setFunctionModule(grid, x, y, dark) {
  grid.modules[y][x] = dark;
  grid.reserved[y][x] = true;
}

function drawTimingPatterns(grid) {
  for (let i = 0; i < grid.size; i++) {
    setFunctionModule(grid, 6, i, i % 2 === 0);
    setFunctionModule(grid, i, 6, i % 2 === 0);
  }
}

/** 7x7 finder pattern plus its one-module light separator (clipped at the edges). */
function drawFinderPattern(grid, centerX, centerY) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= grid.size || y >= grid.size) continue;
      const ring = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(grid, x, y, ring !== 2 && ring !== 4);
    }
  }
}

function drawAlignmentPattern(grid, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunctionModule(grid, centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawAlignmentPatterns(grid) {
  const positions = alignmentPositions(grid.version);
  const last = positions.length - 1;
  positions.forEach((y, row) => {
    positions.forEach((x, column) => {
      const overlapsFinder = (row === 0 && (column === 0 || column === last)) || (row === last && column === 0);
      if (!overlapsFinder) drawAlignmentPattern(grid, x, y);
    });
  });
}

/** Both copies of the 15-bit format information (bit 0 = least significant). */
function drawFormatBits(grid, ecLevel, mask) {
  const bits = formatBits(ecLevel, mask);
  const bit = (i) => ((bits >>> i) & 1) === 1;
  const { size } = grid;
  for (let i = 0; i <= 5; i++) setFunctionModule(grid, 8, i, bit(i));
  setFunctionModule(grid, 8, 7, bit(6));
  setFunctionModule(grid, 8, 8, bit(7));
  setFunctionModule(grid, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setFunctionModule(grid, 14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) setFunctionModule(grid, size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setFunctionModule(grid, 8, size - 15 + i, bit(i));
}

/** Both 6x3 version information blocks (versions 7 and up). */
function drawVersionBits(grid) {
  if (grid.version < 7) return;
  const bits = versionBits(grid.version);
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) === 1;
    const near = Math.floor(i / 3);
    const far = grid.size - 11 + (i % 3);
    setFunctionModule(grid, far, near, dark);
    setFunctionModule(grid, near, far, dark);
  }
}

function drawFunctionPatterns(grid, ecLevel) {
  const { size } = grid;
  drawTimingPatterns(grid);
  drawFinderPattern(grid, 3, 3);
  drawFinderPattern(grid, size - 4, 3);
  drawFinderPattern(grid, 3, size - 4);
  drawAlignmentPatterns(grid);
  drawVersionBits(grid);
  drawFormatBits(grid, ecLevel, 0); // reserves the format areas; redrawn once the mask is known
  setFunctionModule(grid, 8, size - 8, true); // the dark module
}

/**
 * Places codeword bits in two-module-wide columns, right to left, moving
 * alternately up and down and skipping the vertical timing pattern.
 * Remainder bits stay light.
 */
function placeCodewords(grid, codewords) {
  const { size, modules, reserved } = grid;
  const totalBits = codewords.length * 8;
  let bitIndex = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let step = 0; step < size; step++) {
      const y = upward ? size - 1 - step : step;
      for (let x = right; x >= right - 1; x--) {
        if (reserved[y][x] || bitIndex >= totalBits) continue;
        modules[y][x] = ((codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) === 1;
        bitIndex++;
      }
    }
  }
}

/** XORs a mask over all non-function modules; applying it twice restores the grid. */
function applyMask(grid, mask) {
  const condition = MASK_PATTERNS[mask];
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.reserved[y][x] && condition(x, y)) grid.modules[y][x] = !grid.modules[y][x];
    }
  }
}

function transpose(modules) {
  return modules[0].map((_, x) => modules.map((row) => row[x]));
}

function rowsAndColumns(modules) {
  return [...modules, ...transpose(modules)];
}

function runPenalty(line) {
  let penalty = 0;
  let runLength = 1;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) {
      runLength++;
      continue;
    }
    if (runLength >= 5) penalty += PENALTY_RUN + (runLength - 5);
    runLength = 1;
  }
  return penalty;
}

/** Positions outside the symbol count as light (they are quiet zone). */
function isLightRange(line, from, to) {
  for (let i = Math.max(from, 0); i < Math.min(to, line.length); i++) {
    if (line[i]) return false;
  }
  return true;
}

function finderLikeCount(line) {
  let count = 0;
  for (let start = 0; start + FINDER_LIKE.length <= line.length; start++) {
    if (!FINDER_LIKE.every((dark, k) => line[start + k] === dark)) continue;
    if (isLightRange(line, start - 4, start) || isLightRange(line, start + 7, start + 11)) count++;
  }
  return count;
}

/**
 * Rule 1: each run of five or more same-coloured modules in a row or
 * column scores 3 + (run length - 5).
 * @param {boolean[][]} modules
 * @returns {number}
 */
export function penaltyRuns(modules) {
  return rowsAndColumns(modules).reduce((sum, line) => sum + runPenalty(line), 0);
}

/**
 * Rule 2: each 2x2 block of one colour scores 3 (blocks may overlap).
 * @param {boolean[][]} modules
 * @returns {number}
 */
export function penaltyBlocks(modules) {
  let penalty = 0;
  for (let y = 0; y + 1 < modules.length; y++) {
    for (let x = 0; x + 1 < modules[y].length; x++) {
      const color = modules[y][x];
      if (modules[y][x + 1] === color && modules[y + 1][x] === color && modules[y + 1][x + 1] === color) {
        penalty += PENALTY_BLOCK;
      }
    }
  }
  return penalty;
}

/**
 * Rule 3: each dark-light-dark-dark-dark-light-dark (1:1:3:1:1) pattern in
 * a row or column with four light modules on either side scores 40.
 * @param {boolean[][]} modules
 * @returns {number}
 */
export function penaltyFinderLike(modules) {
  return rowsAndColumns(modules).reduce((sum, line) => sum + finderLikeCount(line), 0) * PENALTY_FINDER_LIKE;
}

/**
 * Rule 4: 10 points for every full 5 % the dark-module ratio deviates from 50 %.
 * @param {boolean[][]} modules
 * @returns {number}
 */
export function penaltyBalance(modules) {
  const total = modules.length * modules[0].length;
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  return Math.floor(Math.abs(dark * 20 - total * 10) / total) * PENALTY_BALANCE;
}

/**
 * Total penalty of a finished symbol (rules 1-4); lower is better.
 * @param {boolean[][]} modules
 * @returns {number}
 */
export function penaltyScore(modules) {
  return penaltyRuns(modules) + penaltyBlocks(modules) + penaltyFinderLike(modules) + penaltyBalance(modules);
}

function chooseMask(grid, ecLevel) {
  let bestMask = 0;
  let bestPenalty = Infinity;
  MASK_PATTERNS.forEach((_, mask) => {
    applyMask(grid, mask);
    drawFormatBits(grid, ecLevel, mask);
    const penalty = penaltyScore(grid.modules);
    if (penalty < bestPenalty) {
      bestMask = mask;
      bestPenalty = penalty;
    }
    applyMask(grid, mask);
  });
  return bestMask;
}

/**
 * Builds the module matrix for already interleaved codewords.
 * @param {number} version 1..40
 * @param {string} ecLevel 'L' | 'M' | 'Q' | 'H'
 * @param {Uint8Array} codewords data and error-correction codewords in final order
 * @param {number} [forcedMask] 0..7; omitted = lowest-penalty mask
 * @returns {{modules: boolean[][], mask: number}}
 */
export function buildMatrix(version, ecLevel, codewords, forcedMask) {
  const grid = createGrid(version);
  drawFunctionPatterns(grid, ecLevel);
  placeCodewords(grid, codewords);
  const mask = forcedMask ?? chooseMask(grid, ecLevel);
  applyMask(grid, mask);
  drawFormatBits(grid, ecLevel, mask);
  return { modules: grid.modules, mask };
}
