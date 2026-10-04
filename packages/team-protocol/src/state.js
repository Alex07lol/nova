//! Orchestrator state management — `.ai-team/state.json` + markdown files.
//!
//! State is the single-file index for the UI: workers, lead ID, objective,
//! and project metadata. It is updated alongside individual task/message mutations.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { teamPath, statePath, objectivePath, PATHS } from './paths.js';

export function isInitialized(root) {
  return existsSync(statePath(root));
}

export const DEFAULT_STATE = {
  version: 1,
  project: { name: '', path: '' },
  objective: '',
  leadId: null,
  workers: [],
};

/** Initialize `.ai-team` with full directory structure. Idempotent. */
export async function init(root, projectName = 'project') {
  const team = teamPath(root);
  const dirs = [
    PATHS.tasks, PATHS.messages, PATHS.contracts,
    PATHS.decisions, PATHS.events, PATHS.workerConfig,
  ];
  for (const dir of dirs) {
    await mkdir(join(team, dir), { recursive: true });
  }

  if (!isInitialized(root)) {
    const state = {
      ...DEFAULT_STATE,
      project: { name: projectName, path: root },
    };
    await saveState(root, state);

    await writeIfMissing(
      objectivePath(root),
      '# Project Objective\n\n(one gigantic project prompt — the shared goal for the team)\n',
    );
    await writeIfMissing(
      join(team, PATHS.architecture),
      '# Architecture\n\n(shared architecture notes live here)\n',
    );
    await writeIfMissing(
      join(team, PATHS.rules),
      '# Project Rules\n\n- (rules every team member must follow)\n',
    );
    await writeIfMissing(
      join(team, PATHS.events, PATHS.eventsLog),
      '',
    );
  }

  return loadState(root);
}

/** Load `state.json`. Throws if not initialized. */
export async function loadState(root) {
  const path = statePath(root);
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('NOT_INITIALIZED');
    throw err;
  }
}

/** Save `state.json` atomically. */
export async function saveState(root, state) {
  const path = statePath(root);
  await mkdir(teamPath(root), { recursive: true });
  const tmp = path + '.tmp';
  await writeFile(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  renameSync(tmp, path);
}

/** Read `objective.md`. */
export async function readObjective(root) {
  try {
    return await readFile(objectivePath(root), 'utf8');
  } catch {
    return '';
  }
}

/** Write `objective.md` and keep `state.json` in sync. */
export async function writeObjective(root, content) {
  await mkdir(teamPath(root), { recursive: true });
  await writeFile(objectivePath(root), content, 'utf8');
  // Also sync into state.json if present
  try {
    const state = await loadState(root);
    state.objective = content;
    await saveState(root, state);
  } catch { /* not initialized yet */ }
}

async function writeIfMissing(path, content) {
  if (!existsSync(path)) {
    await writeFile(path, content, 'utf8');
  }
}