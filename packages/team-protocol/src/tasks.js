//! Task engine — create, query, update, and resolve `.ai-team/tasks/*.json`.
//!
//! Every task is one JSON file keyed by a stable `task-xxx` ID. The engine
//! handles dependency resolution (what can be started now), priority sorting,
//! and status transitions. All mutations write atomically so the desktop
//! orchestrator's file watcher hears about changes.

import { readdirSync, renameSync } from 'node:fs';
import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tasksDir } from './paths.js';

// ---------------------------------------------------------------------------
// Schema & types
// ---------------------------------------------------------------------------

const VALID_STATUSES = new Set([
  'planned', 'queued', 'assigned', 'working', 'blocked',
  'review', 'approved', 'rejected', 'completed', 'cancelled',
]);

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'critical']);

export const TASK_TEMPLATE = {
  id: '',
  title: '',
  description: '',
  assignee: null,
  status: 'planned',
  priority: 'medium',
  dependencies: [],
  blockedBy: [],
  files: [],
  branch: null,
  createdBy: 'orchestrator',
  createdAt: '',
  updatedAt: '',
};

export function validateTask(task) {
  if (typeof task.id !== 'string' || !task.id) return 'id is required';
  if (task.status && !VALID_STATUSES.has(task.status)) {
    return `invalid status "${task.status}"; expected one of ${[...VALID_STATUSES].join(', ')}`;
  }
  if (task.priority && !VALID_PRIORITIES.has(task.priority)) {
    return `invalid priority "${task.priority}"`;
  }
  if (task.dependencies && !Array.isArray(task.dependencies)) return 'dependencies must be an array';
  if (task.blockedBy && !Array.isArray(task.blockedBy)) return 'blockedBy must be an array';
  return null;
}

/** Generate a stable numeric task ID from the next available index. */
export function generateTaskId(root) {
  const dir = tasksDir(root);
  let max = 0;
  try {
    for (const entry of readdirSync(dir)) {
      const match = entry.match(/^task-(\d+)/);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }
  } catch {
    // directory doesn't exist yet
  }
  return `task-${max + 1}`;
}

/** Write a JSON file atomically via tmp + rename. */
async function atomicWrite(dest, data) {
  const tmp = dest + '.tmp';
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(tmp, dest);
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** List all tasks, sorted by id ascending. */
export async function listTasks(root) {
  const dir = tasksDir(root);
  let entries;
  try { entries = (await readdir(dir)).filter(e => e.endsWith('.json')); }
  catch { return []; }
  entries.sort();
  const tasks = [];
  for (const entry of entries) {
    try {
      const raw = await readFile(join(dir, entry), 'utf8');
      tasks.push(JSON.parse(raw));
    } catch {
      // skip malformed files
    }
  }
  return tasks;
}

/** Get a single task by id. Returns null if not found. */
export async function getTask(root, id) {
  const dir = tasksDir(root);
  try {
    const raw = await readFile(join(dir, `${id}.json`), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Create a new task. Returns the created task. */
export async function createTask(root, fields) {
  const now = new Date().toISOString();
  const id = fields.id || generateTaskId(root);
  const task = {
    ...TASK_TEMPLATE,
    id,
    title: fields.title || '',
    description: fields.description || '',
    assignee: fields.assignee || null,
    status: fields.status || 'planned',
    priority: fields.priority || 'medium',
    dependencies: fields.dependencies || [],
    blockedBy: fields.blockedBy || [],
    files: fields.files || [],
    branch: fields.branch || null,
    createdBy: fields.createdBy || 'orchestrator',
    createdAt: now,
    updatedAt: now,
  };

  const err = validateTask(task);
  if (err) throw new Error(`Invalid task: ${err}`);

  const dir = tasksDir(root);
  await mkdir(dir, { recursive: true });
  await atomicWrite(join(dir, `${id}.json`), task);
  return task;
}

/** Update selective fields of a task. Fields set to undefined are ignored. */
export async function updateTask(root, id, fields) {
  const task = await getTask(root, id);
  if (!task) throw new Error(`Task not found: ${id}`);

  const updated = { ...task, ...fields, updatedAt: new Date().toISOString() };

  const err = validateTask(updated);
  if (err) throw new Error(`Invalid task after update: ${err}`);

  const dir = tasksDir(root);
  await atomicWrite(join(dir, `${id}.json`), updated);
  return updated;
}

/** Mark a task as completed (a common shortcut). */
export async function completeTask(root, id) {
  return updateTask(root, id, { status: 'completed' });
}

/** Delete a task file. */
export async function deleteTask(root, id) {
  const dir = tasksDir(root);
  try { await unlink(join(dir, `${id}.json`)); } catch { /* already gone */ }
}

// ---------------------------------------------------------------------------
// Dependency queries
// ---------------------------------------------------------------------------

/** Return tasks whose dependencies are all satisfied (status 'completed'). */
export async function readyTasks(root) {
  const tasks = await listTasks(root);
  const completed = new Set(tasks.filter(t => t.status === 'completed').map(t => t.id));
  return tasks.filter(t =>
    t.status !== 'completed' &&
    t.status !== 'cancelled' &&
    (t.dependencies || []).every(dep => completed.has(dep)),
  );
}

/** Return task ids that block the given task. */
export function blockersOf(tasks, id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return [];
  return (task.blockedBy || []).filter(bId => {
    const b = tasks.find(t => t.id === bId);
    return b && b.status !== 'completed' && b.status !== 'cancelled';
  });
}

/** Build a dependency graph. */
export function dependencyGraph(tasks) {
  const graph = {};
  for (const t of tasks) {
    graph[t.id] = {
      task: t,
      dependsOn: t.dependencies || [],
      blockedBy: t.blockedBy || [],
    };
  }
  return graph;
}

/** Topological sort by dependencies. Tasks with no deps come first. */
export function sortedByDependency(tasks) {
  const graph = dependencyGraph(tasks);
  const visited = new Set();
  const result = [];
  function visit(id) {
    if (visited.has(id)) return;
    visited.add(id);
    const node = graph[id];
    if (node) for (const dep of node.dependsOn) visit(dep);
    result.push(id);
  }
  for (const t of tasks) visit(t.id);
  return result.map(id => graph[id]?.task).filter(Boolean);
}