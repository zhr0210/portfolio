import { clamp, range } from './reel-motion.js';

// Coordinates up to the first AI entry retain the original live-action timeline.
export function reelTimeline(works, config) {
  let anchor = 0;
  return works.map((work) => {
    const entry = anchor;
    const end = entry + (work.type === 'ai' ? config.aiGeneration.scrollSpan : 0);
    anchor = end + 1;
    return { entry, end, type: work.type };
  });
}

export function generationProgress(position, segment) {
  return clamp((position - segment.entry) / (segment.end - segment.entry));
}

export function generationState(value, config) {
  const progress = clamp(Number.isFinite(value) ? value : 0);
  const s = config.stages;
  const phase =
    progress < s.gather
      ? 'gather'
      : progress < s.white
        ? 'white'
        : progress < s.scan
          ? 'code'
          : progress < s.split
            ? 'split'
            : progress < s.denoise
              ? 'denoise'
              : progress < 1
                ? 'resolve'
                : 'complete';
  return {
    progress,
    phase,
    white: range(s.gather - 0.055, s.gather, progress),
    scan: range(s.white, s.scan, progress),
    split: range(s.scan, s.split, progress),
    denoise: range(s.split, s.denoise, progress),
    resolve: range(s.denoise, 1, progress),
    labelOpacity: range(s.denoise - 0.09, 1, progress),
    complete: progress >= 1,
  };
}

export function seededUnit(seed, slot) {
  let n = (seed ^ Math.imul(slot + 1, 0x9e3779b9)) >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

const desktopSlots = [
  [-0.44, -0.34],
  [0.05, -0.4],
  [0.46, -0.31],
  [-0.54, -0.02],
  [0.5, 0.08],
  [-0.33, 0.33],
  [0.14, 0.39],
  [0.48, 0.34],
  [-0.27, -0.15],
  [0.25, -0.14],
  [-0.2, 0.2],
  [0.26, 0.21],
];

export function referencePose(value, reference, index, count, geometry, config) {
  const p = clamp(value),
    f = geometry.frame;
  const random = (slot) => seededUnit(config.seed, index * 7 + slot);
  const virtualHeight = f.h / 0.4;
  const virtualWidth =
    virtualHeight * (geometry.mobile ? config.mobileReferenceSpread : config.referenceSpread);
  const slot = desktopSlots[index % desktopSlots.length];
  const phoneTop = index % 2 === 0;
  const x = reference.scatter?.x ?? (geometry.mobile ? ((index % 6) - 2.5) * 0.23 : slot[0]);
  const y =
    reference.scatter?.y ??
    (geometry.mobile ? (phoneTop ? -0.36 : 0.36) + (random(0) - 0.5) * 0.13 : slot[1]);
  const startX = geometry.W / 2 + x * virtualWidth + (random(1) - 0.5) * virtualHeight * 0.05;
  const startY = geometry.H / 2 + y * virtualHeight + (random(2) - 0.5) * virtualHeight * 0.05;
  const width = f.h * 1.855 * config.referenceScale * (reference.scale ?? 1);
  const delay = 0.008 + (index / Math.max(1, count - 1)) * (config.stages.gather - 0.12);
  const u = range(delay, delay + 0.112, p);
  const arc = Math.sin(Math.PI * u) * (random(3) - 0.5) * virtualHeight * 0.14;
  const mix = (a, b) => a + (b - a) * u;
  return {
    x: mix(startX, geometry.W / 2) + arc,
    y: mix(startY, geometry.H / 2) - Math.abs(arc) * 0.55,
    w: mix(width, f.w),
    h: mix(width / 1.855, f.h),
    tilt: ((reference.tilt ?? 0) + (random(4) - 0.5) * 8) * (1 - u),
    opacity:
      config.referenceOpacity *
      (reference.opacity ?? 1) *
      (1 - range(config.stages.gather - 0.009, config.stages.gather, p)),
    exposure: 0.88 + u * u * 1.15,
    progress: u,
  };
}

/** Same UV rectangle for the shader, CSS cover fit and existing 1.12 overscan. */
export function mediaUV(frame, width, height, crop = [0, 0, width, height], overscan = 1.12) {
  const sourceAspect = crop[2] / crop[3],
    targetAspect = frame.w / frame.h;
  const sx = Math.min(1, targetAspect / sourceAspect) / overscan;
  const sy = Math.min(1, sourceAspect / targetAspect) / overscan;
  return {
    x: (crop[0] + (crop[2] * (1 - sx)) / 2) / width,
    y: 1 - (crop[1] + (crop[3] * (1 + sy)) / 2) / height,
    w: (crop[2] * sx) / width,
    h: (crop[3] * sy) / height,
  };
}
