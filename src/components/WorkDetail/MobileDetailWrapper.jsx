// src/components/WorkDetail/WorkDetailMobile.jsx
import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const WorkDetailMobile = ({ work, onClose }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAtBottom, setIsAtBottom] = useState(false);
    const [isAtTop, setIsAtTop] = useState(true);
    const touchY = useRef(0);
    
    // Prevent background scrolling and global page switching while in this view
    useEffect(() => {
        document.body.style.overflow = "hidden";
        window.dispatchEvent(new Event('pause-scroll'));
        return () => { 
            document.body.style.overflow = ""; 
            window.dispatchEvent(new Event('resume-scroll'));
        };
    }, []);

    if (!work || !work.subItems) return null;

    const activeItem = work.subItems[activeIndex];
    
    const splitTitle = (subtitle) => {
        if (!subtitle) return { cn: "", en: "" };
        const parts = subtitle.split(' ');
        const cn = parts[0];
        const en = parts.slice(1).join(' ');
        return { cn, en }; // e.g. "盛启预告" and "Grand Opening Preview"
    };

    const handleScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        // Check if at bottom (10px tolerance for mobile decimals)
        setIsAtBottom(scrollTop + clientHeight >= scrollHeight - 10);
        setIsAtTop(scrollTop <= 10);
    };

    const handleTouchStart = (e) => {
        touchY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e) => {
        const delta = e.changedTouches[0].clientY - touchY.current;
        // Swipe Up (Negative Delta) at the bottom -> Next Card
        if (delta < -40 && isAtBottom && activeIndex < work.subItems.length - 1) {
            setActiveIndex(prev => prev + 1);
        }
        // Swipe Down (Positive Delta) at the top -> Prev Card
        if (delta > 40 && isAtTop && activeIndex > 0) {
            setActiveIndex(prev => prev - 1);
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: "0%" }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[120] bg-[#0a0a0a] text-white overflow-hidden pointer-events-auto"
        >
            {/* Back Button positioned ABOVE the global Nav Title */}
            <button 
                onClick={onClose} 
                className="fixed top-2 left-4 text-xs font-bold tracking-widest lowercase flex items-center gap-1.5 z-[150] px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20"
            >
                <ArrowLeft className="w-3.5 h-3.5" /> back
            </button>

            {/* Dynamic Title area moved UP, but keeping distance from global title */}
            <div className="fixed top-[12vh] left-0 right-0 px-6 z-30 pointer-events-none">
                <AnimatePresence mode="popLayout">
                    {activeItem && (
                        <motion.div
                            key={activeIndex}
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -20, opacity: 0 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="flex flex-col gap-1.5 drop-shadow-2xl mix-blend-difference"
                        >
                            <h2 className="text-3xl font-black tracking-wider text-white">
                                {splitTitle(activeItem.subtitle).cn}
                            </h2>
                            <p className="text-[0.6rem] uppercase tracking-[0.3em] font-bold text-white/70 mt-0.5">
                                {splitTitle(activeItem.subtitle).en}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Fixed Container for Images - starts ~3vh below text */}
            <div className="absolute top-[22vh] bottom-0 left-0 right-0 w-full overflow-hidden flex justify-center">
                {work.subItems.map((item, idx) => {
                    const isActive = idx === activeIndex;
                    const isPast = idx < activeIndex;
                    const isFuture = idx > activeIndex;

                    // Staggering formula for future cards
                    const staggerOffset = isFuture ? (idx - activeIndex) * 1.5 : 0; 
                    
                    return (
                        <motion.div 
                            key={idx}
                            initial={false}
                            animate={{
                                y: isPast ? 0 : isFuture ? `calc(100% - ${12 - staggerOffset}vh)` : 0,
                                scale: isPast ? 0.95 : 1,
                                opacity: isPast ? 0.4 : 1,
                                filter: isPast ? "blur(4px)" : "blur(0px)",
                                zIndex: idx + 10,
                            }}
                            transition={{ duration: 0.6, type: "spring", bounce: 0.15 }}
                            className="absolute inset-0 w-full bg-[#060606] shadow-[0_-15px_40px_rgba(0,0,0,0.8)]"
                            style={{
                                borderTopLeftRadius: '32px',
                                borderTopRightRadius: '32px',
                            }}
                        >
                            {/* Scrollable container for the active image */}
                            <div 
                                className={`w-full h-full ${isActive ? 'overflow-y-auto' : 'overflow-hidden pointer-events-none'}`}
                                onScroll={handleScroll}
                                onTouchStart={isActive ? handleTouchStart : undefined}
                                onTouchEnd={isActive ? handleTouchEnd : undefined}
                            >
                                <img 
                                    src={item.img} 
                                    alt={item.subtitle} 
                                    className="w-full h-auto min-h-[50vh] pb-[10vh]"
                                />
                            </div>

                            {/* Clickable edge to quickly jump to a peeking future card */}
                            {isFuture && (
                                <div 
                                    className="absolute top-0 left-0 right-0 h-full cursor-pointer z-50 bg-black/20 hover:bg-transparent"
                                    onClick={() => setActiveIndex(idx)}
                                />
                            )}
                        </motion.div>
                    );
                })}
            </div>
            
            {/* Scroll Indication line at the bottom when not at the end of stack */}
            <AnimatePresence>
                {!isAtBottom && activeIndex < work.subItems.length - 1 && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center gap-2"
                    >
                        <span className="text-[10px] tracking-widest text-white/50 uppercase">Scroll / Swipe Down</span>
                        <div className="w-[1px] h-6 bg-gradient-to-b from-white/50 to-transparent" />
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default WorkDetailMobile;
