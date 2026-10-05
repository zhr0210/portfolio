import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createRotationLoopClip } from '../experiments/ai-video/device-animation.js';
import { sampleDeviceTimeline } from '../experiments/ai-video/device-layer.js';

// Exercise the shipped animation, whose first/last XYZ orientations differ.
const bytes = readFileSync(
  new URL('../experiments/ai-video/assets/capture-devices.glb', import.meta.url),
);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binaryStart = 28 + jsonLength;
function floats(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  assert.equal(accessor.componentType, 5126);
  const start = binaryStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  return Array.from({ length: accessor.count * width }, (_, i) => bytes.readFloatLE(start + i * 4));
}
const source = new THREE.AnimationClip(
  'CaptureDevices',
  6,
  gltf.animations[0].channels.map((channel) => {
    const name = THREE.PropertyBinding.sanitizeNodeName(gltf.nodes[channel.target.node].name);
    const sampler = gltf.animations[0].samplers[channel.sampler];
    const rotation = channel.target.path === 'rotation';
    const Track = rotation ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
    return new Track(
      `${name}.${rotation ? 'quaternion' : 'position'}`,
      floats(sampler.input),
      floats(sampler.output),
    );
  }),
);
const devices = [
  { name: '动画控制器', start: 0, end: 4.5 },
  { name: '模型三轴旋转', start: 1.5, end: 6 },
];
const orientation = (track, time) =>
  new THREE.Quaternion().fromArray(track.createInterpolant().evaluate(time)).normalize();
const sameOrientation = (a, b, message) => {
  const angle = a.clone().normalize().angleTo(b.clone().normalize());
  assert.ok(angle < 1e-6, `${message}: angle ${angle}`);
};

test('Authored Sony and Pocket XYZ rotations close their real endpoint mismatch smoothly', () => {
  for (const { name, start, end } of devices) {
    const authored = source.tracks.find((track) => track.name === `${name}.quaternion`);
    assert.ok(
      orientation(authored, start).angleTo(orientation(authored, end)) > 1,
      `${name} would visibly jump if wrapped without a return`,
    );
    const clip = createRotationLoopClip(THREE, source, [name], start, end);
    const track = clip.tracks[0];
    assert.equal(clip.duration, end - start + 0.75);
    assert.deepEqual(
      clip.tracks.map((entry) => entry.name),
      [authored.name],
    );
    assert.deepEqual(Array.from(track.values.slice(-4)), Array.from(track.values.slice(0, 4)));
    for (const time of [start, ...authored.times, end])
      if (time >= start && time <= end)
        sameOrientation(
          orientation(track, time - start),
          orientation(authored, time),
          `${name} retains authored pose at ${time}`,
        );
    const epsilon = 1e-5;
    const before = orientation(track, clip.duration - epsilon);
    const after = orientation(track, epsilon);
    assert.ok(before.angleTo(after) < 0.001, `${name} has no visible seam`);
    const endpoint = orientation(track, end - start);
    const initial = orientation(track, 0);
    let remaining = endpoint.angleTo(initial);
    for (let index = 1; index <= 60; index++) {
      const q = orientation(track, end - start + (0.75 * index) / 60);
      assert.ok(Math.abs(q.length() - 1) < 1e-12, 'Return remains a valid rotation');
      const angle = q.angleTo(initial);
      assert.ok(angle <= remaining + 1e-6, 'Return follows one continuous shortest turn');
      remaining = angle;
    }
  }
});

test('XYZ loop sampling reverses through its return and finished endpoint without moving the device', () => {
  for (const { name, start, end } of devices) {
    const root = new THREE.Group();
    const device = new THREE.Group();
    device.name = name;
    device.position.set(7, -4, 2);
    root.add(device);
    const clip = createRotationLoopClip(THREE, source, [name], start, end);
    const mixer = new THREE.AnimationMixer(root);
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    const times = [0, 0.25, 2.75, end - start, clip.duration - 0.15, clip.duration];
    const poses = times.map((time) => {
      sampleDeviceTimeline(mixer, [action], time);
      return device.quaternion.clone();
    });
    assert.equal(action.paused, true, 'Test crosses the finished LoopOnce endpoint');
    for (let index = times.length - 1; index >= 0; index--) {
      sampleDeviceTimeline(mixer, [action], times[index]);
      sameOrientation(device.quaternion, poses[index], `${name} reverse pose at ${times[index]}`);
      assert.deepEqual(device.position.toArray(), [7, -4, 2]);
    }
    sameOrientation(poses.at(-1), poses[0], `${name} repeats only orientation`);
  }
});

test('Creating XYZ loops leaves source motion and all gimbal tracks untouched', () => {
  const original = source.tracks.map((track) => ({
    name: track.name,
    times: Array.from(track.times),
    values: Array.from(track.values),
  }));
  for (const { name, start, end } of devices) {
    const clip = createRotationLoopClip(THREE, source, [name], start, end);
    assert.ok(clip.tracks.every((track) => track.name === `${name}.quaternion`));
  }
  assert.deepEqual(
    source.tracks.map((track) => ({
      name: track.name,
      times: Array.from(track.times),
      values: Array.from(track.values),
    })),
    original,
  );
  assert.throws(
    () => createRotationLoopClip(THREE, source, ['missing'], 0, 4.5),
    /no requested XYZ rotation/,
  );
  assert.throws(
    () => createRotationLoopClip(THREE, source, ['动画控制器'], 4.5, 0),
    /valid authored range/,
  );
  assert.throws(
    () => createRotationLoopClip(THREE, source, ['动画控制器'], 0, 4.5, 0),
    /positive return duration/,
  );
});
