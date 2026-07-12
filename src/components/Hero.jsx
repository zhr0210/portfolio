import React from "react";
import image1 from "../assets/1.png";
import image2 from "../assets/2.png";
import mobilePortrait from "../assets/无底色亮色肖像.png";

const Hero = () => {
    return (
        <section id="scene-hero" className="scene-module relative w-full h-full flex flex-col justify-center pt-20 pointer-events-auto">
            
            {/* 🪐 电脑端展示层 (Desktop Hero Interaction Layer) */}
            <div className="hidden xl:block absolute inset-0 pointer-events-none">
                {/* ✨ 终极隐形触发墙 */}
                <div id="hero-interaction-trigger"
                    className="absolute top-0 right-0 w-[40vw] h-screen z-50 pointer-events-auto cursor-pointer peer"></div>

                <div className="absolute inset-x-0 w-full top-1/2 transform -translate-y-1/2">
                    <div className="relative w-full h-full">
                        {/* 1️⃣ 核心展示组 (z-10) */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[55vw] z-10">
                            <div className="grid w-full items-end justify-items-end">
                                <img alt="Artist Portrait - Dark Base"
                                    className="col-start-1 row-start-1 w-full h-auto object-right-bottom block"
                                    src={image1} />
                                <img id="hero-aida-overlay" alt="Artist Portrait - Light Overlay"
                                    className="col-start-1 row-start-1 w-full h-auto object-right-bottom block opacity-0 peer-hover:opacity-100 origin-bottom-right translate-x-[10px] translate-y-[25px] scale-[1.07] transition-all duration-[2000ms] ease-in-out"
                                    src={image2} />
                            </div>
                        </div>

                        {/* 2️⃣ 文字阵组合 */}
                        <div className="relative pl-[5vw]">
                            <div className="relative font-black leading-none tracking-[10px] uppercase">
                                <h1 className="absolute top-0 left-0 z-0 text-[#e7e5e5]">
                                    <span className="text-[clamp(2rem,10vw,15rem)]">KILIAN</span><span
                                        className="ml-[18vh] text-[clamp(2rem,10vw,15rem)]">ZHOU</span><span
                                        className="block mt-[-0.13em] text-[clamp(1.8rem,8vw,13rem)]">作品集</span>
                                </h1>
                                <h1 className="absolute top-0 left-0 z-[5] text-transparent [-webkit-text-stroke:1px_black] opacity-10"
                                    aria-hidden="true">
                                    <span className="text-[clamp(2rem,10vw,15rem)]">KILIAN</span><span
                                        className="ml-[18vh] text-[clamp(2rem,10vw,15rem)]">ZHOU</span><span
                                        className="block mt-[-0.13em] text-[clamp(1.8rem,8vw,13rem)]">作品集</span>
                                </h1>
                                <h1 className="relative z-20 stroke-text" aria-hidden="true">
                                    <span className="text-[clamp(2rem,10vw,15rem)]">KILIAN</span><span
                                        className="ml-[18vh] text-[clamp(2rem,10vw,15rem)]">ZHOU</span><span
                                        className="block mt-[-0.13em] text-[clamp(1.8rem,8vw,13rem)]">作品集</span>
                                </h1>
                            </div>

                            <h2 className="relative z-20 text-[clamp(1.5rem,6vw,10rem)] font-black leading-[1em] tracking-[-0.05em] uppercase stroke-text !mt-[0.6vw]">
                                PORTFOLIO</h2>
                            <div className="relative z-20 mt-[7vh] max-w-[35vw]">
                                <p className="text-[clamp(14px,1.5vw,60px)] font-[700] leading-tight text-on-surface mt-[2vh] mb-[2vh] border-l-[0.2vw] border-primary pl-[1.2vw] py-[1vh] tracking-[0px]">
                                    平面设计师&amp;摄影摄像师&amp;剪辑师<br />
                                    <span className="text-[clamp(10px,0.6vw,16px)] font-normal text-on-surface-variant uppercase tracking-[0.1em]">Graphic Designer, Photographer &amp; Videographer, and Editor</span>
                                </p>
                                <p className="mt-[2vh] text-[clamp(12px,0.6vw,20px)] text-on-surface-variant leading-relaxed opacity-60 tracking-[1px]">
                                    通过巨石般的字体设计与严谨的档案式精确性，定义高端机构的视觉语言。我们不是在设计，而是在构建持久的数字纪念碑。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 📱 手机端专属英雄字阵 (Mobile Responsive Matrix) */}
            <div className="block xl:hidden absolute left-[5%] w-[90%] space-y-0 top-1/2 transform -translate-y-1/2">
                <div className="relative font-black leading-none tracking-[2px] uppercase">
                    <h1 className="absolute top-0 left-0 z-0 text-[#e7e5e5]">
                        <span className="text-[min(22vw,calc(22*var(--mh-vh-limit)))]">KILIAN</span><span
                            className="block mt-[-0.15em] ml-[0vw] text-[min(22vw,calc(22*var(--mh-vh-limit)))]">ZHOU</span><span
                            className="block mt-[0.15em] ml-[0vw] text-[min(18vw,calc(18*var(--mh-vh-limit)))]">作品集</span>
                    </h1>
                    <h1 className="absolute top-0 left-0 z-[5] text-transparent [-webkit-text-stroke:0.5px_black] opacity-20 pointer-events-none"
                        aria-hidden="true">
                        <span className="text-[min(22vw,calc(22*var(--mh-vh-limit)))]">KILIAN</span><span
                            className="block mt-[-0.15em] ml-[0vw] text-[min(22vw,calc(22*var(--mh-vh-limit)))]">ZHOU</span><span
                            className="block text-[min(18vw,calc(18*var(--mh-vh-limit)))] mt-[0.15em] ml-[0vw]">作品集</span>
                    </h1>
                    <h1 className="relative z-20 stroke-text pointer-events-none" aria-hidden="true">
                        <span className="text-[min(22vw,calc(22*var(--mh-vh-limit)))]">KILIAN</span><span
                            className="block mt-[-0.15em] ml-[0vw] text-[min(22vw,calc(22*var(--mh-vh-limit)))]">ZHOU</span><span
                            className="block text-[min(18vw,calc(18*var(--mh-vh-limit)))] mt-[0.15em] ml-[0vw]">作品集</span>
                    </h1>
                </div>

                <h2 className="relative z-20 text-[min(15vw,calc(15*var(--mh-vh-limit)))] font-black leading-[1] tracking-[0px] uppercase stroke-text !mt-[min(5vw,calc(5*var(--mh-vh-limit)))]">
                    PORTFOLIO</h2>

                <div className="relative z-20 w-full pr-[5%]">
                    <p className="text-[min(4vw,calc(4*var(--mh-vh-limit)))] font-[700] leading-snug text-on-surface mt-[min(5vw,calc(5*var(--mh-vh-limit)))] mb-[min(2vw,calc(2*var(--mh-vh-limit)))] border-l-[3px] border-primary pl-[min(3vw,calc(3*var(--mh-vh-limit)))] py-[min(1vw,calc(1*var(--mh-vh-limit)))] tracking-[0px]">
                        平面设计师&amp;摄影摄像师&amp;剪辑师<br />
                        <span className="text-[min(2.4vw,calc(2.4*var(--mh-vh-limit)))] font-normal text-on-surface-variant uppercase tracking-[0.05em] block mt-1">Graphic Designer, Photographer &amp; Videographer</span>
                    </p>
                    <p className="mt-[3vh] text-[min(2.6vw,calc(2.6*var(--mh-vh-limit)))] text-on-surface-variant leading-relaxed opacity-60 tracking-[1px]">
                        精通全流程影像制作，能独立完成从布光、拍摄到后期剪辑与专业调色，并融合前沿AI技术赋能创意开发。
                    </p>
                </div>
            </div>

            <div className="hidden md:block xl:hidden absolute right-[-50vw] top-1/2 w-[min(100vw,calc(100*var(--mh-vh-limit)))] h-[min(100vw,calc(100*var(--mh-vh-limit)))] z-[5] pointer-events-none transform -translate-y-1/2 bg-[radial-gradient(circle,rgba(255,255,255,1)_0%,rgba(255,255,255,0)_70%)] opacity-[1]"></div>

            <div className="hidden md:block xl:hidden absolute right-0 top-1/2 -translate-y-1/2 w-[min(90vw,calc(90*var(--mh-vh-limit)))] z-10 pointer-events-none flex justify-end">
                <img alt="Artist Portrait"
                    className="w-full h-auto object-contain object-right origin-right transform scale-[0.4] transition-transform duration-1000"
                    src={mobilePortrait} />
            </div>
        </section>
    );
};

export default Hero;
