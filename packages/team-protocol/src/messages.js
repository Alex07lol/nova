//! Worker-to-worker message protocol — `.ai-team/messages/`.
//!
//! Each message is one JSON file. Messages are immutable after creation;
//! only their status field may be toggled (unread → read).

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { messagesDir } from './paths.js';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const VALID_TYPES = new Set([
  'question', 'answer', 'notification', 'blocker',
  'handoff', 'review_request', 'contract_change', 'completion',
]);

const VALID_STATUSES = new Set(['unread', 'read']);

export function validateMessage(msg) {
  if (!msg.id) return 'id is required';
  if (!msg.from) return '"from" is required';
  if (msg.type && !VALID_TYPES.has(msg.type)) {
    return `invalid type "${msg.type}"`;
  }
  if (msg.status && !VALID_STATUSES.has(msg.status)) {
    return 'status must be "unread" or "read"';
  }
  return null;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** List all messages, newest first. */
export async function listMessages(root) {
  const dir = messagesDir(root);
  let entries;
  try { entries = (await readdir(dir)).filter(e => e.endsWith('.json')); }
  catch { return []; }
  entries.sort().reverse();
  const messages = [];
  for (const entry of entries) {
    try {
      const raw = await readFile(join(dir, entry), 'utf8');
      messages.push(JSON.parse(raw));
    } catch { /* skip malformed */ }
  }
  return messages;
}

/** List messages addressed to a specific worker, newest first. */
export async function inbox(root, workerId) {
  const messages = await listMessages(root);
  return messages.filter(m =>
    m.to === workerId || m.to === '*' || !m.to,
  );
}

/** Get a single message by id. */
export async function getMessage(root, id) {
  const dir = messagesDir(root);
  try {
    const raw = await readFile(join(dir, `${id}.json`), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

/** Send a new message. Returns the created message. */
export async function sendMessage(root, fields) {
  const now = new Date().toISOString();
  const id = `msg_${randomUUID().slice(0, 8)}`;
  const msg = {
    id,
    from: fields.from || 'unknown',
    to: fields.to || '*',
    type: fields.type || 'notification',
    subject: fields.subject || '',
    body: fields.body || '',
    taskId: fields.taskId || null,
    createdAt: now,
    status: 'unread',
  };

  const err = validateMessage(msg);
  if (err) throw new Error(`Invalid message: ${err}`);

  const dir = messagesDir(root);
  await mkdir(dir, { recursive: true });
  const tmp = join(dir, `${id}.json.tmp`);
  const dest = join(dir, `${id}.json`);
  await writeFile(tmp, JSON.stringify(msg, null, 2) + '\n', 'utf8');
  renameSync(tmp, dest);
  return msg;
}

/** Mark a message as read. */
export async function markRead(root, id) {
  const dir = messagesDir(root);
  const dest = join(dir, `${id}.json`);
  try {
    const raw = await readFile(dest, 'utf8');
    const msg = JSON.parse(raw);
    msg.status = 'read';
    const tmp = dest + '.tmp';
    await writeFile(tmp, JSON.stringify(msg, null, 2) + '\n', 'utf8');
    renameSync(tmp, dest);
    return msg;
  } catch { throw new Error(`Message not found: ${id}`); }
}
