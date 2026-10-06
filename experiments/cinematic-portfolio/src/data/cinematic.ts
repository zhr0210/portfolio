/** AFTERIMAGE 文案与镜头长度。只描述现有作品与创作方法，不补写履历。 */
export const chapters = [
  {
    id: 'profile',
    number: '01',
    label: '观看方式',
    en: 'FRAME OF MIND',
    screens: 3,
    mobileScreens: 2,
  },
  { id: 'method', number: '02', label: '创作过程', en: 'THE CUT', screens: 3, mobileScreens: 2 },
  { id: 'archive', number: '03', label: '视觉语言', en: 'PRACTICE', screens: 3, mobileScreens: 2 },
  {
    id: 'evidence',
    number: '04',
    label: '精选作品',
    en: 'SELECTED FRAMES',
    screens: 3,
    mobileScreens: 2,
  },
  {
    id: 'footer',
    number: '05',
    label: '联系合作',
    en: 'NEXT FRAME',
    screens: 2,
    mobileScreens: 1.5,
  },
] as const;

export type ChapterId = (typeof chapters)[number]['id'];
export const filmConfig = { heroScreens: 0.9, settleSeconds: 0.16, mobileBreakpoint: 768 };
export const filmMedia = {
  space: '/images/about-crops/corridor.webp',
  detail: '/images/about-crops/detail.webp',
  ceremony: '/images/about-crops/ceremony.webp',
};
export const filmCopy = {
  profile: {
    title: ['一帧之内，', '有一个世界。'],
    statement: '我在画面里寻找秩序，也为偶然留下位置。',
    body: '平面、摄影与剪辑，是我观看世界的三个切面。光线决定情绪，构图建立关系，时间让故事发生。',
    caption: '空间影像 / 取自现有作品',
  },
  method: {
    title: ['选择，', '让画面成立。'],
    statement: '画框以外的，也是创作的一部分。',
    steps: [
      { name: '观察', en: 'OBSERVE', body: '先看光线与细节，让画面找到它的重心。' },
      { name: '选择', en: 'SELECT', body: '留下必要的关系，给情绪一段呼吸的空间。' },
      { name: '编排', en: 'COMPOSE', body: '用尺度、间距与取景，组织观看的顺序。' },
      { name: '节奏', en: 'PACE', body: '让停顿与推进，把零散的画面连成叙事。' },
    ],
  },
  archive: {
    title: ['静止与流动，', '同一种语言。'],
    statement: '用不同的媒介，抵达同一个想法。',
    disciplines: [
      {
        name: '平面',
        en: 'DESIGN',
        word: '秩序',
        body: '从信息与版式出发，建立清晰的视觉关系。让字体、色彩与图像共同承担表达。',
        image: '/images/panorama/01-02.webp',
      },
      {
        name: '摄影',
        en: 'IMAGE',
        word: '目光',
        body: '观察空间、光线与细节。在真实场景里找到情绪，让一帧画面拥有它自己的重量。',
        image: filmMedia.ceremony,
      },
      {
        name: '剪辑',
        en: 'MOTION',
        word: '时间',
        body: '在镜头之间寻找联系，以节奏、留白与调色组织叙事。让画面从被看见，走向被记住。',
        image: '/images/panorama/07-03.webp',
      },
    ],
  },
  evidence: {
    title: ['让作品，', '继续说。'],
    statement: '七件完整作品，七种观看的入口。',
    body: '品牌叙事、活动推广与餐饮视觉。图像与文字沿着长图铺陈，形成可以展开阅读的故事。',
  },
  footer: {
    title: ['下一帧，', '留给相遇。'],
    statement: '一个想法，一种新的观看方式。',
    body: '平面设计 / 摄影摄像 / 剪辑与调色',
    contact: '从这里开始',
  },
};

export function isChapterId(value: string | null): value is ChapterId {
  return chapters.some((chapter) => chapter.id === value);
}
