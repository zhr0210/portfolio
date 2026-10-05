# 纵向视频展示实验页

黑色背景的纵向视频展示，先展示实拍，再展示 AI 视频。2026-10-05 接入用户 Blender 文件中已完成的相机与 Pocket 动画。独立于 React 主站，不参与 `dist/` 构建。

在仓库根目录运行：

```powershell
npm run dev:video
```

浏览 `http://127.0.0.1:4184/experiments/ai-video/ai-video.html`。

本机 4184 预览保留 `/prototype-directions/ai-video.html` 路径。菜单中的“返回作品集”打开 4173 主站；需要同时运行 `npm run dev`。实验使用 Vite 解析 Three.js 的 npm 模块，不能再直接用 Python 服务源码。

独立打包运行 `npm run build:video`，结果在 `dist-experiments/`；运行 `npm run preview:video` 可验证打包后的页面和资源。实验配置关闭 `publicDir`，不复制主站作品素材。主站仍只发布 `dist/`。

- 相机与 Pocket 使用一个独立的透明 Three.js 背景画布，始终位于视频和参考节点下方。两台设备只在第一部实拍视频的固定区间各进入、退出一次，滚出顶部后不会重新出现在后续影片或空白画面；反向滚动可以回看。设备从下向上移动，不使用透明度渐隐，只有 XYZ 三轴旋转随滚动循环。云台和镜头动作按原时间轴播放一次。桌面双投影把设备放在 16:9 构图的左右两侧，设备比上一版放大 12%；窄窗口保持构图并允许自然裁切。手机同一画布上下错峰展示，不重置旋转姿态。静态设备仅用于加载中或 WebGL / 模型加载失败时的兼容画面，也遵循固定的进出场区间。
- 视频恢复中等尺寸，展示区占窗口高度的 40%，宽度达到桌面 24px／手机 16px 安全边距时只限制宽度，画面保持原始比例并居中裁切；短屏为标题和参数保留最小上下空间。参考画面和相机随视频高度缩放，窄桌面允许重叠，视频处于参考画面上层并遮挡节点。手机竖屏将两组参考画面改为上下错落排列，连线转向视频的上、下边缘。画面上下的暗角帮助文字和菜单保持清晰。
- 每张参考画面保留独立大小、透明度和倾角。上一部视频退出时，参考画面渐显、向上移动，中央视频恢复普通渐显上移入场；退出时一起上移、渐隐。所有位置与透明度由同一滚动进度决定，反向滚动保持连续。
- 参考节点以视频中心为构图基准，横向跨度随视频高度缩放。缩窄窗口时，节点保留相对位置和大小，允许移到画面外并自然裁切；手机上下两组也遵循同样规则。
- 视频进入画面后逐渐连接参考画面，保留半透明灰色连线、渐变流光和柔和辉光。节点内部画面、视频、标题与参数保留视差。视频到达中心附近后开始播放，退出时暂停。
- 相邻视频的空隙比上一轮稍加长，设为窗口高度的 30%，短屏至少 170px；不同影片共享行程，避免相互穿过。
- 视频标题位于左上方，参数位于右下方。二者随视频移动，使用独立速度产生视差，并始终留在画面外侧。
- 鼠标滚轮缓动、上下方向键、Page Up / Down、Home / End、触屏纵向拖动均可浏览；MENU 可直接切换作品。反向输入立即取消原方向的等待距离。停止后结束逐帧计算，后台暂停播放与流光。
- GLB 保留 0–144 帧、24 fps 的原始完整动画。网页分别取 Sony 0–108 帧和 Pocket 36–144 帧的 XYZ 旋转轨迹，补充 0.75 秒的平滑回转使首尾姿态一致，再随滚动循环采样；不修改 GLB 的原始关键帧。纵向行程和云台动画使用各自的有限进度，两台设备保持固定错峰。滚动到首部或末部后停止，设备不会延伸网页行程。停止滚动就停止三维绘制，不自动播放；后台暂停。加载时采样完整行程中的组合姿态及平滑回转，测量投影包围范围，完整滚出视口后结束展示。减少动态模式固定姿态，并在视频区间之外隐藏设备。
- Pocket 使用用户保存的 Blender 场景中的两盏 AREA 灯，保留它们相对设备的位置、朝向、尺寸、颜色和功率比例，以及原 AgX 曝光。灯光随原平移父级移动，保持上、下光的明暗关系；该设备不使用均匀环境补光或额外的工作室灯。Sony 保留当前工作室灯光。网页使用 Three.js 面光源重建该灯组，实时渲染与 Blender 的离线渲染器仍有差异；`pocketLighting.powerScale` 统一校准网页亮度，当前为 0.04，不改变两盏灯的相对关系。
- 当前两种布局共享设计图中的同一帧示意画面，未接入真实影片。MENU 可载入当前作品的本地视频，居中静音播放，退出暂停；素材不会上传。系统要求减少动态时，取消吸附和缓动。

