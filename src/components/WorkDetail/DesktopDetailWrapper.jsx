// src/components/WorkDetail/index.jsx
import React, { useRef, useState, useLayoutEffect } from "react";
import { motion, useScroll, useSpring, useTransform, useMotionValueEvent } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import DrumItem from "./DrumItem";
import EnhancedLazyImage from "./EnhancedLazyImage";
import DetailSidebar from "./DetailSidebar";
import { DETAIL_CONFIG } from "./constants";

const WorkDetail = ({ work, onClose }) => {
    // 1. 基础防御
    if (!work) return null;

    const [viewportW, setViewportW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920);
    const containerRef = useRef(null);
    const drumContainerRef = useRef(null);
    const touchStart = useRef(0);
    const lastInteractionTime = useRef(Date.now());

    // 2. 滚动状态与映射
    const { scrollY } = useScroll({ container: containerRef });
    const smoothScrollY = useSpring(scrollY, { stiffness: 100, damping: 30 });

    const originalItems = work.subItems || [];
    const totalItems = originalItems.length;

    const imageWidthValue = parseFloat(DETAIL_CONFIG.imageWidth) / 100;
    const pxImageWidth = imageWidthValue * viewportW;

    const cumulativeOffsets = React.useMemo(() => {
        const offsets = [0];
        originalItems.forEach((item) => {
            const height = pxImageWidth * (item.ratio || 1.5);
            offsets.push(offsets[offsets.length - 1] + height);
        });
        return offsets;
    }, [originalItems, pxImageWidth]);

    const totalScrollHeight = cumulativeOffsets[cumulativeOffsets.length - 1] || 4000;

    // 3. 滚筒引擎核心逻辑
    const ROULETTE_LOOPS = 6;
    const paddedItems = React.useMemo(() => {
        const items = [];
        for (let i = 0; i < ROULETTE_LOOPS; i++) items.push(...originalItems);
        items.push(...originalItems);
        return items;
    }, [originalItems]);

    const startIndex = ROULETTE_LOOPS * totalItems;

    // 4. 滚筒物理引擎 (高级重构)
    const [isReady, setIsReady] = useState(false);
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);

    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 945;

    // 核心测量逻辑 (重构为纯数学计算，消除 DOM 测量延迟)
    const drumCenters = React.useMemo(() => {
        // 转换 vh/vw 字符串为像素数值
        const parseValue = (val) => {
            if (typeof val === 'number') return val;
            const num = parseFloat(val);
            if (val.includes('vh')) return (num / 100) * viewportH;
            if (val.includes('vw')) return (num / 100) * viewportW;
            return num;
        };

        const itemH = parseValue(DETAIL_CONFIG.drumItemHeight);
        const gap = parseValue(DETAIL_CONFIG.drumItemGap);
        
        // 计算每个 DrumItem 的中心点位置
        return paddedItems.map((_, i) => {
            const offsetTop = i * (itemH + gap);
            return offsetTop + (itemH / 2);
        });
    }, [paddedItems, viewportH, viewportW]);

    // 立刻标记 Ready，无需等待测量
    useLayoutEffect(() => {
        if (drumCenters.length > 0) {
            setIsReady(true);
        }
    }, [drumCenters.length]);

    // 基础进度转换 (线性)
    const rawProgress = useTransform(smoothScrollY, (scrollPx) => {
        if (!totalItems) return 0;
        for (let i = 0; i < totalItems; i++) {
            if (scrollPx < cumulativeOffsets[i + 1]) {
                const fract = (scrollPx - cumulativeOffsets[i]) / (cumulativeOffsets[i + 1] - cumulativeOffsets[i]);
                if (i === totalItems - 1 || fract < DETAIL_CONFIG.drumSwitchThreshold) return i;
                const normalizedFract = (fract - DETAIL_CONFIG.drumSwitchThreshold) / (1 - DETAIL_CONFIG.drumSwitchThreshold);
                return i + normalizedFract;
            }
        }
        return totalItems - 1;
    });

    // 机械回弹弹簧 (Clock Bounce Physics)
    const elasticDrumProgress = useSpring(rawProgress, { 
        stiffness: 180, 
        damping: 14, 
        mass: 0.8,
        restDelta: 0.001 
    });

    // 最终滚动位置计算
    const drumY = useTransform(elasticDrumProgress, (progress) => {
        if (drumCenters.length <= startIndex) return 0;
        const totalProgress = startIndex + progress;
        const floorIdx = Math.floor(totalProgress);
        const fract = totalProgress - floorIdx;
        const idx1 = Math.min(floorIdx, drumCenters.length - 1);
        const idx2 = Math.min(floorIdx + 1, drumCenters.length - 1);
        const currentCenter = drumCenters[idx1] * (1 - fract) + drumCenters[idx2] * fract;
        return (viewportH / 2) - currentCenter;
    });

    React.useEffect(() => {
        if (isReady) {
            // 文字入场动画（约 1.2s-1.4s）完成后的延迟开启自动滚动
            const timer = setTimeout(() => {
                setIsAutoScrolling(true);
            }, 1500); 
            return () => clearTimeout(timer);
        }
    }, [isReady]);

    React.useEffect(() => {
        let rafId;
        const loop = () => {
            if (isAutoScrolling && Date.now() - lastInteractionTime.current > DETAIL_CONFIG.autoPlayResumeDelay) {
                if (containerRef.current) {
                    const atBottom = containerRef.current.scrollTop + containerRef.current.clientHeight >= containerRef.current.scrollHeight - 5;
                    if (atBottom) {
                        setIsAutoScrolling(false);
                    } else {
                        containerRef.current.scrollTop += DETAIL_CONFIG.autoPlaySpeed;
                    }
                }
            }
            if (isAutoScrolling) {
                rafId = requestAnimationFrame(loop);
            }
        };
        if (isAutoScrolling) {
            rafId = requestAnimationFrame(loop);
        }
        return () => cancelAnimationFrame(rafId);
    }, [isAutoScrolling]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const handleWheel = (e) => {
            e.stopPropagation();
            lastInteractionTime.current = Date.now();
            const atTop = container.scrollTop <= 0;
            const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 1;
            if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
                e.preventDefault();
            }
        };
        const handleTouchStart = (e) => {
            e.stopPropagation();
            lastInteractionTime.current = Date.now();
            touchStart.current = e.touches[0].clientY;
        };
        const handleTouchMove = (e) => e.stopPropagation();
        const handleTouchEnd = (e) => e.stopPropagation();

        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('touchstart', handleTouchStart, { passive: false });
        container.addEventListener('touchmove', handleTouchMove, { passive: false });
        container.addEventListener('touchend', handleTouchEnd, { passive: true });
        
        return () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('touchstart', handleTouchStart);
            container.removeEventListener('touchmove', handleTouchMove);
            container.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    // 6. UI 变体
    const parentVariants = { animate: { transition: { staggerChildren: 0.1 } } };
    const itemVariants = {
        initial: { y: 60, opacity: 0 },
        animate: { y: 0, opacity: 1, transition: { duration: 0.8, ease: "easeOut" } }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#0a0a0a] text-white overflow-y-auto"
            ref={containerRef}
        >
            <div style={{ height: totalScrollHeight }} className="w-full" />
            <div className="fixed inset-0 pointer-events-none flex flex-col">
                {/* Header */}
                <div 
                    className="flex justify-between items-center py-8 pointer-events-auto z-50"
                    style={{ paddingLeft: DETAIL_CONFIG.layoutLeftMargin, paddingRight: DETAIL_CONFIG.layoutRightMargin }}
                >
                    <button onClick={onClose} className="text-xl font-bold tracking-widest lowercase flex items-center gap-2">
                        <ArrowLeft className="w-5 h-5" /> back
                    </button>
                </div>

                <div className="flex-1 w-full relative">
                    <DetailSidebar 
                        work={work} 
                        config={DETAIL_CONFIG} 
                        parentVariants={parentVariants} 
                        itemVariants={itemVariants} 
                    />

                    {/* 中央图片区 */}
                    <motion.div
                        initial={{ y: "100vh" }} animate={{ y: 0 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute top-0 overflow-visible z-10"
                        style={{ 
                            width: DETAIL_CONFIG.imageWidth, top: DETAIL_CONFIG.imageTopMargin,
                            left: `calc(${DETAIL_CONFIG.layoutLeftMargin} + ${DETAIL_CONFIG.layoutLeftPanelWidth} + ${DETAIL_CONFIG.layoutGap1})` 
                        }}
                    >
                        <div className="bg-zinc-900 border border-white/10 relative w-full overflow-hidden" style={{ height: "90vh", borderRadius: `${DETAIL_CONFIG.imageBorderRadiusTop} ${DETAIL_CONFIG.imageBorderRadiusTop} 0 0` }}>
                            <motion.div className="w-full flex flex-col relative" style={{ y: useTransform(smoothScrollY, y => -y) }}>
                                {work.subItems?.map((item, idx) => (
                                    <EnhancedLazyImage 
                                        key={idx} 
                                        src={item.img} 
                                        alt="" 
                                        height={cumulativeOffsets[idx + 1] - cumulativeOffsets[idx]} 
                                    />
                                ))}
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* 文字滚筒 */}
                    <div 
                        className="absolute inset-y-0 pointer-events-none z-20"
                        style={{ 
                            left: `calc(${DETAIL_CONFIG.layoutLeftMargin} + ${DETAIL_CONFIG.layoutLeftPanelWidth} + ${DETAIL_CONFIG.layoutGap1} + ${DETAIL_CONFIG.imageWidth} + ${DETAIL_CONFIG.layoutGap2})`,
                            width: DETAIL_CONFIG.layoutDrumWidth,
                        }}
                    >
                        <motion.div
                            className="absolute flex flex-col w-full"
                            style={{ 
                                y: drumY, 
                                gap: DETAIL_CONFIG.drumItemGap,
                                opacity: isReady ? 1 : 0 // 测量未完成前隐藏，防止闪烁
                            }}
                            ref={drumContainerRef}
                        >
                            {paddedItems.map((item, index) => (
                                <DrumItem 
                                    key={index} 
                                    item={item} 
                                    index={index} 
                                    scrollProgress={elasticDrumProgress} 
                                    startIndex={startIndex} 
                                    drumConfig={DETAIL_CONFIG} 
                                    parentReady={isReady}
                                />
                            ))}
                        </motion.div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default WorkDetail;
