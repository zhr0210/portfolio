'use strict';
const React=__r(1),h=React.createElement,{letters}=__r(23);
const {Glyphs,register,paintGlyph,settle,syncStroke}=__r(26);
const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*t*(t*(t*6-15)+10);};
const NS='http://www.w3.org/2000/svg';
const DURATION=7160;
// One clock per sequence, not a separate completion/fill clock per word.
const TYPE_TIMING={
 intro:{start:.36,end:1.88,fillStart:1.98,fillEnd:2.38,eraseStart:3.36,eraseEnd:3.93},
 hero:{start:4.15,end:5.81,fillStart:5.91,fillEnd:6.43}
};
function node(tag,attrs){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs||{}))e.setAttribute(k,String(v));return e;}
/** Derive construction from the ACTUAL glyph extents, stems, capline and counters.
 * No evenly spaced background lattice, no grid clipped arbitrarily inside letters. */
function anatomy(svg){
 const layer=svg.querySelector('.anatomy'),glyphs=register(svg.querySelector('.intro-type'));layer.replaceChildren();
 const scale=1060/letters.PORTFOLIO.viewBox[2],x0=70,y0=185;
 const X=x=>x0+(x-137)*scale,Y=y=>y0+(y+1430)*scale;
 const items=[];
 function line(d,kind='secondary',delay=0){
  const p=node('path',{d,class:'anatomy-line '+kind,pathLength:1,fill:'none'});layer.appendChild(p);items.push({p,delay,kind});
 }
 function label(x,y,text,anchor='start'){
  const e=node('text',{x,y,'text-anchor':anchor,class:'anatomy-label'});e.textContent=text;layer.appendChild(e);
 }
 function point(x,y){const e=node('circle',{cx:x,cy:y,r:1.5,class:'anatomy-node'});layer.appendChild(e);}
 line(`M38 ${Y(-1409)}H1162`,'major',0);line(`M38 ${Y(0)}H1162`,'major',.06);
 label(39,Y(-1409)-15,'CAP HEIGHT');label(39,Y(0)+26,'BASELINE');
 glyphs.forEach((g,i)=>{
  const b=g.face.getBBox(),left=X(b.x),right=X(b.x+b.width),cx=(left+right)/2;
  const round=[1,5,8].includes(i),xx=round?cx:i===3?X(5008.16):left;
  line(`M${xx} ${Y(-1430)-18}V${Y(0)+17}`,'axis',.05+i*.025);
  line(`M${right} ${Y(-1409)-5}V${Y(-1409)+5}M${right} ${Y(0)-5}V${Y(0)+5}`,'tick',.08+i*.025);
  label(xx,Y(-1430)-30,String(i+1).padStart(2,'0'),'middle');
  if(round){
   const cy=Y(-705),rx=b.width*scale/2,ry=725*scale;
   line(`M${left-8} ${cy}H${right+8}`,'axis',.12+i*.025);
   line(`M${left-8} ${Y(-1430)}H${right+8}M${left-8} ${Y(20)}H${right+8}`,'secondary',.15+i*.025);
   line(`M${cx+rx} ${cy}A${rx} ${ry} 0 1 0 ${cx-rx} ${cy}A${rx} ${ry} 0 1 0 ${cx+rx} ${cy}`,'ellipse',.20+i*.02);
   point(cx,cy);
  }else{
   // Stem width is 295 units for the Latin outline used by the settled hero.
   const stem=i===3?X(5303.16):X(b.x+295);line(`M${stem} ${Y(-1409)-9}V${Y(0)+9}`,'secondary',.16+i*.02);
  }
 });
 // Bowl baseline of P, upper bar of F, diagonal leg of R. These touch the outlines.
 line(`M${X(115)} ${Y(-496)}H${X(1328)}`,'secondary',.28);
 line(`M${X(5948)} ${Y(-745)}H${X(7040)}M${X(5948)} ${Y(-517)}H${X(7040)}`,'secondary',.30);
 line(`M${X(4024)} ${Y(-673)}L${X(4510)} ${Y(82)}`,'diagonal',.34);
 point(X(4076.44),Y(-592));point(X(4457.44),Y(0));
 label(1160,Y(0)+26,'CONTOUR / FORM','end');
 return items;
}
function Opening({reduced=false}){
 const [done,setDone]=React.useState(false),surface=React.useRef(null);
 React.useLayoutEffect(()=>{
  const body=document.body;
  if(done){document.querySelectorAll('.vector-type').forEach(settle);return;}
  const host=surface.current;if(!host)return;
  const svg=host.querySelector('svg'),intro=svg.querySelector('.intro-type'),guides=anatomy(svg);
  const words=[...document.querySelectorAll('.vector-type')];words.forEach(register);register(intro);
  let dead=false,raf=0,last=0,elapsed=0,ready=false,debugPaused=false;
  body.dataset.introActive='true';body.dataset.introMarquee='false';window.__INTRO_ACTIVE__=true;
  function set(k,v){body.style.setProperty('--intro-'+k,String(v));}
  function drawWord(el,t,group,erase=false){
   syncStroke(el);
   const glyphs=register(el);if(!glyphs?.length)return;
   const clock=TYPE_TIMING[group],front=el.dataset.front==='true',outlined=el.dataset.outlineOnly==='true';
   const wordOffset=group==='hero'?({'KILIAN':0,'ZHOU':.045,'作品集':.08,'PORTFOLIO':.11}[el.dataset.word]||0):0;
   const commonFill=smooth(clock.fillStart,clock.fillEnd,t);
   const face=commonFill*(erase?1-smooth(3.08,3.34,t):1);
   glyphs.forEach((g,i)=>{
    // Every glyph, including Chinese and the outlined subtitle, closes on clock.end.
    // The tiny start stagger never changes that end time, nor the common fill envelope.
    const from=clock.start+wordOffset+i*.012;
    const raw=clamp((t-from)/(clock.end-from));
    const progress=reduced?(t>=clock.start?1:0):raw*.78+smooth(0,1,raw)*.22;
    const strength=front?.18:outlined?.48:1-.92*commonFill;
    const exit=reduced?0:erase?clamp((t-clock.eraseStart)/(clock.eraseEnd-clock.eraseStart)):0;
    paintGlyph(g,progress,face,strength,exit);
   });
   el.dataset.traceEnd=String(clock.end);el.dataset.fillStart=String(clock.fillStart);
  }
  function paint(t){
   if(dead)return;
   host.dataset.phase=t<.35?'anatomy':t<2.2?'contour':t<3.94?'form-to-field':t<5.90?'hero-contour':'hero-exposure';
   host.dataset.elapsed=t.toFixed(3);
   guides.forEach(({p,delay,kind})=>{
    const v=1-Math.pow(1-clamp((t-delay)/.46),3),f=1-smooth(1.18,2.04,t);
    p.style.strokeDasharray=`${v.toFixed(6)} 1`;p.style.strokeDashoffset='0';
    p.style.opacity=String(f*(kind==='major'?.36:kind==='axis'?.22:kind==='ellipse'?.11:.18));
   });
   const labeling=smooth(.30,.66,t)*(1-smooth(1.25,2.05,t));
   svg.querySelectorAll('.anatomy-node,.anatomy-label').forEach(e=>e.style.opacity=String(labeling));
   drawWord(intro,t,'intro',true);svg.style.opacity=String(1-smooth(3.70,4.04,t));
   const arrival=clamp((t-3.46)/1.15),e=1-Math.pow(1-arrival,5);
   set('world-top',((1-e)*68)+'vw');set('world-bottom',((1-e)*-55)+'vw');set('marquee',smooth(3.46,3.89,t));
   document.querySelectorAll('.world-line').forEach(el=>{el.style.filter=arrival<1?`blur(${(1-e)*18}px)`:'none';});
   body.dataset.introMarquee=t>=4.56?'true':'false';
   for(const el of words)drawWord(el,t,'hero');
   // Title is never cross-faded to other glyphs; only the surroundings arrive here.
   set('bio',smooth(6.02,6.75,t));set('portrait',smooth(5.90,6.71,t));set('light',smooth(5.82,6.67,t));set('nav',smooth(6.17,6.79,t));
  }
  function finish(focus=false){
   if(dead)return;paint(DURATION/1000);words.forEach(settle);dead=true;cancelAnimationFrame(raf);
   delete body.dataset.introActive;delete body.dataset.introMarquee;window.__INTRO_ACTIVE__=false;
   ['bio','portrait','light','nav','marquee','world-top','world-bottom'].forEach(k=>body.style.removeProperty('--intro-'+k));
   document.querySelectorAll('.world-line').forEach(el=>el.style.removeProperty('filter'));
   window.__OPENING__={getState:()=>({done:true,phase:'complete',elapsed:DURATION}),finish:()=>{}};
   setDone(true);window.dispatchEvent(new Event('intro-complete'));
   if(focus)requestAnimationFrame(()=>document.querySelector('#menu-toggle')?.focus({preventScroll:true}));
  }
  function tick(now){
   if(dead)return;raf=requestAnimationFrame(tick);
   if(!ready||document.hidden||debugPaused){last=now;return;}
   elapsed+=last?Math.min(64,now-last):0;last=now;paint(elapsed/1000);if(elapsed>=DURATION)finish();
  }
  paint(0);raf=requestAnimationFrame(tick);
  Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,500))]).then(()=>{if(!dead)ready=true;});
  const inspection={getState:()=>({done:false,phase:host.dataset.phase,elapsed,duration:DURATION})};
  // The shipped page has no finish/seek entry point. Test builds opt in before mounting.
  if(window.__PORTFOLIO_TEST__===true)Object.assign(inspection,{
   seek:ms=>{debugPaused=true;elapsed=Math.max(0,Math.min(ms,DURATION-1));paint(elapsed/1000);},
   play:()=>{debugPaused=false;last=performance.now();}});
  window.__OPENING__=inspection;
  return()=>{dead=true;cancelAnimationFrame(raf);words.forEach(settle);
   delete body.dataset.introActive;delete body.dataset.introMarquee;window.__INTRO_ACTIVE__=false;};
 },[reduced,done]);
 if(done)return null;
 const data=letters.PORTFOLIO,scale=1060/data.viewBox[2];
 return h('div',{ref:surface,className:'opening-layer','aria-label':'字形构造开场'},
  h('svg',{className:'opening-construction',viewBox:'0 0 1200 500','aria-hidden':true},
   h('g',{className:'anatomy'}),
   h('g',{className:'intro-type','data-word':'PORTFOLIO',transform:`translate(70,185) scale(${scale}) translate(-137,1430)`},h(Glyphs,{word:'PORTFOLIO'}))),
  );
}
exports.TYPE_TIMING=TYPE_TIMING;exports.default=Opening;
