import test from 'node:test';
import assert from 'node:assert/strict';
import { inside, parseOptions } from '../scripts/webdyne-local.mjs';

test('CLI rejects invalid commands and ports', () => {
  assert.throws(() => parseOptions(['deploy']), /Usage/);
  assert.throws(() => parseOptions(['serve', '--port', '-2']), /Invalid port/);
  assert.throws(() => parseOptions(['build', '--unknown', 'x']), /Invalid option/);
});

test('path containment distinguishes siblings with a common prefix', () => {
  assert.equal(inside('/tmp/site', '/tmp/site/dist'), true);
  assert.equal(inside('/tmp/site', '/tmp/site-copy/dist'), false);
  assert.equal(inside('/tmp/site', '/tmp/other'), false);
});
