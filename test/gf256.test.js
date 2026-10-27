import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gfExp, gfLog, gfMultiply, rsGeneratorPoly, rsRemainder } from '../src/gf256.js';

/** Deterministic byte generator (LCG) so the tests never depend on chance. */
function seededBytes(seed, count) {
  let state = seed >>> 0;
  return Array.from({ length: count }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state >>> 24;
  });
}

/** Evaluates a polynomial (highest power first) at x with Horner's rule. */
function evaluate(poly, x) {
  return poly.reduce((acc, coefficient) => gfMultiply(acc, x) ^ coefficient, 0);
}

test('exp and log are inverse and alpha generates all 255 non-zero elements', () => {
  for (let value = 1; value < 256; value++) assert.equal(gfExp(gfLog(value)), value);
  const powers = new Set(Array.from({ length: 255 }, (_, power) => gfExp(power)));
  assert.equal(powers.size, 255);
  assert.equal(powers.has(0), false);
});

test('alpha^8 is reduced by the primitive polynomial 0x11D', () => {
  assert.equal(gfExp(7), 0x80);
  assert.equal(gfExp(8), 0x1d);
  assert.equal(gfExp(255), 1);
  assert.throws(() => gfLog(0), RangeError);
});

test('multiplication is commutative, distributive and every element has an inverse', () => {
  for (let a = 0; a < 256; a += 7) {
    for (let b = 0; b < 256; b += 11) {
      assert.equal(gfMultiply(a, b), gfMultiply(b, a));
      assert.equal(gfMultiply(a, b ^ 0x53), gfMultiply(a, b) ^ gfMultiply(a, 0x53));
    }
  }
  for (let a = 1; a < 256; a++) {
    const inverse = gfExp(255 - gfLog(a));
    assert.equal(gfMultiply(a, inverse), 1);
    assert.equal(gfMultiply(a, 0), 0);
    assert.equal(gfMultiply(a, 1), a);
  }
});

test('generator polynomials match the published exponent tables', () => {
  const exponents = (degree) => Array.from(rsGeneratorPoly(degree), gfLog);
  assert.deepEqual(exponents(7), [0, 87, 229, 146, 149, 238, 102, 21]);
  assert.deepEqual(exponents(10), [0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45]);
  assert.deepEqual(exponents(13), [0, 74, 152, 176, 100, 86, 100, 106, 104, 130, 218, 206, 140, 78]);
});

test('generator polynomial of degree n has the roots alpha^0 .. alpha^(n-1)', () => {
  for (const degree of [7, 16, 30]) {
    const generator = Array.from(rsGeneratorPoly(degree));
    assert.equal(generator.length, degree + 1);
    for (let i = 0; i < degree; i++) assert.equal(evaluate(generator, gfExp(i)), 0);
  }
});

test('data followed by its remainder is a valid codeword (all syndromes zero)', () => {
  for (const degree of [7, 10, 13, 17, 22, 26, 28, 30]) {
    const data = seededBytes(degree, 15 + degree);
    const codeword = [...data, ...rsRemainder(data, degree)];
    for (let i = 0; i < degree; i++) assert.equal(evaluate(codeword, gfExp(i)), 0, `degree ${degree}, root ${i}`);
  }
});

test('any single corrupted codeword gives a non-zero syndrome', () => {
  const data = seededBytes(99, 20);
  const codeword = [...data, ...rsRemainder(data, 10)];
  codeword[5] ^= 0x2a;
  const syndromes = Array.from({ length: 10 }, (_, i) => evaluate(codeword, gfExp(i)));
  assert.ok(syndromes.some((value) => value !== 0));
});

test('all-zero data has an all-zero remainder', () => {
  assert.deepEqual(Array.from(rsRemainder(new Uint8Array(12), 18)), new Array(18).fill(0));
});
