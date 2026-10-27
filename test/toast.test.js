import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../src/i18n.js';
import { TOAST_MS, createToast } from '../src/toast.js';

/** Stand-in for the toast element: text, data attributes and a class list. */
function fakeElement() {
  const classes = new Set();
  return {
    textContent: '',
    dataset: {},
    classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
    isVisible: () => classes.has('is-visible'),
  };
}

/** Timers that run only when the test says so. */
function manualTimers() {
  const pending = new Map();
  let lastId = 0;
  return {
    delays: [],
    setTimeout(callback, delay) {
      this.delays.push(delay);
      pending.set(++lastId, callback);
      return lastId;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    runAll() {
      for (const [id, callback] of [...pending]) {
        pending.delete(id);
        callback();
      }
    },
    get pendingCount() {
      return pending.size;
    },
  };
}

/** A toast whose language the test can switch, like the page's language toggle. */
function setup() {
  const page = { language: 'en' };
  const element = fakeElement();
  const timers = manualTimers();
  const toast = createToast(element, (key) => translate(page.language, key), timers);
  return { page, element, timers, toast };
}

test('a toast shows the translated message with its tone, then hides after TOAST_MS', () => {
  const { element, timers, toast } = setup();
  toast.show('status.copyFailed', 'error');
  assert.equal(element.textContent, 'Copying failed: the browser blocked clipboard access.');
  assert.equal(element.dataset.tone, 'error');
  assert.equal(element.isVisible(), true);
  assert.deepEqual(timers.delays, [TOAST_MS]);
  timers.runAll();
  assert.equal(element.isVisible(), false);
});

test('a new message replaces the old one and restarts the timer', () => {
  const { element, timers, toast } = setup();
  toast.show('status.svg');
  toast.show('status.png');
  assert.equal(element.textContent, 'PNG downloaded.');
  assert.equal(element.dataset.tone, 'ok');
  assert.equal(timers.pendingCount, 1);
});

test('a language switch translates the visible toast again', () => {
  const { page, element, toast } = setup();
  toast.show('status.copied');
  page.language = 'tr';
  toast.retranslate();
  assert.equal(element.textContent, 'SVG panoya kopyalandı.');
  assert.equal(element.isVisible(), true);
  page.language = 'en';
  toast.retranslate();
  assert.equal(element.textContent, 'SVG copied to the clipboard.');
});

test('a language switch empties a toast that has already faded', () => {
  const { page, element, timers, toast } = setup();
  toast.show('status.reset');
  timers.runAll();
  page.language = 'tr';
  toast.retranslate();
  assert.equal(element.textContent, '');
  assert.equal(element.isVisible(), false);
});
