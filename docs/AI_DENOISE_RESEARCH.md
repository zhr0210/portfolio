# AI 视频逐步重构调研 · 2026-10-06

## 结论与范围

本项目适合保留现有 Three.js + GLSL，由独立 Worker 根据当前封面计算初始噪声和 50 次条件重构，得到 `0…50` 共 51 个状态，再按绝对滚动进度采样。每步都更新前一步的像素场；不再以 9 张独立生成图片之间的叠化作为默认过程。运行时生成的状态只在内存中缓存，不需要发布 50 张图片，也不需要增加 AI 模型下载。

这是一种**已知封面的条件重构艺术模拟**。它借鉴退火、逐步残差修正、多尺度结构恢复与局部扩散，不是 FLUX 推理，也不是严格复现某个 Langevin SDE。最终封面作为条件已经给定，程序没有学习语义，也不能从文字猜出新的主体。这一边界应写入开发文档；网页展示无须向访客暴露算法细节。

真实 FLUX 的每步预测来自训练过的 Transformer。官方采样循环对当前潜变量、时间和文本调用模型，然后用 `x ← x + Δt · prediction` 更新状态。只移植 scheduler 或噪声公式无法获得同等的语义演变。[FLUX 官方采样源码](https://github.com/black-forest-labs/flux/blob/main/src/flux/sampling.py)，[Diffusers FlowMatchEulerDiscreteScheduler 源码](https://github.com/huggingface/diffusers/blob/main/src/diffusers/schedulers/scheduling_flow_match_euler_discrete.py)。

## 已核查的项目

| 项目                                                                                        | 源码中的实际行为                                                                                                             | 依赖、许可与本项目适配                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [diffusion.cobanov.dev](https://diffusion.cobanov.dev/)                                     | 图片交互包含固定种子噪声、正向链和已知原图的 oracle 逆过程；浏览器中实际训练的小网络处理二维点，而非照片语义。               | 可以参考方程、调度和交互。检查公开部署脚本后，尚未确认该站对应的公开源码仓库及复用许可，因此不把页面脚本当成可直接搬入项目的开源库。                                                              |
| [Diffusion Explainer](https://github.com/poloclub/diffusion-explainer)                      | `js/function.js` 用提示词、seed、guidance 和 timestep 拼接 `assets/img/…jpg`、`assets/latent_viz/…jpg`，切换预先存好的结果。 | HTML + JS/D3；[软件 MIT](https://github.com/poloclub/diffusion-explainer/blob/main/LICENSE)。适合研究真实步骤的展示，不是任意封面的浏览器生成器；不应整包并入作品集。                             |
| [IonDen/mlx-taef](https://github.com/IonDen/mlx-taef#mflux-live-previews)                   | `LivePreviewCallback` 在 MFLUX 迭代中解码当前潜变量或支持的预测，能够逐步输出预览图。                                        | [MIT](https://github.com/IonDen/mlx-taef/blob/main/LICENSE)；需要 Python、MLX 和 Apple Silicon。它减少的是预览解码成本，不能替代 FLUX 生成模型；不适合直接运行在本 Windows 项目的访客浏览器中。   |
| [Hugging Face Diffusers](https://huggingface.co/docs/diffusers/en/api/pipelines/flux)       | `callback_on_step_end` 暴露每一步结束时的张量；scheduler 根据模型预测更新潜变量。                                            | [Apache-2.0 软件](https://github.com/huggingface/diffusers/blob/main/LICENSE)，Python/PyTorch 和相应模型。适合将真实推理轨迹离线导出后接到实验页；不是轻量 GLSL 替代品。                          |
| [score_sde_pytorch](https://github.com/yang-song/score_sde_pytorch)                         | `AnnealedLangevinDynamics` 根据当前状态的 score 修正状态，再加入噪声；不是几张成品图之间的混合。                             | [Apache-2.0](https://github.com/yang-song/score_sde_pytorch/blob/main/LICENSE)。真实生成仍需训练网络和权重；本项目只参考迭代和退火思想，自写不带模型的条件更新。                                  |
| [romizone/diffusion-simulator](https://github.com/romizone/diffusion-simulator)             | 虽有 50 步控件，`blendImages` 实际计算 `noise*(1-t) + target*t + randomNoise`。                                              | [MIT](https://github.com/romizone/diffusion-simulator/blob/main/LICENSE)，Canvas，无模型。源码仍是目标图淡入，且使用 `Math.random()`，不满足这次画面与同进度倒放一致的要求。                      |
| [evanw/glfx.js](https://github.com/evanw/glfx.js)                                           | `denoise` 使用按颜色差加权的邻域滤波，并执行两次迭代。                                                                       | [MIT](https://github.com/evanw/glfx.js/blob/master/LICENSE)，WebGL/GLSL，无模型。可参考局部滤波的实现方式；只能清理已有信号，不能从纯噪声生成照片。                                               |
| [piellardj/reaction-diffusion-webgl](https://github.com/piellardj/reaction-diffusion-webgl) | Gray–Scott 两物质反应扩散，用上一帧纹理计算下一帧，产生有机纹理；图片可改变局部参数。                                        | [MIT](https://github.com/piellardj/reaction-diffusion-webgl/blob/main/LICENSE)，GPU 纹理计算，无模型。其“diffusion”指化学扩散，不是图像模型的去噪；可参考状态更新和纹理管理，但不采用其纹理外观。 |

源码核查位置：[Cobanov 当前部署的交互脚本](https://diffusion.cobanov.dev/_next/static/chunks/app/page-cab209bd4622d725.js)，[Explainer 的图片切换](https://github.com/poloclub/diffusion-explainer/blob/main/js/function.js)，[mlx-taef 回调实现](https://github.com/IonDen/mlx-taef/blob/main/src/mlx_taef/integrations/mflux.py)，[romizone 的 blendImages](https://github.com/romizone/diffusion-simulator/blob/main/index.html)，[glfx 的 denoise shader](https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/denoise.js)。部署脚本的哈希 URL 只代表此次核查的版本，不是稳定 API。

## 为什么原来的图集效果仍像叠化

9 张独立的中间图即使配合光流变形，也只约束 8 段过渡。不同图片里的主体边缘、纹理和噪声不是同一求解链中的连续状态；混合区容易同时保留两幅图的信息，形成重影或“噪点覆盖图片”的感觉。增加步数编号或只减小噪声透明度，不会自动产生新的计算步骤。

Explainer 的预渲染展示与 FLUX 的 live preview 有区别：前者可以播放已记录的真实结果，后者在推理时解码当前潜变量。这两者都不证明一套无模型的渐变公式可以替代真实网络。[Explainer 源码](https://github.com/poloclub/diffusion-explainer/blob/main/js/function.js)，[mlx-taef 预览回调](https://github.com/IonDen/mlx-taef/blob/main/src/mlx_taef/integrations/mflux.py)。

本次应让新状态依赖旧状态，让大尺度色块、边缘和细节分别进入计算。这样即使最终目标仍是现有封面，中间画面也会经历真正的像素迭代，而不是在几张作者图片之间交叉淡化。

## 数学依据与实际采用的更新

Score-based 方法把 score 定义为 `∇x log p(x)`。Langevin 更新包含沿 score 的修正和随机扰动；退火版本由大噪声尺度逐级走向小尺度。这能解释“每步根据当前状态修正，扰动逐渐减小”的结构。[Yang Song 的作者说明](https://yang-song.net/blog/2021/score/)，[官方 AnnealedLangevinDynamics 实现](https://github.com/yang-song/score_sde_pytorch/blob/main/sampling.py)。

用于理解的形式为：

```text
x_next = x_current + epsilon * score(x_current, sigma)
         + sqrt(2 * epsilon) * z
```

其中真实方法的 score 由训练模型提供；`z` 为相应随机噪声。这个式子不是本项目实际算法的准确描述。

本项目自写求解器采用如下艺术化更新：

```text
C_k = 多尺度低通封面，按 k 逐级恢复高频，并使用渐弱的空间形变
D(x) = (left + right + up + down) / 4 - x

x_(k+1) = clamp(
  x_k
  + gain_k * (C_k - x_k)
  + coherence_k * D(x_k)
  + innovation_k * seededNoise(seed, k, pixel, channel)
)
```

- `C_k - x_k` 是当前预测与该步条件之间的残差修正。初期只让粗略构图参与，后期让边缘和精细纹理参与。
- `D(x_k)` 是离散 Laplacian 型的局部扩散，令邻域形成连贯色块；它不是 Laplacian 图像金字塔。
- 低通封面由 Gaussian 型金字塔提供。图像金字塔的标准做法是低通后降采样，不是简单马赛克。[OpenCV 官方图像金字塔说明](https://docs.opencv.org/4.x/dc/dff/tutorial_py_pyramids.html)。
- `seededNoise` 是自写确定性扰动，随步数退火；本实现不把它宣称为严格的独立高斯噪声或严格 Langevin 采样。
- 最后一步固定为原始条件图；实际显示完成态使用原封面纹理，避免内部低分辨率状态损失原图细节。

这一更新可以视作带局部平滑和扰动的条件残差重构。它没有 FLUX 的 Transformer、文本编码器或 VAE；也没有把最后一次输出称为新生成的 AI 作品。实现应使用独立 Worker 计算与原有透明 WebGL 层展示，保留实拍、Sony/Pocket 的滚动坐标、灯光和动画。

## 滚动可逆与资源代价

随机值必须由固定种子、迭代编号和像素索引决定。计算一次 `x_0…x_50` 后缓存状态，滚动只根据绝对进度取同一个状态，不能把新的输入理解为“继续执行几步”。倒放播放缓存的轨迹，不尝试对随机/非线性求解器作数学逆运算。

GPU 只需要展示当前相邻步骤。可对小间隔的连续求解结果作展示插值，或重新求一个确定性的部分步；这不应重新引入两幅独立作品的长区间叠化。需要检查快速反向时是否出现双轮廓，不能仅以步数唯一或 hash 一致代替视觉验收。

按 RGBA8 计算，51 个 `384×216` 状态约 16.1 MiB，`512×288` 约 28.7 MiB，手机 `256×144` 约 7.2 MiB；这是状态像素的理论占用，不含工作数组、金字塔、纹理副本和对齐空格。若打包为 8 列、7 行的内存图集，会分配 56 个单元，比 51 个状态多约 9.8%。这些是运行时内存，不是仓库下载体积。

原封面及模型贴图不压缩。只降低模拟计算的工作分辨率，完成态恢复原图。新素材使旧 Worker 任务失效，窗口尺寸只改变构图，后台暂停 Worker 与绘制，退出释放 Worker、内存状态与 WebGL 纹理；Worker 不可用时保留现有程序去噪兼容效果，没有 WebGL或减少动态时显示静态封面。

## 真正 50 步推理的后续接法

如果之后要求展示真实 AI 计算的语义变化，可在工作机或服务端运行一次 50 步 FLUX，使用 `callback_on_step_end` 保存各步潜变量，按正确的 packing 和 VAE 缩放解码，保留 seed、模型版本、scheduler 和参数记录，再将这些真实步骤作为可选素材序列接入。这与这次的代码模拟是两条素材来源，不能混称。[FluxPipeline 官方回调说明](https://huggingface.co/docs/diffusers/en/api/pipelines/flux)，[mlx-taef 的潜变量处理与解码](https://github.com/IonDen/mlx-taef/blob/main/src/mlx_taef/integrations/mflux.py)。

FLUX.1-dev 官方为 12B 参数、BF16，单生成模型按每参数 2 字节估算约 24 GB，尚不含文本编码器、VAE、激活和其他开销；量化和 CPU offload 可以改变实际占用。官方例子使用 50 步并提供 CPU offload，因此不能据此声称一般访客设备能实时完成。[官方模型卡](https://huggingface.co/black-forest-labs/FLUX.1-dev)。

代码许可与权重许可分开：FLUX 参考代码和 Diffusers 为 Apache-2.0；FLUX.1-dev 权重使用单独的非商业许可，生成输出的条款又另有规定，接入实际推理服务时需阅读所用模型的原始条款。mlx-taef 的 MIT 许可只解决该预览库本身，不替代生成模型许可。[FLUX 代码许可](https://github.com/black-forest-labs/flux/blob/main/LICENSE)，[FLUX.1-dev 模型卡及许可入口](https://huggingface.co/black-forest-labs/FLUX.1-dev)，[mlx-taef 许可](https://github.com/IonDen/mlx-taef/blob/main/LICENSE)。

另有真正的浏览器模型方案 [MLC Web Stable Diffusion](https://github.com/mlc-ai/web-stable-diffusion)，依赖 WebGPU、编译的模型、WASM/TVM 等；其仓库说明是早期技术快照，不能把其中浏览器版本限制当作当前浏览器结论。即使采用现代运行时，模型体积和访客 GPU 要求仍与轻量作品集目标不匹配。用于路径追踪的 [pmndrs/denoiser](https://github.com/pmndrs/denoiser) 也是真模型，但任务是清理已有渲染中的噪声，不是从纯噪声创作新图。

## 验证边界

需要验证 51 个实际状态确有变化、相同 seed 可重算一致、不同 seed 的中间状态不同、末态与条件图一致；同时人工检查大色块、主体轮廓与细节分阶段建立，以及相邻步骤无明显重影。顺序前进与倒退抵达相同进度应显示相同状态。性能、手机内存和首次计算等待要在浏览器实测，以上理论估算不等于性能测试结果。

本调研仅核查公开说明、代码和许可，没有下载或安装 FLUX/Stable Diffusion 权重，没有调用生图接口，也没有宣称运行真实模型。后续实现与验收结果由实验页文档记录。
