// src/components/WorkDetail/mobile/Project1Mobile.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const splitTitle = (subtitle) => {
    if (!subtitle) return { cn: "", en: "" };
    const parts = subtitle.split(' ');
    // If only one word, the eng part will be empty, which is fine
    return { cn: parts[0], en: parts.slice(1).join(' ') };
};

const AutoScrollImageModal = ({ item, onClose }) => {
    const scrollContainerRef = useRef(null);
    const [isAtBottom, setIsAtBottom] = useState(false);
    const touchStart = useRef(0);

    useEffect(() => {
        let rafId;
        const speed = 1.2; 

        const scroll = () => {
            const container = scrollContainerRef.current;
            if (!container) return;
            
            if (container.scrollTop + container.clientHeight >= container.scrollHeight - 5) {
                setTimeout(() => {
                    onClose();
                }, 1500);
                return;
            }

            container.scrollTop += speed;
            rafId = requestAnimationFrame(scroll);
        };

        const timeout = setTimeout(() => {
            rafId = requestAnimationFrame(scroll);
        }, 1200);

        return () => {
            clearTimeout(timeout);
            cancelAnimationFrame(rafId);
        };
    }, [onClose]);

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        if (scrollTop + clientHeight >= scrollHeight - 5) {
            setIsAtBottom(true);
            setTimeout(() => {
                onClose();
            }, 800);
        } else {
            setIsAtBottom(false);
        }
    };

    const handleTouchStart = (e) => {
        touchStart.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
        const delta = e.changedTouches[0].clientY - touchStart.current;
        const container = scrollContainerRef.current;
        if (container && container.scrollTop <= 10 && delta > 80) {
            onClose();
        }
    };

    const titleParts = splitTitle(item.subtitle);

    return (
        <motion.div
            initial={{ y: "100%", opacity: 0.5 }}
            animate={{ y: "10vh", opacity: 1 }}
            exit={{ y: "100%", opacity: 0.5 }}
            transition={{ duration: 0.8, type: "spring", bounce: 0.15 }}
            className="fixed inset-x-0 bottom-0 top-0 z-[150] bg-[#0a0a0a] shadow-[0_-20px_40px_rgba(0,0,0,0.8)] flex flex-col"
            style={{
                borderTopLeftRadius: '32px',
                borderTopRightRadius: '32px',
                height: '90vh',
                top: 'auto'
            }}
        >
            {/* Title floating completely ABOVE the modal drawer */}
            <div className="absolute bottom-[100%] left-0 w-full px-6 pb-5 flex flex-col gap-1.5 z-50 pointer-events-none drop-shadow-2xl">
                <h2 className="text-[1.8rem] font-black tracking-wider text-white leading-none">{titleParts.cn}</h2>
                {titleParts.en && (
                    <p className="text-[0.6rem] uppercase tracking-[0.2em] font-bold text-white/80">{titleParts.en}</p>
                )}
            </div>

            {/* Modal Capsule Handle */}
            <div 
                className="absolute top-0 inset-x-0 h-10 flex justify-center items-center z-30 pointer-events-none drop-shadow-md"
            >
                <div className="w-12 h-1.5 bg-white/40 mix-blend-overlay rounded-full" />
            </div>

            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="w-full h-full overflow-y-auto pb-[15vh] relative z-20"
                style={{
                    borderTopLeftRadius: '32px',
                    borderTopRightRadius: '32px',
                }}
            >
                <img src={item.img} alt={item.subtitle} className="w-full h-auto min-h-screen" />
            </div>
        </motion.div>
    );
};

