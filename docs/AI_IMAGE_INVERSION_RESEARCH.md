# 单图反演与逐步生成轨迹 · 2026-10-07

## 推荐路线

可以输入一张图片，用预训练模型把它反演到结构化噪声，并选择 25、50 等计算步数。就当前参考的 FLUX 展示，优先采用 **FLUX.1-dev + RF-Inversion，在工作机离线计算和记录轨迹，网页只按滚动进度播放**。图片反演可以不要求用户填写原始提示词；无需安装新的模型到访客浏览器。[RF-Inversion 作者仓库](https://github.com/LituRout/RF-Inversion)，[Diffusers 社区实现](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py)。

反演得到的是所选模型和参数下的一条新轨迹，不能声称找回这张图当年生成时的真实噪声、seed 或全部中间步骤。图片可能本来就是照片，也可能来自另一个模型；VAE 编码、数值求解和控制参数都会影响结果。倒序播放模型反演的记录，与从其终点另跑一次模型重建，也不是完全相同的操作。

## 四条可用路径

| 路线 | 单图与提示词 | 25/50 步与记录能力 | 适合什么 |
| --- | --- | --- | --- |
| 固定种子前向加噪 | 只需图片，不用模型或提示词。 | 任意显示采样数；按噪声强度直接计算。 | 轻量视觉模拟，保持终点原图。没有推断语义，倒播不是模型生成。 |
| Stable Diffusion + DDIM inversion | 单图编码后，官方教程用描述该图的 prompt 调用 UNet。 | `num_inference_steps`、`DDIMInverseScheduler.set_timesteps()` 可配置；教程保留中间潜变量。 | 成熟的模型反演实验；提示词与重建误差需要处理。[官方教程](https://huggingface.co/learn/diffusion-course/en/unit4/2)，[scheduler 接口](https://huggingface.co/docs/diffusers/en/api/schedulers/ddim_inverse)。 |
| FLUX + RF-Inversion | 单图；`source_prompt=""`、`source_guidance_scale=0.0` 为默认。 | `num_inversion_steps` 可指定 25/50；反演循环须增加逐步记录，重建循环已有回调。 | 本项目首选，得到模型计算的轨迹；不承诺像素级重建。[Diffusers 源码](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py)。 |
| ComfyUI-Fluxtapoz | 作者链接的社区 RF-Inversion 节点，示例输入图片与空源 prompt。 | 示例由 `BasicScheduler` 指定步数；正反采样器都有逐步 callback，但需连接/扩展导出。 | 若工作机已用 ComfyUI，可用节点调参；不是另一套无需模型的算法。[节点作者仓库](https://github.com/logtd/ComfyUI-Fluxtapoz)，[示例工作流](https://github.com/logtd/ComfyUI-Fluxtapoz/blob/main/example_workflows/example_rf_inversion_updated.json)。 |

固定噪声的直接加噪式为 `x_t = sqrt(alphaBar_t)*x_0 + sqrt(1-alphaBar_t)*epsilon`。在不同噪声级别复用同一个 `epsilon`，得到的是可逆显示的边缘分布样本，不能把这些样本称作每一步独立加新噪声的 Markov 链。这个过程不调用模型，也不会产生新的语义预测。[Diffusers 官方加噪实现](https://github.com/huggingface/diffusers/blob/main/src/diffusers/schedulers/scheduling_ddpm.py)。

## RF-Inversion 的具体接口证据

Diffusers 中的类名是 `RFInversionFluxPipeline`，通过 `custom_pipeline="pipeline_flux_rf_inversion"` 加载；它位于社区 pipeline 目录，不是另一个轻量 JS 框架。[作者接入示例](https://github.com/LituRout/RF-Inversion/blob/main/README.md)。当前 `invert` 的相关参数为：

```text
image
source_prompt=""
source_guidance_scale=0.0
num_inversion_steps=28
strength=1.0
gamma=0.5
height=None, width=None, timesteps=None
```

将 `num_inversion_steps` 设为 25 或 50 即可；保持 `strength=1.0` 才使用完整行程。自定义 timesteps、降低 strength 会改变实际更新次数。当前 scheduler 添加终点 sigma，反演循环执行 `len(sigmas)-1` 次；导出初始状态后再导出每次更新，完整 N 次更新可以记录为 N+1 个状态。[反演循环与返回值](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py#L957)，[FlowMatch scheduler](https://github.com/huggingface/diffusers/blob/main/src/diffusers/schedulers/scheduling_flow_match_euler_discrete.py)。

实际受控更新将模型向量场与指向所选噪声终点的控制场组合：`controlled = (1-gamma)*modelField + gamma*targetField`。默认 `gamma=0.5`；把它设为 1 会消掉模型场的贡献，不能把这种纯控制过程当成模型语义反演。重建侧有独立的 `eta` 及开始/停止区间，控制保真与编辑倾向；不应照抄用于“改成番茄”的编辑示例作为原图重建设置。[论文算法 1/2](https://arxiv.org/html/2410.10792v1)，[对应实现](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py#L1049)。

ComfyUI 的 `FluxForwardODESampler` 接收 `gamma`、`seed`，步数由外部 sigma 序列决定；`FluxReverseODESampler` 接收 `eta`、`start_step`、`end_step`。示例使用 28 步，两个 `BasicScheduler` 可改为 25/50。[采样节点源码](https://github.com/logtd/ComfyUI-Fluxtapoz/blob/main/nodes/rectified_sampler_nodes.py)。

## 逐步导出与预览方式

1. 固定图片预处理、尺寸、模型版本、数值精度与随机状态。当前 `invert` 内部的 VAE `.sample()` 和 `torch.randn_like()` 都有随机性，且函数没有 `generator` 参数；需要封装固定 RNG 或显式传入并保存这两处的结果。[编码实现](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py#L407)，[作者的固定 seed 示例](https://github.com/LituRout/RF-Inversion/blob/main/scripts/test.py)。
2. 在反演循环中保存初始潜变量与每次更新后的独立副本，记录对应 timestep/sigma。现成 `invert` 只返回终态、输入图潜变量和 image IDs，**没有逐步 callback**，不能直接要求它自动返回 51 帧。[invert 源码](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py#L1054)。
3. 若需一遍实际的“噪声到图像”模型重建，再从该终态执行 `__call__`，设 `num_inference_steps=N`，使用 `callback_on_step_end` 和 `callback_on_step_end_tensor_inputs=["latents"]` 保存各步。初始噪声也单独保存。计算 N 步反演后再做 N 步重建，通常约需两遍模型迭代，另有编码与解码开销。[重建回调](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py#L923)。
4. 解码前按本 pipeline 执行 unpack、`latents/scaling_factor + shift_factor`，再调用 VAE 和 image postprocess。直接把 packed latent 当 RGB 图片或漏掉归一化会产生错图。[解码实现](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py#L939)。
5. 同时区分两种预览：**当前含噪潜变量的解码**，以及模型在该步**预测的干净图像**。两者视觉效果不同；要贴近引用的特定演示，需要对照其解码方式，不能仅凭 live preview 的名称认定它导出了干净预测。当前 RF 回调暴露的是 `latents`；要导出 predicted-clean，还需按该模型的 velocity/time 约定推导并记录预测。Fluxtapoz 的 callback 虽有名为 `denoised` 的字段，其 RF 采样器实际填的是当前 `Y/X`，不能凭字段名认为它已是干净预测。[回调字段定义](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py#L200)，[Fluxtapoz callback](https://github.com/logtd/ComfyUI-Fluxtapoz/blob/main/nodes/rectified_sampler_nodes.py)。
6. 将验收过的轨迹连同步数、模型、seed、提示词、控制参数、预览种类与裁切信息导出给网页。滚动只做绝对进度采样，停止时停帧，反向时沿同一记录倒放。推理不随每次滚轮重新启动。

25 次实际求解与 50 次求解后抽取 25 张预览是两件事。前者可能改变轨迹和重建，后者只改变展示采样数，制作界面应把它们分开。不要用插值补足的帧数冒充更多模型计算步骤。

## 重建精度与画面边界

RF-Inversion 支持不描述源图的反演，但模型、控制参数、数值误差和 VAE 的编码损失仍会改变细节。完整模型重建应先检查文字、面部、轮廓、颜色及最终裁切；不能先承诺所有图片零误差。提高步数可能降低离散误差，却不消除所有这些误差。若最终必须衔接原视频封面，可保留原封面作为展示终点，但要验收最后一段过渡，也不能把其替换称为模型准确重建。[RF-Inversion 论文](https://arxiv.org/html/2410.10792v1)，[更高阶 RF-Solver 的作者论文](https://proceedings.mlr.press/v267/wang25ce.html)。

DDIM 官方教程明确示例在 50/100 步时可能重建不一致，增加步数有时改善，Null-text inversion 可通过优化无条件文本 embedding 改善保真。教程的循环跳过边界，虽然保存 `intermediate_latents`，也不能直接保证指定 N 就输出 N+1 帧。[DDIM 官方教程](https://huggingface.co/learn/diffusion-course/en/unit4/2)，[Null-text 作者项目页](https://null-text-inversion.github.io/)。

## 硬件、许可与核查范围

FLUX.1-dev 是 12B 参数模型，仍需 Transformer、VAE 与 CLIP/T5 等组件。Diffusers 说明完整组件载入约需 50 GB RAM/VRAM，并提供 CPU offload 与量化方案；这不是每个优化配置的实际显存门槛。低显存方案可能变慢、改变数值，须在实际工作机验证。适合离线制作素材，作品集前端保持 Three.js 播放层即可。[官方模型卡](https://huggingface.co/black-forest-labs/FLUX.1-dev)，[Diffusers 优化说明](https://huggingface.co/docs/diffusers/en/api/pipelines/flux#optimize)。

RF-Inversion 作者代码与 Diffusers 社区实现为 Apache-2.0；ComfyUI-Fluxtapoz 为 GPL-3.0。FLUX.1-dev 的模型权重另受其非商业许可约束，输出使用条款又与权重条款不同，不能用代码许可替代权重许可。[作者 LICENSE](https://github.com/LituRout/RF-Inversion/blob/main/LICENSE)，[Diffusers 文件许可头](https://github.com/huggingface/diffusers/blob/main/examples/community/pipeline_flux_rf_inversion.py)，[节点 LICENSE](https://github.com/logtd/ComfyUI-Fluxtapoz/blob/main/LICENSE)，[模型许可入口](https://huggingface.co/black-forest-labs/FLUX.1-dev)。

此次只核查论文、作者代码和官方文档，没有下载模型、执行推理、安装依赖或修改网页。以上是源码确认的可行路线，尚未在用户图片和本机硬件上验证画面、误差、耗时或资源占用。
