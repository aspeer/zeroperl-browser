#!/usr/bin/env node
import { build as bundle } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { initialize } from './initialize.mjs';
import { publishPages } from './publish-pages.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

export function inside(root, target) {
  const path = relative(root, target);
  return path !== '..' && !path.startsWith(`..${sep}`) && !path.startsWith(sep);
}

async function checkParents(root, target) {
  let parent = target;
  while (true) {
    try {
      if (!inside(root, await realpath(parent))) throw Error('Generated path symlink escapes project');
      return;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const next = dirname(parent);
      if (next === parent) throw error;
      parent = next;
    }
  }
}

export function parseOptions(args) {
  const command = args.shift() ?? 'build';
  if (!['init', 'build', 'dev', 'serve', 'gh-pages'].includes(command)) throw Error('Usage: webdyne-browser init|build|dev|serve|gh-pages [--project DIR] [--output DIR] [--runtime PACKAGE] [--port NUMBER]');
  const options = { command, project: '.', output: 'htdocs', remote: 'origin', runtime: '@webdyne/webdyne-zeroperl', port: 4173 };
  while (args.length) {
    const name = args.shift();
    if (!['--project', '--output', '--runtime', '--port', '--remote'].includes(name) || !args.length) throw Error(`Invalid option ${name}`);
    options[name.slice(2)] = args.shift();
  }
  options.port = Number(options.port);
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw Error('Invalid port');
  return options;
}

