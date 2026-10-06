import { clamp, smooth } from './reel-motion.js';

export const maximumSequenceFrames = 64;

export function denoiseFrame(progress, config) {
  const maxStep = Math.max(1, Math.round(config.denoiseSteps));
  const raw = clamp(
    (progress - config.stages.split) / (config.stages.denoise - config.stages.split),
  );
  const value = raw * maxStep;
  const position = Math.abs(value - Math.round(value)) < 1e-8 ? Math.round(value) : value;
  const from = Math.floor(position);
  const mix = smooth(position - from);
  return {
    position,
    from,
    to: Math.min(maxStep, from + 1),
    mix,
    maxStep,
    normalized: (from + mix) / maxStep,
  };
}

export function normalizeSequence(value) {
  if (!value) return null;
  const { columns, rows, steps, posterFrame } = value;
  const mode = value.mode ?? 'flow';
  if (!['flow', 'baked'].includes(mode)) throw new Error('Unknown sequence sampling mode');
  if (typeof value.atlas !== 'string' || !value.atlas)
    throw new Error('Sequence atlas must have a source URL');
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1)
    throw new Error('Sequence grid must contain positive integer columns and rows');
  if (
    !Array.isArray(steps) ||
    steps.length < 2 ||
    steps.length > maximumSequenceFrames ||
    steps.length > columns * rows
  )
    throw new Error('Sequence frame count does not fit its atlas');
  if (
    steps[0] !== 0 ||
    steps.some((step, i) => !Number.isFinite(step) || (i > 0 && step <= steps[i - 1]))
  )
    throw new Error('Sequence steps must start at zero and strictly increase');
  if (!Number.isInteger(posterFrame) || posterFrame !== steps.length - 1)
    throw new Error('The final sequence frame must be the unchanged cover');
  if (mode === 'baked' && steps.some((step, i) => step !== i))
    throw new Error('A baked sequence must include every consecutive step');
  const keySteps = new Float32Array(maximumSequenceFrames).fill(1);
  steps.forEach((step, index) => {
    keySteps[index] = step / steps.at(-1);
  });
  const flowRange = value.flowRange ?? 0.16;
  if (!Number.isFinite(flowRange) || flowRange <= 0)
    throw new Error('Sequence flow range must be positive');
  return { ...value, mode, flowRange, frameCount: steps.length, keySteps };
}

export function sequenceInterval(normalized, sequence) {
  const position = clamp(normalized) * sequence.steps.at(-1);
  let from = 0;
  while (from < sequence.steps.length - 2 && position > sequence.steps[from + 1]) from++;
  const to = from + 1;
  const mix = smooth(
    (position - sequence.steps[from]) / (sequence.steps[to] - sequence.steps[from]),
  );
  return { from, to, mix };
}
