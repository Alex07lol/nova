import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../apps/cli/src/team-cli.js', import.meta.url));

/** Run the team CLI in a directory and collect exit code, stdout, and stderr. */
function runTeam(args, cwd, env = {}) {
  const child = spawn(process.execPath, [CLI, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return once(child, 'close').then(([code]) => ({ code, stdout, stderr }));
}

async function makeRoot(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

function readEventLog(root) {
  return readFile(join(root, '.ai-team', 'events', 'log.jsonl'), 'utf8')
    .then((raw) => raw.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)));
}

test('team init creates the protocol directory and status reports it', async () => {
  const root = await makeRoot('nova-team-cli-');
  try {
    const init = await runTeam(['init', 'demo-project'], root);
    assert.equal(init.code, 0);
    assert.match(init.stdout, /Initialized \.ai-team protocol for "demo-project"/);

    // Re-init is idempotent and keeps the project name.
    const again = await runTeam(['init', 'demo-project'], root);
    assert.equal(again.code, 0);

    const status = await runTeam(['status'], root);
    assert.equal(status.code, 0);
    assert.match(status.stdout, /Project:\s+demo-project/);
    assert.match(status.stdout, /Tasks:\s+0\/0 completed/);

    // Without .ai-team, status fails with a helpful hint.
    const bare = await makeRoot('nova-team-cli-bare-');
    try {
      const missing = await runTeam(['status'], bare);
      assert.equal(missing.code, 1);
      assert.match(missing.stderr, /not initialized/i);
    } finally {
      await rm(bare, { recursive: true, force: true });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('team task create/show/list/update/complete round-trips through .ai-team', async () => {
  const root = await makeRoot('nova-team-cli-task-');
  try {
    await runTeam(['init', 'demo'], root);

    const created = await runTeam(['task', 'create', 'Wire up auth API'], root);
    assert.equal(created.code, 0);
    assert.match(created.stdout, /Created task-1: Wire up auth API/);

    const shown = await runTeam(['task', 'show', 'task-1'], root);
    assert.equal(shown.code, 0);
    const task = JSON.parse(shown.stdout);
    assert.equal(task.title, 'Wire up auth API');
    assert.equal(task.status, 'planned');
    assert.equal(task.createdBy, 'cli-user');

    const listed = await runTeam(['task', 'list'], root);
    assert.match(listed.stdout, /task-1\s+planned\s+medium\s+Wire up auth API/);

    const updated = await runTeam(['task', 'update', 'task-1', 'working'], root);
    assert.match(updated.stdout, /Updated task-1 status to working/);

    const done = await runTeam(['task', 'complete', 'task-1'], root);
    assert.match(done.stdout, /Marked task-1 completed/);

    // The activity log received the same events the desktop feed renders,
    // including a human-readable summary.
    const events = await readEventLog(root);
    const types = events.map((event) => event.type);
    assert.ok(types.includes('TASK_CREATED'));
    assert.ok(types.includes('TASK_WORKING'));
    assert.ok(types.includes('TASK_COMPLETED'));
    const createdEvent = events.find((event) => event.type === 'TASK_CREATED');
    assert.match(createdEvent.summary, /task-1/);
    assert.ok(createdEvent.timestamp);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('team task ready respects dependencies and rejects invalid statuses', async () => {
  const root = await makeRoot('nova-team-cli-ready-');
  try {
    await runTeam(['init', 'demo'], root);
    await runTeam(['task', 'create', 'Architecture'], root);

    // Seed a dependent task directly, the way the desktop orchestrator would.
    const tasksDir = join(root, '.ai-team', 'tasks');
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, 'task-2.json'),
      JSON.stringify({
        id: 'task-2',
        title: 'Backend API',
        description: '',
        status: 'planned',
        priority: 'high',
        assignee: null,
        dependencies: ['task-1'],
      }, null, 2),
    );

    const readyFirst = await runTeam(['task', 'ready'], root);
    assert.match(readyFirst.stdout, /task-1\s+Architecture/);
    assert.doesNotMatch(readyFirst.stdout, /task-2/);

    await runTeam(['task', 'complete', 'task-1'], root);
    const readySecond = await runTeam(['task', 'ready'], root);
    assert.match(readySecond.stdout, /task-2\s+Backend API/);
    assert.doesNotMatch(readySecond.stdout, /task-1/);

    const bad = await runTeam(['task', 'update', 'task-2', 'on-fire'], root);
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /invalid status/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('team message send and inbox route messages between workers', async () => {
  const root = await makeRoot('nova-team-cli-msg-');
  try {
    await runTeam(['init', 'demo'], root);

    const sent = await runTeam(
      ['message', 'send', 'agy-backend', 'Need the auth API schema'],
      root,
      { TEAM_ACTOR: 'codex-ui' },
    );
    assert.equal(sent.code, 0);
    assert.match(sent.stdout, /Sent message msg_\w+ to agy-backend/);

    const inbox = await runTeam(['message', 'inbox', 'agy-backend'], root);
    assert.match(inbox.stdout, /codex-ui → agy-backend/);
    assert.match(inbox.stdout, /auth API schema/);
    assert.match(inbox.stdout, /•/); // unread

    const elsewhere = await runTeam(['message', 'inbox', 'someone-else'], root);
    assert.match(elsewhere.stdout, /No messages/);

    // With TEAM_ACTOR set, the default inbox belongs to that worker.
    const own = await runTeam(['message', 'inbox'], root, { TEAM_ACTOR: 'agy-backend' });
    assert.match(own.stdout, /auth API schema/);

    // A human (no TEAM_ACTOR) sees every message via `team messages`.
    const all = await runTeam(['messages'], root, { TEAM_ACTOR: '' });
    assert.match(all.stdout, /msg_\w+/);
    assert.match(all.stdout, /auth API schema/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('team message inbox indents replies under their root', async () => {
  const root = await makeRoot('nova-team-cli-threads-');
  try {
    await runTeam(['init', 'demo'], root);

    const sent = await runTeam(
      ['message', 'send', 'agy-backend', 'Which auth flow do we use?'],
      root,
      { TEAM_ACTOR: 'lead' },
    );
    assert.equal(sent.code, 0);
    const rootId = sent.stdout.match(/Sent message (msg_\w+)/)[1];

    const reply = await runTeam(
      ['message', 'send', 'agy-backend', 'OAuth2 with PKCE', '--reply-to', rootId],
      root,
      { TEAM_ACTOR: 'codex-ui' },
    );
    assert.equal(reply.code, 0);

    const inbox = await runTeam(['message', 'inbox', 'agy-backend'], root);
    assert.equal(inbox.code, 0);
    const lines = inbox.stdout.split('\n').filter((line) => line.includes('msg_'));
    assert.equal(lines.length, 2);
    // Root first and flush; the reply indented beneath it (same shape the
    // desktop MESSAGES panel draws).
    assert.ok(!lines[0].startsWith('  ↳ '), 'root prints unindented');
    assert.match(lines[0], /Which auth flow do we use\?/);
    assert.match(lines[1], /^ {2}↳ •?\s*msg_/, 'reply is indented under its root');
    assert.match(lines[1], /OAuth2 with PKCE/);

    // Replying marks the root read, mirroring the desktop composer.
    assert.ok(!lines[0].includes('•'), 'root was marked read by the reply');

    // A bad --reply-to fails loudly instead of spawning a stray thread.
    const bad = await runTeam(
      ['message', 'send', 'agy-backend', 'oops', '--reply-to', 'msg_fffffff0'],
      root,
      { TEAM_ACTOR: 'codex-ui' },
    );
    assert.equal(bad.code, 1);
    assert.match(bad.stderr, /Reply target not found/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('team event emit appends to the activity log; help and errors behave', async () => {
  const root = await makeRoot('nova-team-cli-event-');
  try {
    await runTeam(['init', 'demo'], root);
    const emitted = await runTeam(['event', 'emit', 'TEST_FAILED', 'npm test failed on auth'], root);
    assert.equal(emitted.code, 0);
    assert.match(emitted.stdout, /Emitted TEST_FAILED \(evt_\w+\)/);

    const events = await readEventLog(root);
    const failure = events.find((event) => event.type === 'TEST_FAILED');
    assert.ok(failure);
    assert.equal(failure.summary, 'npm test failed on auth');
    assert.equal(failure.actor, 'cli-user');

    const help = await runTeam(['help'], root);
    assert.equal(help.code, 0);
    assert.match(help.stdout, /team task create/);
    assert.match(help.stdout, /team messages/);

    const unknown = await runTeam(['bogus'], root);
    assert.equal(unknown.code, 1);
    assert.match(unknown.stderr, /Unknown command/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
