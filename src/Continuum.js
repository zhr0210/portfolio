'use strict';
const React=__r(1),h=React.createElement,{asset}=__r(11);
const {createScene,model,CLOCK,clamp,range}=__r(37);
const Scene=createScene(React,asset);
function Continuum({space,reduced,onContact,onResume}){
 const [p,setP]=React.useState(0),[small,setSmall]=React.useState(()=>innerWidth<768);
 const [record,setRecord]=React.useState(0),[crop,setCrop]=React.useState(.5);
 const refs=React.useRef({space,reduced});refs.current={space,reduced};
 React.useLayoutEffect(()=>{
  const run=document.getElementById('about-hero-run'),hero=document.getElementById('global-canvas');
  let alive=true,raf=0,last=0,value=0,target=0;
  const span=()=>Math.max(1,run.offsetHeight-innerHeight);
  function apply(v){
   const m=model(v,innerWidth<768);setP(v);
   // Original hero geometry and persistent SVG remain unchanged; only the whole camera layer exits.
   hero.style.opacity=String(m.hero);hero.style.visibility=m.hero>.0001?'visible':'hidden';
   hero.style.transform=`translate3d(0,${-range(.015,.105,v)*innerHeight*.085}px,0)`;
   hero.style.filter=refs.current.reduced?'none':`blur(${range(.033,.106,v)*5}px)`;
   hero.inert=m.hero<.75;
   document.body.dataset.atHero=String(v<.087);
   run.dataset.playhead=v.toFixed(6);
   window.dispatchEvent(new CustomEvent('continuum-progress',{detail:{progress:v}}));
  }
  function frame(now){
   raf=0;if(!alive||document.hidden||refs.current.space!=='about')return;
   const dt=Math.min(.05,(now-last)/1000||.016);last=now;
   target=window.__INTRO_ACTIVE__?0:clamp(scrollY/span());
   const gap=target-value;
   value=refs.current.reduced?target:Math.abs(gap)<.000015?target:value+gap*(1-Math.exp(-dt/0.085));
   apply(value);
   if(Math.abs(target-value)>.000015)request();
  }
  function request(){if(!raf&&alive)raf=requestAnimationFrame(frame);}
  function resize(){setSmall(innerWidth<768);request();}
  const visibility=()=>{last=performance.now();if(!document.hidden)request();};
  window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',resize);
  window.addEventListener('portfolio-space-change',request);window.addEventListener('intro-complete',request);
  document.addEventListener('visibilitychange',visibility);
  const observer=new ResizeObserver(request);observer.observe(run);
  apply(0);request();
  const inspection={getState:()=>({progress:value,target,span:span(),record,crop}),go:id=>{const v=CLOCK[id];if(v!==undefined&&!window.__INTRO_ACTIVE__)scrollTo({top:v*span(),behavior:refs.current.reduced?'instant':'smooth'});}};
  if(window.__PORTFOLIO_TEST__)inspection.seek=v=>{value=target=clamp(v);scrollTo({top:value*span(),behavior:'instant'});apply(value);};
  window.__CONTINUUM__=inspection;
  return()=>{alive=false;cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('scroll',request);window.removeEventListener('resize',resize);window.removeEventListener('portfolio-space-change',request);window.removeEventListener('intro-complete',request);document.removeEventListener('visibilitychange',visibility);delete window.__CONTINUUM__;};
 },[]);
 const work=id=>window.dispatchEvent(new CustomEvent('show-work-category',{detail:{projectId:id}}));
 return h('div',{className:'ct-host'},h(Scene,{progress:p,small,record,crop,onRecord:setRecord,onCrop:setCrop,onWork:work,onContact,onResume}));
}
exports.default=Continuum;
