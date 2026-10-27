/**
 * Applies the i18n strings to the page: text of [data-i18n] elements and
 * the title, aria-label and placeholder attributes bound with
 * data-i18n-title, data-i18n-aria-label and data-i18n-placeholder.
 */

import { translate } from './i18n.js';

const ATTRIBUTE_BINDINGS = Object.freeze([
  ['data-i18n-title', 'title'],
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-placeholder', 'placeholder'],
]);

/**
 * Translates every bound element of the document and sets its language and title.
 * @param {Document} doc
 * @param {string} language
 */
export function applyTranslations(doc, language) {
  doc.documentElement.lang = language;
  doc.title = translate(language, 'app.title');
  for (const node of doc.querySelectorAll('[data-i18n]')) {
    node.textContent = translate(language, node.getAttribute('data-i18n'));
  }
  for (const [source, target] of ATTRIBUTE_BINDINGS) {
    for (const node of doc.querySelectorAll(`[${source}]`)) {
      node.setAttribute(target, translate(language, node.getAttribute(source)));
    }
  }
}
