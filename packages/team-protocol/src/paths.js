//! `.ai-team` path resolution.
//!
//! Everything in the protocol is rooted at `<project>/.ai-team`. Keeping the
//! layout in one place means the CLI and the desktop orchestrator cannot drift.

import { join } from 'node:path';

export const TEAM_DIR = '.ai-team';

/** The full `.ai-team` directory for a project root. */
export function teamPath(root) {
  return join(root, TEAM_DIR);
}

export const PATHS = {
  state: 'state.json',
  objective: 'objective.md',
  architecture: 'architecture.md',
  rules: 'rules.md',
  tasks: 'tasks',
  messages: 'messages',
  contracts: 'contracts',
  decisions: 'decisions',
  events: 'events',
  workerConfig: 'worker-config',
  eventsLog: 'log.jsonl',
};

export function statePath(root) {
  return join(teamPath(root), PATHS.state);
}

export function objectivePath(root) {
  return join(teamPath(root), PATHS.objective);
}

export function tasksDir(root) {
  return join(teamPath(root), PATHS.tasks);
}

export function messagesDir(root) {
  return join(teamPath(root), PATHS.messages);
}

export function contractsDir(root) {
  return join(teamPath(root), PATHS.contracts);
}

export function decisionsDir(root) {
  return join(teamPath(root), PATHS.decisions);
}

export function eventsDir(root) {
  return join(teamPath(root), PATHS.events);
}

export function eventsLogPath(root) {
  return join(eventsDir(root), PATHS.eventsLog);
}

export function workerConfigDir(root) {
  return join(teamPath(root), PATHS.workerConfig);
}