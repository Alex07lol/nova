import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const HARNESS = fileURLToPath(new URL('../scripts/fake-ai.mjs', import.meta.url));
const TEAM_CLI = fileURLToPath(new URL('../apps/cli/src/team-cli.js', import.meta.url));

/** Run one `team` CLI command in a directory (used to set up .ai-team fixtures). */
function runCli(args, cwd) {
  const child = spawn(process.execPath, [TEAM_CLI, ...args], { cwd, stdio: 'ignore' });
  return once(child, 'close');
}

function startFakeAI(argv, cwd = process.cwd()) {
  const child = spawn(process.execPath, [HARNESS, ...argv], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  return {
    child,
    get output() {
      return output;
    },
    send(line) {
      child.stdin.write(`${line}\n`);
    },
    async close() {
      child.stdin.end();
      const [code] = await once(child, 'close');
      return code;
    },
  };
}

test('fake-ai prints an ANSI banner and answers status', async () => {
  const session = startFakeAI(['--role', 'frontend']);
  await once(session.child.stdout, 'data');
  session.send('status');
  session.send('exit 0');
  const code = await session.close();

  assert.equal(code, 0);
  assert.match(session.output, /FakeAI — frontend/);
  assert.match(session.output, /READY/);
  assert.match(session.output, /role:\s+frontend/);
  assert.match(session.output, /task:\s+idle/);
});

test('fake-ai simulates work and writes files into the working directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-fakeai-'));
  try {
    const session = startFakeAI(['--role', 'backend'], root);
    await once(session.child.stdout, 'data');
    session.send('work 0.05');
    session.send('write src/generated/demo.txt hello from the harness');
    session.send('exit 0');
    const code = await session.close();

    assert.equal(code, 0);
    assert.match(session.output, /done/);
    assert.match(session.output, /wrote src\/generated\/demo\.txt/);
    const written = await readFile(join(root, 'src', 'generated', 'demo.txt'), 'utf8');
    assert.equal(written.trim(), 'hello from the harness');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fake-ai emits structured team protocol events', async () => {
  const session = startFakeAI(['--role', 'qa']);
  await once(session.child.stdout, 'data');
  session.send('complete task-42');
  session.send('message lead "QA finished the suite"');
  session.send('exit 0');
  await session.close();

  const events = session.output
    .split('\n')
    .filter((line) => line.startsWith('TEAM:// '))
    .map((line) => JSON.parse(line.slice('TEAM:// '.length)));

  assert.equal(events.some((event) => event.type === 'TASK_COMPLETED' && event.taskId === 'task-42'), true);
  assert.equal(
    events.some((event) => event.type === 'MESSAGE_SENT' && event.to === 'lead' && event.role === 'qa'),
    true
  );
});

test('fake-ai auto script runs the canned sequence with a configurable exit code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-fakeai-auto-'));
  try {
    const child = spawn(process.execPath, [HARNESS, '--role', 'research', '--auto', '--exit-code', '3'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    const [code] = await once(child, 'close');

    assert.equal(code, 3);
    assert.match(output, /TEAM:\/\/ \{"type":"TASK_COMPLETED"/);
    assert.match(output, /auto script complete/);
    const report = await readFile(join(root, 'fake-research.report.txt'), 'utf8');
    assert.match(report, /completed by research/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fake-ai reports failures and propagates exit codes from the exit command', async () => {
  const session = startFakeAI(['--role', 'crasher']);
  await once(session.child.stdout, 'data');
  session.send('fail disk on fire');
  session.send('exit 137');
  const code = await session.close();

  assert.equal(code, 137);
  assert.match(session.output, /FAIL: disk on fire/);
  assert.match(session.output, /"type":"WORKER_FAILED"/);
});

test('fake-ai exits cleanly on EOF like a well-behaved CLI', async () => {
  const session = startFakeAI(['--role', 'quiet']);
  await once(session.child.stdout, 'data');
  const code = await session.close();
  assert.equal(code, 0);
});

test('fake-ai syncs complete and message into .ai-team via the team CLI', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-fakeai-team-'));
  try {
    await runCli(['init', 'demo'], root);
    await runCli(['task', 'create', 'Existing demo task'], root);

    const session = startFakeAI(['--role', 'frontend'], root);
    await once(session.child.stdout, 'data');
    session.send('complete task-1');
    session.send('message agy-backend "Need the auth API schema"');
    session.send('exit 0');
    const code = await session.close();
    assert.equal(code, 0);

    const task = JSON.parse(await readFile(join(root, '.ai-team', 'tasks', 'task-1.json'), 'utf8'));
    assert.equal(task.status, 'completed');

    const messageFiles = await readdir(join(root, '.ai-team', 'messages'));
    assert.equal(messageFiles.length, 1);
    const message = JSON.parse(
      await readFile(join(root, '.ai-team', 'messages', messageFiles[0]), 'utf8'),
    );
    assert.equal(message.from, 'fake-frontend');
    assert.equal(message.to, 'agy-backend');
    assert.equal(message.body, 'Need the auth API schema');
    assert.equal(message.status, 'unread');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fake-ai creates missing tasks so completions still land in .ai-team', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-fakeai-upsert-'));
  try {
    await runCli(['init', 'demo'], root);

    const session = startFakeAI(['--role', 'backend'], root);
    await once(session.child.stdout, 'data');
    session.send('complete task-7');
    session.send('exit 0');
    const code = await session.close();
    assert.equal(code, 0);

    const task = JSON.parse(await readFile(join(root, '.ai-team', 'tasks', 'task-7.json'), 'utf8'));
    assert.equal(task.status, 'completed');
    assert.equal(task.createdBy, 'fake-backend');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fake-ai degrades gracefully when no .ai-team exists', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nova-fakeai-bare-'));
  try {
    const session = startFakeAI(['--role', 'qa'], root);
    await once(session.child.stdout, 'data');
    session.send('complete task-1');
    session.send('message lead "hello there"');
    session.send('exit 0');
    const code = await session.close();

    assert.equal(code, 0);
    assert.match(session.output, /"type":"TASK_COMPLETED"/);
    assert.match(session.output, /"type":"MESSAGE_SENT"/);
    assert.match(session.output, /not synced/);
    // Graceful degradation must not half-create the protocol directory.
    assert.equal(existsSync(join(root, '.ai-team')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
