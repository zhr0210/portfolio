import { useLayoutEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Observer } from "gsap/observer";

// 注册需要的插件
gsap.registerPlugin(ScrollTrigger, Observer);

// ====== 滚动与滑入动画参数配置区 ======
const SCROLL_CONFIG = {
    // 卡片入场动画
    cardSlideDuration: 3.2,       // 每个卡片的滑动时长（变长以体现曲线感）
    cardStagger: 0.18,            // 每张卡片出现的间隔时间
    cardEase: "expo.out",         // 卡片滑动曲线 (expo.out 具有强烈的极速进入然后缓慢停下的高级顺滑感)

    // 页面跳转过渡
    sectionTransitionDuration: 3, // 页面滚动切换时的全局总时长
};

export const useScrollApp = () => {
    useLayoutEffect(() => {
        console.log("⚡️ [Scroll App Observer Model]: Initialization started...");

        // 选取所有的场景和轨道内容
        const hero = document.getElementById('scene-hero');
        const worksScene = document.getElementById('scene-works');
        const archiveScene = document.getElementById('scene-archive');
        const aiLabScene = document.getElementById('scene-ai-lab');
        const footerScene = document.getElementById('scene-footer');

        // 跑马灯元素
        const marqueeTop = document.getElementById('marquee-top-track');
        const marqueeBottom = document.getElementById('marquee-bottom-track');

        // 初始化状态定位
        gsap.set(marqueeTop, { xPercent: 0 });
        gsap.set(marqueeBottom, { xPercent: -50 });

        // 选取动态导航标题
        const navTitle = document.getElementById('dynamic-nav-title');
        const worksTitle = '核心商业案例 <span class="title-sep">|</span> <span class="title-sub">SELECTED WORKS</span>';
        const archiveTitle = '履历回顾 <span class="title-sep">|</span> <span class="title-sub">DIGITAL ARCHIVE</span>';
        const aiLabTitle = '智能实验室 <span class="title-sep">|</span> <span class="title-sub">AI SYNTHESIS LAB</span>';

        // 获取卡片 DOM，由于 React 是挂载后执行 LayoutEffect，可以直接选取
        const workCards = gsap.utils.toArray('.work-card-item');

        // 所有准备就绪的不可见幻灯片保持隐身和脱离互动区
        gsap.set([worksScene, archiveScene, aiLabScene, footerScene],
            { opacity: 0, y: 100, pointerEvents: "none" });

        // 预设 Works 卡片在屏幕右侧外，且带有动态模糊
        gsap.set(workCards, { x: "100vw", filter: "blur(15px)" });

        // 构建核心时间轴
        const tl = gsap.timeline({
            paused: true,
            defaults: { ease: "none" }
        });

        const labels = [];
        tl.addLabel("start");
        labels.push("start");

        // Phase 1: Hero -> Works
        tl.to(hero, { opacity: 0, pointerEvents: "none", duration: 1 }, 0)
            .to(marqueeTop, { x: "-120vw", duration: 1, ease: "power2.in" }, 0)
            .to(marqueeBottom, { x: "120vw", duration: 1, ease: "power2.in" }, 0)
            .set(marqueeTop, { x: "120vw" }, 1)
            .set(marqueeBottom, { x: "-120vw" }, 1)
            .to(marqueeTop, { x: "0vw", duration: 1, ease: "power2.out" }, 1)
            .to(marqueeBottom, { x: "0vw", duration: 1, ease: "power2.out" }, 1)
            .set(navTitle, { innerHTML: worksTitle }, 1)
            .to(navTitle, { opacity: 1, x: 0, duration: 1 }, 1)
            // Scene 容器瞬间显示
            .to(worksScene, { opacity: 1, y: 0, pointerEvents: "auto", duration: 0.1 }, 1.5)
            // 卡片带有轻微间隔地滑入，使用高级加速度曲线
            .to(workCards, {
                x: "0vw",
                filter: "blur(0px)",
                duration: SCROLL_CONFIG.cardSlideDuration,
                stagger: SCROLL_CONFIG.cardStagger,
                ease: SCROLL_CONFIG.cardEase
            }, 1.5)
            // 当卡片即将滑动到位时（提前 0.8s），触发卡片展开，消除等待的拖沓感
            .call(() => {
                window.dispatchEvent(new Event('works-entered'));
            }, [], "-=0.8")
            .addLabel("scene-works");
        labels.push("scene-works");

        // Phase 2: Works -> Archive
        tl.to(workCards, {
            x: "-100vw",
            filter: "blur(15px)",
            duration: 1,
            stagger: 0.05,
            ease: "power3.in"
        })
            .to(worksScene, { opacity: 0, pointerEvents: "none", duration: 0.1 }, ">")
            .to(marqueeTop, { x: "-120vw", duration: 1, ease: "power2.in" }, "-=1")
            .to(marqueeBottom, { x: "120vw", duration: 1, ease: "power2.in" }, "<")
            .to(navTitle, { opacity: 0, x: 20, duration: 0.5 }, "-=1")
            .set(navTitle, { innerHTML: archiveTitle, x: -20 })
            .set(marqueeTop, { x: "120vw", xPercent: 0 })
            .set(marqueeBottom, { x: "-120vw", xPercent: 0 })
            .to(marqueeTop, { x: "0vw", duration: 1, ease: "power2.out" })
            .to(marqueeBottom, { x: "0vw", duration: 1, ease: "power2.out" }, "<")
            .to(navTitle, { opacity: 1, x: 0, duration: 0.5 }, "-=0.5")
            .to(archiveScene, { opacity: 1, y: 0, pointerEvents: "auto", duration: 1 }, "-=0.5")
            .addLabel("scene-archive");
        labels.push("scene-archive");

        // Phase 4: Archive -> AI Lab
        tl.to(archiveScene, { opacity: 0, y: -50, pointerEvents: "none", duration: 1 })
            .to(marqueeTop, { x: "-120vw", duration: 1, ease: "power2.in" }, "-=1")
            .to(marqueeBottom, { x: "120vw", duration: 1, ease: "power2.in" }, "<")
            .to(navTitle, { opacity: 0, x: 20, duration: 0.5 }, "-=1")
            .set(navTitle, { innerHTML: aiLabTitle, x: -20 })
            .set(marqueeTop, { x: "120vw" })
            .set(marqueeBottom, { x: "-120vw" })
            .to(marqueeTop, { x: "0vw", duration: 1, ease: "power2.out" })
            .to(marqueeBottom, { x: "0vw", duration: 1, ease: "power2.out" }, "<")
            .to(navTitle, { opacity: 1, x: 0, duration: 0.5 }, "-=0.5")
            .to(aiLabScene, { opacity: 1, y: 0, pointerEvents: "auto", duration: 1 }, "-=0.5")
            .addLabel("scene-ai-lab");
        labels.push("scene-ai-lab");

        // Phase 5: AI Lab -> Footer
        tl.to(aiLabScene, { opacity: 0.5, pointerEvents: "none", duration: 1 })
            .to(marqueeTop, { x: "-120vw", duration: 1, ease: "power2.in" }, "-=1")
            .to(marqueeBottom, { x: "120vw", duration: 1, ease: "power2.in" }, "<")
            .to(navTitle, { opacity: 0, duration: 0.5 }, "-=1")
            .set(marqueeTop, { x: "120vw" })
            .set(marqueeBottom, { x: "-120vw" })
            .to(marqueeTop, { x: "0vw", duration: 1, ease: "power2.out" })
            .to(marqueeBottom, { x: "0vw", duration: 1, ease: "power2.out" }, "<")
            .to(footerScene, { opacity: 1, y: 0, pointerEvents: "auto", duration: 1 }, "-=0.5")
            .addLabel("scene-footer");
        labels.push("scene-footer");

        let currentIndex = 0;
        let isAnimating = false;

        function gotoSection(index) {
            if (index < 0 || index >= labels.length || isAnimating) return;

            // 增强防误触：如果当前页面存在详情页容器，则强制拦截翻页
            // 这是一个物理维度的兜底，防止事件穿透导致的切页
            const isDetailOpen = document.body.querySelector('.fixed.inset-0.z-50.bg-\\[\\#0a0a0a\\]');
            if (isPaused || isDetailOpen) return;

            isAnimating = true;

            // 提前派发离场事件，使卡片迅速从展开状态恢复为被挤压状态，准备离场动画
            if (labels[currentIndex] === "scene-works" && index !== currentIndex) {
                window.dispatchEvent(new Event('works-left'));
            }

            currentIndex = index;
            const targetLabel = labels[currentIndex];

            // 如果目标是 works 场景，需要重新触发卡片展开
            // （GSAP .call() 在时间轴倒放时不会触发，所以必须手动补发）
            if (targetLabel === "scene-works") {
                // 延迟到卡片滑入动画接近完成时再展开
                setTimeout(() => {
                    window.dispatchEvent(new Event('works-entered'));
                }, (SCROLL_CONFIG.sectionTransitionDuration * 1000) - 800);
            }

            gsap.to(tl, {
                time: tl.labels[targetLabel],
                duration: SCROLL_CONFIG.sectionTransitionDuration,
                ease: "power3.inOut",
                onComplete: () => {
                    isAnimating = false;
                }
            });
        }

        let isPaused = false;
        
        const handlePause = () => { isPaused = true; };
        const handleResume = () => { 
            isPaused = false; 
            isAnimating = false; 
        };
        window.addEventListener('pause-scroll', handlePause);
        window.addEventListener('resume-scroll', handleResume);

        const obs = Observer.create({
            target: window,
            type: "wheel,touch",
            wheelSpeed: -1,
            onUp: () => {
                if (!isAnimating && !isPaused) gotoSection(currentIndex + 1);
            },
            onDown: () => {
                if (!isAnimating && !isPaused) gotoSection(currentIndex - 1);
            },
            tolerance: window.innerWidth < 768 ? 80 : 30, // Higher tolerance on mobile to prevent accidental page shifts
            preventDefault: false
        });

        // Loop Marquees
        const marqueeTracks = document.querySelectorAll('.marquee-track');
        marqueeTracks.forEach(track => {
            const text = track.getAttribute('data-marquee-text');
            const span = track.querySelector('.marquee-text-bg');
            if (!text || !span) return;
            span.innerHTML = `<span>${text}</span><span>${text}</span><span>${text}</span>`;
            const isTop = track.classList.contains('marquee-top');
            gsap.to(span, {
                xPercent: isTop ? -33.3333 : 33.3333,
                duration: 50,
                ease: "none",
                repeat: -1,
                onRepeat: () => { gsap.set(span, { xPercent: 0 }); }
            });
        });

        // Cleanup
        return () => {
            window.removeEventListener('pause-scroll', handlePause);
            window.removeEventListener('resume-scroll', handleResume);
            obs.kill();
            tl.kill();
            gsap.killTweensOf(".marquee-text-bg");
        };
    }, []);
};
