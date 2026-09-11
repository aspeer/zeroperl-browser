import test from 'node:test';
import assert from 'node:assert/strict';
import { receiveResponse, sendResponse } from '../browser/channel.js';

test('binary response streams retain status, headers and bytes', async () => {
  const channel = new MessageChannel();
  const response = receiveResponse(channel.port1);
  await sendResponse(channel.port2, async () => new Response(new Uint8Array([0, 128, 255]), { status: 201, headers: { 'x-test': 'yes' } }));
  const result = await response;
  assert.equal(result.status, 201);
  assert.equal(result.headers.get('x-test'), 'yes');
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array([0, 128, 255]));
});

test('stream cancellation reaches the request signal and producer', async () => {
  const channel = new MessageChannel();
  let signal;
  let cancelled;
  const cancellation = new Promise(resolve => { cancelled = resolve; });
  const result = receiveResponse(channel.port1);
  await sendResponse(channel.port2, async value => {
    signal = value;
    return new Response(new ReadableStream({ cancel() { cancelled(); } }));
  });
  await (await result).body.cancel();
  await cancellation;
  assert.equal(signal.aborted, true);
});

test('producer failures propagate rather than hanging', async () => {
  const channel = new MessageChannel();
  const response = receiveResponse(channel.port1);
  const rejected = assert.rejects(response, /test failure/);
  await sendResponse(channel.port2, async () => { throw Error('test failure'); });
  await rejected;
});

test('HEAD and 204 responses preserve a null body', async () => {
  const channel = new MessageChannel();
  const response = receiveResponse(channel.port1);
  await sendResponse(channel.port2, async () => new Response(null, { status: 204 }));
  assert.equal((await response).body, null);
});
