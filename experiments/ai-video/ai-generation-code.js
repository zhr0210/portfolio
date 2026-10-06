import { seededUnit } from './ai-generation-motion.js';

const fragments = [
  'const frames = references.map(encode);',
  'const latent = condition(frames, context);',
  'for (let step = 0; step < schedule.length; step++) {',
  'const residual = predictNoise(latent, step);',
  'latent = resolve(latent, residual, schedule[step]);',
  'attention.update(context, features);',
  'const pixels = decode(latent, precision);',
  'return compose(pixels, light, motion);',
  'const bounds = project(camera, viewport);',
  'features = sample(latent, coordinates);',
  'const detail = refine(structure, residual);',
  'output = blend(history, detail, weight);',
];

/** Full-width text rows with normal word spaces, never padded with an empty column band. */
export function createCodePixels(seed, columns = 256, rows = 128) {
  const pixels = new Uint8Array(columns * rows * 4);
  for (let row = 0; row < rows; row++) {
    let line = row === 0 ? `const seed = ${seed}; ` : '';
    let slot = Math.floor(seededUnit(seed, row) * fragments.length);
    while (line.length < columns) {
      line += fragments[slot % fragments.length] + ' ';
      slot++;
    }
    for (let col = 0; col < columns; col++) {
      const offset = (row * columns + col) * 4;
      pixels[offset] = line.charCodeAt(col) - 32;
      pixels[offset + 3] = 255;
    }
  }
  return { pixels, columns, rows };
}
