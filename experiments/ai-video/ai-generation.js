import { generationState, referencePose, mediaUV } from './ai-generation-motion.js';
import { createCodePixels } from './ai-generation-code.js';
import {
  denoiseFrame,
  normalizeSequence,
  maximumSequenceFrames,
  sequenceInterval,
} from './ai-generation-sequence.js';
import {
  vertexShader,
  referenceShader,
  compositeShader,
  generationShader,
} from './ai-generation-shaders.js';

function glyphAtlas(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 16 * 24;
  canvas.height = 6 * 40;
  const ctx = canvas.getContext('2d');
  ctx.font = '27px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 96; i++)
    ctx.fillText(
      String.fromCharCode(i + 32),
      ((i % 16) + 0.5) * 24,
      (Math.floor(i / 16) + 0.5) * 40,
    );
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.generateMipmaps = true;
  return atlas;
}

function codeAtlas(THREE, seed) {
  const { pixels, columns, rows } = createCodePixels(seed);
  const map = new THREE.DataTexture(pixels, columns, rows);
  map.needsUpdate = true;
  return map;
}

/** Independent, demand-rendered generation canvas; never advances its own clock. */
export function createAIGenerationLayer(
  host,
  { config, assets, onInvalidate = () => {}, onState = () => {} },
) {
  const canvas = document.createElement('canvas');
  canvas.className = 'reel-generation-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const stats = {
    state: 'idle',
    draws: 0,
    progress: 0,
    phase: 'gather',
    error: null,
    memory: null,
  };
  const abort = new AbortController();
  let disposed = false,
    loading = false,
    lost = false,
    assetVersion = 0;
  let runtime = null,
    renderer = null,
    target = null,
    camera = null;
  let references = null,
    composite = null,
    surface = null;
  let geometry = null,
    glyphs = null,
    code = null,
    layer = null;
  let cards = [],
    poster = null,
    sequence = null,
    textures = new Map();
  let latest = { progress: 0, arrival: 1, geometry: null, visible: false, reduced: false };
  let pendingAssets = assets,
    renderKey = null,
    sizeKey = null;

  function state(value, error = null) {
    if (disposed) return;
    stats.state = value;
    stats.error = error;
    host.dataset.generationState = value;
    onState(value);
    onInvalidate();
  }

  async function textureFor(asset) {
    const key = asset.image || asset.src;
    if (!textures.has(key)) {
      const promise = asset.image
        ? Promise.resolve(new runtime.CanvasTexture(asset.image))
        : new runtime.TextureLoader().loadAsync(asset.src);
      textures.set(
        key,
        promise.then((texture) => {
          texture.colorSpace = runtime.SRGBColorSpace;
          texture.anisotropy = Math.min(4, renderer?.capabilities.getMaxAnisotropy() || 1);
          if (disposed) texture.dispose();
          return texture;
        }),
      );
    }
    return textures.get(key);
  }

  function assetSize(asset, texture) {
    return [
      asset.width || texture.image.naturalWidth || texture.image.width,
      asset.height || texture.image.naturalHeight || texture.image.height,
    ];
  }

  async function applyAssets() {
    const version = ++assetVersion;
    const next = pendingAssets;
    try {
      const posterTexture = await textureFor(next.poster);
      let nextSequence = null;
      let sequenceError = null;
      try {
        const definition = normalizeSequence(next.sequence);
        if (definition) {
          const atlas = await textureFor({ src: definition.atlas });
          atlas.generateMipmaps = false;
          atlas.minFilter = runtime.LinearFilter;
          let flow = null;
          if (definition.flowAtlas) {
            try {
              flow = await textureFor({ src: definition.flowAtlas });
              flow.colorSpace = runtime.NoColorSpace;
              flow.premultiplyAlpha = false;
              flow.generateMipmaps = false;
              flow.minFilter = runtime.LinearFilter;
              flow.anisotropy = 1;
            } catch (error) {
              sequenceError = String(error.message || error);
            }
          }
          nextSequence = { definition, atlas, flow };
        }
      } catch (error) {
        // A missing optional sequence keeps the cover-based compatibility renderer.
        sequenceError = String(error.message || error);
      }
      const loaded = await Promise.all(
        (next.references || []).map(async (reference) => {
          let asset =
            reference.src || reference.poster
              ? { src: new URL(reference.src || reference.poster, import.meta.url).href }
              : next.fallback;
          // A missing optional reference uses the shared preview, not a failed whole sequence.
          const texture = await textureFor(asset).catch(() => {
            asset = next.fallback;
            return textureFor(asset);
          });
          return { reference, asset, texture };
        }),
      );
      if (disposed || version !== assetVersion) return;
      let displayPoster = { asset: next.poster, texture: posterTexture, owned: false };
      if (next.poster.crop) {
        // Isolate the cover before generating mipmaps: coarse previews must not
        // include neighboring device images or black margins from the shared atlas.
        const [x, y, width, height] = next.poster.crop;
        const cover = document.createElement('canvas');
        cover.width = width;
        cover.height = height;
        cover
          .getContext('2d')
          .drawImage(posterTexture.image, x, y, width, height, 0, 0, width, height);
        const texture = new runtime.CanvasTexture(cover);
        texture.colorSpace = runtime.SRGBColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        displayPoster = { asset: { width, height }, texture, owned: true };
      }
      if (poster?.owned) poster.texture.dispose();
      for (const card of cards) card.mesh.material.dispose();
      references.clear();
      poster = displayPoster;
      sequence = nextSequence;
      stats.sequence = sequence ? 'authored-flow' : 'procedural';
      stats.sequenceFrames = sequence?.definition.frameCount || 0;
      stats.sequenceError = sequenceError;
      cards = loaded.map(({ reference, asset, texture }) => {
        const material = new runtime.ShaderMaterial({
          vertexShader,
          fragmentShader: referenceShader,
          uniforms: {
            uImage: { value: texture },
            uUV: { value: new runtime.Vector4() },
            uParallax: { value: new runtime.Vector2() },
            uOpacity: { value: 0 },
            uExposure: { value: 1 },
          },
          transparent: true,
          depthTest: false,
          depthWrite: false,
          blending: runtime.CustomBlending,
          blendEquation: runtime.AddEquation,
          blendSrc: runtime.SrcAlphaFactor,
          blendDst: runtime.OneFactor,
          blendEquationAlpha: runtime.AddEquation,
          blendSrcAlpha: runtime.OneFactor,
          blendDstAlpha: runtime.OneFactor,
        });
        const mesh = new runtime.Mesh(geometry, material);
        references.add(mesh);
        return { reference, asset, texture, mesh };
      });
      layer.material.uniforms.uPoster.value = poster.texture;
      const uniforms = layer.material.uniforms;
      uniforms.uSequenceAtlas.value = sequence?.atlas || poster.texture;
      uniforms.uSequenceFlow.value = sequence?.flow || poster.texture;
      uniforms.uHasSequence.value = sequence ? 1 : 0;
      uniforms.uHasSequenceFlow.value = sequence?.flow ? 1 : 0;
      if (sequence) {
        const d = sequence.definition;
        uniforms.uSequenceGrid.value.set(d.columns, d.rows);
        uniforms.uSequenceFrameCount.value = d.frameCount;
        uniforms.uSequencePosterFrame.value = d.posterFrame;
        uniforms.uSequenceSteps.value = d.keySteps;
        uniforms.uSequenceFlowRange.value = d.flowRange;
      }
      // Retain shared preview/reference textures, release obsolete uploaded covers.
      const used = new Set([
        next.poster.image || next.poster.src,
        next.fallback.image || next.fallback.src,
      ]);
      for (const ref of next.references || [])
        if (ref.src || ref.poster) used.add(new URL(ref.src || ref.poster, import.meta.url).href);
      if (sequence) {
        used.add(sequence.definition.atlas);
        if (sequence.flow) used.add(sequence.definition.flowAtlas);
      }
      for (const [key, promise] of textures)
        if (!used.has(key)) {
          textures.delete(key);
          promise.then(
            (texture) => texture.dispose(),
            () => {},
          );
        }
      renderKey = null;
      state(lost ? 'lost' : 'ready');
    } catch (error) {
      if (!disposed && version === assetVersion) state('failed', String(error.message || error));
    }
  }

  async function load() {
    if (loading || disposed || renderer || stats.state === 'failed') return;
    loading = true;
    state('loading');
    try {
      const THREE = await import('three');
      if (disposed) return;
      runtime = THREE;
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'default',
      });
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
      geometry = new THREE.PlaneGeometry(1, 1);
      camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
      references = new THREE.Scene();
      surface = new THREE.Scene();
      glyphs = glyphAtlas(THREE);
      code = codeAtlas(THREE, config.seed);
      composite = new THREE.Mesh(
        geometry,
        new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader: compositeShader,
          uniforms: { uAccumulation: { value: target.texture } },
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      layer = new THREE.Mesh(
        geometry,
        new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader: generationShader,
          uniforms: {
            uPoster: { value: null },
            uGlyphs: { value: glyphs },
            uCode: { value: code },
            uCodeSize: { value: new THREE.Vector2(code.image.width, code.image.height) },
            uSequenceAtlas: { value: null },
            uSequenceFlow: { value: null },
            uHasSequence: { value: 0 },
            uHasSequenceFlow: { value: 0 },
            uSequenceGrid: { value: new THREE.Vector2(1, 1) },
            uSequenceCrop: { value: new THREE.Vector4() },
            uSequenceFrameCount: { value: 0 },
            uSequencePosterFrame: { value: 0 },
            uSequenceSteps: { value: new Float32Array(maximumSequenceFrames).fill(1) },
            uSequenceFlowRange: { value: 0.16 },
            uSequenceFlowStrength: { value: config.sequenceFlowStrength },
            uSequenceRegionLag: { value: config.sequenceRegionLag },
            uPosterUV: { value: new THREE.Vector4() },
            uFrameSize: { value: new THREE.Vector2() },
            uProgress: { value: 0 },
            uWhite: { value: 0 },
            uScan: { value: 0 },
            uSplit: { value: 0 },
            uDenoise: { value: 0 },
            uFontSize: { value: config.fontSize },
            uLevels: { value: config.subdivisionLevels },
            uNoiseStrength: { value: config.noiseStrength },
            uDenoiseSteps: { value: config.denoiseSteps },
            uDenoiseBlur: { value: config.denoiseBlur },
            uDenoiseWarp: { value: config.denoiseWarp },
            uSeed: { value: config.seed },
            uStageDenoise: { value: new THREE.Vector2(config.stages.split, config.stages.denoise) },
          },
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      composite.renderOrder = 0;
      layer.renderOrder = 1;
      surface.add(composite, layer);
      // Surface a shader compilation failure as a static-cover compatibility state.
      renderer.debug.onShaderError = (_gl, _program, vertex, fragment) => {
        state('failed', 'Generation shader compilation failed');
        console.error(
          'AI generation shader',
          _gl.getShaderInfoLog(vertex),
          _gl.getShaderInfoLog(fragment),
        );
      };
      await applyAssets();
    } catch (error) {
      if (!disposed) state('failed', String(error.message || error));
    } finally {
      loading = false;
    }
  }

  function draw() {
    const g = latest.geometry;
    if (!renderer || !poster || !g || disposed || lost || stats.state !== 'ready') return;
    const ratio = Math.min(
      devicePixelRatio || 1,
      g.mobile ? config.mobileMaxPixelRatio : config.maxPixelRatio,
    );
    const key = [g.W, g.H, g.frame.w, g.frame.h, ratio, latest.progress, latest.arrival].join(':');
    if (key === renderKey) return;
    const size = [g.W, g.H, ratio].join(':');
    if (size !== sizeKey) {
      renderer.setPixelRatio(ratio);
      renderer.setSize(g.W, g.H, false);
      target.setSize(Math.max(1, Math.round(g.W * ratio)), Math.max(1, Math.round(g.H * ratio)));
      camera.right = g.W;
      camera.top = g.H;
      camera.updateProjectionMatrix();
      composite.position.set(g.W / 2, g.H / 2, 0);
      composite.scale.set(g.W, g.H, 1);
      sizeKey = size;
    }
    const s = generationState(latest.progress, config);
    references.visible = s.progress < config.stages.gather;
    for (const [i, card] of cards.entries()) {
      const pose = referencePose(
        s.progress,
        card.reference,
        i,
        cards.length,
        g,
        config,
        latest.arrival,
      );
      card.mesh.position.set(pose.x, g.H - pose.y, 0);
      card.mesh.scale.set(pose.w, pose.h, 1);
      card.mesh.rotation.z = (-pose.tilt * Math.PI) / 180;
      const [w, h] = assetSize(card.asset, card.texture);
      const uv = mediaUV({ w: pose.w, h: pose.h }, w, h, card.asset.crop, config.referenceOverscan);
      card.mesh.material.uniforms.uUV.value.set(uv.x, uv.y, uv.w, uv.h);
      card.mesh.material.uniforms.uParallax.value.set(pose.imageX, pose.imageY);
      card.mesh.material.uniforms.uOpacity.value = pose.opacity;
      card.mesh.material.uniforms.uExposure.value = pose.exposure;
    }
    const f = g.frame,
      u = layer.material.uniforms;
    layer.position.set(f.x + f.w / 2, g.H - f.y - f.h / 2, 0);
    layer.scale.set(f.w, f.h, 1);
    layer.visible = s.white > 0 || s.progress >= config.stages.white;
    const [w, h] = assetSize(poster.asset, poster.texture);
    const uv = mediaUV(f, w, h, poster.asset.crop);
    u.uPosterUV.value.set(uv.x, uv.y, uv.w, uv.h);
    if (sequence) {
      const image = sequence.atlas.image;
      const d = sequence.definition;
      const sequenceUV = mediaUV(f, image.width / d.columns, image.height / d.rows);
      u.uSequenceCrop.value.set(sequenceUV.x, sequenceUV.y, sequenceUV.w, sequenceUV.h);
    }
    u.uFrameSize.value.set(f.w, f.h);
    u.uFontSize.value = g.mobile ? config.mobileFontSize : config.fontSize;
    for (const name of ['progress', 'white', 'scan', 'split', 'denoise'])
      u['u' + name[0].toUpperCase() + name.slice(1)].value = s[name];
    // Always clear the accumulation target: no frame-history feedback or trails.
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(references, camera);
    renderer.setRenderTarget(null);
    renderer.render(surface, camera);
    stats.draws++;
    stats.memory = { ...renderer.info.memory };
    stats.pixelRatio = ratio;
    renderKey = key;
  }

  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      lost = true;
      canvas.hidden = true;
      state('lost');
    },
    { signal: abort.signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      lost = false;
      renderKey = sizeKey = null;
      state('ready');
    },
    { signal: abort.signal },
  );

  return {
    stats,
    update(value) {
      if (disposed) return;
      latest = { ...value, arrival: value.arrival ?? 1 };
      const s = generationState(value.progress, config);
      stats.progress = s.progress;
      stats.arrival = latest.arrival;
      stats.phase = s.phase;
      const frame = denoiseFrame(s.progress, config);
      stats.step = frame.from;
      stats.stepPosition = frame.position;
      stats.maximumStep = frame.maxStep;
      stats.predictionPair = sequence
        ? sequenceInterval(frame.normalized, sequence.definition)
        : null;
      const show =
        value.visible && !value.reduced && !s.complete && !lost && stats.state !== 'failed';
      canvas.hidden = !show;
      if (show) {
        if (!renderer) void load();
        else draw();
      }
    },
    setAssets(next) {
      if (disposed) return;
      pendingAssets = next;
      // Invalidate a pending load immediately, including before Three.js resolves.
      assetVersion++;
      if (runtime && renderer) void applyAssets();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      assetVersion++;
      abort.abort();
      for (const card of cards) card.mesh.material.dispose();
      layer?.material.dispose();
      composite?.material.dispose();
      geometry?.dispose();
      glyphs?.dispose();
      code?.dispose();
      if (poster?.owned) poster.texture.dispose();
      for (const promise of textures.values())
        promise.then(
          (texture) => texture.dispose(),
          () => {},
        );
      textures.clear();
      target?.dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
      canvas.remove();
      stats.state = 'disposed';
      stats.memory = { geometries: 0, textures: 0 };
    },
  };
}
