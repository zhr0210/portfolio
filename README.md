# Kilian Zhou · Continuum

此目录已接入 2026-09-29 轻量包的 **Continuum 5.0 主站**。首页、关于我、作品全景和七个商业案例与压缩包内 `site/` 的效果一致。原压缩包中的 AI 视频节点实验页尚在修改，未合入主站。

## 本地运行

需要 Python 3.8+。在本目录执行：

```powershell
npm run build
npm run preview
```

也可以只用 Python：

```powershell
python build.py
python -m http.server 4173 --bind 127.0.0.1 --directory dist
```

浏览 `http://127.0.0.1:4173/`。`npm run dev` 会先构建再启动同一预览服务。构建无需安装 npm 依赖或联网；`dist/` 是唯一发布目录。

macOS 使用系统 Python 3 时可执行：

```sh
python3 build.py
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

## 编辑与代码同步

远程仓库为 `https://github.com/zhr0210/portfolio`，当前协作分支为 `master`。每次完成修改并验证后，提交相关文件并推送到 GitHub；开始编辑前先检查远程更新。后续编辑遵循根目录 `AGENTS.md` 的同步规则。

代码推送不代表网站已经发布；网站发布结果需单独确认。

## 源码和导入范围

- `src/` 是 React 页面、交互和样式源码；`vendor/` 是包内的 React 浏览器运行时代码；`modules.json` 确定打包顺序。
- `public/` 保存作品素材；`index.template.html` 是输出页面模板；`build.py` 生成 `dist/`。
- 保留本地原有的 `.edgeone/` 和 `.openai/` 项目关联信息。本次没有发布线上版本。
- 压缩包中的 `site/prototype-directions/`、`research/`、`validation/`、`remotion/`、实验视频及交接记录未导入。它们属于进行中的实验、验证或独立渲染材料。

## 独立实验页

2026-09-30 为 GitHub 源码备份新增 `experiments/ai-video/`，保存随后修改的 AI 视频节点实验页及其必要素材。此目录不参与主站构建；启动方法见 `experiments/ai-video/README.md`。发布仍只使用 `dist/`。

合入前的本地项目完整副本位于 `G:\zuopingji\Portfolio-pre-continuum-20260929\Editorial Vanguard\code`，包括当时未提交的修改、依赖和构建结果。更早的优化前副本仍位于 `G:\zuopingji\Portfolio-before-optimization-20260911`。
