// src/components/WorkDetail/constants.js

export const DETAIL_CONFIG = {
    // ====== 1. 全局布局与间距 (Layout & Spacing) ======
    layoutLeftMargin: "3vw",         // 左侧面板与左边缘间距
    layoutLeftPanelWidth: "30vw",    // 左侧面板宽度

    layoutGap1: "8vw",               // [左侧面板] 与 [中央图片] 的间距
    imageWidth: "25vw",              // 中央图片宽度

    layoutGap2: "5vw",               // [中央图片] 与 [合并滚筒] 的间距
    layoutDrumWidth: "25vw",         // 合并后的合并滚筒总宽度

    layoutRightMargin: "3vw",        // 合并滚筒与右侧边缘的间距

    drumItemHeight: "15vh",           // 每个文字块（中+英）的固定高度
    drumItemGap: "4vh",              // 每组文字之间的上下垂直间距

    // ====== 2. 字体大小与样式 (Typography) ======
    titleFontSize: "5vw",            // [公众号推文] 主标题的大小

    // --- 正文/描述专用控制 (Description Controls) ---
    descriptionCHText: "这是一个关于机械感与排版之美的实验性作品，将动态几何与长图叙事完美融合。", // 中文正文内容
    descriptionENText: "Experimental editorial layout blending mechanical motion with seamless long-form visual storytelling.", // 英文正文内容
    descriptionFontSize: "0.85vw",   // 正文字号
    descriptionFontWeight: "300",    // 正文字重
    descriptionLineHeight: "1.6",    // 正文行高
    descriptionLetterSpacing: "0.02em", // 正文字间距
    descriptionMarginTop: "2vh",     // 正文与上方标题区域的间距
    descriptionGap: "1.5vh",         // 中文正文与英文正文之间的间距
    descriptionColor: "rgba(255,255,255,0.7)", // 正文文字颜色

    // --- 副标题专用控制 (Subtitle Controls) ---
    subtitleText: "CASE STUDY",      // 副标题显示的文字内容 (可在此全局修改)
    subtitleFontSize: "4vw",         // 副标题的大小
    subtitleFontWeight: "900",       // 副标题的字重 (例如 100, 400, 900)
    subtitleLetterSpacing: "0.05em", // 副标题字间距
    subtitleLineHeight: "1.0",       // 副标题行高
    subtitleStrokeWidth: "0.015vw",   // 副标题镂空描边的粗细
    subtitleMarginTop: "0.5vh",      // 副标题与主标题之间的垂直距离

    chFontSize: "2vw",               // 滚筒中文文字的大小
    chLetterSpacing: "0.1em",        // 中文文字间距

    enFontSize: "2vw",               // 滚筒英文文字的大小
    enLetterSpacing: "0.05em",       // 英文文字间距

    drumTextAlign: "flex-start",      // 滚筒文字对齐方式 (flex-start, center, flex-end)

    // --- 未滚动到的（非活跃）文字样式参数 ---
    drumInactiveScale: 0.8,          // 未滚动到的文字缩放比例 (相当于控制缩小后的字号)
    drumActiveScale: 1.2,            // 滚动到中心的文字缩放比例
    drumInactiveStrokeCh: "0.5px rgba(255,255,255,0.4)", // 未滚动到的中文镂空描边 (粗细与颜色)
    drumInactiveStrokeEn: "0.5px rgba(255,255,255,0.4)", // 未滚动到的英文镂空描边 (粗细与颜色)
    drumActiveFontWeight: "700",     // 居中亮起文字的粗细 (例如 400 为正常, 700 为加粗, 900 为极粗)
    drumInactiveFontWeight: "700",   // 未滚动到的镂空文字的粗细

    // ====== 3. 图片细节 (Image Style) ======
    imageTopMargin: "5vh",           // 图片距离顶部的垂直距离
    imageBorderRadiusTop: "4rem",    // 图片顶部的圆角大小

    // ====== 4. 滚筒物理特性 (Drum Physics) ======
    drumSwitchThreshold: 0.90,       // 文字翻转阈值 (0.85 表示图片滚完 85% 时文字才开始滚动切换)
    drumSpringConfig: { stiffness: 200, damping: 25, mass: 1 }, // 更紧凑的弹簧，减少延迟感
    autoPlaySpeed: 1.2,              // 自动播放速度
    autoPlayResumeDelay: 1500,       // 交互后恢复自动播放的延迟
    scrollAccelerationFactor: 1.5,   // 降低加速度系数 (从 1.5 降到 1.2) 以减少抖动
};
