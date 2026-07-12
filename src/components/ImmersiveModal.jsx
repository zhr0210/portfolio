import React from "react";

const ImmersiveModal = () => {
    return (
        <div 
            id="immersive-modal" 
            className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center opacity-0 overflow-hidden pointer-events-none"
            style={{ transition: "1s cubic-bezier(0.165, 0.84, 0.44, 1)" }}
        >
            {/* 关闭按钮 */}
            <button className="absolute top-12 right-12 z-[10000] text-primary hover:text-white transition-colors" id="close-modal">
                <span className="material-symbols-outlined text-4xl">close</span>
            </button>

            {/* 画廊包装器 */}
            <div className="gallery-wrapper w-full h-full flex flex-col justify-center">
                {/* 顶部信息 */}
                <div className="px-12 lg:px-24 mb-8 lg:mb-16 w-full">
                    <div className="flex items-center gap-4 mb-4">
                        <span className="h-[2px] w-12 bg-primary"></span>
                        <p className="font-label text-[10px] uppercase tracking-[0.5em] text-on-surface-variant mask-text">
                            <span className="mask-inner block">PROJECT ARCHIVE / 01</span>
                        </p>
                    </div>
                    <h2 className="text-4xl lg:text-6xl font-black tracking-tighter uppercase mask-text">
                        <span className="mask-inner block" style={{ transitionDelay: "0.1s" }}>Immersive Visuals</span>
                    </h2>
                </div>

                {/* 水平滚动内容 */}
                <div className="flex items-center gap-12 px-12 lg:px-24 w-max h-[50vh] lg:h-[60vh]" id="gallery-inner">
                    {/* 画廊项目 1 */}
                    <div className="gallery-item bg-surface-container group/item relative w-[80vw] md:w-[40vw] h-full">
                        <img alt="Gallery 1"
                            className="w-full h-full object-cover grayscale brightness-50 group-hover/item:grayscale-0 transition-all duration-700"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCrRsobE0pj9FXF6eD973hl6dM8oH8tqei18c2AV2wUm93FmX7T6Vn_o8zpzYnYltqMMsK5-AqKNcioNfFHM-USICpIHtzh3R1dUPB8JGZUVG8VeyeG8GrwFFdpJeYakUzvCq_YljoI30tfwGEwSnvY3Opj_KFCdFe1pMROsUthPZYgYSBxCBpuehlVHLlozIy2aA1m2N2R7p83KEVkiYrohdwOeXTsbqZ0NEf837lLaOZW2tR2m80T4fnZ6F3h-a_Ak0cUGQgZVHEB" />
                        <div className="absolute bottom-12 left-12 right-12">
                            <div className="card-mask-container">
                                <h3 className="card-mask-content text-3xl font-black tracking-tighter uppercase text-white mb-2 whitespace-nowrap">流动的空间 / FLUID SPACES</h3>
                            </div>
                            <div className="card-mask-container">
                                <p className="card-mask-content description-mask text-sm text-white/70 font-medium tracking-wide">
                                    探索极简主义与大自然共生的建筑视觉。<br />
                                    (Exploring the architectural symbiosis of minimalism and nature.)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 画廊项目 2 */}
                    <div className="gallery-item bg-surface-container group/item relative w-[80vw] md:w-[40vw] h-full">
                        <img alt="Gallery 2"
                            className="w-full h-full object-cover grayscale brightness-50 group-hover/item:grayscale-0 transition-all duration-700"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDvp06dHXldOQmrxiBgwtqx7vnVsW9zH2vdsMCquVu3P4NokYbR2Y64AesZiuaAJE4Bs2jZIPMAi4oW3HjHDPaWA3QccxGA055szxvqwhslS0p4Qf9g8MEZrfNsIENzoZfisH9DdfnEwlW3DU9akN28mBiFEpiyxWyHrhUiziWu133L78lLukLKlL6YAj7Czr59cwFkv_loBo95bZBcu-FvO9RpIDINumCDBYkiLLTgz17saREgEy975N4sUtfvMLzCnXoVLncQHlzZ" />
                        <div className="absolute bottom-12 left-12 right-12">
                            <div className="card-mask-container">
                                <h3 className="card-mask-content text-3xl font-black tracking-tighter uppercase text-white mb-2 whitespace-nowrap">数字遗迹 / DIGITAL RELICS</h3>
                            </div>
                            <div className="card-mask-container">
                                <p className="card-mask-content description-mask text-sm text-white/70 font-medium tracking-wide">
                                    在赛博废墟中重构经典比例的平衡。<br />
                                    (Reconstructing the balance of classical proportions in cyber ruins.)
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 滚动提示 */}
                <div className="absolute bottom-12 left-24">
                    <p className="font-label text-[10px] uppercase tracking-[0.5em] text-on-surface-variant mask-text">
                        <span className="mask-inner block" style={{ transitionDelay: "0.3s" }}>Scroll to the end to exit</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ImmersiveModal;
