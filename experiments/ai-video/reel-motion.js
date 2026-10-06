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
    opacity: 1,
    titleY: y - Math.abs(y) * config.titleParallax,
    metadataY: y + Math.abs(y) * config.metadataParallax,
  };
}

export function sceneInView(pose, geometry, captions) {
  const f = geometry.frame;
  const tops = [
    f.y + pose.y,
    captions.title.top + pose.titleY,
    captions.parameters.top + pose.metadataY,
  ];
  const bottoms = [
    tops[0] + f.h,
    tops[1] + captions.title.height,
    tops[2] + captions.parameters.height,
  ];
  // Keep caption shadows until the whole scene has physically left the viewport.
  return Math.max(...bottoms) >= -24 && Math.min(...tops) <= geometry.H + 24;
}
