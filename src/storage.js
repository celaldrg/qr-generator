/**
 * The only gateway to localStorage. Every access is wrapped in try/catch so
 * private mode, blocked storage or corrupt data never break the app. Keys are
 * namespaced because all github.io project pages share one origin.
 */

const PREFIX = 'qr-generator:';

function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads a JSON value.
 * @param {string} key unprefixed key
 * @param {*} fallback returned when the value is missing, unreadable or invalid JSON
 * @param {Pick<Storage, 'getItem'>|null} [store] storage backend (defaults to localStorage)
 * @returns {*}
 */
export function loadValue(key, fallback, store = browserStorage()) {
  try {
    const raw = store.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Writes a JSON value.
 * @param {string} key unprefixed key
 * @param {*} value JSON-serialisable value
 * @param {Pick<Storage, 'setItem'>|null} [store] storage backend (defaults to localStorage)
 * @returns {boolean} false when the value could not be stored
 */
export function saveValue(key, value, store = browserStorage()) {
  try {
    store.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
