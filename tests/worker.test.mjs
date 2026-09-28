import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { parseModelResponse, parseRChartModelResponse } from '../worker/index.js';

test('AI values must be decimal strings', () => {
  assert.deepEqual(parseModelResponse({ response: '{"numbers":["12.50","-3","0.1"]}' }), ['12.50', '-3', '0.1']);
  assert.throws(() => parseModelResponse({ response: '{"numbers":[12.5]}' }));
  assert.throws(() => parseModelResponse({ response: '{"numbers":["$12"]}' }));
});

test('AI route calls the binding only for a valid explicit request', async () => {
  let calls = 0;
  const env = {
    AI: { run: async (model, options) => {
      calls++;
      assert.equal(model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
      assert.match(options.messages[0].content, /what is 7 plus 6/);
      return { response: '{"numbers":["12.50","-3"]}' };
    } },
    ASSETS: { fetch: async () => new Response('asset') },
  };
  const invalid = await worker.fetch(new Request('https://sumcalculator.net/api/parse', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: '' }),
  }), env);
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);

  const valid = await worker.fetch(new Request('https://sumcalculator.net/api/parse', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: 'Lunch $12.50; refund $3' }),
  }), env);
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { numbers: ['12.50', '-3'] });
  assert.equal(calls, 1);
});

test('free allowance errors leave regular calculation available', async () => {
  const response = await worker.fetch(new Request('https://sumcalculator.net/api/parse', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: '12 dollars' }),
  }), { AI: { run: async () => { throw Object.assign(new Error('daily free allocation'), { status: 429 }); } } });
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /free AI allowance/);
});

test('paid-only model errors are reported instead of hidden as a generic 502', async () => {
  const response = await worker.fetch(new Request('https://sumcalculator.net/api/parse', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input: 'waht is 7 plus 6' }),
  }), { AI: { run: async () => { throw Object.assign(new Error('Model requires Workers Paid plan'), { code: 5035 }); } } });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Free plan/);
});

test('R-chart AI extraction validates proposed rows before they can be applied', () => {
  assert.deepEqual(parseRChartModelResponse({ response: '{"mode":"ranges","rows":["0.3","0.4"],"subgroupSize":"","note":"Two ranges found."}' }), {
    mode: 'ranges', rows: ['0.3', '0.4'], subgroupSize: '', note: 'Two ranges found.',
  });
  assert.throws(() => parseRChartModelResponse({ response: '{"mode":"ranges","rows":["0.3","UCL 0.61"],"subgroupSize":"","note":""}' }));
  assert.throws(() => parseRChartModelResponse({ response: '{"mode":"pairs","rows":["4.4,4.6"],"subgroupSize":"8","note":""}' }));
  assert.equal(parseRChartModelResponse({ response: '{"mode":"ranges","rows":["0.3"],"subgroupSize":"11","note":""}' }).subgroupSize, '11');
  assert.throws(() => parseRChartModelResponse({ response: '{"mode":"ranges","rows":["0.3"],"subgroupSize":"1000001","note":""}' }));
});

test('R-chart text extraction uses the stated average-range operands and does not infer n from UCL', async () => {
  const input = 'sample 3: max = 4.6, min = 4.4 → range = 0.2; sample 4: max = 4.9, min = 4.5 → range = 0.4; rˉ=(0.3+0.4+0.2+0.4)/4=0.325; z=3; UCL=0.61';
  const env = { AI: { run: async (model, options) => {
    assert.equal(model, '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    assert.match(options.messages[0].content, /Do not duplicate values/);
    return { response: '{"mode":"pairs","rows":["4.6,4.4","4.9,4.5"],"subgroupSize":"8","note":"Two pairs found."}' };
  } } };
  const response = await worker.fetch(new Request('https://sumcalculator.net/api/r-chart-parse', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input }),
  }), env);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).extraction, {
    mode: 'ranges', rows: ['0.3', '0.4', '0.2', '0.4'], subgroupSize: '',
    note: 'The complete range list was taken from the average-range expression.',
  });
});

test('R-chart text extraction keeps an explicitly stated subgroup size', async () => {
  const response = await worker.fetch(new Request('https://sumcalculator.net/api/r-chart-parse', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: 'Subgroup size n=5. Sample 1 max 4.6 min 4.4.' }),
  }), { AI: { run: async () => ({ response: '{"mode":"pairs","rows":["4.6,4.4"],"subgroupSize":"5","note":"One subgroup found."}' }) } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).extraction.subgroupSize, '5');
});
