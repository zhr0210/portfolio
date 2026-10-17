# 项目目录与恢复

2026-10-17 按用户确认，将原 `Editorial Vanguard/code/` 的完整 Git 仓库提升到 `G:\zuopingji\Portfolio\`。保留正式主站及三个独立实验的内部相对结构；移除外层历史包装目录。

| 位置 | 用途 | Git / 发布 |
| --- | --- | --- |
| `src/`、`public/` | 正式主站源码与网页素材 | 提交源码，构建后发布 |
| `experiments/` | AI 视频、余像设计、Mavic 展开三个独立实验 | 提交，与主站分别构建 |
| `archive/` | 历史源码与配置参考 | 提交独有源码及共享清单；本机旧部署记录除外 |
| `docs/`、`tests/` | 维护说明与自动检查 | 提交 |
| `working-files/` | Blender 工程、模型原件、制作脚本及中间资源 | 本机保留，仅提交目录说明 |
| `output/` | 截图、离线渲染、检查报告、日志、AI 生成过程资料 | 本机保留，仅提交目录说明 |
| `.edgeone/`、`.openai/` | 现有项目关联 | 保留原有追踪和忽略规则 |
| `node_modules/`、`dist*/` | 依赖及生成结果 | 不提交；主站只发布 `dist/` |

## 本次迁移

- 两处 `output/` 已逐文件合并；重名且内容相同的文件只保留一份，异名或内容不同的文件保留。原外层 `output/` 中的验收截图仍沿用原路径。
- 两处 `.playwright-cli/` 的旧记录移到 `output/playwright/session-records/outer/` 和 `repository/`。后续工具可重新生成被忽略的运行目录。
- 模型工程、建模脚本和中间 GLB 从 `output/` 迁至 `working-files/`，按原项目组名归类。`drone-reference` 的活动生成器已同步拆分工程与验收输出路径。
- 原 `AI-Video-Prototype/` 的 12 个独有文件保存在 `archive/ai-video-prototype/`。59 个重复文件依据 SHA-256 合并，逐项来源见该目录 `file-manifest.json`。归档仅供参考；完整原型按下文从备份恢复。
- `.gitattributes` 固定归档原件及共享 HTML 的原始字节，避免 Windows 换行转换使历史文件哈希失效。
- 原外层 `AGENTS.md` 已和仓库规则合并，原件留在 `archive/project-history/`。旧 `.workbuddy/` 部署记录仅保留在本机归档，不用于判断当前部署。
- Git 的 `.git/`、现有分支和远程配置整体迁移，GitHub 仓库内原有源码路径保持不变。

## 备份与恢复

完整业务文件备份：`G:\zuopingji\Portfolio-before-consolidation-20261017\snapshot\`。备份不含可重建的依赖、构建目录和嵌套依赖；Git 历史单独保存在 `repository.bundle`。`original-files.json` 记录 933 个原文件的 SHA-256；`migration-journal.json` 记录迁移过程，`verification.json` 记录整合后没有缺失原文件内容。后续文档和生成器的有意修改另由本次 Git 提交记录。

- 完整历史 AI 原型：`snapshot/AI-Video-Prototype/`，复制到新的临时目录后可按原 README 启动。
- 原始压缩包：`original-archives/code.7z`，原封保留；`snapshot/Editorial Vanguard/code.7z` 另有一份校验过的副本。
- 整合前源码：`snapshot/Editorial Vanguard/code/`。恢复到新目录后运行 `npm ci` 重建依赖。
- 整合前 Git 历史：在新的空路径运行 `git clone G:/zuopingji/Portfolio-before-consolidation-20261017/repository.bundle Portfolio-recovery`，再从快照恢复未纳入 Git 的本机资料。原远程地址见备份 `git-config`。

以上恢复操作使用新目录，核验成功后再决定是否替换现有项目。更早的迁移、合入及优化前备份保持原位置，见根 README。

## 验证范围

整合后的构建、交互回归和 Git 同步结果记录在 `output/consolidation-20261017/`。本地整理、GitHub 代码同步和网站发布分别核验；本次不发布网站。
