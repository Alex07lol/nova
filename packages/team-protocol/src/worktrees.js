//! Git Worktree Manager for AI Dev Team workers (spec §17).
//!
//! Ensures each worker gets an isolated git worktree and branch so concurrent
//! edits don't conflict in the main working directory.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function createWorktree(projectRoot, workerId, branchName) {
  const root = resolve(projectRoot);
  const worktreesDir = join(root, '.ai-team', 'worktrees');
  const workerWorktreePath = join(worktreesDir, workerId);
  const branch = branchName || `feature/${workerId}`;

  if (existsSync(workerWorktreePath)) {
    return { path: workerWorktreePath, branch };
  }

  try {
    mkdirSync(worktreesDir, { recursive: true });
    execFileSync('git', ['worktree', 'add', '-b', branch, workerWorktreePath], {
      cwd: root,
      stdio: 'pipe',
    });
    return { path: workerWorktreePath, branch };
  } catch (err) {
    throw new Error(`Failed to create worktree for ${workerId}: ${err.message}`);
  }
}

export function removeWorktree(projectRoot, workerId) {
  const root = resolve(projectRoot);
  const workerWorktreePath = join(root, '.ai-team', 'worktrees', workerId);
  if (!existsSync(workerWorktreePath)) return;

  try {
    execFileSync('git', ['worktree', 'remove', '--force', workerWorktreePath], {
      cwd: root,
      stdio: 'pipe',
    });
  } catch {
    // best effort removal
  }
}

export function listWorktrees(projectRoot) {
  const root = resolve(projectRoot);
  let output;
  try {
    output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return [];
  }
  const worktrees = [];
  let current = {};
  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current);
      current = { path: line.slice(9).trim() };
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).trim();
    }
  }
  if (current.path) worktrees.push(current);
  return worktrees;
}
