# 作品集维护约定

- 实际 Git 仓库和工作目录是 `Editorial Vanguard/code/`。修改前检查 Git 状态，并保留已有工作。
- 当前网站为 Continuum 5.1，使用 React + Vite + TypeScript。构建和预览命令见 `Editorial Vanguard/code/README.md`，代码维护约定见该目录的 `AGENTS.md`。
- 维护页面时编辑 `src/` 和 `public/`；`dist/` 是生成结果。原压缩包中的 `site/prototype-directions/` 是未完成实验，当前主站不包含它。
- 修改交互或作品后，检查桌面与手机的首页、菜单、作品浏览、详情进入和返回，并运行 `npm run build`。
- 只发布 `dist/`。本次迁移前副本在 `G:\zuopingji\Portfolio-before-vite-20260930`；合入前副本在 `G:\zuopingji\Portfolio-pre-continuum-20260929`；优化前副本仍在 `G:\zuopingji\Portfolio-before-optimization-20260911`。
