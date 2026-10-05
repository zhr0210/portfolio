// 在这里修改作品、标题、参数和滑动行程。真实视频填写 video 路径。
export const reelConfig = {
  wheelTravel: 2100,
  smoothing: 0.19,
  // 恢复原版中等尺寸：展示区占窗口高度的 40%，窄屏到达安全边距时居中裁切。
  videoHeight: 0.4,
  videoEdge: 24,
  mobileVideoEdge: 16,
  minimumVerticalMargin: 76,
  // 两部视频之间的空隙稍加长：窗口高度的 30%，短屏至少 170px。
  sceneGap: 0.3,
  minimumSceneGap: 170,
  titleParallax: 0.1,
  metadataParallax: 0.08,
  referenceParallax: 0.78,
  referenceWidth: 0.22,
  // 参考构图宽高比。缩窄窗口时保留节点分布，超出窗口的部分自然裁切。
  referenceCanvasAspect: 1.28,
  mobileReferenceCanvasAspect: 0.46,
  referenceOpacity: 0.82,
  // 第一部影片可以向上回看完整入场；首次约对应 Blender 第 54 帧。
  initialPosition: -0.22,
  minimumPosition: -0.9,
  // 1.8 段滚动完成一圈；设备使用独立、无边界的可逆滚动进度。
  deviceAnimation: { start: -0.9, end: 0.9 },
  deviceLayer: {
    cameraName: 'sourceCamera',
    sourceAspect: 16 / 9,
    referenceVideoHeight: 0.4,
    size: 1.12,
    desktopSize: 0.72,
    verticalFovScale: 1,
    offsetX: 0,
    offsetY: 0,
    compositionAspect: 16 / 9,
    desktopComposition: {
      sony: { sourceX: 0.09, sourceY: 0.5, targetX: 0.17, targetY: 0.5 },
      pocket: { sourceX: 0.89, sourceY: 0.5, targetX: 0.84, targetY: 0.5 },
    },
    loopPhases: { sony: 0.12, pocket: -0.04 },
    animationRanges: { sony: [0, 4.5], pocket: [1.5, 6] },
    // 手机用同一画布的两次投影，把设备移至上下，保持原动画轨迹和错峰。
    mobileSize: 0.48,
    mobileComposition: {
      sony: { sourceX: 0.09, sourceY: 0.5, targetX: 0.5, targetY: 0.2, verticalBias: -0.28 },
      pocket: { sourceX: 0.89, sourceY: 0.5, targetX: 0.5, targetY: 0.77, verticalBias: 0.25 },
    },
    environmentIntensity: 0.12,
    ambientIntensity: 0.55,
    keyIntensity: 1.45,
    fillIntensity: 0.7,
    softboxIntensity: 0.75,
    exposure: 0.94,
    maxPixelRatio: 1.5,
    mobileMaxPixelRatio: 1,
    reducedProgress: 0.375,
  },
};

// 用原始参考图作为共享图集，CSS 裁切，不改动用户原图。
export const sheet = {
  src: new URL('./assets/vertical-film-sheet.jpg', import.meta.url).href,
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

// scale 调整大小，opacity 调整透明度；x/y 是桌面构图坐标，不是窗口边距。
// 每个节点可加 src: 'assets/ref.jpg' 或 video: 'assets/ref.mp4'；留空使用图集示意。
export const referenceFrames = [
  {
    side: 'left',
    x: -0.06,
    y: 0.15,
    tilt: -14,
    scale: 0.88,
    opacity: 0.8,
    name: '氛围参考',
  },
  {
    side: 'left',
    x: 0.045,
    y: 0.3,
    tilt: 7,
    scale: 1.08,
    opacity: 0.96,
    name: '构图参考',
  },
  {
    side: 'left',
    x: -0.045,
    y: 0.45,
    tilt: -13,
    scale: 0.94,
    opacity: 0.76,
    name: '人物参考',
  },
  {
    side: 'left',
    x: 0.025,
    y: 0.57,
    tilt: 0,
    scale: 1.15,
    opacity: 0.9,
    name: '光影参考',
  },
  {
    side: 'left',
    x: 0.015,
    y: 0.72,
    tilt: -12,
    scale: 0.84,
    opacity: 0.72,
    name: '起始画面',
  },
  {
    side: 'left',
    x: -0.07,
    y: 0.83,
    tilt: 12,
    scale: 1.02,
    opacity: 0.86,
    name: '色彩参考',
  },
  {
    side: 'right',
    x: 0.91,
    y: 0.1,
    tilt: 15,
    scale: 0.92,
    opacity: 0.74,
    name: '环境参考',
  },
  {
    side: 'right',
    x: 0.815,
    y: 0.24,
    tilt: -8,
    scale: 1.12,
    opacity: 0.94,
    name: '镜头参考',
  },
  {
    side: 'right',
    x: 0.915,
    y: 0.39,
    tilt: 14,
    scale: 0.83,
    opacity: 0.78,
    name: '动作参考',
  },
  {
    side: 'right',
    x: 0.835,
    y: 0.5,
    tilt: 0,
    scale: 1.04,
    opacity: 1,
    name: '景深参考',
  },
  {
    side: 'right',
    x: 0.86,
    y: 0.66,
    tilt: 12,
    scale: 0.95,
    opacity: 0.82,
    name: '结尾画面',
  },
  {
    side: 'right',
    x: 0.94,
    y: 0.8,
    tilt: -15,
    scale: 1.1,
    opacity: 0.7,
    name: '空间参考',
  },
];
