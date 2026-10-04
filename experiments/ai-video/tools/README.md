# 导出网页设备动画

需要 Blender 5.2（脚本使用 layered action 和场景时间轴导出）。在仓库根目录用一个独立后台进程读取**已保存文件**；不在正在编辑的 Blender 会话中执行。脚本不覆盖原 `.blend`，可另存完整的哑光材质副本。

```powershell
& 'F:\blender\blender.exe' --background --disable-autoexec 'C:\Users\kilian\Downloads\camera 无人机.blend' --python 'experiments\ai-video\tools\export-capture-devices.py' -- --output 'experiments\ai-video\assets\capture-devices.glb' --save-blend-copy 'C:\Users\kilian\Downloads\camera 无人机-web-matte.blend'
```

按本机位置修改 Blender 和源文件路径；可用 `--max-texture-size 2048` 提高导出纹理清晰度、`--texture-quality 90` 控制 WebP 质量。不需要更新作者文件时，省略 `--save-blend-copy`；该参数必须指向另一个 `.blend` 路径。

默认 `--material-profile matte` 应用 `portfolio-matte-v1`。需要对照原材质时，从原文件导出并加 `--material-profile source`，不要加 `--save-blend-copy`。从已另存的哑光副本再次导出时，同一材质不会重复提高粗糙度；脚本通过自定义属性识别已应用的 profile。

Sony 源材质的 Specular IOR Level 为 0.5、Coat 为 0，并非反射参数被额外调高；机身 ORM 的粗糙度最低约 0.024，强环境和面积光会突出这些反光区域。Pocket 塑料壳 ORM 的金属通道平均约 0.575，粗糙度平均约 0.420，并连接了额外的 alpha→Specular 分支，使塑料容易呈现金属和湿润的质感。灯光和曝光由网页配置单独控制。

哑光 profile 只复制并修改设备的三个主体材质及它们的 ORM，保留颜色、法线和 AO：

| 材质                      | 调整                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Sony 机身、镜筒           | ORM 金属通道 < 0.5 的像素：粗糙度 `max(0.64, 原值 × 0.9 + 0.14)`，上限 1；金属像素原样保留。Specular IOR Level 为 0.35，Coat 为 0。 |
| Pocket 塑料壳 `mat_0.007` | 粗糙度 `0.72 + 原值 × 0.22`，金属度 `原值 × 0.08`；移除 alpha→Specular 支路，Specular IOR Level 为 0.28，Coat 为 0。                |

镜片、Sony 取景器、Pocket 的 `mat_0.008` 屏幕／光学表面、`Material.006` 光学涂层、单独的金属零件保持原材质。无人机及未选物体的材料绑定保持原样；原设备层级、动画曲线和模型变换均不缩放。

完整 Blender 副本在缩小纹理、清理 UV 和更改导出相机名称之前保存，保留原始纹理尺寸和整份场景，包括未完成的无人机。设备根节点记录 `portfolio_web_display_scale = 1.12`，供网页显示比例使用；该属性本身不改变 Blender 模型或轨道。网页配置统一应用一次，避免源模型与网页叠加放大。

脚本选择两台设备的正确根节点，保留层级和原相机，裁定 0–144 帧、24 fps，以一帧一步采样所有动作。场景导出的各对象轨道合入 `CaptureDevices`，不将 Pocket 的起始帧归零。保留动画物体外的静态零件变换，去除不用的 UV 层，同时保留屏幕显式使用的 `UVMap.004`。

自动校验：源根节点／相机存在、无新增驱动或约束、无无人机／已知静态残留、导出含动画且共同持续 6 秒。生成的同名 `.metadata.json` 记录源文件 SHA-256、纹理尺寸、根节点、时序、灯光及每项材质调整的前后参数；不包含绝对本机路径。当前哑光 GLB 约 4.63 MB，仍为 172 个网格、109,938 个三角形、12 条动画通道。

重新导出后运行 `npm test`、`npm run build:video`，核对桌面／手机的第 54 帧和第 90 帧，并测试滚动往返。新增约束、骨骼、不同 UV 或调整起止帧时，需要先审查脚本，不能盲目沿用旧范围。
