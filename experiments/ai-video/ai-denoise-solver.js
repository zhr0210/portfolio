/**
 * A cover-conditioned, annealed reconstruction. This is an artistic solver,
 * not a learned score model: no prompts, weights or authored in-between images.
 * Every iteration consumes the preceding RGB field and computes a correction.
 */
const clamp = (x, low = 0, high = 1) => Math.max(low, Math.min(high, x));
const smooth = (x) => (x = clamp(x)) * x * (3 - 2 * x);

export function solverUnit(seed, slot) {
  let n = (seed ^ Math.imul(slot + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function field(x, y, seed) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = smooth(x - ix),
    fy = smooth(y - iy);
  const value = (a, b) => solverUnit(seed, Math.imul(a, 73856093) ^ Math.imul(b, 19349663));
  const a = value(ix, iy) * (1 - fx) + value(ix + 1, iy) * fx;
  const b = value(ix, iy + 1) * (1 - fx) + value(ix + 1, iy + 1) * fx;
  return a * (1 - fy) + b * fy;
}

export function denoiseSchedule(step, steps, maximumLevel, options = {}) {
  const t = clamp(step / steps);
  return {
    t,
    // Coarse evidence arrives first; sharp evidence participates in later updates.
    level: maximumLevel * Math.pow(1 - t, 2.1),
    warp: (options.warp ?? 0.2) * Math.pow(1 - t, 2.2),
    gain: step === steps ? 1 : 0.16 + 0.38 * t + 0.3 * t * t,
    coherence: 0.16 * Math.pow(1 - t, 1.2),
    innovation: (options.noise ?? 0.32) * Math.pow(1 - t, 2.6),
  };
}

export function createDenoisePyramid(rgba, width, height) {
  if (
    !(rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray) ||
    rgba.length !== width * height * 4
  )
    throw new Error('Solver source must be an RGBA pixel array');
  const rgb = new Float32Array(width * height * 3);
  for (let i = 0; i < width * height; i++)
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = rgba[i * 4 + c] / 255;
  const levels = [{ pixels: rgb, width, height }];
  while (width > 2 && height > 2) {
    const previous = levels.at(-1);
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
    const pixels = new Float32Array(width * height * 3);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        for (let c = 0; c < 3; c++) {
          let total = 0;
          // Binomial low-pass before decimation, rather than mipmap-like block reveal.
          for (let j = -1; j <= 1; j++)
            for (let i = -1; i <= 1; i++) {
              const sx = clamp(x * 2 + i, 0, previous.width - 1);
              const sy = clamp(y * 2 + j, 0, previous.height - 1);
              total +=
                previous.pixels[(sy * previous.width + sx) * 3 + c] *
                (i === 0 ? 2 : 1) *
                (j === 0 ? 2 : 1);
            }
          pixels[(y * width + x) * 3 + c] = total / 16;
        }
    levels.push({ pixels, width, height });
  }
  return levels;
}

function sample(level, x, y, c) {
  const px = clamp(x * level.width - 0.5, 0, level.width - 1);
  const py = clamp(y * level.height - 0.5, 0, level.height - 1);
  const ix = Math.floor(px),
    iy = Math.floor(py),
    fx = px - ix,
    fy = py - iy;
  const nextX = Math.min(ix + 1, level.width - 1),
    nextY = Math.min(iy + 1, level.height - 1);
  const row = (yy) =>
    level.pixels[(yy * level.width + ix) * 3 + c] * (1 - fx) +
    level.pixels[(yy * level.width + nextX) * 3 + c] * fx;
  return row(iy) * (1 - fy) + row(nextY) * fy;
}

/** A generator also lets the Worker yield between iterations and cancel obsolete jobs. */
export function* solveDenoise({ rgba, width, height, steps = 50, seed = 2917, warp, noise }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2)
    throw new Error('Solver dimensions must be positive integer pixels');
  if (!Number.isInteger(steps) || steps < 2 || steps > 63)
    throw new Error('Solver supports 2–63 iterations');
  const pyramid = createDenoisePyramid(rgba, width, height);
  const count = width * height;
  let current = new Float32Array(count * 3),
    next = new Float32Array(count * 3);
  const flow = new Float32Array(count * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        u = (x + 0.5) / width,
        v = (y + 0.5) / height;
      flow[i * 4] = (field(u * 5, v * 4, seed) - 0.5) * 2;
      flow[i * 4 + 1] = (field(u * 5 + 7, v * 4 + 11, seed + 1) - 0.5) * 2;
      flow[i * 4 + 2] = (field(u * 11, v * 8, seed + 2) - 0.5) * 2;
      flow[i * 4 + 3] = (field(u * 11 + 3, v * 8 + 9, seed + 3) - 0.5) * 2;
      const grain = solverUnit(seed, i) - 0.5;
      for (let c = 0; c < 3; c++)
        current[i * 3 + c] = clamp(0.48 + grain + (solverUnit(seed + c + 17, i) - 0.5) * 0.3);
    }
  const columns = Math.min(8, steps + 1),
    rows = Math.ceil((steps + 1) / columns);
  const atlasWidth = width * columns,
    atlasHeight = height * rows;
  const atlas = new Uint8Array(atlasWidth * atlasHeight * 4);
  const errors = [];
  function write(step) {
    const ox = (step % columns) * width,
      oy = Math.floor(step / columns) * height;
    let error = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x,
          at = ((oy + y) * atlasWidth + ox + x) * 4;
        for (let c = 0; c < 3; c++) {
          atlas[at + c] = Math.round(clamp(current[i * 3 + c]) * 255);
          error += (current[i * 3 + c] - pyramid[0].pixels[i * 3 + c]) ** 2;
        }
        atlas[at + 3] = 255;
      }
    errors.push(error / (count * 3));
  }
  write(0);
  yield { step: 0 };
  for (let step = 1; step <= steps; step++) {
    const s = denoiseSchedule(step, steps, pyramid.length - 1, { warp, noise });
    const low = Math.floor(s.level),
      high = Math.min(low + 1, pyramid.length - 1),
      fraction = s.level - low;
    const revise = Math.sin(step * 0.63) * 0.32;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x,
          fi = i * 4;
        const u = (x + 0.5) / width + (flow[fi] + flow[fi + 2] * revise) * s.warp;
        const v = (y + 0.5) / height + (flow[fi + 1] + flow[fi + 3] * revise) * s.warp;
        const left = (y * width + Math.max(x - 1, 0)) * 3;
        const right = (y * width + Math.min(x + 1, width - 1)) * 3;
        const up = (Math.max(y - 1, 0) * width + x) * 3;
        const down = (Math.min(y + 1, height - 1) * width + x) * 3;
        const n = solverUnit(seed + step * 7919, i) - 0.5;
        for (let c = 0; c < 3; c++) {
          const p = i * 3 + c,
            value = current[p];
          const coarse =
            sample(pyramid[low], u, v, c) * (1 - fraction) +
            sample(pyramid[high], u, v, c) * fraction;
          const laplacian =
            (current[left + c] + current[right + c] + current[up + c] + current[down + c]) * 0.25 -
            value;
          const innovation = n + (solverUnit(seed + step * 3571 + c + 1, i) - 0.5) * 0.22;
          // Residual correction and local diffusion update the previous prediction.
          next[p] =
            step === steps
              ? pyramid[0].pixels[p]
              : clamp(
                  value +
                    s.gain * (coarse - value) +
                    s.coherence * laplacian +
                    s.innovation * innovation,
                );
        }
      }
    [current, next] = [next, current];
    write(step);
    yield { step };
  }
  return {
    pixels: atlas,
    width: atlasWidth,
    height: atlasHeight,
    columns,
    rows,
    frameWidth: width,
    frameHeight: height,
    steps,
    errors,
  };
}
