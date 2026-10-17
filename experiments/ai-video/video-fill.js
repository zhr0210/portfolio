/** A small live backdrop, sampled from the existing decoder rather than a second video. */
export function createVideoFill(video, canvas, { maxSize = 640 } = {}) {
  const context = canvas.getContext('2d', { alpha: false });
  const abort = new AbortController();
  let active = false,
    disposed = false,
    pending = null;
  const nativeFrames = typeof video.requestVideoFrameCallback === 'function';
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
    const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
    const width = video.videoWidth * scale,
      height = video.videoHeight * scale;
    try {
      context.drawImage(
        video,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height,
      );
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
    update({ active: enabled, width, height }) {
      if (disposed) return;
      const wasActive = active;
      active = !!enabled;
      if (!active) {
        cancel();
        canvas.hidden = true;
        if (wasActive) canvas.width = canvas.height = 1;
        return;
      }
      const scale = Math.min(1, maxSize / Math.max(width, height, 1));
      const w = Math.max(1, Math.round(width * scale)),
        h = Math.max(1, Math.round(height * scale));
      const resized = canvas.width !== w || canvas.height !== h;
      if (resized) {
        canvas.width = w;
        canvas.height = h;
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
