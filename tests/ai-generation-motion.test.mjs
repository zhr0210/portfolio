import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reelConfig,
  reelWorks,
  referenceFrames,
  sheet,
  filmCrop,
} from '../experiments/ai-video/video-reel.config.js';
import { reelLayout } from '../experiments/ai-video/reel-motion.js';
import {
  reelTimeline,
  generationProgress,
  generationState,
  referencePose,
  referenceArrival,
  mediaUV,
} from '../experiments/ai-video/ai-generation-motion.js';
import { createCodePixels } from '../experiments/ai-video/ai-generation-code.js';

const config = reelConfig.aiGeneration;
const geometry = (W = 1440, H = 900) => reelLayout(W, H, reelConfig, filmCrop[2] / filmCrop[3]);

test('AI gets its own 1.4-unit generation interval without retiming the live film', () => {
  const timeline = reelTimeline(reelWorks, reelConfig);
  assert.deepEqual(timeline, [
    { entry: 0, end: 0, type: 'live' },
    { entry: 1, end: 2.4, type: 'ai' },
  ]);
  assert.equal(generationProgress(0.9, timeline[1]), 0);
  assert.equal(generationProgress(1.7, timeline[1]), 0.5);
  assert.equal(generationProgress(2.4, timeline[1]), 1);
  assert.equal(generationProgress(100, timeline[1]), 1);
  assert.equal(reelTimeline([...reelWorks, { type: 'live' }], reelConfig)[2].entry, 3.4);
});

test('All visual phases have explicit boundaries and playback waits for the clean endpoint', () => {
  const samples = [
    [0, 'gather'],
    [0.28, 'white'],
    [0.32, 'code'],
    [0.5, 'split'],
    [0.65, 'denoise'],
    [0.96, 'resolve'],
    [1, 'complete'],
  ];
  for (const [p, phase] of samples) assert.equal(generationState(p, config).phase, phase);
  assert.equal(generationState(0.28, config).white, 1);
  assert.equal(generationState(0.3, config).scan, 0);
  assert.equal(generationState(0.5, config).scan, 1);
  assert.equal(generationState(0.65, config).split, 1);
  assert.equal(generationState(0.96, config).denoise, 1);
  assert.equal(generationState(0.999, config).complete, false);
  assert.equal(generationState(1, config).complete, true);
  assert.equal(generationState(NaN, config).progress, 0);
});

test('Stage weights meet continuously and are independent of traversal history', () => {
  for (const p of Object.values(config.stages)) {
    const before = generationState(p - 1e-7, config),
      after = generationState(p + 1e-7, config);
    for (const key of ['white', 'scan', 'split', 'denoise', 'resolve', 'labelOpacity'])
      assert.ok(Math.abs(before[key] - after[key]) < 1e-5, key + ' at ' + p);
  }
  const values = [0, 0.14, 0.3, 0.42, 0.58, 0.65, 0.81, 0.98, 1];
  const forward = values.map((p) => generationState(p, config));
  const reverse = [...values]
    .reverse()
    .map((p) => generationState(p, config))
    .reverse();
  assert.deepEqual(reverse, forward);
});

for (const [W, H] of [
  [1920, 1080],
  [820, 1080],
  [390, 844],
  [844, 390],
]) {
  test(
    'References stagger, converge onto identical bounds, and reverse deterministically: ' +
      W +
      '×' +
      H,
    () => {
      const g = geometry(W, H),
        count = referenceFrames.length;
      const first = referencePose(0.07, referenceFrames[0], 0, count, g, config);
      const last = referencePose(0.07, referenceFrames.at(-1), count - 1, count, g, config);
      assert.ok(first.progress > last.progress);
      for (const [i, ref] of referenceFrames.entries()) {
        const end = referencePose(0.28, ref, i, count, g, config);
        assert.equal(end.x, g.W / 2);
        assert.equal(end.y, g.H / 2);
        assert.ok(Math.abs(end.w - g.frame.w) < 1e-9);
        assert.ok(Math.abs(end.h - g.frame.h) < 1e-9);
        assert.ok(Math.abs(end.tilt) < 1e-9);
        assert.equal(end.opacity, config.referenceOpacity * ref.opacity);
        const samples = [0, 0.12, 0.2, 0.12, 0].map((p) =>
          referencePose(p, ref, i, count, g, config),
        );
        assert.deepEqual(samples[0], samples[4]);
        assert.deepEqual(samples[1], samples[3]);
      }
    },
  );
}

