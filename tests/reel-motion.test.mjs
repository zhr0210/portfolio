import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reelConfig,
  filmCrop,
  referenceFrames,
} from '../experiments/ai-video/video-reel.config.js';
import { reelLayout, scenePose, referenceRect } from '../experiments/ai-video/reel-motion.js';

for (const [W, H] of [
  [2048, 1152],
  [1177, 1070],
  [390, 844],
  [844, 390],
]) {
  const g = reelLayout(W, H, reelConfig, filmCrop[2] / filmCrop[3]);
  test(`Videos stay separated while the incoming AI references arrive early: ${W}×${H}`, () => {
    for (let position = 0; position <= 1; position += 0.01) {
      const current = scenePose(position, 0, g, reelConfig),
        next = scenePose(position, 1, g, reelConfig);
      assert.ok(g.frame.y + current.y + g.frame.h < g.frame.y + next.y);
      if (g.frame.y + next.y >= H)
        assert.equal(next.connection, 0, 'No connection before video arrival');
    }
    const next = scenePose(0.3, 1, g, reelConfig);
    assert.ok(next.referenceOpacity > 0);
    assert.equal(next.connection, 0);
    assert.equal(scenePose(1, 1, g, reelConfig).connection, 1);
  });
  test(`Titles and parameters follow with parallax and stay outside the frame: ${W}×${H}`, () => {
    const p = scenePose(0.35, 0, g, reelConfig);
    assert.ok(p.titleY < p.y);
    assert.ok(p.metadataY > p.y);
    assert.ok(g.frame.x >= 0 && g.frame.x + g.frame.w <= W);
    assert.ok(g.frame.y >= 0 && g.frame.y + g.frame.h <= H);
    for (const [i, ref] of referenceFrames.entries())
      assert.ok(Number.isFinite(referenceRect(ref, i, g).y));
  });
}
test('The vertical timeline reverses continuously and fully fades outgoing companions', () => {
  const g = reelLayout(1440, 900, reelConfig, filmCrop[2] / filmCrop[3]);
  const samples = [0.1, 0.3, 0.6, 0.3, 0.1].map((p) => scenePose(p, 0, g, reelConfig));
  assert.deepEqual(samples[0], samples[4]);
  assert.deepEqual(samples[1], samples[3]);
  const out = scenePose(1, 0, g, reelConfig);
  assert.equal(out.opacity, 0);
  assert.equal(out.referenceOpacity, 0);
  assert.equal(out.connection, 0);
});
