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
test('Four rotor pivots preserve the unfolded pose and rotate only the blades about vertical motor axes', () => {
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
  const motors = rig.rotors.map(({ pivot }) => ({
    node: pivot.parent,
    matrix: pivot.parent.matrixWorld.clone(),
  }));
  for (const rotor of rig.rotors) {
    const axis = rotor.axis
      .clone()
      .applyQuaternion(rotor.pivot.parent.getWorldQuaternion(new THREE.Quaternion()).normalize());
    assert.ok(axis.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-8);
  }
  rig.sample(Math.PI / 3);
  for (const { node, matrix } of motors)
    assert.deepEqual(node.matrixWorld.elements, matrix.elements);
  assert.ok(rig.rotors.every((rotor) => Math.abs(rotor.pivot.quaternion.w - 1) > 0.01));
  rig.sample(0);
  nodes.forEach((node, i) =>
    node.matrixWorld.elements.forEach((value, j) =>
      assert.ok(Math.abs(value - initial[i].elements[j]) < 1e-8),
    ),
  );
});
