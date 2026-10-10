import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createDroneRig } from '../experiments/ai-video/drone-rig.js';

const bytes = readFileSync(
  new URL('../experiments/ai-video/assets/mavic-3-pro.glb', import.meta.url),
);
const metadata = JSON.parse(
  readFileSync(
    new URL('../experiments/ai-video/assets/mavic-3-pro.metadata.json', import.meta.url),
  ),
);
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
function sourceRig() {
  const nodes = json.nodes.map((n) => {
    const node = new THREE.Group();
    node.name = n.name;
    if (n.translation) node.position.fromArray(n.translation);
    if (n.rotation) node.quaternion.fromArray(n.rotation);
    if (n.scale) node.scale.fromArray(n.scale);
    if (n.mesh !== undefined)
      for (const primitive of json.meshes[n.mesh].primitives) {
        const a = json.accessors[primitive.attributes.POSITION];
        const size = a.max.map((x, i) => x - a.min[i]);
        const center = a.max.map((x, i) => (x + a.min[i]) / 2);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
        mesh.position.fromArray(center);
        node.add(mesh);
      }
    return node;
  });
  json.nodes.forEach((n, i) => n.children?.forEach((c) => nodes[i].add(nodes[c])));
  const root = new THREE.Group();
  json.scenes[0].nodes.forEach((i) => root.add(nodes[i]));
  root.updateMatrixWorld(true);
  return { root, nodes };
}
test('The supplied unfolded drone keeps its original geometry and embedded textures', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sourceSha256);
  assert.equal(bytes.length, metadata.bytes);
  assert.equal(json.images.length, 3);
  assert.ok(json.images.every((image) => Number.isInteger(image.bufferView)));
  assert.equal(json.animations?.length || 0, 0);
  for (const name of ['桨叶1', '桨叶2', '桨叶3', '桨叶4'])
    assert.equal(json.nodes.filter((n) => n.name === name).length, 1);
});
test('Rotor hubs and blades follow authored motor shafts while housings stay attached during a full revolution', () => {
  const { root, nodes } = sourceRig();
  const initial = nodes.map((node) => node.matrixWorld.clone());
  const rig = createDroneRig(THREE, root);
  rig.sample(0);
  assert.equal(rig.rotors.length, 4);
  nodes.forEach((node, i) =>
    node.matrixWorld.elements.forEach((value, j) =>
      assert.ok(Math.abs(value - initial[i].elements[j]) < 1e-8),
    ),
  );
  const moving = new Set(rig.rotors.flatMap((rotor) => rotor.parts));
  const fixed = nodes.filter((node) => !moving.has(node));
  for (const rotor of rig.rotors) {
    const axis = rotor.axis
      .clone()
      .applyQuaternion(rotor.pivot.parent.getWorldQuaternion(new THREE.Quaternion()).normalize());
    const tilt = (axis.angleTo(new THREE.Vector3(0, 1, 0)) * 180) / Math.PI;
    assert.ok(tilt > 7 && tilt < 9);
    assert.deepEqual(rotor.pivot.position.toArray(), [0, 0, 0]);
    assert.ok(rotor.parts.every((part) => part.parent === rotor.pivot));
  }
  const shaftSamples = rig.rotors.map((rotor) =>
    rotor.parts.map((part) => {
      const local = rotor.pivot.parent.worldToLocal(part.getWorldPosition(new THREE.Vector3()));
      return { axial: local.z, radius: Math.hypot(local.x, local.y) };
    }),
  );
  for (let i = 1; i <= 16; i++) {
    rig.sample((i * Math.PI) / 8);
    for (const node of fixed)
      node.matrixWorld.elements.forEach((value, k) =>
        assert.ok(Math.abs(value - initial[nodes.indexOf(node)].elements[k]) < 1e-8),
      );
    rig.rotors.forEach((rotor, r) =>
      rotor.parts.forEach((part, p) => {
        const local = rotor.pivot.parent.worldToLocal(part.getWorldPosition(new THREE.Vector3()));
        assert.ok(Math.abs(local.z - shaftSamples[r][p].axial) < 1e-5);
        assert.ok(Math.abs(Math.hypot(local.x, local.y) - shaftSamples[r][p].radius) < 1e-5);
      }),
    );
  }
  // The complete assembly is tilted/scaled by flight, never the rotors alone.
  root.rotation.set(0.4, -0.2, 0.15);
  root.scale.setScalar(2);
  root.position.set(10, 3, -2);
  root.updateMatrixWorld(true);
  const motorPositions = rig.rotors.map((rotor) =>
    rotor.pivot.parent.getWorldPosition(new THREE.Vector3()),
  );
  rig.sample(Math.PI / 2);
  rig.rotors.forEach((rotor, i) => {
    assert.ok(
      rotor.pivot.getWorldPosition(new THREE.Vector3()).distanceTo(motorPositions[i]) < 1e-8,
    );
    assert.ok(
      rotor.pivot.parent.getWorldPosition(new THREE.Vector3()).distanceTo(motorPositions[i]) < 1e-8,
    );
  });
  root.rotation.set(0, 0, 0);
  root.scale.setScalar(1);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  rig.sample(0);
  nodes.forEach((node, i) =>
    node.matrixWorld.elements.forEach((value, j) =>
      assert.ok(Math.abs(value - initial[i].elements[j]) < 1e-8),
    ),
  );
});
