/**
 * The options card: collapsible panel with the error-correction level,
 * module size, quiet zone and colours. DOM only; changes go to the callbacks.
 */

import { OPTION_RANGES } from './generator.js';
import { EC_RECOVERY_PERCENT } from './tables.js';

/** Value labels of the range inputs. */
const RANGE_LABELS = Object.freeze({ moduleSize: 'option.moduleSizeValue', quietZone: 'option.quietZoneValue' });

function byId(id) {
  return document.getElementById(id);
}

function setupRange(input) {
  const { min, max } = OPTION_RANGES[input.dataset.option];
  input.min = String(min);
  input.max = String(max);
}

/**
 * Wires the options card.
 * @param {{setOption: (name: string, value: string) => void, toggle: () => void}} handlers
 * @returns {{sync: (state: import('./generator.js').GeneratorState, t: import('./preview.js').Translate, n: import('./preview.js').FormatNumber) => void}}
 */
export function createOptionsPanel({ setOption, toggle }) {
  const toggleButton = byId('options-toggle');
  const body = byId('options-body');
  const radios = [...body.querySelectorAll('input[name="ecLevel"]')];
  const percents = [...body.querySelectorAll('.seg__percent')];
  const ranges = [...body.querySelectorAll('input[type="range"]')];
  const colors = [...body.querySelectorAll('input[type="color"]')];
  const ecValue = byId('ec-value');
  const contrastLine = byId('contrast-line');

  ranges.forEach(setupRange);
  toggleButton.addEventListener('click', toggle);
  for (const radio of radios) radio.addEventListener('change', () => setOption('ecLevel', radio.value));
  for (const input of [...ranges, ...colors]) {
    input.addEventListener('input', () => setOption(input.dataset.option, input.value));
  }

  function syncRange(input, value, t) {
    const { min, max } = OPTION_RANGES[input.dataset.option];
    if (input.value !== String(value)) input.value = String(value);
    input.style.setProperty('--fill', `${((value - min) / (max - min)) * 100}%`);
    byId(`${input.id}-value`).textContent = t(RANGE_LABELS[input.dataset.option], { value });
  }

  function syncColor(input, value) {
    if (input.value !== value) input.value = value;
    byId(`${input.id}-hex`).textContent = value;
  }

  return {
    sync(state, t, n) {
      const { options } = state;
      toggleButton.setAttribute('aria-expanded', String(state.showOptions));
      body.hidden = !state.showOptions;
      for (const radio of radios) radio.checked = radio.value === options.ecLevel;
      for (const node of percents) node.textContent = t('percent', { value: EC_RECOVERY_PERCENT[node.dataset.level] });
      ecValue.textContent = t('option.ecValue', {
        name: t(`ec.${options.ecLevel}`),
        percent: t('percent', { value: EC_RECOVERY_PERCENT[options.ecLevel] }),
      });
      for (const input of ranges) syncRange(input, options[input.dataset.option], t);
      for (const input of colors) syncColor(input, options[input.dataset.option]);
      const ratio = n(state.contrast, 1);
      contrastLine.textContent = t(state.lowContrast ? 'contrast.low' : 'contrast.ok', { ratio });
      contrastLine.classList.toggle('is-low', state.lowContrast);
    },
  };
}
