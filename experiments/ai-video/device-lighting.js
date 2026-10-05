// Captured from the saved source scene at frame 0, not from the user's live
// Blender session. matrix_local includes Blender's parent-inverse transform.
export const authoredPocketLighting = Object.freeze({
  sourceFile: 'camera 无人机.blend',
  sourceSha256: '98d83d944e723e9d1e9d5e0d4f988623a12e563dcf511b8011efb6e5db556c10',
  coordinateSystem: 'glTF Y-up; positions and object rotations are parent-local',
  parent: 'z轴移动.001',
  lights: [
    {
      name: '聚光.001',
      type: 'AREA',
      shape: 'SQUARE',
      powerWatts: 500,
      normalizedPower: true,
      width: 60.326637268066406,
      height: 60.326637268066406,
      colorLinear: [1, 1, 1],
      localPosition: [-1.6126441955566406, 22.414817810058594, 5.14329719543457],
      localObjectQuaternion: [0, 0, 0, 1],
    },
    {
      name: '面光.001',
      type: 'AREA',
      shape: 'SQUARE',
      powerWatts: 500,
      normalizedPower: true,
      width: 37.20100021362305,
      height: 37.20100021362305,
      colorLinear: [1, 1, 1],
      localPosition: [0, -19.659984588623047, 6.891741752624512],
      localObjectQuaternion: [
        0.9994547963142395, 0.0016266175080090761, 5.459944996122346e-12, 0.03297882154583931,
      ],
    },
  ],
  world: {
    backgroundColorLinear: [0.01280629076063633, 0.01280629076063633, 0.01280629076063633],
    strength: 1,
    weight: 0,
    viewTransform: 'AgX',
    exposureStops: 0,
  },
});

// Same approximate radiometric-to-photometric convention as Blender's glTF
// SPEC export (io_scene_gltf2/blender/com/conversion.py). RectAreaLight.power
// is lumens; its setter divides by PI * area to produce luminance in nits.
export const BLENDER_WATTS_TO_LUMENS = 683;

/**
 * Recreate the source Pocket's two area lights in its translation hierarchy.
 * The caller initializes RectAreaLightUniformsLib once, and disables its
 * generic studio lights / RoomEnvironment for the Pocket render pass.
 * Nothing here has a RAF or an independent animation clock.
 */
export function createAuthoredPocketLighting(THREE, pocketRoot, { powerScale = 1 } = {}) {
  // GLTFLoader sanitizes dots in node names for AnimationMixer bindings.
  const parent =
    pocketRoot?.getObjectByName(authoredPocketLighting.parent) ||
    pocketRoot?.getObjectByName(
      THREE.PropertyBinding.sanitizeNodeName(authoredPocketLighting.parent),
    );
  if (!parent) throw new Error('The Pocket source-light translation parent is missing');
  if (!Number.isFinite(powerScale) || powerScale < 0)
    throw new Error('Pocket source-light powerScale must be finite and nonnegative');

  const group = new THREE.Group();
  group.name = 'Pocket3_Authored_Lighting';
  // Mesh/empty rotations use B*R*B^-1. A light emits down its own -Z axis,
  // so its object also needs the light/camera basis correction B (X -90°),
  // matching Blender's glTF exporter. Omitting this points the top light
  // towards the camera instead of down towards the device.
  const lightBasis = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI / 2,
  );
  const lights = authoredPocketLighting.lights.map((record) => {
    const color = new THREE.Color().fromArray(record.colorLinear);
    const light = new THREE.RectAreaLight(color, 1, record.width, record.height);
    light.name = `Pocket3_Source_${record.name}`;
    light.position.fromArray(record.localPosition);
    light.quaternion.fromArray(record.localObjectQuaternion).multiply(lightBasis).normalize();
    light.power = record.powerWatts * BLENDER_WATTS_TO_LUMENS * powerScale;
    group.add(light);
    return light;
  });
  parent.add(group);

  let disposed = false;
  return {
    group,
    lights,
    // The saved source's connected World Background has Weight=0. Preserve
    // that dark world rather than adding a new HDRI / broad ambient fill.
    environment: null,
    environmentIntensity: 0,
    exposure: 2 ** authoredPocketLighting.world.exposureStops,
    snapshot: {
      parent: authoredPocketLighting.parent,
      powerScale,
      conversion: 'Blender watts × 683 / (PI × width × height) → Three nits',
      sourceExposure: 2 ** authoredPocketLighting.world.exposureStops,
      sourceWorld: { ...authoredPocketLighting.world },
      lights: lights.map((light, index) => ({
        sourceName: authoredPocketLighting.lights[index].name,
        powerWatts: authoredPocketLighting.lights[index].powerWatts,
        powerLumens: light.power,
        intensityNits: light.intensity,
        width: light.width,
        height: light.height,
        localPosition: light.position.toArray(),
        localQuaternion: light.quaternion.toArray(),
      })),
    },
    setEnabled(enabled) {
      if (!disposed) group.visible = Boolean(enabled);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      group.clear();
      // These lights own no geometries, shadow maps, textures or targets.
      lights.length = 0;
    },
  };
}
