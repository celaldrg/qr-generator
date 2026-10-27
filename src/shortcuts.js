/**
 * Keyboard control: the desktop shortcuts (used while no text field has
 * focus) and arrow-key movement in the type tabs. Pure: no DOM.
 */

import { PAYLOAD_TYPES } from './payload.js';
import { EC_LEVELS } from './tables.js';

const COMMANDS = Object.freeze({ o: 'toggleOptions', p: 'downloadPng', s: 'downloadSvg', c: 'copySvg' });
const ROVING_STEPS = Object.freeze({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 });

/**
 * @typedef {{name: 'type', type: string}
 *   | {name: 'ecLevel', level: string}
 *   | {name: 'toggleOptions'|'downloadPng'|'downloadSvg'|'copySvg'}} ShortcutAction
 */

/**
 * The action bound to a key press: 1-6 pick the content type, L/M/Q/H the
 * error-correction level, O toggles the options, P and S download PNG and
 * SVG, C copies the SVG. Presses with Ctrl, Alt or Meta are left to the browser.
 * @param {{key: string, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean}} press
 * @returns {ShortcutAction|null}
 */
export function shortcutAction({ key, ctrlKey = false, altKey = false, metaKey = false }) {
  if (ctrlKey || altKey || metaKey || typeof key !== 'string' || key.length !== 1) return null;
  const typeIndex = '123456789'.indexOf(key);
  if (typeIndex !== -1) return typeIndex < PAYLOAD_TYPES.length ? { name: 'type', type: PAYLOAD_TYPES[typeIndex] } : null;
  const level = key.toUpperCase();
  if (EC_LEVELS.includes(level)) return { name: 'ecLevel', level };
  const command = key.toLowerCase();
  return Object.hasOwn(COMMANDS, command) ? { name: COMMANDS[command] } : null;
}

/**
 * Arrow-key navigation in a tab list: the new index (wrapping around, Home
 * and End jump to the ends), or null when the key does not move.
 * @param {string} key KeyboardEvent.key
 * @param {number} index current index
 * @param {number} count number of tabs
 * @returns {number|null}
 */
export function rovingIndex(key, index, count) {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  if (!Object.hasOwn(ROVING_STEPS, key)) return null;
  return (index + ROVING_STEPS[key] + count) % count;
}
