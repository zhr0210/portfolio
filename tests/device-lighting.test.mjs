import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAuthoredPocketLighting } from '../experiments/ai-video/device-lighting.js';

function pocketHierarchy() {
  const root = new THREE.Group();
  const travel = new THREE.Group();
  travel.name = 'z轴移动.001';
  root.add(travel);
  const rotation = new THREE.Group();
  rotation.name = '模型三轴旋转';
  travel.add(rotation);
  return { root, travel, rotation };
}

test('Blender area lights face the Pocket from above and below in glTF coordinates', () => {
  const { root, travel, rotation } = pocketHierarchy();
  const rig = createAuthoredPocketLighting(THREE, root);
  const [top, bottom] = rig.lights;
  assert.equal(rig.group.parent, travel);
  assert.ok(top.position.distanceTo(new THREE.Vector3(-1.6126442, 22.4148178, 5.1432972)) < 1e-6);
  assert.ok(bottom.position.distanceTo(new THREE.Vector3(0, -19.6599846, 6.8917418)) < 1e-6);
  const direction = (light) => new THREE.Vector3(0, 0, -1).applyQuaternion(light.quaternion);
  assert.ok(direction(top).distanceTo(new THREE.Vector3(0, -1, 0)) < 1e-10);
  assert.ok(
    direction(bottom).distanceTo(new THREE.Vector3(-0.00325146, 0.9978195, -0.06592167)) < 1e-6,
  );
  const original = top.getWorldPosition(new THREE.Vector3());
  rotation.rotation.set(0.6, 1.5, 2.1);
  assert.ok(top.getWorldPosition(new THREE.Vector3()).distanceTo(original) < 1e-10);
  travel.position.y = 12;
  const expected = original.clone().add(new THREE.Vector3(0, 12, 0));
  assert.ok(top.getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 1e-10);
  rig.dispose();
});

test('GLTFLoader-sanitized translation names retain the source lighting parent', () => {
  const { root, travel } = pocketHierarchy();
  travel.name = THREE.PropertyBinding.sanitizeNodeName(travel.name);
  const rig = createAuthoredPocketLighting(THREE, root);
  assert.equal(rig.group.parent, travel);
  rig.dispose();
});

test('Source-normalized 500W lights preserve flux while their sizes set luminance', () => {
  const { root } = pocketHierarchy();
  const rig = createAuthoredPocketLighting(THREE, root);
  const [top, bottom] = rig.lights;
  for (const light of rig.lights) assert.ok(Math.abs(light.power - 500 * 683) < 1e-8);
  assert.ok(Math.abs(top.intensity - 29.8691318725) < 1e-8);
  assert.ok(Math.abs(bottom.intensity - 78.5473616033) < 1e-8);
  const dimmed = createAuthoredPocketLighting(THREE, root, { powerScale: 0.5 });
  assert.equal(dimmed.lights[0].intensity, top.intensity * 0.5);
  assert.equal(rig.environment, null);
  assert.equal(rig.environmentIntensity, 0);
  assert.equal(rig.snapshot.sourceExposure, 1);
  assert.equal(rig.snapshot.sourceWorld.weight, 0);
  rig.dispose();
  dimmed.dispose();
});

test('Render-pass toggles and disposal leave no orphan lighting objects', () => {
  const { root, travel } = pocketHierarchy();
  const rig = createAuthoredPocketLighting(THREE, root);
  rig.setEnabled(false);
  assert.equal(rig.group.visible, false);
  rig.setEnabled(true);
  assert.equal(rig.group.visible, true);
  rig.dispose();
  rig.dispose();
  assert.equal(rig.group.parent, null);
  assert.equal(rig.group.children.length, 0);
  assert.equal(travel.children.length, 1);
  assert.throws(() => createAuthoredPocketLighting(THREE, root, { powerScale: NaN }));
  assert.throws(() => createAuthoredPocketLighting(THREE, new THREE.Group()));
});
