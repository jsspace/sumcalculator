import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRChart, FACTORS } from '../dist/r-chart-calculator.mjs';

test('worked maximum/minimum example gives UCL 0.6058, or 0.61 to two decimals', () => {
  const result = calculateRChart('4.7, 4.4\n4.8, 4.4\n4.6, 4.4\n4.9, 4.5', 8);
  assert.deepEqual(result.rows.map(row => row.range), [0.3, 0.4, 0.2, 0.4]);
  assert.equal(result.averageRange, 0.325);
  assert.equal(result.d4, 1.864);
  assert.equal(result.ucl, 0.6058);
  assert.equal(result.ucl.toFixed(2), '0.61');
  assert.equal(result.lcl, 0.0442);
});

test('direct ranges and subgroup size use the matching control chart factors', () => {
  const result = calculateRChart('0.3\n0.4\n0.2\n0.4', 4, 'ranges');
  assert.equal(result.averageRange, 0.325);
  assert.equal(result.ucl, 0.74165);
  assert.equal(result.lcl, 0);
  assert.equal(FACTORS[10].d4, 1.777);
});

test('editable subgroup size calculates three-sigma factors beyond the NIST table', () => {
  const eleven = calculateRChart('0.3\n0.4\n0.2\n0.4', 11, 'ranges');
  assert.equal(eleven.d4, 1.744);
  assert.equal(eleven.ucl, 0.5668);
  assert.equal(eleven.factorMethod, 'normal-range calculation');
  const twenty = calculateRChart('0.3\n0.4', 20, 'ranges');
  assert.equal(twenty.d4, 1.585);
});

test('invalid or ambiguous rows do not produce partial results', () => {
  assert.equal(calculateRChart('  ', 8), null);
  assert.throws(() => calculateRChart('4.4, 4.6', 8), /maximum must be at least minimum/);
  assert.throws(() => calculateRChart('4.6', 8), /maximum and minimum/);
  assert.throws(() => calculateRChart('0.3\n-0.1', 8, 'ranges'), /cannot be negative/);
  assert.throws(() => calculateRChart('0.3', 1, 'ranges'), /2 to 1,000,000/);
  assert.throws(() => calculateRChart('0.3', 3.5, 'ranges'), /whole-number/);
  assert.throws(() => calculateRChart('0.3', 1_000_001, 'ranges'), /2 to 1,000,000/);
});
