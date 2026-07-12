// src/components/Works/WorksDesktop.jsx
import React, { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import WorkCard from "./WorkCard";
import { CONFIG } from "./constants";
import { mockWorks } from "./data";
import WorkDetail from "../WorkDetail/index"; 

const WorksDesktop = () => {
    const [hoveredIndex, setHoveredIndex] = useState(-1);
    const [isInteractive, setIsInteractive] = useState(false);
    const [selectedWorkId, setSelectedWorkId] = useState(null);

    useEffect(() => {
        let timeoutId;

        const handleHoverEnter = () => {
            setHoveredIndex(0);
            timeoutId = setTimeout(() => {
                setIsInteractive(true);
            }, 800);
        };

        const handleHoverLeave = () => {
            clearTimeout(timeoutId);
            setHoveredIndex(-1);
            setIsInteractive(false);
        };

        const handleOpenDetail = (e) => {
            window.dispatchEvent(new Event('pause-scroll'));
            
            gsap.to('.work-card-item', {
                x: "150vw",
                duration: 1,
                stagger: 0.05,
                ease: "power3.in",
                onComplete: () => {
                    setSelectedWorkId(e.detail);
                }
            });

            gsap.to('#dynamic-nav-title', {
                y: -150,
                opacity: 0,
                duration: 0.8,
                ease: "power3.in"
            });

            // 下方跑马灯出场：加速度向右侧滚动出屏并渐隐
            gsap.to('#marquee-bottom-track', {
                x: "100vw",
                opacity: 0,
                duration: 1,
                ease: "power3.in"
            });

            // 上方跑马灯出场：加速度向左侧滚动出屏并渐隐 (与其自身滚动方向一致)
            gsap.to('#marquee-top-track', {
                x: "-100vw",
                opacity: 0,
                duration: 1,
                ease: "power3.in"
            });
        };

        window.addEventListener('works-entered', handleHoverEnter);
        window.addEventListener('works-left', handleHoverLeave);
        window.addEventListener('open-detail', handleOpenDetail);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('works-entered', handleHoverEnter);
            window.removeEventListener('works-left', handleHoverLeave);
            window.removeEventListener('open-detail', handleOpenDetail);
        };
    }, []);

    const handleCloseDetail = () => {
        setSelectedWorkId(null);

        gsap.to('.work-card-item', {
            x: "0vw",
            duration: 1.2,
            stagger: 0.05,
            ease: "power3.out",
            onComplete: () => {
                window.dispatchEvent(new Event('resume-scroll'));
            }
        });

        gsap.to('#dynamic-nav-title', {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: "power3.out"
        });

        // 下方跑马灯返场：从左侧极速滑入
        gsap.fromTo('#marquee-bottom-track', 
            { x: "-100vw", opacity: 1 }, 
            {
                x: "0vw",
                duration: 1.2,
                ease: "power3.out"
            }
        );

        // 上方跑马灯返场：从右侧极速滑入
        gsap.fromTo('#marquee-top-track', 
            { x: "100vw", opacity: 1 }, 
            {
                x: "0vw",
                duration: 1.2,
                ease: "power3.out"
            }
        );
    };

    const selectedWork = mockWorks.find(w => w.id === selectedWorkId);

    return (
        <React.Fragment>
            <div
                className="flex flex-row items-center justify-center gap-2 lg:gap-3 mx-auto overflow-hidden px-[2.5vw] w-full pointer-events-auto"
                style={{ height: CONFIG.containerHeight }}
            >
                {mockWorks.map((work, index) => (
                    <div key={work.id} className="work-card-item shrink-0 h-full">
                        <WorkCard
                            work={work}
                            isExpanded={index === hoveredIndex}
                            onMouseEnter={() => {
                                if (isInteractive) {
                                    setHoveredIndex(index);
                                }
                            }}
                        />
                    </div>
                ))}
            </div>

            {/* 详情页组件全屏覆盖 */}
            <AnimatePresence>
                {selectedWorkId && selectedWork && (
                    <WorkDetail
                        work={selectedWork}
                        onClose={handleCloseDetail}
                    />
                )}
            </AnimatePresence>
        </React.Fragment>
    );
};

export default WorksDesktop;
