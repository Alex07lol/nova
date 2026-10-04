import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { createTextDiff } from './text-diff.js';

function safePath(root, requestedPath) {
  if (!requestedPath || typeof requestedPath !== 'string') throw new Error('A workspace-relative path is required');
  const target = resolve(root, requestedPath);
  const rel = relative(root, target);
  if (isAbsolute(rel) || rel.startsWith('..')) {
    const error = new Error(`Path escapes workspace: ${requestedPath}`);
    error.code = 'PATH_OUTSIDE_WORKSPACE';
    throw error;
  }
  return rel;
}

export function createFilesystemMutationTool({ root, policy, approval, events }) {
  async function authorize(path, operation, diff) {
    const permission = policy.evaluate('filesystem.write');
    const decision = permission.allowed
      ? { approved: true, scope: 'policy' }
      : await approval?.request('filesystem.write', { path, operation, diff }) || { approved: false };
    policy.assert('filesystem.write', { approved: decision.approved });
  }

  async function atomicWrite(path, content) {
    const absolute = resolve(root, path);
    await mkdir(dirname(absolute), { recursive: true });
    const temporary = `${absolute}.nova-tmp`;
    await writeFile(temporary, content, 'utf8');
    await rename(temporary, absolute);
  }

  return {
    name: 'filesystem.write',
    async write({ path, content }) {
      const safe = safePath(root, path);
      const before = await readFile(resolve(root, safe), 'utf8').catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
      const diff = createTextDiff(safe, before, content);
      await authorize(safe, 'write', diff);
      await atomicWrite(safe, content);
      events?.publish('tool.completed', { tool: 'filesystem.write', path: safe, operation: 'write' });
      return { path: safe, before, after: content, changed: before !== content, diff };
    },
    async edit({ path, find, replace, expectedMatches = 1 }) {
      const safe = safePath(root, path);
      if (!find) throw new Error('Exact edit requires find text');
      const before = await readFile(resolve(root, safe), 'utf8');
      const matches = before.split(find).length - 1;
      if (matches !== expectedMatches) {
        const error = new Error(`Expected ${expectedMatches} matches in ${safe}, found ${matches}`);
        error.code = 'EDIT_MATCH_COUNT';
        throw error;
      }
      const after = before.replace(find, replace);
      const diff = createTextDiff(safe, before, after);
      await authorize(safe, 'edit', diff);
      await atomicWrite(safe, after);
      events?.publish('tool.completed', { tool: 'filesystem.write', path: safe, operation: 'edit' });
      return { path: safe, before, after, changed: before !== after, matches, diff };
    }
  };
}
