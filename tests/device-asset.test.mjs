import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AnimationClip,
  AnimationMixer,
  Group,
  LoopOnce,
  PropertyBinding,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three';
import { sampleDeviceTimeline } from '../experiments/ai-video/device-layer.js';

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
const animation = gltf.animations[0];
const channel = (name, path) =>
  animation.channels.find((c) => gltf.nodes[c.target.node].name === name && c.target.path === path);
function samples(name, path) {
  const sampler = animation.samplers[channel(name, path).sampler];
  return { time: floats(sampler.input), values: floats(sampler.output) };
}

test('The shipped asset contains only the two finished devices and the sampled shared timeline', () => {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 6 * 1024 * 1024);
  const names = gltf.nodes.map((node) => node.name);
  for (const required of ['z轴移动', '空物体', 'sourceCamera']) assert.ok(names.includes(required));
  for (const excluded of ['Cam tilt', 'mesh_18_217.nr', 'mesh_18_220.nr', 'mesh_0_0.nr'])
    assert.ok(!names.includes(excluded));
  assert.ok(!names.some((name) => name?.includes('无人机')));
  assert.equal(gltf.animations.length, 1);
  assert.equal(animation.name, 'CaptureDevices');
  assert.equal(gltf.meshes.length, 172);
  for (const sampler of animation.samplers) {
    const times = floats(sampler.input);
    assert.equal(times.length, 145);
    assert.equal(times[0], 0);
    assert.equal(times.at(-1), 6);
    assert.equal(sampler.interpolation, 'LINEAR');
  }
  const pocket = samples('z轴移动.001', 'translation').values;
  assert.deepEqual(
    pocket.slice(0, 3),
    pocket.slice(36 * 3, 37 * 3),
    'Pocket retains its 36-frame delay',
  );
  assert.notDeepEqual(pocket.slice(36 * 3, 37 * 3), pocket.slice(90 * 3, 91 * 3));
  const sony = samples('z轴移动', 'translation').values;
  assert.deepEqual(sony.slice(108 * 3, 109 * 3), sony.slice(144 * 3, 145 * 3));
  for (const control of ['x轴稳定', '镜头模组', '零件控制器'])
    assert.ok(channel(control, 'rotation'));
});

test('The actual Sony, Pocket and gimbal tracks return to the same pose after the final frame', () => {
  const root = new Group();
  const targets = new Map();
  const tracks = animation.channels.map((entry) => {
    const name = PropertyBinding.sanitizeNodeName(gltf.nodes[entry.target.node].name);
    if (!targets.has(name)) {
      const object = new Group();
      object.name = name;
      root.add(object);
      targets.set(name, object);
    }
    const sampler = animation.samplers[entry.sampler];
    const Track = entry.target.path === 'rotation' ? QuaternionKeyframeTrack : VectorKeyframeTrack;
    return new Track(
      `${name}.${entry.target.path === 'rotation' ? 'quaternion' : 'position'}`,
      floats(sampler.input),
      floats(sampler.output),
    );
  });
  const mixer = new AnimationMixer(root);
  const action = mixer.clipAction(new AnimationClip('CaptureDevices', 6, tracks));
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const pose = () =>
    Array.from(targets.values(), (object) => [
      ...object.position.toArray(),
      ...object.quaternion.toArray(),
    ]);
  sampleDeviceTimeline(mixer, [action], 2.25);
  const first = pose();
  sampleDeviceTimeline(mixer, [action], 6);
  sampleDeviceTimeline(mixer, [action], 0);
  sampleDeviceTimeline(mixer, [action], 2.25);
  for (const [i, values] of pose().entries())
    for (const [j, value] of values.entries())
      assert.ok(Math.abs(value - first[i][j]) < 1e-12, `Track ${i}, component ${j} reverses`);
});
