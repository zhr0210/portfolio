// src/components/WorkDetail/DrumItem.jsx
import React from "react";
import { motion, useTransform } from "framer-motion";

const DrumItem = ({ item, index, scrollProgress, startIndex, drumConfig, parentReady }) => {
    // 1. 物理层 (3D Cylinder Physics)
    const offset = useTransform(scrollProgress, (p) => (index - startIndex) - p);
    
    // 3D 旋转与位移：模拟滚轮圆弧感
    const rotateX = useTransform(offset, [-2, 0, 2], [45, 0, -45]);
    const translateZ = useTransform(offset, [-2, 0, 2], [-100, 0, -100]);
    const translateY = useTransform(offset, [-2, 0, 2], [20, 0, -20]);

    // 2. 视觉层 (Visual States)
    // 中心活跃度：0 为正中心，1 为远处
    const absoluteOffset = useTransform(offset, (o) => Math.abs(o));
    
    // 实体文字透明度：只有正中心是 100% 实体
    const solidOpacity = useTransform(offset, [-0.5, 0, 0.5], [0, 1, 0]);
    
    // 镂空文字透明度：越靠近边缘越透明
    const hollowOpacity = useTransform(offset, [-3, -1.5, 0, 1.5, 3], [0, 0.3, 0.5, 0.3, 0]);
    
    // 整体缩放 (运用 constants 里的参数，否则会有备用值)
    const scale = useTransform(offset, [-2, 0, 2], [
        drumConfig.drumInactiveScale || 0.8, 
        drumConfig.drumActiveScale || 1.2, 
        drumConfig.drumInactiveScale || 0.8
    ]);

    // 3. 入场层 (Entrance Logic)
    // 从下往上依次显示，间隔 0.3s
    const relativeIndex = index - startIndex;
    const isInitialVisible = relativeIndex >= -2 && relativeIndex < 12;
    
    // 底部优先：索引越大（越靠下）延迟越小
    // 这里的 6 是一个根据视野估算的偏移量，确保底部项目接近 0s 启动
    const entranceDelay = isInitialVisible ? Math.max(0, (6 - relativeIndex) * 0.1) : 0;

    const chText = item.subtitle ? item.subtitle.split(" ")[0] : "";
    const parts = item.subtitle ? item.subtitle.split(" ") : [""];
    const enText = parts.slice(1).join(" ");

    return (
        <motion.div
            className="drum-item relative flex flex-col justify-center w-full shrink-0 overflow-visible"
            style={{ 
                height: drumConfig.drumItemHeight, 
                rotateX,
                z: translateZ,
                y: translateY,
                scale,
                transformStyle: "preserve-3d",
                alignItems: drumConfig.drumTextAlign 
            }}
        >
            <motion.div
                className="w-full relative flex flex-col"
                initial={{ opacity: 0, y: 60, filter: "blur(15px)" }}
                animate={parentReady ? { 
                    opacity: 1, 
                    y: 0, 
                    filter: "blur(0px)" 
                } : {}}
                transition={{ 
                    duration: 0.8, 
                    delay: entranceDelay,
                    ease: [0.22, 1, 0.36, 1] 
                }}
                style={{ alignItems: drumConfig.drumTextAlign }}
            >
                {/* 文字光晕层 (仅在中心附近显示) */}
                <motion.div 
                    className="absolute inset-0 pointer-events-none blur-3xl bg-white/5 rounded-full"
                    style={{ opacity: useTransform(solidOpacity, [0, 1], [0, 0.4]), scale: 1.2 }}
                />

                {/* 内容区 */}
                <div className="relative z-10">
                    {/* 中文行 */}
                    <div className="relative mb-1" style={{ fontSize: drumConfig.chFontSize, letterSpacing: drumConfig.chLetterSpacing }}>
                        <motion.div 
                            className="leading-[1.1] uppercase transition-all"
                            style={{ 
                                opacity: hollowOpacity,
                                fontWeight: drumConfig.drumInactiveFontWeight || "700",
                                WebkitTextStroke: drumConfig.drumInactiveStrokeCh || "1px rgba(255,255,255,0.6)",
                                color: "transparent"
                            }}
                        >
                            {chText}
                        </motion.div>
                        <motion.div 
                            className="absolute inset-0 leading-[1.1] text-white" 
                            style={{ 
                                opacity: solidOpacity,
                                fontWeight: drumConfig.drumActiveFontWeight || "700",
                                filter: "drop-shadow(0 0 12px rgba(255,255,255,0.5))"
                            }}
                        >
                            {chText}
                        </motion.div>
                    </div>

                    {/* 英文行 */}
                    <div className="relative" style={{ fontSize: drumConfig.enFontSize, letterSpacing: drumConfig.enLetterSpacing }}>
                        <motion.div 
                            className="leading-[1.1] uppercase transition-all"
                            style={{ 
                                opacity: hollowOpacity,
                                fontWeight: drumConfig.drumInactiveFontWeight || "700",
                                WebkitTextStroke: drumConfig.drumInactiveStrokeEn || "0.5px rgba(255,255,255,0.5)",
                                color: "transparent"
                            }}
                        >
                            {enText}
                        </motion.div>
                        <motion.div 
                            className="absolute inset-0 leading-[1.1] text-white uppercase" 
                            style={{ 
                                opacity: solidOpacity,
                                fontWeight: drumConfig.drumActiveFontWeight || "700",
                                filter: "drop-shadow(0 0 8px rgba(255,255,255,0.4))"
                            }}
                        >
                            {enText}
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default DrumItem;
