# 纵向视频展示实验页

黑色背景的纵向视频展示，先展示实拍，再展示 AI 视频。2026-10-05 接入用户 Blender 文件中已完成的相机与 Pocket 动画。独立于 React 主站，不参与 `dist/` 构建。

在仓库根目录运行：

```powershell
npm run dev:video
```

浏览 `http://127.0.0.1:4184/experiments/ai-video/ai-video.html`。

本机 4184 预览保留 `/prototype-directions/ai-video.html` 路径。菜单中的“返回作品集”打开 4173 主站；需要同时运行 `npm run dev`。实验使用 Vite 解析 Three.js 的 npm 模块，不能再直接用 Python 服务源码。

独立打包运行 `npm run build:video`，结果在 `dist-experiments/`；运行 `npm run preview:video` 可验证打包后的页面和资源。实验配置关闭 `publicDir`，不复制主站作品素材。主站仍只发布 `dist/`。

- 实拍采用一个透明 Three.js 画布，在中央视频下方显示相机与 Pocket。两台设备沿 Blender 原轨迹错峰上移、旋转，Pocket 保留云台与镜头动作；没有额外叠加 DOM 上移。桌面保持原透视镜头、按视频高度缩放，窄窗口自然裁切。手机采用同一画布的上下两次投影适配设备位置，保留原始模型变换与动作。静态设备仅用于加载中或 WebGL / 模型加载失败时的兼容画面。
- 视频恢复中等尺寸，展示区占窗口高度的 40%，宽度达到桌面 24px／手机 16px 安全边距时只限制宽度，画面保持原始比例并居中裁切；短屏为标题和参数保留最小上下空间。参考画面和相机随视频高度缩放，窄桌面允许重叠，视频处于参考画面上层并遮挡节点。手机竖屏将两组参考画面改为上下错落排列，连线转向视频的上、下边缘。画面上下的暗角帮助文字和菜单保持清晰。
- 每张参考画面保留独立大小、透明度和倾角。上一部视频退出时，参考画面渐显、向上移动，中央视频恢复普通渐显上移入场；退出时一起上移、渐隐。所有位置与透明度由同一滚动进度决定，反向滚动保持连续。
- 参考节点以视频中心为构图基准，横向跨度随视频高度缩放。缩窄窗口时，节点保留相对位置和大小，允许移到画面外并自然裁切；手机上下两组也遵循同样规则。
- 视频进入画面后逐渐连接参考画面，保留半透明灰色连线、渐变流光和柔和辉光。节点内部画面、视频、标题与参数保留视差。视频到达中心附近后开始播放，退出时暂停。
- 相邻视频的空隙比上一轮稍加长，设为窗口高度的 30%，短屏至少 170px；不同影片共享行程，避免相互穿过。
- 视频标题位于左上方，参数位于右下方。二者随视频移动，使用独立速度产生视差，并始终留在画面外侧。
- 鼠标滚轮缓动、上下方向键、Page Up / Down、Home / End、触屏纵向拖动均可浏览；MENU 可直接切换作品。反向输入立即取消原方向的等待距离。停止后结束逐帧计算，后台暂停播放与流光。
- 设备共用 0–144 帧、24 fps、6 秒动画，以已经缓动的滚动位置直接采样，停止滚动就停止三维绘制。相对实拍作品的进度 −0.9 到 +0.9 映射完整动画，首次 −0.22 约对应第 54 帧，向上可回看完整入场。反向从末帧也能恢复同一姿态，没有自动循环或第二套缓动。减少动态模式显示固定设备姿态。
- 当前两种布局共享设计图中的同一帧示意画面，未接入真实影片。MENU 可载入当前作品的本地视频，居中静音播放，退出暂停；素材不会上传。系统要求减少动态时，取消吸附和缓动。

## 修改参数与内容

编辑 `video-reel.config.js`：`reelWorks` 配置标题、类型、视频路径和参数；`referenceFrames` 的 `scale`、`opacity` 分别控制大小和透明度，`x/y` 是桌面构图坐标；`reelConfig` 的 `referenceCanvasAspect`、`mobileReferenceCanvasAspect` 控制桌面／手机参考构图跨度，其他字段配置视频高度、极限边距、场景间隔、参考图比例、缓动和视差强度。自定义图片／视频路径建议在此文件使用字面量 `new URL('./assets/filename.ext', import.meta.url).href`，确保 Vite 将资源打包。

