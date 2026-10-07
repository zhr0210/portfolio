# Mavic 3 展开动画

使用用户提供的 `dji-mavic-3.zip` 制作的独立 3D 动作预览，含带动画的 GLB 和可编辑 Blender 工程。参考 DJI 视频 `https://www.youtube.com/watch?v=r5kukRMmZNI` 的 3:45–3:55。观察后确认：前半段仍为实拍，机械展开镜头主要在约 3:50–3:54。模型是 Mavic 3，视频与官网是 Mavic 3 Pro，因此保留源模型的双摄外形，不替换为三摄。

## 预览

在仓库根目录运行 `npm run dev:drone`，打开 `http://127.0.0.1:4193/`。默认停在 4.8 秒，点击「播放」或「重播展开」直接查看动作。时间轴可以正向、反向拖动；「折叠」「展开」直接定位两端。「自由查看」可拖拽旋转和缩放，再点击「参考镜头」恢复动画相机。支持空格播放／暂停、左右键逐步查看、Home / End 两端定位和 0.5 / 1 / 1.5 倍速。

动画共 10 秒、30 fps，Blender 为 0–300 帧（含两端共 301 个采样状态）。0–4.8 秒以折叠静态姿态代替参考片中的实拍；约 5.05–6.6 秒后机臂从机腹翻出，6.05–7.6 秒前机臂向两侧打开，7.3–8.6 秒桨叶展开，末段保持完全展开。镜头在 4.8–8.9 秒轻微后移并调整构图。四机臂和八片桨叶分别使用实际零件几何设置转轴；前臂倾斜轴确保折叠电机与桨叶收在机背上方，后臂绕斜向轴从下方翻出。铰链轴由静态模型与画面拟合，并非厂商 CAD 数据。

停止操作时不持续渲染；进入后台暂停播放，回来保持进度。减少动态模式初始显示展开末态，可以主动播放。WebGL 或资源加载失败时显示明确提示。

## 资源与工程

- `assets/mavic-3-unfold.glb`：完整模型、全尺寸内嵌贴图、12 个机械转轴和一个 10 秒采样动画，包含动画相机。
- `assets/mavic-3-unfold.metadata.json`：源 GLB SHA-256、几何数量、时间段、灯组与明确的复刻范围。
- 本机 `output/drone-reference/Mavic-3-Unfold.blend`：独立 Blender 5.2 工程，贴图已打包，包含动画、时间轴标记、Cycles 灯光、1920×1080 相机。直接打开后可空格播放；无需连接 Blender 插件。源 ZIP 与现有 Blender 场景均不覆盖。
- 本机 `output/drone-reference/frame-000.png`、`frame-180.png`、`frame-210.png`、`frame-240.png`、`frame-300.png`：离线检查帧，不加入网站或 Git。

源模型 147 个网格、110,092 顶点、127,011 三角面。动画版保留全部几何、不减面、无损原尺寸贴图；两个跨机臂的螺钉网格按刚性转轴分开后合并同组，最终 148 个网格，避免 UV 接缝拆分成数百次绘制。机身材质使用 0.28 的 base color 乘数校准石墨灰，原贴图像素、金属度、粗糙度和法线保留。网页以 Three.js 面光源重建灯组并校准环境反射；实时渲染与 Blender Cycles 的光照不完全相同。

重新生成，在仓库根目录运行：

```powershell
& 'F:\blender\blender.exe' --background --disable-autoexec --python 'experiments\mavic-unfold\tools\build-unfold.py' -- --source 'C:\Users\kilian\Downloads\dji-mavic-3.zip'
```

脚本定位所有输出为项目绝对路径，不依赖 Blender 的默认工作目录。生成工程和检查帧只保存在被忽略的本机输出目录，网页 GLB 和生成元数据在实验资产目录。

## 构建与验证

`npm run build:drone` 构建到独立的 `dist-mavic-preview/`，`npm run preview:drone` 在 4193 验证打包版。此实验不并入主站 `dist/`，也不复制作品图片或其他实验资产。主站仍按现有约定只发布 `dist/`。

`node --test tests/mavic-unfold.test.mjs` 检查实际 GLB 的完整三角面数量、内嵌贴图、网格数量、12 个独立转轴、301 个规范四元数样本、准确的 0–10 秒时间、开放末态、折叠前电机净空和后臂先行。主站回归使用 `npm test` 与 `npm run build`。
