import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AnimationClip,
  AnimationMixer,
  Group,
  LoopOnce,
  Quaternion,
  QuaternionKeyframeTrack,
} from 'three';
import { sampleDeviceTimeline } from '../experiments/ai-video/device-layer.js';
import { reelConfig } from '../experiments/ai-video/video-reel.config.js';

const bytes = readFileSync(
  new URL('../experiments/ai-video/assets/capture-devices.glb', import.meta.url),
);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binaryStart = 28 + jsonLength;
const metadata = JSON.parse(
  readFileSync(
    new URL('../experiments/ai-video/assets/capture-devices.metadata.json', import.meta.url),
  ),
);
function floats(index) {
  const accessor = gltf.accessors[index],
    view = gltf.bufferViews[accessor.bufferView];
  const width = { SCALAR: 1, VEC4: 4 }[accessor.type];
  assert.equal(accessor.componentType, 5126);
  const start = binaryStart + (view.byteOffset || 0) + (accessor.byteOffset || 0);
  return Array.from({ length: accessor.count * width }, (_, i) => bytes.readFloatLE(start + i * 4));
}
function rotation(name) {
  const channel = gltf.animations[0].channels.find(
    (c) => gltf.nodes[c.target.node].name === name && c.target.path === 'rotation',
  );
  const sampler = gltf.animations[0].samplers[channel.sampler];
  return new QuaternionKeyframeTrack(
    `${name}.quaternion`,
    floats(sampler.input),
    floats(sampler.output),
  );
}
const pose = (track, frame) =>
  new Quaternion().fromArray(track.createInterpolant().evaluate(frame / 24)).normalize();

test('Both Blender rotations are doubled and sampled once over their complete finite ranges', () => {
  assert.deepEqual(metadata.timeline.sonyRange, [0, 216]);
  assert.deepEqual(metadata.timeline.pocketRange, [36, 252]);
  assert.equal(metadata.timeline.durationSeconds, 10.5);
  assert.deepEqual(reelConfig.deviceLayer.animationRanges, { sony: [0, 9], pocket: [1.5, 10.5] });
  assert.ok(!('rotationPeriod' in reelConfig.deviceLayer));
  for (const record of Object.values(metadata.motionExtension.devices)) {
    assert.equal(
      record.endFrame - record.startFrame,
      2 * (record.originalEndFrame - record.startFrame),
    );
    const track = rotation(record.control);
    assert.ok(
      pose(track, record.startFrame).angleTo(pose(track, record.endFrame)) < 1e-5,
      'Last pose matches initial orientation',
    );
    for (const axis of record.axes) {
      const turns = (axis.finalDegrees - axis.originalKeysDegrees[0][1]) / 360;
      assert.ok(
        Math.abs(turns - Math.round(turns)) < 1e-6,
        'XYZ endpoint uses whole forward turns',
      );
    }
  }
});

test('Baked Sony and Pocket extensions preserve forward winding without a shortest-path rollback', () => {
  const expected = { sony: [-315, 390, -500], pocket: [-257, 66, -448] };
  for (const [device, record] of Object.entries(metadata.motionExtension.devices)) {
    const track = rotation(record.control);
    assert.deepEqual(
      record.axes.map((axis) => axis.direction),
      [-1, 1, -1],
    );
    for (const [axis, value] of record.axes.entries())
      assert.ok(Math.abs(value.finalDegrees - expected[device][axis]) < 1e-4);
    for (const [index, sample] of record.extensionSamples.entries()) {
      const expectedPose = new Quaternion().fromArray(sample.gltfQuaternion).normalize();
      assert.ok(
        pose(track, sample.frame).angleTo(expectedPose) < 1e-5,
        `${device} exports its continued Euler rotation at frame ${sample.frame}`,
      );
      if (index) {
        const previous = record.extensionSamples[index - 1];
        for (const [axis, direction] of record.axes.entries())
          assert.ok(
            direction.direction * (sample.eulerDegrees[axis] - previous.eulerDegrees[axis]) >=
              -1e-4,
            'Each extended Euler axis keeps its original terminal direction',
          );
        assert.ok(
          pose(track, sample.frame).angleTo(pose(track, previous.frame)) < 0.3,
          'No single-frame full-turn jump',
        );
      }
    }
  }
});

test('Momentum is continuous across the authored endpoint and settles at the new final frame', () => {
  for (const record of Object.values(metadata.motionExtension.devices)) {
    const track = rotation(record.control),
      join = record.originalEndFrame,
      end = record.endFrame;
    const before = pose(track, join - 1).angleTo(pose(track, join));
    const after = pose(track, join).angleTo(pose(track, join + 1));
    assert.ok(before > 0.005, 'The old endpoint no longer stops the spin');
    assert.ok(Math.abs(after - before) / before < 0.2, 'No velocity jump at the join');
    const finalStep = pose(track, end - 1).angleTo(pose(track, end));
    const earlierStep = pose(track, end - 12).angleTo(pose(track, end - 11));
    assert.ok(finalStep < earlierStep * 0.15, 'The end eases into its resting orientation');
    assert.ok(finalStep < 0.01, 'Final frame has no visible snap');
  }
});

test('The full extended tracks reverse exactly after seeking their finite endpoint', () => {
  const root = new Group();
  const records = Object.values(metadata.motionExtension.devices);
  const controls = records.map((record) => {
    const node = new Group();
    node.name = record.control;
    root.add(node);
    return node;
  });
  const mixer = new AnimationMixer(root);
  const action = mixer.clipAction(
    new AnimationClip(
      'CaptureDevices',
      10.5,
      records.map((record) => rotation(record.control)),
    ),
  );
  action.setLoop(LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  sampleDeviceTimeline(mixer, [action], 7.25);
  const first = controls.map((node) => node.quaternion.toArray());
  sampleDeviceTimeline(mixer, [action], 10.5);
  sampleDeviceTimeline(mixer, [action], 0);
  sampleDeviceTimeline(mixer, [action], 7.25);
  assert.deepEqual(
    controls.map((node) => node.quaternion.toArray()),
    first,
  );
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
});
