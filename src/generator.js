/**
 * App state for the generator UI: the active payload type, the form values
 * of every type, the rendering options and everything derived from them
 * (payload text, encoded symbol, error, contrast warning).
 * Pure logic: no DOM, no storage.
 */

import { MIN_SCAN_CONTRAST, contrastRatio, isHexColor, normalizeHexColor } from './color.js';
import { PAYLOAD_FIELDS, PAYLOAD_TYPES, buildPayload, defaultFieldValue, hasPayloadContent } from './payload.js';
import { QrCapacityError, encodeQr } from './qr.js';
import { EC_LEVELS } from './tables.js';

/**
 * @typedef {object} Options
 * @property {'L'|'M'|'Q'|'H'} ecLevel error-correction level
 * @property {number} moduleSize pixels per module for PNG/SVG export
 * @property {number} quietZone light border in modules
 * @property {string} foreground #rrggbb
 * @property {string} background #rrggbb
 */

/**
 * @typedef {object} GeneratorConfig
 * @property {string} [type] active payload type (default 'text')
 * @property {Record<string, Record<string, string|boolean>>} [values] form values per type
 * @property {Partial<Options>} [options]
 * @property {boolean} [showOptions] whether the options panel is open
 */

/**
 * @typedef {object} GeneratorState
 * @property {string} type active payload type
 * @property {Record<string, Record<string, string|boolean>>} values form values of every type
 * @property {Options} options
 * @property {boolean} showOptions
 * @property {string} payload text encoded for the active type
 * @property {import('./qr.js').QrCode|null} qr null while there is an error
 * @property {null|{code: 'empty'}|{code: 'too-long', length: number, maxLength: number}} error
 * @property {number} contrast foreground/background contrast ratio (1..21)
 * @property {boolean} lowContrast true when contrast < MIN_SCAN_CONTRAST
 */

/** @type {Readonly<Options>} */
export const DEFAULT_OPTIONS = Object.freeze({
  ecLevel: 'M',
  moduleSize: 10,
  quietZone: 4,
  foreground: '#000000',
  background: '#ffffff',
});

/** Allowed ranges of the numeric options (for range inputs). */
export const OPTION_RANGES = Object.freeze({
  moduleSize: Object.freeze({ min: 2, max: 40 }),
  quietZone: Object.freeze({ min: 0, max: 10 }),
});

function defaultValues() {
  return Object.fromEntries(PAYLOAD_TYPES.map((type) => [
    type,
    Object.fromEntries(PAYLOAD_FIELDS[type].map((field) => [field.name, defaultFieldValue(field)])),
  ]));
}

/** Returns value when it suits the field, otherwise fallback. */
function acceptFieldValue(field, value, fallback) {
  if (field.input === 'checkbox') return typeof value === 'boolean' ? value : fallback;
  if (field.options) return field.options.includes(value) ? value : fallback;
  return typeof value === 'string' ? value : fallback;
}

function sanitizeValues(input) {
  const values = defaultValues();
  for (const type of PAYLOAD_TYPES) {
    for (const field of PAYLOAD_FIELDS[type]) {
      const value = input?.[type]?.[field.name];
      values[type][field.name] = acceptFieldValue(field, value, values[type][field.name]);
    }
  }
  return values;
}

/** A number, or a non-blank numeric string as typed in an input; anything else is NaN. */
function toNumber(value) {
  if (typeof value === 'number') return value;
  return typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
}

/** Validates one option; invalid input keeps the fallback, numbers are rounded and clamped. */
function acceptOption(name, value, fallback) {
  if (name === 'ecLevel') return EC_LEVELS.includes(value) ? value : fallback;
  if (name === 'foreground' || name === 'background') return isHexColor(value) ? normalizeHexColor(value) : fallback;
  const number = toNumber(value);
  if (!Number.isFinite(number)) return fallback;
  const { min, max } = OPTION_RANGES[name];
  return Math.min(max, Math.max(min, Math.round(number)));
}