## 修改参数与内容

编辑 `video-reel.config.js`：`reelWorks` 配置标题、类型、视频路径和参数；`referenceFrames` 的 `scale`、`opacity` 分别控制大小和透明度，`x/y` 是桌面构图坐标；`reelConfig` 的 `referenceCanvasAspect`、`mobileReferenceCanvasAspect` 控制桌面／手机参考构图跨度，其他字段配置视频高度、极限边距、场景间隔、参考图比例、缓动和视差强度。自定义图片／视频路径建议在此文件使用字面量 `new URL('./assets/filename.ext', import.meta.url).href`，确保 Vite 将资源打包。

设备调参也集中在 `reelConfig`：

| 参数                                                      | 作用                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| `deviceAnimation.start/end`                               | 第一部实拍视频中设备进出场的固定滚动区间，保持 start 小于 end         |
| `initialPosition/minimumPosition`                         | 第一次打开的画面及向上回看的边界                                      |
| `deviceLayer.size`                                        | 两台设备统一大小，当前 1.12，比上一版放大 12%                         |
| `deviceLayer.desktopSize`                                 | 桌面额外大小系数，缩小原镜头构图以适应中央视频                        |
| `deviceLayer.offsetX/offsetY`                             | 构图水平／垂直偏移，以虚拟画布高度为单位                              |
| `deviceLayer.mobileSize`                                  | 手机额外大小系数                                                      |
| `deviceLayer.compositionAspect/desktopComposition`        | 桌面构图基准与左右目标位置；窄窗裁切，设备不会向中心挤                |
| `deviceLayer.mobileComposition`                           | 手机水平锚点、减少动态时上下位置；verticalBias 调整行程中段的上下错峰 |
| `deviceLayer.entryOffsets`                                | 两台设备固定进出场进度的偏移量，控制错峰                              |
| `deviceLayer.rotationPeriod`                              | XYZ 旋转循环所占的进出场进度，当前 0.5                                |
| `deviceLayer.rotationReturnDuration`                      | XYZ 原旋转终点平滑回到起点的补充时长，当前 0.75 秒                    |
| `deviceLayer.animationRanges`                             | 各设备使用的原始旋转和云台动画有效时间段（秒）                        |
| `deviceLayer.environmentIntensity`                        | Sony 环境反射亮度                                                     |
| `deviceLayer.ambientIntensity`                            | Sony 中性漫反射补光亮度                                               |
| `deviceLayer.keyIntensity/fillIntensity/softboxIntensity` | Sony 主光、辅光和柔光亮度                                             |
| `deviceLayer.exposure`                                    | Sony 三维曝光，不改变视频亮度                                         |
| `deviceLayer.pocketLighting.powerScale/exposure`          | Pocket 原 Blender 面光亮度校准系数／曝光，当前为 0.04／1              |
| `deviceLayer.maxPixelRatio/mobileMaxPixelRatio`           | 桌面／手机渲染清晰度上限                                              |
| `deviceLayer.reducedProgress`                             | 减少动态时固定姿态的时间轴位置                                        |

