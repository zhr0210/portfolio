# 纵向视频展示实验页

黑色背景的纵向视频展示，先展示实拍与 Blender 设备动画，再通过参考图汇聚、字符计算、去噪成像呈现 AI 视频。独立于 React 主站，不参与 `dist/` 构建。

在仓库根目录运行：

```powershell
npm run dev:video
```

浏览 `http://127.0.0.1:4184/experiments/ai-video/ai-video.html`。

本机 4184 预览保留 `/prototype-directions/ai-video.html` 路径。菜单中的“返回作品集”打开 4173 主站；需要同时运行 `npm run dev`。实验使用独立的 Vite 缓存 `node_modules/.vite-ai-video`，避免与主站同时启动时互相覆盖依赖预构建结果。实验使用 Vite 解析 Three.js 的 npm 模块，不能再直接用 Python 服务源码。

独立打包运行 `npm run build:video`，结果在 `dist-experiments/`；运行 `npm run preview:video` 可验证打包后的页面和资源。实验配置关闭 `publicDir`，不复制主站作品素材。主站仍只发布 `dist/`。

- 相机与 Pocket 使用一个独立的透明 Three.js 背景画布，始终位于视频和参考节点下方。两台设备只在第一部实拍视频的固定区间各进入、退出一次，滚出顶部后不会重新出现在后续影片或空白画面；反向滚动可以回看。设备从下向上移动，不使用透明度渐隐，完整的旋转动画随滚动播放一次。云台和镜头动作按原时间轴播放一次。桌面双投影把设备放在 16:9 构图的左右两侧，设备大小系数保持 1.12；窄窗口保持构图并允许自然裁切。手机同一画布上下错峰展示，不重置旋转姿态。静态设备仅用于加载中或 WebGL / 模型加载失败时的兼容画面，也遵循固定的进出场区间。
- 视频保持中等尺寸，展示区占窗口高度的 40%，宽度达到桌面 24px／手机 16px 安全边距时只限制宽度，保持原比例并居中裁切。实拍与设备的尺寸、灯光、动画采样和进出场区间保持 rev=16。实拍画面、标题与参数保持不透明，随滚动上移出画面；参数的视差速度较慢，全部内容移出后才隐藏场景。画面上下的暗角帮助文字和菜单保持清晰。
- AI 参考图在实拍退出时从窗口下方上移进入四周构图，大小、倾角与透明度各异，入场不渐显。每张图用不同深度速度移动，图片内部裁切也随滚动位移，形成视差。到达生成起点后按次序向中央移动、放大、对齐并叠加增亮。28% 汇聚为纯白矩形，28–32% 保留白色；32–50% 从左上角逐字符、逐行扫描，留下铺满矩形的透明底浅色代码，保留正常词间空格；50–65% 每个字符逐级分裂成更小的子字符，最后演变为黑白噪点；65–96% 由清晰、密集的无序碎纹理逐步组织成人物、头发、衣料与树叶；不再添加失焦模糊；96–100% 保持清晰封面并衔接视频。所有百分比都是艺术动画的滚动进度，不代表真实加载或 AI 推理。
- 生成矩形沿用视频尺寸并保持居中。桌面参考图以视频高度为构图基准，缩窄窗口时允许自然裁切；手机以错落的上下两组为主。途中改变窗口尺寸只重算布局，不重置进度。原左右节点与流光连线已经移除。
- 去噪序列共 51 帧（索引 0–50），着色器饱和度倍率随这一段的绝对滚动进度从 0 线性增加到 1：首帧黑白，末帧原色。反向滚动按同一进度还原；应用于内置图集、Worker 和无图集兼容画面，保持原素材、细纹理及最终封面不变。
- AI 使用独立透明 Three.js／GLSL 画布，不继承模型灯光或色调映射。默认采用 13 张 image_gen 关键图加原封面，共 14 个关键状态，参考用户提供的狐狸逐步生成图，只借鉴清晰碎纹理逐步形成精细结构的过程。离线通过双向光流对齐、三次重采样和局部细纹理能量补偿，补成 0–50 共 51 张固定画面，打包为 4096×1932 的无损 PNG 图集，约 19.35 MB。补帧从关键图自身提取纹理，不添加成品照片上的静态噪声蒙层，不做失焦滤镜；原封面自身的镜头效果保留。每张整数步骤都是已导出的独立像素状态；运行时只平滑采样相邻的一步，不再叠加旧序列的残余噪声、区域延迟或第二次形变。后期仅补回原封面的高频细节，末态直接使用原封面。图片汇聚、字符更新与画面采样仍只由进度计算，同进度倒放一致，停止后不绘制。这是生图制作的艺术模拟，不是 50 次独立生图、RF 反演或 FLUX 的实际推理记录。模型权重不下载到网页，也不加入仓库。素材来源、完整提示词、51 帧像素校验值和加工方式见 [素材记录](assets/atonement-generation-50-v4.metadata.json)。旧 9 图示例保留供追溯；前一版代码 Worker 作为载入其他视频或图集失败时的兼容路径，见 [调研记录](../../docs/AI_DENOISE_RESEARCH.md)。
- 实拍保留原滚动坐标。AI 参考图从 0.35 提前开始上移，生成从 1.0 开始，占 1.4 单位，完成于 2.4，桌面累计滚轮输入约 2940px。生成阶段不自动吸附。MENU 的 AI 入口定位生成起点，End 抵达清晰完成态，Home 返回实拍。AI 标题与参数在最后阶段渐显并保留视差。
- 视频标题位于左上方，参数位于右下方。二者随视频移动，使用独立速度产生视差，并始终留在画面外侧。
- 鼠标滚轮缓动、上下方向键、Page Up / Down、Home / End、触屏纵向拖动均可浏览。反向输入立即取消原方向的等待距离。停止后结束逐帧计算；后台暂停媒体与渲染。减少动态或 WebGL 不可用时，AI 显示静态封面，视频仍可播放。
- GLB 为 0–252 帧、24 fps 的完整动画。Sony 主控制器从原 0–108 帧延长至 216 帧，Pocket 从 36–144 帧延长至 252 帧，有效时长均为 9 秒。新增段保持末段 X、Z 递减、Y 递增的旋转方向，以累计整圈的 Euler 角结束于初始朝向。保留原关键姿态，调整旧尾帧的切线连接惯性，并计算新的中段与尾段曲线，最后减速停稳。升降父级行程加倍，距离和 Pocket 的 36 帧延迟不变；云台曲线原样保留。网页只绝对采样对应的完整区间。滚动到首部或末部后停止，设备不会延伸网页行程。停止滚动就停止三维绘制，不自动播放；后台暂停。加载时采样完整行程的组合姿态，测量投影包围范围，完整滚出视口后结束展示。减少动态模式固定姿态，并在视频区间之外隐藏设备。
- Pocket 使用用户保存的 Blender 场景中的两盏 AREA 灯，保留它们相对设备的位置、朝向、尺寸、颜色和功率比例，以及原 AgX 曝光。灯光随原平移父级移动，保持上、下光的明暗关系；该设备不使用均匀环境补光或额外的工作室灯。Sony 保留当前工作室灯光。网页使用 Three.js 面光源重建该灯组，实时渲染与 Blender 的离线渲染器仍有差异；`pocketLighting.powerScale` 统一校准网页亮度，当前为 0.04，不改变两盏灯的相对关系。
- 当前沿用同一设计图中的 12 张示意参考与封面，未接入真实影片。AI 视频只在生成完成后静音播放；回滑立即隐藏、暂停并回到第一帧，以固定封面逆向还原。MENU 可载入当前作品的本地视频，不上传；AI 自动提取原尺寸无损 PNG 首帧作为封面，避免完成时切换至不相关画面。

