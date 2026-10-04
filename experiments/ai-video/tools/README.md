# 导出网页设备动画

需要 Blender 5.2（脚本使用 layered action 和场景时间轴导出）。在仓库根目录用一个独立后台进程读取**已保存文件**；不在正在编辑的 Blender 会话中执行，脚本也不会保存 `.blend`。

```powershell
& 'F:\blender\blender.exe' --background --disable-autoexec 'C:\Users\kilian\Downloads\camera 无人机.blend' --python 'experiments\ai-video\tools\export-capture-devices.py' -- --output 'experiments\ai-video\assets\capture-devices.glb'
```

按本机位置修改 Blender 和源文件路径；可用 `--max-texture-size 2048` 提高导出纹理清晰度、`--texture-quality 90` 控制 WebP 质量。优化只影响当前后台进程中的副本。

脚本选择两台设备的正确根节点，保留层级和原相机，裁定 0–144 帧、24 fps，以一帧一步采样所有动作。场景导出的各对象轨道合入 `CaptureDevices`，不将 Pocket 的起始帧归零。保留动画物体外的静态零件变换，去除不用的 UV 层，同时保留屏幕显式使用的 `UVMap.004`。

自动校验：源根节点／相机存在、无新增驱动或约束、无无人机／已知静态残留、导出含动画且共同持续 6 秒。生成的同名 `.metadata.json` 记录源文件 SHA-256、纹理尺寸、根节点、时序和灯光；不包含绝对本机路径。

重新导出后运行 `npm test`、`npm run build:video`，核对桌面／手机的第 54 帧和第 90 帧，并测试滚动往返。新增约束、骨骼、不同 UV 或调整起止帧时，需要先审查脚本，不能盲目沿用旧范围。
