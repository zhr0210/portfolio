import { solveDenoise } from './ai-denoise-solver.js';

let currentJob = 0;
let paused = false;
let resume = null;
self.onmessage = async ({ data }) => {
  if ('pause' in data) {
    paused = data.pause;
    if (!paused) {
      resume?.();
      resume = null;
    }
    return;
  }
  const job = ++currentJob;
  try {
    const solver = solveDenoise({ ...data, rgba: new Uint8Array(data.rgba) });
    for (;;) {
      if (paused) await new Promise((resolve) => (resume = resolve));
      if (job !== currentJob) return;
      const result = solver.next();
      if (result.done) {
        self.postMessage({ ...result.value, pixels: result.value.pixels.buffer }, [
          result.value.pixels.buffer,
        ]);
        return;
      }
      // Return control to the worker event loop so replacement and cancellation respond.
      if (result.value.step % 5 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
  } catch (error) {
    if (job === currentJob) self.postMessage({ error: String(error.message || error) });
  }
};
