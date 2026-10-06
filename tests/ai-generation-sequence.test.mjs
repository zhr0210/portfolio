import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reelConfig } from '../experiments/ai-video/video-reel.config.js';
import {
  denoiseFrame,
  normalizeSequence,
  sequenceInterval,
} from '../experiments/ai-video/ai-generation-sequence.js';

const config = reelConfig.aiGeneration;
// The previous authored example remains a fixture for the optional import interface.
const definition = {
  atlas: new URL(
    '../experiments/ai-video/assets/atonement-generation-atlas-v1.png',
    import.meta.url,
  ).href,
  flowAtlas: new URL(
    '../experiments/ai-video/assets/atonement-generation-flow-v1.png',
    import.meta.url,
  ).href,
  columns: 3,
  rows: 3,
  steps: [0, 4, 9, 15, 22, 30, 38, 44, 50],
  posterFrame: 8,
  flowRange: 0.16,
};

test('All 0–50 iterations map deterministically from the existing scroll interval', () => {
  const states = [];
  for (let step = 0; step <= 50; step++) {
    const p = config.stages.split + ((config.stages.denoise - config.stages.split) * step) / 50;
    const state = denoiseFrame(p, config);
    assert.equal(state.from, step);
    assert.ok(Math.abs(state.normalized - step / 50) < 1e-8);
    states.push(state);
  }
  assert.equal(denoiseFrame(0, config).from, 0);
  assert.equal(denoiseFrame(1, config).from, 50);
  assert.ok(Math.abs(denoiseFrame(0.805, { ...config, denoiseSteps: 25 }).position - 12.5) < 1e-8);
  const reverse = states
    .toReversed()
    .map((s) =>
      denoiseFrame(
        config.stages.split + ((config.stages.denoise - config.stages.split) * s.position) / 50,
        config,
      ),
    )
    .toReversed();
  assert.deepEqual(reverse, states);
});

test('Adjacent prediction intervals meet without a discontinuity and end at the unchanged cover', () => {
  const sequence = normalizeSequence(definition);
  assert.equal(sequence.frameCount, 9);
  assert.equal(sequence.posterFrame, 8);
  assert.equal(sequence.keySteps.length, 64);
  assert.deepEqual(sequenceInterval(0, sequence), { from: 0, to: 1, mix: 0 });
  assert.deepEqual(sequenceInterval(1, sequence), { from: 7, to: 8, mix: 1 });
  for (const step of definition.steps.slice(1, -1)) {
    const previous = sequenceInterval(step / 50 - 1e-8, sequence);
    const next = sequenceInterval(step / 50 + 1e-8, sequence);
    assert.equal(previous.to, next.from);
    assert.ok(previous.mix > 0.999999 && next.mix < 0.000001);
  }
});

test('Sequence validation bounds shader indexing and permits a missing optional sequence', () => {
  assert.equal(normalizeSequence(null), null);
  for (const patch of [
    { steps: [0, 2, 1] },
    { steps: [0, 1, 1] },
    { steps: [1, 2] },
    { columns: 1, rows: 1 },
    { posterFrame: 4 },
    { flowRange: 0 },
    { atlas: '' },
  ])
    assert.throws(() => normalizeSequence({ ...definition, ...patch }));
  const full = normalizeSequence({
    ...definition,
    columns: 8,
    rows: 7,
    steps: Array.from({ length: 51 }, (_, i) => i),
    posterFrame: 50,
  });
  assert.equal(full.frameCount, 51, 'Real exported per-step frames can use the same interface');
});

test('Both sequence textures match the recorded atlas layout and the fixed cover provenance', () => {
  const metadata = JSON.parse(
    readFileSync(
      new URL('../experiments/ai-video/assets/atonement-generation.metadata.json', import.meta.url),
    ),
  );
  assert.equal(metadata.simulation, true);
  assert.deepEqual(definition.steps, metadata.sequence.steps);
  for (const [url, info] of [
    [definition.atlas, metadata.atlas],
    [definition.flowAtlas, metadata.flow],
  ]) {
    const bytes = readFileSync(new URL(url));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), info.width);
    assert.equal(bytes.readUInt32BE(20), info.height);
  }
  assert.ok(
    metadata.flow.meanForwardMotion.some((n) => n > 0.04),
    'Flow contains meaningful shape corrections',
  );
});
