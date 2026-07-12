// src/components/Works/WorkCard.jsx
import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { CONFIG } from "./constants";

const WorkCard = ({ work, isExpanded, onMouseEnter }) => {
    const cardRef = useRef(null);

    // 基于鼠标位置的倾斜逻辑 (仅在该卡片展开时激活)
    const x = useMotionValue(0.5);
    const y = useMotionValue(0.5);

    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });

    const rotateX = useTransform(mouseYSpring, [0, 1], [CONFIG.tiltMaxRotateX, -CONFIG.tiltMaxRotateX]);
    const rotateY = useTransform(mouseXSpring, [0, 1], [-CONFIG.tiltMaxRotateY, CONFIG.tiltMaxRotateY]);

    const handleMouseMove = (e) => {
        if (!isExpanded || !cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const xPct = mouseX / width;
        const yPct = mouseY / height;
        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        x.set(0.5);
        y.set(0.5);
    };

    return (
        <div
            ref={cardRef}
            onClick={() => isExpanded && window.dispatchEvent(new CustomEvent('open-detail', { detail: work.id }))}
            onMouseEnter={onMouseEnter}
            onMouseMove={isExpanded ? handleMouseMove : undefined}
            onMouseLeave={handleMouseLeave}
            className="relative h-full rounded-[1.5rem] overflow-visible cursor-pointer shrink-0"
            style={{
                transition: 'width 800ms cubic-bezier(0.25, 1, 0.5, 1)',
                width: isExpanded ? CONFIG.desktopExpandedWidth : CONFIG.desktopSqueezedWidth,
                perspective: "1000px", // 为 3D 转换提供透视
            }}
        >
            <motion.div
                className="relative w-full h-full rounded-[1.5rem] overflow-hidden border border-transparent hover:border-white/20 shadow-2xl"
                style={{
                    rotateX: isExpanded ? rotateX : 0,
                    rotateY: isExpanded ? rotateY : 0,
                    transformStyle: "preserve-3d",
                }}
            >
                {/* 图片层 */}
                <img
                    src={work.image}
                    alt={work.title}
                    className={`
                        absolute inset-0 w-full h-full object-cover origin-center
                        transition-transform duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]
                        ${isExpanded ? "scale-100" : "scale-[1.05]"}
                    `}
                />

                {/* 文字层 */}
                <div
                    className={`
                        absolute top-6 z-20 whitespace-nowrap
                        text-white/90 drop-shadow-md font-sans tracking-[0.2em] md:tracking-[0.3em] font-semibold
                        transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]
                        ${isExpanded ? "left-6" : "left-1/2"}
                    `}
                    style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'upright',
                        transform: isExpanded ? "translateX(0) translateZ(30px)" : "translateX(-50%) translateZ(0px)",
                    }}
                >
                    {work.title}
                </div>

                {/* 表面蒙版 (挤压状态) */}
                <div
                    className={`
                        absolute -inset-1 pointer-events-none 
                        transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]
                        ${isExpanded ? "opacity-0" : "opacity-100 backdrop-blur-sm bg-black/20"}
                    `}
                >
                    <div className="absolute inset-0 reflective-noise mix-blend-overlay opacity-30"></div>
                </div>

                {/* 表面蒙版 (展开状态) */}
                <div
                    className={`
                        absolute inset-0 pointer-events-none mix-blend-overlay reflective-sheen animate-reflective-shine
                        transition-all duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)]
                        ${isExpanded ? "opacity-40" : "opacity-0"}
                    `}
                ></div>
            </motion.div>
        </div>
    );
};

export default WorkCard;
