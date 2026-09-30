'use strict';
/** Single deterministic motion model shared by the interactive page and Remotion.
 * p is the viewer's scroll progress, not a clock. Geometry remains mounted.
 * No random values, timed CSS animations or video backgrounds are used here. */
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10)};
const range=(a,b,p)=>ease((p-a)/(b-a));
const tween=(p,keys)=>{
 if(p<=keys[0][0])return keys[0].slice(1);
 for(let i=1;i<keys.length;i++)if(p<=keys[i][0]){const a=keys[i-1],b=keys[i],t=ease((p-a[0])/(b[0]-a[0]));return a.slice(1).map((v,j)=>lerp(v,b[j+1],t));}
 return keys[keys.length-1].slice(1);
};
const CLOCK={hero:0,profile:.165,method:.345,archive:.565,evidence:.775,footer:.955};
const CHAPTERS=[['hero','开场','INTRODUCTION'],['profile','观看方式','PERSPECTIVE'],['method','创作过程','COMPOSITION'],['archive','实践档案','PRACTICE'],['evidence','作品证据','SELECTED WORK'],['footer','联系合作','NEXT FRAME']];
const MEDIA={space:'/images/about-crops/corridor.webp',detail:'/images/about-crops/detail.webp',ceremony:'/images/about-crops/ceremony.webp'};
const RECORDS=[
 {id:'sonic',year:'2023',title:'声学字体探索',en:'SONIC TYPOGRAPHY',kind:'交互设计 · 项目探索',image:'/images/gitee/image-1.jpg',body:'将声音的节奏转译为排版的运动。关注实时音频响应，以及视觉系统与数字界面的整合。',tags:['动态排版','实时响应','视觉系统']},
 {id:'identity',year:'2022',title:'柏林时装周形象识别',en:'FASHION WEEK IDENTITY',kind:'品牌设计 · 项目探索',image:'/images/gitee/image-2.jpg',body:'在工业感与现代时尚之间建立视觉语言。由形象识别延伸到整体品牌系统，让不同载体保持同一个表达。',tags:['形象识别','品牌系统','视觉语言']}
];
const WORKS=[
 {id:1,title:'盛启预告',category:'品牌叙事',src:'/images/panorama/01-01.webp'},
 {id:2,title:'启幕盛典',category:'品牌叙事',src:'/images/panorama/02-01.webp'},
 {id:3,title:'启幕大促',category:'活动推广',src:'/images/panorama/03-01.webp'},
 {id:4,title:'全运会接待回顾',category:'活动推广',src:'/images/panorama/04-01.webp'},
 {id:5,title:'岁末家宴',category:'餐饮视觉',src:'/images/panorama/05-01.webp'},
 {id:6,title:'春季大促',category:'活动推广',src:'/images/panorama/06-01.webp'},
 {id:7,title:'春馔',category:'餐饮视觉',src:'/images/panorama/07-01.webp'}
];
function model(p,small=false){
 const main=tween(p,small?[
  [0,.55,1.06,.40,.48,-9,12],[.13,.50,.38,.44,.43,-4,7],[.225,.04,.12,.92,.76,0,0],
  [.32,.04,.10,.92,.73,0,0],[.455,.08,.545,.84,.28,0,0],[.545,.60,.67,.33,.18,-4,5],
  [.65,.60,.67,.33,.18,0,0],[.735,.055,.355,.275,.16,-3,0],[.83,.055,.355,.275,.16,-3,0],[.94,.72,1.02,.16,.22,14,-14]
 ]:[
  [0,.65,1.10,.31,.60,-8,18],[.13,.635,.19,.30,.61,-3,9],[.215,.60,.18,.33,.64,0,0],
  [.295,.035,.10,.93,.78,0,0],[.345,.035,.10,.93,.78,0,0],
  [.465,.535,.20,.415,.565,0,-6],[.545,.627,.18,.307,.62,-4,-8],[.645,.627,.18,.307,.62,0,0],
  [.735,.055,.39,.174,.335,-5,0],[.83,.055,.39,.174,.335,-5,0],[.94,-.20,.38,.13,.25,-18,16]
 ]);
 return{
  p,main,hero:1-range(.008,.10,p),backdrop:range(.07,.17,p),
  profile:range(.073,.135,p)*(1-range(.205,.262,p)),
  method:range(.255,.295,p)*(1-range(.47,.515,p)),
  archive:range(.50,.552,p)*(1-range(.65,.717,p)),
  evidence:range(.704,.75,p)*(1-range(.835,.897,p)),
  footer:range(.867,.929,p),
  mainAlpha:range(.037,.12,p)*(1-range(.85,.928,p)),
  grid:range(.348,.435,p)*(1-range(.47,.526,p)),
  strips:range(.392,.454,p)*(1-range(.474,.533,p)),
  photoShade:range(.243,.29,p)*.40*(1-range(.36,.44,p)),
  archiveImage:range(.496,.537,p)*(1-range(.683,.728,p)),
  proofImage:range(.682,.74,p),
  profileEnter:range(.092,.147,p),profileExit:range(.205,.252,p),
  methodEnter:range(.25,.304,p),methodExit:range(.463,.519,p),
  archiveEnter:range(.501,.556,p),archiveExit:range(.656,.707,p),
  evidenceEnter:range(.699,.755,p),evidenceExit:range(.837,.894,p),
  footerEnter:range(.868,.941,p)
 };
}
function createScene(React,asset,ImageComponent='img'){
 const h=React.createElement;
 function Lines({items,enter,exit=0,className='',serif=false}){
  return h('h2',{className:'ct-headline '+className},items.map((text,i)=>h('span',{className:'ct-line',key:i},h('span',{
   className:serif&&i===items.length-1?'ct-italic':'',style:{transform:`translate3d(0,${(1-enter)*112-exit*115}%,0) rotate(${(1-enter)*2-exit*1.1}deg)`}},text))));
 }
 const layer=(alpha)=>({opacity:alpha,visibility:alpha>.0001?'visible':'hidden',pointerEvents:'none'});
 function Plate({src,alt='',className='',style={},...rest}){return h(ImageComponent,{src:asset(src),alt,className,style,draggable:false,...rest});}
 return function ContinuumScene({progress=0,small=false,record=0,crop=.50,onCrop,onRecord,onWork,onContact,onResume,film=false}){
  const m=model(progress,small),p=m.p,r=RECORDS[record]||RECORDS[0],a=m.main;
  const photoZoom=lerp(1.08,1.02,range(.24,.36,p));
  const separation=m.strips*.82;
  return h('div',{className:'ct-scene'+(small?' is-small':''),'data-act':p<.255?'perspective':p<.505?'composition':p<.70?'practice':p<.87?'work':'contact'},
   h('div',{className:'ct-atmosphere',style:{opacity:m.backdrop}},h('div',{className:'ct-ambient-light',style:{transform:`translate3d(${Math.sin(p*5)*7}vw,${Math.cos(p*4)*8}vh,0)`}})),
   h('div',{className:'ct-profile',style:layer(m.profile),inert:m.profile<.75},
    h('div',{className:'ct-kicker'},h('span',null,'01 / PERSPECTIVE'),h('span',null,'创作者 · Kilian Zhou')),
    h(Lines,{items:['不是一种风格。','是一种看法。'],enter:m.profileEnter,exit:m.profileExit}),
    h('div',{className:'ct-profile-copy',style:{transform:`translateY(${(1-m.profileEnter)*40-m.profileExit*30}px)`}},
     h('p',null,'平面设计、摄影摄像与剪辑，是我理解同一个想法的不同方式。'),
     h('p',{className:'ct-muted'},'从一帧影像出发。选择边界、建立秩序，再让时间赋予它节奏。')),
    h('span',{className:'ct-profile-word',style:{transform:`translateX(${(1-m.profileEnter)*14-m.profileExit*12}%)`}},'PERSPECTIVE'),
    h('span',{className:'ct-caption'},'影像取自现有项目 / A FRAME FROM THE WORK')),
   h('div',{className:'ct-sheet',role:m.grid>.75?'slider':undefined,tabIndex:m.grid>.75?0:-1,'aria-label':m.grid>.75?'拖动取景边界':undefined,'aria-valuemin':0,'aria-valuemax':100,'aria-valuenow':Math.round(crop*100),onPointerDown:e=>{if(m.grid<.75)return;e.currentTarget.setPointerCapture(e.pointerId);const b=e.currentTarget.getBoundingClientRect();onCrop?.(clamp((e.clientX-b.left)/b.width));},onPointerMove:e=>{if(!e.buttons||m.grid<.75)return;const b=e.currentTarget.getBoundingClientRect();onCrop?.(clamp((e.clientX-b.left)/b.width));},onKeyDown:e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onCrop?.(clamp(crop+(e.key==='ArrowRight'?.05:-.05)));}},style:{pointerEvents:m.grid>.75?'auto':'none',cursor:m.grid>.75?'ew-resize':'default',left:a[0]*100+'%',top:a[1]*100+'%',width:a[2]*100+'%',height:a[3]*100+'%',opacity:m.mainAlpha,
     transform:`perspective(1400px) rotateY(${a[5]}deg) rotateZ(${a[4]}deg)`,borderRadius:lerp(4,1,range(.2,.28,p))+'px'}},
    h('div',{className:'ct-image-content',style:{clipPath:`inset(0 ${m.grid*crop*19}% 0 ${m.grid*crop*19}%)`}},
     h(Plate,{src:MEDIA.space,className:'ct-source-photo',style:{opacity:1-separation,transform:`scale(${photoZoom})`,objectPosition:`${42+crop*16}% 50%`}}),
     h('div',{className:'ct-image-shade',style:{opacity:m.photoShade}}),
     h('div',{className:'ct-record-design','data-record':record,style:{opacity:m.archiveImage}},
      h('span',{className:'ct-study-top'},'TYPE / SYSTEM / STUDY'),
      h('div',{className:'ct-study-word'},record===0?'SOUND':'FORM',h('em',null,record===0?'as form.':'in motion.')),
      h('svg',{className:'ct-study-lines',viewBox:'0 0 400 320',preserveAspectRatio:'none','aria-hidden':true},
       ...Array.from({length:22},(_,i)=>h('path',{key:i,d:record===0?`M-15 ${85+i*6} C75 ${15+i*3},135 ${290-i*4},205 ${132+i*4} S305 ${65+i*2},415 ${145+i*7}`:`M-30 ${40+i*12} L110 ${92+i*5} L230 ${62+i*7} L430 ${120+i*4}`,fill:'none',stroke:'#cdd6c0',strokeWidth:.7,opacity:.2+i*.022}))),
      h('span',{className:'ct-study-bottom'},'PROJECT CONCEPT',h('small',null,'项目概念示意 · 非交付原图'))),
     h(Plate,{src:WORKS[0].src,className:'ct-proof-photo',style:{opacity:m.proofImage}})),
    h('div',{className:'ct-photo-planes','aria-hidden':true,style:{opacity:separation,visibility:separation>.001?'visible':'hidden',clipPath:`inset(-8% ${m.grid*crop*10}% -8% ${m.grid*crop*10}%)`}},
     ...Array.from({length:5},(_,i)=>h('div',{className:'ct-photo-plane',key:i,style:{left:(i*20)+'%',transform:`perspective(800px) translate3d(${(i-2)*separation*13}px,${Math.sin(i*1.2)*separation*18}px,0) rotateY(${(i-2)*separation*-8}deg)`,boxShadow:`${separation*-12}px ${separation*13}px ${separation*21}px rgba(0,0,0,.30)`}},
      h(Plate,{src:MEDIA.space,style:{left:(-i*100)+'%',objectPosition:`${42+crop*16}% 50%`}})))),
    h('div',{className:'ct-registration',style:{opacity:m.grid}},h('i'),h('i'),h('i'),h('i'),h('div',{className:'ct-rule-of-thirds'}),h('span',null,'FRAME / 01')),
    h('div',{className:'ct-crop-shade',style:{opacity:m.grid,left:(crop*19)+'%',right:(crop*19)+'%'}},h('i'),h('i')),
    h('div',{className:'ct-image-label',style:{opacity:m.profile}},'STUDY OF SPACE',h('span',null,'01'))),
   h('div',{className:'ct-method',style:layer(m.method),inert:m.method<.75},
    h('div',{className:'ct-method-label'},'02 / COMPOSITION'),
    h('div',{className:'ct-method-statement',style:{transform:`translate3d(0vw,${range(.348,.448,p)*(small?-5:-5)}vh,0) scale(${1-range(.348,.448,p)*(small?.12:.33)})`,transformOrigin:'left top'}},
     h(Lines,{items:['把看见的，','变成被记住的。'],enter:m.methodEnter,exit:m.methodExit})),
    h('div',{className:'ct-method-details',style:{opacity:range(.354,.434,p)*(1-m.methodExit),transform:`translateY(${(1-range(.355,.438,p))*32}px)`}},
     h('p',null,'设计不是不断增加。',h('br'),'而是让每一次选择都有理由。'),
     h('div',{className:'ct-method-row'},h('small',null,'01'),h('strong',null,'观察'),h('span',null,'找到画面的中心')),
     h('div',{className:'ct-method-row'},h('small',null,'02'),h('strong',null,'编排'),h('span',null,'建立信息的轻重')),
     h('div',{className:'ct-method-row'},h('small',null,'03'),h('strong',null,'叙事'),h('span',null,'让节奏带着人向前'))),
    h('div',{className:'ct-crop-control',inert:m.grid<.75,style:{opacity:m.grid}},h('span',{className:'ct-crop-instruction'},'↔ 拖动画面，改变取景边界'),h('span',null,'COMPOSE / '+String(Math.round(crop*100)).padStart(2,'0')))),
   h('div',{className:'ct-archive',style:layer(m.archive),inert:m.archive<.75},
    h('div',{className:'ct-kicker'},h('span',null,'03 / PRACTICE'),h('span',null,'实践档案')),
    h(Lines,{items:['实践，','形成语言。'],enter:m.archiveEnter,exit:m.archiveExit}),
    h('div',{className:'ct-record-list',style:{transform:`translateY(${(1-m.archiveEnter)*42-m.archiveExit*50}px)`}},
     RECORDS.map((item,i)=>h('button',{className:'ct-record'+(record===i?' selected':''),key:item.id,'aria-expanded':record===i,onClick:()=>onRecord?.(i),onPointerEnter:e=>{if(e.pointerType==='mouse')onRecord?.(i)},onFocus:()=>onRecord?.(i)},
      h('span',{className:'ct-record-year'},item.year),h('span',{className:'ct-record-title'},item.title,h('small',null,item.en)),h('span',{className:'ct-record-arrow'},record===i?'−':'+'))),
     h('p',{className:'ct-record-body'},r.body),
     h('div',{className:'ct-record-tags'},r.tags.map(t=>h('span',{key:t},t))),
     h('p',{className:'ct-record-source'},'原站项目探索记录 · 非任职证明')),
    h('span',{className:'ct-record-meta'},r.kind),
    h('button',{className:'ct-text-link ct-resume',onClick:onResume},'查看能力档案',h('span',null,'↗'))),
   h('div',{className:'ct-evidence',style:layer(m.evidence),inert:m.evidence<.75},
    h('div',{className:'ct-kicker'},h('span',null,'04 / SELECTED WORK'),h('span',null,'表达有迹')),
    h(Lines,{items:['让作品，继续说。'],enter:m.evidenceEnter,exit:m.evidenceExit}),
    h('p',{className:'ct-evidence-description'},'品牌叙事、活动推广与餐饮视觉。',h('br'),'每一次表达，都落实为可以展开阅读的作品。'),
    h('span',{className:'ct-evidence-note'},'07 件完整作品 / 点击进入作品空间'),
    h('button',{className:'ct-first-work','aria-label':'查看盛启预告完整作品',onClick:()=>onWork?.(1)},h('span',null,'01'),h('strong',null,'盛启预告'),h('span',null,'↗'))),
   ...WORKS.slice(1).map((work,i)=>{
    const t=range(.674+i*.005,.747+i*.002,p),out=range(.847+i*.003,.918+i*.003,p);
    const x=small?((i+1)%3)*.31+.055:.257+i*.119;
    const y=small?.355+Math.floor((i+1)/3)*.183:.43+Math.sin((i+1)*2.1)*.058;
    const width=small?.275:.104,height=small?.16:.266;
    const startX=a[0]+.03*(i+1),startY=a[1]+.025*(i+1);
    return h('button',{key:work.id,className:'ct-proof-sheet','aria-label':'查看'+work.title+'完整作品',inert:t<.85||out>.1,onClick:()=>onWork?.(work.id),style:{
     left:lerp(startX,x,t)*100+'%',top:(lerp(startY,y,t)+out*(i%2?-.45:.7))*100+'%',width:lerp(a[2]*.65,width,t)*100+'%',height:lerp(a[3]*.70,height,t)*100+'%',
     opacity:t*(1-out),visibility:t>.001?'visible':'hidden',transform:`rotate(${(Math.sin(i*1.8)*6)*(t)+out*(i%2?9:-10)}deg)`,zIndex:4+i,pointerEvents:t>.85&&out<.1?'auto':'none'}},
     h(Plate,{src:work.src,alt:work.title}),h('span',{className:'ct-proof-label'},String(work.id).padStart(2,'0'),h('strong',null,work.title),h('i',null,'↗')));
   }),
   h('div',{className:'ct-contact',style:layer(m.footer),inert:m.footer<.75},
    h('div',{className:'ct-contact-overline'},'NEXT / THE FRAME WE MAKE TOGETHER'),
    h(Lines,{items:['下一帧，','一起完成。'],enter:m.footerEnter,className:'ct-contact-title'}),
    h('div',{className:'ct-contact-bottom'},h('p',null,'从一个想法，开始一次合作。',h('br'),'平面设计 / 摄影摄像 / 剪辑与调色'),
     h('button',{className:'ct-contact-action',onClick:()=>onContact?.({type:'品牌与平面设计'})},h('span',null,'聊聊你的项目'),h('i',{'aria-hidden':true},'↗'))),
    h('div',{className:'ct-contact-colophon'},h('span',null,'KILIAN ZHOU'),h('span',null,'DESIGN · IMAGE · MOTION'))),
   h('div',{className:'ct-act-track',style:{opacity:m.backdrop*(1-m.footer)}},h('span',null,p<.255?'观察':p<.505?'编排':p<.704?'实践':'作品'),h('div',null,h('i',{style:{transform:`scaleX(${clamp((p-.11)/.76)})`}})),h('span',null,'CONTINUUM'))
  );
 };
}
module.exports={createScene,model,CLOCK,CHAPTERS,MEDIA,RECORDS,WORKS,clamp,lerp,range,tween};