export async function buildSite(options) {
  const root = await realpath(resolve(options.project));
  const project = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const config = project.webdyne ?? {};
  if (Object.keys(config.extensions ?? {}).length) throw Error('Browser extensions are not supported yet; use a local project configuration without Cloudflare extensions.');
  const destination = resolve(root, options.output);
  let output = destination;
  const app = await realpath(resolve(root, config.appDirectory ?? 'app'));
  if (!inside(root, app) || !inside(root, output) || output === root || inside(app, output) || inside(output, app)) throw Error('Output must be inside the project and separate from the application tree');
  await checkParents(root, output);
  await checkParents(root, resolve(root, '.webdyne-local'));
  // Refuse an existing directory owned by the application or another tool.
  try {
    await stat(output);
    const previous = JSON.parse(await readFile(resolve(output, 'manifest.json'), 'utf8'));
    if (!['@webdyne/webdyne-zeroperl-local', '@webdyne/webdyne-zeroperl-browser'].includes(previous.generator)) throw Error('Unrecognized output');
    if (!inside(root, await realpath(output))) throw Error('Output symlink escapes project');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try { await stat(output); throw Error('Existing output directory is not owned by webdyne-local'); }
    catch (missing) { if (missing.code !== 'ENOENT') throw missing; }
  }
  const require = createRequire(resolve(root, 'package.json'));
  const runtimeEntry = require.resolve(`${options.runtime}/runtime`);
  const runtimeRoot = resolve(dirname(runtimeEntry), '../..');
  const runtimePackage = JSON.parse(await readFile(resolve(runtimeRoot, 'package.json'), 'utf8'));
  const workspace = resolve(root, '.webdyne-local');
  await mkdir(resolve(workspace, 'no-public-assets'), { recursive: true });
  // An empty external-assets directory makes the upstream builder retain the
  // complete app in its archive, including CSS/JS otherwise served by Wrangler.
  execFileSync(process.execPath, [resolve(runtimeRoot, 'scripts/webdyne-cloudflare.mjs'), 'build',
    '--output', '.webdyne-local/archive', '--', '--assets', '.webdyne-local/no-public-assets'], { cwd: root, stdio: 'inherit' });
  const staging = await mkdtemp(resolve(workspace, 'site-'));
  output = resolve(staging, 'output');
  await mkdir(output);
  try {
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ generator: '@webdyne/webdyne-zeroperl-browser', incomplete: true }));
    const files = ['runtime.wasm', 'app-vfs.tar.gz', 'perl-lib-vfs.tar.gz', 'shell.js', 'perl-worker.js', 'index.html'];
    await cp(require.resolve(`${options.runtime}/zeroperl.wasm`), resolve(output, 'runtime.wasm'));
    for (const name of ['app-vfs.tar.gz', 'perl-lib-vfs.tar.gz']) await cp(resolve(workspace, 'archive', name), resolve(output, name));
    const bindings = { WEBDYNE_INDEX: config.entry ?? 'app.psp', WEBDYNE_STATIC: '1' };
    for (const [phase, callback] of Object.entries(config.lifespan ?? {})) bindings[`WEBDYNE_${phase.toUpperCase()}`] = callback;
    const browserConfig = { entry: config.entry ?? 'app.psp', bindings };
    const common = { bundle: true, platform: 'browser', target: 'es2022', format: 'esm', legalComments: 'eof',
      external: ['node:fs/promises'], loader: { '.pl': 'text', '.pm': 'text' }, define: { LOCAL_CONFIG: JSON.stringify(browserConfig) } };
    await bundle({ ...common, entryPoints: [resolve(packageRoot, 'browser/perl-worker.js')], outfile: resolve(output, 'perl-worker.js'),
      alias: { '@webdyne-runtime': runtimeEntry } });
    await bundle({ ...common, entryPoints: [resolve(packageRoot, 'browser/shell.js')], outfile: resolve(output, 'shell.js') });
    await writeFile(resolve(output, 'index.html'), '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading WebDyne</title></head><body><div id="webdyne-status" role="status">Loading local Perl runtime…</div><main id="webdyne-page"></main><script type="module" src="./shell.js"></script></body></html>\n');
    const digest = createHash('sha256');
    for (const name of files) digest.update(await readFile(resolve(output, name)));
    digest.update(await readFile(resolve(packageRoot, 'browser/service-worker.js')));
    digest.update(await readFile(resolve(packageRoot, 'browser/channel.js')));
    const version = digest.digest('hex').slice(0, 20);
    await bundle({ ...common, entryPoints: [resolve(packageRoot, 'browser/service-worker.js')], outfile: resolve(output, 'service-worker.js'),
      define: { ...common.define, CACHE_VERSION: JSON.stringify(version), CACHE_FILES: JSON.stringify(files) } });
    await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ generator: '@webdyne/webdyne-zeroperl-browser', version,
      runtime: { name: runtimePackage.name, version: runtimePackage.version }, ...browserConfig, files: [...files, 'service-worker.js'] }, null, 2) + '\n');
    await writeFile(resolve(output, '.nojekyll'), '');
    for (const name of ['THIRD-PARTY-NOTICES.md', 'THIRD-PARTY-LICENSES.txt']) {
      try { await cp(resolve(runtimeRoot, name), resolve(output, name)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const localRequire = createRequire(import.meta.url);
    const htmxRoot = dirname(localRequire.resolve('htmx.org/package.json'));
    await cp(resolve(htmxRoot, 'LICENSE'), resolve(output, 'HTMX-LICENSE.txt'));
    // Finish the new tree before replacing the owned output. A failed build
    // leaves the previous distribution intact and successful builds drop stale files.
    const previous = resolve(staging, 'previous');
    let moved = false;
    await mkdir(dirname(destination), { recursive: true });
    try { await rename(destination, previous); moved = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await rename(output, destination); }
    catch (error) { if (moved) await rename(previous, destination); throw error; }
    console.log(`Built browser site: ${destination}`);
    return destination;
  } finally { await rm(staging, { recursive: true, force: true }); }
}

export async function serveSite(directory, port) {
  const root = await realpath(directory);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.gz': 'application/gzip', '.css': 'text/css' };
  const server = createServer(async (request, response) => {
    try {
      const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      let filename = resolve(root, `.${path}`);
      if (!inside(root, filename)) throw Error('Outside root');
      if ((await stat(filename)).isDirectory()) filename = resolve(filename, 'index.html');
      if (!inside(root, await realpath(filename))) throw Error('Outside root');
      const bytes = await readFile(filename);
      response.writeHead(200, { 'content-type': mime[extname(filename)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  console.log(`Browser site: http://127.0.0.1:${server.address().port}/`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  try {
    const options = parseOptions(process.argv.slice(2));
    if (options.command === 'init') {
      await initialize(resolve(options.project), options.output, options.remote);
    } else {
      const output = options.command === 'serve' ? resolve(options.project, options.output) : await buildSite(options);
      if (options.command === 'gh-pages') await publishPages(resolve(options.project), output, options.remote);
      else if (options.command !== 'build') await serveSite(output, options.port);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
