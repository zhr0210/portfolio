import React from "react";

const AILab = () => {
    return (
        <section id="scene-ai-lab" className="scene-module absolute inset-0 opacity-0 bg-surface overflow-hidden py-24 lg:py-48 px-6 lg:px-12">
            {/* 代码流背景 */}
            <div className="absolute inset-0 opacity-10 font-mono text-[8px] lg:text-[10px] leading-tight select-none pointer-events-none code-stream p-4 overflow-hidden">
                <div className="animate-pulse">
                    const AI_WORKFLOW = &#123; prompt: "hyper-realistic brutalist architecture", model: "Midjourney v6" &#125;;<br />
                    while (evolving) &#123; analyze_pixel_density(); refine_composition(); &#125;<br />
                    // Visual Overstep Protocol Active<br />
                    [0.44, 0.12, 0.99, 0.51, 0.22, 0.87, 0.12, 0.44]
                </div>
            </div>

            <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center h-full">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 text-primary font-label text-[10px] tracking-[0.2em] uppercase mb-8">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping"></span>
                        AI 实验室 / AI LAB: VISUAL OVERSTEP
                    </div>
                    <h2 className="text-4xl lg:text-6xl font-black tracking-tighter uppercase mb-6 lg:mb-8 leading-none">
                        生成式综合体 <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-surface-bright">
                            (GENERATIVE SYNTHESIS)
                        </span>
                    </h2>
                    <p className="text-on-surface-variant text-lg leading-relaxed mb-12 max-w-md">
                        利用 AI 的混沌潜力突破视觉边界。我将 Midjourney 和自定义大语言模型 (LLM) 工作流整合到专业制作管线中。
                    </p>
                    <div className="flex flex-wrap gap-8">
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-on-surface">95%</span>
                            <span className="text-xs uppercase tracking-widest text-on-surface-variant">效率提升 (Efficiency Gain)</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-2xl font-bold text-on-surface">∞</span>
                            <span className="text-xs uppercase tracking-widest text-on-surface-variant">创意范畴 (Creative Scope)</span>
                        </div>
                    </div>
                </div>
                <div className="relative">
                    <div className="aspect-square bg-white/5 relative p-1">
                        <img alt="AI Visualization" className="w-full h-full object-cover grayscale brightness-75"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqGHhGOrzw-9TKxvCs5PvY17ekXcqPtkCOnP-oTjMVjQI-cdYobQgPJ0_92iw8LAIYz32l5mLJw625QAFhK8ylUPipBNZkZ0196U-z9fHNBNdzAsJxRqtBWBFr534kadaH3jVNuYhxcnu6pqLbIsxUYrmkOsFOuR39IXPAZ7nLe9xOXvJoE_K05t37HdqkPsD8ARhI3JfRqRB7k47pyg3GSdtNmHiIwj8GpH7QYUqSI_MI-nMIkTdJIRAlGvkplhSocJGA-YspzBYY" />
                        <div className="absolute inset-0 border border-primary/20 pointer-events-none"></div>
                        <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 blur-[100px] rounded-full"></div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AILab;