## 修改参数与内容

编辑 `video-reel.config.js`：`reelWorks` 配置标题、类型、视频路径和参数；每个 AI 作品可选 `poster`、`references` 与 `generationSequence`。当前作品配置 51 帧生图图集，`mode: 'baked'` 要求 `steps` 连续为 0…50，最后的 `posterFrame` 为 50；网格为 8 列、7 行。未指定 mode 的旧序列仍走可选 `flowAtlas` 路径，两种序列均最多 64 帧。也可导入 ComfyUI / Diffusers 的真实步骤，但须在素材记录中区别来源。载入本地视频时取消内置序列，提取该视频的无损首帧，用 Worker 重新计算 50 次艺术重构，防止旧素材串片。参考图的 `src / poster`、`scale / opacity / tilt` 与 `scatter: { x, y }` 可按作品配置。资源用字面量 `new URL('./assets/filename.ext', import.meta.url).href`，以便 Vite 打包。

AI 调参集中在 `reelConfig.aiGeneration`：`scrollSpan` 与 `stages` 控制行程和阶段边界；`seed`、`fontSize / mobileFontSize`、`subdivisionLevels` 与 `noiseStrength` 控制参考图、代码和字符转噪点。参考图分布、上移与视差参数保持原值。`denoiseSteps` 为进度显示的步数，当前 50；内置图集有固定的 51 张画面，不受 Worker 参数影响。`solverWidth / solverMobileWidth`、`solverWarp / solverNoise` 只用于载入新视频或没有图集时的代码兼容路径。`generationSequence.detailStart` 用步骤单位控制原封面高频补偿开始点，当前为 48，防止提前注入完成态细节。`sequenceFlowStrength / sequenceRegionLag` 只用于旧 flow 序列，不会改变 baked 序列。图集关闭 mipmap，按半像素边界取样防止串格；默认 GPU RGBA 纹理约 31.65 MB，所有手机和桌面共用同一图集。窗口缩放只改变布局和采样裁切，保留进度；手机像素比上限 1，桌面 1.5。低于 4096px 纹理上限的设备、图集失败、WebGL 不可用或减少动态时沿用现有兼容路径。原封面、参考图和模型贴图不修改；生成原图及逐帧 PNG 保存在本机 `output/ai-generation/atonement-v4/`，不提交、不加入构建。

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
| `deviceLayer.animationRanges`                             | 完整动画区间（秒）：Sony 0–9，Pocket 1.5–10.5                         |
| `deviceLayer.environmentIntensity`                        | Sony 环境反射亮度                                                     |
| `deviceLayer.ambientIntensity`                            | Sony 中性漫反射补光亮度                                               |
| `deviceLayer.keyIntensity/fillIntensity/softboxIntensity` | Sony 主光、辅光和柔光亮度                                             |
| `deviceLayer.exposure`                                    | Sony 三维曝光，不改变视频亮度                                         |
| `deviceLayer.pocketLighting.powerScale/exposure`          | Pocket 原 Blender 面光亮度校准系数／曝光，当前为 0.04／1              |
| `deviceLayer.maxPixelRatio/mobileMaxPixelRatio`           | 桌面／手机渲染清晰度上限                                              |
| `deviceLayer.reducedProgress`                             | 减少动态时固定姿态的时间轴位置                                        |

