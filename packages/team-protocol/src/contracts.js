//! Shared contract registry — `.ai-team/contracts/*.json|yaml|md`.
//!
//! Contracts are shared public interfaces that workers publish and consume.
//! Unlike messages (transient) or tasks (mutable), contracts are durable
//! reference documents that accumulate over a project's lifetime.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { renameSync } from 'node:fs';
import { join, extname } from 'node:path';
import { contractsDir } from './paths.js';

/** List all contract names. */
export async function listContracts(root) {
  const dir = contractsDir(root);
  let entries;
  try { entries = await readdir(dir); }
  catch { return []; }
  return entries
    .filter(e => e.match(/\.(json|yaml|yml|md)$/))
    .sort();
}

/** Get contract content by filename. Returns { name, ext, content } or null. */
export async function getContract(root, name) {
  const dir = contractsDir(root);
  const supported = ['.json', '.yaml', '.yml', '.md'];
  for (const ext of supported) {
    try {
      const content = await readFile(join(dir, name + ext), 'utf8');
      return { name, ext, content };
    } catch { /* try next */ }
  }
  return null;
}

/** Publish (create or overwrite) a contract. */
export async function publishContract(root, name, content, ext = '.md') {
  const dir = contractsDir(root);
  await mkdir(dir, { recursive: true });
  const dest = join(dir, name + ext);
  const tmp = dest + '.tmp';
  await writeFile(tmp, content, 'utf8');
  renameSync(tmp, dest);
  return { name, ext };
}

/** Delete a contract. */
export async function deleteContract(root, name) {
  const dir = contractsDir(root);
  const supported = ['.json', '.yaml', '.yml', '.md'];
  for (const ext of supported) {
    try {
      const { unlink } = await import('node:fs/promises');
      await unlink(join(dir, name + ext));
    } catch { /* not this ext */ }
  }
}