import test from 'node:test';
import assert from 'node:assert/strict';
import { nextSelectedIndex } from '../apps/desktop/src/features/command-center/message-keys.ts';

test('j/k enter from the top and bottom when nothing is selected', () => {
  assert.equal(nextSelectedIndex(5, -1, 'j'), 0);
  assert.equal(nextSelectedIndex(5, -1, 'k'), 4);
});

test('j/k move exactly one row in the right direction', () => {
  assert.equal(nextSelectedIndex(5, 0, 'j'), 1);
  assert.equal(nextSelectedIndex(5, 2, 'j'), 3);
  assert.equal(nextSelectedIndex(5, 3, 'k'), 2);
  assert.equal(nextSelectedIndex(5, 4, 'k'), 3);
});

test('selection clamps at both edges of the list', () => {
  assert.equal(nextSelectedIndex(5, 0, 'k'), 0);
  assert.equal(nextSelectedIndex(5, 4, 'j'), 4);
});

test('a stale or empty selection recovers to a valid row', () => {
  // selectedMessageId not in the list → findIndex yields -1
  assert.equal(nextSelectedIndex(3, -1, 'j'), 0);
  assert.equal(nextSelectedIndex(3, -1, 'k'), 2);
  assert.equal(nextSelectedIndex(0, -1, 'j'), -1);
  assert.equal(nextSelectedIndex(0, -1, 'k'), -1);
});

test('a single-row list keeps the selection stable', () => {
  assert.equal(nextSelectedIndex(1, 0, 'j'), 0);
  assert.equal(nextSelectedIndex(1, 0, 'k'), 0);
});
