import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import metadata from './assets/mavic-3-unfold.metadata.json';

const $ = (id) => document.getElementById(id);
const stage = document.querySelector('.stage');
let renderer, scene, camera, mixer, controls, environment;
let time = 4.8,
  playing = false,
  freeView = false,
  frame = 0,
  last = 0,
  disposed = false;
const duration = metadata.duration;
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const modelURL = new URL('./assets/mavic-3-unfold.glb', import.meta.url).href;

function describe(t) {
  if (t < 5.05) return '折叠姿态';
  if (t < 6.05) return '后机臂翻出';
  if (t < 7.3) return '前机臂展开';
  if (t < 8.6) return '桨叶打开';
  return '展开完成';
}

function sample(t) {
  time = Math.max(0, Math.min(duration, t));
  mixer?.setTime(time);
  $('timeline').value = String(time);
  $('time').value = time.toFixed(2).padStart(5, '0');
  $('phase').textContent = describe(time);
  $('fold').setAttribute('aria-pressed', String(time <= 5.05));
  $('open').setAttribute('aria-pressed', String(time >= 8.6));
  $('timeline').setAttribute('aria-valuetext', `${time.toFixed(2)} 秒，${describe(time)}`);
}

function stop() {
  playing = false;
  cancelAnimationFrame(frame);
  frame = 0;
  $('play').textContent = '播放';
}

function resize() {
  if (!renderer || !camera) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 600 ? 1.5 : 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  camera.aspect = stage.clientWidth / stage.clientHeight;
  // Preserve the film's horizontal composition in narrow portrait viewports.
  camera.fov = THREE.MathUtils.radToDeg(
    2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(18 / 2)) * Math.max(1, 16 / 9 / camera.aspect)),
  );
  camera.updateProjectionMatrix();
  draw();
}

function draw() {
  if (!renderer || disposed || document.hidden) return;
  renderer.render(scene, freeView ? controls.object : camera);
}

function tick(now) {
  frame = 0;
  if (!playing || disposed || document.hidden) return;
  const delta = Math.min((now - last) / 1000, 0.1);
  last = now;
  sample(time + delta * Number($('speed').value));
  draw();
  if (time >= duration) stop();
  else frame = requestAnimationFrame(tick);
}

function setFreeView(value) {
  if (!controls) return;
  freeView = value;
  if (value) {
    camera.updateWorldMatrix(true, false);
    controls.object.position.copy(camera.getWorldPosition(new THREE.Vector3()));
    controls.object.quaternion.copy(camera.getWorldQuaternion(new THREE.Quaternion()));
    controls.object.fov = Math.max(camera.fov, 36);
    controls.object.aspect = camera.aspect;
    controls.object.updateProjectionMatrix();
    controls.update();
  }
  controls.enabled = value;
  $('view').textContent = value ? '参考镜头' : '自由查看';
  $('view').setAttribute('aria-pressed', String(value));
  draw();
}

function seek(t) {
  stop();
  sample(t);
  draw();
}
function play() {
  if (!mixer) return;
  if (playing) {
    stop();
    return;
  }
  if (time >= duration) sample(4.8);
  setFreeView(false);
  playing = true;
  $('play').textContent = '暂停';
  last = performance.now();
  frame = requestAnimationFrame(tick);
}

$('timeline').addEventListener('input', () => seek(Number($('timeline').value)));
$('play').addEventListener('click', play);
$('replay').addEventListener('click', () => {
  seek(4.8);
  play();
});
$('fold').addEventListener('click', () => {
  setFreeView(false);
  seek(0);
});
$('open').addEventListener('click', () => {
  setFreeView(false);
  seek(duration);
});
$('view').addEventListener('click', () => {
  stop();
  setFreeView(!freeView);
});
window.addEventListener('keydown', (event) => {
  if (/INPUT|SELECT|BUTTON/.test(event.target.tagName)) return;
  if (event.code === 'Space') {
    event.preventDefault();
    play();
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    seek(time + 0.1);
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    seek(time - 0.1);
  }
  if (event.key === 'Home') seek(0);
  if (event.key === 'End') seek(duration);
});
window.addEventListener('resize', () => {
  resize();
  if (freeView) {
    controls.object.aspect = camera.aspect;
    controls.object.fov = Math.max(camera.fov, 36);
    controls.object.updateProjectionMatrix();
    draw();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
  else draw();
});

function dispose() {
  disposed = true;
  stop();
  controls?.dispose();
  const textures = new Set();
  scene?.traverse((obj) => {
    obj.geometry?.dispose();
    for (const material of obj.material ? [].concat(obj.material) : []) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
  });
  for (const texture of textures) texture.dispose();
  mixer?.stopAllAction();
  if (mixer) mixer.uncacheRoot(mixer.getRoot());
  environment?.dispose();
  renderer?.dispose();
}
window.addEventListener('pagehide', dispose, { once: true });
if (import.meta.hot) import.meta.hot.dispose(dispose);

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000);
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.15;
    stage.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    RectAreaLightUniformsLib.init();
    for (const spec of metadata.lights) {
      // Blender Z-up to glTF/Three Y-up. Preserve softbox geometry and ratios.
      const light = new THREE.RectAreaLight(
        new THREE.Color(...spec.color),
        spec.power * 0.5,
        spec.size,
        spec.size,
      );
      light.position.set(spec.position[0], spec.position[2], -spec.position[1]);
      light.lookAt(0, 0.012, -0.01);
      scene.add(light);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.12;
    room.dispose();
    pmrem.dispose();
    const gltf = await new GLTFLoader().loadAsync(modelURL, (event) => {
      if (event.total)
        $('status').textContent =
          `正在载入模型… ${Math.round((event.loaded / event.total) * 100)}%`;
    });
    if (disposed) return;
    scene.add(gltf.scene);
    camera = gltf.cameras[0];
    if (!camera || !gltf.animations.length) throw new Error('模型缺少相机或动画');
    scene.traverse((obj) => {
      if (!obj.isMesh) return;
      for (const mat of [].concat(obj.material)) {
        for (const tex of Object.values(mat))
          if (tex?.isTexture)
            tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      }
    });
    mixer = new THREE.AnimationMixer(gltf.scene);
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    }
    // Reset paused clamp state on every absolute sample, making reverse scrubbing exact.
    const setTime = mixer.setTime.bind(mixer);
    mixer.setTime = (t) => {
      for (const clip of gltf.animations) mixer.clipAction(clip).paused = false;
      return setTime(t);
    };
    const freeCamera = new THREE.PerspectiveCamera();
    controls = new OrbitControls(freeCamera, renderer.domElement);
    controls.target.set(0, 0.012, -0.01);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.minDistance = 0.35;
    controls.maxDistance = 1.8;
    controls.enabled = false;
    controls.addEventListener('change', draw);
    for (const id of ['timeline', 'play', 'replay', 'view']) $(id).disabled = false;
    $('status').hidden = true;
    sample(reduced.matches ? duration : time);
    resize();
  } catch (error) {
    $('status').textContent = '三维预览未能载入，请刷新页面，或用 Blender 工程查看动画。';
    console.error(error);
    renderer?.dispose();
  }
}
init();
