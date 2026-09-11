#!/usr/bin/env node
import { mkdir, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Copy only application inputs, never the original project's build tooling.
const source = resolve(process.argv[2] ?? fileURLToPath(new URL('../../psp-WebDyne-Fortune/', import.meta.url)));
const target = fileURLToPath(new URL('../examples/fortune/app/', import.meta.url));
await mkdir(target, { recursive: true });
for (const name of ['app.psp', 'app_reload.psp', 'app.pm', 'app.css', 'perl', 'perl.dat', 'perl.u8']) {
  await cp(resolve(source, name), resolve(target, name));
}
await cp(resolve(source, 'LICENSE'), resolve(target, 'FORTUNE-APP-LICENSE.txt'));
console.log(`Copied unchanged Fortune application from ${source}`);
