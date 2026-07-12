import React from "react";

const Nav = ({ isOpen, onToggle }) => {
    return (
        <nav className="fixed top-0 w-full z-[100] flex justify-between items-center px-6 md:px-12 py-8 pointer-events-none">
            {/* 左侧动态标题: 由 scroll-app.js 驱动更新 */}
            <div id="dynamic-nav-title" className="opacity-0 -translate-x-4 transition-all duration-700 pointer-events-auto">
                {/* 内容示例: 奢华酒店视觉策划 <span class="title-sep">|</span> <span class="title-sub">LUXURY HOSPITALITY</span> */}
            </div>

            {/* 右侧容器：包含菜单项和触发按钮 */}
            <div className="flex items-center gap-4 md:gap-6">
                {/* 水平滑出的菜单项容器: 内部文字居中对齐 */}
                <div id="nav-items-container"
                    className={`flex items-center gap-6 md:gap-10 transition-all duration-500 ease-out pointer-events-auto ${isOpen ? 'opacity-100 translate-x-0 visible' : 'opacity-0 translate-x-10 invisible'}`}>
                    <a href="#projects" className="group flex flex-row items-center gap-2 transition-all hover:scale-110 active:scale-95">
                        <span className="text-sm md:text-base font-black text-white leading-tight">作品集</span>
                        <span
                            className="text-[0.55rem] md:text-[0.6rem] font-bold tracking-[0.2em] uppercase hollow-stroke opacity-60 group-hover:opacity-100 transition-opacity">Projects</span>
                    </a>
                    <a href="#archive" className="group flex flex-row items-center gap-2 transition-all hover:scale-110 active:scale-95">
                        <span className="text-sm md:text-base font-black text-white leading-tight">履历回顾</span>
                        <span
                            className="text-[0.55rem] md:text-[0.6rem] font-bold tracking-[0.2em] uppercase hollow-stroke opacity-60 group-hover:opacity-100 transition-opacity">Archive</span>
                    </a>
                    <a href="#ai-lab" className="group flex flex-row items-center gap-2 transition-all hover:scale-110 active:scale-95">
                        <span className="text-sm md:text-base font-black text-white leading-tight">AI 实验室</span>
                        <span
                            className="text-[0.55rem] md:text-[0.6rem] font-bold tracking-[0.2em] uppercase hollow-stroke opacity-60 group-hover:opacity-100 transition-opacity">AI Lab</span>
                    </a>
                    <a href="#connect" className="group flex flex-row items-center gap-2 transition-all hover:scale-110 active:scale-95">
                        <span className="text-sm md:text-base font-black text-white leading-tight">联系合作</span>
                        <span
                            className="text-[0.55rem] md:text-[0.6rem] font-bold tracking-[0.2em] uppercase hollow-stroke opacity-60 group-hover:opacity-100 transition-opacity">Connect</span>
                    </a>
                </div>

                {/* 极简 Menu 触发按钮: 文字大小与菜单项一致 */}
                <button 
                    id="menu-toggle"
                    onClick={onToggle}
                    className="flex flex-col items-center group pointer-events-auto transition-all active:scale-95 z-[101]">
                    <span
                        className="text-sm md:text-base font-black text-white/80 uppercase group-hover:text-white transition-colors">Menu</span>
                    <div className="w-full h-[1px] bg-white/20 group-hover:bg-white transition-all mt-1"></div>
                </button>
            </div>
        </nav>
    );
};

export default Nav;
