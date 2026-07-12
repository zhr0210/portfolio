// src/components/WorkDetail/DetailSidebar.jsx
import React from "react";
import { motion } from "framer-motion";

const DetailSidebar = ({ work, config, parentVariants, itemVariants }) => {
    return (
        <motion.div
            variants={parentVariants}
            initial="initial"
            animate="animate"
            className="absolute inset-y-0 flex flex-col justify-between pb-16 pointer-events-auto"
            style={{ left: config.layoutLeftMargin, width: config.layoutLeftPanelWidth }}
        >
            <div className="flex flex-col gap-4">
                {[0, 1, 2].map(i => <div key={i} className="w-10 h-10 border border-white/20 rounded-lg" />)}
            </div>
            <div className="flex flex-col gap-6">
                <div>
                    <motion.h1 
                        variants={itemVariants} 
                        style={{ fontSize: config.titleFontSize }} 
                        className="font-bold leading-tight"
                    >
                        {work.title}
                    </motion.h1>
                    <motion.h2
                        variants={itemVariants}
                        style={{
                            fontSize: config.subtitleFontSize,
                            fontWeight: config.subtitleFontWeight,
                            letterSpacing: config.subtitleLetterSpacing,
                            lineHeight: config.subtitleLineHeight,
                            WebkitTextStroke: `${config.subtitleStrokeWidth} white`,
                            marginTop: config.subtitleMarginTop
                        }}
                        className="text-transparent uppercase"
                    >
                        {config.subtitleText}
                    </motion.h2>
                </div>

                {/* 正文区域 (双语) */}
                <div style={{ marginTop: config.descriptionMarginTop }}>
                    <motion.p
                        variants={itemVariants}
                        style={{
                            fontSize: config.descriptionFontSize,
                            fontWeight: config.descriptionFontWeight,
                            lineHeight: config.descriptionLineHeight,
                            letterSpacing: config.descriptionLetterSpacing,
                            color: config.descriptionColor,
                            marginBottom: config.descriptionGap
                        }}
                        className="leading-relaxed"
                    >
                        {config.descriptionCHText}
                    </motion.p>
                    <motion.p
                        variants={itemVariants}
                        style={{
                            fontSize: config.descriptionFontSize,
                            fontWeight: config.descriptionFontWeight,
                            lineHeight: config.descriptionLineHeight,
                            letterSpacing: config.descriptionLetterSpacing,
                            color: config.descriptionColor
                        }}
                        className="leading-relaxed"
                    >
                        {config.descriptionENText}
                    </motion.p>
                </div>
            </div>
        </motion.div>
    );
};

export default DetailSidebar;
