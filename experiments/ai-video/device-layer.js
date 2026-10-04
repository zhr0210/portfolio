import { deviceProjection, deviceTime } from './device-motion.js';

/** LoopOnce pauses an action at its endpoint; restore it before reverse sampling. */
export function sampleDeviceTimeline(mixer, actions, time) {
  for (const action of actions) {
    action.enabled = true;
    action.paused = false;
    action.timeScale = 1;
  }
  mixer.setTime(time);
}

function releaseScene(scene, closeImages = true) {
  if (!scene) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const images = new Set();
  scene.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [].concat(object.material || [])) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  }
  for (const texture of textures) {
    const image = texture.source?.data;
    if (image && typeof image.close === 'function') images.add(image);
    texture.dispose();
  }
  if (closeImages) for (const image of images) image.close();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

/** One transparent, demand-rendered canvas beneath the existing DOM video. */
export function createDeviceLayer(
  host,
  { assetUrl, quality = {}, onState = () => {}, onInvalidate = () => {}, config = {} } = {},
) {
  const settings = { ...config, ...quality };
  const stats = {
    state: 'idle',
    draws: 0,
    progress: 0,
    time: 0,
    duration: 0,
    width: 0,
    height: 0,
    pixelRatio: 0,
    clips: [],
    camera: null,
    memory: null,
    error: null,
  };
  const canvas = document.createElement('canvas');
  canvas.className = 'reel-device-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '2',
    opacity: '0',
  });
  host.append(canvas);
  const abort = new AbortController();
  let latest = { progress: 0, geo: null, opacity: 0, visible: false, reduced: false };
  let disposed = false;
  let loading = false;
  let renderer = null;
  let scene = null;
  let camera = null;
  let sourceFov = 0;
  let mixer = null;
  let actions = [];
  let environment = null;
  let pmrem = null;
  let EnvironmentClass = null;
  let Runtime = null;
  let contextLost = false;
  let lastProjection = null;
  let lastRenderKey = null;
  let deviceRoots = null;

  function state(value, error = null) {
    if (disposed) return;
    stats.state = value;
    stats.error = error?.message || null;
    onState(value, stats);
  }

  function draw() {
    if (disposed || !renderer || contextLost || stats.state !== 'ready' || !latest.geo) return;
    const opacity = Math.max(0, Math.min(1, latest.opacity || 0));
    const visible = latest.visible && opacity > 0 && !document.hidden;
    canvas.style.opacity = visible ? String(opacity) : '0';
    if (!visible) return;
    const projection = deviceProjection(latest.geo, sourceFov, settings, window.devicePixelRatio);
    const passes =
      latest.geo.mobile && deviceRoots && settings.mobileComposition
        ? ['sony', 'pocket'].map((device) => ({
            device,
            projection: deviceProjection(
              latest.geo,
              sourceFov,
              settings,
              window.devicePixelRatio,
              device,
            ),
          }))
        : [{ device: null, projection }];
    const time = deviceTime(latest.progress, stats.duration, {
      reduced: latest.reduced,
      reducedProgress: settings.reducedProgress,
    });
    const projectionKey = JSON.stringify(passes);
    if (projectionKey !== lastProjection) {
      renderer.setPixelRatio(projection.pixelRatio);
      renderer.setSize(projection.width, projection.height, false);
      lastProjection = projectionKey;
    }
    const renderKey = `${projectionKey}:${time}`;
    stats.progress = latest.progress;
    stats.time = time;
    stats.width = projection.width;
    stats.height = projection.height;
    stats.pixelRatio = projection.pixelRatio;
    if (renderKey === lastRenderKey) return;
    sampleDeviceTimeline(mixer, actions, time);
    scene.updateMatrixWorld(true);
    renderer.clear();
    const visibility =
      deviceRoots &&
      Object.fromEntries(Object.entries(deviceRoots).map(([name, root]) => [name, root.visible]));
    try {
      for (const pass of passes) {
        const view = pass.projection;
        camera.fov = view.fov;
        camera.setViewOffset(
          view.fullWidth,
          view.fullHeight,
          view.offsetX,
          view.offsetY,
          view.width,
          view.height,
        );
        camera.updateProjectionMatrix();
        if (pass.device) {
          for (const [name, root] of Object.entries(deviceRoots))
            root.visible = name === pass.device;
        }
        renderer.render(scene, camera);
      }
    } finally {
      if (visibility)
        for (const [name, root] of Object.entries(deviceRoots)) root.visible = visibility[name];
    }
    stats.renderPasses = passes.length;
    stats.draws += 1;
    stats.memory = { ...renderer.info.memory };
    lastRenderKey = renderKey;
  }

  async function load() {
    if (disposed || loading || stats.state === 'fallback' || renderer) return;
    loading = true;
    state('loading');
    let loadedScene = null;
    try {
      const [THREE, loaderModule, environmentModule, areaModule, bytes] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/environments/RoomEnvironment.js'),
        import('three/addons/lights/RectAreaLightUniformsLib.js'),
        fetch(assetUrl, { signal: abort.signal }).then((response) => {
          if (!response.ok) throw new Error(`Device asset could not load (${response.status})`);
          return response.arrayBuffer();
        }),
      ]);
      if (disposed) return;
      const loader = new loaderModule.GLTFLoader();
      const gltf = await loader.parseAsync(
        bytes,
        new URL('.', assetUrl, window.location.href).href,
      );
      loadedScene = gltf.scene;
      if (disposed) {
        releaseScene(loadedScene);
        return;
      }
      EnvironmentClass = environmentModule.RoomEnvironment;
      Runtime = THREE;
      const source = gltf.scene.getObjectByName(settings.cameraName || 'sourceCamera');
      const sourceCamera = source?.isPerspectiveCamera
        ? source
        : source?.getObjectByProperty('isPerspectiveCamera', true);
      if (!sourceCamera)
        throw new Error('The device asset needs its original perspective sourceCamera');
      if (!gltf.animations.length) throw new Error('The device asset has no authored animation');
      sourceCamera.updateWorldMatrix(true, false);
      camera = sourceCamera.clone();
      sourceCamera.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale);
      camera.clearViewOffset();
      camera.updateMatrixWorld(true);
      sourceFov = sourceCamera.fov;
      stats.camera = {
        name: source.name,
        fov: sourceFov,
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
      };
      // GLTFLoader returns a Group; environment lighting requires a real Scene.
      scene = new THREE.Scene();
      scene.add(gltf.scene);
      deviceRoots = {
        sony: scene.getObjectByName('z轴移动'),
        pocket: scene.getObjectByName('空物体'),
      };
      if (!deviceRoots.sony || !deviceRoots.pocket)
        throw new Error('A finished device root is missing');
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.AgXToneMapping;
      renderer.toneMappingExposure = settings.exposure ?? 1;
      pmrem = new THREE.PMREMGenerator(renderer);
      const room = new EnvironmentClass();
      try {
        environment = pmrem.fromScene(room, 0.04);
      } finally {
        releaseScene(room);
      }
      scene.environment = environment.texture;
      scene.environmentIntensity = settings.environmentIntensity ?? 0.8;
      const key = new THREE.DirectionalLight(0xffffff, settings.keyIntensity ?? 3);
      key.position.set(-15, 20, 45);
      key.target.position.set(20, 0, 0);
      const fill = new THREE.DirectionalLight(0xb4c7e0, settings.fillIntensity ?? 1);
      fill.position.set(45, 8, 40);
      fill.target.position.set(20, 0, 0);
      // Lighting only: device roots and the source camera retain authored transforms.
      scene.add(key, fill, key.target, fill.target);
      // Broad studio softbox preserves highlights on the dark device materials.
      areaModule.RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xffffff, settings.softboxIntensity ?? 6, 80, 80);
      softbox.position.set(20, 0, 35);
      scene.add(softbox);
      mixer = new THREE.AnimationMixer(scene);
      actions = gltf.animations.map((clip) => {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        return action;
      });
      stats.duration = Math.max(...gltf.animations.map((clip) => clip.duration));
      stats.clips = gltf.animations.map((clip) => ({
        name: clip.name,
        duration: clip.duration,
        tracks: clip.tracks.length,
      }));
      state('ready');
      draw();
      onInvalidate();
    } catch (error) {
      if (disposed || error.name === 'AbortError') return;
      if (loadedScene && !scene) releaseScene(loadedScene);
      releaseResources();
      canvas.style.opacity = '0';
      state('fallback', error);
      onInvalidate();
    } finally {
      loading = false;
    }
  }

  function releaseResources() {
    if (mixer) {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
    }
    releaseScene(scene);
    environment?.dispose();
    pmrem?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
    scene = camera = renderer = mixer = environment = pmrem = EnvironmentClass = Runtime = null;
    deviceRoots = null;
    actions = [];
  }

  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      if (disposed) return;
      contextLost = true;
      canvas.style.opacity = '0';
      // Release generated targets while the old GL context is still lost.
      // Their cached framebuffers cannot be reused after restoration.
      if (scene) scene.environment = null;
      // Remove old renderer disposal listeners while deletion is a no-op on
      // the lost context. Keep CPU data/ImageBitmaps for re-uploading later.
      releaseScene(scene, false);
      environment?.dispose();
      pmrem?.dispose();
      environment = pmrem = null;
      state('fallback', new Error('WebGL context lost'));
      onInvalidate();
    },
    { signal: abort.signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () =>
      queueMicrotask(() => {
        // Our listener is registered before WebGLRenderer's listener. Wait for
        // Three to rebuild its GL state before creating new GPU resources.
        if (disposed || !renderer || !scene) return;
        contextLost = false;
        try {
          // PMREM is generated GPU content, so restore it instead of reusing an empty target.
          const room = new EnvironmentClass();
          pmrem = new Runtime.PMREMGenerator(renderer);
          try {
            environment = pmrem.fromScene(room, 0.04);
            scene.environment = environment.texture;
          } finally {
            releaseScene(room);
          }
          lastProjection = lastRenderKey = null;
          state('ready');
          draw();
        } catch (error) {
          canvas.style.opacity = '0';
          state('fallback', error);
        }
        onInvalidate();
      }),
    { signal: abort.signal },
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) canvas.style.opacity = '0';
      else {
        draw();
        onInvalidate();
      }
    },
    { signal: abort.signal },
  );

  return {
    stats,
    update(next) {
      if (disposed) return;
      latest = { ...latest, ...next };
      stats.progress = latest.progress;
      if (latest.visible && latest.opacity > 0 && !document.hidden && latest.geo) load();
      draw();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      releaseResources();
      canvas.remove();
      stats.state = 'disposed';
      stats.memory = null;
    },
  };
}
