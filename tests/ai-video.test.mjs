import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const scope = { window: {} };
runInNewContext(
  readFileSync(new URL('../experiments/ai-video/ai-video-nodes-v2.js', import.meta.url), 'utf8'),
  scope,
);
const Nodes = scope.window.AIVideoNodes;

test('Next thumbnail never borrows the departing video’s enlargement', () => {
  for (const cycle of [-3, 0, 7]) {
    let lastScale = 0;
    for (let step = 0; step <= 36; step++) {
      const position = cycle + 0.64 + step / 100;
      const card = Nodes.cardPose(position, cycle + 1);
      assert.equal(card.clarity, 0, 'The next video has not started entering');
      assert.ok(card.scale >= lastScale - 1e-9, 'The next thumbnail must not enlarge then shrink');
      lastScale = card.scale;
    }
  }
});

test('Each thumbnail peaks with its own video and remains continuous at cycle boundaries', () => {
  for (const index of [-2, 0, 4]) {
    assert.equal(Nodes.cardPose(index + 0.58, index).clarity, 1);
    assert.equal(Nodes.cardPose(index + 0.58, index + 1).clarity, 0);
    for (const boundary of [0, 0.52, 0.64, 1]) {
      const before = Nodes.cardPose(index + boundary - 1e-7, index);
      const after = Nodes.cardPose(index + boundary + 1e-7, index);
      assert.ok(Math.abs(before.scale - after.scale) < 1e-5);
    }
  }
});

test('Loading progress reverses before completion and reaches 100 only at full focus', () => {
  const initial = { revealed: false, completeAt: null };
  const forward = Nodes.loadingState(initial, 0.4, true, 0);
  const reverse = Nodes.loadingState(forward, 0.2, true, 50);
  assert.ok(reverse.progress < forward.progress);
  assert.equal(reverse.revealed, false);
  const centered = Nodes.loadingState(reverse, 0.58, true, 100);
  assert.equal(centered.progress, 1);
  assert.equal(centered.revealed, false, '100% briefly precedes the reveal');
  assert.equal(Nodes.loadingState(centered, 0.58, true, 250).revealed, true);
});

test('Video waits for media readiness and departure never restarts loading', () => {
  let state = Nodes.loadingState({}, 0.58, false, 0);
  state = Nodes.loadingState(state, 0.58, false, 1000);
  assert.equal(state.revealed, false);
  assert.equal(state.pending, false, 'Media readiness wakes the otherwise idle scene');
  state = Nodes.loadingState(state, 0.58, true, 1100);
  assert.equal(state.revealed, true);
  for (const exit of [0.7, 0.85, 0.4, 0.1]) {
    assert.equal(Nodes.loadingState(state, exit, true, 1200).revealed, true);
  }
  assert.equal(Nodes.loadingState(state, 0, true, 1300).revealed, false);
  assert.equal(Nodes.loadingState({}, 0.58, true, 0, true).revealed, true);
});

test('Changing the type annotates the current work without switching timelines or sources', () => {
  const calls = [];
  const instance = Object.assign(Object.create(Nodes.prototype), {
    position: 1.58,
    target: 1.6,
    works: [{ type: 'ai' }, { type: 'ai' }, { type: 'ai' }],
    sources: new Map([[1, 'blob:test-video']]),
    setMenu: () => calls.push('menu'),
    render: () => calls.push('render'),
  });
  instance.setType('live');
  assert.equal(instance.works[1].type, 'live');
  assert.equal(instance.works[0].type, 'ai');
  assert.equal(instance.position, 1.58);
  assert.equal(instance.target, 1.6);
  assert.equal(instance.sources.get(instance.key(1)), 'blob:test-video');
  assert.equal(instance.sources.get(instance.key(4)), 'blob:test-video');
  assert.deepEqual(calls, ['menu', 'render']);
});
