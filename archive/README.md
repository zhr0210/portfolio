# 历史配置与构建

此目录保存旧配置及已退休的构建文件，不参与主站构建，也不会发布。它用于查阅原有实现，不是可独立启动的旧站。

- `legacy-parameters/`：2026-09-29 合入前版本的 WorkDetail / Works 配置原件。新版入口为 `src/config/site.ts`，详见 `docs/CUSTOMIZATION.md`。
- `continuum-5-build/`：Continuum 5.0 的 Python 打包器、模块表、页面模板与浏览器 React 运行时。
- `continuum-5-styles/`：清理前样式与移除的选择器记录；移除的规则对应当前主站源码中不存在的旧界面，动态布局与响应式规则保留并经过浏览器检查。

完整旧站在 Git 提交 `145625d` 或 `G:\zuopingji\Portfolio-before-vite-20260930`。更早备份位置见主 README。
