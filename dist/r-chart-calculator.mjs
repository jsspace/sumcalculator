import { calculate } from './calculator.mjs';

// Published three-sigma R-chart factors for subgroup sizes 2–10 (NIST Engineering Statistics Handbook).
export const FACTORS = Object.freeze({
  2: { d3: 0, d4: 3.267 }, 3: { d3: 0, d4: 2.575 },
  4: { d3: 0, d4: 2.282 }, 5: { d3: 0, d4: 2.115 },
  6: { d3: 0, d4: 2.004 }, 7: { d3: 0.076, d4: 1.924 },
  8: { d3: 0.136, d4: 1.864 }, 9: { d3: 0.184, d4: 1.816 },
  10: { d3: 0.223, d4: 1.777 },
});
const MAX_SUBGROUP_SIZE = 1_000_000;
const computedFactors = new Map();

function factorsFor(subgroupSize) {
  if (!Number.isInteger(subgroupSize) || subgroupSize < 2 || subgroupSize > MAX_SUBGROUP_SIZE) {
    throw new Error('Enter a whole-number subgroup size n from 2 to 1,000,000.');
  }
  if (FACTORS[subgroupSize]) return { ...FACTORS[subgroupSize], method: 'NIST table' };
  if (computedFactors.has(subgroupSize)) return computedFactors.get(subgroupSize);

  // E(R) and E(R²) from the joint density of the minimum and maximum of n
  // independent standard-normal observations. Composite Simpson integration.
  const intervals = 500;
  const boundary = 10;
  const step = 2 * boundary / intervals;
  const phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const pdf = new Float64Array(intervals + 1);
  const cdf = new Float64Array(intervals + 1);
  const weights = new Uint8Array(intervals + 1);
  for (let i = 0; i <= intervals; i++) {
    pdf[i] = phi(-boundary + i * step);
    weights[i] = i === 0 || i === intervals ? 1 : i % 2 ? 4 : 2;
    if (i) cdf[i] = cdf[i - 1] + step / 6 * (pdf[i - 1] + 4 * phi(-boundary + (i - 0.5) * step) + pdf[i]);
  }
  let firstMoment = 0;
  let secondMoment = 0;
  for (let i = 0; i <= intervals; i++) {
    for (let j = i + 1; j <= intervals; j++) {
      const range = (j - i) * step;
      const density = subgroupSize * (subgroupSize - 1) * pdf[i] * pdf[j]
        * Math.pow(cdf[j] - cdf[i], subgroupSize - 2);
      const weight = weights[i] * weights[j] * step * step / 9;
      firstMoment += weight * density * range;
      secondMoment += weight * density * range * range;
    }
  }
  const rangeSd = Math.sqrt(Math.max(0, secondMoment - firstMoment * firstMoment));
  const ratio = 3 * rangeSd / firstMoment;
  const factors = {
    d3: Math.max(0, Number((1 - ratio).toFixed(3))),
    d4: Number((1 + ratio).toFixed(3)),
    method: 'normal-range calculation',
  };
  computedFactors.set(subgroupSize, factors);
  return factors;
}

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function value(token, line) {
  if (!NUMBER.test(token)) throw new Error(`Line ${line}: enter plain decimal numbers only.`);
  const number = Number(token);
  if (!Number.isFinite(number)) throw new Error(`Line ${line}: the number is too large.`);
  return number;
}

function clean(number) {
  return Number(number.toPrecision(15));
}

export function calculateRChart(raw, subgroupSize = 8, mode = 'pairs') {
  const lines = raw.trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  if (mode !== 'pairs' && mode !== 'ranges') throw new Error('Choose a valid input mode.');
  if (lines.length > 100) throw new Error('Enter no more than 100 subgroups.');

  const rows = lines.map((line, index) => {
    const lineNumber = index + 1;
    if (mode === 'ranges') {
      const range = value(line, lineNumber);
      if (range < 0) throw new Error(`Line ${lineNumber}: a range cannot be negative.`);
      return { range };
    }
    const tokens = line.split(/[\s,，;；]+/).filter(Boolean);
    if (tokens.length !== 2) throw new Error(`Line ${lineNumber}: enter a maximum and minimum, separated by a comma or space.`);
    const maximum = value(tokens[0], lineNumber);
    const minimum = value(tokens[1], lineNumber);
    if (maximum < minimum) throw new Error(`Line ${lineNumber}: maximum must be at least minimum.`);
    const range = Number(calculate(`${tokens[0]}-${tokens[1]}`).sum);
    if (!Number.isFinite(range)) throw new Error(`Line ${lineNumber}: the range is too large.`);
    return { maximum, minimum, range };
  });
  const factors = factorsFor(Number(subgroupSize));
  const total = rows.reduce((sum, row) => sum + row.range, 0);
  const averageRange = total / rows.length;
  return {
    rows,
    subgroupSize: Number(subgroupSize),
    count: rows.length,
    averageRange: clean(averageRange),
    d3: factors.d3,
    d4: factors.d4,
    factorMethod: factors.method,
    ucl: clean(averageRange * factors.d4),
    lcl: clean(averageRange * factors.d3),
  };
}

