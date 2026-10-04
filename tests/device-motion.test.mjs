import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, AnimationMixer, Group, LoopOnce, NumberKeyframeTrack } from 'three';
import { deviceProjection, deviceTime } from '../experiments/ai-video/device-motion.js';
import { sampleDeviceTimeline } from '../experiments/ai-video/device-layer.js';
import { reelConfig } from '../experiments/ai-video/video-reel.config.js';

const geometry = (W, H, mobile = false) => ({ W, H, mobile, frame: { h: H * 0.4 } });

test('Narrow windows crop the original device composition without changing its scale', () => {
  const wide = deviceProjection(geometry(1440, 900), 32.268);
  const narrow = deviceProjection(geometry(800, 900), 32.268);
  assert.equal(wide.fullHeight, narrow.fullHeight);
  assert.equal(wide.fullWidth, narrow.fullWidth);
  assert.equal(wide.fov, narrow.fov);
  assert.equal(narrow.offsetX - wide.offsetX, 320);
  assert.equal(narrow.offsetY, wide.offsetY);
});

test('Device projection follows video height and static camera framing, not scene travel', () => {
  const geo = geometry(900, 700);
  const initial = deviceProjection({ ...geo, travel: 450 }, 32.268);
  const changedTravel = deviceProjection({ ...geo, travel: 1900 }, 32.268);
  assert.deepEqual(initial, changedTravel);
  const shifted = deviceProjection(geo, 32.268, { offsetY: 0.1, size: 0.8 });
  assert.equal(shifted.fullHeight, 560);
  assert.equal(shifted.offsetY, (560 - 700) / 2 - 56);
});

test('Device sampling clamps endpoints and uses a fixed reduced-motion pose', () => {
  assert.equal(deviceTime(-1, 6), 0);
  assert.equal(deviceTime(2, 6), 6);
  assert.ok(Math.abs(deviceTime(0.1, 6, { reduced: true, reducedProgress: 0.4 }) - 2.4) < 1e-12);
  assert.equal(
    deviceTime(0.1, 6, { reduced: true, reducedProgress: 0.4 }),
    deviceTime(0.9, 6, { reduced: true, reducedProgress: 0.4 }),
  );
  assert.equal(deviceTime(NaN, 6), 0);
});

test('DPR is capped independently on desktop and phone without moving the source frame', () => {
  const desktop = deviceProjection(geometry(1440, 900), 32.268, {}, 3);
  const mobile = deviceProjection(geometry(390, 844, true), 32.268, {}, 3);
  assert.equal(desktop.pixelRatio, 1.5);
  assert.equal(mobile.pixelRatio, 1);
  assert.equal(mobile.fullHeight, 844);
  assert.equal(mobile.offsetY, 0);
});

test('Phone projection brings both devices into upper and lower lanes without changing timeline or FOV', () => {
  const geo = geometry(390, 844, true);
  const config = reelConfig.deviceLayer;
  const sony = deviceProjection(geo, 32.268, config, 3, 'sony');
  const pocket = deviceProjection(geo, 32.268, config, 3, 'pocket');
  assert.equal(sony.fullHeight, pocket.fullHeight);
  assert.equal(sony.fov, pocket.fov);
  assert.equal(sony.pixelRatio, 1);
  for (const [name, view] of [
    ['sony', sony],
    ['pocket', pocket],
  ]) {
    const slot = config.mobileComposition[name];
    assert.ok(Math.abs(view.fullWidth * slot.sourceX - view.offsetX - geo.W * slot.targetX) < 1e-8);
    assert.ok(
      Math.abs(view.fullHeight * slot.sourceY - view.offsetY - geo.H * slot.targetY) < 1e-8,
    );
  }
  const narrow = deviceProjection(geometry(320, 844, true), 32.268, config, 3, 'sony');
  assert.equal(narrow.fullHeight, sony.fullHeight);
});

test('Authored translation reverses after the exact LoopOnce endpoint', () => {
  const root = new Group();
  const sony = new Group();
  sony.name = 'Sony';
  root.add(sony);
  const mixer = new AnimationMixer(root);
  const clip = new AnimationClip('CaptureDevices', 6, [
    new NumberKeyframeTrack('Sony.position[y]', [0, 3, 6], [-2, 1, 4]),
  ]);
  const action = mixer.clipAction(clip);
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  sampleDeviceTimeline(mixer, [action], deviceTime(0.3, 6));
  const before = sony.position.y;
  sampleDeviceTimeline(mixer, [action], deviceTime(1, 6));
  assert.equal(sony.position.y, 4);
  assert.equal(action.paused, true);
  sampleDeviceTimeline(mixer, [action], deviceTime(0.3, 6));
  assert.equal(sony.position.y, before);
  sampleDeviceTimeline(mixer, [action], 0);
  assert.equal(sony.position.y, -2);
});
