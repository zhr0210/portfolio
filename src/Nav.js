'use strict';
const React=__r(1),h=React.createElement,{CHAPTERS}=__r(7),{navigateScene}=__r(8);
function Nav({active,space='about',view='sphere'}){
 const [open,setOpen]=React.useState(false),dock=React.useRef(null),timer=React.useRef(0),hover=React.useRef(false);
 const canOpen=()=>!window.__INTRO_ACTIVE__&&!document.body.dataset.overlayOpen&&!document.body.dataset.spaceSwitching;
 const show=()=>{clearTimeout(timer.current);if(canOpen())setOpen(true);};const close=()=>{clearTimeout(timer.current);setOpen(false);};
 const enter=e=>{if(e.pointerType==='touch')return;hover.current=true;clearTimeout(timer.current);timer.current=setTimeout(show,110);};
 const leave=e=>{if(e.pointerType==='touch')return;hover.current=false;clearTimeout(timer.current);timer.current=setTimeout(()=>{if(!dock.current?.contains(document.activeElement))setOpen(false);},220);};
 React.useEffect(()=>{const key=e=>{if(e.key==='Escape'&&open){e.preventDefault();setOpen(false);document.getElementById('menu-toggle')?.focus({preventScroll:true});}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[open]);
 React.useEffect(()=>setOpen(false),[active,view,space]);React.useEffect(()=>()=>clearTimeout(timer.current),[]);
 const c=space==='works'?(view==='list'?{label:'商业案例',en:'WORK INDEX'}:{label:'作品全景',en:'SELECTED WORKS'}):CHAPTERS.find(c=>c.id===active)||CHAPTERS[0];
 const links=CHAPTERS.filter(c=>['profile','method','archive','evidence','footer'].includes(c.id));
 return h('nav',{className:'site-nav','aria-label':'页内导航'},
  h('button',{className:'nav-chapter',onClick:()=>navigateScene(space==='about'?'hero':'works'),'aria-label':space==='about'?'关于我，返回页首':'作品，返回浏览起点'},h('span',null,c.label),h('small',null,c.en)),
  h('div',{ref:dock,className:'nav-right nav-dock'+(open?' is-open':''),onPointerEnter:enter,onPointerLeave:leave,onBlur:e=>{if(!e.currentTarget.contains(e.relatedTarget)&&!hover.current)close();}},
   h('div',{id:'inline-site-menu',className:'inline-menu',inert:!open,'aria-hidden':!open},h('div',{className:'inline-menu-links'},links.map((ch,i)=>h('button',{key:ch.id,style:{'--item-order':4-i},tabIndex:open?0:-1,'aria-current':space==='about'&&active===ch.id?'location':undefined,onClick:()=>{close();navigateScene(ch.id);}},h('span',{className:'nav-link-full'},ch.label),h('span',{className:'nav-link-short'},ch.short))))),
   h('button',{id:'menu-toggle',className:'menu-trigger','aria-expanded':open,'aria-controls':'inline-site-menu',onClick:()=>{if(canOpen())setOpen(v=>!v);},onKeyDown:e=>{if(e.key==='ArrowLeft'){e.preventDefault();show();setTimeout(()=>dock.current?.querySelector('.inline-menu button:last-child')?.focus(),100);}}},'MENU',h('i',{'aria-hidden':true}))));
}
exports.default=Nav;
