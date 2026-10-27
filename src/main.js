/**
 * Entry point: connects the generator state to the page (type tabs, form,
 * live preview, options, export buttons, language toggle and keyboard
 * shortcuts). ?demo opens a fixed Wi-Fi example for the README screenshot.
 */

import { copySvg, downloadPng, downloadSvg } from './exporter.js';
import { createFieldPanels } from './fields.js';
import { createGenerator, demoConfig } from './generator.js';
import { DEFAULT_LANGUAGE, formatNumber, isLanguage, nextLanguage, translate } from './i18n.js';
import { applyTranslations } from './localize.js';
import { createOptionsPanel } from './options.js';
import { createPreview } from './preview.js';
import { shortcutAction } from './shortcuts.js';
import { loadValue, saveValue } from './storage.js';
import { createTypeTabs } from './tabs.js';
import { createToast } from './toast.js';

const LANGUAGE_KEY = 'language';
const SETTINGS_KEY = 'settings';
/** Input types that do not take typed text, so shortcuts keep working while they have focus. */
const NON_TEXT_INPUTS = new Set(['checkbox', 'radio', 'range', 'color', 'button']);

const demo = new URLSearchParams(window.location.search).has('demo');
// Only the type, options and panel state are stored; typed content (passwords!) never is.
const generator = createGenerator(demo ? demoConfig() : loadValue(SETTINGS_KEY, null));
const storedLanguage = loadValue(LANGUAGE_KEY, DEFAULT_LANGUAGE);
let language = isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;
let savedSettings = '';

const t = (key, params) => translate(language, key, params);
const n = (value, fractionDigits) => formatNumber(language, value, fractionDigits);

const typeHint = document.getElementById('type-hint');
const langButton = document.getElementById('lang-button');
const exportButtons = ['png-button', 'svg-button', 'copy-button'].map((id) => document.getElementById(id));

const fields = createFieldPanels(document.getElementById('fields-form'), editField);
const tabs = createTypeTabs(document.getElementById('type-tabs'), (type) => apply(generator.setType(type)));
const preview = createPreview();
const toast = createToast(document.getElementById('toast'), t);
const options = createOptionsPanel({
  setOption: (name, value) => apply(generator.setOption(name, value)),
  toggle: () => apply(generator.toggleOptions()),
});

function render(state) {
  tabs.sync(state.type);
  fields.sync(state);
  typeHint.textContent = t(`hint.${state.type}`);
  preview.render(state, t, n);
  options.sync(state, t, n);
  for (const button of exportButtons) button.disabled = state.qr === null;
}

function persist(state) {
  if (demo) return;
  const settings = { type: state.type, options: state.options, showOptions: state.showOptions };
  const serialized = JSON.stringify(settings);
  if (serialized === savedSettings) return;
  savedSettings = serialized;
  saveValue(SETTINGS_KEY, settings);
}

function apply(state) {
  render(state);
  persist(state);
}

function editField(type, name, value) {
  const state = generator.getState();
  if (type !== state.type || state.values[type][name] === value) return;
  apply(generator.setField(name, value));
}

async function exportPng() {
  const state = generator.getState();
  if (state.qr === null) return;
  const saved = await downloadPng(state);
  toast.show(saved ? 'status.png' : 'status.pngFailed', saved ? 'ok' : 'error');
}

function exportSvg() {
  const state = generator.getState();
  if (state.qr === null) return;
  downloadSvg(state);
  toast.show('status.svg');
}

async function copyToClipboard() {
  const state = generator.getState();
  if (state.qr === null) return;
  const copied = await copySvg(state);
  toast.show(copied ? 'status.copied' : 'status.copyFailed', copied ? 'ok' : 'error');
}

function resetAll() {
  apply(generator.reset());
  toast.show('status.reset');
}

function localize() {
  applyTranslations(document, language);
  langButton.textContent = nextLanguage(language).toUpperCase();
  toast.retranslate();
}

function switchLanguage() {
  language = nextLanguage(language);
  saveValue(LANGUAGE_KEY, language);
  localize();
  render(generator.getState());
}

const SHORTCUT_HANDLERS = {
  type: (action) => apply(generator.setType(action.type)),
  ecLevel: (action) => apply(generator.setOption('ecLevel', action.level)),
  toggleOptions: () => apply(generator.toggleOptions()),
  downloadPng: exportPng,
  downloadSvg: exportSvg,
  copySvg: copyToClipboard,
};

function isTextEntry(element) {
  if (element instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(element.type);
  return element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || element?.isContentEditable === true;
}

function onKeyDown(event) {
  if (event.defaultPrevented || event.repeat || isTextEntry(event.target)) return;
  const action = shortcutAction(event);
  if (action === null) return;
  event.preventDefault();
  SHORTCUT_HANDLERS[action.name](action);
}

document.getElementById('png-button').addEventListener('click', exportPng);
document.getElementById('svg-button').addEventListener('click', exportSvg);
document.getElementById('copy-button').addEventListener('click', copyToClipboard);
document.getElementById('reset-button').addEventListener('click', resetAll);
langButton.addEventListener('click', switchLanguage);
document.addEventListener('keydown', onKeyDown);
window.addEventListener('resize', () => preview.fit());

localize();
apply(generator.getState());
