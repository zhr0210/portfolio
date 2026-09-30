/* One damped playhead drives matrix, film and thumbnail rail. */
(function () {
  'use strict';
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)),
    mix = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => {
      t = clamp(t);
      return t * t * (3 - 2 * t);
    },
    mod = (n, m) => ((n % m) + m) % m;
  const FULL_START = 0.52,
    FULL_END = 0.64,
    FOCUS = 0.58;
  const crops = [
    { name: '角色设定', rect: [139, 229, 220, 164] },
    { name: '元素设定', rect: [459, 229, 249, 165] },
    { name: '动作参考', rect: [771, 229, 291, 165] },
    { name: '起始画面', rect: [104, 436, 290, 163] },
    { name: '光影氛围', rect: [474, 436, 218, 163] },
    { name: '环境参考', rect: [808, 436, 218, 163] },
    { name: '实拍参考', rect: [104, 642, 290, 163] },
  ];
  const outputCrop = [1498, 436, 290, 164];
  let wireId = 0;
  function crop(el, r) {
    el.style.backgroundSize = `${(2048 / r[2]) * 100}% ${(929 / r[3]) * 100}%`;
    el.style.backgroundPosition = `${(r[0] / (2048 - r[2])) * 100}% ${(r[1] / (929 - r[3])) * 100}%`;
  }
  function size(el, w, h) {
    el.style.width = w + 'px';
    el.style.height = h + 'px';
  }
  function place(el, x, y, extra = '') {
    el.style.transform = `translate3d(${x.toFixed(3)}px,${y.toFixed(3)}px,0) ${extra}`;
  }
  function pose(g, r) {
    const o = g.output;
    if (r < 0) {
      const shift = (-r / (1 - FOCUS)) * g.travel;
      return { shift, zoom: 0, x: o.x + shift, y: o.y, w: o.w, h: o.h };
    }
    if (r <= FULL_END) {
      const z = smooth(r / FULL_START);
      return {
        shift: -z * g.W * 1.14,
        zoom: z,
        x: mix(o.x, 0, z),
        y: mix(o.y, 0, z),
        w: mix(o.w, g.W, z),
        h: mix(o.h, g.H, z),
      };
    }
    const q = clamp((r - FULL_END) / (1 - FULL_END)),
      z = 1 - smooth(q);
    return {
      shift: -g.W * 1.14 - q * g.travel,
      zoom: z,
      x: mix(0, -o.w - g.gap, smooth(q)),
      y: mix(0, o.y, smooth(q)),
      w: mix(o.w, g.W, z),
      h: mix(o.h, g.H, z),
    };
  }
  function filmPose(position) {
    const base = Math.floor(position),
      local = position - base,
      exit = smooth((local - FULL_END) / (1 - FULL_END));
    return {
      zoom: local <= FULL_END ? smooth(local / FULL_START) : 1 - exit,
      center: base + (local <= FULL_END ? 0.18 * smooth(local / FULL_START) : 0.18 + 0.82 * exit),
    };
  }
  function cardPose(position, index) {
    const film = filmPose(position),
      distance = index - film.center,
      proximity = Math.max(0, 1 - Math.abs(distance)),
      r = position - index,
      clarity =
        r < 0 || r >= 1
          ? 0
          : r <= FULL_END
            ? smooth(r / FULL_START)
            : 1 - smooth((r - FULL_END) / (1 - FULL_END));
    return { distance, clarity, scale: 0.78 + proximity * 0.1 + clarity * 0.3 };
  }
  function loadingState(state, r, ready, now, reduced = false) {
    const progress =
      r <= FULL_END ? smooth(r / FULL_START) : 1 - smooth((r - FULL_END) / (1 - FULL_END));
    // Reset only beyond the visible transition, so departure never replays the loader.
    if (r <= 0.02 || r >= 0.98)
      return { progress, revealed: false, completeAt: null, pending: false };
    if (state.revealed) return { ...state, progress, pending: false };
    const centered = r >= FULL_START && r <= FULL_END,
      completeAt = centered ? (state.completeAt ?? now) : null,
      revealed = centered && ready && (reduced || now - completeAt >= 140);
    return {
      progress,
      completeAt,
      revealed,
      pending: centered && ready && !revealed,
    };
  }
  class AIVideoNodes {
    constructor(host, { standalone = false } = {}) {
      Object.assign(this, {
        host,
        standalone,
        position: 0,
        target: 0,
        wheelPending: 0,
        velocity: 0,
        active: false,
        snap: null,
        raf: 0,
        lastTime: 0,
        pointer: null,
        drag: null,
        userPaused: false,
        playing: null,
        focusKey: null,
        muted: true,
        blurEnabled: true,
      });
      this.abort = new AbortController();
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.sources = new Map();
      this.works = Array.from({ length: 3 }, () => ({ type: 'ai' }));
      this.groups = [];
      this.cards = [];
      host.innerHTML = `<section class="avn is-inactive" tabindex="0" role="region" aria-label="视频节点画布：横向滚动或左右方向键浏览"><div class="avn-world"></div><div class="avn-edge avn-edge-top" aria-hidden="true"></div><div class="avn-edge avn-edge-bottom" aria-hidden="true"></div><header class="avn-top"><div class="avn-type" aria-label="当前视频类型"><i aria-hidden="true"></i><span>AI 视频</span></div><div class="avn-menu-dock"><div class="avn-menu" id="avn-menu-${standalone ? 'study' : 'embedded'}" hidden><a href="../../dist/">返回作品集 ↗</a><label>载入当前视频<input type="file" accept="video/*" aria-label="载入当前视频"></label><label class="avn-type-field">视频类型<select aria-label="当前视频类型"><option value="ai">AI 视频</option><option value="live">实拍视频</option></select></label><button data-action="play">播放 / 暂停</button><button data-action="sound">开启声音</button><button data-action="blur" aria-pressed="true">轻微动态模糊：开</button><button data-action="info">素材说明</button></div><button class="avn-menu-trigger" aria-expanded="false" aria-controls="avn-menu-${standalone ? 'study' : 'embedded'}">MENU <i aria-hidden="true"></i></button></div></header><nav class="avn-filmstrip" aria-label="视频作品"><div class="avn-cards"></div></nav><div class="avn-message" role="status"></div><div class="avn-info" hidden><p>当前展示用户提供的节点截图。作品 02、03 是浏览位置占位，尚未接入其他作品。</p><p>通过 MENU 可载入当前作品的本地视频，仅用于本次预览，不上传。居中后自动静音播放；左上角标注当前作品的视频类型。</p><button data-action="close-info">关闭</button></div></section>`;
      this.root = host.querySelector('.avn');
      this.world = this.root.querySelector('.avn-world');
      this.strip = this.root.querySelector('.avn-cards');
      this.menu = this.root.querySelector('.avn-menu');
      this.menuTrigger = this.root.querySelector('.avn-menu-trigger');
      this.typeLabel = this.root.querySelector('.avn-type span');
      this.typeSelect = this.root.querySelector('select');
      for (let i = 0; i < 3; i++) this.groups.push(this.makeGroup());
      const on = (el, t, fn, o = {}) =>
        el.addEventListener(t, fn, { ...o, signal: this.abort.signal });
      on(this.root, 'wheel', (e) => this.wheel(e), { passive: false });
      on(this.root, 'keydown', (e) => {
        if (e.key === 'Escape') {
          this.setMenu(false);
          this.root.querySelector('.avn-info').hidden = true;
          return;
        }
        if (e.target !== this.root && e.target.closest('button,a,input,select')) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          this.input(e.key === 'ArrowRight' ? 0.065 : -0.065);
        }
      });
      on(this.root, 'pointerdown', (e) => this.pointerDown(e));
      on(this.root, 'pointermove', (e) => this.pointerMove(e));
      on(this.root, 'pointerup', (e) => this.pointerEnd(e));
      on(this.root, 'pointercancel', (e) => this.pointerEnd(e));
      on(this.root, 'pointerleave', () => {
        this.pointer = null;
        this.request();
      });
      on(this.menuTrigger, 'click', (e) => {
        e.stopPropagation();
        this.setMenu(this.menu.hidden);
      });
      on(this.root, 'click', (e) => {
        if (!e.target.closest('.avn-menu-dock')) this.setMenu(false);
      });
      on(this.typeSelect, 'change', (e) => this.setType(e.target.value));
      on(this.root.querySelector('input'), 'change', (e) => this.loadFile(e.target.files[0]));
      on(this.root.querySelector('[data-action=play]'), 'click', () => this.togglePlay());
      on(this.root.querySelector('[data-action=sound]'), 'click', () => this.toggleSound());
      on(this.root.querySelector('[data-action=blur]'), 'click', (e) => {
        this.blurEnabled = !this.blurEnabled;
        e.currentTarget.textContent = '轻微动态模糊：' + (this.blurEnabled ? '开' : '关');
        e.currentTarget.setAttribute('aria-pressed', String(this.blurEnabled));
        this.request();
      });
      on(this.root.querySelector('[data-action=info]'), 'click', () => {
        this.root.querySelector('.avn-info').hidden = false;
        this.setMenu(false);
      });
      on(
        this.root.querySelector('[data-action=close-info]'),
        'click',
        () => (this.root.querySelector('.avn-info').hidden = true),
      );
      on(document, 'visibilitychange', () => {
        this.root.classList.toggle('is-background', document.hidden);
        if (document.hidden) {
          this.cancelMotion();
          this.pauseAll();
        } else this.request();
      });
      on(this.reduced, 'change', () => {
        this.cancelMotion();
        this.root.classList.toggle('avn-reduced', this.reduced.matches);
        this.request();
      });
      this.root.classList.toggle('avn-reduced', this.reduced.matches);
      this.resize = new ResizeObserver(() => this.layout());
      this.resize.observe(host);
      this.layout();
    }
    static pose(g, r) {
      return pose(g, r);
    }
    static cardPose(position, index) {
      return cardPose(position, index);
    }
    static loadingState(state, r, ready, now, reduced) {
      return loadingState(state, r, ready, now, reduced);
    }
    makeCard() {
      const el = document.createElement('button');
      el.className = 'avn-card';
      el.innerHTML = '<span class="avn-card-image"></span><span class="avn-card-title"></span>';
      crop(el.firstElementChild, outputCrop);
      this.strip.append(el);
      const card = { el, index: null };
      this.cards.push(card);
      el.addEventListener('click', () => this.goTo(card.index + FOCUS), {
        signal: this.abort.signal,
      });
    }
    makeGroup() {
      const el = document.createElement('div');
      el.className = 'avn-group';
      el.innerHTML =
        '<svg class="avn-wires" aria-hidden="true"></svg><div class="avn-references"></div>';
      const svg = el.firstElementChild,
        refsHost = el.lastElementChild,
        ns = 'http://www.w3.org/2000/svg',
        defs = document.createElementNS(ns, 'defs');
      svg.append(defs);
      const refs = crops.map((c, i) => {
        const n = document.createElement('div');
        n.className = 'avn-reference';
        n.innerHTML = `<div class="avn-ref-surface"><div class="avn-crop" role="img" aria-label="${c.name}，截图局部"></div></div><span class="avn-ref-label"><b>0${i + 1}</b>${c.name}</span>`;
        crop(n.querySelector('.avn-crop'), c.rect);
        refsHost.append(n);
        const id = ++wireId,
          gradient = document.createElementNS(ns, 'linearGradient'),
          path = document.createElementNS(ns, 'path'),
          glow = document.createElementNS(ns, 'path'),
          light = document.createElementNS(ns, 'path');
        gradient.id = `avn-wire-gradient-${id}`;
        gradient.setAttribute('gradientUnits', 'userSpaceOnUse');
        gradient.innerHTML =
          '<stop offset="0" stop-color="#9fb6aa" stop-opacity=".3"/><stop offset=".38" stop-color="#cedfd1" stop-opacity=".8"/><stop offset=".58" stop-color="#eef4e8"/><stop offset="1" stop-color="#a9c2b6" stop-opacity=".35"/>';
        defs.append(gradient);
        for (const segment of [path, glow, light]) {
          segment.setAttribute('pathLength', '1000');
        }
        path.classList.add('avn-wire-base');
        for (const segment of [glow, light]) {
          segment.style.stroke = `url(#${gradient.id})`;
          segment.style.animationDelay = -i * 0.43 + 's';
        }
        glow.classList.add('avn-wire-glow');
        light.classList.add('avn-wire-light');
        svg.append(path, glow, light);
        return {
          el: n,
          surface: n.firstElementChild,
          image: n.querySelector('.avn-crop'),
          path,
          glow,
          light,
          gradient,
          hover: 0,
          c,
        };
      });
      const output = document.createElement('div');
      output.className = 'avn-output';
      output.innerHTML =
        '<div class="avn-output-media"><div class="avn-poster"><div class="avn-poster-image" role="img" aria-label="视频参考封面"></div></div><video muted playsinline loop preload="auto" aria-hidden="true"></video></div><div class="avn-loader"><div class="avn-loader-grid" aria-hidden="true"></div><div class="avn-loader-scan" aria-hidden="true"></div><div class="avn-loader-hud"><span class="avn-loader-kicker">VIDEO / <b>01</b></span><div class="avn-loader-number" aria-hidden="true"><span>0</span><small>%</small></div><span class="avn-loader-caption">画面载入</span><div class="avn-loader-meter" role="progressbar" aria-label="画面进入进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div></div></div>';
      crop(output.querySelector('.avn-poster-image'), outputCrop);
      el.append(output);
      this.world.append(el);
      const video = output.querySelector('video');
      const group = {
        el,
        svg,
        refsHost,
        refs,
        output,
        media: output.firstElementChild,
        poster: output.querySelector('.avn-poster-image'),
        video,
        loader: output.querySelector('.avn-loader'),
        hud: output.querySelector('.avn-loader-hud'),
        percent: output.querySelector('.avn-loader-number span'),
        meter: output.querySelector('.avn-loader-meter'),
        loading: { revealed: false, completeAt: null },
        failed: false,
        index: null,
        source: null,
      };
      video.muted = true;
      video.addEventListener(
        'error',
        () => {
          if (video.hasAttribute('src')) {
            group.failed = true;
            output.classList.remove('has-video');
            this.message('这个视频无法播放，请换用 MP4 或 WebM。');
            this.request();
          }
        },
        { signal: this.abort.signal },
      );
      video.addEventListener(
        'playing',
        () => {
          if (this.playing !== video || !this.active || document.hidden) video.pause();
        },
        { signal: this.abort.signal },
      );
      video.addEventListener('loadeddata', () => this.request(), { signal: this.abort.signal });
      video.addEventListener('loadedmetadata', () => this.layout(), { signal: this.abort.signal });
      return group;
    }
    layout() {
      const W = this.root.clientWidth,
        H = this.root.clientHeight;
      if (!W || !H) return;
      const mobile = W < 700,
        cols = 4,
        rows = 2,
        margin = W * 0.04,
        gap = mobile ? 12 : clamp(W * 0.035, 30, 60),
        top = mobile ? 72 : 76,
        bottom = mobile ? 140 : 172;
      const gapY = mobile ? 64 : clamp(H * 0.105, 60, 110),
        cw = Math.min(
          (W - margin * 2 - gap * (cols - 1)) / cols,
          mobile ? 100 : clamp(W * 0.15, 140, 236),
        ),
        available = Math.max(160, H - top - bottom),
        ch = Math.min(cw * 0.72, Math.max(45, (available - gapY) / rows)),
        contentHeight = rows * ch + gapY,
        y0 = top + Math.max(0, (available - contentHeight) / 2);
      const jitter = [
          [-11, -7],
          [8, 5],
          [-5, -10],
          [12, 3],
          [-9, 8],
          [10, -5],
          [-2, 11],
        ],
        refScale = mobile ? 0.92 : 0.94,
        jitterScale = mobile ? 0.55 : clamp(W / 1280, 0.85, 1.2);
      const cells = Array.from({ length: 7 }, (_, i) => {
        const row = Math.floor(i / cols),
          inRow = Math.min(cols, 7 - row * cols),
          w = cw * refScale,
          h = ch * refScale,
          rowWidth = inRow * cw + (inRow - 1) * gap;
        return {
          x:
            (W - rowWidth) / 2 +
            (i % cols) * (cw + gap) +
            (cw - w) / 2 +
            jitter[i][0] * jitterScale,
          y: y0 + row * (ch + gapY) + (ch - h) / 2 + jitter[i][1] * jitterScale,
          w,
          h,
        };
      });
      const outputW = clamp(W * 0.48, mobile ? 220 : 360, 760),
        outputH = (outputW * outputCrop[3]) / outputCrop[2],
        output = { x: W + gap, y: (H - outputH) / 2, w: outputW, h: outputH };
      this.geo = {
        W,
        H,
        mobile,
        gap,
        cols,
        refRects: cells,
        output,
        travel: W + gap * 8,
        cardW: mobile ? 100 : 142,
        pitch: mobile ? 125 : 184,
      };
      for (const group of this.groups) {
        size(group.output, W, H);
        group.mediaH =
          W /
          (group.video.videoWidth && group.video.videoHeight
            ? group.video.videoWidth / group.video.videoHeight
            : outputCrop[2] / outputCrop[3]);
        size(group.media, W, group.mediaH);
        group.media.style.top = (H - group.mediaH) / 2 + 'px';
        size(group.svg, W, H);
        group.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        group.refs.forEach((n, i) => {
          const r = cells[i];
          size(n.el, r.w, r.h);
          place(n.el, r.x, r.y);
          const aspect = n.c.rect[2] / n.c.rect[3],
            iw = Math.max(r.w, r.h * aspect),
            ih = iw / aspect;
          size(n.image, iw, ih);
          n.imageX = (r.w - iw) / 2;
          n.imageY = (r.h - ih) / 2;
        });
        const pw = Math.max(W, (group.mediaH * outputCrop[2]) / outputCrop[3]),
          ph = (pw * outputCrop[3]) / outputCrop[2];
        size(group.poster, pw, ph);
        place(group.poster, (W - pw) / 2, (group.mediaH - ph) / 2);
      }
      const count = Math.max(7, Math.ceil(W / this.geo.pitch) + 5) | 1;
      while (this.cards.length < count) this.makeCard();
      for (const c of this.cards) size(c.el, this.geo.cardW, this.geo.cardW * 0.5625 + 27);
      this.render(1 / 60);
      this.request();
    }
    key(index) {
      return mod(index, this.works.length);
    }
    title(index) {
      const key = this.key(index),
        type = this.works[key].type === 'live' ? '实拍' : 'AI';
      return `${type} 作品 0${key + 1}${key !== 0 && !this.sources.has(key) ? ' · 待接入' : ''}`;
    }
    syncGroup(group, index) {
      if (group.index !== index) {
        group.video.pause();
        group.index = index;
        group.loading = { revealed: false, completeAt: null };
        group.el.dataset.cycle = index;
        try {
          group.video.currentTime = 0;
        } catch {}
      }
      const src = this.sources.get(this.key(index)) || null;
      if (src !== group.source) {
        group.video.pause();
        group.source = src;
        group.failed = false;
        group.loading = { revealed: false, completeAt: null };
        group.output.classList.remove('is-revealed');
        if (src) {
          group.video.src = src;
          group.video.setAttribute('aria-hidden', 'false');
        } else {
          group.video.removeAttribute('src');
          group.video.setAttribute('aria-hidden', 'true');
        }
        group.video.load();
        group.output.classList.toggle('has-video', !!src);
      }
    }
    render(dt = 1 / 60) {
      const g = this.geo;
      if (!g) return false;
      const base = Math.floor(this.position),
        now = performance.now();
      let focused = null,
        needsFrame = false;
      const currentType = this.works[this.key(base)].type;
      this.typeLabel.textContent = currentType === 'live' ? '实拍视频' : 'AI 视频';
      this.typeSelect.value = currentType;
      const speed = Math.min(1, Math.abs(this.velocity) / 0.9),
        direction = clamp(this.velocity * 3, -1, 1),
        blur = this.blurEnabled && !this.reduced.matches ? Math.min(0.75, speed * 0.75) : 0;
      this.world.style.filter = blur > 0.04 ? `blur(${blur.toFixed(2)}px)` : 'none';
      for (const index of [base - 1, base, base + 1]) {
        const group = this.groups[mod(index, 3)],
          r = this.position - index;
        this.syncGroup(group, index);
        if (r < -(1 - FOCUS) || r >= 1) {
          group.el.hidden = true;
          group.loading = { revealed: false, completeAt: null };
          group.output.classList.remove('is-revealed');
          continue;
        }
        group.el.hidden = false;
        const m = pose(g, r),
          sx = m.w / g.W,
          sy = m.h / g.H,
          uniform = Math.max(sx, m.h / group.mediaH);
        place(group.output, m.x, m.y, `scale(${sx.toFixed(6)},${sy.toFixed(6)})`);
        group.output.style.borderRadius = 4 / Math.max(0.05, sx) + 'px';
        group.output.style.opacity = String(
          Math.min(smooth((r - 0.02) / 0.34), 1 - smooth((r - 0.65) / 0.3)),
        );
        group.loading = loadingState(
          group.loading,
          r,
          !group.source || group.failed || group.video.readyState >= 2,
          now,
          this.reduced.matches,
        );
        if (group.loading.pending) needsFrame = true;
        const percent =
          group.loading.progress === 1
            ? 100
            : Math.min(99, Math.round(group.loading.progress * 100));
        group.percent.textContent = percent;
        group.meter.setAttribute('aria-valuenow', String(percent));
        group.meter.firstElementChild.style.transform = `scaleX(${group.loading.progress})`;
        group.hud.style.width = clamp(m.w * 0.34, 150, 290) + 'px';
        group.hud.style.fontSize = clamp(m.w * 0.045, 28, 64) + 'px';
        group.hud.style.transform = `translate(-50%,-50%) scale(${1 / sx},${1 / sy})`;
        group.hud.querySelector('.avn-loader-kicker b').textContent = '0' + (this.key(index) + 1);
        group.loader.setAttribute('aria-hidden', String(group.loading.revealed));
        group.output.classList.toggle('is-revealed', group.loading.revealed);
        group.output.dataset.progress = percent;
        const videoDrift =
            r <= FULL_END ? smooth(r / FULL_START) : 1 - smooth((r - FULL_END) / (1 - FULL_END)),
          videoX = Math.min(52, g.W * 0.07),
          videoY = Math.min(28, group.mediaH * 0.07);
        group.media.style.transformOrigin = g.mobile && !group.source ? '30% center' : 'center';
        group.media.style.transform = `translate3d(${((videoDrift * 2 - 1) * videoX).toFixed(2)}px,${((videoDrift * 2 - 1) * videoY).toFixed(2)}px,0) scale(${((uniform / sx) * 1.2).toFixed(6)},${((uniform / sy) * 1.2).toFixed(6)})`;
        group.el.style.zIndex = r >= 0 && r < 0.96 ? '3' : '2';
        place(group.refsHost, m.shift, 0);
        group.refs.forEach((n, i) => {
          const rr = g.refRects[i],
            col = i % g.cols,
            row = Math.floor(i / g.cols),
            avoid = smooth((m.zoom - (g.cols - 1 - col) * 0.1) / 0.7),
            stagger = avoid * (col + 1) * Math.min(12, g.W * 0.012),
            rise = (row - (Math.ceil(7 / g.cols) - 1) / 2) * avoid * 12;
          place(n.el, rr.x - stagger, rr.y + rise);
          const refDrift = smooth(r / FULL_START),
            driftX = (0.5 - refDrift) * Math.min(42, rr.w * 0.13) * (i % 3 === 0 ? 1.15 : 0.9),
            driftY = (0.5 - refDrift) * Math.min(24, rr.h * 0.14) * (i % 2 === 0 ? 1 : -1);
          n.image.style.transform = `translate3d(${(n.imageX + driftX).toFixed(2)}px,${(n.imageY + driftY).toFixed(2)}px,0) scale(1.20)`;
          const x = rr.x + m.shift - stagger,
            y = rr.y + rise;
          let desired = 0,
            px = 0,
            py = 0;
          if (this.pointer && !this.drag && !this.reduced.matches) {
            const dx = Math.max(x - this.pointer.x, 0, this.pointer.x - x - rr.w),
              dy = Math.max(y - this.pointer.y, 0, this.pointer.y - y - rr.h);
            desired = Math.pow(clamp(1 - Math.hypot(dx, dy) / Math.max(90, rr.w * 0.52)), 2);
            px = clamp((this.pointer.x - x - rr.w / 2) / rr.w, -1, 1);
            py = clamp((this.pointer.y - y - rr.h / 2) / rr.h, -1, 1);
          }
          n.hover = mix(n.hover, desired, 1 - Math.exp(-dt / 0.115));
          if (Math.abs(n.hover - desired) > 0.001) needsFrame = true;
          const scale = 1 + n.hover * 0.045,
            tilt = (direction * 2 + px * 0.8) * n.hover,
            tx = (px * 5 + direction * 3) * n.hover,
            ty = py * 4 * n.hover;
          n.surface.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
          n.el.style.zIndex = n.hover > 0.2 ? '3' : '1';
          const ax = x + rr.w + tx + ((scale - 1) * rr.w) / 2,
            ay = y + rr.h / 2 + ty,
            bx = m.x,
            by = m.y + m.h / 2,
            bend = Math.max(30, Math.abs(bx - ax) * 0.46),
            path = `M${ax.toFixed(2)} ${ay.toFixed(2)} C${(ax + bend).toFixed(2)} ${ay.toFixed(2)} ${(bx - bend).toFixed(2)} ${by.toFixed(2)} ${bx.toFixed(2)} ${by.toFixed(2)}`;
          for (const segment of [n.path, n.glow, n.light]) segment.setAttribute('d', path);
          n.gradient.setAttribute('x1', String(ax));
          n.gradient.setAttribute('y1', String(ay));
          n.gradient.setAttribute('x2', String(bx));
          n.gradient.setAttribute('y2', String(by));
        });
        group.svg.style.opacity = String(1 - m.zoom * 0.3);
        if (r >= FULL_START && r <= FULL_END) focused = group;
      }
      const { zoom: filmZoom, center } = filmPose(this.position),
        nearest = Math.round(center);
      for (let i = 0; i < this.cards.length; i++) {
        const index = nearest + i - Math.floor(this.cards.length / 2),
          c = this.cards[mod(index, this.cards.length)],
          { distance, clarity, scale: sc } = cardPose(this.position, index);
        const x = g.W / 2 + distance * g.pitch - g.cardW / 2;
        c.index = index;
        c.el.dataset.cycle = index;
        c.el.setAttribute('aria-label', `观看${this.title(index)}`);
        c.el.setAttribute('aria-current', String(index === nearest));
        c.el.lastElementChild.textContent = this.title(index);
        c.el.firstElementChild.classList.toggle(
          'is-placeholder',
          this.key(index) !== 0 && !this.sources.has(this.key(index)),
        );
        const saturation = mix(mix(0.48, 0.14, filmZoom), 1, clarity),
          softness = mix(0.35, 2.2, filmZoom) * (1 - clarity),
          brightness = mix(mix(0.72, 0.52, filmZoom), 1, clarity);
        c.el.firstElementChild.style.filter = `saturate(${saturation.toFixed(3)}) blur(${softness.toFixed(2)}px) brightness(${brightness.toFixed(3)})`;
        place(c.el, x, 24 - (sc - 0.78) * 25, `scale(${sc.toFixed(4)})`);
        c.el.style.opacity = String(clamp(1 - Math.abs(distance) * 0.17, 0.16, 1));
        c.el.inert = Math.abs(distance) * g.pitch > g.W / 2 + g.cardW;
      }
      const focusKey = focused ? this.key(focused.index) + ':' + focused.index : null;
      if (focusKey !== this.focusKey) {
        this.userPaused = false;
        this.focusKey = focusKey;
      }
      const next =
        focused &&
        focused.source &&
        !focused.failed &&
        focused.loading.revealed &&
        this.active &&
        !document.hidden
          ? focused.video
          : null;
      if (next !== this.playing) {
        this.pauseAll();
        this.playing = next;
        if (next && !this.userPaused) this.play(next);
      }
      this.root.dataset.position = this.position.toFixed(6);
      this.root.dataset.target = this.target.toFixed(6);
      this.root.dataset.phase = this.snap
        ? this.snap.kind
        : focused
          ? 'play'
          : this.position - base > FULL_END
            ? 'exit'
            : 'reference';
      this.root.dataset.cycle = base;
      this.root.dataset.velocity = this.velocity.toFixed(5);
      this.root.dataset.type = currentType;
      this.root.dataset.blur = blur.toFixed(3);
      return needsFrame;
    }
    request() {
      if (this.active && !document.hidden && !this.raf)
        this.raf = requestAnimationFrame((t) => this.tick(t));
    }
    tick(now) {
      this.raf = 0;
      if (!this.active || document.hidden) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - (this.lastTime || now - 16.67)) / 1000));
      this.lastTime = now;
      const before = this.position;
      if (this.snap) {
        const a = this.snap,
          u = clamp((now - a.start) / a.duration),
          h00 = 2 * u * u * u - 3 * u * u + 1,
          h10 = u * u * u - 2 * u * u + u,
          h01 = -2 * u * u * u + 3 * u * u;
        this.position = h00 * a.from + h10 * a.tangent + h01 * a.to;
        if (u >= 1) {
          this.position = this.target = a.to;
          this.snap = null;
        }
      } else {
        if (Math.abs(this.wheelPending) > 0.000001) {
          const step = this.wheelPending * (1 - Math.exp(-dt / 0.105));
          this.target += step;
          this.wheelPending -= step;
        }
        const gap = this.target - this.position,
          ease = this.drag ? 0.075 : 0.19;
        this.position =
          this.reduced.matches || Math.abs(gap) < 0.000015
            ? this.target
            : this.position + gap * (1 - Math.exp(-dt / ease));
      }
      const rawVelocity = (this.position - before) / dt;
      this.velocity = mix(this.velocity, rawVelocity, 1 - Math.exp(-dt / 0.045));
      if (Math.abs(this.velocity) < 0.0001) this.velocity = 0;
      if (!this.snap && !this.drag && !this.reduced.matches) this.autoSnap(before);
      const hoverMoving = this.render(dt);
      if (
        this.snap ||
        Math.abs(this.wheelPending) > 0.000001 ||
        Math.abs(this.target - this.position) > 0.000001 ||
        Math.abs(this.velocity) > 0.001 ||
        hoverMoving
      )
        this.request();
      else {
        this.velocity = 0;
        this.world.style.filter = 'none';
        this.root.dataset.blur = '0.000';
        this.lastTime = 0;
      }
    }
    cancelMotion() {
      this.snap = null;
      this.target = this.position;
      this.wheelPending = 0;
      this.velocity = 0;
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastTime = 0;
    }
    autoSnap(before, after = this.position) {
      const dir = Math.sign(after - before);
      if (!dir) return;
      const thresholds =
        dir > 0
          ? [
              { at: 0.31, to: FOCUS, kind: 'enter' },
              { at: 0.72, to: 1, kind: 'exit' },
            ]
          : [
              { at: 0.72, to: FOCUS, kind: 'enter' },
              { at: 0.31, to: 0, kind: 'exit' },
            ];
      const crossed = [];
      for (
        let cycle = Math.floor(Math.min(before, after)) - 1;
        cycle <= Math.floor(Math.max(before, after)) + 1;
        cycle++
      ) {
        for (const point of thresholds) {
          const at = cycle + point.at;
          if (dir > 0 ? before < at && after >= at : before > at && after <= at)
            crossed.push({ at, to: cycle + point.to, kind: point.kind });
        }
      }
      crossed.sort((a, b) => dir * (a.at - b.at));
      const first = crossed[0];
      if (first) this.startSnap(first.to, first.kind, first.kind === 'enter' ? 620 : 680);
    }
    setActive(value) {
      if (this.active === value) return;
      this.active = value;
      this.root.classList.toggle('is-inactive', !value);
      if (value) this.request();
      else {
        this.cancelMotion();
        this.pauseAll();
      }
    }
    input(delta, smoothWheel = false) {
      if (!this.active || !Number.isFinite(delta) || !delta) return;
      const sign = Math.sign(delta);
      if (this.snap) {
        if (sign === Math.sign(this.snap.to - this.position)) return;
        this.snap = null;
        this.target = this.position;
        this.wheelPending = 0;
      }
      if (this.inputDirection && sign !== this.inputDirection) {
        this.target = this.position;
        this.wheelPending = 0;
      }
      this.inputDirection = sign;
      if (smoothWheel && !this.reduced.matches) this.wheelPending += clamp(delta, -0.16, 0.16);
      else this.target += clamp(delta, -0.16, 0.16);
      this.request();
    }
    startSnap(to, kind, duration) {
      const distance = to - this.position,
        dir = Math.sign(distance),
        tangent =
          clamp((this.velocity * dir * duration) / 1000, 0, Math.abs(distance) * 0.65) * dir;
      this.wheelPending = 0;
      this.snap = { from: this.position, to, start: performance.now(), duration, tangent, kind };
      this.target = to;
      this.request();
    }
    goTo(to) {
      if (!this.active) return;
      this.setMenu(false);
      this.pointer = null;
      if (this.reduced.matches) {
        this.cancelMotion();
        this.position = this.target = to;
        this.render();
        return;
      }
      this.startSnap(to, 'card', clamp(850 + Math.abs(to - this.position) * 330, 900, 1800));
    }
    wheel(e) {
      if (!this.active || e.ctrlKey || e.target.closest('.avn-menu,.avn-info,input')) return;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!this.standalone && !horizontal && !e.shiftKey) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.geo.W : 1,
        delta = (horizontal ? e.deltaX : e.deltaY) * unit;
      if (!delta) return;
      e.preventDefault();
      this.input(
        delta / Math.max(1750, this.geo.W * 1.65),
        e.deltaMode !== 0 || Math.abs(delta) >= 32,
      );
    }
    pointerDown(e) {
      if (
        !this.active ||
        e.button !== 0 ||
        e.target.closest('button,a,label,input,select,.avn-menu,.avn-info')
      )
        return;
      this.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        last: e.clientX,
        start: this.position,
        locked: false,
      };
      this.root.focus({ preventScroll: true });
    }
    pointerMove(e) {
      const bounds = this.root.getBoundingClientRect();
      this.pointer =
        e.pointerType === 'touch'
          ? null
          : { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      const d = this.drag;
      if (!d || d.id !== e.pointerId) {
        this.request();
        return;
      }
      const dx = e.clientX - d.x,
        dy = e.clientY - d.y;
      if (!d.locked) {
        if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 7) {
          this.drag = null;
          return;
        }
        if (Math.abs(dx) < 5) return;
        d.locked = true;
        this.root.setPointerCapture(e.pointerId);
        this.root.classList.add('is-dragging');
      }
      const delta = d.last - e.clientX;
      d.last = e.clientX;
      this.input(delta / Math.max(900, this.geo.W * 1.55));
    }
    pointerEnd(e) {
      if (this.drag && this.drag.id === e.pointerId) {
        const start = this.drag.start,
          moved = this.drag.locked;
        if (this.root.hasPointerCapture(e.pointerId)) this.root.releasePointerCapture(e.pointerId);
        this.drag = null;
        this.root.classList.remove('is-dragging');
        if (moved && !this.reduced.matches) this.autoSnap(start, this.target);
        this.request();
      }
    }
    setMenu(open) {
      this.menu.hidden = !open;
      this.menuTrigger.setAttribute('aria-expanded', String(open));
    }
    setType(type) {
      if (type !== 'ai' && type !== 'live') return;
      this.works[this.key(Math.floor(this.position))].type = type;
      this.setMenu(false);
      this.render();
    }
    play(video) {
      video.play()?.catch(() => {
        if (this.playing === video) this.message('自动播放未启动，可从 MENU 点击播放。');
      });
    }
    pauseAll() {
      this.groups.forEach((g) => g.video.pause());
      this.playing = null;
    }
    loadFile(file) {
      if (!file) return;
      if (!file.type.startsWith('video/')) {
        this.message('请选择视频文件。');
        return;
      }
      const index = Math.floor(this.position),
        key = this.key(index),
        old = this.sources.get(key);
      this.pauseAll();
      this.sources.set(key, URL.createObjectURL(file));
      this.userPaused = false;
      if (old) URL.revokeObjectURL(old);
      this.setMenu(false);
      this.layout();
      this.message('已载入当前作品，放大后自动静音播放。');
    }
    togglePlay() {
      if (!this.playing) {
        const index = Math.floor(this.position);
        if (!this.sources.has(this.key(index))) {
          this.message('请先在 MENU 中载入当前视频。');
          return;
        }
        this.goTo(index + FOCUS);
        return;
      }
      if (this.playing.paused) {
        this.userPaused = false;
        this.play(this.playing);
      } else {
        this.playing.pause();
        this.userPaused = true;
      }
      this.setMenu(false);
    }
    toggleSound() {
      this.muted = !this.muted;
      this.groups.forEach((g) => (g.video.muted = this.muted));
      this.root.querySelector('[data-action=sound]').textContent = this.muted ? '开启声音' : '静音';
      this.setMenu(false);
    }
    message(text) {
      const n = this.root.querySelector('.avn-message');
      n.textContent = text;
      clearTimeout(this.messageTimer);
      this.messageTimer = setTimeout(() => (n.textContent = ''), 3000);
    }
    destroy() {
      this.setActive(false);
      this.abort.abort();
      this.resize.disconnect();
      clearTimeout(this.messageTimer);
      this.groups.forEach((g) => {
        g.video.removeAttribute('src');
        g.video.load();
      });
      this.sources.forEach((src) => URL.revokeObjectURL(src));
      this.host.replaceChildren();
    }
  }
  window.AIVideoNodes = AIVideoNodes;
})();
