/**
 * The preview card: the live SVG symbol (or the empty / too-long message),
 * version, mode, capacity use, export size and the contrast warning.
 * DOM only; every string comes from the translate function it is given.
 */

import { MIN_SCAN_CONTRAST } from './color.js';
import { outerSize, svgPathData } from './render.js';
import { detectMode } from './segment.js';
import { capacityUsage, fitPixelSize, lengthUnit, pngSize } from './stats.js';

/**
 * @typedef {(key: string, params?: Record<string, string|number>) => string} Translate
 * @typedef {(value: number, fractionDigits?: number) => string} FormatNumber
 */

function byId(id) {
  return document.getElementById(id);
}

/**
 * Finds the preview elements and returns its renderer.
 * @returns {{render: (state: import('./generator.js').GeneratorState, t: Translate, n: FormatNumber) => void, fit: () => void}}
 */
export function createPreview() {
  const el = {
    frame: byId('preview-frame'),
    stage: byId('preview-stage'),
    code: byId('qr-code'),
    background: byId('qr-background'),
    modules: byId('qr-modules'),
    placeholder: byId('placeholder'),
    placeholderTitle: byId('placeholder-title'),
    placeholderText: byId('placeholder-text'),
    warning: byId('contrast-warning'),
    warningText: byId('contrast-warning-text'),
    version: byId('stat-version'),
    mode: byId('stat-mode'),
    capacity: byId('stat-capacity'),
    percent: byId('stat-percent'),
    fill: byId('capacity-fill'),
    details: byId('details'),
  };
  let units = 0;

  /** Sizes the symbol so every module covers the same whole number of device pixels. */
  function fit() {
    const available = el.stage.clientWidth;
    if (units === 0 || available === 0) return;
    const size = `${fitPixelSize(available, units, window.devicePixelRatio || 1)}px`;
    el.code.style.width = size;
    el.code.style.height = size;
  }

  function showSymbol({ qr, options }, t) {
    units = outerSize(qr, options.quietZone);
    el.code.setAttribute('viewBox', `0 0 ${units} ${units}`);
    el.code.setAttribute('aria-label', t('qr.label', { version: qr.version, size: qr.size }));
    el.background.setAttribute('width', String(units));
    el.background.setAttribute('height', String(units));
    el.background.setAttribute('fill', options.background);
    el.modules.setAttribute('d', svgPathData(qr, options.quietZone));
    el.modules.setAttribute('fill', options.foreground);
    fit();
  }

  function showMessage(state, t, n) {
    const { error } = state;
    el.frame.classList.toggle('is-error', error.code === 'too-long');
    if (error.code === 'too-long') {
      el.placeholderTitle.textContent = t('tooLong.title');
      el.placeholderText.textContent = t('tooLong.detail', {
        length: n(error.length),
        max: n(error.maxLength),
        unit: t(`unit.${lengthUnit(detectMode(state.payload))}`),
        level: state.options.ecLevel,
      });
      return;
    }
    el.placeholderTitle.textContent = t('empty.title');
    el.placeholderText.textContent = t(`empty.${state.type}`);
  }

  function showStats({ qr, options }, t, n) {
    if (qr === null) {
      for (const node of [el.version, el.mode, el.capacity]) node.textContent = '–';
      el.percent.textContent = '';
      el.details.textContent = '';
      el.fill.style.width = '0%';
      return;
    }
    const usage = capacityUsage(qr);
    const pixels = pngSize(qr, options);
    el.version.textContent = t('stat.versionValue', { version: qr.version, size: qr.size });
    el.mode.textContent = t(`mode.${qr.mode}`);
    el.capacity.textContent = t('stat.capacityValue', {
      used: n(usage.used),
      total: n(usage.total),
      unit: t(`unit.${lengthUnit(qr.mode)}`),
    });
    el.percent.textContent = t('percent', { value: usage.percent });
    el.fill.style.width = `${usage.percent}%`;
    el.details.textContent = t('stat.details', { level: qr.ecLevel, mask: qr.mask, pixels: n(pixels) });
  }

  function showContrast(state, t, n) {
    el.warning.hidden = !state.lowContrast;
    el.warningText.textContent = t('contrast.warning', { ratio: n(state.contrast, 1), min: MIN_SCAN_CONTRAST });
  }

  return {
    render(state, t, n) {
      const hasSymbol = state.qr !== null;
      el.stage.hidden = !hasSymbol;
      el.placeholder.hidden = hasSymbol;
      el.frame.classList.toggle('has-code', hasSymbol);
      if (hasSymbol) showSymbol(state, t);
      else showMessage(state, t, n);
      showStats(state, t, n);
      showContrast(state, t, n);
    },
    fit,
  };
}