`video-reel.css` 管理字体、层级与菜单；`video-reel.js` 管理滚动输入、导航与媒体衔接；`reel-motion.js` 保留实拍几何和按实际内容范围计算的进退场。`ai-generation-motion.js` 计算分段时间轴、种子轨迹、入场视差与统一封面 UV；`ai-generation-code.js` 生成保留词间空格的满行代码；`ai-generation-sequence.js` 验证可选图集、映射 0–50 步及相邻区间；`ai-denoise-solver.js` 为纯像素迭代算法，`ai-denoise.worker.js` 在独立线程运行并分批让出事件循环；`ai-generation.js` 管理透明渲染层、素材加载、求解任务与资源释放；`ai-generation-shaders.js` 实现亮度叠加、透明字符、计算步骤采样、高频恢复与可选导入序列。生成层接口为 `update({ progress, arrival, geometry, visible, reduced })`、`setAssets({ poster, fallback, references, sequence })` 与 `dispose()`；`arrival` 为 0–1 的入场进度，省略时按 1 处理。异步结果受版本保护。不建立自己的动画计时器。设备模块与 Blender 资产保持不变，详情见下面说明。

## Blender 资产

`assets/capture-devices.glb` 约 50.10 MB（50,099,584 字节），172 个网格、约 11 万三角面、单一共同动画。相机源模型为 Sony A7RM3，Pocket 为 Osmo Pocket 3；影片拍摄参数仍来自 `reelWorks`，不自动用模型名称覆盖。按用户要求保留原始贴图分辨率：Sony 主体／镜筒为 4096px，Pocket 为 2048px，小型光学／指示灯贴图保持原有 128px。全部内嵌无损 PNG，不降采样、不使用有损 WebP，也未减面。高分辨率贴图增加下载体积和显存需求；网页给贴图设置硬件支持范围内最高 8 倍各向异性过滤，改善斜面清晰度。仅包含 `z轴移动` 与 `空物体` 完整子树和原 35 mm 透视相机；排除未完成无人机、Pocket 未绑定的静态残留及 AREA 灯。面光不打包进 GLB；Pocket 的原场景灯光记录保存在 `device-lighting.js` 并由运行时重建。

原 `.blend` 留在用户提供的位置且不被覆盖；参考 `bin-render-04.webp` 修复的完整场景另存为 Downloads 中的 `camera 无人机-pocket3-reference.blend`，不进入网站包或 Git。Sony 哑光处理保持原样。Pocket 的 110 个网格重新按实际零件绑定材质：石墨灰塑料、灰色防滑板、缎光云台、电机盖、镜头框、真实镜片照片、透明保护窗、黑色屏幕、橡胶摇杆、细橙色快门环、绿色状态灯和暗色接口。背面 DJI 印刷使用现有文字面的浅色材质，不新增几何。修复镜片 `.001` UV 选择和法线贴图的 Non-Color 设置；仅在复制网格上删除损坏的 `custom_normal` 属性，保留几何、原 UV、平滑边、层级和材质修复。原尺寸颜色图保留 OSMO / POCKET 3 字样，镜片与快门使用原颜色图。导出在独立后台 Blender 进程完成，保留当前编辑器的未保存修改与无人机原场景。本次惯性动画完整副本另存为 Downloads 中的 `camera 无人机-inertia-216.blend`。导出记录在 `assets/capture-devices.metadata.json`，分零件参数及可重现方式见 [tools/README.md](tools/README.md)。

