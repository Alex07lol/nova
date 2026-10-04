//! Durable decision registry — `.ai-team/decisions/*.md`.
//!
//! Decisions record why something was done a particular way. Unlike events
//! (transient) or tasks (ephemeral), decisions are permanent reference docs.

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { decisionsDir } from './paths.js';
import { randomUUID } from 'node:crypto';

/** List all decisions (filenames), newest first. */
export async function listDecisions(root) {
  const dir = decisionsDir(root);
  let entries;
  try { entries = await readdir(dir); }
  catch { return []; }
  return entries.filter(e => e.endsWith('.md')).sort().reverse();
}

/** Record a new decision. Returns the filename. */
export async function recordDecision(root, title, body, author) {
  const dir = decisionsDir(root);
  await mkdir(dir, { recursive: true });
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const id = randomUUID().slice(0, 6);
  const filename = `${slug}-${id}.md`;
  const content = [
    `# ${title}`,
    '',
    `**Date:** ${new Date().toISOString()}`,
    `**Author:** ${author || 'orchestrator'}`,
    '',
    body,
    '',
  ].join('\n');
  const dest = join(dir, filename);
  const tmp = dest + '.tmp';
  await writeFile(tmp, content, 'utf8');
  renameSync(tmp, dest);
  return filename;
}

/** Get a decision by filename. */
export async function getDecision(root, filename) {
  try {
    const content = await readFile(join(decisionsDir(root), filename), 'utf8');
    return content;
  } catch {
    return null;
  }
}