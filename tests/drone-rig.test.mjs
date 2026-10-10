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
test('Locking plates, collars, pins and blades stay assembled on centered shafts during a full revolution', () => {
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
    const plateAxis = new THREE.Vector3(0, 0, -1).applyQuaternion(
      rotor.plate.getWorldQuaternion(new THREE.Quaternion()),
    );
    assert.ok(axis.angleTo(plateAxis) < 1e-7, 'shaft follows actual plate normal');
    assert.ok(
      rotor.axis.angleTo(new THREE.Vector3(0, 0, -1)) > 0.12,
      'exported propeller tilt must not be discarded',
    );
    const plateCenter = new THREE.Box3().setFromObject(rotor.plate).getCenter(new THREE.Vector3());
    assert.ok(rotor.pivot.getWorldPosition(new THREE.Vector3()).distanceTo(plateCenter) < 1e-8);
    assert.ok(rotor.parts.every((part) => part.parent === rotor.pivot));
  }
  const shaftSamples = rig.rotors.map((rotor) =>
    rotor.parts.map((part) => {
      const local = rotor.pivot.worldToLocal(part.getWorldPosition(new THREE.Vector3()));
      return { axial: local.z, radius: Math.hypot(local.x, local.y) };
    }),
  );
  const assembly = rig.rotors.map((rotor) => {
    const inverse = rotor.plate.matrixWorld.clone().invert();
    return rotor.parts.map((part) => inverse.clone().multiply(part.matrixWorld));
  });
  for (let i = 1; i <= 16; i++) {
    rig.sample((i * Math.PI) / 8);
    for (const node of fixed)
      node.matrixWorld.elements.forEach((value, k) =>
        assert.ok(Math.abs(value - initial[nodes.indexOf(node)].elements[k]) < 1e-8),
      );
    rig.rotors.forEach((rotor, r) =>
      rotor.parts.forEach((part, p) => {
        const local = rotor.pivot.worldToLocal(part.getWorldPosition(new THREE.Vector3()));
        assert.ok(Math.abs(local.z - shaftSamples[r][p].axial) < 1e-5);
        assert.ok(Math.abs(Math.hypot(local.x, local.y) - shaftSamples[r][p].radius) < 1e-5);
        const relative = rotor.plate.matrixWorld.clone().invert().multiply(part.matrixWorld);
        relative.elements.forEach((value, k) =>
          assert.ok(Math.abs(value - assembly[r][p].elements[k]) < 1e-5),
        );
        const center = new THREE.Box3().setFromObject(rotor.plate).getCenter(new THREE.Vector3());
        assert.ok(rotor.pivot.getWorldPosition(new THREE.Vector3()).distanceTo(center) < 1e-8);
        const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(
          rotor.plate.getWorldQuaternion(new THREE.Quaternion()),
        );
        const shaft = rotor.axis
          .clone()
          .applyQuaternion(rotor.pivot.parent.getWorldQuaternion(new THREE.Quaternion()));
        assert.ok(normal.angleTo(shaft) < 1e-5, `plate axis error ${normal.angleTo(shaft)}`);
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
      rotor.pivot
        .getWorldPosition(new THREE.Vector3())
        .distanceTo(new THREE.Box3().setFromObject(rotor.plate).getCenter(new THREE.Vector3())) <
        1e-8,
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
  // Match the production hierarchy: a centered source under base attitude
  // and a frame-by-frame moving/scaled flight parent. Sampling must update
  // ancestors too, before either geometric inspection or renderer traversal.
  const attitude = new THREE.Group(),
    model = new THREE.Group(),
    scene = new THREE.Scene();
  root.position.set(-2, 1, -3);
  attitude.rotation.set(0.38, -0.48, 0.08);
  attitude.add(root);
  model.add(attitude);
  scene.add(model);
  for (let frame = 0; frame < 32; frame++) {
    model.position.set(frame * 3, -frame * 2, 0);
    model.scale.setScalar(6 + frame / 10);
    model.rotation.set(Math.sin(frame) * 0.04, 0.015, Math.cos(frame) * 0.05);
    rig.sample((frame * Math.PI) / 8);
    const sampled = nodes.map((n) => n.matrixWorld.clone());
    scene.updateMatrixWorld(true);
    nodes.forEach((n, i) =>
      n.matrixWorld.elements.forEach((v, k) =>
        assert.ok(Math.abs(v - sampled[i].elements[k]) < 1e-8),
      ),
    );
    for (const rotor of rig.rotors) {
      const shaft = rotor.axis
        .clone()
        .applyQuaternion(rotor.pivot.parent.getWorldQuaternion(new THREE.Quaternion()));
      const normal = new THREE.Vector3(0, 0, -1).applyQuaternion(
        rotor.plate.getWorldQuaternion(new THREE.Quaternion()),
      );
      assert.ok(normal.angleTo(shaft) < 1e-5);
    }
  }
});
