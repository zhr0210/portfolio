import test from 'node:test';
import assert from 'node:assert/strict';
import { reelConfig, filmCrop } from '../experiments/ai-video/video-reel.config.js';
import { reelLayout, scenePose } from '../experiments/ai-video/reel-motion.js';

for (const [W, H] of [
  [2048, 1152],
  [1177, 1070],
  [390, 844],
  [844, 390],
]) {
  test('The live film retains height-led framing and caption parallax: ' + W + '×' + H, () => {
    const g = reelLayout(W, H, reelConfig, filmCrop[2] / filmCrop[3]);
    const p = scenePose(0.35, 0, g, reelConfig);
    assert.ok(p.titleY < p.y && p.metadataY > p.y);
    assert.ok(g.frame.x >= 0 && g.frame.x + g.frame.w <= W);
    assert.ok(g.frame.y >= 0 && g.frame.y + g.frame.h <= H);
    assert.ok(g.frame.h <= H * 0.4);
    assert.ok(g.travel - g.frame.h >= H * 0.3 - 1e-9);
  });
}

test('The original live film enters and exits once and reverses continuously', () => {
  const g = reelLayout(1440, 900, reelConfig, filmCrop[2] / filmCrop[3]);
  const samples = [0.1, 0.3, 0.6, 0.3, 0.1].map((p) => scenePose(p, 0, g, reelConfig));
  assert.deepEqual(samples[0], samples[4]);
  assert.deepEqual(samples[1], samples[3]);
  assert.equal(scenePose(-0.9, 0, g, reelConfig).opacity, 0);
  assert.equal(scenePose(0, 0, g, reelConfig).opacity, 1);
  assert.equal(scenePose(0.9, 0, g, reelConfig).opacity, 0);
  assert.equal(scenePose(2.4, 0, g, reelConfig).opacity, 0);
});

test('Narrowing preserves the restored film height and limits only its width', () => {
  for (const [wide, narrow, H, edge] of [
    [1440, 820, 1200, 24],
    [390, 260, 844, 16],
  ]) {
    const aspect = filmCrop[2] / filmCrop[3];
    const a = reelLayout(wide, H, reelConfig, aspect),
      b = reelLayout(narrow, H, reelConfig, aspect);
    assert.equal(a.frame.h, b.frame.h);
    assert.equal(b.frame.h, H * 0.4);
    assert.ok(b.frame.x >= edge && b.frame.x + b.frame.w <= narrow - edge);
    assert.ok(b.frame.w < a.frame.w);
  }
  const medium = reelLayout(1127, 882, reelConfig, filmCrop[2] / filmCrop[3]);
  assert.ok(medium.frame.w > 620 && medium.frame.w < 680);
});
