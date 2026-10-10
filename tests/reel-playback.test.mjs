import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPlaybackScene } from '../experiments/ai-video/reel-playback.js';
import { reelConfig, reelWorks } from '../experiments/ai-video/video-reel.config.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { devicePose, deviceTime } from '../experiments/ai-video/device-motion.js';

test('Scroll exit keeps the outgoing video playing until the next ready film centers', () => {
  const previous = { scene: 'previous', visible: true, centered: true, ready: true };
  const next = { scene: 'next', visible: true, centered: false, ready: true };
  assert.equal(selectPlaybackScene([previous, next]), 'previous');
  assert.equal(selectPlaybackScene([previous, { ...next, centered: true }]), 'next');
  assert.equal(
    selectPlaybackScene([previous, { ...next, centered: true, ready: false }]),
    'previous',
  );
  assert.equal(selectPlaybackScene([{ ...previous, visible: false }, next]), null);
  assert.equal(selectPlaybackScene([previous, next], false), null);
  assert.equal(selectPlaybackScene([]), null);
});

test('The authored camera rotation advances at one third its previous scroll rate', () => {
  const { start, end } = reelConfig.deviceAnimation;
  assert.ok(Math.abs(end - start - 3 * 1.8) < 1e-12);
  for (const [name, range] of Object.entries(reelConfig.deviceLayer.animationRanges)) {
    const phase = reelConfig.deviceLayer.entryOffsets[name];
    const time = (delta, span) =>
      deviceTime(devicePose(0.4 + delta / span, 100, 900, { phase }).progress, range[1] - range[0]);
    assert.ok(
      Math.abs(
        (time(0.3, end - start) - time(0, end - start)) * 3 - (time(0.3, 1.8) - time(0, 1.8)),
      ) < 1e-10,
    );
  }
  assert.ok(reelConfig.deviceLayer.entryOffsets.sony > reelConfig.drone.phase);
  assert.ok(reelConfig.drone.phase > reelConfig.deviceLayer.entryOffsets.pocket);
});

test('All six configured preview videos are local, distinct, nonempty H.264 assets', () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL('../experiments/ai-video/assets/demo-films.metadata.json', import.meta.url),
    ),
  );
  assert.equal(manifest.realFootage, false);
  assert.equal(manifest.modelInference, false);
  assert.equal(reelWorks.length, 6);
  assert.equal(new Set(reelWorks.map((work) => work.video)).size, 6);
  for (const [i, work] of reelWorks.entries()) {
    assert.equal(work.demo, true);
    const bytes = readFileSync(new URL(work.video));
    assert.ok(bytes.length > 10000);
    assert.equal(bytes.subarray(4, 8).toString(), 'ftyp');
    assert.ok(bytes.includes(Buffer.from('avc1')));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.films[i].sha256);
  }
});
