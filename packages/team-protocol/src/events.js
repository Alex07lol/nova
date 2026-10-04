//! Activity event log — `.ai-team/events/log.jsonl`.
//!
//! Every significant action (task created, message sent, worker started)
//! produces one JSONL line. The desktop orchestrator tails this file for
//! live activity feed updates.

import { mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { eventsLogPath, eventsDir } from './paths.js';
import { randomUUID } from 'node:crypto';

const VALID_EVENT_TYPES = new Set([
  'WORKER_STARTED', 'WORKER_STOPPED', 'WORKER_ERROR', 'WORKER_BLOCKED',
  'TASK_CREATED', 'TASK_ASSIGNED', 'TASK_STARTED', 'TASK_COMPLETED',
  'MESSAGE_SENT', 'MESSAGE_RECEIVED',
  'CONTRACT_CHANGED',
  'COMMIT_CREATED',
  'REVIEW_REQUESTED', 'REVIEW_APPROVED', 'REVIEW_REJECTED',
  'MERGE_COMPLETED', 'MERGE_CONFLICT',
  'TEST_FAILED', 'TEST_PASSED',
  'PROJECT_INITIALIZED', 'PROJECT_OPENED', 'OBJECTIVE_UPDATED',
  'WORKER_ADDED', 'WORKER_EXITED', 'WORKER_REMOVED',
  'LEAD_ASSIGNED',
]);

/**
 * Derive a human-readable summary line from a structured payload. The desktop
 * activity feed renders `summary`; programmatic consumers read `payload`.
 */
function summarize(payload) {
  if (typeof payload.summary === 'string' && payload.summary) return payload.summary;
  const parts = [];
  if (payload.taskId) parts.push(payload.title ? `${payload.taskId} (${payload.title})` : payload.taskId);
  if (payload.to) parts.push(`to ${payload.to}`);
  if (payload.messageId) parts.push(payload.messageId);
  if (payload.contract) parts.push(`"${payload.contract}"`);
  if (payload.name && !payload.taskId) parts.push(payload.name);
  if (!parts.length) {
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string' || typeof value === 'number') parts.push(`${key}=${value}`);
    }
  }
  return parts.join(' ');
}

/** Append an event to the JSONL log. */
export function appendEvent(root, type, actor, payload = {}, summary) {
  const event = {
    id: `evt_${randomUUID().slice(0, 8)}`,
    type,
    actor: actor || 'orchestrator',
    summary: summary || summarize(payload),
    payload,
    timestamp: new Date().toISOString(),
  };
  const path = eventsLogPath(root);
  try {
    mkdirSync(eventsDir(root), { recursive: true });
    appendFileSync(path, JSON.stringify(event) + '\n', 'utf8');
  } catch {
    // best effort: if the directory is unwritable, skip
  }
  return event;
}

/** Return the most recent events, oldest first. */
export function recentEvents(root, limit = 200) {
  const path = eventsLogPath(root);
  let lines;
  try { lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean); }
  catch { return []; }
  const events = lines
    .slice(-limit)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
  return events;
}

/** Return events filtered by type(s). */
export function eventsByType(root, types, limit = 100) {
  const typeSet = Array.isArray(types) ? new Set(types) : new Set([types]);
  return recentEvents(root, limit * 10).filter(e => typeSet.has(e.type)).slice(-limit);
}

/** Return events for a specific actor. */
export function eventsByActor(root, actor, limit = 100) {
  return recentEvents(root, limit * 10).filter(e => e.actor === actor).slice(-limit);
}