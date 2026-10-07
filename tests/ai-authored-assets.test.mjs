import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { reelWorks } from '../experiments/ai-video/video-reel.config.js';
import { normalizeSequence } from '../experiments/ai-video/ai-generation-sequence.js';

const root = new URL('../experiments/ai-video/assets/', import.meta.url);
const metadata = JSON.parse(
  readFileSync(new URL('atonement-generation-50-v4.metadata.json', root)),
);
const bytes = readFileSync(new URL(metadata.atlas.asset, root));
const sha = (data) => createHash('sha256').update(data).digest('hex');

// Decode the actual shipped PNG, including its scanline filters. Metadata alone
// cannot prove that an atlas contains 51 separate images in the configured order.
function rgbPixels(data) {
  assert.equal(data.subarray(1, 4).toString(), 'PNG');
  assert.equal(data[24], 8);
  assert.equal(data[25], 2, 'Exported image is RGB');
  assert.equal(data[28], 0, 'Exported PNG is non-interlaced');
  const width = data.readUInt32BE(16),
    height = data.readUInt32BE(20);
  const chunks = [];
  for (let offset = 8; offset < data.length;) {
    const length = data.readUInt32BE(offset);
    if (data.toString('ascii', offset + 4, offset + 8) === 'IDAT')
      chunks.push(data.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)),
    stride = width * 3;
  assert.equal(raw.length, (stride + 1) * height);
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const start = y * stride,
      filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const a = x >= 3 ? pixels[start + x - 3] : 0;
      const b = y > 0 ? pixels[start + x - stride] : 0;
      const c = y > 0 && x >= 3 ? pixels[start + x - stride - 3] : 0;
      const p = a + b - c,
        pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const predictor = [
        0,
        a,
        b,
        Math.floor((a + b) / 2),
        pa <= pb && pa <= pc ? a : pb <= pc ? b : c,
      ][filter];
      pixels[start + x] = raw[y * (stride + 1) + 1 + x] + predictor;
    }
  }
  return { pixels, width, height };
}

test('The default AI artwork uses all 51 baked states and records honest image provenance', () => {
  const sequence = normalizeSequence(
    reelWorks.find((work) => work.type === 'ai').generationSequence,
  );
  assert.equal(sequence.mode, 'baked');
  assert.equal(sequence.frameCount, 51);
  assert.equal(sequence.posterFrame, 50);
  assert.equal(sequence.flowAtlas, undefined);
  assert.deepEqual(sequence.steps, metadata.sequence.steps);
  assert.equal(metadata.simulation, true);
  assert.equal(metadata.modelInference, false);
  assert.equal(metadata.authoredCheckpoints.length, 13);
  assert.equal(sequence.detailStart, 48);
  assert.equal(metadata.sequence.detailStart, 48);
  assert.deepEqual(
    metadata.sequence.keyframeSteps,
    [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 50],
  );
  assert.equal(metadata.atlas.lossless, true);
  assert.equal(sha(bytes), metadata.atlas.sha256);
  assert.equal(
    sha(readFileSync(new URL(metadata.reference.asset, root))),
    metadata.reference.sha256,
  );
});

test('Every actual atlas tile matches its exported step; all 51 images are distinct', () => {
  const { pixels, width, height } = rgbPixels(bytes);
  const atlas = metadata.atlas;
  assert.equal(width, atlas.width);
  assert.equal(height, atlas.height);
  assert.equal(width, atlas.columns * atlas.cellWidth);
  assert.equal(height, atlas.rows * atlas.cellHeight);
  assert.ok(Math.max(width, height) <= 4096, 'Fits the mobile atlas limit');
  const unique = new Set();
  for (const frame of metadata.frames) {
    const x = (frame.step % atlas.columns) * atlas.cellWidth;
    const y = Math.floor(frame.step / atlas.columns) * atlas.cellHeight;
    const hash = createHash('sha256');
    for (let row = 0; row < atlas.cellHeight; row++) {
      const start = ((y + row) * width + x) * 3;
      hash.update(pixels.subarray(start, start + atlas.cellWidth * 3));
    }
    const actual = hash.digest('hex');
    assert.equal(actual, frame.pixelsSha256, `Step ${frame.step} is correctly packed`);
    unique.add(actual);
  }
  assert.equal(unique.size, 51);
});

test('Sharp unresolved texture survives intermediate frames instead of a defocus ramp', () => {
  const { pixels, width } = rgbPixels(bytes);
  const { columns, cellWidth: w, cellHeight: h } = metadata.atlas;
  function frame(step) {
    const result = Buffer.alloc(w * h * 3);
    const x = (step % columns) * w,
      y = Math.floor(step / columns) * h;
    for (let row = 0; row < h; row++) {
      const start = ((y + row) * width + x) * 3;
      pixels.copy(result, row * w * 3, start, start + w * 3);
    }
    return result;
  }
  function chroma(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i += 3) {
      const average = (data[i] + data[i + 1] + data[i + 2]) / 3;
      sum +=
        Math.abs(data[i] - average) +
        Math.abs(data[i + 1] - average) +
        Math.abs(data[i + 2] - average);
    }
    return sum / data.length;
  }
  function subjectDetail(data) {
    const gray = (x, y) => {
      const i = (y * w + x) * 3;
      return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    };
    let sum = 0,
      squares = 0,
      count = 0;
    // The central head/shoulder/dress region excludes peripheral lens blur.
    for (let y = Math.round(h * 0.46); y < Math.round(h * 0.94); y++)
      for (let x = Math.round(w * 0.36); x < Math.round(w * 0.64); x++) {
        const laplacian =
          gray(x - 1, y) + gray(x + 1, y) + gray(x, y - 1) + gray(x, y + 1) - 4 * gray(x, y);
        sum += laplacian;
        squares += laplacian * laplacian;
        count++;
      }
    return squares / count - (sum / count) ** 2;
  }
  for (const step of [0, 8, 16])
    assert.ok(chroma(frame(step)) < 1.5, `Key at ${step} stays monochrome`);
  for (const step of [4, 12])
    assert.ok(chroma(frame(step)) > 3, `Key at ${step} contains colored noise`);
  assert.equal(metadata.bake.interpolation, 'texture-energy');
  const final = subjectDetail(frame(50));
  for (let step = 0; step < 48; step++)
    assert.ok(
      subjectDetail(frame(step)) > final,
      `Step ${step} contains sharp provisional texture, not defocused subject detail`,
    );
  // Endpoints alone can look crisp while averaging makes the in-between states
  // soft. Check actual intermediate pixels against their neighboring keys.
  for (const record of metadata.frames.filter((entry) => !entry.authoredCheckpoint)) {
    const lower = Math.min(subjectDetail(frame(record.from)), subjectDetail(frame(record.to)));
    assert.ok(
      subjectDetail(frame(record.step)) > lower * 0.65,
      `Step ${record.step} retains local edge energy between checkpoints`,
    );
  }
});
