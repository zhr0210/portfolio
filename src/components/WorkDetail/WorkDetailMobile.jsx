// src/components/WorkDetail/WorkDetailMobile.jsx (Mobile Router)
import React from 'react';
import Project1Mobile from './mobile/Project1Mobile';
import Project2Mobile from './mobile/Project2Mobile';
import Project3Mobile from './mobile/Project3Mobile';
import Project4Mobile from './mobile/Project4Mobile';
import Project5Mobile from './mobile/Project5Mobile';
import Project6Mobile from './mobile/Project6Mobile';
import Project7Mobile from './mobile/Project7Mobile';
import MobileDetailWrapper from './MobileDetailWrapper';

const WorkDetailMobile = ({ work, onClose }) => {
    if (!work) return null;
    // 根据项目 ID 分发到独立的手机端文件
    switch (work.id) {
        case 1: return <Project1Mobile work={work} onClose={onClose} />;
        case 2: return <Project2Mobile work={work} onClose={onClose} />;
        case 3: return <Project3Mobile work={work} onClose={onClose} />;
        case 4: return <Project4Mobile work={work} onClose={onClose} />;
        case 5: return <Project5Mobile work={work} onClose={onClose} />;
        case 6: return <Project6Mobile work={work} onClose={onClose} />;
        case 7: return <Project7Mobile work={work} onClose={onClose} />;
        default: return <MobileDetailWrapper work={work} onClose={onClose} />;
    }
};

export default WorkDetailMobile;
