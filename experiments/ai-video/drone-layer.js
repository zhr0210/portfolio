import { devicePose } from './device-motion.js';
import { releaseScene } from './device-layer.js';
import { createDroneRig } from './drone-rig.js';

/** Rotor time is the only autonomous clock. Body travel remains an absolute,
 * reversible scroll sample; hidden/offscreen/reduced views stop this clock. */
export function createDroneLayer(host, { assetUrl, config, onInvalidate = () => {} }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'reel-drone-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    opacity: '0',
  });
  host.append(canvas);
  const abort = new AbortController();
  const stats = {
    state: 'idle',
    draws: 0,
    rotors: 0,
    rotorAngle: 0,
    visible: false,
    raf: 0,
    error: null,
  };
  let latest = { progress: 0, geo: null, visible: false, reduced: false };
  let renderer, scene, camera, model, rig, baseSize, radiusRatio;
  let loading = false,
    disposed = false,
    lost = false,
    releasing = false;
  let previousTime = 0,
    lastKey = null;
  function stop() {
    cancelAnimationFrame(stats.raf);
    stats.raf = 0;
    previousTime = 0;
  }
  function pose() {
    if (!latest.geo || !model) return null;
    const g = latest.geo;
    const size = g.H * (g.mobile ? config.mobileSize : config.size);
    const p = devicePose(latest.progress, size * radiusRatio, g.H, {
      phase: config.phase,
      reduced: latest.reduced,
      reducedProgress: 0.5,
    });
    const virtualWidth = g.mobile ? g.W : Math.max(g.W, g.H * config.compositionAspect);
    p.x = g.W / 2 + virtualWidth * ((g.mobile ? config.mobileTargetX : config.targetX) - 0.5);
    if (g.mobile && !latest.reduced)
      p.y += (config.mobileVerticalBias || 0) * g.H * Math.sin(Math.PI * p.progress) ** 2;
    p.size = size;
    p.visible &&= latest.visible && !document.hidden;
    return p;
  }
  function draw() {
    if (disposed || lost || !renderer) return false;
    const p = pose();
    stats.visible = !!p?.visible;
    canvas.style.opacity = stats.visible ? '1' : '0';
    if (!stats.visible) {
      stop();
      return false;
    }
    const g = latest.geo;
    const ratio = Math.min(
      devicePixelRatio || 1,
      g.mobile ? config.mobileMaxPixelRatio : config.maxPixelRatio,
    );
    const angle = latest.reduced ? 0 : stats.rotorAngle;
    const key = [g.W, g.H, ratio, p.x, p.y, p.size, angle].join(':');
    if (key === lastKey) return !latest.reduced;
    if (stats.width !== g.W || stats.height !== g.H || stats.pixelRatio !== ratio) {
      renderer.setPixelRatio(ratio);
      renderer.setSize(g.W, g.H, false);
      camera.left = -g.W / 2;
      camera.right = g.W / 2;
      camera.top = g.H / 2;
      camera.bottom = -g.H / 2;
      camera.updateProjectionMatrix();
      stats.width = g.W;
      stats.height = g.H;
      stats.pixelRatio = ratio;
    }
    model.scale.setScalar(p.size / baseSize);
    model.position.set(p.x - g.W / 2, g.H / 2 - p.y, 0);
    rig.sample(angle);
    renderer.render(scene, camera);
    stats.draws++;
    stats.pose = p;
    stats.memory = { ...renderer.info.memory };
    lastKey = key;
    return !latest.reduced;
  }
  function schedule() {
    if (!stats.raf && !disposed && !lost && stats.visible && !latest.reduced)
      stats.raf = requestAnimationFrame(tick);
  }
  function tick(time) {
    stats.raf = 0;
    if (disposed || document.hidden) {
      stop();
      return;
    }
    const dt = previousTime ? Math.min(0.05, (time - previousTime) / 1000) : 0;
    previousTime = time;
    stats.rotorAngle = (stats.rotorAngle + dt * config.rotorRadiansPerSecond) % (Math.PI * 2);
    if (draw()) schedule();
  }
  function release() {
    releasing = true;
    stop();
    releaseScene(scene);
    renderer?.dispose();
    if (disposed) renderer?.forceContextLoss();
    renderer = scene = camera = model = rig = null;
    stats.width = stats.height = 0;
    releasing = false;
  }
  async function load() {
    if (loading || renderer || disposed || lost || stats.state === 'failed') return;
    loading = true;
    stats.state = 'loading';
    let source;
    try {
      const [THREE, { GLTFLoader }, bytes] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        fetch(assetUrl, { signal: abort.signal }).then((r) => {
          if (!r.ok) throw new Error(`Drone asset could not load (${r.status})`);
          return r.arrayBuffer();
        }),
      ]);
      const gltf = await new GLTFLoader().parseAsync(
        bytes,
        new URL('.', assetUrl, location.href).href,
      );
      source = gltf.scene;
      if (disposed) {
        releaseScene(source);
        return;
      }
      rig = createDroneRig(THREE, source);
      const bounds = new THREE.Box3().setFromObject(source);
      const center = bounds.getCenter(new THREE.Vector3());
      baseSize = Math.max(...bounds.getSize(new THREE.Vector3()).toArray());
      radiusRatio = bounds.getBoundingSphere(new THREE.Sphere()).radius / baseSize;
      source.position.sub(center);
      model = new THREE.Group();
      model.add(source);
      model.rotation.set(...config.rotation);
      scene = new THREE.Scene();
      scene.add(model);
      const ambient = new THREE.AmbientLight(0xffffff, 0.8);
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(-300, 600, 700);
      const fill = new THREE.DirectionalLight(0xb5c9e5, 0.8);
      fill.position.set(500, -200, 450);
      scene.add(ambient, key, fill);
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3000);
      camera.position.z = 1000;
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.AgXToneMapping;
      renderer.toneMappingExposure = config.exposure;
      renderer.setClearColor(0x000000, 0);
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      source.traverse((node) => {
        for (const material of [].concat(node.material || []))
          for (const value of Object.values(material))
            if (value?.isTexture) {
              value.anisotropy = anisotropy;
              value.needsUpdate = true;
            }
      });
      stats.rotors = rig.rotors.length;
      stats.state = 'ready';
      stats.error = null;
      lastKey = null;
      draw();
      schedule();
      onInvalidate();
    } catch (error) {
      if (disposed || error.name === 'AbortError') return;
      if (source && !scene) releaseScene(source);
      release();
      stats.state = 'failed';
      stats.error = error.message;
      canvas.style.opacity = '0';
      onInvalidate();
    } finally {
      loading = false;
    }
  }
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        stop();
        canvas.style.opacity = '0';
      } else {
        draw();
        schedule();
      }
    },
    { signal: abort.signal },
  );
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      if (disposed || releasing) return;
      lost = true;
      stop();
      canvas.style.opacity = '0';
      stats.state = 'lost';
    },
    { signal: abort.signal },
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () =>
      queueMicrotask(() => {
        if (disposed) return;
        release();
        lost = false;
        stats.state = 'idle';
        void load();
      }),
    { signal: abort.signal },
  );
  return {
    stats,
    update(value) {
      if (disposed) return;
      latest = { ...latest, ...value };
      if (latest.reduced) stop();
      if (latest.visible && !document.hidden && latest.geo) void load();
      draw();
      schedule();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      release();
      canvas.remove();
      stats.state = 'disposed';
      stats.memory = null;
    },
  };
}
