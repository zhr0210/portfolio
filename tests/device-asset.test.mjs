import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
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
const metadata = JSON.parse(
  readFileSync(
    new URL('../experiments/ai-video/assets/capture-devices.metadata.json', import.meta.url),
  ),
);
function png(index) {
  const image = gltf.images[index];
  const view = gltf.bufferViews[image.bufferView];
  const start = binaryStart + (view.byteOffset || 0);
  return bytes.subarray(start, start + view.byteLength);
}
function texturePng(index) {
  return png(gltf.textures[index].source);
}
function pngSize(data) {
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

// Inspect the shipped ORM pixels: a valid PNG header alone cannot catch
// Blender silently reusing an original packed image after material edits.
function inspectPng(data, inspect) {
  assert.equal(data[24], 8, 'ORM uses eight-bit channels');
  const channels = { 2: 3, 6: 4 }[data[25]];
  assert.ok(channels, 'ORM is RGB or RGBA');
  assert.equal(data[28], 0, 'PNG is not interlaced');
  const chunks = [];
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset);
    if (data.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(data.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const [width, height] = pngSize(data);
  const stride = width * channels;
  let previous = Buffer.alloc(stride);
  let row = Buffer.alloc(stride);
  assert.equal(raw.length, (stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const offset = y * (stride + 1);
    const filter = raw[offset];
    assert.ok(filter <= 4, 'Valid PNG scanline filter');
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0;
      const b = previous[x];
      const c = x >= channels ? previous[x - channels] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const predictor = [
        0,
        a,
        b,
        Math.floor((a + b) / 2),
        pa <= pb && pa <= pc ? a : pb <= pc ? b : c,
      ][filter];
      row[x] = raw[offset + 1 + x] + predictor;
    }
    for (let x = 0; x < stride; x += channels)
      inspect(row[x], row[x + 1], row[x + 2], x / channels, y);
    [previous, row] = [row, previous];
  }
}
function inspectOrm(data, inspect) {
  inspectPng(data, (_r, roughness, metallic) => inspect(roughness, metallic));
}
function floats(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
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
  assert.equal(bytes.length, metadata.bytes);
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
    assert.equal(times.length, 253);
    assert.equal(times[0], 0);
    assert.equal(times.at(-1), 10.5);
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
  assert.deepEqual(sony.slice(216 * 3, 217 * 3), sony.slice(252 * 3, 253 * 3));
  assert.notDeepEqual(sony.slice(108 * 3, 109 * 3), sony.slice(216 * 3, 217 * 3));
  for (const control of ['x轴稳定', '镜头模组', '零件控制器'])
    assert.ok(channel(control, 'rotation'));
});

test('Device textures remain embedded lossless PNG at their native resolution', () => {
  assert.deepEqual(metadata.texturePolicy, {
    resolution: 'native',
    format: 'PNG',
    lossyCompression: false,
    resampling: false,
    meshCompression: false,
  });
  for (const texture of metadata.textures) {
    assert.deepEqual(texture.webSize, texture.sourceSize);
    assert.equal(texture.lossyCompression, false);
    assert.equal(texture.resized, false);
  }
  for (const [index, image] of gltf.images.entries()) {
    assert.equal(image.mimeType, 'image/png');
    assert.equal(png(index).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
  for (const [name, size] of [
    ['Sony_A7RM3_Body_Mat_web_matte', 4096],
    ['Sony24_70G_Body_Mat_web_matte', 4096],
  ]) {
    const material = gltf.materials.find((entry) => entry.name === name);
    for (const texture of [
      material.normalTexture,
      material.pbrMetallicRoughness.baseColorTexture,
      material.pbrMetallicRoughness.metallicRoughnessTexture,
    ])
      assert.deepEqual(pngSize(texturePng(texture.index)), [size, size], name);
  }
  for (const name of [
    'Pocket3_Body_Graphite',
    'Pocket3_Grip_Textured',
    'Pocket3_Lens_Optics',
    'Pocket3_Shutter_Ring',
  ]) {
    const material = gltf.materials.find((entry) => entry.name === name);
    assert.ok(material, name);
    assert.deepEqual(
      pngSize(texturePng(material.pbrMetallicRoughness.baseColorTexture.index)),
      [2048, 2048],
    );
    if (material.normalTexture)
      assert.deepEqual(pngSize(texturePng(material.normalTexture.index)), [2048, 2048]);
  }
  assert.ok(!gltf.extensionsUsed?.includes('EXT_texture_webp'));
});

test('Sony nonmetal ORM pixels retain the matte authoring treatment', () => {
  for (const name of ['Sony_A7RM3_Body_Mat_web_matte', 'Sony24_70G_Body_Mat_web_matte']) {
    const material = gltf.materials.find((entry) => entry.name === name);
    assert.equal(material.pbrMetallicRoughness.roughnessFactor ?? 1, 1);
    let badSonyPixels = 0;
    inspectOrm(
      texturePng(material.pbrMetallicRoughness.metallicRoughnessTexture.index),
      (roughness, metallic) => {
        if (metallic < 128 && roughness < 163) badSonyPixels++;
      },
    );
    assert.equal(badSonyPixels, 0, name + ' retains the matte nonmetal mask');
  }
});

test('Pocket components use distinct reference finishes and no bare white metal', () => {
  const expected = {
    Object_73: ['Pocket3_Body_Graphite', 0.82, 0],
    Object_63: ['Pocket3_Grip_Textured', 0.91, 0],
    Object_8: ['Pocket3_Gimbal_Satin', 0.57, 0],
    Object_11: ['Pocket3_Gimbal_Satin', 0.57, 0],
    Object_43: ['Pocket3_Motor_Cover', 0.66, 0],
    Object_13: ['Pocket3_Lens_Bezel_AtlasUV', 0.43, 0],
    Object_17: ['Pocket3_Lens_Optics', 0.14, 0],
    Object_225: ['Pocket3_Screen_Glass', 0.24, 0],
    Object_215: ['Pocket3_Control_Rubber', 0.88, 0],
    Object_71: ['Pocket3_Shutter_Ring', 0.57, 0],
    Object_67: ['Pocket3_Status_Green', 0.34, 0],
    Object_59: ['Pocket3_Connector_Dark', 0.62, 0.25],
  };
  for (const [name, [materialName, roughness, metallic]] of Object.entries(expected)) {
    const node = gltf.nodes.find((node) => node.name === name);
    const primitive = gltf.meshes[node.mesh].primitives[0];
    const material = gltf.materials[primitive.material];
    assert.equal(material.name, materialName, name);
    const pbr = material.pbrMetallicRoughness;
    assert.ok(Math.abs((pbr.roughnessFactor ?? 1) - roughness) < 1e-6, name + ' roughness');
    assert.ok(Math.abs((pbr.metallicFactor ?? 1) - metallic) < 1e-6, name + ' metallic');
  }
  const pocketRecord = metadata.materialProfile.adjustments.find(
    (r) => r.kind === 'pocket-reference',
  );
  assert.equal(pocketRecord.repairedMeshes, 110);
  assert.equal(pocketRecord.removedInvalidCustomNormals.length, 110);
  for (const binding of pocketRecord.bindings) {
    const node = gltf.nodes.find((n) => n.name === binding.object);
    const materials = gltf.meshes[node.mesh].primitives.map((p) => gltf.materials[p.material]);
    assert.ok(materials.every((m) => m.name.startsWith('Pocket3_')));
    assert.ok(materials.every((m) => (m.pbrMetallicRoughness.metallicFactor ?? 1) <= 0.25));
  }
  const rear = gltf.nodes.find((n) => n.name === 'Object_221');
  const rearNames = gltf.meshes[rear.mesh].primitives.map((p) => gltf.materials[p.material].name);
  assert.deepEqual(new Set(rearNames), new Set(['Pocket3_Grip_Textured', 'Pocket3_Rear_Print']));
  const display = gltf.materials.find((m) => m.name === 'Pocket3_Screen_Glass');
  assert.ok(
    display.pbrMetallicRoughness.baseColorFactor.slice(0, 3).every((v) => v < 0.02),
    'Screen is black glass',
  );
  const window = gltf.materials.find((m) => m.name === 'Pocket3_Lens_Window');
  assert.equal(window.alphaMode, 'BLEND');
  assert.ok(
    Math.abs(window.pbrMetallicRoughness.baseColorFactor[3] - 0.03) < 1e-6,
    'Lens cover does not hide optical photo',
  );
});

test('Pocket optical photo and shutter ring use the original atlas instead of a uniform fill', () => {
  const lens = gltf.materials.find((m) => m.name === 'Pocket3_Lens_Optics');
  const shutter = gltf.materials.find((m) => m.name === 'Pocket3_Shutter_Ring');
  const source = lens.pbrMetallicRoughness.baseColorTexture;
  assert.deepEqual(
    texturePng(shutter.pbrMetallicRoughness.baseColorTexture.index),
    texturePng(source.index),
    'Both retain the same source pixels with their own UV samplers',
  );
  assert.deepEqual(shutter.pbrMetallicRoughness.baseColorFactor ?? [1, 1, 1, 1], [1, 1, 1, 1]);
  let orange = 0,
    dark = 0;
  inspectPng(texturePng(source.index), (r, g, b, x, y) => {
    if (x > 0.13 * 2048 && x < 0.155 * 2048 && y > 0.951 * 2048 && y < 0.974 * 2048) {
      if (r > 100 && r > g * 1.2 && g > b * 1.5) orange++;
    }
    if (
      x > 0.283 * 2048 &&
      x < 0.305 * 2048 &&
      y > 0.978 * 2048 &&
      y < 0.998 * 2048 &&
      Math.max(r, g, b) < 55
    )
      dark++;
  });
  assert.ok(
    orange > 50 && dark > 50,
    `Shipped ring island contains orange edges and a dark center (${orange}/${dark})`,
  );
  const node = gltf.nodes.find((n) => n.name === 'Object_17');
  const uv = floats(gltf.meshes[node.mesh].primitives[0].attributes.TEXCOORD_0);
  // Blender .001 optical island sits at the top of the atlas; default UVMap
  // selected a blank lower island and made the lens disappear.
  for (let i = 1; i < uv.length; i += 2) assert.ok(uv[i] < 0.15, 'Restored optical UV island');
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
  const action = mixer.clipAction(new AnimationClip('CaptureDevices', 10.5, tracks));
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
  sampleDeviceTimeline(mixer, [action], 10.5);
  sampleDeviceTimeline(mixer, [action], 0);
  sampleDeviceTimeline(mixer, [action], 2.25);
  for (const [i, values] of pose().entries())
    for (const [j, value] of values.entries())
      assert.ok(Math.abs(value - first[i][j]) < 1e-12, `Track ${i}, component ${j} reverses`);
});
