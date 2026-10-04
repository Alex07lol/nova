import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLAPSED_THREAD_ROWS,
  flattenThreads,
  flattenVisibleThreads,
  groupIntoThreads,
  hiddenMemberCount,
  visibleThreadMembers,
} from '../apps/desktop/src/features/command-center/message-threads.ts';

const msg = (id, createdAt, replyTo = null) => ({ id, createdAt, replyTo });

test('messages without replyTo form one thread each, newest activity first', () => {
  const threads = groupIntoThreads([
    msg('m-a', '2026-10-01T10:00:00Z'),
    msg('m-b', '2026-10-03T10:00:00Z'),
    msg('m-c', '2026-10-02T10:00:00Z'),
  ]);
  assert.deepEqual(threads.map((t) => t.root.id), ['m-b', 'm-c', 'm-a']);
  assert.ok(threads.every((t) => t.members.length === 1));
});

test('replies nest under their root with chronological members', () => {
  const threads = groupIntoThreads([
    msg('m-1', '2026-10-01T09:00:00Z'),
    msg('m-3', '2026-10-01T09:20:00Z', 'm-1'),
    msg('m-2', '2026-10-01T09:10:00Z', 'm-1'),
  ]);
  assert.equal(threads.length, 1);
  assert.equal(threads[0].root.id, 'm-1');
  assert.deepEqual(threads[0].members.map((m) => m.id), ['m-1', 'm-2', 'm-3']);
  assert.equal(threads[0].latestAt, '2026-10-01T09:20:00Z');
});

test('reply chains resolve up to one root thread', () => {
  const threads = groupIntoThreads([
    msg('m-c', '2026-10-01T09:20:00Z', 'm-b'),
    msg('m-b', '2026-10-01T09:10:00Z', 'm-a'),
    msg('m-a', '2026-10-01T09:00:00Z'),
  ]);
  assert.equal(threads.length, 1);
  assert.deepEqual(threads[0].members.map((m) => m.id), ['m-a', 'm-b', 'm-c']);
});

test('dangling replyTo starts its own thread instead of crashing', () => {
  const threads = groupIntoThreads([
    msg('m-1', '2026-10-01T09:00:00Z'),
    msg('m-2', '2026-10-01T09:10:00Z', 'm-deleted'),
  ]);
  assert.equal(threads.length, 2);
  assert.deepEqual(threads.map((t) => t.root.id), ['m-2', 'm-1']);
});

test('a thread with newer activity outranks a newer standalone root', () => {
  const threads = groupIntoThreads([
    msg('old-root', '2026-10-01T09:00:00Z'),
    msg('old-reply', '2026-10-03T12:00:00Z', 'old-root'),
    msg('fresh-root', '2026-10-02T09:00:00Z'),
  ]);
  assert.deepEqual(threads.map((t) => t.root.id), ['old-root', 'fresh-root']);
});

test('flattenThreads returns exact display order: roots before their replies', () => {
  const threads = groupIntoThreads([
    msg('a-1', '2026-10-01T09:00:00Z'),
    msg('a-2', '2026-10-01T09:10:00Z', 'a-1'),
    msg('b-1', '2026-10-01T08:00:00Z'),
  ]);
  assert.deepEqual(flattenThreads(threads).map((m) => m.id), ['a-1', 'a-2', 'b-1']);
});

test('every message appears exactly once, even with a reply cycle', () => {
  const input = [
    msg('m-a', '2026-10-01T09:00:00Z', 'm-b'),
    msg('m-b', '2026-10-01T09:01:00Z', 'm-a'),
    msg('m-c', '2026-10-01T09:02:00Z'),
  ];
  const threads = groupIntoThreads(input);
  const flat = flattenThreads(threads).map((m) => m.id).sort();
  assert.deepEqual(flat, ['m-a', 'm-b', 'm-c']);
});

test('empty input yields no threads', () => {
  assert.deepEqual(groupIntoThreads([]), []);
});

// --- collapse: long threads show only their newest two rows ---------------

const longThread = () =>
  groupIntoThreads([
    msg('t-1', '2026-10-01T09:00:00Z'),
    msg('t-2', '2026-10-01T09:10:00Z', 't-1'),
    msg('t-3', '2026-10-01T09:20:00Z', 't-2'),
    msg('t-4', '2026-10-01T09:30:00Z', 't-3'),
    msg('t-5', '2026-10-01T09:40:00Z', 't-4'),
  ]);

test('a five-message thread collapses to its newest two rows', () => {
  const [thread] = longThread();
  const collapsed = new Set();
  assert.equal(hiddenMemberCount(thread), 3);
  assert.equal(COLLAPSED_THREAD_ROWS, 2);
  assert.deepEqual(
    visibleThreadMembers(thread, collapsed).map((m) => m.id),
    ['t-4', 't-5'],
  );
});

test('threads of two or fewer members never collapse', () => {
  for (const count of [1, 2]) {
    const messages = Array.from({ length: count }, (_, i) =>
      i === 0
        ? msg('s-1', '2026-10-01T09:00:00Z')
        : msg(`s-${i + 1}`, `2026-10-01T09:0${i}:00Z`, 's-1'),
    );
    const [thread] = groupIntoThreads(messages);
    assert.equal(hiddenMemberCount(thread), 0);
    assert.deepEqual(visibleThreadMembers(thread, new Set()), thread.members);
  }
});

test('expanding a collapsed thread reveals every member again', () => {
  const [thread] = longThread();
  const expanded = new Set([thread.root.id]);
  assert.equal(hiddenMemberCount(thread), 3); // count still reported
  assert.deepEqual(
    visibleThreadMembers(thread, expanded).map((m) => m.id),
    ['t-1', 't-2', 't-3', 't-4', 't-5'],
  );
});

test('flattenVisibleThreads interleaves collapsed and expanded threads in render order', () => {
  const threads = groupIntoThreads([
    // Long thread: collapses to t-4, t-5.
    msg('t-1', '2026-10-01T09:00:00Z'),
    msg('t-2', '2026-10-01T09:10:00Z', 't-1'),
    msg('t-3', '2026-10-01T09:20:00Z', 't-2'),
    msg('t-4', '2026-10-01T09:30:00Z', 't-3'),
    msg('t-5', '2026-10-01T09:40:00Z', 't-4'),
    // Short thread: always fully visible, newest activity → rendered first.
    msg('s-1', '2026-10-02T09:00:00Z'),
    msg('s-2', '2026-10-02T09:10:00Z', 's-1'),
  ]);
  assert.deepEqual(
    flattenVisibleThreads(threads, new Set()).map((m) => m.id),
    ['s-1', 's-2', 't-4', 't-5'],
  );
  assert.deepEqual(
    flattenVisibleThreads(threads, new Set([threads[1].root.id])).map((m) => m.id),
    ['s-1', 's-2', 't-1', 't-2', 't-3', 't-4', 't-5'],
  );
});
