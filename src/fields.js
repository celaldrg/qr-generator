/**
 * Form fields of every payload type, built from PAYLOAD_FIELDS: one tab
 * panel per type, labels and placeholders bound to i18n keys.
 * DOM only; values live in the generator state.
 */

import { hasString } from './i18n.js';
import { PAYLOAD_FIELDS, PAYLOAD_TYPES, isFieldUsed } from './payload.js';

const TEXTAREA_ROWS = 4;

/** Mobile keyboards capitalise these fields; every other single-line field stays as typed. */
const CAPITALIZE = Object.freeze({ firstName: 'words', lastName: 'words', org: 'words', title: 'words', subject: 'sentences' });

function controlId(type, name) {
  return `field-${type}-${name}`;
}

function createTextControl(type, field) {
  const multiline = field.input === 'textarea';
  const control = document.createElement(multiline ? 'textarea' : 'input');
  if (multiline) {
    control.rows = TEXTAREA_ROWS;
  } else {
    control.type = field.input;
    control.spellcheck = false;
    control.setAttribute('autocapitalize', CAPITALIZE[field.name] ?? 'off');
  }
  control.autocomplete = field.input === 'password' ? 'new-password' : 'off';
  const placeholderKey = `placeholder.${type}.${field.name}`;
  if (hasString(placeholderKey)) control.dataset.i18nPlaceholder = placeholderKey;
  return control;
}

function createSelect(type, field) {
  const select = document.createElement('select');
  for (const value of field.options) {
    const option = document.createElement('option');
    option.value = value;
    option.dataset.i18n = `choice.${type}.${field.name}.${value}`;
    select.append(option);
  }
  return select;
}

/** Wraps a password input with a show/hide button. */
function withVisibilityToggle(input) {
  const group = document.createElement('div');
  group.className = 'input-group';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button';
  button.dataset.i18nAriaLabel = 'password.show';
  button.dataset.i18nTitle = 'password.show';
  button.setAttribute('aria-pressed', 'false');
  button.setAttribute('aria-controls', input.id);
  button.append(document.getElementById('eye-icon').content.firstElementChild.cloneNode(true));
  button.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(show));
  });
  group.append(input, button);
  return group;
}

function createCheckbox(type, field) {
  const label = document.createElement('label');
  label.className = 'check';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = controlId(type, field.name);
  input.dataset.field = field.name;
  const text = document.createElement('span');
  text.dataset.i18n = `field.${type}.${field.name}`;
  label.append(input, text);
  return label;
}

function createField(type, field) {
  if (field.input === 'checkbox') return createCheckbox(type, field);
  const wrapper = document.createElement('div');
  wrapper.className = field.input === 'textarea' ? 'field field--wide' : 'field';
  const label = document.createElement('label');
  label.className = 'field__label';
  label.htmlFor = controlId(type, field.name);
  label.dataset.i18n = `field.${type}.${field.name}`;
  const control = field.input === 'select' ? createSelect(type, field) : createTextControl(type, field);
  control.id = controlId(type, field.name);
  control.className = 'input';
  control.dataset.field = field.name;
  wrapper.append(label, field.input === 'password' ? withVisibilityToggle(control) : control);
  return wrapper;
}

function createPanel(type) {
  const panel = document.createElement('div');
  panel.className = 'fields';
  panel.id = `panel-${type}`;
  panel.dataset.type = type;
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('aria-labelledby', `tab-${type}`);
  panel.append(...PAYLOAD_FIELDS[type].map((field) => createField(type, field)));
  return panel;
}

function controlValue(control) {
  return control.type === 'checkbox' ? control.checked : control.value;
}

function syncControl(control, value, enabled) {
  if (control.type === 'checkbox') control.checked = value;
  else if (control.value !== value) control.value = value;
  control.disabled = !enabled;
  const visibilityToggle = control.closest('.input-group')?.querySelector('button');
  if (visibilityToggle) visibilityToggle.disabled = !enabled;
}

/**
 * Builds the field panels inside a form and reports edits.
 * @param {HTMLFormElement} form container; submitting it is suppressed
 * @param {(type: string, name: string, value: string|boolean) => void} onEdit
 * @returns {{sync: (state: import('./generator.js').GeneratorState) => void}}
 */
export function createFieldPanels(form, onEdit) {
  const panels = PAYLOAD_TYPES.map(createPanel);
  form.append(...panels);

  const report = (event) => {
    const control = event.target;
    if (!control.dataset.field) return;
    onEdit(control.closest('[role="tabpanel"]').dataset.type, control.dataset.field, controlValue(control));
  };
  form.addEventListener('input', report);
  form.addEventListener('change', report);
  form.addEventListener('submit', (event) => event.preventDefault());

  return {
    sync(state) {
      for (const panel of panels) {
        const { type } = panel.dataset;
        const values = state.values[type];
        panel.hidden = type !== state.type;
        for (const control of panel.querySelectorAll('[data-field]')) {
          const name = control.dataset.field;
          syncControl(control, values[name], isFieldUsed(type, name, values));
        }
      }
    },
  };
}
