import {
  reelConfig,
  reelWorks,
  sheet,
  filmCrop,
  cameraCrops,
  referenceFrames,
} from './video-reel.config.js';
import { clamp, smooth, reelLayout, scenePose, sceneInView } from './reel-motion.js';
import { createDeviceLayer } from './device-layer.js';
import { devicePose } from './device-motion.js';
import { createAIGenerationLayer } from './ai-generation.js';
import {
  reelTimeline,
  generationProgress,
  generationState,
  referenceArrival,
} from './ai-generation-motion.js';

function crop(el, rect, W, H) {
  el.style.backgroundImage = `url("${new URL(sheet.src, import.meta.url)}")`;
  if (W && H) {
    // 先覆盖展示区，再居中取原图区域，窄屏裁切也不拉伸人物和设备。
    const scale = Math.max(W / rect[2], H / rect[3]);
    el.style.backgroundSize = `${sheet.width * scale}px ${sheet.height * scale}px`;
    el.style.backgroundPosition = `${-rect[0] * scale + (W - rect[2] * scale) / 2}px ${-rect[1] * scale + (H - rect[3] * scale) / 2}px`;
    return;
  }
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
    this.minimum = standalone ? reelConfig.minimumPosition : 0;
    this.timeline = reelTimeline(reelWorks, reelConfig);
    this.maximum = this.timeline.at(-1).end;
    this.position = this.target = standalone ? reelConfig.initialPosition : 0;
    this.pending = this.velocity = 0;
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
    host.innerHTML = `<section class="video-reel is-inactive" tabindex="0" role="region" aria-label="视频作品，向下滚动或上下方向键浏览"><div class="reel-world"></div><header class="reel-header"><div class="reel-menu" hidden><a class="reel-return">返回作品集 ↗</a><div class="reel-work-links"></div><label class="reel-upload">载入当前视频<input type="file" accept="video/*" aria-label="载入当前视频"></label><button data-action="play">播放 / 暂停</button><button data-action="sound">开启声音</button><button data-action="info">素材说明</button></div><button class="reel-menu-toggle" aria-expanded="false">MENU <i aria-hidden="true"></i></button></header><footer class="reel-footer"><span class="reel-count">01 / 02</span><span class="reel-scroll">SCROLL TO EXPLORE <i aria-hidden="true"></i></span></footer><div class="reel-message" role="status"></div><div class="reel-info" hidden><p>影片暂用你提供的设计图预览；MENU 可载入当前作品的本地视频，仅用于本次浏览，不上传。</p><p>相机和 Pocket 在实拍视频的固定区间各向上进入、退出一次，完整动画随滚动播放一次；反向滚动可以倒放，停止后保持当前姿态。Pocket 使用 Blender 原场景的面光。三维加载失败时显示静态参考。</p><button data-action="close-info">关闭</button></div></section>`;
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
        this.goTo(e.key === 'Home' ? 0 : this.works.length - 1, e.key === 'End');
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
      '<div class="reel-side-elements"></div><div class="reel-frame"><div class="reel-poster" role="img"></div><video muted playsinline loop preload="auto"></video></div><div class="reel-title"><span></span><h1></h1></div><div class="reel-parameters"></div>';
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
    const side = el.querySelector('.reel-side-elements');
    const scene = {
      el,
      frame,
      poster,
      video,
      title: el.querySelector('.reel-title'),
      params,
      side,
      cameras: [],
      work,
      index,
      source: null,
      failed: false,
      devices: null,
      generation: null,
      posterAsset: { ...sheet, crop: filmCrop },
      posterVersion: 0,
      posterURL: null,
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
      const deviceHost = document.createElement('div');
      deviceHost.className = 'reel-device-layer';
      deviceHost.setAttribute('role', 'img');
      deviceHost.setAttribute('aria-label', '相机和 Pocket 云台相机，随滚动展示三维动画');
      // Persistent background: never inherit a film's opacity or hidden state.
      this.world.prepend(deviceHost);
      scene.deviceHost = deviceHost;
      scene.cameras.forEach((camera) => deviceHost.append(camera));
      scene.devices = createDeviceLayer(deviceHost, {
        assetUrl: new URL('./assets/capture-devices.glb', import.meta.url).href,
        config: reelConfig.deviceLayer,
        onState: (state) => {
          scene.el.classList.toggle('is-device-ready', state === 'ready');
          scene.el.dataset.deviceState = state;
          scene.cameras.forEach((camera) =>
            camera.setAttribute('aria-hidden', String(state === 'ready')),
          );
          deviceHost.classList.toggle('is-device-ready', state === 'ready');
        },
        onInvalidate: () => this.request(),
      });
    } else {
      const generationHost = document.createElement('div');
      generationHost.className = 'reel-generation-layer';
      generationHost.setAttribute('role', 'img');
      generationHost.setAttribute('aria-label', '参考画面汇聚、字符重构与去噪成像，随滚动可逆展示');
      el.prepend(generationHost);
      scene.generationHost = generationHost;
      scene.generation = createAIGenerationLayer(generationHost, {
        config: reelConfig.aiGeneration,
        assets: this.generationAssets(scene),
        onInvalidate: () => this.request(),
        onState: (state) => {
          scene.el.dataset.generationState = state;
        },
      });
      if (work.poster) this.setPoster(scene, { src: new URL(work.poster, import.meta.url).href });
    }
    const on = (type, fn) => video.addEventListener(type, fn, { signal: this.abort.signal });
    on('loadeddata', () => {
      scene.failed = false;
      if (work.type === 'ai' && (!work.poster || scene.localSource)) this.capturePoster(scene);
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
    }
    this.world.append(el);
    return scene;
  }
  generationAssets(scene) {
    return {
      poster: scene.posterAsset,
      fallback: { ...sheet, crop: filmCrop },
      references: scene.work.references || referenceFrames,
      sequence: !scene.localSource && !scene.posterURL ? scene.work.generationSequence : null,
    };
  }
  layoutPoster(scene, W, H) {
    const asset = scene.posterAsset;
    if (asset.crop) {
      crop(scene.poster, asset.crop, W, H);
    } else {
      scene.poster.style.backgroundImage = `url("${asset.src}")`;
      scene.poster.style.backgroundSize = 'cover';
      scene.poster.style.backgroundPosition = 'center';
    }
  }
  setPoster(scene, asset, owned = false) {
    const previous = scene.posterURL;
    scene.posterURL = owned ? asset.src : null;
    scene.posterAsset = asset;
    scene.generation?.setAssets(this.generationAssets(scene));
    this.layoutPoster(scene, scene.geo?.frame.w, scene.geo?.frame.h);
    if (previous && previous !== asset.src) URL.revokeObjectURL(previous);
    if (!asset.crop) {
      const check = new Image();
      check.onerror = () => {
        if (!this.abort.signal.aborted && scene.posterAsset === asset)
          this.setPoster(scene, { ...sheet, crop: filmCrop });
      };
      check.src = asset.src;
    }
    this.request();
  }
  capturePoster(scene) {
    if (!scene.source || scene.capturedSource === scene.source || !scene.video.videoWidth) return;
    const version = scene.posterVersion,
      source = scene.source;
    const preview = document.createElement('canvas');
    preview.width = scene.video.videoWidth;
    preview.height = scene.video.videoHeight;
    try {
      preview.getContext('2d').drawImage(scene.video, 0, 0);
      preview.toBlob((blob) => {
        if (
          !blob ||
          this.abort.signal.aborted ||
          version !== scene.posterVersion ||
          source !== scene.source
        )
          return;
        scene.capturedSource = source;
        this.setPoster(
          scene,
          { src: URL.createObjectURL(blob), width: preview.width, height: preview.height },
          true,
        );
      }, 'image/png');
    } catch {
      // Cross-origin videos may forbid canvas access; keep the configured cover.
    }
  }
  layout() {
    const W = this.root.clientWidth,
      H = this.root.clientHeight;
    if (!W || !H) return;
    const layouts = this.scenes.map((scene) => {
      const aspect = scene.video.videoWidth / scene.video.videoHeight || filmCrop[2] / filmCrop[3];
      return reelLayout(W, H, reelConfig, aspect);
    });
    // 所有影片共享同一段空间行程，混合横片与竖片也不会在交接时互相穿过。
    const travel =
      Math.max(...layouts.map((g) => g.frame.h)) +
      Math.max(H * reelConfig.sceneGap, reelConfig.minimumSceneGap);
    this.root.classList.toggle('is-mobile', layouts[0].mobile);
    this.scenes.forEach((scene, index) => {
      const g = (scene.geo = layouts[index]);
      g.travel = travel;
      const f = g.frame;
      box(scene.frame, f);
      this.layoutPoster(scene, f.w, f.h);
      scene.title.style.left = Math.max(18, f.x - W * (g.mobile ? 0.025 : 0.042)) + 'px';
      scene.title.style.top = Math.max(12, f.y - (g.mobile ? 64 : Math.max(64, H * 0.073))) + 'px';
      scene.params.style.right = Math.max(18, f.x - g.W * 0.052) + 'px';
      scene.params.style.top = f.y + f.h + (g.mobile ? 16 : 20) + 'px';
      scene.params.style.transformOrigin = 'right top';
      scene.el.style.setProperty('--title-size', clamp(W * 0.026, 27, 56) + 'px');
      scene.el.style.setProperty('--parameter-size', clamp(W * 0.014, 12, 28) + 'px');
      scene.captionBounds = {
        title: {
          top: parseFloat(scene.title.style.top),
          height: scene.title.offsetHeight || clamp(W * 0.026, 27, 56) * 1.3 + 32,
        },
        parameters: {
          top: parseFloat(scene.params.style.top),
          height:
            scene.params.offsetHeight ||
            clamp(W * 0.014, 12, 28) * 1.4 * scene.work.parameters.length,
        },
      };
      scene.cameras.forEach((camera, i) => {
        const w = f.h * (g.mobile ? 0.31 : 0.48),
          h = (w * cameraCrops[i][3]) / cameraCrops[i][2];
        box(camera, {
          x: i === 0 ? -W * 0.018 : W - w * 0.83,
          y: g.mobile ? (i === 0 ? f.y + f.h + 38 : f.y - h * 0.8) : H * (i === 0 ? 0.67 : 0.18),
          w,
          h,
        });
        crop(camera, cameraCrops[i], w, h);
      });
    });
    this.render();
    this.request();
  }
  render() {
    if (!this.scenes[0]?.geo) return;
    const nearest = this.currentIndex();
    let focused = null;
    for (const scene of this.scenes) {
      const g = scene.geo,
        f = g.frame;
      const segment = this.timeline[scene.index];
      const p = scenePose(this.position, segment.entry, g, reelConfig);
      let eligible = Math.abs(p.r) < 0.18;
      scene.el.hidden = !sceneInView(p, g, scene.captionBounds);
      scene.el.inert = scene.index !== nearest;
      scene.devices?.update({
        progress:
          (this.position - scene.index - reelConfig.deviceAnimation.start) /
          (reelConfig.deviceAnimation.end - reelConfig.deviceAnimation.start),
        geo: g,
        opacity: 1,
        visible: this.active && !document.hidden,
        reduced: this.reduced.matches,
      });
      scene.cameras.forEach((camera, i) => {
        const h = parseFloat(camera.style.height) || 1;
        const progress =
          (this.position - scene.index - reelConfig.deviceAnimation.start) /
          (reelConfig.deviceAnimation.end - reelConfig.deviceAnimation.start);
        const name = i === 0 ? 'sony' : 'pocket';
        const pose = devicePose(progress, h / 2, g.H, {
          phase: reelConfig.deviceLayer.entryOffsets[name],
          reduced: this.reduced.matches,
          reducedProgress: reelConfig.deviceLayer.reducedProgress,
        });
        const slot = (
          g.mobile
            ? reelConfig.deviceLayer.mobileComposition
            : reelConfig.deviceLayer.desktopComposition
        )[name];
        if (this.reduced.matches) pose.y = g.H * slot.targetY;
        else pose.y += (slot.verticalBias || 0) * g.H * Math.sin(Math.PI * pose.progress) ** 2;
        camera.style.top = '0px';
        move(camera, 0, pose.y - h / 2);
        camera.style.opacity = this.active && !document.hidden && pose.visible ? '1' : '0';
      });
      if (scene.generation) {
        const progress = generationProgress(this.position, segment);
        const state = generationState(progress, reelConfig.aiGeneration);
        const fallback =
          this.reduced.matches || ['failed', 'lost'].includes(scene.generation.stats.state);
        const exit = Math.max(0, this.position - segment.end);
        const outro = scenePose(exit, 0, g, reelConfig);
        const arrival = referenceArrival(this.position, segment, reelConfig.aiGeneration);
        const arrivalY = (1 - arrival) * g.H * reelConfig.aiGeneration.referenceEntryTravel;
        scene.el.hidden =
          this.position < segment.entry - reelConfig.aiGeneration.referenceEntrySpan || exit > 1.5;
        const visible = !scene.el.hidden && this.active && !document.hidden;
        scene.generation.update({
          progress,
          arrival,
          geometry: g,
          visible,
          reduced: this.reduced.matches,
        });
        scene.generationHost.setAttribute('aria-hidden', String(fallback || state.complete));
        scene.frame.style.opacity = fallback ? outro.opacity : state.resolve * outro.opacity;
        p.y = outro.y + (fallback ? arrivalY : 0);
        p.titleY =
          outro.titleY +
          (fallback ? arrivalY : 0) -
          (1 - state.labelOpacity) * f.h * reelConfig.titleParallax;
        p.metadataY =
          outro.metadataY +
          (fallback ? arrivalY : 0) +
          (1 - state.labelOpacity) * f.h * reelConfig.metadataParallax;
        p.opacity = (fallback ? 1 : state.labelOpacity) * outro.opacity;
        p.r = exit;
        eligible =
          !scene.el.hidden &&
          (fallback ? this.position >= segment.entry : state.complete) &&
          exit < 0.18;
        scene.poster.setAttribute('aria-hidden', String(!fallback && !state.complete));
        scene.el.dataset.generationPhase = fallback ? 'static' : state.phase;
        scene.el.dataset.generationProgress = String(progress);
        if (scene.index === nearest) {
          this.root.dataset.generationPhase = scene.el.dataset.generationPhase;
          this.root.dataset.generationProgress = progress.toFixed(6);
        }
      } else {
        scene.frame.style.opacity = p.opacity;
      }
      if (scene.el.hidden) continue;
      move(scene.frame, 0, p.y);
      move(scene.title, 0, p.titleY);
      scene.title.style.opacity = p.opacity;
      scene.title.setAttribute('aria-hidden', String(p.opacity < 0.01));
      move(scene.params, 0, p.metadataY);
      scene.params.style.opacity = p.opacity;
      scene.params.setAttribute('aria-hidden', String(p.opacity < 0.01));
      scene.frame.style.setProperty(
        '--media-drift',
        clamp(-p.r, -1, 1) * Math.min(26, f.h * 0.055) + 'px',
      );
      const hasVideo =
        !!scene.source &&
        !scene.failed &&
        scene.video.readyState >= 2 &&
        (!scene.generation || eligible);
      scene.frame.classList.toggle('has-video', hasVideo);
      scene.video.setAttribute('aria-hidden', String(!hasVideo));
      if (!scene.generation) scene.poster.setAttribute('aria-hidden', String(hasVideo));
      else if (hasVideo) scene.poster.setAttribute('aria-hidden', 'true');
      if (eligible) focused = scene;
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
      const outgoing = this.scenes.find((scene) => scene.video === this.playing);
      if (
        outgoing?.generation &&
        !generationState(
          generationProgress(this.position, this.timeline[outgoing.index]),
          reelConfig.aiGeneration,
        ).complete &&
        outgoing.video.readyState >= 1
      )
        outgoing.video.currentTime = 0;
      this.pauseAll();
      this.userPaused = false;
      this.playing = next;
      if (next) this.play(next);
    }
    this.count.textContent = `0${nearest + 1} / 0${this.works.length}`;
    this.root.style.setProperty(
      '--frame-left',
      Math.max(24, this.scenes[nearest].geo.frame.x + 4) + 'px',
    );
    const ai = this.scenes[nearest].generation;
    this.scrollHint.firstChild.textContent = ai ? 'SCROLL TO REVEAL ' : 'SCROLL TO EXPLORE ';
    this.scrollHint.style.opacity = ai
      ? String(this.position < this.timeline[nearest].end ? 1 : 0)
      : String(1 - clamp(this.position, 0, 0.6));
    this.root.dataset.position = this.position.toFixed(6);
    this.root.dataset.type = this.works[nearest].type;
    this.root.dataset.target = this.target.toFixed(6);
    this.root.dataset.phase = this.snap ? 'snap' : focused ? 'view' : 'transition';
  }
  currentIndex() {
    let index = 0;
    for (let i = 1; i < this.timeline.length; i++)
      if (this.position >= this.timeline[i].entry - 0.5) index = i;
    return index;
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
      this.target = clamp(this.target + delivered, this.minimum, this.maximum);
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
    if (wheel && !this.reduced.matches) {
      this.pending += clamp(delta, -0.22, 0.22);
    } else {
      this.target = clamp(this.target + delta, this.minimum, this.maximum);
    }
    this.request();
  }
  wheel(e) {
    if (!this.active || e.ctrlKey || e.target.closest('.reel-header,.reel-info')) return;
    const dy =
      (Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX) *
      (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.root.clientHeight : 1);
    if (
      !this.standalone &&
      ((this.position <= this.minimum + 0.001 && dy < 0) ||
        (this.position >= this.maximum - 0.001 && dy > 0))
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
    const nearest = this.currentIndex();
    const segment = this.timeline[nearest];
    // Never snap a partially generated AI frame past its intermediate stages.
    if (
      segment.type === 'live' &&
      Math.abs(this.target - segment.entry) < 0.16 &&
      Math.abs(this.position - segment.entry) > 0.00001
    )
      this.goTo(nearest);
    else this.request();
  }
  goTo(index, completed = false) {
    this.setMenu(false);
    this.root.focus({ preventScroll: true });
    const segment = this.timeline[clamp(index, 0, this.works.length - 1)];
    const to = completed ? segment.end : segment.entry;
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
      this.render();
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
    });
    this.playing = null;
  }
  togglePlay() {
    const scene = this.scenes[this.currentIndex()];
    if (!scene.source) {
      this.message('请先在 MENU 中载入当前视频。');
      return;
    }
    if (
      scene.generation &&
      this.position < this.timeline[scene.index].end &&
      !this.reduced.matches &&
      !['failed', 'lost'].includes(scene.generation.stats.state)
    ) {
      this.message('继续滚动，画面生成完成后播放。');
      this.setMenu(false);
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
    const scene = this.scenes[this.currentIndex()],
      old = this.sources.get(scene.index);
    this.pauseAll();
    const src = URL.createObjectURL(file);
    this.sources.set(scene.index, src);
    scene.source = src;
    scene.failed = false;
    scene.localSource = true;
    scene.generation?.setAssets(this.generationAssets(scene));
    scene.posterVersion++;
    scene.capturedSource = null;
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
      s.devices?.dispose();
      s.generation?.dispose();
      s.posterVersion++;
      if (s.posterURL) URL.revokeObjectURL(s.posterURL);
      s.video.removeAttribute('src');
      s.video.load();
    });
    this.sources.forEach((s) => URL.revokeObjectURL(s));
    this.host.replaceChildren();
  }
}
