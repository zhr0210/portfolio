import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, AnimationMixer, Group, LoopOnce, NumberKeyframeTrack } from 'three';
import {
  deviceLoopPose,
  deviceProjection,
  deviceTime,
} from '../experiments/ai-video/device-motion.js';
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

test('Device cycles wrap negative progress and repeat after any whole number of turns', () => {
  const initial = deviceLoopPose(0.125, 140, 900);
  for (const cycles of [-3.875, -0.875, 1.125, 1000000.125])
    assert.deepEqual(deviceLoopPose(cycles, 140, 900), initial);
  assert.equal(deviceLoopPose(-0.25, 140, 900).progress, 0.75);
  assert.equal(deviceLoopPose(-1, 140, 900).progress, 0);
  assert.deepEqual(deviceLoopPose(NaN, 140, 900), deviceLoopPose(0, 140, 900));
  assert.deepEqual(deviceLoopPose(Infinity, 140, 900), deviceLoopPose(0, 140, 900));
  assert.deepEqual(
    deviceLoopPose(NaN, 140, 900, { phase: 0.125 }),
    deviceLoopPose(0.125, 140, 900),
  );
  assert.deepEqual(deviceLoopPose(0.125, 140, 900, { phase: NaN }), initial);
});

test('Forward and reverse scroll sample the same loop pose across both wrap directions', () => {
  const cycles = [-1.125, -0.875, -0.125, 0.125, 0.875, 1.125, 1.875];
  const forward = cycles.map((value) => deviceLoopPose(value, 210, 844, { phase: 0.125 }));
  const reversed = [...cycles]
    .reverse()
    .map((value) => deviceLoopPose(value, 210, 844, { phase: 0.125 }));
  assert.deepEqual(reversed.reverse(), forward);
  for (let index = 1; index < forward.length; index++) {
    if (forward[index].progress > forward[index - 1].progress)
      assert.ok(forward[index].y < forward[index - 1].y);
  }
});

test('Both sides of a cycle reset keep the entire projected radius outside the viewport', () => {
  for (const [height, radius] of [
    [900, 140],
    [844, 210],
    [320, 300],
  ]) {
    const entering = deviceLoopPose(0, radius, height);
    const exiting = deviceLoopPose(-1e-8, radius, height);
    assert.ok(entering.y - radius > height, 'The lower edge begins entirely below the frame');
    assert.ok(exiting.y + radius < 0, 'The upper edge exits entirely above the frame');
    assert.equal(entering.travel, height + 2 * (radius + 8));
    assert.equal(deviceLoopPose(0.5, radius, height).y, height / 2);
  }
});

test('Reduced motion fixes the loop pose regardless of scroll or device phase', () => {
  const pose = deviceLoopPose(0, 140, 900, { reduced: true });
  for (const [cycles, phase] of [
    [-100.125, -0.04],
    [0.375, 0.12],
    [1000.75, 0.9],
  ])
    assert.deepEqual(deviceLoopPose(cycles, 140, 900, { reduced: true, phase }), pose);
  assert.equal(pose.progress, 0.5);
  assert.equal(pose.y, 450);
});

test('DPR is capped independently on desktop and phone without moving the source frame', () => {
  const desktop = deviceProjection(geometry(1440, 900), 32.268, {}, 3);
  const mobile = deviceProjection(geometry(390, 844, true), 32.268, {}, 3);
  assert.equal(desktop.pixelRatio, 1.5);
  assert.equal(mobile.pixelRatio, 1);
  assert.equal(mobile.fullHeight, 844);
  assert.equal(mobile.offsetY, 0);
});

test('Desktop devices spread across the 16:9 composition and retain their lanes when cropped', () => {
  const config = reelConfig.deviceLayer;
  const wide = geometry(1600, 900);
  const narrow = geometry(800, 900);
  const projections = {};
  for (const name of ['sony', 'pocket']) {
    const slot = config.desktopComposition[name];
    const original = deviceProjection(wide, 32.268, config, 1, name);
    const cropped = deviceProjection(narrow, 32.268, config, 1, name);
    const originalX = original.fullWidth * slot.sourceX - original.offsetX;
    const croppedX = cropped.fullWidth * slot.sourceX - cropped.offsetX;
    assert.ok(Math.abs(originalX - wide.W * slot.targetX) < 1e-8);
    assert.equal(cropped.fullWidth, original.fullWidth);
    assert.equal(cropped.fullHeight, original.fullHeight);
    assert.equal(cropped.fov, original.fov);
    assert.ok(Math.abs(croppedX - (originalX - (wide.W - narrow.W) / 2)) < 1e-8);
    projections[name] = { originalX, croppedX };
  }
  assert.ok(projections.sony.originalX < wide.W * 0.2);
  assert.ok(projections.pocket.originalX > wide.W * 0.8);
  assert.ok(
    projections.sony.croppedX < 0,
    'The left device can be cropped outside a narrow window',
  );
  assert.ok(
    projections.pocket.croppedX > narrow.W,
    'The right device can be cropped outside a narrow window',
  );
  assert.ok(
    Math.abs(
      projections.pocket.originalX -
        projections.sony.originalX -
        (projections.pocket.croppedX - projections.sony.croppedX),
    ) < 1e-8,
    'Window cropping must not pull the devices toward the video',
  );
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
