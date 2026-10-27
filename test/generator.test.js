import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_OPTIONS, OPTION_RANGES, createGenerator, demoConfig } from '../src/generator.js';

test('a new generator starts empty with default options', () => {
  const state = createGenerator().getState();
  assert.equal(state.type, 'text');
  assert.equal(state.payload, '');
  assert.equal(state.qr, null);
  assert.deepEqual(state.error, { code: 'empty' });
  assert.deepEqual(state.options, DEFAULT_OPTIONS);
  assert.equal(state.showOptions, false);
  assert.equal(state.contrast, 21);
  assert.equal(state.lowContrast, false);
  assert.ok(Object.isFrozen(state));
});

test('typing text produces a live symbol with version, mode and capacity', () => {
  const generator = createGenerator();
  const state = generator.setField('text', 'https://example.com');
  assert.equal(state.payload, 'https://example.com');
  assert.equal(state.error, null);
  assert.equal(state.qr.version, 2);
  assert.equal(state.qr.mode, 'byte');
  assert.equal(state.qr.length, 19);
  assert.equal(state.qr.capacity, 26);
  assert.equal(generator.getState(), state);
});

test('each payload type keeps its own form values', () => {
  const generator = createGenerator();
  generator.setField('text', 'kept');
  generator.setType('wifi');
  generator.setField('ssid', 'Home');
  generator.setField('password', 'p;w');
  let state = generator.setField('hidden', true);
  assert.equal(state.payload, 'WIFI:T:WPA;S:Home;P:p\\;w;H:true;;');
  assert.equal(state.qr.mode, 'byte');
  state = generator.setType('text');
  assert.equal(state.payload, 'kept');
  assert.equal(generator.setType('wifi').values.wifi.ssid, 'Home');
});

test('field values are validated against the field kind', () => {
  const generator = createGenerator({ type: 'wifi' });
  assert.equal(generator.setField('security', 'nopass').values.wifi.security, 'nopass');
  assert.equal(generator.setField('security', 'WPA9').values.wifi.security, 'nopass');
  assert.equal(generator.setField('hidden', 'yes').values.wifi.hidden, false);
  assert.equal(generator.setField('ssid', 42).values.wifi.ssid, '');
  assert.throws(() => generator.setField('text', 'x'), RangeError);
  assert.throws(() => generator.setType('fax'), RangeError);
});

test('options are clamped, rounded and validated', () => {
  const generator = createGenerator();
  assert.equal(generator.setOption('moduleSize', 100).options.moduleSize, OPTION_RANGES.moduleSize.max);
  assert.equal(generator.setOption('moduleSize', '7.4').options.moduleSize, 7);
  assert.equal(generator.setOption('moduleSize', 'abc').options.moduleSize, 7);
  assert.equal(generator.setOption('moduleSize', '').options.moduleSize, 7);
  assert.equal(generator.setOption('quietZone', -3).options.quietZone, 0);
  assert.equal(generator.setOption('ecLevel', 'H').options.ecLevel, 'H');
  assert.equal(generator.setOption('ecLevel', 'X').options.ecLevel, 'H');
  assert.equal(generator.setOption('foreground', '#ABC').options.foreground, '#aabbcc');
  assert.equal(generator.setOption('foreground', 'blue').options.foreground, '#aabbcc');
  assert.throws(() => generator.setOption('size', 3), RangeError);
});

test('the error-correction level changes the symbol', () => {
  const generator = createGenerator();
  generator.setField('text', 'HELLO WORLD');
  assert.equal(generator.setOption('ecLevel', 'L').qr.version, 1);
  const high = generator.setOption('ecLevel', 'H');
  assert.equal(high.qr.ecLevel, 'H');
  assert.equal(high.qr.version, 2);
});

test('low contrast colours raise the warning', () => {
  const generator = createGenerator();
  assert.equal(generator.setOption('foreground', '#cccccc').lowContrast, true);
  const fixed = generator.setOption('foreground', '#333333');
  assert.equal(fixed.lowContrast, false);
  assert.ok(fixed.contrast > 10);
});

