# AI 视频节点实验页

独立保存 2026-09-30 的 AI 视频节点原型，包括双排参考节点、滑动吸附、逐步生长的连线、渐变流光和视差效果。该目录不参与主站构建。

在仓库根目录运行：

```powershell
npm run build
python -m http.server 4184 --bind 127.0.0.1
```

浏览 `http://127.0.0.1:4184/experiments/ai-video/ai-video.html`。

菜单中的“返回作品集”打开同一服务下的 `dist/`。作品 02、03 为占位；本地载入的视频仅在当前浏览器会话中使用，不会上传。

当前入口使用 `ai-video-nodes-v2.js` 和 `ai-video-nodes-v2.css`；交互记录见 `AI-VIDEO-NODES.md`，其中更早版本的文件名、测试路径仅为历史记录。截图素材保存在 `assets/ai-node-reference.png`。
