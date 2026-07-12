import React, { useState } from "react";

const ArchiveItem = ({ year, title, subtitle, category, children }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={`archive-item group border-b border-outline-variant/30 overflow-hidden ${isOpen ? 'is-active' : ''}`}>
            <div 
                className="py-10 px-4 grid grid-cols-12 items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="col-span-2 text-on-surface-variant font-label text-xs">{year}</div>
                <div className="col-span-6 text-2xl font-medium text-primary group-hover:text-on-surface">
                    {title}
                    <span className="block text-sm opacity-60 font-normal mt-1">{subtitle}</span>
                </div>
                <div className="col-span-3 text-on-surface-variant text-sm hidden md:block">{category}</div>
                <div className="col-span-1 text-right">
                    <span className="material-symbols-outlined text-outline toggle-icon">
                        {isOpen ? 'remove' : 'add'}
                    </span>
                </div>
            </div>
            <div 
                className="archive-content-wrapper transition-all duration-500 ease-in-out"
                style={{ 
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                    display: 'grid'
                }}
            >
                <div className="overflow-hidden">
                    <div className="archive-details px-4 pb-12 pt-4">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};

const Archive = () => {
    return (
        <section id="scene-archive" className="scene-module absolute inset-0 opacity-0 bg-surface overflow-y-auto pt-48 pb-24 lg:px-12 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-end mb-16 lg:mb-24 gap-4 lg:gap-8">
                    <div>
                        <span className="font-label text-xs uppercase tracking-[0.3em] text-on-surface-variant">Timeline</span>
                        <h2 className="text-3xl lg:text-5xl font-bold tracking-tighter mt-2 lg:mt-4 uppercase">工作经历 / ARCHIVE</h2>
                    </div>
                    <div className="text-on-surface-variant font-label text-xs tracking-widest uppercase">展示近期作品 (Showing Selective Archive)</div>
                </div>

                <div className="border-t border-outline-variant/30">
                    <ArchiveItem 
                        year="2023" 
                        title="声学字体探索" 
                        subtitle="Sonic Typography Exploration" 
                        category="交互设计 (Interactive Design)"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-4">
                                <h4 className="text-lg font-bold text-tertiary uppercase tracking-widest">项目背景 / CONTEXT</h4>
                                <p className="text-on-surface-variant leading-relaxed">该项目探索了声音波形与动态排版之间的同步性。通过生成算法，将声学参数转化为流动的视觉构架。</p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="text-lg font-bold text-tertiary uppercase tracking-widest">核心职责 / IMPACT</h4>
                                <ul className="text-on-surface-variant space-y-2 list-disc list-inside">
                                    <li>开发实时音频响应排版引擎</li>
                                    <li>视觉系统与数字界面的整合</li>
                                </ul>
                            </div>
                        </div>
                    </ArchiveItem>

                    <ArchiveItem 
                        year="2022" 
                        title="柏林时装周形象识别" 
                        subtitle="Berlin Fashion Week Identity" 
                        category="品牌设计 (Branding)"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-4">
                                <h4 className="text-lg font-bold text-tertiary uppercase tracking-widest">项目背景 / CONTEXT</h4>
                                <p className="text-on-surface-variant leading-relaxed">为柏林时装周设计的全新品牌系统，平衡工业感与现代时尚的精致。</p>
                            </div>
                        </div>
                    </ArchiveItem>
                </div>
            </div>
        </section>
    );
};

export default Archive;
