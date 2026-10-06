# Kilian Zhou · Continuum 5.1

主站采用 React 19 + Vite + TypeScript，保留 Continuum 5.0 的视觉、七件完整作品、矢量字体开场、滚动叙事和玻璃详情页。GSAP 管理空间切换，全景采用与现有设计一致的定制 WebGL 镜头投影，并提供 Canvas 与图文列表兼容路径。

## 本地运行

需要 Node.js 22.12+，推荐当前 LTS。首次安装后运行：

```powershell
npm ci
npm run dev
```

浏览 http://127.0.0.1:4173/。修改源码会更新预览。开发依赖在 `node_modules/`，不提交、不上传到网站。

```powershell
npm test
npm run build
npm run preview
```

`build` 先检查 TypeScript 再生成 `dist/`；仅发布 `dist/`。默认使用相对资源路径，适用于域名根目录和 `/portfolio/` 子目录。指定部署路径时设置环境变量 `PORTFOLIO_BASE` 再构建。路由采用 hash，无需服务器重写。

Windows 与 macOS 使用相同的 npm 命令，主站不再依赖 Python 构建。

## 编辑与代码同步

远程仓库为 `https://github.com/zhr0210/portfolio`，当前协作分支为 `master`。每次完成修改并验证后，提交相关文件并推送到 GitHub；开始编辑前先检查远程更新。后续编辑遵循根目录 `AGENTS.md` 的同步规则。

代码推送不代表网站已经发布；网站发布结果需单独确认。

## 修改内容和参数

- `src/config/site.ts`：中文注释的调参入口，控制字号、间距、动效、长图阅读、镜头和渲染质量；详见 [调参说明](docs/CUSTOMIZATION.md)。
- `src/data/projects.js`、`profile.js`：作品、分类、介绍、联系方式与简历地址。
- `src/components/`：React 界面。`src/hooks/`：页面切换与全景生命周期。
- `src/features/continuum/`：滚动叙事；`gallery/`：镜头投影与 WebGL / Canvas 渲染；`detail/`：玻璃色场与长图自动阅读。
- `src/legacy.css`、`dual-space.css`、`continuum.css`：现有设计的样式与响应式规则；保持它们的加载顺序。
- `public/`：完整作品和预览素材。`index.html`：入口。

TypeScript 严格检查新增入口、调参文件和全景生命周期。继承的页面及渲染器已转换为 ES 模块和 JSX，目前仍是 JavaScript；后续可按模块补类型。

## 全景结构与性能

镜头投影提供可无限拖动的二维作品场。CPU 命中检测与 Canvas 渲染共享 `projection.mjs`，逆向公式与 GLSL 一致。替换成通用三维场景会改变现有设计，本次整理渲染结构并保留投影。

全景渲染器进入作品空间后才加载。静止、非作品空间和后台页面停止动画帧；操作、筛选和时间轴变化重新唤醒。桌面图集每格保持 768px，手机为 512px。跨断点重建复用已加载图片，过期异步任务不会覆盖新图集，退出时释放纹理及事件。

## 历史代码与实验

`archive/legacy-parameters/` 保留旧版详情页和作品列表原始配置。适用的字号、间距、阅读和拖动参数已适配到 `site.ts`，取值保持新版设计。旧滚筒及手风琴列表属于不同设计，其参数保留供后续参考。

`archive/continuum-5-build/` 保存已退休的 Python 打包器、模块表、页面模板和重复 React 运行时，供追溯使用；它们不参与构建。原始可运行源码在 Git 提交 `145625d`，完整迁移前副本在 `G:\zuopingji\Portfolio-before-vite-20260930`。

`experiments/ai-video/` 保存纵向视频展示实验及必要素材：实拍采用两侧相机，AI 采用参考图汇聚、字符计算与去噪成像，完整动画随滚动可逆展示。启动和调参方式见其中的 README。它独立于主站，也不会复制到 `dist/`。

视频实验运行 `npm run dev:video`（4184）；独立构建为 `npm run build:video`，输出 `dist-experiments/`。Three.js 用于实验中的相机／Pocket 滚动动画和 AI 生成画面，主站没有引入它。原 Blender 文件不作为网页资源或 Git 素材上传。

`experiments/cinematic-portfolio/` 是 AFTERIMAGE「余像」独立设计预览，保留原 Hero 与全景，重设五个叙事章节和附属界面。运行 `npm run dev:design`（4190），整站入口 `/`，单章入口 `/chapters.html?chapter=profile`。独立构建 `npm run build:design` 输出 `dist-design-preview/`，不并入主站 `dist/`，详见实验目录 README。

其他完整本地副本：

- `G:\zuopingji\Portfolio-pre-continuum-20260929\Editorial Vanguard\code`
- `G:\zuopingji\Portfolio-before-optimization-20260911`

保留 `.edgeone/` 和 `.openai/` 项目关联信息。配置、归档与实验源码均不作为网站发布文件。
