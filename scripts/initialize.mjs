import { readFile, writeFile } from 'node:fs/promises';
import { resolve, basename, relative, isAbsolute } from 'node:path';

export async function initialize(projectRoot, output = 'htdocs', remote = 'origin') {
  const filename = resolve(projectRoot, 'package.json');
  let project;
  try { project = JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; project = { name: basename(projectRoot), private: true }; }
  if (!/^[a-zA-Z0-9_./-]+$/.test(output) || !/^[a-zA-Z0-9_-]+$/.test(remote)) throw Error('Output and remote must be simple paths/names');
  const outputPath = relative(resolve(projectRoot), resolve(projectRoot, output));
  if (!outputPath || outputPath.startsWith('..') || isAbsolute(outputPath)) throw Error('Output must be inside the project');
  project.scripts ??= {};
  const commands = {
    build: `webdyne-browser build --output ${output}`,
    dev: `webdyne-browser dev --output ${output}`,
    'gh-pages': `webdyne-browser gh-pages --output ${output} --remote ${remote}`,
  };
  for (const [key, value] of Object.entries(commands)) {
    const old = project.scripts[key];
    if (old && old !== value) {
      if (!old.startsWith('webdyne-cloudflare ')) throw Error(`Refusing to replace custom npm script: ${key}`);
      const saved = `${key}:cloudflare`;
      if (project.scripts[saved] && project.scripts[saved] !== old) throw Error(`Conflicting npm script: ${saved}`);
      project.scripts[saved] = old;
    }
    project.scripts[key] = value;
  }
  project.webdyne ??= {};
  project.webdyne.appDirectory ??= 'app';
  project.webdyne.entry ??= 'app.psp';
  await writeFile(filename, JSON.stringify(project, null, 2) + '\n');
  const ignorePath = resolve(projectRoot, '.gitignore');
  let ignored = '';
  try { ignored = await readFile(ignorePath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const additions = ['node_modules/', '.webdyne/', '.webdyne-local/', `${output.replace(/\/$/, '')}/`].filter(line => !ignored.split('\n').includes(line));
  if (additions.length) await writeFile(ignorePath, ignored + (ignored && !ignored.endsWith('\n') ? '\n' : '') + additions.join('\n') + '\n');
  console.log(`Configured npm run build, dev and gh-pages in ${projectRoot}`);
}
