import { siteConfig } from '../../config/site';
/** Slow longform reading with a floating-point clock and a real cover crossfade.
 * Input always wins. Hidden/unfocused pages and explicit pause stop the RAF loop.
 * The original artwork stays opaque while its cover dissolves over the last frame.
 */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => {
  t = clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const AUTO_READER = siteConfig.reader;
class AutoReader {
  constructor(reader, cover, pane, { onScroll = () => {}, speed = AUTO_READER.speed } = {}) {
    if (!reader || !cover || !pane)
      throw new Error('AutoReader requires reader, cover and media pane.');
    Object.assign(this, {
      reader,
      cover,
      pane,
      onScroll,
      speed: clamp(Number(speed) || 14, 1, 80),
    });
    this.alive = true;
    this.paused = false;
    this.suspended = document.hidden;
    this.holding = false;
    this.mode = 'reading';
    this.position = reader.scrollTop;
    this.lastWrite = reader.scrollTop;
    this.last = 0;
    this.raf = 0;
    this.timer = 0;
    this.cycles = 0;
    this.readyAt = performance.now() + AUTO_READER.startDelay;
    this.phaseAt = 0;
    this.committedFrames = 0;
    this.cleanup = [];
    const listen = (el, type, fn, opts) => {
      el.addEventListener(type, fn, opts);
      this.cleanup.push(() => el.removeEventListener(type, fn, opts));
    };
    listen(reader, 'wheel', () => this.interrupt(), {
      passive: true,
    });
    listen(
      reader,
      'pointerdown',
      () => {
        this.holding = true;
        this.interrupt();
      },
      {
        passive: true,
      },
    );
    listen(
      window,
      'pointerup',
      () => {
        if (this.holding) {
          this.holding = false;
          this.interrupt();
        }
      },
      {
        passive: true,
      },
    );
    listen(
      window,
      'pointercancel',
      () => {
        this.holding = false;
        this.interrupt();
      },
      {
        passive: true,
      },
    );
    listen(
      reader,
      'touchstart',
      () => {
        this.holding = true;
        this.interrupt();
      },
      {
        passive: true,
      },
    );
    listen(reader, 'touchmove', () => this.interrupt(), {
      passive: true,
    });
    listen(
      window,
      'touchend',
      () => {
        if (this.holding) {
          this.holding = false;
          this.interrupt();
        }
      },
      {
        passive: true,
      },
    );
    listen(
      window,
      'touchcancel',
      () => {
        this.holding = false;
        this.interrupt();
      },
      {
        passive: true,
      },
    );
    listen(reader, 'keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key))
        this.interrupt();
    });
    listen(
      reader,
      'scroll',
      () => {
        const value = reader.scrollTop;
        // Browser scroll storage may quantise. Never discard the private fractional position
        // after our own <1px advance. Only a genuinely external scroll is adopted.
        if (Math.abs(value - this.lastWrite) > 1.1) {
          this.position = value;
          this.lastWrite = value;
          this.interrupt();
        }
        this.onScroll();
      },
      {
        passive: true,
      },
    );
    listen(document, 'visibilitychange', () => this.setSuspended(document.hidden));
    listen(window, 'blur', () => {
      this.holding = false;
      this.setSuspended(true);
    });
    listen(window, 'focus', () => this.setSuspended(document.hidden));
    this.tick = this.tick.bind(this);
    reader.__autoReader = this;
    this.status();
    this.request();
  }
  status() {
    this.pane.dataset.autoState = this.paused ? 'paused' : this.suspended ? 'suspended' : this.mode;
    this.pane.dataset.autoCycles = String(this.cycles);
  }
  stop() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.raf = 0;
    this.timer = 0;
    this.last = 0;
  }
  request() {
    if (this.alive && !this.paused && !this.suspended && !this.raf)
      this.raf = requestAnimationFrame(this.tick);
  }
  wait(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(
      () => {
        this.timer = 0;
        this.last = 0;
        this.request();
      },
      Math.max(15, ms),
    );
  }
  cancelReturn() {
    this.cover.style.opacity = '0';
    delete this.pane.dataset.returning;
    this.pane.style.removeProperty('--return-progress');
    this.mode = 'reading';
    this.committedFrames = 0;
  }
  interrupt(delay = AUTO_READER.resumeDelay) {
    if (!this.alive) return;
    this.cancelReturn();
    this.position = this.reader.scrollTop;
    this.lastWrite = this.reader.scrollTop;
    this.readyAt = performance.now() + delay;
    this.stop();
    this.status();
    if (!this.paused && !this.suspended) this.wait(delay);
  }
  setPaused(value) {
    if (!this.alive || this.paused === !!value) return;
    this.paused = !!value;
    this.interrupt(this.paused ? 0 : 750);
    this.status();
  }
  setSuspended(value) {
    if (!this.alive) return;
    this.suspended = !!value;
    this.stop();
    if (!value) {
      this.cancelReturn();
      this.position = this.reader.scrollTop;
      this.lastWrite = this.position;
      this.readyAt = performance.now() + 800;
      this.request();
    }
    this.status();
  }
  reset() {
    this.interrupt(2000);
    this.reader.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
  tick(now) {
    this.raf = 0;
    if (!this.alive || this.paused || this.suspended || document.hidden) return;
    if (this.holding) {
      this.wait(150);
      return;
    }
    const max = Math.max(0, this.reader.scrollHeight - this.reader.clientHeight);
    if (max < 24) {
      this.wait(500);
      return;
    }
    const dt = this.last ? clamp((now - this.last) / 1000, 0, 0.16) : 0;
    this.last = now;
    if (now < this.readyAt) {
      this.wait(this.readyAt - now);
      return;
    }
    if (this.mode === 'reading') {
      this.position = clamp(this.position + this.speed * dt, 0, max);
      this.reader.scrollTop = this.position;
      this.lastWrite = this.reader.scrollTop;
      if (this.position >= max - 0.1) {
        this.reader.scrollTop = max;
        this.lastWrite = max;
        this.mode = 'bottom-hold';
        this.phaseAt = now;
        this.status();
      }
    } else if (this.mode === 'bottom-hold') {
      if (now - this.phaseAt >= AUTO_READER.bottomHold) {
        this.mode = 'returning';
        this.phaseAt = now;
        this.pane.dataset.returning = 'true';
        this.cover.style.opacity = '0';
        this.status();
      }
    } else if (this.mode === 'returning') {
      const t = clamp((now - this.phaseAt) / AUTO_READER.returnDuration, 0, 1),
        alpha = smooth(t);
      this.cover.style.opacity = String(alpha);
      this.pane.style.setProperty('--return-progress', String(alpha));
      if (t === 1) {
        // The visible cover is already fully opaque. Reset the real scroller behind it,
        // retain that identical cover through two RAFs, then remove it without a flash.
        this.position = 0;
        this.reader.scrollTop = 0;
        this.lastWrite = 0;
        this.mode = 'cover-held';
        this.committedFrames = 0;
        this.status();
      }
    } else if (this.mode === 'cover-held') {
      if (++this.committedFrames >= 2) {
        this.cycles++;
        this.cancelReturn();
        this.readyAt = now + AUTO_READER.topHold;
        this.onScroll();
        this.status();
      }
    }
    this.request();
  }
  getState() {
    return {
      alive: this.alive,
      mode: this.mode,
      paused: this.paused,
      suspended: this.suspended,
      position: this.position,
      speed: this.speed,
      cycles: this.cycles,
      readyAt: this.readyAt,
    };
  }
  destroy() {
    if (!this.alive) return;
    this.alive = false;
    this.stop();
    this.cleanup.forEach((fn) => fn());
    this.cancelReturn();
    delete this.pane.dataset.autoState;
    delete this.pane.dataset.autoCycles;
    if (this.reader.__autoReader === this) delete this.reader.__autoReader;
  }
}
export { AutoReader };
export { AUTO_READER };
