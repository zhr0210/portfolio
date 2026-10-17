/** Reflect the actual cover-cropped border, preserving its scale at both seams. */
export function drawMirroredCover(
  context,
  source,
  { width, height, padding, aspect, edgeInset = 0 },
) {
  const sourceWidth = source.videoWidth,
    sourceHeight = source.videoHeight;
  const cropWidth = Math.min(sourceWidth, sourceHeight * aspect);
  let cropHeight = Math.min(sourceHeight, sourceWidth / aspect);
  const x = (sourceWidth - cropWidth) / 2,
    originalY = (sourceHeight - cropHeight) / 2;
  const inset = Math.min(edgeInset, height * 0.1);
  const y = originalY + (cropHeight * inset) / height;
  cropHeight *= 1 - (inset * 2) / height;
  const imageHeight = height - inset * 2;
  const top = padding + inset;
  context.drawImage(source, x, y, cropWidth, cropHeight, 0, top, width, imageHeight);
  const band = Math.min(padding + inset, imageHeight);
  const sourceBand = (cropHeight * band) / imageHeight;
  for (const bottom of [false, true]) {
    context.save();
    try {
      context.translate(0, top + (bottom ? imageHeight : 0));
      context.scale(1, -1);
      context.drawImage(
        source,
        x,
        bottom ? y + cropHeight - sourceBand : y,
        cropWidth,
        sourceBand,
        0,
        bottom ? -band : 0,
        width,
        band,
      );
    } finally {
      context.restore();
    }
  }
}

/** Sample the existing decoder; no second video or independently scaled backdrop. */
export function createVideoFill(video, canvas, { maxSize = 1280 } = {}) {
  const context = canvas.getContext('2d', { alpha: false });
  const abort = new AbortController();
  let active = false,
    disposed = false,
    pending = null;
  const nativeFrames = typeof video.requestVideoFrameCallback === 'function';
  let geometry = null;
  canvas.width = canvas.height = 1;
  canvas.hidden = true;

  function cancel() {
    if (pending === null) return;
    if (nativeFrames) video.cancelVideoFrameCallback(pending);
    else cancelAnimationFrame(pending);
    pending = null;
  }
  function draw() {
    if (!active || disposed || !context || video.readyState < 2 || !video.videoWidth) return;
    try {
      drawMirroredCover(context, video, geometry);
      canvas.hidden = false;
    } catch {
      canvas.hidden = true; // The configured cover remains underneath on media failure.
    }
  }
  function schedule() {
    if (!active || disposed || !context || video.paused || video.ended || pending !== null) return;
    const frame = () => {
      pending = null;
      draw();
      schedule();
    };
    pending = nativeFrames ? video.requestVideoFrameCallback(frame) : requestAnimationFrame(frame);
  }
  const on = (type, handler) => video.addEventListener(type, handler, { signal: abort.signal });
  on('playing', () => {
    draw();
    schedule();
  });
  on('pause', cancel);
  on('ended', cancel);
  on('loadeddata', () => {
    draw();
    schedule();
  });
  on('seeked', draw);
  for (const event of ['emptied', 'loadstart', 'error'])
    on(event, () => {
      cancel();
      canvas.hidden = true;
    });

  return {
    update({ active: enabled, width, height, padding = 96, pixelRatio = 1, edgeInset = 2 }) {
      if (disposed) return;
      const wasActive = active;
      active = !!enabled;
      if (!active) {
        cancel();
        canvas.hidden = true;
        if (wasActive) canvas.width = canvas.height = 1;
        return;
      }
      const scale = Math.min(pixelRatio, maxSize / Math.max(width, height + padding * 2, 1));
      const w = Math.max(1, Math.round(width * scale)),
        h = Math.max(1, Math.round(height * scale)),
        pad = Math.max(1, Math.round(Math.min(padding, height) * scale));
      const resized = canvas.width !== w || canvas.height !== h + pad * 2;
      geometry = {
        width: w,
        height: h,
        padding: pad,
        aspect: width / height,
        edgeInset: (edgeInset * h) / height,
      };
      canvas.style.top = (-pad / h) * height + 'px';
      canvas.style.height = ((h + pad * 2) / h) * height + 'px';
      if (resized) {
        canvas.width = w;
        canvas.height = h + pad * 2;
      }
      if (!wasActive || resized) draw();
      schedule();
    },
    dispose() {
      disposed = true;
      active = false;
      cancel();
      abort.abort();
      canvas.hidden = true;
      canvas.width = canvas.height = 1;
    },
  };
}
