import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceHorizontalLoop } from '../src/lib/horizontalLoop.js';

test('horizontal log reaches the right edge, waits five seconds, resets, and moves again', () => {
  let state = { position: 0, holdRemaining: 0 };
  state = advanceHorizontalLoop(state, 100, 1000);
  assert.deepEqual(state, { position: 50, holdRemaining: 0 });
  state = advanceHorizontalLoop(state, 100, 1000);
  assert.deepEqual(state, { position: 100, holdRemaining: 5000 });
  state = advanceHorizontalLoop(state, 100, 4999);
  assert.deepEqual(state, { position: 100, holdRemaining: 1 });
  state = advanceHorizontalLoop(state, 100, 1);
  assert.deepEqual(state, { position: 0, holdRemaining: 0 });
  state = advanceHorizontalLoop(state, 100, 1000);
  assert.deepEqual(state, { position: 50, holdRemaining: 0 });
});

test('horizontal log stays still when all columns fit', () => {
  assert.deepEqual(advanceHorizontalLoop({ position: 0, holdRemaining: 0 }, 0, 1000), { position: 0, holdRemaining: 0 });
});
