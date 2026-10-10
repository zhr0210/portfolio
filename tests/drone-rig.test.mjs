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
const binaryOffset = 28 + bytes.readUInt32LE(12);
function geometryFor(primitive) {
  const a = json.accessors[primitive.attributes.POSITION];
  const view = json.bufferViews[a.bufferView];
  const values = new Float32Array(a.count * 3);
  const stride = view.byteStride || 12;
  for (let i = 0; i < a.count; i++)
    for (let c = 0; c < 3; c++)
      values[i * 3 + c] = bytes.readFloatLE(
        binaryOffset + (view.byteOffset || 0) + (a.byteOffset || 0) + i * stride + c * 4,
      );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(values, 3));
  return geometry;
}
function sourceRig() {
  // Match GLTFLoader: a mesh node can itself be the parent of an entire motor.
  // Boxes inside Groups hid the four shaft meshes at this seam in the old test.
  const nodes = json.nodes.map((n) => {
    const node =
      n.mesh === undefined
        ? new THREE.Group()
        : new THREE.Mesh(geometryFor(json.meshes[n.mesh].primitives[0]));
    node.name = n.name;
    if (n.translation) node.position.fromArray(n.translation);
    if (n.rotation) node.quaternion.fromArray(n.rotation);
    if (n.scale) node.scale.fromArray(n.scale);
    return node;
  });
  json.nodes.forEach((n, i) => n.children?.forEach((c) => nodes[i].add(nodes[c])));
  const root = new THREE.Group();
  json.scenes[0].nodes.forEach((i) => root.add(nodes[i]));
  root.updateMatrixWorld(true);
  return { root, nodes };
}
function topAlong(mesh, axis) {
  let top = -Infinity;
  const p = mesh.geometry.attributes.position;
  for (let i = 0; i < p.count; i++)
    top = Math.max(
      top,
      new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld).dot(axis),
    );
  return top;
}
test('Real rotor geometry seats the lower hub rim on the motor cap and includes the ancestor shaft', () => {
  const { root } = sourceRig();
  const rig = createDroneRig(THREE, root);
  for (const [i, r] of rig.rotors.entries()) {
    const cap = root.getObjectByName(`桨叶${i + 1}_${i < 2 ? '02' : '03'}`);
    const shaft = root.getObjectByName(`桨叶${i + 1}_${i === 0 ? '06' : '07'}`);
    assert.ok(shaft.parent === r.pivot, 'shaft geometry must follow the complete upper assembly');
    const axis = r.axis
      .clone()
      .applyQuaternion(r.pivot.parent.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(
      topAlong(r.plate, axis) - topAlong(cap, axis) <= 0.000351,
      'lower hub rim must sit within 0.35mm of the cap top',
    );
  }
});

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
  const seated = nodes.map((node) => node.matrixWorld.clone());
  // Each fitted deck receives only its axial translation at zero angle;
  // mounts, motor housings and the rest of the model retain authored matrices.
  for (const rotor of rig.rotors) {
    assert.ok(rotor.seatingOffset > 0.0026 && rotor.seatingOffset < 0.0028);
    assert.ok(rotor.deckOffset > 0.0026 && rotor.deckOffset < 0.0027);
    const displacement = rotor.axis
      .clone()
      .applyQuaternion(rotor.pivot.parent.getWorldQuaternion(new THREE.Quaternion()))
      .multiplyScalar(-rotor.seatingOffset);
    for (const part of rotor.parts) {
      const expected = initial[nodes.indexOf(part)].clone();
      const shift = displacement.clone();
      if (rotor.upperParts.includes(part))
        shift.addScaledVector(displacement.clone().normalize(), rotor.deckOffset);
      expected.elements[12] += shift.x;
      expected.elements[13] += shift.y;
      expected.elements[14] += shift.z;
      expected.elements.forEach((v, k) =>
        assert.ok(Math.abs(v - part.matrixWorld.elements[k]) < 1e-8),
      );
    }
  }
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
      assert.ok(Math.abs(value - seated[i].elements[j]) < 1e-8),
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

test('Disabling the display fit reproduces every original node world matrix, including shaft carriers', () => {
  const { root, nodes } = sourceRig();
  const original = nodes.map((n) => n.matrixWorld.clone());
  const vertexCount = nodes.reduce(
    (sum, n) => sum + (n.geometry?.attributes.position.count || 0),
    0,
  );
  createDroneRig(THREE, root, { hubSeatClearance: 1, hubDeckCompression: 0 }).sample(0);
  nodes.forEach((n, i) =>
    n.matrixWorld.elements.forEach((v, k) =>
      assert.ok(Math.abs(v - original[i].elements[k]) < 1e-8),
    ),
  );
  let actualVertices = 0;
  root.traverse((n) => {
    actualVertices += n.geometry?.attributes.position.count || 0;
  });
  assert.equal(actualVertices, vertexCount, 'shaft extraction must not duplicate/drop geometry');
});
