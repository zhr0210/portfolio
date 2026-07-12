// src/components/Works/WorksMobile.jsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { mockWorks } from "./data";
import WorkDetailMobile from "../WorkDetail/WorkDetailMobile";

const WorksMobile = () => {
    const [selectedWorkId, setSelectedWorkId] = useState(null);
    const [activeCardIndex, setActiveCardIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const handleOpenDetail = (id) => {
        setSelectedWorkId(id);
    };

    const handleCloseDetail = () => {
        setSelectedWorkId(null);
    };

    const selectedWork = mockWorks.find(w => w.id === selectedWorkId);

    // Auto-rotate logic
    useEffect(() => {
        if (isPaused || selectedWorkId) return;
        const timer = setInterval(() => {
            setActiveCardIndex((prev) => (prev + 1) % mockWorks.length);
        }, 3500);
        return () => clearInterval(timer);
    }, [isPaused, selectedWorkId]);

    // Prevent background scrolling while in this view
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    const handleDragStart = () => {
        setIsPaused(true);
        // Pause the global useScrollApp to prevent accidental scene changes (like going back to Hero) while swiping cards
        window.dispatchEvent(new Event('pause-scroll'));
    };

    const handleDragEnd = (e, info) => {
        setIsPaused(false);
        // Resume global useScrollApp
        window.dispatchEvent(new Event('resume-scroll'));
        
        const swipeThreshold = 50;
        if (info.offset.x < -swipeThreshold) {
            // Swipe left -> Next card
            setActiveCardIndex(prev => Math.min(prev + 1, mockWorks.length - 1));
        } else if (info.offset.x > swipeThreshold) {
            // Swipe right -> Prev card
            setActiveCardIndex(prev => Math.max(prev - 1, 0));
        }
    };

    return (
        <div className="w-full h-[100dvh] relative overflow-hidden bg-transparent text-white">
            
            <div className="absolute inset-0 flex items-center justify-center">
                {mockWorks.map((work, index) => {
                    const isActive = index === activeCardIndex;
                    const offset = index - activeCardIndex;

                    return (
                        <motion.div 
                            key={work.id}
                            custom={index}
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
                                    handleOpenDetail(work.id);
                                } else {
                                    setActiveCardIndex(index);
                                    setIsPaused(true);
                                    setTimeout(() => setIsPaused(false), 5000);
                                }
                            }}
                            className={`absolute w-[75vw] aspect-[9/16] rounded-[24px] overflow-hidden shadow-2xl
                                ${isActive ? "z-20 cursor-grab active:cursor-grabbing" : "z-10 cursor-pointer"}`}
                            style={{
                                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)"
                            }}
                        >
                            <motion.img 
                                src={work.image || work.img} 
                                alt={work.title} 
                                className="w-full h-full object-cover" 
                                animate={{ scale: isActive ? 1 : 1.15 }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                draggable={false}
                            />
                            
                            {/* Subtle dark gradient pad for text readability */}
                            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10 pointer-events-none" />

                            <motion.div 
                                className="absolute inset-0 flex flex-col justify-end p-6 z-30 pointer-events-none"
                                animate={{ y: isActive ? 0 : 20, opacity: isActive ? 1 : 0 }}
                                transition={{ duration: 0.6 }}
                            >
                                <h3 className="text-2xl font-bold text-white mb-1 uppercase tracking-wider leading-tight w-[100%]">{work.title}</h3>
                                {work.subItems && work.subItems.length > 0 && (
                                    <p className="text-xs text-white/50 font-light tracking-widest mt-2 uppercase">{work.subItems[0].subtitle.split(' ')[0]}</p>
                                )}
                            </motion.div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Pagination Indicators Container */}
            <motion.div 
                className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-1.5 z-0 pointer-events-auto"
            >
                {mockWorks.map((w, idx) => (
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
            </motion.div>

            <AnimatePresence>
                {selectedWorkId && selectedWork && (
                    <WorkDetailMobile 
                        work={selectedWork} 
                        onClose={handleCloseDetail} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default WorksMobile;
