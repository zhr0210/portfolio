'use strict';
const React=__r(1),h=React.createElement;
const {asset}=__r(11),{navigateScene}=__r(8),Icon=__r(9).default,{VectorWord}=__r(26);
function Words({front=false}){
 return h('div',{className:'hero-words'+(front?' hero-overprint':''),'aria-hidden':front||undefined},
  h('div',{className:'hero-name'},
   h(front?'div':'h1',{'aria-label':front?undefined:'Kilian Zhou 作品集'},
    h(VectorWord,{word:'KILIAN',className:'hero-kilian',front}),
    h(VectorWord,{word:'ZHOU',className:'hero-zhou',front}),
    h(VectorWord,{word:'作品集',className:'hero-cn',front}))),
  !front&&h(VectorWord,{tag:'h2',word:'PORTFOLIO',className:'hero-portfolio',outlineOnly:true}),
  !front&&h('div',{className:'hero-bio'},
   h('p',{className:'hero-role'},'平面设计师&摄影摄像师&剪辑师',h('span',null,'GRAPHIC DESIGNER, PHOTOGRAPHER & VIDEOGRAPHER, AND EDITOR')),
   h('p',{className:'hero-description'},'通过巨石般的字体设计与严谨的档案式精确性，定义视觉语言。',h('br',{className:'desktop-only'}),'从一帧影像出发，探索设计、摄影与智能创作的边界。')));
}
function Hero(){
 const composition=React.useRef(null);
 React.useLayoutEffect(()=>{
  const host=composition.current,base=host.querySelector('.hero-words:not(.hero-overprint)'),front=host.querySelector('.hero-overprint');
  let alive=true;
  const align=()=>{if(alive&&base&&front)front.style.height=base.getBoundingClientRect().height+'px';};
  align();const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(align);ro?.observe(base);
  document.fonts.ready.then(align);window.addEventListener('resize',align);
  return()=>{alive=false;ro?.disconnect();window.removeEventListener('resize',align);};
 },[]);
 return h('section',{id:'scene-hero',className:'sequence-scene hero-scene','aria-label':'首页 — Kilian Zhou 作品集'},
  h('div',{ref:composition,className:'hero-composition'},
   h(Words),
   h('div',{className:'hero-portrait-plane','aria-hidden':true},
    h('img',{className:'hero-portrait-isolated hero-portrait-dark',src:asset('/images/optimized/portrait-light.webp'),alt:'',fetchPriority:'high',draggable:false}),
    h('img',{className:'hero-portrait-isolated hero-portrait-reveal',src:asset('/images/optimized/portrait-light.webp'),alt:'',draggable:false})),
   h(Words,{front:true}),
   h('div',{className:'hero-hover-zone','aria-hidden':true})),
  h('div',{className:'hero-footnote'},h('span',null,'INDEPENDENT VISUAL PRACTICE'),h('button',{onClick:()=>navigateScene('profile')},'走进我的创作 ',h(Icon,{name:'down',size:14}))));
}
exports.default=Hero;
