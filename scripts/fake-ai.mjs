#!/usr/bin/env node
/**
 * FakeAI — deterministic fake terminal AI for testing the orchestrator
 * without real AI services (spec §65/§66).
 *
 * Usage:
 *   node scripts/fake-ai.mjs [--role frontend] [--auto] [--exit-code 0]
 *
 * Interactive commands (stdin, one per line):
 *   help                      list commands
 *   status                    print role, cwd, and task state
 *   work [seconds]            simulate work with a progress indicator
 *   write <path> <text...>    write a file into the working directory
 *   complete <task-id>        complete a task (event + .ai-team sync via team CLI)
 *   message <to> <text...>    send a team message (event + .ai-team sync)
 *   fail <text...>            print a failure (exit code stays configurable)
 *   exit [code]               exit with a code (default 0)
 *
 * `--auto` (or FAKE_AI_AUTO=1) runs a canned deterministic script and exits,
 * which makes headless tests trivial. Protocol events are printed as
 * `TEAM:// {json}` lines so tests and tooling can match them exactly.
 *
 * When the working directory has an initialized `.ai-team` protocol directory,
 * `complete` and `message` ALSO call the real `team` CLI so the action lands
 * in the shared protocol (tasks, messages, activity events) where the desktop
 * orchestrator and other workers can see it. Without `.ai-team`, they degrade
 * to the structured stdout events only.
 */

import { spawn as spawnChild } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
function flag(name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return String(args[index + 1] ?? '');
}
const hasFlag = (name) => args.includes(name);

const role = flag('--role') || 'generalist';
const autoExitCode = Number(flag('--exit-code') ?? 0);
const autoMode = hasFlag('--auto') || process.env.FAKE_AI_AUTO === '1';

// The real team CLI (same repo): worker actions are synced into .ai-team/.
const TEAM_CLI = fileURLToPath(new URL('../apps/cli/src/team-cli.js', import.meta.url));
const actor = process.env.TEAM_ACTOR || `fake-${role}`;

const COLORS = {
  cyan: '\u001b[36m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  dim: '\u001b[90m',
  reset: '\u001b[0m',
};
const color = (name, text) => `${COLORS[name]}${text}${COLORS.reset}`;

let taskState = 'idle';
let failed = false;

function emit(type, payload) {
  process.stdout.write(`TEAM:// ${JSON.stringify({ type, role, ...payload })}\n`);
}

/**
 * Run a `team` CLI command against the project in cwd. Resolves to true when
 * the CLI exited 0, i.e. the action landed in .ai-team/.
 */
function runTeamCommand(args) {
  return new Promise((resolveRun) => {
    if (!existsSync(TEAM_CLI)) return resolveRun(false);
    const child = spawnChild(process.execPath, [TEAM_CLI, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, TEAM_ACTOR: actor },
      stdio: 'ignore',
    });
    child.on('error', () => resolveRun(false));
    child.on('close', (code) => resolveRun(code === 0));
  });
}

/** The desktop orchestrator initializes .ai-team; without it there is nothing to sync. */
const teamInitialized = () => existsSync(resolve(process.cwd(), '.ai-team', 'state.json'));

const UNSYNCED_NOTE = `${color('dim', '  (team: no .ai-team here — action not synced)')}\n\n`;
const SYNC_FAILED_NOTE = `${color('dim', '  (team: sync failed)')}\n\n`;

function banner() {
  process.stdout.write('\n');
  process.stdout.write(color('cyan', `  FakeAI — ${role}\n`));
  process.stdout.write(color('dim', '  deterministic terminal harness (no model attached)\n'));
  process.stdout.write('\n');
  process.stdout.write(color('green', '  READY') + color('dim', '  — type "help" for commands\n'));
  process.stdout.write('\n');
}

function help() {
  const lines = [
    'commands:',
    '  status                  show role, cwd, task state',
    '  work [seconds]          simulate working (default 0.4s)',
    '  write <path> <text...>  write a file (relative to cwd)',
    '  complete <task-id>      complete a task (event + .ai-team sync)',
    '  message <to> <text...>  send a team message (event + .ai-team sync)',
    '  fail <text...>          print a failure report',
    '  exit [code]             exit with a status code',
  ];
  process.stdout.write(lines.map((line) => color('dim', `  ${line}`)).join('\n') + '\n\n');
}

function status() {
  const cwd = process.cwd();
  process.stdout.write(`  role:     ${role}\n`);
  process.stdout.write(`  cwd:      ${cwd}\n`);
  process.stdout.write(`  task:     ${taskState}\n`);
  process.stdout.write(`  failed:   ${failed}\n\n`);
}

const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function work(seconds) {
  const total = Math.max(0, Number(seconds) * 1000 || 400);
  const steps = 4;
  taskState = 'working';
  process.stdout.write(color('yellow', `  working (${role}) `));
  for (let step = 0; step < steps; step += 1) {
    await sleep(total / steps);
    process.stdout.write(color('dim', '·'));
  }
  taskState = 'idle';
  process.stdout.write(color('green', ' done') + '\n\n');
}