const input = typeof document === 'undefined' ? null : document.getElementById('r-input');
if (input) {
  const mode = document.getElementById('r-mode');
  const size = document.getElementById('r-size');
  const output = document.getElementById('r-results');
  const process = document.getElementById('r-process');
  const detail = document.getElementById('r-detail');
  const error = document.getElementById('r-error');
  const aiTools = document.getElementById('r-ai-tools');
  const aiButton = document.getElementById('r-ai-button');
  const aiStatus = document.getElementById('r-ai-status');
  const aiPreview = document.getElementById('r-ai-preview');
  const aiApply = document.getElementById('r-ai-apply');
  let requestVersion = 0;
  let extracted = null;
  const fields = Object.fromEntries(['ucl', 'average', 'lcl', 'factor', 'count', 'formula', 'rows', 'chart'].map(key => [key, document.getElementById(`r-${key}`)]));
  const display = number => number.toLocaleString('en-US', { maximumSignificantDigits: 15 });

  function clearAiPreview() {
    requestVersion++;
    extracted = null;
    aiButton.disabled = false;
    aiButton.textContent = 'Extract subgroup data with AI';
    aiStatus.hidden = true;
    aiPreview.hidden = true;
  }

  function updateInputLabel() {
    document.getElementById('r-input-label').textContent = mode.value === 'pairs' ? 'Maximum, minimum — one subgroup per line' : 'Range — one subgroup per line';
    document.getElementById('r-hint').textContent = mode.value === 'pairs' ? 'Put the maximum first. Up to 100 subgroups.' : 'One nonnegative range per line. Up to 100 subgroups.';
    input.placeholder = mode.value === 'pairs' ? '4.7, 4.4\n4.8, 4.4\n4.6, 4.4\n4.9, 4.5' : '0.3\n0.4\n0.2\n0.4';
  }

  function setupChoice(name, onChange) {
    const field = document.getElementById(`r-${name}`);
    const trigger = document.getElementById(`r-${name}-trigger`);
    const label = document.getElementById(`r-${name}-value`);
    const list = document.getElementById(`r-${name}-list`);
    const options = [...list.querySelectorAll('[role="option"]')];
    const close = () => { list.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
    const open = () => {
      document.querySelectorAll('.r-choice-list').forEach(other => {
        if (other !== list) { other.hidden = true; other.previousElementSibling?.setAttribute('aria-expanded', 'false'); }
      });
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      (options.find(option => option.dataset.value === field.value) || options[0]).focus();
    };
    const set = (value, notify = false) => {
      const chosen = options.find(option => option.dataset.value === String(value));
      if (!chosen) return;
      const changed = field.value !== chosen.dataset.value;
      field.value = chosen.dataset.value;
      label.textContent = chosen.textContent;
      options.forEach(option => option.setAttribute('aria-selected', String(option === chosen)));
      if (notify && changed) onChange();
    };
    trigger.addEventListener('click', () => list.hidden ? open() : close());
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); }
      if (event.key === 'Escape') close();
    });
    options.forEach((option, index) => {
      option.addEventListener('click', () => { set(option.dataset.value, true); close(); trigger.focus(); });
      option.addEventListener('keydown', event => {
        if (event.key === 'Escape') { close(); trigger.focus(); return; }
        const next = event.key === 'ArrowDown' ? Math.min(index + 1, options.length - 1)
          : event.key === 'ArrowUp' ? Math.max(index - 1, 0)
            : event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : null;
        if (next !== null) { event.preventDefault(); options[next].focus(); }
      });
    });
    document.addEventListener('click', event => { if (!trigger.parentElement.contains(event.target)) close(); });
    set(field.value);
    return { set, trigger };
  }

  function drawChart(result) {
    const svg = fields.chart;
    svg.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    const add = (name, attributes, label) => {
      const el = document.createElementNS(ns, name);
      Object.entries(attributes).forEach(([key, val]) => el.setAttribute(key, val));
      if (label) el.textContent = label;
      svg.append(el);
      return el;
    };
    const width = 680, height = 235, left = 53, right = 22, top = 16, bottom = 35;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const ceiling = Math.max(result.ucl, ...result.rows.map(row => row.range), 0.01) * 1.14;
    const y = val => top + plotHeight * (1 - val / ceiling);
    const x = index => left + (result.count === 1 ? plotWidth / 2 : index * plotWidth / (result.count - 1));
    for (const [label, val, color] of [['UCL', result.ucl, '#b43c50'], ['CL', result.averageRange, '#4961be'], ['LCL', result.lcl, '#8090a7']]) {
      add('line', { x1: left, x2: width - right, y1: y(val), y2: y(val), stroke: color, 'stroke-width': 1.5, 'stroke-dasharray': label === 'CL' ? '0' : '5 4' });
      add('text', { x: 5, y: y(val) + 4, fill: color, 'font-size': 11, 'font-weight': 700 }, label);
    }
    const points = result.rows.map((row, index) => `${x(index)},${y(row.range)}`).join(' ');
    if (result.count > 1) add('polyline', { points, fill: 'none', stroke: '#172952', 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
    result.rows.forEach((row, index) => {
      const out = row.range > result.ucl || row.range < result.lcl;
      const point = add('circle', { cx: x(index), cy: y(row.range), r: 4.5, fill: out ? '#b43c50' : '#172952' });
      const title = document.createElementNS(ns, 'title');
      title.textContent = `Subgroup ${index + 1}: range ${display(row.range)}${out ? ', outside control limits' : ''}`;
      point.append(title);
    });
    add('text', { x: left, y: height - 6, fill: '#667189', 'font-size': 11 }, '1');
    add('text', { x: width - right, y: height - 6, fill: '#667189', 'font-size': 11, 'text-anchor': 'end' }, String(result.count));
  }

  function renderSteps(result) {
    const list = document.getElementById('r-step-range-list');
    list.replaceChildren();
    result.rows.forEach((row, index) => {
      const item = document.createElement('li');
      item.textContent = mode.value === 'pairs'
        ? `R${index + 1} = ${display(row.maximum)} − ${display(row.minimum)} = ${display(row.range)}`
        : `R${index + 1} = ${display(row.range)}`;
      list.append(item);
    });
    document.getElementById('r-step-ranges').textContent = mode.value === 'pairs'
      ? `Subtract the minimum from the maximum in each of the ${result.count} subgroups.`
      : `Use the ${result.count} ranges you entered, one per subgroup.`;
    const total = Number(result.rows.reduce((sum, row) => sum + row.range, 0).toPrecision(15));
    const operands = result.count <= 12
      ? `(${result.rows.map(row => display(row.range)).join(' + ')})`
      : `sum of ${result.count} ranges`;
    document.getElementById('r-step-average').textContent = `R̄ = ${operands} ÷ ${result.count} = ${display(total)} ÷ ${result.count} = ${display(result.averageRange)}`;
    document.getElementById('r-step-factors').textContent = `For ${result.subgroupSize} observations per subgroup and z = 3, D₄ = ${result.d4.toFixed(3)} and D₃ = ${result.d3.toFixed(3)} (${result.factorMethod}${result.subgroupSize > 10 ? '; an s chart is usually preferable for larger subgroups' : ''}).`;
    document.getElementById('r-step-ucl').textContent = `UCL = R̄ × D₄ = ${display(result.averageRange)} × ${result.d4.toFixed(3)} = ${display(result.ucl)}`;
    document.getElementById('r-step-lcl').textContent = `LCL = R̄ × D₃ = ${display(result.averageRange)} × ${result.d3.toFixed(3)} = ${display(result.lcl)}`;
  }

  function render() {
    clearAiPreview();
    try {
      const result = calculateRChart(input.value, Number(size.value), mode.value);
      output.hidden = !result;
      process.hidden = !result;
      detail.hidden = !result;
      error.hidden = true;
      aiTools.hidden = true;
      input.removeAttribute('aria-invalid');
      size.removeAttribute('aria-invalid');
      if (!result) return;
      fields.ucl.textContent = display(result.ucl);
      fields.average.textContent = display(result.averageRange);
      fields.lcl.textContent = display(result.lcl);
      fields.factor.textContent = result.d4.toFixed(3);
      fields.count.textContent = String(result.count);
      fields.formula.textContent = `UCL = R̄ × D₄ = ${display(result.averageRange)} × ${result.d4.toFixed(3)} = ${display(result.ucl)} (≈ ${result.ucl.toFixed(2)} to two decimals)`;
      fields.rows.replaceChildren();
      result.rows.forEach((row, index) => {
        const tr = document.createElement('tr');
        const cells = [String(index + 1), mode.value === 'pairs' ? display(row.maximum) : '—', mode.value === 'pairs' ? display(row.minimum) : '—', display(row.range), row.range > result.ucl || row.range < result.lcl ? 'Outside limits' : 'Within limits'];
        cells.forEach(cell => { const td = document.createElement('td'); td.textContent = cell; tr.append(td); });
        fields.rows.append(tr);
      });
      drawChart(result);
      renderSteps(result);
    } catch (issue) {
      output.hidden = true;
      process.hidden = true;
      detail.hidden = true;
      error.textContent = issue.message;
      error.hidden = false;
      const n = Number(size.value);
      const invalidSize = !Number.isInteger(n) || n < 2 || n > MAX_SUBGROUP_SIZE;
      if (invalidSize) size.setAttribute('aria-invalid', 'true');
      else size.removeAttribute('aria-invalid');
      if (invalidSize) input.removeAttribute('aria-invalid');
      else input.setAttribute('aria-invalid', 'true');
      let structured = false;
      try { structured = Boolean(calculateRChart(input.value, 8, mode.value)); } catch {}
      aiTools.hidden = !input.value.trim() || structured;
    }
  }
  const modeChoice = setupChoice('mode', () => { input.value = ''; updateInputLabel(); render(); });
  input.addEventListener('input', render);
  size.addEventListener('input', render);
  document.getElementById('r-example').addEventListener('click', () => {
    modeChoice.set('ranges'); size.value = '8';
    input.value = '0.3\n0.4\n0.2\n0.4';
    updateInputLabel();
    render(); input.focus();
  });
  document.getElementById('r-clear').addEventListener('click', () => { input.value = ''; render(); input.focus(); });
  aiButton.addEventListener('click', async () => {
    const source = input.value;
    if (source.length > 5000) {
      aiStatus.textContent = 'AI can read up to 5,000 characters at a time.';
      aiStatus.hidden = false;
      return;
    }
    const version = ++requestVersion;
    aiButton.disabled = true;
    aiButton.textContent = 'Reading…';
    aiStatus.textContent = 'Extracting subgroup data with Cloudflare AI…';
    aiStatus.hidden = false;
    aiPreview.hidden = true;
    try {
      const response = await fetch('/api/r-chart-parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: source }),
      });
      const data = await response.json().catch(() => ({ error: 'AI extraction needs the Cloudflare Worker; this static preview shows the calculator only.' }));
      if (!response.ok) throw new Error(data.error || 'AI extraction is unavailable right now.');
      if (version !== requestVersion) return;
      extracted = data.extraction;
      document.getElementById('r-ai-values').textContent = extracted.rows.join('\n');
      document.getElementById('r-ai-note').textContent = (extracted.note ? `${extracted.note} ` : '') +
        (extracted.subgroupSize ? `Subgroup size n = ${extracted.subgroupSize}.` : 'Subgroup size n was not stated. Choose it before calculating UCL.');
      aiPreview.hidden = false;
      aiStatus.hidden = true;
    } catch (issue) {
      if (version !== requestVersion) return;
      aiStatus.textContent = issue.message;
      aiStatus.hidden = false;
    } finally {
      if (version === requestVersion) {
        aiButton.disabled = false;
        aiButton.textContent = 'Extract subgroup data with AI';
      }
    }
  });
  aiApply.addEventListener('click', () => {
    if (!extracted) return;
    modeChoice.set(extracted.mode);
    size.value = extracted.subgroupSize;
    input.value = extracted.rows.join('\n');
    updateInputLabel();
    render();
    (size.value ? input : size).focus();
  });
  render();
}
