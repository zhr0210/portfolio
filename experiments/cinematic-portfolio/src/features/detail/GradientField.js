/**
 * A pointer-parameterised colour field for the frosted artwork card.
 * Fixed silver/graphite anchors plus ONE movable violet colour parameter.
 * Its smooth finite influence changes the nearby mixture, never the whole canvas uniformly. There is NO height field, ripple,
 * texture displacement, particle trail, ring, or velocity-driven simulation.
 * Only the diffuse colour below the foreground is painted. Artwork stays sharp.
 */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let grainURL = '';
function grain() {
  if (grainURL) return grainURL;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const image = ctx.createImageData(96, 96);
  let seed = 13847;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = seed >>> 24;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 110;
  }
  ctx.putImageData(image, 0, 0);
  grainURL = canvas.toDataURL('image/png');
  return grainURL;
}
function tint(rgb, lightness, saturation) {
  const l = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return rgb.map((v) => clamp(lightness + (v - l) * saturation, 0, 255));
}
class GradientField {
  constructor(canvas, host, source, { reduced = false } = {}) {
    this.canvas = canvas;
    this.host = host;
    this.ctx = canvas.getContext('2d', {
      alpha: false,
    });
    this.alive = true;
    this.reduced = reduced;
    this.frame = 0;
    this.lastTime = 0;
    this.drawCount = 0;
    this.current = {
      x: 0.5,
      y: 0.5,
      presence: 0,
    };
    this.target = {
      ...this.current,
    };
    this.palette = [
      [96, 100, 103],
      [16, 18, 21],
      [57, 61, 66],
      [103, 92, 132],
      [142, 128, 176],
    ];
    this.baseTexture = null;
    this.pixels = null;
    this.canvas.dataset.effect = 'local-pointer-colour-field';
    this.canvas.__gradient = this;
    this.canvas.dataset.gradientMotion = reduced ? 'static' : 'pointer';
    host.style.setProperty('--glass-grain', `url("${grain()}")`);
    this.move = this.move.bind(this);
    this.leave = this.leave.bind(this);
    this.tick = this.tick.bind(this);
    this.onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      } else if (this.alive && this.gap() > 0.0008) this.request();
    };
    host.addEventListener('pointermove', this.move, {
      passive: true,
    });
    host.addEventListener('pointerenter', this.move, {
      passive: true,
    });
    host.addEventListener('pointerleave', this.leave, {
      passive: true,
    });
    host.addEventListener('pointercancel', this.leave, {
      passive: true,
    });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.onResize = () => this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.onResize);
      this.observer.observe(host);
    } else window.addEventListener('resize', this.onResize);
    this.source = new Image();
    this.source.decoding = 'async';
    this.source.onload = () => {
      if (this.alive) {
        this.samplePalette();
        this.resize(true);
      }
    };
    this.source.onerror = () => {
      if (this.alive) this.resize(true);
    };
    this.source.src = source;
    this.resize();
  }
  samplePalette() {
    // Sample the existing artwork, keeping the accent related to it, not a rainbow.
    const c = document.createElement('canvas');
    c.width = c.height = 20;
    const ctx = c.getContext('2d', {
      willReadFrequently: true,
    });
    if (!ctx) return;
    try {
      ctx.drawImage(this.source, 0, 0, 20, 20);
      const data = ctx.getImageData(0, 0, 20, 20).data;
      const totals = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      for (let i = 0; i < data.length; i += 4) {
        const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (data[i + 3] < 128 || l < 25 || l > 245) continue;
        const group = Math.floor(i / 4 / 20) < 10 ? 0 : 1;
        for (let k = 0; k < 3; k++) totals[group][k] += data[i + k];
        totals[group][3]++;
      }
      const colors = totals.map((g) =>
        g[3] ? g.slice(0, 3).map((v) => v / g[3]) : [150, 151, 152],
      );
      const cool = tint(colors[1], 63, 0.22);
      const mist = tint(colors[0], 118, 0.2);
      const violet = [
        clamp(colors[0][0] * 0.26 + colors[1][0] * 0.18 + 74, 0, 255),
        clamp(colors[0][1] * 0.18 + colors[1][1] * 0.1 + 62, 0, 255),
        clamp(colors[0][2] * 0.36 + colors[1][2] * 0.42 + 108, 0, 255),
      ];
      const lilac = [
        clamp(violet[0] + 34, 0, 255),
        clamp(violet[1] + 28, 0, 255),
        clamp(violet[2] + 36, 0, 255),
      ];
      this.palette = [tint(colors[0], 94, 0.16), [16, 18, 21], cool, violet, lilac];
    } catch {
      /* An unavailable/cross-origin cover keeps the neutral silver palette. */
    }
  }
  resize(force = false) {
    if (!this.alive || !this.ctx) return;
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    if (width < 2 || height < 2) return;
    // This buffer is only diffuse material colour, never the image/text layer.
    const scale = Math.min(1, 224 / Math.max(width, height));
    const w = Math.max(48, Math.round(width * scale)),
      h = Math.max(48, Math.round(height * scale));
    if (!force && this.w === w && this.h === h) return;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.pixels = this.ctx.createImageData(w, h);
    this.aspect = width / height;
    this.metricX = width / Math.min(width, height);
    this.metricY = height / Math.min(width, height);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', {
      willReadFrequently: true,
    });
    ctx.fillStyle = '#282b2e';
    ctx.fillRect(0, 0, w, h);
    if (this.source.naturalWidth) {
      ctx.save();
      ctx.filter = 'blur(20px) saturate(.32)';
      const s = Math.max(w / this.source.naturalWidth, h / this.source.naturalHeight) * 1.35;
      ctx.drawImage(
        this.source,
        (w - this.source.naturalWidth * s) / 2,
        (h - this.source.naturalHeight * s) / 2,
        this.source.naturalWidth * s,
        this.source.naturalHeight * s,
      );
      ctx.restore();
    }
    try {
      this.baseTexture = ctx.getImageData(0, 0, w, h).data;
    } catch {
      this.baseTexture = null;
    }
    this.makeBase();
    this.draw();
    if (this.gap() > 0.0008) this.request();
  }
  move(event) {
    if (!this.alive || this.reduced || !this.ctx || event.pointerType === 'touch') return;
    const r = this.host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.target = {
      x: clamp((event.clientX - r.left) / r.width, 0, 1),
      y: clamp((event.clientY - r.top) / r.height, 0, 1),
      presence: 1,
    };
    this.request();
  }
  leave(event) {
    if (!this.alive || this.reduced || event?.pointerType === 'touch') return;
    // Relax to the initial gradient; no travelling wake survives the pointer.
    this.target = {
      x: 0.5,
      y: 0.5,
      presence: 0,
    };
    this.request();
  }
  gap() {
    return (
      Math.abs(this.target.x - this.current.x) +
      Math.abs(this.target.y - this.current.y) +
      Math.abs(this.target.presence - this.current.presence)
    );
  }
  request() {
    if (
      !this.frame &&
      this.alive &&
      !this.reduced &&
      this.ctx &&
      !document.hidden &&
      this.gap() > 0.0008
    ) {
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  }
  makeBase() {
    // These anchors are invariant under mouse movement, matching the reference's
    // stationary ambient field. Only the local support of the violet control changes.
    this.base = new Float32Array(this.w * this.h * 3);
    const anchors = [
      [-0.13, 0.09, 0.72, 0.88, 0.9],
      [0.52, 0.42, 0.58, 0.7, 1.42],
      [1.11, 1.03, 0.85, 0.8, 1.02],
    ];
    const pal = [this.palette[0], this.palette[1], this.palette[2]],
      w = this.w,
      h = this.h;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1),
          v = y / (h - 1),
          k = (y * w + x) * 3,
          i = (y * w + x) * 4;
        let sum = 0.03,
          r = 0,
          g = 0,
          b = 0;
        for (let j = 0; j < 3; j++) {
          const a = anchors[j],
            dx = (u - a[0]) / a[2],
            dy = (v - a[1]) / a[3],
            f = Math.exp(-(dx * dx + dy * dy) * 1.6) * a[4];
          sum += f;
          r += pal[j][0] * f;
          g += pal[j][1] * f;
          b += pal[j][2] * f;
        }
        const src = this.baseTexture;
        this.base[k] = (r / sum) * 0.94 + (src ? src[i] : 40) * 0.06;
        this.base[k + 1] = (g / sum) * 0.94 + (src ? src[i + 1] : 42) * 0.06;
        this.base[k + 2] = (b / sum) * 0.94 + (src ? src[i + 2] : 46) * 0.06;
      }
  }
  draw() {
    if (!this.pixels || !this.base || !this.alive) return;
    const { x: cx, y: cy, presence } = this.current,
      w = this.w,
      h = this.h,
      out = this.pixels.data,
      base = this.base;
    const smooth = (a, b, v) => {
      const t = clamp((v - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    };
    // Violet is intentionally dark enough to preserve the matte graphite material.
    const tint = this.palette[3],
      violet = [
        clamp(tint[0] * 0.72, 90, 113),
        clamp(tint[1] * 0.76, 64, 82),
        clamp(tint[2] * 0.8, 134, 160),
      ];
    const co = Math.cos(-0.22 + (cy - 0.5) * 0.24),
      si = Math.sin(-0.22 + (cy - 0.5) * 0.24);
    let supportCount = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1),
          v = y / (h - 1),
          ix = (y * w + x) * 4,
          bx = (y * w + x) * 3;
        const dx = (u - cx) * this.metricX,
          dy = (v - cy) * this.metricY;
        const xx = dx * co - dy * si,
          yy = dx * si + dy * co;
        const rad = Math.hypot(xx / 0.59, yy / 0.74),
          support = (1 - smooth(0.56, 1.12, rad)) * presence;
        // Not a light cursor: a broad skewed lobe and a softly opposing shoulder
        // redistribute the nearby gradient. Pixels outside this support stay unchanged.
        const lobe = Math.exp(-((xx / 0.33) ** 2 + (yy / 0.49) ** 2) * 1.15);
        const shoulder = Math.exp(-(((xx + 0.21) / 0.49) ** 2 + ((yy - 0.1) / 0.42) ** 2) * 1.6);
        const mix = support * (0.43 + 0.23 * lobe),
          depth = support * shoulder * 6;
        if (support > 0.02) supportCount++;
        for (let k = 0; k < 3; k++) {
          const color = base[bx + k] * (1 - mix) + violet[k] * mix - depth;
          const dither = (((x * 37 + y * 19) % 17) / 16 - 0.5) * 0.68;
          out[ix + k] = clamp(color + dither, 0, 255);
        }
        out[ix + 3] = 255;
      }
    this.ctx.putImageData(this.pixels, 0, 0);
    this.drawCount++;
    Object.assign(this.canvas.dataset, {
      gradientX: cx.toFixed(4),
      gradientY: cy.toFixed(4),
      gradientPresence: presence.toFixed(4),
      gradientFrames: String(this.drawCount),
      gradientSupport: (supportCount / (w * h)).toFixed(3),
      gradientSettled: String(this.gap() < 0.0008),
    });
  }
  tick(now) {
    this.frame = 0;
    if (!this.alive || document.hidden || this.reduced) return;
    const dt = clamp((now - this.lastTime) / 1000, 1 / 240, 0.25);
    this.lastTime = now;
    // Exponential interpolation is monotonic: no overshoot or spring/wave oscillation.
    const k = 1 - Math.exp(-dt / (this.target.presence ? 0.145 : 0.205));
    for (const key of ['x', 'y', 'presence'])
      this.current[key] += (this.target[key] - this.current[key]) * k;
    const done = this.gap() < 0.0008;
    if (done)
      this.current = {
        ...this.target,
      };
    this.draw();
    this.canvas.dataset.gradientSettled = String(done);
    if (!done) this.frame = requestAnimationFrame(this.tick);
  }
  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    if (this.canvas.__gradient === this) delete this.canvas.__gradient;
    this.observer?.disconnect();
    window.removeEventListener('resize', this.onResize);
    this.host.removeEventListener('pointermove', this.move);
    this.host.removeEventListener('pointerenter', this.move);
    this.host.removeEventListener('pointerleave', this.leave);
    this.host.removeEventListener('pointercancel', this.leave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.source.onload = this.source.onerror = null;
  }
}
export { GradientField };
