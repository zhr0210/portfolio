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
  };
}
