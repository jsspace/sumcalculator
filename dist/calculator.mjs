const input = typeof document === 'undefined' ? null : document.getElementById('numbers');

const MAX_DIGITS = 1000;
const MAX_EXPONENT = 1000n;
const AVERAGE_DECIMALS = 10;
const powersOfTen = new Map([[0, 1n]]);

function invalidNumber(token) {
  throw new Error(`“${token.slice(0, 24)}” is not a number. Remove labels or symbols, or use AI below to extract numbers.`);
}

function operatorSign(character) {
  if (character === '+' || character === '＋') return 1;
  if (character === '-' || character === '−' || character === '－') return -1;
  return null;
}

function inputTokens(raw) {
  const numberAtPosition = /(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/iy;
  const tokens = [];
  let index = 0;
  let needsNumber = true;
  let pendingSign = 1;
  let hasPendingOperator = false;

  while (index < raw.length) {
    const character = raw[index];
    if (/[\s,，;；]/.test(character)) {
      if (hasPendingOperator && /[,，;；]/.test(character)) {
        throw new Error('Finish the expression after the plus or minus sign.');
      }
      if (!needsNumber) needsNumber = true;
      index++;
      continue;
    }

    const sign = operatorSign(character);
    if (sign !== null) {
      pendingSign = needsNumber ? pendingSign * sign : sign;
      needsNumber = true;
      hasPendingOperator = true;
      index++;
      continue;
    }

    if (!needsNumber) invalidNumber(raw.slice(index, index + 24));
    numberAtPosition.lastIndex = index;
    const match = numberAtPosition.exec(raw);
    if (!match) invalidNumber(raw.slice(index, index + 24));
    tokens.push((pendingSign < 0 ? '-' : '') + match[0]);
    index = numberAtPosition.lastIndex;
    needsNumber = false;
    pendingSign = 1;
    hasPendingOperator = false;
  }

  if (hasPendingOperator) throw new Error('Finish the expression after the plus or minus sign.');
  return tokens;
}

function tenTo(power) {
  if (!powersOfTen.has(power)) powersOfTen.set(power, 10n ** BigInt(power));
  return powersOfTen.get(power);
}

function parseDecimal(token) {
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:e([+-]?\d+))?$/i.exec(token);
  if (!match) invalidNumber(token);

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
  const isoDate = /(?:^|[\s,，;；])(\d{4}-\d{1,2}-\d{1,2})(?=$|[\s,，;；])/.exec(trimmed);
  if (isoDate) invalidNumber(isoDate[1]);

  const tokens = inputTokens(trimmed);
  if (!tokens.length) return { sum: '0', count: 0, average: null, minimum: null, maximum: null };
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
    aiTools: document.getElementById('ai-tools'),
    aiButton: document.getElementById('ai-button'),
    aiStatus: document.getElementById('ai-status'),
    aiPreview: document.getElementById('ai-preview'),
    aiValues: document.getElementById('ai-values'),
    aiApply: document.getElementById('ai-apply'),
  };
  let current = null;
  let extracted = null;

  function clearAiPreview() {
    extracted = null;
    elements.aiPreview.hidden = true;
    elements.aiStatus.hidden = true;
  }

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
      elements.aiTools.hidden = true;
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
      elements.aiTools.hidden = !error.message.includes('is not a number');
      input.setAttribute('aria-invalid', 'true');
    }
  }

  input.addEventListener('input', () => {
    clearAiPreview();
    render();
  });
  document.getElementById('sample-button').addEventListener('click', () => {
    input.value = '12.5\n8.75\n-3\n24.25';
    clearAiPreview();
    render();
    input.focus();
  });
  document.getElementById('clear-button').addEventListener('click', () => {
    input.value = '';
    clearAiPreview();
    render();
    input.focus();
  });
  elements.aiButton.addEventListener('click', async () => {
    const source = input.value.trim();
    clearAiPreview();
    if (!source) {
      elements.aiStatus.textContent = 'Paste some text first.';
      elements.aiStatus.hidden = false;
      input.focus();
      return;
    }
    if (source.length > 2000) {
      elements.aiStatus.textContent = 'AI can read up to 2,000 characters at a time.';
      elements.aiStatus.hidden = false;
      return;
    }
    elements.aiButton.disabled = true;
    elements.aiButton.textContent = 'Reading…';
    elements.aiStatus.textContent = 'Reading your text with Cloudflare AI…';
    elements.aiStatus.hidden = false;
    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: source }),
      });
      const data = await response.json().catch(() => ({ error: 'AI is available after the Cloudflare Worker is deployed.' }));
      if (!response.ok) throw new Error(data.error || 'AI parsing failed.');
      if (input.value.trim() !== source) return;
      if (!Array.isArray(data.numbers) || !data.numbers.length) {
        elements.aiStatus.textContent = 'No numbers found. Try a clearer list or enter numbers normally.';
        return;
      }
      extracted = data.numbers;
      elements.aiValues.textContent = extracted.join(' · ');
      elements.aiPreview.hidden = false;
      elements.aiStatus.textContent = `${extracted.length} number${extracted.length === 1 ? '' : 's'} found. Check them before calculating.`;
    } catch (error) {
      if (input.value.trim() === source) {
        elements.aiStatus.textContent = error.message || 'AI parsing failed. Enter numbers normally.';
        elements.aiStatus.hidden = false;
      }
    } finally {
      elements.aiButton.disabled = false;
      elements.aiButton.textContent = 'Extract numbers with AI';
    }
  });
  elements.aiApply.addEventListener('click', () => {
    if (!extracted) return;
    input.value = extracted.join('\n');
    clearAiPreview();
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
  render();
}
