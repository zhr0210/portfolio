import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3 } from 'three';

const asset = new URL('../experiments/mavic-unfold/assets/mavic-3-unfold.glb', import.meta.url);
const file = readFileSync(asset);
const size = file.readUInt32LE(12);
const gltf = JSON.parse(file.subarray(20, 20 + size));
const binary = file.subarray(28 + size);
const metadata = JSON.parse(
  readFileSync(
    new URL('../experiments/mavic-unfold/assets/mavic-3-unfold.metadata.json', import.meta.url),
  ),
);
function values(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const components = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
  assert.equal(accessor.componentType, 5126);
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return Array.from({ length: accessor.count * components }, (_, i) =>
    binary.readFloatLE(start + i * 4),
  );
}
function pose(t) {
  const nodes = gltf.nodes.map((node) => ({ ...node }));
  for (const animation of gltf.animations)
    for (const channel of animation.channels) {
      const sampler = animation.samplers[channel.sampler];
      const times = values(sampler.input),
        data = values(sampler.output);
      const width = channel.target.path === 'rotation' ? 4 : 3;
      let i = times.findIndex((time) => time >= t);
      if (i < 0) i = times.length - 1;
      nodes[channel.target.node][channel.target.path] = data.slice(i * width, (i + 1) * width);
    }
  const world = [];
  function walk(id, parent) {
    const n = nodes[id];
    const local = new Matrix4().compose(
      new Vector3(...(n.translation ?? [0, 0, 0])),
      new Quaternion(...(n.rotation ?? [0, 0, 0, 1])),
      new Vector3(...(n.scale ?? [1, 1, 1])),
    );
    world[id] = parent.clone().multiply(local);
    for (const child of n.children ?? []) walk(child, world[id]);
  }
  for (const id of gltf.scenes[gltf.scene ?? 0].nodes) walk(id, new Matrix4());
  return { nodes, world };
}

test('Mavic GLB retains the complete source geometry and embeds its textures', () => {
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.equal(file.readUInt32LE(8), file.length);
  let triangles = 0;
  for (const mesh of gltf.meshes)
    for (const p of mesh.primitives) {
      assert.ok(p.attributes.TEXCOORD_0 !== undefined);
      assert.ok(p.attributes.NORMAL !== undefined);
      triangles += gltf.accessors[p.indices].count / 3;
    }
  assert.equal(triangles, metadata.triangles);
  assert.equal(triangles, 127011);
  assert.ok(gltf.images.length >= 4);
  assert.ok(gltf.images.every((i) => i.bufferView !== undefined && !i.uri));
  assert.ok(gltf.meshes.length < 160, 'Fastener seams must not create hundreds of draw calls');
});

test('Four independent arms and eight blade hinges are baked over ten seconds', () => {
  const armIndices = gltf.nodes.flatMap((n, i) => (n.name?.startsWith('Hinge_') ? [i] : []));
  const bladeIndices = gltf.nodes.flatMap((n, i) => (n.name?.startsWith('Blade_') ? [i] : []));
  assert.equal(armIndices.length, 4);
  assert.equal(bladeIndices.length, 8);
  for (const blade of bladeIndices)
    assert.ok(armIndices.some((arm) => gltf.nodes[arm].children.includes(blade)));
  const tracks = gltf.animations.flatMap((a) => a.channels.map((c) => [c, a.samplers[c.sampler]]));
  for (const id of [...armIndices, ...bladeIndices]) {
    const [, track] = tracks.find(([c]) => c.target.node === id && c.target.path === 'rotation');
    const timestamps = values(track.input),
      rotations = values(track.output);
    assert.equal(timestamps[0], 0);
    assert.equal(timestamps.at(-1), 10);
    assert.equal(timestamps.length, 301);
    for (let i = 0; i < rotations.length; i += 4) {
      const q = rotations.slice(i, i + 4);
      assert.ok(q.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-5);
    }
    assert.ok(
      Math.abs(rotations.at(-1)) > 0.99999,
      'Every hinge must return to the exact source open pose',
    );
  }
});

test('Folded front motors sit above the deck; rear arms lead and reverse sampling is stable', () => {
  const folded = pose(0),
    mid = pose(6),
    open = pose(10),
    reverse = pose(6);
  for (const suffix of ['L', 'R']) {
    const arm = gltf.nodes.findIndex((n) => n.name === 'Hinge_Front_' + suffix);
    const rear = gltf.nodes.findIndex((n) => n.name === 'Hinge_Rear_' + suffix);
    const motorPart = suffix === 'L' ? 'Part_029' : 'Part_049';
    const motor = gltf.nodes.findIndex((n) => n.name === motorPart);
    const accessor =
      gltf.accessors[gltf.meshes[gltf.nodes[motor].mesh].primitives[0].attributes.POSITION];
    const point = new Vector3(...accessor.min)
      .add(new Vector3(...accessor.max))
      .multiplyScalar(0.5);
    assert.ok(
      point.clone().applyMatrix4(folded.world[motor]).y > 0.045,
      'Folded motor must clear the fuselage deck',
    );
    assert.ok(point.clone().applyMatrix4(open.world[motor]).y < 0.03);
    assert.ok(
      folded.nodes[arm].rotation.every((v, i) => Math.abs(v - mid.nodes[arm].rotation[i]) < 1e-6),
      'Front arms wait for the rear arms',
    );
    assert.notDeepEqual(folded.nodes[rear].rotation, mid.nodes[rear].rotation);
    assert.deepEqual(mid.world[arm].elements, reverse.world[arm].elements);
    assert.deepEqual(mid.world[rear].elements, reverse.world[rear].elements);
  }
});
