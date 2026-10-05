# 导出网页设备动画

使用 Blender 5.2，在独立后台进程读取已保存文件；不在用户正在编辑的 Blender 会话中执行。脚本不覆盖原 .blend，可另存包含完整场景的材质修复副本。

```powershell
& 'F:\blender\blender.exe' --background --disable-autoexec 'C:\Users\kilian\Downloads\camera 无人机-pocket3-reference.blend' --python 'experiments\ai-video\tools\export-capture-devices.py' -- --extend-animation --output 'experiments\ai-video\assets\capture-devices.glb' --save-blend-copy 'C:\Users\kilian\Downloads\camera 无人机-inertia-216.blend'
```

按本机位置修改 Blender 和源文件路径。不需要更新作者文件时，省略 --save-blend-copy；该参数必须指向另一个 .blend。所有贴图保留原始尺寸，内嵌无损 PNG：Sony 主体／镜筒 4096px，Pocket 2048px，原有 128px 小贴图保持原样。DDS 从已有像素解码，不额外降采样或使用有损 WebP / JPEG。

默认 --material-profile matte 保持 Sony 的 portfolio-matte-v2 处理，并应用 pocket3-reference-v1 分零件修复。需要对照原材质时，从原文件导出并加 --material-profile source，不要加 --save-blend-copy。从修复副本再次导出时，通过自定义属性识别已应用的 profile，不重复调整颜色或粗糙度。旧 Sony profile 升级需重新读取原 .blend。

## Sony 材质

Sony 源 Specular IOR Level 为 0.5，Coat 为 0。机身 ORM 粗糙度最低约 0.024，强环境和面积光突出这些反光区域。复制机身／镜筒材质和 ORM：金属通道 < 0.5 的像素，粗糙度改为 max(0.64, 原值 × 0.9 + 0.14)，上限 1；金属像素、颜色、法线和 AO 原样保留。Specular IOR Level 设为 0.35，Coat 为 0。镜片、取景器、独立金属材料不改。

## Pocket 3 按参考图修复

参考用户提供的 bin-render-04.webp，配置集中在 pocket_materials.py 的 SURFACES 和 PARTS。原材质名不能直接当作零件类型：mat_0.002_0.005 同时用于镜头附近的大零件和摇杆微小防滑颗粒；部分无贴图白色材料还是金属，原塑料 ORM 也混入大量金属像素。

| 表面                   | 处理                                                                          |
| ---------------------- | ----------------------------------------------------------------------------- |
| 机身                   | 石墨灰塑料，粗糙度 0.82，金属度 0；2048px 修正颜色图保留 OSMO / POCKET 3 字样 |
| 防滑板                 | 灰色塑料，粗糙度 0.91，保留原法线纹理和现有斜纹几何                           |
| 云台／电机盖           | 分别使用缎光黑与灰色；粗糙度 0.57 / 0.66                                      |
| 镜头框／镜片           | 分开绑定；镜片恢复原 atlas 中的摄影镜片，选用原 UVMap.001                     |
| 光学保护窗             | 低透明度玻璃，避免白色表面遮住真实镜片                                        |
| 屏幕／屏幕框           | 黑色非金属玻璃与深色外框，保留少量适合玻璃的高光                              |
| 摇杆／功能按钮／微颗粒 | 深灰橡胶，粗糙度 0.88，修正原白色缺材质                                       |
| 快门                   | 恢复原颜色 atlas 的深色中心与细橙环；不把整个按钮染橙                         |
| 状态灯／接口           | 柔和绿灯、暗色接口；接口保留少量金属响应                                      |
| 背面 DJI 印刷          | 在现有 191 个文字面上绑定浅色印刷，不新增贴花或几何                           |

原法线图的颜色空间误设为 sRGB，修复副本改为 Non-Color，并按表面分别设置法线强度。原 Pocket 网格的 custom_normal（CORNER / INT16_2D）属性损坏，导致正常灰色 PBR 也出现异常黑色受光；在复制的 110 个网格上删除此属性，让 Blender / glTF 根据原面和平滑边生成有效法线。保留顶点、拓扑、UV、平滑标记、层级、变换与全部动画曲线。修正颜色图和法线图均保持 2048px；原 atlas 的镜片与快门像素保留。

完整作者副本在 UV 清理、更改相机名和时间轴导出设置之前保存，保留原场景中的无人机及其他未选物体。源图片、未选材质绑定不改，当前编辑器的未保存修改不受影响。设备根节点的 portfolio_web_display_scale = 1.12 是显示偏好，不改变模型变换；网页配置应用一次。

## 导出和验证

`--extend-animation` 调用 `device_inertia.py`：Sony 主控制器 0–108 延长至 216 帧，Pocket 主控制器 36–144 延长至 252 帧。保留原三个关键姿态，沿末段 X、Z 递减与 Y 递增的方向计算新的中段、尾段。终点采用起始 Euler 角加整圈，Sony 为 −315°／390°／−500°，Pocket 为 −257°／66°／−448°；与起始朝向相同。旧尾帧切线改为连续的惯性速度，新增曲线单向并在终点减速，不使用起始／中间帧复制或四元数短路径返回。升降父级的关键帧和手柄时间加倍，保持距离与 36 帧错峰；三个云台动作原样保留。作者副本保存完整场景与原灯光，无人机及其动画不改。副本通过场景 profile 识别已延长动画，再次导出不重复加倍；没有此选项且源文件没有 profile 时仍可导出原 0–144 帧动画。

脚本选取两台设备的正确根节点与原 35 mm 相机，按 24 fps、一帧一步采样，延长版共同时间轴为 0–252 帧。各对象轨道合入 CaptureDevices。仅在网页导出过程清理未使用 UV；每个材质指定的原 UV 坐标保留并映射到 TEXCOORD_0。未完成无人机、未绑定的 Pocket 静态残留及 AREA 灯不进入 GLB。

图片复制时传递当前像素，保存 PNG 后重新载入并打包，避免 Image.copy() / 旧 packed file 回退成源 DDS。export_image_format=AUTO 保留 PNG；Blender 5.2 不接受 PNG 枚举。颜色乘数使用现代 ShaderNodeMix（RGBA / MULTIPLY），保证 Blender 与 glTF 一致。

自动校验实际 PNG 签名、MIME 和原尺寸，Pocket 各零件绑定、颜色因子、粗糙度、金属度及必需纹理；检查源根节点、相机、无新增约束／驱动、无无人机、延长版共同动画持续 10.5 秒。`tests/device-animation.test.mjs` 对照实际 GLB 的每个新增旋转样本，验证单向 Euler 延伸、首尾同朝向、连接速度连续、尾段减速及倒放。`tests/device-asset.test.mjs` 解码真实 Sony ORM 与 Pocket 快门 atlas 像素，验证哑光掩码、暗中心和橙环；检查镜片 UV、关键零件表面、文字绑定及有限动画往返。

当前资产为 50,099,584 字节，172 个网格、109,938 个三角形、12 条动画通道。修复作者副本重复导出得到相同 GLB SHA-256。同名 .metadata.json 记录源 SHA-256、无损策略、时序、灯光和材质修复，不包含本机绝对路径。主站构建仍不包含实验资产。

重新导出后运行 npm test、npm run build、npm run build:video，检查桌面／手机、滚动往返与各姿态。新增约束、骨骼、不同 UV 或调整起止帧时，先审查导出脚本。
