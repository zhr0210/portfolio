import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { solveDenoise } from '../experiments/ai-video/ai-denoise-solver.js';

const width = 32,
  height = 18;
const rgba = new Uint8Array(width * height * 4);
for (let y = 0; y < height; y++)
  for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4;
    rgba.set([x < 16 ? 18 : 220, y < 9 ? 172 : 35, (x * 7 + y * 11) % 255, 255], at);
  }
const input = { rgba, width, height, steps: 50, seed: 2917 };
function run(options = input) {
  const solver = solveDenoise(options);
  const progress = [];
  for (;;) {
    const result = solver.next();
    if (result.done) return { ...result.value, progress };
    progress.push(result.value.step);
  }
}
function frame(result, step) {
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const start =
      ((Math.floor(step / result.columns) * height + y) * result.width +
        (step % result.columns) * width) *
      4;
    bytes.set(result.pixels.subarray(start, start + width * 4), y * width * 4);
  }
  return bytes;
}

test('All 51 predictions are actually computed, reproducible and distinct', () => {
  const original = rgba.slice();
  const a = run(),
    b = run();
  assert.deepEqual(
    a.progress,
    Array.from({ length: 51 }, (_, i) => i),
  );
  assert.deepEqual(a.pixels, b.pixels);
  const hashes = Array.from({ length: 51 }, (_, i) =>
    createHash('sha256').update(frame(a, i)).digest('hex'),
  );
  assert.equal(new Set(hashes).size, 51);
  assert.notDeepEqual(frame(a, 10), frame(run({ ...input, seed: 1234 }), 10));
  assert.deepEqual(rgba, original, 'Conditioning source stays unmodified');
});

test('Iterated predictions converge to the unchanged input, with small final corrections', () => {
  const result = run();
  assert.deepEqual(frame(result, 50), rgba);
  assert.ok(result.errors[10] < result.errors[0]);
  assert.ok(result.errors[30] < result.errors[10]);
  assert.ok(result.errors[49] < 0.0001, `Final residual ${result.errors[49]}`);
  assert.equal(result.errors[50], 0);
  assert.ok(result.errors.every(Number.isFinite));
  assert.deepEqual(frame(run({ ...input, steps: 25 }), 25), rgba);
});

test('Invalid iteration counts and malformed sources are rejected', () => {
  for (const invalid of [{ steps: 64 }, { steps: 1 }, { width: 0 }, { rgba: new Uint8Array(4) }])
    assert.throws(() => run({ ...input, ...invalid }));
});
