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
  // AI 生成段独立于实拍时间轴。比例决定画面阶段，停止滚动即停止计算。
  aiGeneration: {
    scrollSpan: 1.4,
    seed: 2917,
    stages: { gather: 0.28, white: 0.32, scan: 0.5, split: 0.65, denoise: 0.96 },
    fontSize: 12,
    mobileFontSize: 10,
    subdivisionLevels: 4,
    noiseStrength: 0.9,
    referenceSpread: 1.65,
    mobileReferenceSpread: 0.62,
    referenceScale: 0.22,
    referenceOpacity: 0.7,
    // 提前从下方上移入场；不同深度的图片有不同移动速度，图片内部也有视差。
    referenceEntrySpan: 0.65,
    referenceEntryTravel: 1.45,
    referenceImageParallax: 0.07,
    referenceOverscan: 1.22,
    // 固定种子迭代：每步修正上一帧，先收敛低频结构，再恢复细节。
    denoiseSteps: 50,
    solverWidth: 384,
    solverMobileWidth: 256,
    solverWarp: 0.2,
    solverNoise: 0.36,
    denoiseBlur: 6.5,
    denoiseWarp: 0.07,
    sequenceFlowStrength: 1,
    sequenceRegionLag: 2,
    maxPixelRatio: 1.5,
    mobileMaxPixelRatio: 1,
  },
  // 第一部影片可以向上回看完整入场；保留原来的首次打开位置。
  initialPosition: -0.22,
  minimumPosition: -0.9,
  // 两台设备只在第一部影片的固定区间进出场，停止滚动后停帧。
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
    entryOffsets: { sony: 0.12, pocket: -0.04 },
    // Sony 0–216 帧，Pocket 保留 36 帧错峰并延长至 252 帧；完整采样一次。
    animationRanges: { sony: [0, 9], pocket: [1.5, 10.5] },
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
    // 对照 Blender 预览校准网页亮度；保留原面光的尺寸、方向和功率比例。
    pocketLighting: { powerScale: 0.04, exposure: 1 },
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
    // 13 张生图加原封面共 14 个关键状态：锐利无序碎纹理逐步形成精细材质。
    // 光流对齐并保留纹理能量，补成 0–50 共 51 帧；原图高频只在 48–50 步恢复。
    // 原封面作为最后一帧，载入其他本地视频时自动改用封面求解器。
    generationSequence: {
      atlas: new URL('./assets/atonement-generation-50-v4.png', import.meta.url).href,
      columns: 8,
      rows: 7,
      steps: Array.from({ length: 51 }, (_, i) => i),
      posterFrame: 50,
      mode: 'baked',
      detailStart: 48,
    },
  },
];

// 依次汇聚的参考图：scale / opacity / tilt 控制大小、透明度和倾角。
// 可填写 src（或视频的 poster）；留空使用示意图。scatter: { x, y } 可覆盖种子分布，坐标以画面中心为原点。
export const referenceFrames = [
  {
    tilt: -14,
    scale: 0.88,
    opacity: 0.8,
    name: '氛围参考',
  },
  {
    tilt: 7,
    scale: 1.08,
    opacity: 0.96,
    name: '构图参考',
  },
  {
    tilt: -13,
    scale: 0.94,
    opacity: 0.76,
    name: '人物参考',
  },
  {
    tilt: 0,
    scale: 1.15,
    opacity: 0.9,
    name: '光影参考',
  },
  {
    tilt: -12,
    scale: 0.84,
    opacity: 0.72,
    name: '起始画面',
  },
  {
    tilt: 12,
    scale: 1.02,
    opacity: 0.86,
    name: '色彩参考',
  },
  {
    tilt: 15,
    scale: 0.92,
    opacity: 0.74,
    name: '环境参考',
  },
  {
    tilt: -8,
    scale: 1.12,
    opacity: 0.94,
    name: '镜头参考',
  },
  {
    tilt: 14,
    scale: 0.83,
    opacity: 0.78,
    name: '动作参考',
  },
  {
    tilt: 0,
    scale: 1.04,
    opacity: 1,
    name: '景深参考',
  },
  {
    tilt: 12,
    scale: 0.95,
    opacity: 0.82,
    name: '结尾画面',
  },
  {
    tilt: -15,
    scale: 1.1,
    opacity: 0.7,
    name: '空间参考',
  },
];
