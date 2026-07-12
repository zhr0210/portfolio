// src/components/WorkDetail/EnhancedLazyImage.jsx
import React, { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

const EnhancedLazyImage = ({ src, height, alt }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { margin: "1000px 0px", once: false });
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div ref={ref} className="w-full flex-shrink-0 bg-[#0c0c0c] relative overflow-hidden" style={{ height }}>
            {/* 背景模糊占位：提供色彩情绪，避免纯色块 */}
            {isInView && (
                <div 
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
                    style={{ 
                        backgroundImage: `url(${src})`, 
                        filter: "blur(50px) brightness(0.9) saturate(1.1)",
                        opacity: isLoaded ? 0 : 0.5
                    }}
                />
            )}

            {isInView && (
                <motion.img
                    src={src}
                    alt={alt}
                    onLoad={() => setIsLoaded(true)}
                    initial={{ opacity: 0, scale: 1.05, filter: "blur(20px)" }}
                    animate={{ 
                        opacity: isLoaded ? 1 : 0, 
                        scale: isLoaded ? 1 : 1.05,
                        filter: isLoaded ? "blur(0px)" : "blur(20px)" 
                    }}
                    transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full h-full object-cover block relative z-10"
                />
            )}
            
            {/* 极端离线/卸载状态下的呼吸感 */}
            {!isInView && (
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-5" />
            )}
        </div>
    );
};

export default EnhancedLazyImage;
