export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export function smooth(n) {
  n = clamp(n);
  return n * n * (3 - 2 * n);
}
export const range = (a, b, n) => smooth((n - a) / (b - a));

export function reelLayout(W, H, config, aspect) {
  const mobile = W < 760;
  const w = Math.min(
    W * (mobile ? config.mobileVideoWidth : config.videoWidth),
    H * 0.64 * aspect,
    1440,
  );
  const h = w / aspect;
  return {
    W,
    H,
    mobile,
    frame: { x: (W - w) / 2, y: (H - h) / 2, w, h },
    travel: H * config.sceneTravel,
  };
}

export function scenePose(position, index, g, config) {
  const r = position - index,
    y = -r * g.travel;
  return {
    r,
    y,
    opacity: r < 0 ? range(-0.9, -0.1, r) : 1 - range(0.15, 0.9, r),
    titleY: y - Math.abs(y) * config.titleParallax,
    metadataY: y + Math.abs(y) * config.metadataParallax,
    referenceY: y * config.referenceParallax,
    referenceOpacity: range(-0.98, -0.18, r) * (1 - range(0.1, 0.83, r)),
    connection:
      range(-0.48, -0.08, r) *
      (1 - range(0.1, 0.72, r)) *
      smooth(clamp((g.H - (g.frame.y + y)) / g.frame.h)),
  };
}

export function referenceRect(ref, i, g) {
  const w = g.W * (g.mobile ? 0.23 : 0.132),
    h = w / 1.855;
  if (!g.mobile) return { x: ref.x * g.W, y: ref.y * g.H, w, h, tilt: ref.tilt };
  const rows =
    ref.side === 'left'
      ? [0.1, 0.18, 0.24, 0.72, 0.84, 0.98]
      : [0.09, 0.18, 0.28, 0.74, 0.86, 0.99];
  return {
    x: (ref.side === 'left' ? -0.025 : 0.805) * g.W,
    y: rows[i % 6] * g.H,
    w,
    h,
    tilt: ref.tilt * 0.7,
  };
}