async function write(relativePath, text) {
  if (!relativePath) {
    process.stdout.write(color('red', '  usage: write <path> <text...>\n\n'));
    return;
  }
  const target = resolve(process.cwd(), relativePath);
  await mkdir(dirname(target), { recursive: true });
  const words = Array.isArray(text) ? text : [text];
  const content = words.length > 0 && words[0] ? words.join(' ') : `report from ${role}`;
  await writeFile(target, `${content}\n`, 'utf8');
  process.stdout.write(color('green', `  wrote ${relativePath}`) + '\n\n');
  emit('FILE_WRITTEN', { path: relativePath });
}

async function complete(taskId) {
  if (!taskId) {
    process.stdout.write(color('red', '  usage: complete <task-id>\n\n'));
    return;
  }
  taskState = 'completed';
  process.stdout.write(color('green', `  task ${taskId} marked complete`) + '\n\n');
  emit('TASK_COMPLETED', { taskId });

  if (!teamInitialized()) {
    process.stdout.write(UNSYNCED_NOTE);
    return;
  }
  let synced = await runTeamCommand(['task', 'complete', taskId]);
  if (!synced) {
    // The task may not exist yet (e.g. the --auto demo). Create it with the
    // same id, then complete it, so the action still lands in .ai-team.
    synced = await runTeamCommand(['task', 'create', `Task ${taskId}`, '--id', taskId]);
    if (synced) synced = await runTeamCommand(['task', 'complete', taskId]);
  }
  if (!synced) process.stdout.write(SYNC_FAILED_NOTE);
}

async function message(to, text) {
  if (!to) {
    process.stdout.write(color('red', '  usage: message <worker> <text...>\n\n'));
    return;
  }
  const words = Array.isArray(text) ? text : [text];
  let body = words.length > 0 && words[0] ? words.join(' ') : '(empty)';
  // Strip one pair of wrapping quotes: message lead "hello world" → hello world.
  if (
    body.length > 1 &&
    ((body.startsWith('"') && body.endsWith('"')) ||
      (body.startsWith("'") && body.endsWith("'")))
  ) {
    body = body.slice(1, -1);
  }
  process.stdout.write(color('cyan', `  -> ${to}: ${body}`) + '\n\n');
  emit('MESSAGE_SENT', { to, body });

  if (!teamInitialized()) {
    process.stdout.write(UNSYNCED_NOTE);
    return;
  }
  const sent = await runTeamCommand(['message', 'send', to, body]);
  if (!sent) process.stdout.write(SYNC_FAILED_NOTE);
}

function fail(text) {
  failed = true;
  const reason = text.length > 0 ? text.join(' ') : 'synthetic failure';
  process.stdout.write(color('red', `  FAIL: ${reason}`) + '\n\n');
  emit('WORKER_FAILED', { reason });
}

async function runAutoScript() {
  banner();
  status();
  await work(0.2);
  await write(`fake-${role}.report.txt`, `completed by ${role} (auto script)`);
  complete('task-1');
  message('lead', `${role} finished the auto script`);
  process.stdout.write(color('dim', '  auto script complete — exiting\n\n'));
  process.exit(Number.isFinite(autoExitCode) ? autoExitCode : 0);
}

async function runInteractive() {
  banner();
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  const prompt = () => process.stdout.write(color('cyan', `fake-ai:${role}> `));
  prompt();

  const handleLine = async (line) => {
    const segments = line.trim().split(/\s+/).filter(Boolean);
    const [command, ...rest] = segments;
    if (command) {
      if (command === 'help') help();
      else if (command === 'status') status();
      else if (command === 'work') await work(rest[0]);
      else if (command === 'write') await write(rest[0], rest.slice(1));
      else if (command === 'complete') await complete(rest[0]);
      else if (command === 'message') await message(rest[0], rest.slice(1));
      else if (command === 'fail') fail(rest);
      else if (command === 'exit') {
        const code = Number(rest[0] ?? 0);
        process.exit(Number.isFinite(code) ? code : 0);
      } else {
        process.stdout.write(color('yellow', `  unknown command "${command}" — try "help"`) + '\n\n');
      }
    }
    prompt();
  };

  // Commands run strictly in arrival order: every line waits for the previous
  // one to finish, so "work" then "write" then "exit" behaves deterministically.
  let queue = Promise.resolve();
  rl.on('line', (line) => {
    queue = queue
      .then(() => handleLine(line))
      .catch((error) => {
        process.stdout.write(color('red', `  ERROR: ${error.message}`) + '\n\n');
        prompt();
      });
  });

  rl.on('close', () => {
    // EOF: drain queued work, then behave like a well-behaved CLI.
    queue.finally(() => process.exit(autoExitCode || 0));
  });
}

if (autoMode) {
  await runAutoScript();
} else {
  await runInteractive();
}
