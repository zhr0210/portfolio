# 作品集维护

- 修改前检查 Git 状态，保留已有工作。主站使用 React + Vite；编辑 `src/` 和 `public/`，构建命令见 README。
- 以 Continuum 新版设计为视觉基准。调整参数优先编辑 `src/config/site.ts`；涉及响应式覆盖时阅读 `docs/CUSTOMIZATION.md`。
- 全景 CPU 投影与 GLSL 逆投影必须一致。修改渲染或输入时验证拖动、命中、筛选、静止停帧、后台暂停及退出清理，并运行 `npm test`。
- 修改页面后检查桌面与手机的首页、菜单、作品浏览、详情进入和返回，运行 `npm run build`。新增 TypeScript 按严格模式检查，既有 JS / JSX 可逐模块迁移。
- `experiments/` 是独立实验，`archive/` 是历史参考。主站构建保持二者独立；只有 `dist/` 可发布。
- 完整迁移前副本位于 `G:\zuopingji\Portfolio-before-vite-20260930`。其他备份位置见 README；删除独有内容前保留可恢复副本。