const Project1Mobile = ({ work, onClose }) => {
    const [activeCardIndex, setActiveCardIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [selectedSubItemIndex, setSelectedSubItemIndex] = useState(null);

    useEffect(() => {
        if (isPaused || selectedSubItemIndex !== null) return;
        const timer = setInterval(() => {
            setActiveCardIndex((prev) => (prev + 1) % work.subItems.length);
        }, 3500);
        return () => clearInterval(timer);
    }, [isPaused, selectedSubItemIndex, work.subItems.length]);

    // Prevent background scrolling and global page switching while in this view
    useEffect(() => {
        document.body.style.overflow = "hidden";
        window.dispatchEvent(new Event('pause-scroll'));
        return () => { 
            document.body.style.overflow = ""; 
            window.dispatchEvent(new Event('resume-scroll'));
        };
    }, []);

    const handleDragStart = () => {
        setIsPaused(true);
    };

    const handleDragEnd = (e, info) => {
        setIsPaused(false);
        const swipeThreshold = 50;
        if (info.offset.x < -swipeThreshold) {
            setActiveCardIndex(prev => Math.min(prev + 1, work.subItems.length - 1));
        } else if (info.offset.x > swipeThreshold) {
            setActiveCardIndex(prev => Math.max(prev - 1, 0));
        }
    };

    const handleBackClick = () => {
        if (selectedSubItemIndex !== null) {
            setSelectedSubItemIndex(null); // Return to horizontal card carousel
        } else {
            onClose(); // Exit to main works page
        }
    };

    return (
        <div className="fixed inset-0 z-[120] bg-[#060606] text-white overflow-hidden pointer-events-auto">
            {/* 顶层返回按钮 */}
            <div className="absolute top-2 left-4 z-[160] pointer-events-none">
                <button 
                    onClick={handleBackClick} 
                    className="text-xs font-bold tracking-widest lowercase flex items-center gap-1.5 pointer-events-auto backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 bg-white/10 transition-colors w-fit"
                >
                    <ArrowLeft className="w-3.5 h-3.5" /> back
                </button>
            </div>

            {/* 底层卡片轮播：和主界面保持完全一样的横向布局 */}
            <AnimatePresence>
                {selectedSubItemIndex === null && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9 }}
                        transition={{ duration: 0.6 }}
                        className="absolute inset-0 flex items-center justify-center pt-8"
                    >
                        {work.subItems.map((item, index) => {
                            const isActive = index === activeCardIndex;
                            const offset = index - activeCardIndex;

                            return (
                                <motion.div 
                                    key={index}
                                    animate={{
                                        x: `calc(${offset * 85}vw)`,
                                        scale: isActive ? 1 : 0.85,
                                        opacity: Math.abs(offset) > 2 ? 0 : isActive ? 1 : 0.5,
                                        filter: isActive ? "blur(0px) brightness(1)" : "blur(4px) brightness(0.6)"
                                    }}
                                    transition={{ duration: 0.6, type: "spring", bounce: 0.2 }}
                                    drag="x"
                                    dragConstraints={{ left: 0, right: 0 }}
                                    dragElastic={0.2}
                                    onDragStart={handleDragStart}
                                    onDragEnd={handleDragEnd}
                                    onClick={() => {
                                        if (isActive) {
                                            setSelectedSubItemIndex(index);
                                        } else {
                                            setActiveCardIndex(index);
                                            setIsPaused(true);
                                            setTimeout(() => setIsPaused(false), 5000);
                                        }
                                    }}
                                    className={`absolute w-[75vw] aspect-[9/16] rounded-[24px] overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)]
                                        ${isActive ? "z-20 cursor-grab active:cursor-grabbing" : "z-10 cursor-pointer"}`}
                                >
                                    <motion.img 
                                        src={item.img} 
                                        alt={item.subtitle}
                                        className="w-full h-full object-cover" 
                                        animate={{ scale: isActive ? 1 : 1.15 }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                        draggable={false}
                                    />
                                    
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none" />

                                    <motion.div 
                                        className="absolute inset-0 flex flex-col justify-end p-6 z-30 pointer-events-none"
                                        animate={{ y: isActive ? 0 : 20, opacity: isActive ? 1 : 0 }}
                                        transition={{ duration: 0.6 }}
                                    >
                                        <h3 className="text-xl font-bold text-white mb-0 tracking-wider leading-tight w-[100%] drop-shadow-lg">
                                            {item.subtitle}
                                        </h3>
                                    </motion.div>
                                </motion.div>
                            );
                        })}

                        {/* Pagination 指示器 */}
                        <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-1.5 z-0 pointer-events-auto">
                            {work.subItems.map((_, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => {
                                        setActiveCardIndex(idx);
                                        setIsPaused(true);
                                        setTimeout(() => setIsPaused(false), 5000);
                                    }}
                                    className={`h-1.5 rounded-full transition-all duration-300 ease-out cursor-pointer 
                                        ${idx === activeCardIndex ? "bg-white w-6" : "bg-white/30 w-1.5 hover:bg-white/60"}`}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 顶层自动滚动图片模态框 */}
            <AnimatePresence>
                {selectedSubItemIndex !== null && (
                    <AutoScrollImageModal 
                        item={work.subItems[selectedSubItemIndex]} 
                        onClose={() => setSelectedSubItemIndex(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default Project1Mobile;
