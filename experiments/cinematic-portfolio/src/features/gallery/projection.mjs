/** Shared CPU projection for Canvas rendering and pointer hit testing.
 * The inverse Newton iteration must match the GLSL lens in GalleryEngine.
 */
export function screenToField(x, y, lens) {
  const { width, height, norm, tile, curve, tilt, actualPan, core, horizontal } = lens;
  let qx = (x - width * 0.5) / norm,
    qy = (y - height * 0.5) / norm;
  const perspective = 1 + (qx * tilt.x + qy * tilt.y) * 0.025;
  qx /= perspective;
  qy /= perspective;
  const r = Math.hypot(qx * horizontal, qy);
  let s = r;
  for (let i = 0; i < 8; i++) {
    const d = Math.max(s - core, 0),
      d2 = d * d,
      d3 = d2 * d;
    s -= (s * (1 + curve * d3) - r) / (1 + curve * d3 + 3 * curve * s * d2);
  }
  const k = r ? s / r : 1;
  return { x: (qx * k * norm) / tile + actualPan.x, y: (qy * k * norm) / tile + actualPan.y };
}
export function fieldToScreen(gx, gy, lens) {
  const { width, height, norm, tile, curve, tilt, actualPan, core, horizontal } = lens;
  let px = ((gx - actualPan.x) * tile) / norm,
    py = ((gy - actualPan.y) * tile) / norm;
  const d = Math.max(Math.hypot(px * horizontal, py) - core, 0),
    radial = 1 + curve * d * d * d;
  px *= radial;
  py *= radial;
  const perspective = 1 - (px * tilt.x + py * tilt.y) * 0.025;
  return {
    x: width * 0.5 + (px / perspective) * norm,
    y: height * 0.5 + (py / perspective) * norm,
  };
}
