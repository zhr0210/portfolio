/**
 * 作品集调参入口。数值默认保持 Continuum 的设计；时间单位为毫秒。
 * CSS 长度写成带单位的字符串。修改保存后 Vite 会更新预览。
 */
export const siteConfig = {
  typography: {
    aboutTitle: 'clamp(46px,5.45vw,100px)', // 关于我的主标题
    aboutTitleMobile: '8.7vw',
    aboutBody: 'clamp(12px,1.03vw,17px)', // 关于我的中文正文
    aboutBodyMobile: '11px',
    aboutLineHeight: 1.95,
    methodTitle: 'clamp(46px,6.15vw,116px)',
    methodTitleMobile: '9.2vw',
    archiveTitle: 'clamp(46px,4.65vw,92px)',
    archiveTitleMobile: '10vw',
    evidenceTitle: 'clamp(46px,5.5vw,102px)',
    evidenceTitleMobile: '9vw',
    detailTitleCompact: '23px',
    detailBodyCompact: '10px',
    detailBodyWeight: 400,
    detailBodyTracking: '.025em',
    detailBodyColor: '#f1eeebd6',
    detailTitle: 'clamp(24px,2.2vw,32px)',
    detailTitleMobile: '25px',
    detailBody: '12px',
    detailBodyMobile: '11px',
    detailLineHeight: 1.95,
  },
  layout: {
    aboutScrollScreens: 8.2, // 关于我的滚动长度（8.2 屏）
    detailRadius: '36px',
    detailGap: '24px',
    detailPadding: '20px',
  },
  motion: {
    openingDuration: 7160,
    spaceDuration: 580, // 关于我 / 作品切换时长
    screenBoot: 1550, // 全景作品显现时长
    detailClose: 250,
  },
  reader: {
    speed: 14, // 长图自动阅读速度，像素 / 秒
    startDelay: 1500,
    resumeDelay: 3000,
    bottomHold: 1000,
    returnDuration: 850,
    topHold: 1000,
  },
  gallery: {
    lensCore: 0.26, // 中心清晰区域，须大于 0
    lensHorizontal: 0.87, // 水平方向的镜头弯曲比例
    curve: 2.55,
    pressCurve: 1.65,
    initialPan: { x: 6.15, y: 4.48 },
    desktopColumnsVisible: 5.65,
    mobileColumnsVisible: 2.23,
    damping: 14,
    dragDamping: 26,
    inertiaDecay: 7.5,
    maxPixelRatio: 2.5,
    maxRenderPixels: 8_500_000,
    desktopAtlasTile: 768,
    mobileAtlasTile: 512, // 手机降低图集占用，桌面保留原清晰度
  },
};

export function applySiteConfig(): void {
  const root = document.documentElement;
  const t = siteConfig.typography;
  const variables: Record<string, string | number> = {
    '--design-about-title': t.aboutTitle,
    '--design-about-title-mobile': t.aboutTitleMobile,
    '--design-about-body': t.aboutBody,
    '--design-about-body-mobile': t.aboutBodyMobile,
    '--design-about-line-height': t.aboutLineHeight,
    '--design-method-title': t.methodTitle,
    '--design-method-title-mobile': t.methodTitleMobile,
    '--design-archive-title': t.archiveTitle,
    '--design-archive-title-mobile': t.archiveTitleMobile,
    '--design-evidence-title': t.evidenceTitle,
    '--design-evidence-title-mobile': t.evidenceTitleMobile,
    '--design-detail-title-compact': t.detailTitleCompact,
    '--design-detail-body-compact': t.detailBodyCompact,
    '--design-detail-body-weight': t.detailBodyWeight,
    '--design-detail-body-tracking': t.detailBodyTracking,
    '--design-detail-body-color': t.detailBodyColor,
    '--design-detail-gap': siteConfig.layout.detailGap,
    '--design-detail-padding': siteConfig.layout.detailPadding,
    '--design-detail-close': `${siteConfig.motion.detailClose}ms`,
    '--design-detail-title': t.detailTitle,
    '--design-detail-title-mobile': t.detailTitleMobile,
    '--design-detail-body': t.detailBody,
    '--design-detail-body-mobile': t.detailBodyMobile,
    '--design-detail-line-height': t.detailLineHeight,
    '--design-about-scroll': `${siteConfig.layout.aboutScrollScreens * 100}svh`,
    '--design-detail-radius': siteConfig.layout.detailRadius,
  };
  for (const [name, value] of Object.entries(variables))
    root.style.setProperty(name, String(value));
}