`video-reel.css` 管理字体、层级与菜单样式；`reel-motion.js` 管理影片几何和渐显时序；`video-reel.js` 管理统一滚动输入、设备固定区间和媒体生命周期；`device-layer.js` 负责三维加载、有限动画与循环旋转的绝对采样、分设备灯光和资源释放；`device-motion.js` 负责投影、有限位置与旋转进度；`device-animation.js` 为 XYZ 旋转补充平滑回转；`device-lighting.js` 重建 Pocket 的 Blender 面光。Three.js 与加载器首次激活实验页才加载，AI 版式复用既有设计。离开／销毁时释放模型、纹理、环境、动画与 WebGL 资源，晚到的异步结果不会重新挂载。

## Blender 资产

`assets/capture-devices.glb` 约 50.08 MB（50,079,276 字节），172 个网格、约 11 万三角面、单一共同动画。相机源模型为 Sony A7RM3，Pocket 为 Osmo Pocket 3；影片拍摄参数仍来自 `reelWorks`，不自动用模型名称覆盖。按用户要求保留原始贴图分辨率：Sony 主体／镜筒为 4096px，Pocket 为 2048px，小型光学／指示灯贴图保持原有 128px。全部内嵌无损 PNG，不降采样、不使用有损 WebP，也未减面。高分辨率贴图增加下载体积和显存需求；网页给贴图设置硬件支持范围内最高 8 倍各向异性过滤，改善斜面清晰度。仅包含 `z轴移动` 与 `空物体` 完整子树和原 35 mm 透视相机；排除未完成无人机、Pocket 未绑定的静态残留及 AREA 灯。面光不打包进 GLB；Pocket 的原场景灯光记录保存在 `device-lighting.js` 并由运行时重建。

原 `.blend` 留在用户提供的位置且不被覆盖；参考 `bin-render-04.webp` 修复的完整场景另存为 Downloads 中的 `camera 无人机-pocket3-reference.blend`，不进入网站包或 Git。Sony 哑光处理保持原样。Pocket 的 110 个网格重新按实际零件绑定材质：石墨灰塑料、灰色防滑板、缎光云台、电机盖、镜头框、真实镜片照片、透明保护窗、黑色屏幕、橡胶摇杆、细橙色快门环、绿色状态灯和暗色接口。背面 DJI 印刷使用现有文字面的浅色材质，不新增几何。修复镜片 `.001` UV 选择和法线贴图的 Non-Color 设置；仅在复制网格上删除损坏的 `custom_normal` 属性，保留几何、原 UV、平滑边、层级、变换及动画。原尺寸颜色图保留 OSMO / POCKET 3 字样，镜片与快门使用原颜色图。导出在独立后台 Blender 进程完成，保留当前编辑器的未保存修改与无人机原场景。导出记录在 `assets/capture-devices.metadata.json`，分零件参数及可重现方式见 [tools/README.md](tools/README.md)。

使用 Three.js `GLTFLoader` 和 `AnimationMixer`，无需迁移主站 React＋Vite。参考 Oryzo 的 Astro＋Three.js 路线；其公开代码可确认三维渲染器，不能据此认定其模型格式或滚动动画与本项目一致。未来并入 React 主站时可用 React Three Fiber 9 封装，但不会自动提高视觉质量。

- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
- [Blender glTF 导出](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- [Oryzo](https://oryzo.ai/) / [Lusion 官方案例](https://lusion.co/projects/oryzo_ai/)

用户的实拍设计图作为一张共享图集保存为 `assets/vertical-film-sheet.jpg`。网页通过 CSS 裁切中央画面和两台相机，保持原始文件不变，避免重复保存多份素材。AI 设计图只用于布局参照。

`npm test` 包含视频间距、中等尺寸、按高度缩放、窄屏重叠、手机上下分组、渐显和进退连续性的检查。上一版纵向设计副本保存在 `G:\zuopingji\Portfolio-before-tv-reveal-20261001`，也可通过 Git 提交 `abe9148` 恢复。撤回的电视开机版本保存在 `G:\zuopingji\Portfolio-tv-reference-20261001`。旧横向设计副本仍在 `G:\zuopingji\Portfolio-before-vertical-video-20260930`。
