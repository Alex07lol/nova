import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { discoverTests } from './project-test-discovery.js';

const IGNORED = new Set(['.git', 'node_modules', '.nova', 'coverage']);

export async function detectWorkspace(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;
    if (entry.isFile()) files.push(relative(root, join(root, entry.name)));
  }
  return { root, files: files.sort(), fileCount: files.length, tests: await discoverTests(root) };
}

export async function readWorkspaceFile(root, path) {
  return readFile(join(root, path), 'utf8');
}