使用 Three.js `GLTFLoader` 和 `AnimationMixer`，无需迁移主站 React＋Vite。参考 Oryzo 的 Astro＋Three.js 路线；其公开代码可确认三维渲染器，不能据此认定其模型格式或滚动动画与本项目一致。未来并入 React 主站时可用 React Three Fiber 9 封装，但不会自动提高视觉质量。

- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
- [Blender glTF 导出](https://docs.blender.org/manual/en/4.5/addons/import_export/scene_gltf2.html)
- [Oryzo](https://oryzo.ai/) / [Lusion 官方案例](https://lusion.co/projects/oryzo_ai/)

用户的实拍设计图作为一张共享图集保存为 `assets/vertical-film-sheet.jpg`。网页通过 CSS 裁切中央画面和两台相机，保持原始文件不变，避免重复保存多份素材。AI 设计图只用于布局参照。

`npm test` 包含实拍视频尺寸与进退时序、AI 独立行程、阶段边界连续性、确定性轨迹、手机上下分布及封面裁切一致性的检查。上一版纵向设计副本保存在 `G:\zuopingji\Portfolio-before-tv-reveal-20261001`，也可通过 Git 提交 `abe9148` 恢复。撤回的电视开机版本保存在 `G:\zuopingji\Portfolio-tv-reference-20261001`。旧横向设计副本仍在 `G:\zuopingji\Portfolio-before-vertical-video-20260930`。

2026-10-06 代码迭代版验收：60 项测试通过，主站和实验构建通过；开发与打包页面的 51 个 GPU 状态均唯一，正向／反向像素哈希一致，停帧 RAF 为 0。封面边界的平均通道差约 0.006 / 255。1280×720 桌面首次 Worker 计算约 0.6–0.7 秒、缓存 18.1 MB；390×844 模拟手机约 0.33 秒、缓存 8.05 MB，这些不是所有设备的性能保证。检查了窄屏拖动倒放、途中缩放保留进度、全尺寸封面及视频完成／回滑衔接、Worker 失败兼容、模拟后台暂停／恢复，以及退出后零画布、纹理释放。主站桌面／手机首页、菜单、作品浏览、详情加载及返回正常。实拍、设备文件和灯光配置未修改，相关动画与素材测试通过。默认实验构建不包含旧图集及光流，减少约 3.63 MB 下载；原图片和模型贴图没有修改。

2026-10-07 生图素材版验收：67 项测试、主站构建、独立视频构建通过。实际解码图集的 51 个格子并校验逐帧像素与顺序；1280×720 开发页及 390×844 打包页的 51 个 GPU 画面均不同，正向／反向到达同一步的像素一致，无 GL 错误。字符分裂直接衔接图集第 0 帧，边界平均通道差为 0；纯白矩形为完整白色，代码区域约 71% 像素直接透明。检查停止后不重绘、缩放保留进度、窄屏正反拖动不吸附、图集失败启用 51 帧 Worker 兼容并恢复原素材、End 完成态与主站桌面／手机的首页、菜单、作品浏览、详情加载及返回。当前示意作品没有真实视频，完成后保持原封面，未新增或替换影片。实拍／设备动画、Blender 灯光、原图及模型贴图文件未修改。图集新增约 13.52 MB，只进入独立实验构建；生图源文件、逐帧 PNG 和浏览器截图不提交。

2026-10-07 清晰碎纹理版验收：重做 13 张关键图并保留原封面为第 14 个关键状态，补成 51 张固定像素画面。68 项测试、主站构建与视频构建通过；新增像素检查确认早中段保留锐利碎纹理，补帧没有出现边缘能量塌陷。1280×720 开发页检查 0–49 步与完成前末态，共 51 个不同的 GPU 采样画面，正反向到达像素一致，GL 错误为 0。完成态切换回原封面，End / Home 和窄屏上下键正常，停止后 RAF 为 0；390×844 缩放保留进度并居中裁切。主站桌面／手机首页、菜单、作品浏览、详情图片加载及返回均正常。实拍与设备代码、GLB、灯光和原素材未修改。本版无损图集为 19,348,156 字节，较多细纹理导致压缩率降低，只进入独立实验构建；撤回的失焦版本保存在本机忽略目录 `output/ai-generation/atonement-v3/`，不打包或提交。各版验收记录对应各版检查范围，真实视频的失败／播放兼容沿用前版实现，本次没有新影片素材。
