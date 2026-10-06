# Continuum / AFTERIMAGE「余像」

这是 2026-10-07 主站源码快照的独立电影叙事设计预览。保留矢量开场、Hero、全景镜头和七件原作；重设其余五章、菜单、联系与能力档案弹窗，以及审片台详情。AI Video 实验没有接入。

从仓库根目录运行：

```powershell
npm run dev:design
npm run typecheck:design
npm run build:design
npm run preview:design
```

- 整站：http://127.0.0.1:4190/
- 章节：http://127.0.0.1:4190/chapters.html?chapter=profile
- 章节参数：`profile`、`method`、`archive`、`evidence`、`footer`；无效值显示第一章。

开发时只读使用主站 `public/`，构建输出到独立的 `dist-design-preview/`，包含两个 HTML 入口与完整素材。此输出仅用于预览，没有发布到网站。原主站的 `src/`、入口、配置、`dist/` 发布规则和视频实验命令独立保留。

## 编辑

- `src/data/cinematic.ts`：五章文案、素材引用、桌面和手机滚动长度，以及镜头缓动时间。
- `src/features/cinema/FilmChapter.tsx`、`motion.ts`：章节构图与绝对进度采样。相同进度返回相同画面，向上滚动逐项还原。
- `src/cinema.css`：黑白灰视觉、手机编排和减少动态效果的阅读布局。
- 副本 `src/data/projects.js`、`profile.js`：七件作品及已有个人能力资料。正式经历与联系方式仍待本人提供。

整站和章节页共享镜头组件。从叙事打开作品后，关闭会恢复相同观看位置；自动阅读需主动开启。减少动态效果模式改用可直接阅读的纵向布局。

## 参考与源码归属

视觉参考：[Landing.love / Film](https://www.landing.love/categories/film/)、[Scheme Engine](https://www.schemeengine.com/)、[Dark.design](https://www.dark.design/)。只参考画面尺度、遮幅、文字关系与节奏，使用的图像均来自现有作品集。

文字与菜单适配自 [React Bits / Scroll Reveal](https://reactbits.dev/text-animations/scroll-reveal)、[Staggered Menu](https://reactbits.dev/components/staggered-menu) 的 TypeScript／CSS 版本。适配代码及完整许可证位于 `src/vendor/react-bits/`：外部章节进度替换独立文字触发器，菜单改用同一条可逆时间轴，加入原站焦点管理与滚动锁定。使用现有 GSAP，未加入新的运行时依赖。

React Bits 采用 MIT + Commons Clause，许可证要求随应用保留版权和许可文本。此处作为作品集应用的一部分使用。
