import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function discoverTests(root) {
  const result = { commands: [], frameworks: [], source: [] };
  try {
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    if (packageJson.scripts?.test) result.commands.push({ id: 'package-test', command: packageJson.scripts.test, source: 'package.json' });
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const name of ['jest', 'vitest', 'mocha', 'pytest']) if (dependencies[name]) result.frameworks.push(name);
  } catch (error) {
    if (error.code !== 'ENOENT') result.source.push({ warning: 'package.json could not be parsed' });
  }
  for (const candidate of ['test', 'tests', '__tests__']) {
    try { await access(join(root, candidate)); result.source.push(candidate); } catch { /* absent */ }
  }
  return result;
}
