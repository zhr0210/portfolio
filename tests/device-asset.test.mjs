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
function inspectOrm(data, inspect) {
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
    for (let x = 0; x < stride; x += channels) inspect(row[x + 1], row[x + 2]);
    [previous, row] = [row, previous];
  }
}
function floats(index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  const width = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type];
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
    assert.equal(times.length, 145);
    assert.equal(times[0], 0);
    assert.equal(times.at(-1), 6);
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
  assert.deepEqual(sony.slice(108 * 3, 109 * 3), sony.slice(144 * 3, 145 * 3));
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
    ['Pocket3_Body_Matte', 2048],
  ]) {
    const material = gltf.materials.find((entry) => entry.name === name);
    for (const texture of [
      material.normalTexture,
      material.pbrMetallicRoughness.baseColorTexture,
      material.pbrMetallicRoughness.metallicRoughnessTexture,
    ])
      assert.deepEqual(pngSize(texturePng(texture.index)), [size, size], name);
  }
  assert.ok(!gltf.extensionsUsed?.includes('EXT_texture_webp'));
});

test('Packed body masks and Pocket color agree with the matte authoring profile', () => {
  const pocket = gltf.materials.find((entry) => entry.name === 'Pocket3_Body_Matte');
  const pbr = pocket.pbrMetallicRoughness;
  assert.equal(pbr.baseColorFactor.length, 4);
  assert.equal(pbr.roughnessFactor ?? 1, 1);
  assert.equal(pbr.metallicFactor ?? 1, 1);
  assert.ok(Math.abs(pocket.extensions.KHR_materials_specular.specularFactor - 0.56) < 1e-6);
  assert.equal(pocket.extensions.KHR_materials_clearcoat?.clearcoatFactor ?? 0, 0);
  for (const [index, value] of pbr.baseColorFactor.entries())
    assert.ok(Math.abs(value - [0.9, 0.9, 0.9, 1][index]) < 1e-6);
  let badPocketPixels = 0;
  inspectOrm(texturePng(pbr.metallicRoughnessTexture.index), (roughness, metallic) => {
    if (roughness !== 255 || metallic !== 0) badPocketPixels++;
  });
  assert.equal(badPocketPixels, 0, 'Pocket plastic is matte and nonmetal throughout');
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
  for (const name of ['mat_0.008', 'mat_2.006', 'mat_0.002_0.005', 'mat_0.006'])
    assert.ok(
      gltf.materials.some((entry) => entry.name === name),
      name + ' stays separate',
    );
  const optics = gltf.materials.find((entry) => entry.name === 'Material.006');
  assert.equal(optics.extensions.KHR_materials_clearcoat.clearcoatFactor, 1);
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
  const action = mixer.clipAction(new AnimationClip('CaptureDevices', 6, tracks));
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
  sampleDeviceTimeline(mixer, [action], 6);
  sampleDeviceTimeline(mixer, [action], 0);
  sampleDeviceTimeline(mixer, [action], 2.25);
  for (const [i, values] of pose().entries())
    for (const [j, value] of values.entries())
      assert.ok(Math.abs(value - first[i][j]) < 1e-12, `Track ${i}, component ${j} reverses`);
});
