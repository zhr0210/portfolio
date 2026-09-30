# 调整作品集

打开 `src/config/site.ts`，修改数值并保存。开发服务会更新页面；涉及镜头、阅读器或开场时长时，刷新页面确认完整过程。可先复制一份该文件，便于还原。

## 常见修改

| 想调整什么 | 参数 | 写法 |
| --- | --- | --- |
| 关于我的标题大小 | `typography.aboutTitle` / `aboutTitleMobile` | `'clamp(46px,5.45vw,100px)'` / `'8.7vw'` |
| 创作过程、实践、作品证据标题 | `methodTitle` / `archiveTitle` / `evidenceTitle` 与对应 `Mobile` 字段 | 带单位的长度 |
| 关于我的正文 | `aboutBody` / `aboutBodyMobile` / `aboutLineHeight` | 字号带单位，行高如 `1.95` |
| 作品详情标题和正文 | `detailTitle` / `detailBody` 与对应 `Mobile`、`Compact` 字段 | Compact 对应窄屏竖向详情 |
| 详情正文字重、字间距、颜色 | `detailBodyWeight` / `detailBodyTracking` / `detailBodyColor` | `400` / `'.025em'` / `'#f1eeebd6'` |
| 详情圆角、间隔、内边距 | `layout.detailRadius` / `detailGap` / `detailPadding` | 如 `'36px'`；桌面主体布局 |
| 关于我的滚动长度 | `layout.aboutScrollScreens` | `8.2` 表示约 8.2 屏 |
| 开场、页面切换、全景出现、详情退出速度 | `motion` 中的字段 | 毫秒，数值越大越慢 |
| 长图自动阅读速度 | `reader.speed` | 像素 / 秒；数值越大越快 |
| 操作后多久恢复阅读 | `reader.resumeDelay` | 毫秒 |
| 全景镜头弯曲程度 | `gallery.curve` / `pressCurve` | 基础弯曲 / 按压时增加的弯曲 |
| 全景初始位置 | `gallery.initialPan` | 作品格坐标 `{ x: 6.15, y: 4.48 }` |
| 全景作品显示大小 | `desktopColumnsVisible` / `mobileColumnsVisible` | 数值越小，作品通常越大；桌面还受高度限制 |
| 拖动跟随与惯性 | `damping` / `dragDamping` / `inertiaDecay` | 跟随值越大越直接；衰减越大惯性越短 |
| 全景清晰度与占用 | `maxPixelRatio` / `maxRenderPixels` / 两个 `AtlasTile` 参数 | 默认保留桌面清晰度，手机减少图集占用 |

`clamp(最小值,随屏幕变化的值,最大值)` 可适配不同屏幕；`px` 是像素，`vw` 是视口宽度百分比。时间和物理参数保持正数；镜头核心和水平比例保持大于零。

响应式规则保留新版的小屏和矮屏适配：例如矮屏桌面标题、横向作品详情、窄屏详情的圆角与间距使用原有专门规则。参数不强行覆盖所有布局，调整后需同时检查桌面和手机。

## 添加作品与联系方式

作品在 `src/data/projects.js`：`title` 为中文标题，`en` 为英文标题，`description` 为介绍，`image` 为完整作品，`cover` 为预览图。素材放入 `public/images/`，路径从 `/images/` 开始。`frames` 是全景使用的预览片段，ID 从 0 连续排列，当前图集最多容纳 32 个片段。

联系方式和简历在 `src/data/profile.js`。填写真实的邮箱和简历地址；联系表单生成邀约文字或邮件草稿，不自动发送。

## 旧参数在哪里

旧版原配置在 `archive/legacy-parameters/detail.js` 和 `works.js`。本次继承集中调参的方式，将适用参数接到新版界面；旧滚筒、手风琴列表的取值没有覆盖新版排版。需要恢复完整旧界面时，使用 README 中的本地副本。

## 保存修改

改好后运行 `npm test` 和 `npm run build`。检查首页、菜单、全景拖动、分类、列表、作品详情进入和返回。发布 `dist/`；源码与素材保存在 Git，依赖通过 `npm ci` 重装。