设备调参也集中在 `reelConfig`：

| 参数 | 作用 |
| --- | --- |
| `deviceAnimation.start/end` | 完整设备动画对应的滚动区间；保持 start 小于 end |
| `initialPosition/minimumPosition` | 第一次打开的画面及向上回看的边界 |
| `deviceLayer.size` | 两台设备统一大小，1 为当前值 |
| `deviceLayer.desktopSize` | 桌面额外大小系数，缩小原镜头构图以适应中央视频 |
| `deviceLayer.offsetX/offsetY` | 构图水平／垂直偏移，以虚拟画布高度为单位 |
| `deviceLayer.mobileSize` | 手机额外大小系数 |
| `deviceLayer.mobileComposition` | Sony／Pocket 源构图锚点及手机目标位置，0–1 为画幅比例 |
| `deviceLayer.environmentIntensity` | 环境反射亮度 |
| `deviceLayer.keyIntensity/fillIntensity/softboxIntensity` | 主光、辅光和柔光亮度 |
| `deviceLayer.exposure` | 三维曝光，不改变视频亮度 |
| `deviceLayer.maxPixelRatio/mobileMaxPixelRatio` | 桌面／手机渲染清晰度上限 |
| `deviceLayer.reducedProgress` | 减少动态时固定姿态的时间轴位置 |

`video-reel.css` 管理字体、层级与菜单样式；`reel-motion.js` 管理共享几何和渐显时序；`video-reel.js` 管理输入和媒体生命周期；`device-layer.js` 负责三维加载、绝对动画采样与资源释放，`device-motion.js` 负责投影和时间映射。Three.js 与加载器首次看到实拍作品才加载，AI 版式复用既有设计。离开／销毁时释放模型、纹理、环境、动画与 WebGL 资源，晚到的异步结果不会重新挂载。

## Blender 资产

`assets/capture-devices.glb` 约 4.5 MB，172 个网格、约 11 万三角面、单一共同动画。相机源模型为 Sony A7RM3，Pocket 为 Osmo Pocket 3；影片拍摄参数仍来自 `reelWorks`，不自动用模型名称覆盖。贴图最高 1024px，使用内嵌 WebP，未减面。仅包含 `z轴移动` 与 `空物体` 完整子树和原 35 mm 透视相机；排除未完成无人机、Pocket 未绑定的静态残留及 AREA 灯。

原 `.blend` 留在用户提供的位置且不被覆盖。导出在独立后台 Blender 进程完成，保留当前编辑器的未保存修改。材质保留取景器／LED 的颜色乘法、高光、法线和屏幕 UV；网页重新设置环境和柔光，光照与 Blender AREA 灯有所区别。导出记录在 `assets/capture-devices.metadata.json`，可重现方式见 [tools/README.md](tools/README.md)。

使用 Three.js `GLTFLoader` 和 `AnimationMixer`，无需迁移主站 React＋Vite。参考 Oryzo 的 Astro＋Three.js 路线；其公开代码可确认三维渲染器，不能据此认定其模型格式或滚动动画与本项目一致。未来并入 React 主站时可用 React Three Fiber 9 封装，但不会自动提高视觉质量。

- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
- [Blender glTF 导出](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- [Oryzo](https://oryzo.ai/) / [Lusion 官方案例](https://lusion.co/projects/oryzo_ai/)

用户的实拍设计图作为一张共享图集保存为 `assets/vertical-film-sheet.jpg`。网页通过 CSS 裁切中央画面和两台相机，保持原始文件不变，避免重复保存多份素材。AI 设计图只用于布局参照。

`npm test` 包含视频间距、中等尺寸、按高度缩放、窄屏重叠、手机上下分组、渐显和进退连续性的检查。上一版纵向设计副本保存在 `G:\zuopingji\Portfolio-before-tv-reveal-20261001`，也可通过 Git 提交 `abe9148` 恢复。撤回的电视开机版本保存在 `G:\zuopingji\Portfolio-tv-reference-20261001`。旧横向设计副本仍在 `G:\zuopingji\Portfolio-before-vertical-video-20260930`。
