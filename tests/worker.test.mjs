import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { parseModelResponse } from '../worker/index.js';

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
