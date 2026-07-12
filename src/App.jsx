import React, { useState } from "react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Works from "./components/Works/index";
import Archive from "./components/Archive";
import AILab from "./components/AILab";
import Footer from "./components/Footer";
import ImmersiveModal from "./components/ImmersiveModal";

import { useScrollApp } from "./hooks/useScrollApp";

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useScrollApp();

  return (
    <div className="selection:bg-tertiary selection:text-on-tertiary overflow-x-hidden bg-background text-foreground" data-mode="connect">
      
      {/* 全局组件：沉浸式模态框 */}
      <ImmersiveModal />

      {/* 全局组件：顶部导航栏 */}
      <Nav isOpen={isMenuOpen} onToggle={() => setIsMenuOpen(!isMenuOpen)} />

      {/* 主内容区域 (全屏画布锁定区) */}
      <main id="global-canvas" className="fixed inset-0 w-screen h-screen overflow-hidden z-10">
        
        {/* 🌊 装饰性背景跑马灯 (全局底层装饰) */}
        <div className="marquee-bg-container">
          <div className="marquee-track marquee-top" id="marquee-top-track" data-marquee-text="EDITORIAL VANGUARD &nbsp; VISUAL DESIGN &nbsp;">
            <span className="marquee-text-bg"></span>
          </div>
          <div className="marquee-track marquee-bottom" id="marquee-bottom-track" data-marquee-text="DIGITAL ARCHIVE &nbsp; PHOTOGRAPHY &nbsp;">
            <span className="marquee-text-bg"></span>
          </div>
        </div>

        {/* 场景模块容器 */}
        <Hero />
        <Works />
        <Archive />
        <AILab />
        <Footer />
      </main>
    </div>
  );
}

export default App;
