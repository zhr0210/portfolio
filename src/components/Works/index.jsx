// src/components/Works/index.jsx
import React from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
import WorksDesktop from "./WorksDesktop";
import WorksMobile from "./WorksMobile";

const Works = () => {
    const isMobile = useIsMobile(768);

    return (
        <div id="scene-works" className="scene-module absolute inset-0 opacity-0 flex items-center justify-center z-10 w-full h-full pointer-events-none">
            {isMobile ? <WorksMobile /> : <WorksDesktop />}
        </div>
    );
};

export default Works;
