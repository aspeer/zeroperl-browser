import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function publishPages(projectRoot, output, remote = 'origin') {
  const root = await realpath(projectRoot);
  const directory = await realpath(resolve(root, output));
  const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
  if (manifest.generator !== '@webdyne/webdyne-zeroperl-browser' || manifest.incomplete) throw Error('Pages requires a completed browser build');
  if (!/^[a-zA-Z0-9_-]+$/.test(remote)) throw Error('Invalid Git remote name');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const destination = git(['remote', 'get-url', '--push', remote]);
  console.log(`Publishing ${directory} to ${destination}, branch gh-pages`);
  const require = createRequire(import.meta.url);
  // gh-pages keeps deployment history and uses a separate temporary checkout.
  execFileSync(process.execPath, [require.resolve('gh-pages/bin/gh-pages.js'), '-d', directory, '-r', destination,
    '-b', 'gh-pages', '--dotfiles'], { cwd: root, stdio: 'inherit' });
}
