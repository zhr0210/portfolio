import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { releaseScene } from '../experiments/ai-video/device-layer.js';
import { reelConfig } from '../experiments/ai-video/video-reel.config.js';
import { createDroneRig, rotorControllers, rotorPhase } from '../experiments/ai-video/drone-rig.js';
const asset = new URL('../experiments/ai-video/assets/mavic-3-pro.glb', import.meta.url);
const bytes = readFileSync(asset);
const metadata = JSON.parse(
  readFileSync(
    new URL('../experiments/ai-video/assets/mavic-3-pro.metadata.json', import.meta.url),
  ),
);
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
function sourceRig() {
  const nodes = json.nodes.map((n) => {
    const o = new THREE.Group();
    o.name = n.name;
    o.userData = structuredClone(n.extras || {});
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  json.nodes.forEach((n, i) => n.children?.forEach((c) => nodes[i].add(nodes[c])));
  const root = new THREE.Group();
  json.scenes[json.scene || 0].nodes.forEach((i) => root.add(nodes[i]));
  root.updateMatrixWorld(true);
  return { root, nodes };
}
test('Drone asset comes from the supplied Blender backup with four original actions and lossless native textures', () => {
  assert.equal(metadata.sourceFile, 'camera 无人机.blend1');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.assetSha256);
  assert.equal(bytes.length, metadata.bytes);
  assert.equal(json.nodes.filter((n) => n.mesh !== undefined).length, metadata.meshes);
  const animated = new Set(json.animations[0].channels.map((c) => json.nodes[c.target.node].name));
  assert.deepEqual([...animated].sort(), [...rotorControllers].sort());
  assert.equal(json.animations.length, 1);
  assert.ok(!json.nodes.some((n) => /^ReelRotor/.test(n.name)));
  const binaryOffset = 28 + bytes.readUInt32LE(12);
  const sizes = new Set(metadata.textures.map((t) => t.sourceSize.join('x')));
  for (const image of json.images) {
    assert.equal(image.mimeType, 'image/png');
    const view = json.bufferViews[image.bufferView];
    const start = binaryOffset + (view.byteOffset || 0);
    assert.equal(bytes.subarray(start, start + 8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(sizes.has(`${bytes.readUInt32BE(start + 16)}x${bytes.readUInt32BE(start + 20)}`));
  }
});
test('Every source mesh matches Blender vertex poses at six authored times without fitting or reparenting', () => {
  const { root, nodes } = sourceRig();
  const parents = nodes.map((n) => n.parent);
  const local = nodes.map((n) => n.matrix.clone());
  const rig = createDroneRig(THREE, root);
  rig.sample(0);
  nodes.forEach((n, i) => {
    assert.equal(n.parent, parents[i]);
    assert.ok(n.matrix.equals(local[i]), `zero pose moved ${n.name}`);
  });
  let maxError = 0;
  for (const check of metadata.sourcePoseChecks) {
    rig.sample(check.seconds);
    for (const mesh of check.meshes) {
      const node = root.getObjectByName(mesh.mesh);
      assert.ok(node, mesh.mesh);
      for (const point of mesh.points) {
        const actual = new THREE.Vector3().fromArray(point.local).applyMatrix4(node.matrixWorld);
        const error = actual.distanceTo(new THREE.Vector3().fromArray(point.world));
        maxError = Math.max(maxError, error);
        assert.ok(error < 0.001, `${mesh.mesh} frame ${check.frame}: ${error}`);
      }
    }
  }
  assert.ok(maxError < 0.001);
});
test('Production GLTFLoader hierarchy matches Blender during flight; headless textures do not change transforms', async () => {
  // Parse the real geometry/hierarchy with the production loader. Only GPU
  // image decoding is stubbed; embedded image bytes are checked separately.
  const loader = new GLTFLoader().register(() => ({
    name: 'HEADLESS_TEXTURE_DECODE',
    loadTexture() {
      return Promise.resolve(new THREE.Texture());
    },
  }));
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  const source = gltf.scene;
  const original = new Map();
  source.traverse((o) => {
    const id = gltf.parser.associations.get(o)?.nodes;
    if (id !== undefined) original.set(json.nodes[id].name, o);
  });
  const rig = createDroneRig(THREE, source);
  const bounds = new THREE.Box3().setFromObject(source);
  source.position.sub(bounds.getCenter(new THREE.Vector3()));
  const model = new THREE.Group(),
    attitude = new THREE.Group();
  attitude.rotation.set(...reelConfig.drone.rotation);
  attitude.rotateY(reelConfig.drone.sourceYaw);
  attitude.add(source);
  model.add(attitude);
  model.scale.setScalar(0.9);
  model.position.set(250, -100, 0);
  model.rotation.set(0.06, -0.02, 0.04);
  model.updateMatrixWorld(true);
  const nose = new THREE.Box3().setFromObject(original.get('JT')).getCenter(new THREE.Vector3());
  const body = new THREE.Box3().setFromObject(original.get('机身')).getCenter(new THREE.Vector3());
  const forward = nose.sub(body).normalize();
  assert.ok(forward.z > 0.7, 'the Blender drone nose must face the +Z web camera');
  for (const check of metadata.sourcePoseChecks) {
    rig.sample(check.seconds);
    for (const mesh of check.meshes) {
      const object = original.get(mesh.mesh);
      assert.ok(object, mesh.mesh);
      for (const point of mesh.points) {
        const actual = new THREE.Vector3().fromArray(point.local).applyMatrix4(object.matrixWorld);
        const expected = new THREE.Vector3()
          .fromArray(point.world)
          .applyMatrix4(source.matrixWorld);
        assert.ok(
          actual.distanceTo(expected) < 0.001,
          `GLTFLoader ${mesh.mesh} frame ${check.frame}`,
        );
      }
    }
  }
  releaseScene(model);
});
test('Portable GLB rotation tracks match the runtime at every authored frame, starting at time zero', () => {
  const { root } = sourceRig();
  const rig = createDroneRig(THREE, root);
  const binaryOffset = 28 + bytes.readUInt32LE(12);
  function values(id) {
    const a = json.accessors[id],
      view = json.bufferViews[a.bufferView];
    const width = a.type === 'VEC4' ? 4 : 1;
    const start = binaryOffset + (view.byteOffset || 0) + (a.byteOffset || 0);
    return Array.from({ length: a.count }, (_, i) =>
      Array.from({ length: width }, (_, c) =>
        bytes.readFloatLE(start + i * (view.byteStride || width * 4) + c * 4),
      ),
    );
  }
  const clip = json.animations[0];
  const tracks = clip.channels.filter((c) => c.target.path === 'rotation');
  assert.equal(tracks.length, 4);
  for (const channel of tracks) {
    const sampler = clip.samplers[channel.sampler];
    const times = values(sampler.input),
      quaternions = values(sampler.output);
    assert.equal(times[0][0], 0);
    assert.ok(Math.abs(times.at(-1)[0] - 251 / 24) < 1e-6);
    const controller = root.getObjectByName(json.nodes[channel.target.node].name);
    for (let i = 0; i < times.length; i++) {
      rig.sample(i / 24);
      assert.ok(
        controller.quaternion.angleTo(
          new THREE.Quaternion().fromArray(quaternions[i]).normalize(),
        ) < 1e-5,
      );
    }
  }
});
test('Flight transforms preserve the authored assembly; only controller descendants rotate', () => {
  const { root, nodes } = sourceRig();
  const model = new THREE.Group(),
    attitude = new THREE.Group();
  model.add(attitude);
  attitude.add(root);
  root.position.set(-60, 23, -10);
  attitude.rotation.set(0.38, -0.48, 0.08);
  model.scale.setScalar(1.7);
  model.position.set(420, -90, 35);
  model.rotation.set(0.06, -0.04, 0.025);
  const rig = createDroneRig(THREE, root);
  model.updateMatrixWorld(true);
  const rest = nodes.map((n) => n.matrixWorld.clone());
  const owner = (n) =>
    rig.rotors.find((r) => {
      for (let p = n; p; p = p.parent) if (p === r.pivot) return true;
      return false;
    });
  const relation = new Map(
    nodes
      .filter(owner)
      .map((n) => [n, owner(n).pivot.matrixWorld.clone().invert().multiply(n.matrixWorld)]),
  );
  for (const time of [0.2, 0.7, 2, 5, 9, 10.459, 10.461, 31]) {
    rig.sample(time);
    for (const [i, n] of nodes.entries()) {
      const rotor = owner(n);
      const actual = rotor
        ? rotor.pivot.matrixWorld.clone().invert().multiply(n.matrixWorld)
        : n.matrixWorld;
      const expected = rotor ? relation.get(n) : rest[i];
      assert.ok(
        actual.elements.every((v, k) => Math.abs(v - expected.elements[k]) < 1e-8),
        n.name,
      );
    }
  }
});
test('Non-integral revolutions continue at terminal speed without the 120-degree reset', () => {
  const { root } = sourceRig();
  const rig = createDroneRig(THREE, root);
  for (const { timeline } of rig.rotors) {
    const duration = (timeline.samples.length - 1) / timeline.fps;
    const total = timeline.samples.at(-1) - timeline.samples[0];
    assert.ok(Math.abs(total / (2 * Math.PI) - 100 / 3) < 1e-5);
    const speed = (timeline.samples.at(-1) - timeline.samples.at(-2)) * timeline.fps;
    assert.ok(
      Math.abs(rotorPhase(timeline, duration - 1e-5) - rotorPhase(timeline, duration + 1e-5)) <
        speed * 2.01e-5,
    );
    assert.ok(
      Math.abs(rotorPhase(timeline, duration * 3) - (total + speed * duration * 2)) < 1e-10,
    );
  }
  rig.sample(2);
  const q = rig.rotors.map((r) => r.pivot.quaternion.clone());
  rig.sample(27);
  rig.sample(2);
  rig.rotors.forEach((r, i) => assert.ok(r.pivot.quaternion.angleTo(q[i]) < 1e-7));
});
