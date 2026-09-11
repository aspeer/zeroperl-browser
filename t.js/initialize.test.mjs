import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialize } from '../scripts/initialize.mjs';

test('init preserves Cloudflare scripts and is idempotent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'browser-init-'));
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'webdyne-cloudflare build', dev: 'webdyne-cloudflare dev' } }));
    await initialize(root);
    const first = await readFile(join(root, 'package.json'), 'utf8');
    const pkg = JSON.parse(first);
    assert.equal(pkg.scripts.build, 'webdyne-browser build --output htdocs');
    assert.equal(pkg.scripts['build:cloudflare'], 'webdyne-cloudflare build');
    assert.match(pkg.scripts['gh-pages'], /--remote origin/);
    await initialize(root);
    assert.equal(await readFile(join(root, 'package.json'), 'utf8'), first);
  } finally { await rm(root, { recursive: true }); }
});

test('init refuses to replace custom scripts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'browser-init-'));
  try {
    const original = '{"scripts":{"build":"custom-build"}}';
    await writeFile(join(root, 'package.json'), original);
    await assert.rejects(initialize(root), /custom npm script/);
    assert.equal(await readFile(join(root, 'package.json'), 'utf8'), original);
  } finally { await rm(root, { recursive: true }); }
});
