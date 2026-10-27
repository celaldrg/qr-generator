/**
 * Short status message at the bottom of the page ("SVG downloaded"). It
 * remembers the i18n key of the message, so a language switch translates a
 * visible toast again and empties a faded one instead of leaving text in the
 * old language behind.
 */

/** How long a message stays visible, in milliseconds. */
export const TOAST_MS = 2600;

/**
 * @typedef {object} Toast
 * @property {(key: string, tone?: 'ok'|'error') => void} show shows the message for TOAST_MS
 * @property {() => void} retranslate updates the message after a language switch
 */

/**
 * Wires the toast element.
 * @param {HTMLElement} element live region (role="status") styled by .toast
 * @param {(key: string) => string} translate string for a key in the current language
 * @param {{setTimeout: typeof setTimeout, clearTimeout: typeof clearTimeout}} [timers] timer functions
 * @returns {Toast}
 */
export function createToast(element, translate, timers = globalThis) {
  let visibleKey = null;
  let timer = 0;

  function hide() {
    visibleKey = null;
    element.classList.remove('is-visible');
  }

  return {
    show(key, tone = 'ok') {
      visibleKey = key;
      element.textContent = translate(key);
      element.dataset.tone = tone;
      element.classList.add('is-visible');
      timers.clearTimeout(timer);
      timer = timers.setTimeout(hide, TOAST_MS);
    },
    retranslate() {
      element.textContent = visibleKey === null ? '' : translate(visibleKey);
    },
  };
}
