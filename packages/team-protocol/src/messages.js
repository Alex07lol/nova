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

/**
 * List messages addressed to a specific worker, newest first — plus the
 * ancestor chain of every reply, so callers can render the same thread
 * structure the desktop shows. Ancestors may be addressed to someone else;
 * without them a reply would print with nothing to indent it under.
 */
export async function inbox(root, workerId) {
  const messages = await listMessages(root);
  const byId = new Map(messages.map(m => [m.id, m]));
  const included = new Set();
  for (const m of messages) {
    if (m.to !== workerId && m.to !== '*' && m.to) continue;
    included.add(m.id);
    let current = m;
    const seen = new Set([m.id]);
    while (current.replyTo && !seen.has(current.replyTo)) {
      const parent = byId.get(current.replyTo);
      if (!parent) break;
      seen.add(parent.id);
      included.add(parent.id);
      current = parent;
    }
  }
  return messages.filter(m => included.has(m.id));
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
  // A reply must name a real message — a typo'd id would otherwise look
  // like a brand-new thread. Replying also marks the target read, exactly
  // like the desktop composer's `messages_send` does.
  let replyTo = null;
  if (fields.replyTo) {
    const target = await getMessage(root, fields.replyTo);
    if (!target) throw new Error(`Reply target not found: ${fields.replyTo}`);
    replyTo = fields.replyTo;
  }

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
    replyTo,
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
  if (replyTo) await markRead(root, replyTo);
  return msg;
}

// ---------------------------------------------------------------------------
// Threading
// ---------------------------------------------------------------------------

/** ISO-8601 timestamps compare lexicographically; break ties by id. */
function compareChronological(a, b) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Group messages into threads — the same structure the desktop MESSAGES
 * panel renders, so terminal workers see identical nesting:
 *
 * - every `replyTo` chain resolves up to one root (dangling targets and
 *   cycles cannot loop or throw),
 * - members run oldest first under their root,
 * - threads order by recency of activity, root id breaking ties.
 */
export function groupThreads(messages) {
  const byId = new Map(messages.map(m => [m.id, m]));

  const resolveRootId = (message) => {
    let currentId = message.id;
    const seen = new Set([currentId]);
    for (;;) {
      const parentId = byId.get(currentId)?.replyTo ?? null;
      if (!parentId || !byId.has(parentId) || seen.has(parentId)) return currentId;
      seen.add(parentId);
      currentId = parentId;
    }
  };

  const groups = new Map();
  for (const message of messages) {
    const rootId = resolveRootId(message);
    const bucket = groups.get(rootId);
    if (bucket) bucket.push(message);
    else groups.set(rootId, [message]);
  }

  const threads = [];
  for (const members of groups.values()) {
    members.sort(compareChronological);
    threads.push({
      root: members[0],
      members,
      latestAt: members[members.length - 1].createdAt,
    });
  }
  threads.sort((a, b) => {
    if (a.latestAt !== b.latestAt) return a.latestAt < b.latestAt ? 1 : -1;
    return a.root.id < b.root.id ? -1 : a.root.id > b.root.id ? 1 : 0;
  });
  return threads;
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