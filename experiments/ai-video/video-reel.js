import {
  reelConfig,
  reelWorks,
  sheet,
  filmCrop,
  cameraCrops,
  referenceFrames,
} from './video-reel.config.js';
import { clamp, smooth, reelLayout, scenePose, referenceRect } from './reel-motion.js';

let wireSequence = 0;
const ns = 'http://www.w3.org/2000/svg';
function svgNode(name, attrs = {}) {
  const el = document.createElementNS(ns, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}
function crop(el, rect) {
  el.style.backgroundImage = `url("${new URL(sheet.src, import.meta.url)}")`;
  el.style.backgroundSize = `${(sheet.width / rect[2]) * 100}% ${(sheet.height / rect[3]) * 100}%`;
  el.style.backgroundPosition = `${(rect[0] / (sheet.width - rect[2])) * 100}% ${(rect[1] / (sheet.height - rect[3])) * 100}%`;
}
function box(el, r) {
  el.style.left = r.x + 'px';
  el.style.top = r.y + 'px';
  el.style.width = r.w + 'px';
  el.style.height = r.h + 'px';
}
function move(el, x, y, extra = '') {
  el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) ${extra}`;
}

export class VideoReel {
  constructor(host, { standalone = false, returnUrl = '../../dist/' } = {}) {
    this.host = host;
    this.standalone = standalone;
    this.position = this.target = this.pending = this.velocity = 0;
    this.active = false;
    this.raf = 0;
    this.lastTime = 0;
    this.snap = null;
    this.drag = null;
    this.muted = true;
    this.userPaused = false;
    this.playing = null;
    this.sources = new Map();
    this.abort = new AbortController();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.works = reelWorks.map((w) => ({ ...w }));
    host.innerHTML = `<section class="video-reel is-inactive" tabindex="0" role="region" aria-label="视频作品，向下滚动或上下方向键浏览"><div class="reel-world"></div><header class="reel-header"><div class="reel-menu" hidden><a class="reel-return">返回作品集 ↗</a><div class="reel-work-links"></div><label class="reel-upload">载入当前视频<input type="file" accept="video/*" aria-label="载入当前视频"></label><button data-action="play">播放 / 暂停</button><button data-action="sound">开启声音</button><button data-action="info">素材说明</button></div><button class="reel-menu-toggle" aria-expanded="false">MENU <i aria-hidden="true"></i></button></header><footer class="reel-footer"><span class="reel-count">01 / 02</span><span class="reel-scroll">SCROLL TO EXPLORE <i aria-hidden="true"></i></span></footer><div class="reel-message" role="status"></div><div class="reel-info" hidden><p>当前使用你提供的设计图预览构图，两种布局共享同一帧示意画面。尚未接入正式视频。</p><p>MENU 可载入当前作品的本地视频，仅用于本次浏览，不上传。相机暂为静态参考图。</p><button data-action="close-info">关闭</button></div></section>`;
    this.root = host.firstElementChild;
    this.root.querySelector('.reel-return').href = returnUrl;
    this.world = this.root.querySelector('.reel-world');
    this.menu = this.root.querySelector('.reel-menu');
    this.menuToggle = this.root.querySelector('.reel-menu-toggle');
    this.count = this.root.querySelector('.reel-count');
    this.scrollHint = this.root.querySelector('.reel-scroll');
    this.scenes = this.works.map((work, index) => this.makeScene(work, index));
    const on = (el, type, fn, options = {}) =>
      el.addEventListener(type, fn, { ...options, signal: this.abort.signal });
    const links = this.root.querySelector('.reel-work-links');
    this.works.forEach((work, index) => {
      const button = document.createElement('button');
      button.textContent = `0${index + 1} ${work.title} · ${work.type === 'live' ? '实拍' : 'AI'}`;
      on(button, 'click', () => this.goTo(index));
      links.append(button);
    });
    on(this.menuToggle, 'click', () => this.setMenu(this.menu.hidden));
    on(this.root, 'click', (e) => {
      if (!e.target.closest('.reel-header')) this.setMenu(false);
    });
    on(this.root.querySelector('input'), 'change', (e) => this.loadFile(e.target.files[0]));
    on(this.root.querySelector('[data-action=play]'), 'click', () => this.togglePlay());
    on(this.root.querySelector('[data-action=sound]'), 'click', () => {
      this.muted = !this.muted;
      this.scenes.forEach((s) => (s.video.muted = this.muted));
      this.root.querySelector('[data-action=sound]').textContent = this.muted ? '开启声音' : '静音';
      this.setMenu(false);
    });
    on(this.root.querySelector('[data-action=info]'), 'click', () => {
      this.root.querySelector('.reel-info').hidden = false;
      this.setMenu(false);
    });
    on(
      this.root.querySelector('[data-action=close-info]'),
      'click',
      () => (this.root.querySelector('.reel-info').hidden = true),
    );
    on(this.root, 'wheel', (e) => this.wheel(e), { passive: false });
    on(this.root, 'pointerdown', (e) => this.pointerDown(e));
    on(this.root, 'pointermove', (e) => this.pointerMove(e));
    on(this.root, 'pointerup', (e) => this.pointerEnd(e));
    on(this.root, 'pointercancel', (e) => this.pointerEnd(e));
    on(this.root, 'keydown', (e) => {
      if (e.key === 'Escape') {
        this.setMenu(false);
        this.root.querySelector('.reel-info').hidden = true;
        return;
      }
      if (e.target.closest('button,input,a')) return;
      const delta = { ArrowDown: 0.075, ArrowUp: -0.075, PageDown: 0.3, PageUp: -0.3 }[e.key];
      if (delta) {
        e.preventDefault();
        this.input(delta);
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        this.goTo(e.key === 'Home' ? 0 : this.works.length - 1);
      }
    });
    on(document, 'visibilitychange', () => {
      this.root.classList.toggle('is-background', document.hidden);
      if (document.hidden) {
        this.cancelMotion();
        this.pauseAll();
      } else this.request();
    });
    on(this.reduced, 'change', () => {
      this.cancelMotion();
      this.root.classList.toggle('is-reduced', this.reduced.matches);
      this.request();
    });
    this.root.classList.toggle('is-reduced', this.reduced.matches);
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(host);
    this.layout();
  }
  makeScene(work, index) {
    const el = document.createElement('article');
    el.className = `reel-scene reel-${work.type}`;
    el.setAttribute('aria-label', `${work.title} · ${work.type === 'live' ? '实拍' : 'AI'}视频`);
    el.innerHTML =
      '<svg class="reel-wires" aria-hidden="true"></svg><div class="reel-side-elements"></div><div class="reel-frame"><div class="reel-poster" role="img"></div><video muted playsinline loop preload="auto"></video></div><div class="reel-title"><span></span><h1></h1></div><div class="reel-parameters"></div>';
    const frame = el.querySelector('.reel-frame'),
      poster = el.querySelector('.reel-poster'),
      video = el.querySelector('video');
    crop(poster, filmCrop);
    poster.setAttribute('aria-label', `${work.title}，设计参考画面`);
    video.setAttribute('aria-label', work.title + '视频');
    video.setAttribute('aria-hidden', 'true');
    video.muted = true;
    el.querySelector('.reel-title span').textContent = work.eyebrow;
    el.querySelector('h1').textContent = work.title;
    const params = el.querySelector('.reel-parameters');
    work.parameters.forEach((line) => {
      const p = document.createElement('span');
      p.textContent = line;
      params.append(p);
    });
    const side = el.querySelector('.reel-side-elements'),
      svg = el.querySelector('svg');
    const scene = {
      el,
      frame,
      poster,
      video,
      title: el.querySelector('.reel-title'),
      params,
      side,
      svg,
      refs: [],
      cameras: [],
      work,
      index,
      source: null,
      failed: false,
    };
    if (work.type === 'live') {
      cameraCrops.forEach((rect, i) => {
        const camera = document.createElement('div');
        camera.className = 'reel-camera';
        camera.dataset.cameraSlot = i === 0 ? 'left' : 'right';
        camera.setAttribute('role', 'img');
        camera.setAttribute('aria-label', `相机设备${i + 1}，静态参考`);
        crop(camera, rect);
        side.append(camera);
        scene.cameras.push(camera);
      });
    } else {
      const defs = svgNode('defs');
      svg.append(defs);
      const gradient = svgNode('linearGradient', {
        id: 'reel-flow-' + ++wireSequence,
        x1: '0',
        x2: '1',
        y1: '0',
        y2: '0',
      });
      gradient.innerHTML =
        '<stop stop-color="#a2b9aa" stop-opacity="0"/><stop offset=".45" stop-color="#b8cdbe" stop-opacity=".65"/><stop offset=".7" stop-color="#e5f0d6"/><stop offset="1" stop-color="#97b3a2" stop-opacity="0"/>';
      defs.append(gradient);
      scene.refs = referenceFrames.map((ref, i) => {
        const node = document.createElement('div');
        node.className = 'reel-reference';
        const image = document.createElement(ref.video ? 'video' : ref.src ? 'img' : 'div');
        image.className = 'reel-reference-image';
        image.setAttribute('aria-label', ref.name + (ref.src || ref.video ? '' : '，示意画面'));
        if (ref.video) {
          image.src = new URL(ref.video, import.meta.url).href;
          image.muted = true;
          image.playsInline = true;
          image.loop = true;
          image.preload = 'metadata';
          image.addEventListener('loadeddata', () => this.request(), { signal: this.abort.signal });
        } else if (ref.src) {
          image.src = new URL(ref.src, import.meta.url).href;
          image.alt = ref.name;
        } else {
          image.setAttribute('role', 'img');
          crop(image, filmCrop);
        }
        node.append(image);
        side.append(node);
        const mask = svgNode('mask', {
          id: 'reel-mask-' + ++wireSequence,
          maskUnits: 'userSpaceOnUse',
        });
        const reveal = svgNode('path', {
          fill: 'none',
          stroke: '#fff',
          'stroke-width': 18,
          pathLength: 1000,
          'stroke-dasharray': '1000 1000',
        });
        mask.append(reveal);
        defs.append(mask);
        const base = svgNode('path', { class: 'reel-wire-base', pathLength: 1000 });
        const glow = svgNode('path', {
          class: 'reel-wire-glow',
          pathLength: 1000,
          stroke: `url(#${gradient.id})`,
        });
        const flow = svgNode('path', {
          class: 'reel-wire-flow',
          pathLength: 1000,
          stroke: `url(#${gradient.id})`,
        });
        for (const path of [base, glow, flow]) {
          path.setAttribute('mask', `url(#${mask.id})`);
          svg.append(path);
        }
        flow.style.animationDelay = glow.style.animationDelay = -(i * 0.31) + 's';
        return {
          node,
          image,
          video: ref.video ? image : null,
          ref,
          reveal,
          paths: [base, glow, flow],
          mask,
        };
      });
    }
    const on = (type, fn) => video.addEventListener(type, fn, { signal: this.abort.signal });
    on('loadeddata', () => {
      scene.failed = false;
      this.request();
    });
    on('loadedmetadata', () => this.layout());
    on('error', () => {
      if (scene.source) {
        scene.failed = true;
        frame.classList.remove('has-video');
        this.message('视频无法播放，请换用 MP4 或 WebM。');
        this.request();
      }
    });
    on('playing', () => {
      if (this.playing !== video || !this.active || document.hidden) video.pause();
    });
    if (work.video) {
      scene.source = new URL(work.video, import.meta.url).href;
      video.src = scene.source;
      frame.classList.add('has-video');
    }
    this.world.append(el);
    return scene;
  }
  layout() {
    const W = this.root.clientWidth,
      H = this.root.clientHeight;
    if (!W || !H) return;
    this.scenes.forEach((scene) => {
      const aspect = scene.video.videoWidth / scene.video.videoHeight || filmCrop[2] / filmCrop[3];
      const g = (scene.geo = reelLayout(W, H, reelConfig, aspect));
      const f = g.frame;
      box(scene.frame, f);
      scene.title.style.left = Math.max(18, f.x - W * (g.mobile ? 0.025 : 0.042)) + 'px';
      scene.title.style.top = f.y - (g.mobile ? 64 : Math.max(64, H * 0.073)) + 'px';
      scene.params.style.right = Math.max(18, f.x - g.W * 0.052) + 'px';
      scene.params.style.top = f.y + f.h + (g.mobile ? 16 : 20) + 'px';
      scene.params.style.transformOrigin = 'right top';
      scene.el.style.setProperty('--title-size', clamp(W * 0.026, 27, 56) + 'px');
      scene.el.style.setProperty('--parameter-size', clamp(W * 0.014, 12, 28) + 'px');
      scene.cameras.forEach((camera, i) => {
        const w = W * (g.mobile ? 0.235 : 0.17),
          h = (w * cameraCrops[i][3]) / cameraCrops[i][2];
        box(camera, {
          x: i === 0 ? -W * 0.018 : W - w * 0.83,
          y: H * (i === 0 ? (g.mobile ? 0.69 : 0.67) : g.mobile ? 0.18 : 0.18),
          w,
          h,
        });
      });
      scene.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      scene.refs.forEach((n, i) => {
        n.rect = referenceRect(n.ref, i, g);
        box(n.node, n.rect);
        for (const [k, v] of Object.entries({ x: -W, y: -H, width: W * 3, height: H * 3 }))
          n.mask.setAttribute(k, v);
      });
    });
    this.render();
    this.request();
  }
  render() {
    if (!this.scenes[0]?.geo) return;
    const nearest = Math.round(this.position);
    let focused = null;
    for (const scene of this.scenes) {
      const g = scene.geo,
        f = g.frame,
        p = scenePose(this.position, scene.index, g, reelConfig);
      scene.el.hidden = Math.abs(p.r) > 1.06;
      scene.el.inert = scene.index !== nearest;
      if (scene.el.hidden) continue;
      move(scene.frame, 0, p.y);
      scene.frame.style.opacity = p.opacity;
      move(scene.title, 0, p.titleY);
      scene.title.style.opacity = p.opacity;
      move(scene.params, 0, p.metadataY);
      scene.params.style.opacity = p.opacity;
      scene.frame.style.setProperty(
        '--media-drift',
        clamp(-p.r, -1, 1) * Math.min(26, f.h * 0.055) + 'px',
      );
      scene.cameras.forEach((camera) => {
        move(camera, 0, p.y);
        camera.style.opacity = p.opacity;
      });
      scene.refs.forEach((n, i) => {
        const extra = (1 - p.referenceOpacity) * (i % 3) * 12;
        const y = p.referenceY + extra;
        move(n.node, 0, y, `rotate(${n.rect.tilt}deg)`);
        n.node.style.opacity = p.referenceOpacity;
        move(
          n.image,
          clamp(p.r, -1, 1) * n.rect.w * 0.07 * (i % 2 ? 1 : -1),
          clamp(p.r, -1, 1) * n.rect.h * 0.06,
          'scale(1.16)',
        );
        n.shouldPlay =
          p.referenceOpacity > 0.3 && n.rect.y + y < g.H && n.rect.y + y + n.rect.h > 0;
        const left = n.ref.side === 'left',
          theta = (n.rect.tilt * Math.PI) / 180,
          sign = left ? 1 : -1;
        const ax = n.rect.x + n.rect.w / 2 + (sign * Math.cos(theta) * n.rect.w) / 2,
          ay = n.rect.y + y + n.rect.h / 2 + (sign * Math.sin(theta) * n.rect.w) / 2;
        const bx = left ? f.x : f.x + f.w,
          by = f.y + p.y + f.h * (0.22 + (i % 6) * 0.11),
          bend = Math.abs(bx - ax) * 0.52;
        const d = `M${ax} ${ay} C${ax + (left ? bend : -bend)} ${ay} ${bx + (left ? -bend : bend)} ${by} ${bx} ${by}`;
        for (const path of [...n.paths, n.reveal]) path.setAttribute('d', d);
        n.reveal.setAttribute('stroke-dashoffset', String((1 - p.connection) * 1000));
      });
      scene.svg.style.opacity = p.referenceOpacity;
      const hasVideo = !!scene.source && !scene.failed && scene.video.readyState >= 2;
      scene.frame.classList.toggle('has-video', hasVideo);
      scene.video.setAttribute('aria-hidden', String(!hasVideo));
      scene.poster.setAttribute('aria-hidden', String(hasVideo));
      if (Math.abs(p.r) < 0.18) focused = scene;
    }
    const next =
      focused?.source &&
      !focused.failed &&
      focused.video.readyState >= 2 &&
      this.active &&
      !document.hidden
        ? focused.video
        : null;
    if (next !== this.playing) {
      this.pauseAll();
      this.userPaused = false;
      this.playing = next;
      if (next) this.play(next);
    }
    this.count.textContent = `0${nearest + 1} / 0${this.works.length}`;
    for (const scene of this.scenes)
      for (const n of scene.refs) {
        if (!n.video) continue;
        if (!this.active || document.hidden || scene.el.hidden || !n.shouldPlay) n.video.pause();
        else if (n.video.paused && n.video.readyState >= 2) n.video.play()?.catch(() => {});
      }
    this.scrollHint.style.opacity = String(1 - clamp(this.position, 0, 0.6));
    this.root.dataset.position = this.position.toFixed(6);
    this.root.dataset.type = this.works[nearest].type;
    this.root.dataset.target = this.target.toFixed(6);
    this.root.dataset.phase = this.snap ? 'snap' : focused ? 'view' : 'transition';
  }
  request() {
    if (this.active && !document.hidden && !this.raf)
      this.raf = requestAnimationFrame((t) => this.tick(t));
  }
  tick(now) {
    this.raf = 0;
    if (!this.active || document.hidden) return;
    const dt = clamp((now - (this.lastTime || now - 16.7)) / 1000, 0.001, 0.05);
    this.lastTime = now;
    const before = this.position;
    if (this.snap) {
      const s = this.snap,
        u = clamp((now - s.start) / s.duration);
      this.position = s.from + (s.to - s.from) * smooth(u);
      if (u === 1) {
        this.position = this.target = s.to;
        this.snap = null;
      }
    } else {
      const delivered = this.pending * (1 - Math.exp(-dt / 0.1));
      this.pending -= delivered;
      this.target = clamp(this.target + delivered, 0, this.works.length - 1);
      const gap = this.target - this.position;
      this.position =
        this.reduced.matches || Math.abs(gap) < 0.00001
          ? this.target
          : this.position + gap * (1 - Math.exp(-dt / (this.drag ? 0.075 : reelConfig.smoothing)));
    }
    this.velocity = (this.position - before) / dt;
    this.render();
    if (
      this.snap ||
      Math.abs(this.pending) > 0.000001 ||
      Math.abs(this.target - this.position) > 0.000001
    )
      this.request();
    else {
      this.lastTime = 0;
      this.velocity = 0;
    }
  }
  input(delta, wheel = false) {
    if (!this.active || !Number.isFinite(delta) || !delta) return;
    const sign = Math.sign(delta);
    if (this.direction && this.direction !== sign) {
      this.pending = 0;
      this.target = this.position;
    }
    this.direction = sign;
    this.snap = null;
    if (wheel && !this.reduced.matches) this.pending += clamp(delta, -0.22, 0.22);
    else this.target = clamp(this.target + delta, 0, this.works.length - 1);
    this.request();
  }
  wheel(e) {
    if (!this.active || e.ctrlKey || e.target.closest('.reel-header,.reel-info')) return;
    const dy =
      (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) *
      (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.root.clientHeight : 1);
    if (
      !this.standalone &&
      ((this.position <= 0.001 && dy < 0) ||
        (this.position >= this.works.length - 1 - 0.001 && dy > 0))
    )
      return;
    if (dy) {
      e.preventDefault();
      this.input(dy / reelConfig.wheelTravel, true);
    }
  }
  pointerDown(e) {
    if (
      !this.active ||
      e.button !== 0 ||
      e.target.closest('button,a,input,label,.reel-header,.reel-info')
    )
      return;
    this.drag = { id: e.pointerId, startY: e.clientY, lastY: e.clientY, locked: false };
    this.root.focus({ preventScroll: true });
  }
  pointerMove(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    if (!d.locked) {
      if (Math.abs(e.clientY - d.startY) < 6) return;
      d.locked = true;
      this.root.setPointerCapture(e.pointerId);
      this.root.classList.add('is-dragging');
    }
    const dy = d.lastY - e.clientY;
    d.lastY = e.clientY;
    this.input(dy / Math.max(1100, this.root.clientHeight * 1.5));
  }
  pointerEnd(e) {
    if (this.drag?.id !== e.pointerId) return;
    if (this.root.hasPointerCapture(e.pointerId)) this.root.releasePointerCapture(e.pointerId);
    this.drag = null;
    this.root.classList.remove('is-dragging');
    const nearest = Math.round(this.target);
    if (Math.abs(this.target - nearest) < 0.16) this.goTo(nearest);
    else this.request();
  }
  goTo(index) {
    this.setMenu(false);
    const to = clamp(index, 0, this.works.length - 1);
    this.pending = 0;
    if (this.reduced.matches) {
      this.cancelMotion();
      this.position = this.target = to;
      this.render();
      return;
    }
    this.snap = {
      from: this.position,
      to,
      start: performance.now(),
      duration: 800 + Math.abs(to - this.position) * 400,
    };
    this.target = to;
    this.request();
  }
  setMenu(open) {
    this.menu.hidden = !open;
    this.menuToggle.setAttribute('aria-expanded', String(open));
  }
  setActive(active) {
    if (this.active === active) return;
    this.active = active;
    this.root.classList.toggle('is-inactive', !active);
    if (active) this.request();
    else {
      this.cancelMotion();
      this.pauseAll();
    }
  }
  cancelMotion() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.snap = null;
    this.pending = 0;
    this.target = this.position;
    this.lastTime = 0;
  }
  play(video) {
    video.play()?.catch(() => {
      if (this.playing === video) this.message('可从 MENU 点击播放。');
    });
  }
  pauseAll() {
    this.scenes.forEach((s) => {
      s.video.pause();
      s.refs.forEach((n) => n.video?.pause());
    });
    this.playing = null;
  }
  togglePlay() {
    const scene = this.scenes[Math.round(this.position)];
    if (!scene.source) {
      this.message('请先在 MENU 中载入当前视频。');
      return;
    }
    if (this.playing === scene.video) {
      this.userPaused = !this.userPaused;
      if (this.userPaused) scene.video.pause();
      else this.play(scene.video);
    } else this.goTo(scene.index);
    this.setMenu(false);
  }
  loadFile(file) {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      this.message('请选择视频文件。');
      return;
    }
    const scene = this.scenes[Math.round(this.position)],
      old = this.sources.get(scene.index);
    this.pauseAll();
    const src = URL.createObjectURL(file);
    this.sources.set(scene.index, src);
    scene.source = src;
    scene.failed = false;
    scene.video.src = src;
    scene.video.load();
    if (old) URL.revokeObjectURL(old);
    this.setMenu(false);
    this.userPaused = false;
    this.request();
    this.message('视频已载入，居中后静音播放。');
  }
  message(text) {
    const n = this.root.querySelector('.reel-message');
    n.textContent = text;
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => (n.textContent = ''), 3000);
  }
  destroy() {
    this.setActive(false);
    this.abort.abort();
    this.resize.disconnect();
    clearTimeout(this.messageTimer);
    this.scenes.forEach((s) => {
      s.video.removeAttribute('src');
      s.video.load();
      s.refs.forEach((n) => {
        if (n.video) {
          n.video.removeAttribute('src');
          n.video.load();
        }
      });
    });
    this.sources.forEach((s) => URL.revokeObjectURL(s));
    this.host.replaceChildren();
  }
}
