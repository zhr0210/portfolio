export const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
export function smooth(n) {
  n = clamp(n);
  return n * n * (3 - 2 * n);
}
export const range = (a, b, n) => smooth((n - a) / (b - a));

export function reelLayout(W, H, config, aspect) {
  const mobile = W < 760 && H > W;
  const edge = mobile ? config.mobileVideoEdge : config.videoEdge;
  const height = Math.min(
    H * config.videoHeight,
    Math.max(1, H - config.minimumVerticalMargin * 2),
  );
  const w = Math.min(height * aspect, Math.max(1, W - edge * 2));
  const h = height;
  return {
    W,
    H,
    mobile,
    frame: { x: (W - w) / 2, y: (H - h) / 2, w, h },
    travel: h + Math.max(H * config.sceneGap, config.minimumSceneGap),
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

export function referenceRect(ref, i, g, config) {
  const desired = g.frame.h * 1.855 * config.referenceWidth;
  const base = g.mobile ? Math.min(desired, g.W * config.mobileReferenceWidth) : desired;
  const w = base * (ref.scale ?? 1),
    h = w / 1.855;
  if (!g.mobile) return { x: ref.x * g.W, y: ref.y * g.H, w, h, tilt: ref.tilt };
  const slot = i % 6,
    lane = base / 1.855;
  const centerX = [-0.1, 0.16, 0.4, 0.66, 0.9, 1.14][slot] * g.W;
  const centerY =
    ref.side === 'left'
      ? Math.max(18, g.frame.y - 96 - lane * 0.4) + ((slot % 3) - 1) * 7
      : g.H - lane * 0.5 - ((slot % 3) - 1) * 9;
  return {
    x: centerX - w / 2,
    y: centerY - h / 2 + ref.tilt * 0.22,
    w,
    h,
    tilt: ref.tilt * 0.7,
  };
}
