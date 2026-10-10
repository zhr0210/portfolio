import { devicePose, deviceProjection } from './device-motion.js';
import { createAuthoredPocketLighting } from './device-lighting.js';

/** LoopOnce pauses an action at its endpoint; restore it before reverse sampling. */
export function sampleDeviceTimeline(mixer, actions, time) {
  for (const action of actions) {
    action.enabled = true;
    action.paused = false;
    action.timeScale = 1;
  }
  mixer.setTime(time);
}

export function releaseScene(scene, closeImages = true) {
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
  const settings = {
    sourceAspect: 16 / 9,
    desktopComposition: {
      sony: { targetX: 0.17, targetY: 0.5 },
      pocket: { targetX: 0.84, targetY: 0.5 },
    },
    mobileComposition: {
      sony: { targetX: 0.5, targetY: 0.2 },
      pocket: { targetX: 0.5, targetY: 0.8 },
    },
    animationRanges: { sony: [0, 9], pocket: [1.5, 10.5] },
    ...config,
    ...quality,
  };
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
  let environment = null;
  let pmrem = null;
  let EnvironmentClass = null;
  let Runtime = null;
  let contextLost = false;
  let lastProjection = null;
  let lastRenderKey = null;
  let deviceRoots = null;
  let timelines = null;
  let bounds = null;
  let pocketLighting = null;
  let studioLights = [];
  let releasing = false;

  function sampleTimelines(poses) {
    for (const [name, timeline] of Object.entries(timelines)) {
      const [start, end] = settings.animationRanges?.[name] || [0, stats.duration];
      sampleDeviceTimeline(
        timeline.mixer,
        timeline.actions,
        start + poses[name].progress * (end - start),
      );
    }
    scene.updateMatrixWorld(true);
  }

  function prepareTimelines(THREE, clips) {
    // Sample the extended Blender animation once, without wrapping or a return clip.
    timelines = {};
    for (const [name, root] of Object.entries(deviceRoots)) {
      const targets = new Set();
      root.traverse((node) => {
        targets.add(node.uuid);
        targets.add(THREE.PropertyBinding.sanitizeNodeName(node.name));
      });
      const mixer = new THREE.AnimationMixer(root);
      const actions = [];
      const addAction = (clip) => {
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        actions.push(action);
      };
      for (const sourceClip of clips) {
        const tracks = sourceClip.tracks.filter((track) => {
          const binding = THREE.PropertyBinding.parseTrackName(track.name);
          return binding.propertyName === 'quaternion' && targets.has(binding.nodeName);
        });
        if (tracks.length)
          addAction(
            new THREE.AnimationClip(`${sourceClip.name}:${name}`, sourceClip.duration, tracks),
          );
      }
      if (!actions.length) throw new Error(`The ${name} authored rotation is missing`);
      timelines[name] = { mixer, actions };
    }
    // Bound the complete finite rotation and gimbal motion. Source lights are
    // attached afterwards, outside these bounds.
    const boxes = Object.fromEntries(
      Object.keys(deviceRoots).map((name) => [name, new THREE.Box3()]),
    );
    const projected = Object.fromEntries(
      Object.keys(deviceRoots).map((name) => [name, { minY: Infinity, maxY: -Infinity }]),
    );
    const corner = new THREE.Vector3();
    for (let index = 0; index <= 480; index++) {
      const poses = Object.fromEntries(
        Object.keys(timelines).map((name) => [name, devicePose(index / 480, 1, 1)]),
      );
      sampleTimelines(poses);
      for (const name of Object.keys(timelines)) {
        const root = deviceRoots[name];
        const box = new THREE.Box3().setFromObject(root);
        boxes[name].union(box);
        for (let bits = 0; bits < 8; bits++) {
          corner
            .set(
              bits & 1 ? box.max.x : box.min.x,
              bits & 2 ? box.max.y : box.min.y,
              bits & 4 ? box.max.z : box.min.z,
            )
            .project(camera);
          const y = 0.5 - corner.y / 2;
          projected[name].minY = Math.min(projected[name].minY, y);
          projected[name].maxY = Math.max(projected[name].maxY, y);
        }
      }
    }
    const view = camera.matrixWorld.clone().invert();
    bounds = {};
    for (const [name, box] of Object.entries(boxes)) {
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const center = sphere.center.clone().applyMatrix4(view);
      const depth = -center.z;
      const halfHeight = depth * Math.tan((sourceFov * Math.PI) / 360);
      const sourceY = 0.5 - center.y / (2 * halfHeight);
      bounds[name] = {
        sourceX: 0.5 + center.x / (2 * halfHeight * settings.sourceAspect),
        sourceY,
        // Project rotation bounds directly; a 3D sphere badly overestimates a long lens.
        radiusRatio:
          Math.max(sourceY - projected[name].minY, projected[name].maxY - sourceY) * 1.08 + 0.005,
      };
    }
    stats.bounds = bounds;
    lastRenderKey = null;
  }

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
    if (!visible) {
      canvas.style.opacity = '0';
      stats.renderPasses = 0;
      return;
    }
    const projection = deviceProjection(latest.geo, sourceFov, settings, window.devicePixelRatio);
    const fovRatio =
      Math.tan((sourceFov * Math.PI) / 360) / Math.tan((projection.fov * Math.PI) / 360);
    const poses = {};
    const passes = ['sony', 'pocket'].map((device) => {
      const slot = (latest.geo.mobile ? settings.mobileComposition : settings.desktopComposition)[
        device
      ];
      const composition = {
        ...slot,
        sourceX: 0.5 + (bounds[device].sourceX - 0.5) * fovRatio,
        sourceY: 0.5 + (bounds[device].sourceY - 0.5) * fovRatio,
      };
      const viewSettings = {
        ...settings,
        desktopComposition: { ...settings.desktopComposition, [device]: composition },
        mobileComposition: { ...settings.mobileComposition, [device]: composition },
      };
      const view = deviceProjection(
        latest.geo,
        sourceFov,
        viewSettings,
        window.devicePixelRatio,
        device,
      );
      const pose = devicePose(
        latest.progress,
        (bounds[device].radiusRatio * fovRatio + Math.abs(settings.offsetY || 0)) * view.fullHeight,
        latest.geo.H,
        {
          phase: settings.entryOffsets?.[device],
          reduced: latest.reduced,
          reducedProgress: settings.reducedProgress,
        },
      );
      poses[device] = pose;
      if (latest.reduced) pose.y = latest.geo.H * slot.targetY;
      else
        pose.y +=
          Math.max(-0.3, Math.min(0.3, slot.verticalBias || 0)) *
          latest.geo.H *
          Math.sin(Math.PI * pose.progress) ** 2;
      view.offsetY =
        view.fullHeight * composition.sourceY - pose.y - (settings.offsetY || 0) * view.fullHeight;
      return {
        device,
        projection: view,
        pose,
      };
    });
    const [sonyStart, sonyEnd] = settings.animationRanges.sony;
    const time = sonyStart + poses.sony.progress * (sonyEnd - sonyStart);
    const projectionKey = JSON.stringify(passes);
    const resizeKey = `${projection.width}:${projection.height}:${projection.pixelRatio}`;
    if (resizeKey !== lastProjection) {
      renderer.setPixelRatio(projection.pixelRatio);
      renderer.setSize(projection.width, projection.height, false);
      lastProjection = resizeKey;
    }
    const renderKey = `${projectionKey}:${time}`;
    stats.progress = latest.progress;
    stats.time = time;
    stats.width = projection.width;
    stats.height = projection.height;
    stats.pixelRatio = projection.pixelRatio;
    stats.devices = Object.fromEntries(
      passes.map((pass) => [
        pass.device,
        {
          ...pass.pose,
          time:
            settings.animationRanges[pass.device][0] +
            pass.pose.progress *
              (settings.animationRanges[pass.device][1] - settings.animationRanges[pass.device][0]),
          targetX: (latest.geo.mobile ? settings.mobileComposition : settings.desktopComposition)[
            pass.device
          ].targetX,
        },
      ]),
    );
    const activePasses = passes.filter((pass) => pass.pose.visible);
    canvas.style.opacity = activePasses.length ? String(opacity) : '0';
    stats.renderPasses = activePasses.length;
    if (!activePasses.length || renderKey === lastRenderKey) return;
    sampleTimelines(poses);
    renderer.clear();
    const visibility =
      deviceRoots &&
      Object.fromEntries(Object.entries(deviceRoots).map(([name, root]) => [name, root.visible]));
    try {
      for (const pass of activePasses) {
        const pocket = pass.device === 'pocket';
        for (const light of studioLights) light.visible = !pocket;
        pocketLighting.setEnabled(pocket);
        scene.environment = pocket ? null : environment.texture;
        scene.environmentIntensity = pocket ? 0 : (settings.environmentIntensity ?? 0.8);
        renderer.toneMappingExposure = pocket
          ? (settings.pocketLighting?.exposure ?? pocketLighting.exposure)
          : (settings.exposure ?? 1);
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
      for (const light of studioLights) light.visible = true;
      pocketLighting.setEnabled(false);
      scene.environment = environment.texture;
      scene.environmentIntensity = settings.environmentIntensity ?? 0.8;
      renderer.toneMappingExposure = settings.exposure ?? 1;
    }
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
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const filtered = new Set();
      gltf.scene.traverse((object) => {
        for (const material of [].concat(object.material || [])) {
          for (const texture of Object.values(material)) {
            if (!texture?.isTexture || filtered.has(texture)) continue;
            texture.anisotropy = anisotropy;
            texture.needsUpdate = true;
            filtered.add(texture);
          }
        }
      });
      pmrem = new THREE.PMREMGenerator(renderer);
      const room = new EnvironmentClass();
      try {
        environment = pmrem.fromScene(room, 0.04);
      } finally {
        releaseScene(room);
      }
      scene.environment = environment.texture;
      scene.environmentIntensity = settings.environmentIntensity ?? 0.8;
      // Neutral diffuse fill keeps a matte black shell readable without
      // increasing environment reflections or reintroducing a glossy finish.
      const ambient = new THREE.AmbientLight(0xffffff, settings.ambientIntensity ?? 0.55);
      scene.add(ambient);
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
      studioLights = [ambient, key, fill, softbox];
      stats.duration = Math.max(...gltf.animations.map((clip) => clip.duration));
      stats.clips = gltf.animations.map((clip) => ({
        name: clip.name,
        duration: clip.duration,
        tracks: clip.tracks.length,
      }));
      prepareTimelines(THREE, gltf.animations);
      pocketLighting = createAuthoredPocketLighting(
        THREE,
        deviceRoots.pocket,
        settings.pocketLighting,
      );
      pocketLighting.setEnabled(false);
      stats.lighting = {
        genericStudioForSonyOnly: true,
        pocket: pocketLighting.snapshot,
        pocketExposure: settings.pocketLighting?.exposure ?? pocketLighting.exposure,
      };
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
    releasing = true;
    if (timelines)
      for (const timeline of Object.values(timelines)) {
        timeline.mixer.stopAllAction();
        timeline.mixer.uncacheRoot(timeline.mixer.getRoot());
      }
    timelines = bounds = null;
    pocketLighting?.dispose();
    pocketLighting = null;
    studioLights = [];
    releaseScene(scene);
    environment?.dispose();
    pmrem?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
    scene = camera = renderer = environment = pmrem = EnvironmentClass = Runtime = null;
    deviceRoots = null;
  }

  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      if (disposed || releasing) return;
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
        if (disposed || releasing || !renderer || !scene) return;
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
