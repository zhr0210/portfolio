// src/components/Works/data.js

// 图片路径基于 public/images/ 静态目录
const IMG_DIR = "/images/公众号推文 WeChat Official Account article";

// 每个 subItem 携带: subtitle(中英文文字), img(路径), ratio(宽高比例 = 图片高度/宽度)
export const realSubItems = [
    { subtitle: "盛启预告 Grand Opening Preview", img: `${IMG_DIR}/1.盛启预告 Grand Opening Preview.jpg`, ratio: 18.788 },
    { subtitle: "启幕盛典 Opening Ceremony", img: `${IMG_DIR}/2.启幕盛典 Opening Ceremony.jpg`, ratio: 15.233 },
    { subtitle: "启幕大促 Launch Specials", img: `${IMG_DIR}/3.启幕大促 Launch Specials.jpg`, ratio: 20.558 },
    { subtitle: "全运会接待回顾 National Games Reception Review", img: `${IMG_DIR}/4.全运会接待回顾 National Games Reception Review.jpg`, ratio: 13.484 },
    { subtitle: "岁末家宴 New Year's Eve Dinner", img: `${IMG_DIR}/5.岁末家宴 New Year's Eve Dinner.jpg`, ratio: 15.962 },
    { subtitle: "春季大促 Spring Sale", img: `${IMG_DIR}/6.春季大促 Spring Sale.jpg`, ratio: 16.258 },
    { subtitle: "春馔 Spring Dishes", img: `${IMG_DIR}/7.春馔 Spring Dishes.jpg`, ratio: 20.371 },
];

const COVER_DIR = "/images/gitee";
export const mockWorks = [
    { id: 1, title: "公众号推文 01", image: `${COVER_DIR}/image-1.jpg`, subItems: realSubItems },
    { id: 2, title: "公众号推文 02", image: `${COVER_DIR}/image-2.jpg`, subItems: realSubItems },
    { id: 3, title: "公众号推文 03", image: `${COVER_DIR}/image-3.jpg`, subItems: realSubItems },
    { id: 4, title: "公众号推文 04", image: `${COVER_DIR}/portrait.jpg`, subItems: realSubItems },
    { id: 5, title: "公众号推文 05", image: `${COVER_DIR}/image-1.jpg`, subItems: realSubItems },
    { id: 6, title: "公众号推文 06", image: `${COVER_DIR}/image-2.jpg`, subItems: realSubItems },
    { id: 7, title: "公众号推文 07", image: `${COVER_DIR}/image-3.jpg`, subItems: realSubItems },
];
