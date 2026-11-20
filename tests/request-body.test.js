import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonBody, readRequestBody } from '../supabase/functions/_shared/request.js';

const makeRequest = (body, headers = {}) => new Request('https://local.test/function', {
  method: 'POST',
  headers,
  body,
});

test('bounded JSON reader accepts a small object', async () => {
  const result = await readJsonBody(makeRequest('{"action":"list"}'), 128);
  assert.deepEqual(result, { ok: true, value: { action: 'list' } });
});

test('bounded JSON reader rejects malformed and non-object JSON', async () => {
  const malformed = await readJsonBody(makeRequest('{'), 128);
  const array = await readJsonBody(makeRequest('[]'), 128);
  assert.equal(malformed.ok, false);
  assert.equal(malformed.status, 400);
  assert.equal(array.ok, false);
  assert.equal(array.status, 400);
});

test('bounded request reader rejects oversized declared and streamed bodies', async () => {
  const declared = await readRequestBody(makeRequest('x', { 'Content-Length': '9' }), 8);
  const streamedRequest = new Request('https://local.test/function', {
    method: 'POST',
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('123456'));
        controller.close();
      },
    }),
    duplex: 'half',
  });
  const streamed = await readRequestBody(streamedRequest, 5);
  assert.equal(declared.status, 413);
  assert.equal(streamed.status, 413);
});
