import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

const directory = resolve(process.argv[2]);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const [packed] = JSON.parse(await readFile(resolve(directory, 'pack.json'), 'utf8'));
if (pkg.name !== '@webdyne/webdyne-zeroperl-browser' || packed.name !== pkg.name || packed.version !== pkg.version ||
    packed.filename !== basename(packed.filename) || !/^\d+\.\d+\.\d+$/.test(pkg.version)) throw Error('Invalid release package identity');
const bytes = await readFile(resolve(directory, packed.filename));
const revision = process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const expected = { package: pkg.name, version: pkg.version, revision, repository: process.env.GITHUB_REPOSITORY ?? null,
  filename: packed.filename, sha256: createHash('sha256').update(bytes).digest('hex') };
const filename = resolve(directory, 'release.json');
if (process.argv.includes('--verify')) {
  const recorded = JSON.parse(await readFile(filename, 'utf8'));
  if (JSON.stringify(recorded) !== JSON.stringify(expected)) throw Error('Candidate does not match this source revision or archive digest');
  if (!pkg.repository?.url || !process.env.GITHUB_REPOSITORY ||
      pkg.repository.url !== `git+https://github.com/${process.env.GITHUB_REPOSITORY}.git`) throw Error('Set package.json repository.url to the actual GitHub repository before staging');
} else await writeFile(filename, JSON.stringify(expected, null, 2) + '\n');
