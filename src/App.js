'use strict';
const React=__r(1),h=React.createElement;
const Nav=__r(6).default,Opening=__r(25).default,Hero=__r(10).default,Panorama=__r(12).default;
const Continuum=__r(36).default,{SpaceDock}=__r(35),{CLOCK}=__r(37);
const {ContactDialog,ResumeDialog}=__r(19),{useSequence}=__r(7);
function App(){
 const [reduced,setReduced]=React.useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [space,setSpace]=React.useState('about'),[chapter,setChapter]=React.useState('hero'),[view,setView]=React.useState('sphere');
 const [dialog,setDialog]=React.useState(null),[contactSeed,setContactSeed]=React.useState({});
 const close=React.useCallback(()=>setDialog(null),[]);
 useSequence({reduced,onChapter:setChapter,onSpace:setSpace});
 React.useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)'),fn=e=>setReduced(e.matches);mq.addEventListener('change',fn);return()=>mq.removeEventListener('change',fn);},[]);
 return h('div',{className:'portfolio-app flow-edition dual-edition continuum-edition'+(reduced?' reduce-motion':''),'data-space':space},
  h(Nav,{active:chapter,space,view,reduced}),
  h('main',{id:'about-space',role:'tabpanel','aria-labelledby':'tab-about',className:'realm about-realm',inert:space!=='about','aria-hidden':space!=='about'},
   h('div',{id:'about-hero-run',className:'about-hero-run'},
    h('div',{className:'ct-theatre'},
     h('div',{id:'global-canvas',className:'global-canvas about-hero-stage'},
      h('div',{id:'world-typography',className:'world-typography','aria-hidden':true},
       h('div',{className:'world-line world-line-top'},h('span',null,'EDITORIAL VANGUARD · VISUAL DESIGN · EDITORIAL VANGUARD · VISUAL DESIGN · ')),
       h('div',{className:'world-line world-line-bottom'},h('span',null,'DIGITAL ARCHIVE · PHOTOGRAPHY · DIGITAL ARCHIVE · PHOTOGRAPHY · '))),
      h('div',{id:'hero-light-orb','aria-hidden':true}),h(Hero)),
     h('div',{id:'editorial-flow',className:'about-flow'},h(Continuum,{space,reduced,onResume:()=>setDialog('resume'),onContact:seed=>{setContactSeed(seed||{});setDialog('contact');}}))),
    ...Object.entries(CLOCK).filter(([id])=>id!=='hero').map(([id,v])=>h('span',{id:'scene-'+id,key:id,className:'ct-anchor','aria-hidden':true,style:{top:`calc(${v*100}% - ${v*100}dvh)`}})))),
  h('main',{id:'works-space',role:'tabpanel','aria-labelledby':'tab-works',className:'realm works-realm',inert:space!=='works','aria-hidden':space!=='works'},
   h(Panorama,{active:space==='works',reduced,onView:setView})),
  h('div',{className:'flow-edge-diffusion','aria-hidden':true}),
  h('div',{id:'space-curtain',className:'space-curtain','aria-hidden':true},h('i')),
  h(SpaceDock,{space}),h(Opening,{reduced}),
  dialog==='contact'&&h(ContactDialog,{onClose:close,...contactSeed}),dialog==='resume'&&h(ResumeDialog,{onClose:close}));
}
exports.default=App;
