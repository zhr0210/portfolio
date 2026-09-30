// 在这里修改作品、标题、参数和滑动行程。真实视频填写 video 路径。
export const reelConfig = {
  wheelTravel: 2100,
  smoothing: 0.19,
  sceneTravel: 1.36,
  videoWidth: 0.568,
  mobileVideoWidth: 0.78,
  titleParallax: 0.1,
  metadataParallax: 0.08,
  referenceParallax: 0.78,
};

// 用原始参考图作为共享图集，CSS 裁切，不改动用户原图。
export const sheet = {
  src: 'assets/vertical-film-sheet.jpg',
  width: 3882,
  height: 2183,
};
export const filmCrop = [843, 500, 2196, 1184];
export const cameraCrops = [
  [0, 1462, 625, 650],
  [3325, 360, 557, 730],
];
export const reelWorks = [
  {
    id: 'atonement-live',
    type: 'live',
    title: '赎罪',
    eyebrow: 'LIVE ACTION / 01',
    parameters: ['SONY A7M4', 'S-Log3 · S-Gamut3.Cine'],
    video: '',
  },
  {
    id: 'atonement-ai',
    type: 'ai',
    title: '赎罪',
    eyebrow: 'AI FILM / 02',
    parameters: ['IMAGE TO VIDEO', '参考画面 · AI 创作'],
    video: '',
  },
];

// 每个节点可加 src: 'assets/ref.jpg' 或 video: 'assets/ref.mp4'；留空使用图集示意。
export const referenceFrames = [
  { side: 'left', x: -0.045, y: 0.33, tilt: -14, name: '氛围参考' },
  { side: 'left', x: 0.065, y: 0.46, tilt: 7, name: '构图参考' },
  { side: 'left', x: -0.02, y: 0.62, tilt: -13, name: '人物参考' },
  { side: 'left', x: 0.045, y: 0.73, tilt: 0, name: '光影参考' },
  { side: 'left', x: 0.025, y: 0.88, tilt: -12, name: '起始画面' },
  { side: 'left', x: -0.065, y: 1.01, tilt: 12, name: '色彩参考' },
  { side: 'right', x: 0.905, y: 0.1, tilt: 15, name: '环境参考' },
  { side: 'right', x: 0.82, y: 0.23, tilt: -8, name: '镜头参考' },
  { side: 'right', x: 0.915, y: 0.39, tilt: 14, name: '动作参考' },
  { side: 'right', x: 0.825, y: 0.51, tilt: 0, name: '景深参考' },
  { side: 'right', x: 0.86, y: 0.66, tilt: 12, name: '结尾画面' },
  { side: 'right', x: 0.935, y: 0.84, tilt: -15, name: '空间参考' },
];