function sanitizeOptions(input) {
  return Object.fromEntries(Object.entries(DEFAULT_OPTIONS).map(([name, fallback]) => [
    name,
    acceptOption(name, input?.[name], fallback),
  ]));
}

function tryEncode(payload, ecLevel) {
  try {
    return { qr: encodeQr(payload, { ecLevel }), error: null };
  } catch (error) {
    if (!(error instanceof QrCapacityError)) throw error;
    return { qr: null, error: { code: 'too-long', length: error.length, maxLength: error.maxLength } };
  }
}

/**
 * Creates the generator state machine. Every mutator returns the new
 * immutable state snapshot (also available through getState()).
 * @param {GeneratorConfig} [config] initial state; invalid parts fall back to defaults
 * @returns {{
 *   getState: () => GeneratorState,
 *   setType: (type: string) => GeneratorState,
 *   setField: (name: string, value: string|boolean) => GeneratorState,
 *   setOption: (name: keyof Options, value: string|number) => GeneratorState,
 *   toggleOptions: () => GeneratorState,
 *   reset: () => GeneratorState,
 * }}
 */
export function createGenerator(config) {
  let lastEncoding = { key: null, qr: null, error: null };

  function encodeOnce(payload, ecLevel) {
    const key = `${ecLevel}:${payload}`;
    if (lastEncoding.key !== key) lastEncoding = { key, ...tryEncode(payload, ecLevel) };
    return lastEncoding;
  }

  function derive({ type, values, options, showOptions }) {
    const payload = buildPayload(type, values[type]);
    const contrast = contrastRatio(options.foreground, options.background);
    const encoded = hasPayloadContent(type, values[type])
      ? encodeOnce(payload, options.ecLevel)
      : { qr: null, error: { code: 'empty' } };
    return Object.freeze({
      type,
      values,
      options,
      showOptions,
      payload,
      qr: encoded.qr,
      error: encoded.error,
      contrast,
      lowContrast: contrast < MIN_SCAN_CONTRAST,
    });
  }

  let state = derive({
    type: PAYLOAD_TYPES.includes(config?.type) ? config.type : PAYLOAD_TYPES[0],
    values: sanitizeValues(config?.values),
    options: sanitizeOptions(config?.options),
    showOptions: config?.showOptions === true,
  });

  function update(changes) {
    state = derive({ ...state, ...changes });
    return state;
  }

  return {
    getState: () => state,

    setType(type) {
      if (!PAYLOAD_TYPES.includes(type)) throw new RangeError(`unknown payload type: ${type}`);
      return update({ type });
    },

    setField(name, value) {
      const field = PAYLOAD_FIELDS[state.type].find((candidate) => candidate.name === name);
      if (!field) throw new RangeError(`unknown field "${name}" for type ${state.type}`);
      const current = state.values[state.type];
      const typeValues = { ...current, [name]: acceptFieldValue(field, value, current[name]) };
      return update({ values: { ...state.values, [state.type]: typeValues } });
    },

    setOption(name, value) {
      if (!Object.hasOwn(DEFAULT_OPTIONS, name)) throw new RangeError(`unknown option: ${name}`);
      return update({ options: { ...state.options, [name]: acceptOption(name, value, state.options[name]) } });
    },

    toggleOptions: () => update({ showOptions: !state.showOptions }),

    reset: () => update({ values: defaultValues(), options: { ...DEFAULT_OPTIONS } }),
  };
}

/**
 * Deterministic configuration for the ?demo screenshot: a Wi-Fi code for a
 * sample network with the options panel open.
 * @returns {GeneratorConfig}
 */
export function demoConfig() {
  return {
    type: 'wifi',
    values: { wifi: { ssid: 'Corner Cafe Guest', password: 'latte-art-2026', security: 'WPA', hidden: false } },
    options: { ecLevel: 'Q', moduleSize: 12, quietZone: 4, foreground: '#14532d', background: '#f0fdf4' },
    showOptions: true,
  };
}
