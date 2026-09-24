const input = typeof document === 'undefined' ? null : document.getElementById('numbers');

const MAX_DIGITS = 1000;
const MAX_EXPONENT = 1000n;
const AVERAGE_DECIMALS = 10;
const powersOfTen = new Map([[0, 1n]]);

function tenTo(power) {
  if (!powersOfTen.has(power)) powersOfTen.set(power, 10n ** BigInt(power));
  return powersOfTen.get(power);
}

function parseDecimal(token) {
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i.exec(token);
  if (!match) throw new Error(`“${token.slice(0, 24)}” is not a number. Remove labels or symbols and try again.`);

  const integer = match[2] || '0';
  const fraction = match[3] ?? match[4] ?? '';
  if (integer.length + fraction.length > MAX_DIGITS) {
    throw new Error('One number has too many digits. Please shorten it.');
  }

  const exponent = BigInt(match[5] || '0');
  if (exponent > MAX_EXPONENT || exponent < -MAX_EXPONENT) {
    throw new Error('An exponent is too large. Please use a smaller one.');
  }

  let coefficient = BigInt(integer + fraction);
  if (match[1] === '-') coefficient = -coefficient;
  let scale = fraction.length - Number(exponent);
  if (scale < 0) {
    coefficient *= tenTo(-scale);
    scale = 0;
  }
  return { coefficient, scale };
}

function decimalString(coefficient, scale) {
  if (coefficient === 0n) return '0';
  const sign = coefficient < 0n ? '-' : '';
  const digits = (coefficient < 0n ? -coefficient : coefficient).toString().padStart(scale + 1, '0');
  if (scale === 0) return sign + digits;
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return sign + digits.slice(0, -scale) + (fraction ? `.${fraction}` : '');
}

function roundedAverage(coefficient, scale, count) {
  const negative = coefficient < 0n;
  const numerator = (negative ? -coefficient : coefficient) * tenTo(AVERAGE_DECIMALS);
  const denominator = BigInt(count) * tenTo(scale);
  let quotient = numerator / denominator;
  if ((numerator % denominator) * 2n >= denominator) quotient += 1n;
  return decimalString(negative ? -quotient : quotient, AVERAGE_DECIMALS);
}

export function calculate(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { sum: '0', count: 0, average: null, minimum: null, maximum: null };

  const tokens = trimmed.split(/[\s,，;；]+/).filter(Boolean);
  const values = tokens.map(parseDecimal);
  const scale = values.reduce((maximum, value) => Math.max(maximum, value.scale), 0);
  let sum = 0n;
  let minimum = null;
  let maximum = null;
  for (const value of values) {
    const aligned = value.coefficient * tenTo(scale - value.scale);
    sum += aligned;
    if (minimum === null || aligned < minimum.coefficient) minimum = { coefficient: aligned, scale };
    if (maximum === null || aligned > maximum.coefficient) maximum = { coefficient: aligned, scale };
  }

  return {
    sum: decimalString(sum, scale),
    count: values.length,
    average: roundedAverage(sum, scale, values.length),
    minimum: decimalString(minimum.coefficient, scale),
    maximum: decimalString(maximum.coefficient, scale),
  };
}

export function format(value) {
  if (value === null) return '—';
  const [integer, fraction] = String(value).split('.');
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
}

if (input) {
  const elements = {
    sum: document.getElementById('sum'),
    count: document.getElementById('count'),
    average: document.getElementById('average'),
    minimum: document.getElementById('minimum'),
    maximum: document.getElementById('maximum'),
    error: document.getElementById('error-message'),
    copy: document.getElementById('copy-button'),
  };
  let current = null;

  function render() {
    try {
      const result = calculate(input.value);
      current = result.count ? result : null;
      elements.sum.textContent = format(result.sum);
      elements.count.textContent = format(result.count);
      elements.average.textContent = format(result.average);
      elements.minimum.textContent = format(result.minimum);
      elements.maximum.textContent = format(result.maximum);
      elements.error.hidden = true;
      input.removeAttribute('aria-invalid');
      elements.copy.disabled = !current;
      elements.copy.innerHTML = 'Copy total <span aria-hidden="true">↗</span>';
    } catch (error) {
      current = null;
      elements.sum.textContent = '—';
      elements.count.textContent = '—';
      elements.average.textContent = '—';
      elements.minimum.textContent = '—';
      elements.maximum.textContent = '—';
      elements.copy.disabled = true;
      elements.error.textContent = error.message;
      elements.error.hidden = false;
      input.setAttribute('aria-invalid', 'true');
    }
  }

  input.addEventListener('input', render);
  document.getElementById('sample-button').addEventListener('click', () => {
    input.value = '12.5\n8.75\n-3\n24.25';
    render();
    input.focus();
  });
  document.getElementById('clear-button').addEventListener('click', () => {
    input.value = '';
    render();
    input.focus();
  });
  elements.copy.addEventListener('click', async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.sum);
      elements.copy.textContent = 'Copied!';
    } catch {
      elements.copy.textContent = 'Copy failed';
    }
  });
}
