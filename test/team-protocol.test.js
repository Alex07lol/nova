import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync, mkdirSync } from 'node:fs';
import { createTeam } from '../packages/team-protocol/src/team.js';
import { groupThreads } from '../packages/team-protocol/src/messages.js';

function makeRoot() {
  const root = join(tmpdir(), `nova-team-test-${process.pid}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

describe('team-protocol', () => {
  let root;
  let team;

  beforeEach(() => {
    root = makeRoot();
    team = createTeam(root, { actor: 'test' });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('init creates .ai-team structure', async () => {
    const state = await team.init('demo');
    assert.equal(state.project.name, 'demo');
    assert.ok(state.objective === '');
    assert.ok(Array.isArray(state.workers));
  });

  test('createTask generates sequential IDs', async () => {
    await team.init('demo');
    const t1 = await team.createTask({ title: 'First' });
    const t2 = await team.createTask({ title: 'Second' });
    assert.equal(t1.id, 'task-1');
    assert.equal(t2.id, 'task-2');
  });

  test('listTasks returns tasks sorted by ID', async () => {
    await team.init('demo');
    await team.createTask({ title: 'B' });
    await team.createTask({ title: 'A' });
    const tasks = await team.listTasks();
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].id, 'task-1');
    assert.equal(tasks[1].id, 'task-2');
  });

  test('readyTasks returns tasks with satisfied dependencies', async () => {
    await team.init('demo');
    const t1 = await team.createTask({ title: 'Architecture' });
    const t2 = await team.createTask({ title: 'Backend', dependencies: [t1.id] });
    const t3 = await team.createTask({ title: 'Frontend', dependencies: [t2.id] });

    let ready = await team.readyTasks();
    assert.deepEqual(ready.map(t => t.id), ['task-1']);

    await team.completeTask(t1.id);
    ready = await team.readyTasks();
    assert.deepEqual(ready.map(t => t.id), ['task-2']);

    await team.completeTask(t2.id);
    ready = await team.readyTasks();
    assert.deepEqual(ready.map(t => t.id), ['task-3']);
  });

  test('completeTask updates status and emits event', async () => {
    await team.init('demo');
    const t = await team.createTask({ title: 'Test' });
    const completed = await team.completeTask(t.id);
    assert.equal(completed.status, 'completed');

    const events = await team.recentEvents(5);
    const completedEvent = events.find(e => e.type === 'TASK_COMPLETED');
    assert.ok(completedEvent);
    assert.equal(completedEvent.payload.taskId, t.id);
  });

  test('sendMessage and inbox', async () => {
    await team.init('demo');
    const msg = await team.sendMessage({ to: 'worker-a', body: 'Hello', type: 'question' });
    assert.ok(msg.id.startsWith('msg_'));
    assert.equal(msg.to, 'worker-a');
    assert.equal(msg.status, 'unread');

    const inbox = await team.inbox('worker-a');
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].body, 'Hello');
  });

  test('groupThreads nests replies under one root, newest activity first', () => {
    const threads = groupThreads([
      { id: 'm-1', createdAt: '2026-10-01T09:00:00Z' },
      { id: 'm-3', createdAt: '2026-10-01T09:20:00Z', replyTo: 'm-2' },
      { id: 'm-2', createdAt: '2026-10-01T09:10:00Z', replyTo: 'm-1' },
      { id: 'm-lonely', createdAt: '2026-10-01T10:00:00Z', replyTo: 'm-gone' },
    ]);
    assert.equal(threads.length, 2);
    // Threads order by recency of activity; the chained reply joins its root.
    assert.equal(threads[0].root.id, 'm-lonely');
    assert.deepEqual(threads[1].members.map((m) => m.id), ['m-1', 'm-2', 'm-3']);
  });

  test('inbox pulls in each reply\'s root for thread context', async () => {
    await team.init('demo');
    // The root is addressed to worker-b; worker-a only gets the reply.
    const rootMsg = await team.sendMessage({ to: 'worker-b', body: 'root question', type: 'question' });
    const reply = await team.sendMessage({ to: 'worker-a', body: 'here is my answer', replyTo: rootMsg.id });
    assert.equal(reply.replyTo, rootMsg.id);

    const inboxA = await team.inbox('worker-a');
    assert.deepEqual(inboxA.map((m) => m.id).sort(), [rootMsg.id, reply.id].sort());

    // worker-b keeps a plain inbox: the reply was never addressed to them.
    const inboxB = await team.inbox('worker-b');
    assert.deepEqual(inboxB.map((m) => m.id), [rootMsg.id]);
    // Replying marked the root read, exactly like the desktop composer.
    assert.equal(inboxB[0].status, 'read');
  });

  test('sendMessage rejects an unknown reply target', async () => {
    await team.init('demo');
    await assert.rejects(
      () => team.sendMessage({ to: 'worker-a', body: 'orphan', replyTo: 'msg_fffffff0' }),
      /Reply target not found/,
    );
  });

  test('publishContract and listContracts', async () => {
    await team.init('demo');
    await team.publishContract('auth', 'POST /login returns { token }', '.md');
    const contracts = await team.listContracts();
    assert.ok(contracts.includes('auth.md'));
  });

  test('events are appended with correct structure', async () => {
    await team.init('demo');
    await team.createTask({ title: 'Task 1' });
    const events = await team.recentEvents(10);
    assert.ok(events.length > 0);
    const taskCreated = events.find(e => e.type === 'TASK_CREATED');
    assert.ok(taskCreated);
    assert.ok(taskCreated.payload.taskId);
    assert.ok(taskCreated.actor);
    assert.ok(taskCreated.timestamp);
  });

  test('updateTask validates status', async () => {
    await team.init('demo');
    const t = await team.createTask({ title: 'Test' });
    await assert.rejects(
      team.updateTask(t.id, { status: 'invalid' }),
      /invalid status/
    );
  });

  test('objective read/write', async () => {
    await team.init('demo');
    await team.setObjective('Build a warranty platform');
    const objective = await team.objective();
    assert.ok(objective.includes('Build a warranty platform'));
  });

  test('dependency graph and topological sort', async () => {
    await team.init('demo');
    const t1 = await team.createTask({ title: 'A' });
    const t2 = await team.createTask({ title: 'B', dependencies: [t1.id] });
    const t3 = await team.createTask({ title: 'C', dependencies: [t1.id] });
    const t4 = await team.createTask({ title: 'D', dependencies: [t2.id, t3.id] });

    const tasks = await team.listTasks();
    const sorted = team.sortedByDependency(tasks);
    const order = sorted.map(t => t.id);
    // t1 before t2 and t3; t2 and t3 before t4
    assert.ok(order.indexOf(t1.id) < order.indexOf(t2.id));
    assert.ok(order.indexOf(t1.id) < order.indexOf(t3.id));
    assert.ok(order.indexOf(t2.id) < order.indexOf(t4.id));
    assert.ok(order.indexOf(t3.id) < order.indexOf(t4.id));
  });

  test('blockersOf returns incomplete blocking tasks', async () => {
    await team.init('demo');
    const t1 = await team.createTask({ title: 'A' });
    const t2 = await team.createTask({ title: 'B', blockedBy: [t1.id] });
    const t3 = await team.createTask({ title: 'C', blockedBy: [t1.id] });

    let blockers = team.blockersOf([t1, t2, t3], t2.id);
    assert.deepEqual(blockers, [t1.id]);

    await team.completeTask(t1.id);
    // blockersOf reads from the passed array; fetch fresh tasks for updated status
    const freshTasks = await team.listTasks();
    blockers = team.blockersOf(freshTasks, t2.id);
    assert.deepEqual(blockers, []);
  });
});