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
    assert.ok(g.travel < H * 1.36, 'The two scenes are closer than the retired layout');
  });
  test(`Titles and parameters follow with parallax and stay outside the frame: ${W}×${H}`, () => {
    const p = scenePose(0.35, 0, g, reelConfig);
    assert.ok(p.titleY < p.y);
    assert.ok(p.metadataY > p.y);
    assert.ok(g.frame.x >= 0 && g.frame.x + g.frame.w <= W);
    assert.ok(g.frame.y >= 0 && g.frame.y + g.frame.h <= H);
    for (const [i, ref] of referenceFrames.entries())
      assert.ok(Number.isFinite(referenceRect(ref, i, g, reelConfig).y));
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

test('Narrowing a desktop window preserves height-led film and reference sizes until the side limit', () => {
  const aspect = filmCrop[2] / filmCrop[3];
  const layouts = [1440, 1200, 1100].map((W) => reelLayout(W, 1200, reelConfig, aspect));
  assert.equal(layouts[0].frame.h, layouts[2].frame.h);
  const widths = layouts.map((g) => referenceRect(referenceFrames[1], 1, g, reelConfig).w);
  assert.equal(widths[0], widths[2]);
  const offsets = layouts.map(
    (g) => referenceRect(referenceFrames[1], 1, g, reelConfig).x - g.W / 2,
  );
  assert.ok(Math.abs(offsets[0] - offsets[2]) < 1e-8, 'References stay in the same composition');
  const narrow = reelLayout(820, 1200, reelConfig, aspect);
  assert.equal(
    narrow.frame.h,
    layouts[0].frame.h,
    'The side limit must not shrink the film height',
  );
  assert.ok(narrow.frame.x >= 24 && narrow.frame.x + narrow.frame.w <= 796);
  assert.ok(narrow.frame.w < layouts[0].frame.w, 'The side limit must constrain the width');
  const ref = referenceRect(referenceFrames[1], 1, narrow, reelConfig);
  assert.ok(ref.x < 0, 'References can leave the window instead of following its side boundary');
  assert.ok(ref.w / narrow.W > widths[0] / layouts[0].W);
});

test('Phone side boundaries preserve the medium film height while limiting the width', () => {
  const g = reelLayout(390, 844, reelConfig, filmCrop[2] / filmCrop[3]);
  assert.equal(g.frame.h, 844 * reelConfig.videoHeight);
  assert.ok(g.frame.x >= 16 && g.frame.x + g.frame.w <= 374);
  assert.ok(g.frame.h / g.H < 0.45, 'The phone film should retain the restored medium size');
  const narrower = reelLayout(260, 844, reelConfig, filmCrop[2] / filmCrop[3]);
  const wideRef = referenceRect(referenceFrames[1], 1, g, reelConfig),
    narrowRef = referenceRect(referenceFrames[1], 1, narrower, reelConfig);
  assert.equal(wideRef.w, narrowRef.w, 'Narrow phones crop the nodes without shrinking them');
  assert.ok(Math.abs(wideRef.x - g.W / 2 - (narrowRef.x - narrower.W / 2)) < 1e-8);
});

test('Portrait phones place reference groups above and below the video', () => {
  for (const [W, H] of [
    [390, 844],
    [360, 640],
    [720, 1280],
  ]) {
    const g = reelLayout(W, H, reelConfig, filmCrop[2] / filmCrop[3]);
    for (const [i, ref] of referenceFrames.entries()) {
      const rect = referenceRect(ref, i, g, reelConfig),
        center = rect.y + rect.h / 2;
      if (ref.side === 'left') assert.ok(center < g.frame.y);
      else assert.ok(center > g.frame.y + g.frame.h);
    }
  }
});

test('The restored medium film and references fade in gradually with a slightly longer scene gap', () => {
  const g = reelLayout(1127, 882, reelConfig, filmCrop[2] / filmCrop[3]);
  let previous = scenePose(0, 1, g, reelConfig);
  for (let position = 0.01; position <= 1; position += 0.01) {
    const next = scenePose(position, 1, g, reelConfig);
    assert.ok(next.opacity >= previous.opacity);
    assert.ok(next.referenceOpacity >= previous.referenceOpacity);
    assert.ok(next.opacity - previous.opacity < 0.025);
    assert.ok(next.referenceOpacity - previous.referenceOpacity < 0.025);
    assert.ok(next.y < previous.y && next.referenceY < previous.referenceY);
    previous = next;
  }
  assert.ok(g.frame.w > 620 && g.frame.w < 680, 'Restore the original roughly 640px film');
  assert.ok(g.frame.h > 330 && g.frame.h < 370);
  assert.ok(g.travel - g.frame.h > 882 * 0.25, 'Slightly increase the previous scene gap');
});
