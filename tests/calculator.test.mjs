import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, format } from '../dist/calculator.mjs';

test('adds decimal strings exactly', () => {
  assert.equal(calculate('0.1, 0.2').sum, '0.3');
  assert.equal(calculate('9999999999999999 1').sum, '10000000000000000');
  assert.equal(calculate('0.00000000001 0.00000000002').sum, '0.00000000003');
});

test('handles signs, separators, and exponent notation', () => {
  assert.deepEqual(calculate('12.5，8.75; -3\n24.25'), {
    sum: '42.5', count: 4, average: '10.625', minimum: '-3', maximum: '24.25',
  });
  assert.equal(calculate('1e3 -2.5e-1').sum, '999.75');
  assert.equal(calculate('-0.00 0.00').sum, '0');
});

test('rounds repeating averages to ten decimal places', () => {
  assert.equal(calculate('1 0 0').average, '0.3333333333');
  assert.equal(calculate('-1 0 0').average, '-0.3333333333');
  assert.equal(calculate('0.00000000005').average, '0.0000000001');
});

test('formats without converting to a floating-point number', () => {
  assert.equal(format('12345678901234567890.12345678901'), '12,345,678,901,234,567,890.12345678901');
  assert.equal(format('-1000.5'), '-1,000.5');
  assert.equal(format(null), '—');
});

test('rejects nonnumeric text rather than calculating a partial total', () => {
  assert.throws(() => calculate('2 apples'), /not a number/);
  assert.equal(calculate(' ').count, 0);
  assert.equal(calculate(',,;').count, 0);
});