test('colour and size changes reuse the encoded symbol', () => {
  const generator = createGenerator();
  const before = generator.setField('text', 'cache me');
  const after = generator.setOption('background', '#f0fdf4');
  assert.equal(after.qr, before.qr);
  assert.notEqual(generator.setOption('ecLevel', 'Q').qr, before.qr);
});

test('text that does not fit reports a too-long error with the limits', () => {
  const generator = createGenerator({ options: { ecLevel: 'L' } });
  const state = generator.setField('text', 'a'.repeat(3000));
  assert.equal(state.qr, null);
  assert.deepEqual(state.error, { code: 'too-long', length: 3000, maxLength: 2953 });
});

test('toggleOptions opens and closes the options panel', () => {
  const generator = createGenerator();
  assert.equal(generator.toggleOptions().showOptions, true);
  assert.equal(generator.toggleOptions().showOptions, false);
});

test('reset clears the values and options but keeps the type and panel', () => {
  const generator = createGenerator({ type: 'sms', showOptions: true });
  generator.setField('number', '555');
  generator.setOption('ecLevel', 'H');
  const state = generator.reset();
  assert.equal(state.type, 'sms');
  assert.equal(state.showOptions, true);
  assert.equal(state.values.sms.number, '');
  assert.deepEqual(state.options, DEFAULT_OPTIONS);
  assert.deepEqual(state.error, { code: 'empty' });
});

test('invalid parts of a stored config fall back to defaults', () => {
  const state = createGenerator({
    type: 'telex',
    values: { text: { text: 'restored' }, wifi: { security: 'ROT13', hidden: 'no' } },
    options: { ecLevel: 'Z', moduleSize: 6, quietZone: 99, foreground: 'nope', background: '#FFF' },
    showOptions: 'yes',
  }).getState();
  assert.equal(state.type, 'text');
  assert.equal(state.payload, 'restored');
  assert.equal(state.values.wifi.security, 'WPA');
  assert.equal(state.values.wifi.hidden, false);
  assert.deepEqual(state.options, { ecLevel: 'M', moduleSize: 6, quietZone: 10, foreground: '#000000', background: '#ffffff' });
  assert.equal(state.showOptions, false);
});

test('null configs, non-numeric option values and inherited names are handled', () => {
  assert.deepEqual(createGenerator(null).getState().options, DEFAULT_OPTIONS);
  const state = createGenerator({ values: null, options: null }).getState();
  assert.equal(state.type, 'text');
  assert.deepEqual(state.options, DEFAULT_OPTIONS);
  const generator = createGenerator({ options: { moduleSize: null, quietZone: true } });
  assert.deepEqual(generator.getState().options, DEFAULT_OPTIONS);
  assert.equal(generator.setOption('moduleSize', [5]).options.moduleSize, DEFAULT_OPTIONS.moduleSize);
  assert.throws(() => generator.setOption('toString', 1), RangeError);
  assert.throws(() => generator.setType('constructor'), RangeError);
});

test('earlier snapshots are not changed by later updates', () => {
  const generator = createGenerator();
  const first = generator.setField('text', 'one');
  generator.setField('text', 'two');
  assert.equal(first.payload, 'one');
  assert.equal(first.values.text.text, 'one');
});

test('demo config builds a Wi-Fi code with the options panel open, deterministically', () => {
  const state = createGenerator(demoConfig()).getState();
  assert.equal(state.type, 'wifi');
  assert.equal(state.showOptions, true);
  assert.equal(state.payload, 'WIFI:T:WPA;S:Corner Cafe Guest;P:latte-art-2026;;');
  assert.equal(state.error, null);
  assert.equal(state.lowContrast, false);
  assert.equal(state.qr.ecLevel, 'Q');
  assert.deepEqual(createGenerator(demoConfig()).getState().qr, state.qr);
  assert.notEqual(demoConfig(), demoConfig());
});
