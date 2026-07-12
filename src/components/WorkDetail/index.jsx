// src/components/WorkDetail/index.jsx (Desktop Router)
import React from 'react';
import Project1Desktop from './desktop/Project1Desktop';
import Project2Desktop from './desktop/Project2Desktop';
import Project3Desktop from './desktop/Project3Desktop';
import Project4Desktop from './desktop/Project4Desktop';
import Project5Desktop from './desktop/Project5Desktop';
import Project6Desktop from './desktop/Project6Desktop';
import Project7Desktop from './desktop/Project7Desktop';
import DesktopDetailWrapper from './DesktopDetailWrapper';

const WorkDetail = ({ work, onClose }) => {
    if (!work) return null;
    // 根据项目 ID 分发到独立的桌面端文件
    switch (work.id) {
        case 1: return <Project1Desktop work={work} onClose={onClose} />;
        case 2: return <Project2Desktop work={work} onClose={onClose} />;
        case 3: return <Project3Desktop work={work} onClose={onClose} />;
        case 4: return <Project4Desktop work={work} onClose={onClose} />;
        case 5: return <Project5Desktop work={work} onClose={onClose} />;
        case 6: return <Project6Desktop work={work} onClose={onClose} />;
        case 7: return <Project7Desktop work={work} onClose={onClose} />;
        default: return <DesktopDetailWrapper work={work} onClose={onClose} />;
    }
};

export default WorkDetail;