test('Narrow windows crop the scatter rather than moving cards inward; phones favor upper/lower groups', () => {
  const a = geometry(1440, 1080),
    b = geometry(820, 1080);
  const count = referenceFrames.length;
  for (const [i, ref] of referenceFrames.entries()) {
    const wide = referencePose(0, ref, i, count, a, config),
      narrow = referencePose(0, ref, i, count, b, config);
    assert.equal(wide.w, narrow.w);
    assert.ok(Math.abs(wide.x - a.W / 2 - (narrow.x - b.W / 2)) < 1e-9);
  }
  const phone = geometry(390, 844);
  for (const [i, ref] of referenceFrames.entries()) {
    const pose = referencePose(0, ref, i, count, phone, config);
    if (i % 2 === 0) assert.ok(pose.y < phone.frame.y);
    else assert.ok(pose.y > phone.frame.y + phone.frame.h);
  }
});

test('References enter from below at different depth speeds without an opacity ramp', () => {
  const segment = reelTimeline(reelWorks, reelConfig)[1];
  assert.equal(referenceArrival(0.2, segment, config), 0);
  assert.ok(Math.abs(referenceArrival(0.675, segment, config) - 0.5) < 1e-9);
  assert.equal(referenceArrival(1.1, segment, config), 1);
  for (const [W, H] of [
    [1920, 1080],
    [390, 844],
  ]) {
    const g = geometry(W, H);
    const speeds = [];
    for (const [i, ref] of referenceFrames.entries()) {
      const poses = [0, 0.25, 0.5, 1].map((arrival) =>
        referencePose(0, ref, i, referenceFrames.length, g, config, arrival),
      );
      const tilt = Math.abs((poses[0].tilt * Math.PI) / 180);
      const halfHeight = (poses[0].w * Math.sin(tilt) + poses[0].h * Math.cos(tilt)) / 2;
      assert.ok(poses[0].y - halfHeight > H, 'The first position must be fully below the viewport');
      assert.ok(poses[0].y > poses[1].y && poses[1].y > poses[2].y && poses[2].y > poses[3].y);
      assert.ok(poses.every((p) => p.opacity === poses[0].opacity));
      assert.notEqual(poses[0].imageY, poses[3].imageY, 'Internal picture parallax follows entry');
      assert.deepEqual(poses[1], referencePose(0, ref, i, referenceFrames.length, g, config, 0.25));
      speeds.push(poses[1].y - poses[2].y);
    }
    assert.ok(new Set(speeds.map((speed) => speed.toFixed(3))).size > 6);
  }
});

test('Code fills every row and horizontal band while retaining word spaces and deterministic content', () => {
  const { pixels, columns, rows } = createCodePixels(config.seed);
  assert.deepEqual(createCodePixels(config.seed).pixels, pixels);
  assert.notDeepEqual(createCodePixels(config.seed + 1).pixels, pixels);
  for (let row = 0; row < rows; row++) {
    let spaces = 0;
    for (let start = 0; start < columns; start += 16) {
      let glyphs = 0;
      for (let col = start; col < Math.min(columns, start + 16); col++) {
        const code = pixels[(row * columns + col) * 4];
        if (code) glyphs++;
        else spaces++;
      }
      assert.ok(glyphs >= 8, 'No long empty bands at row ' + row + ', column ' + start);
    }
    assert.ok(spaces > 0 && spaces < columns / 3);
  }
});

test('Poster UV exactly matches CSS cover fit, atlas cropping and the existing 1.12 overscan', () => {
  for (const [W, H] of [
    [1920, 1080],
    [390, 844],
  ]) {
    const f = geometry(W, H).frame;
    const uv = mediaUV(f, sheet.width, sheet.height, filmCrop);
    const scale = Math.max(f.w / filmCrop[2], f.h / filmCrop[3]) * 1.12;
    assert.ok(Math.abs(uv.w * sheet.width - f.w / scale) < 1e-8);
    assert.ok(Math.abs(uv.h * sheet.height - f.h / scale) < 1e-8);
    assert.ok(Math.abs((uv.x + uv.w / 2) * sheet.width - (filmCrop[0] + filmCrop[2] / 2)) < 1e-8);
    assert.ok(
      Math.abs((1 - uv.y - uv.h / 2) * sheet.height - (filmCrop[1] + filmCrop[3] / 2)) < 1e-8,
    );
  }
});
