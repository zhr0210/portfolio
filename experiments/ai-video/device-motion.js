const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);

// Travel and the complete authored animation have one fixed entry/exit.
export function devicePose(
  position,
  radius,
  height,
  { phase = 0, reduced = false, reducedProgress = 0.5 } = {},
) {
  const value = finite(position, 0) + finite(phase, 0);
  const travelProgress = clamp(value, 0, 1);
  const progress = reduced ? clamp(finite(reducedProgress, 0.5), 0, 1) : travelProgress;
  const margin = Math.max(1, finite(radius, 0)) + 8;
  const safeHeight = Math.max(1, finite(height, 1));
  const travel = safeHeight + margin * 2;
  return {
    progress,
    visible: travelProgress > 0 && travelProgress < 1,
    y: safeHeight + margin - progress * travel,
    travel,
  };
}

/** Absolute sampling keeps the authored device timing reversible. */
export function deviceTime(progress, duration, { reduced = false, reducedProgress = 0.5 } = {}) {
  const value = reduced ? reducedProgress : progress;
  return clamp(finite(value, 0), 0, 1) * Math.max(0, finite(duration, 0));
}

/** Crop an unchanged source camera frame; never move the animated model roots. */
export function deviceProjection(geo, sourceFov, config = {}, pixelRatio = 1, device = null) {
  const width = Math.max(1, finite(geo.W, 1));
  const height = Math.max(1, finite(geo.H, 1));
  const referenceHeight = Math.max(0.01, finite(config.referenceVideoHeight, 0.4));
  const slot = device
    ? (geo.mobile ? config.mobileComposition : config.desktopComposition)?.[device]
    : null;
  const size =
    Math.max(0.01, finite(config.size, 1)) *
    (geo.mobile
      ? device
        ? Math.max(0.01, finite(config.mobileSize, 0.48))
        : 1
      : Math.max(0.01, finite(config.desktopSize, 1)));
  const fullHeight =
    (Math.max(1, finite(geo.frame?.h, height * referenceHeight)) / referenceHeight) * size;
  const fullWidth = fullHeight * Math.max(0.01, finite(config.sourceAspect, 16 / 9));
  const fovScale = Math.max(0.01, finite(config.verticalFovScale, 1));
  const fov =
    (Math.atan(Math.tan((clamp(finite(sourceFov, 32.268), 1, 170) * Math.PI) / 360) * fovScale) *
      360) /
    Math.PI;
  const maximumDpr = Math.max(
    0.5,
    finite(geo.mobile ? config.mobileMaxPixelRatio : config.maxPixelRatio, geo.mobile ? 1 : 1.5),
  );
  return {
    width,
    height,
    fullWidth,
    fullHeight,
    offsetX: slot
      ? fullWidth * slot.sourceX -
        (geo.mobile ? width : Math.max(width, height * finite(config.compositionAspect, 16 / 9))) *
          (slot.targetX - 0.5) -
        width * 0.5 -
        finite(config.offsetX, 0) * fullHeight
      : (fullWidth - width) / 2 - finite(config.offsetX, 0) * fullHeight,
    offsetY: slot
      ? fullHeight * slot.sourceY - height * slot.targetY - finite(config.offsetY, 0) * fullHeight
      : (fullHeight - height) / 2 - finite(config.offsetY, 0) * fullHeight,
    fov,
    pixelRatio: clamp(finite(pixelRatio, 1), 0.5, maximumDpr),
  };
}
