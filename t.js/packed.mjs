import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serveSite } from '../scripts/webdyne-local.mjs';

const tarball = resolve(process.argv[2]);
const root = await mkdtemp(join(tmpdir(), 'browser-consumer-'));
const repo = join(root, 'app');
const remote = join(root, 'remote.git');
await mkdir(join(repo, 'app'), { recursive: true });
const run = (command, args, cwd = repo) => execFileSync(command, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
let server;
let browser;
try {
  await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'browser-packed-test', private: true, dependencies: {
    '@webdyne/webdyne-zeroperl-browser': `file:${tarball}`, '@webdyne/webdyne-zeroperl': '1.0.9',
  } }));
  await writeFile(join(repo, 'app/app.psp'), '<start_html title="Packed consumer"><h1 id="result">Perl <? 6 * 7 ?></h1>');
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  run('npx', ['--no-install', 'webdyne-browser', 'init']);
  run('npm', ['run', 'build']);
  assert.equal(JSON.parse(await readFile(join(repo, 'htdocs/manifest.json'), 'utf8')).generator, '@webdyne/webdyne-zeroperl-browser');
  await writeFile(join(repo, 'htdocs/stale.txt'), 'old output');
  run('npm', ['run', 'build']);
  await assert.rejects(readFile(join(repo, 'htdocs/stale.txt')), { code: 'ENOENT' });
  const previous = await readFile(join(repo, 'htdocs/manifest.json'), 'utf8');
  await rm(join(repo, 'app/app.psp'));
  assert.throws(() => run('npm', ['run', 'build']));
  assert.equal(await readFile(join(repo, 'htdocs/manifest.json'), 'utf8'), previous);
  await writeFile(join(repo, 'app/app.psp'), '<start_html title="Packed consumer"><h1 id="result">Perl <? 6 * 7 ?></h1>');
  server = await serveSite(repo, 0);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/htdocs/`);
  await page.waitForSelector('#result', { timeout: 90000 });
  assert.equal(await page.locator('#result').textContent(), 'Perl 42');
  await browser.close(); browser = null;
  await new Promise(done => server.close(done)); server = null;
  run('git', ['init', '--initial-branch=main']);
  run('git', ['config', 'user.name', 'Browser test']);
  run('git', ['config', 'user.email', 'browser-test@example.invalid']);
  run('git', ['add', 'package.json', 'package-lock.json', '.gitignore', 'app']);
  run('git', ['commit', '-m', 'Consumer fixture']);
  run('git', ['init', '--bare', '--initial-branch=main', remote]);
  run('git', ['remote', 'add', 'origin', remote]);
  const head = run('git', ['rev-parse', 'HEAD']);
  run('npm', ['run', 'gh-pages']);
  assert.equal(run('git', ['rev-parse', 'HEAD']), head);
  assert.equal(run('git', ['branch', '--show-current']).trim(), 'main');
  const deployed = run('git', ['--git-dir', remote, 'ls-tree', '-r', '--name-only', 'gh-pages']);
  assert.ok(deployed.includes('.nojekyll'));
  assert.ok(deployed.includes('runtime.wasm'));
  assert.ok(!deployed.includes('package.json'));
  const first = run('git', ['--git-dir', remote, 'rev-parse', 'gh-pages']).trim();
  await writeFile(join(repo, 'app/app.psp'), '<start_html title="Updated"><h1>Updated page</h1>');
  run('npm', ['run', 'gh-pages']);
  assert.equal(run('git', ['--git-dir', remote, 'rev-parse', 'gh-pages^']).trim(), first);
  console.log('PASS: packed install, single PSP -> htdocs, browser rendering, gh-pages creation/update and source branch preservation');
} finally {
  await browser?.close();
  if (server) await new Promise(done => server.close(done));
  await rm(root, { recursive: true, force: true });
}
