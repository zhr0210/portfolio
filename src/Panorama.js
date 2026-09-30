'use strict';
const React=__r(1),h=React.createElement,{createPortal}=__r(4);
const {SphericalGallery}=__r(13),{projects,frames,categories}=__r(14),{asset}=__r(11);
const {useScrollLock,useDialogFocus,navigateScene}=__r(8),Icon=__r(9).default;
function ViewIcon({list=false}){
 return h('svg',{width:18,height:18,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.35,'aria-hidden':true},list?
  [h('path',{key:1,d:'M8 5h13M8 12h13M8 19h13'}),h('path',{key:2,d:'M2 5h1M2 12h1M2 19h1',strokeWidth:2})]:
  [h('rect',{key:1,x:3,y:3,width:7,height:7,rx:1}),h('rect',{key:2,x:14,y:3,width:7,height:7,rx:1}),h('rect',{key:3,x:3,y:14,width:7,height:7,rx:1}),h('rect',{key:4,x:14,y:14,width:7,height:7,rx:1})]);
}

const Preview=__r(21).default;

function Panorama({active,reduced,onView}){
 const canvas=React.useRef(null),engine=React.useRef(null),handlers=React.useRef(null);
 const [view,setView]=React.useState('sphere'),[filter,setFilter]=React.useState('全部作品'),[filterOpen,setFilterOpen]=React.useState(false);
 const [selection,setSelection]=React.useState(null),[ready,setReady]=React.useState(false),[fallback,setFallback]=React.useState(false);
 const filtered=projects.filter(p=>filter==='全部作品'||p.category===filter);
 const close=React.useCallback(()=>{setSelection(null);engine.current?.setLocked(false);},[]);
 const open=React.useCallback(hit=>{setSelection(hit);setFilterOpen(false);engine.current?.setLocked(true);},[]);
 handlers.current={open};
 React.useEffect(()=>{
  const gallery=new SphericalGallery(canvas.current,{frames,projects,onHover:()=>{},onOpen:hit=>handlers.current.open(hit),onReady:()=>setReady(true),onError:e=>{console.warn('Gallery compatibility:',e.message);setFallback(true);setView('list');}});
  engine.current=gallery;gallery.state=window.__PANORAMA_TIMELINE__||gallery.state;gallery.setEnabled(true);
  return()=>gallery.destroy();
 },[]);
 React.useEffect(()=>{engine.current?.setEnabled(active&&view==='sphere');},[active,view]);
 React.useEffect(()=>{engine.current?.setFilter(frames.filter(f=>filtered.some(p=>p.id===f.projectId)).map(f=>f.id));},[filter]);
 React.useEffect(()=>{engine.current?.setLocked(!!selection||filterOpen);},[selection,filterOpen]);
 React.useEffect(()=>{if(!active){close();setFilterOpen(false);}},[active]);
 React.useEffect(()=>{
  if(!filterOpen)return;const key=e=>{if(e.key==='Escape'){setFilterOpen(false);document.getElementById('filter-toggle')?.focus();}};
  const outside=e=>{if(!e.target.closest('.panorama-filter'))setFilterOpen(false);};
  document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);
  return()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);};
 },[filterOpen]);
 React.useLayoutEffect(()=>{onView?.(view);window.dispatchEvent(new CustomEvent('works-view-change',{detail:view}));},[view]);
 React.useEffect(()=>{const reset=()=>{close();setFilterOpen(false);setView('sphere');};window.addEventListener('works-reset-view',reset);return()=>window.removeEventListener('works-reset-view',reset);},[close]);
 React.useEffect(()=>{const focus=e=>{const d=e.detail||{};close();setView('sphere');setFilterOpen(false);
   if(d.category&&categories.includes(d.category))setFilter(d.category);
   if(d.projectId){setFilter('全部作品');const project=projects.find(p=>p.id===d.projectId);if(project)open({project,frame:frames.find(f=>f.projectId===project.id)});}
  };window.addEventListener('works-open-project',focus);return()=>window.removeEventListener('works-open-project',focus);},[close,open]);
 const changeView=v=>{close();setFilterOpen(false);setView(v);};
 return h('section',{id:'scene-works',className:'sequence-scene panorama-scene '+(view==='list'?'is-list':''),'aria-label':'作品库，沉浸式网格或商业案例列表'},
  h('canvas',{ref:canvas,className:'panorama-canvas',style:{visibility:view==='sphere'?'visible':'hidden'},tabIndex:active&&view==='sphere'?0:-1,role:'img','aria-label':'沉浸式作品网格。按住拖动探索，点击打开作品详情。方向键移动视野，回车打开中央作品。'}),
  view==='sphere'&&h('div',{className:'panorama-vignette','aria-hidden':true}),
  !ready&&!fallback&&view==='sphere'&&h('div',{className:'panorama-loading',role:'status'},h('span',{className:'loading-dot'}),'正在准备作品…'),
  view==='list'&&h('div',{className:'case-list-view'},
   h('header',{className:'case-list-heading'},h('div',null,h('span',{className:'eyebrow'},'01 / WORK INDEX'),h('h2',null,'商业案例',h('span',null,'Selected work.'))),h('p',null,String(filtered.length).padStart(2,'0')+' / '+String(projects.length).padStart(2,'0')+' 个作品',h('br'),'图像与文字，另一种阅读节奏。')),
   fallback&&h('p',{className:'webgl-note',role:'status'},'图形预览暂不可用，已切换为完整的图文列表。'),
   h('div',{className:'case-list-scroll','aria-label':'商业案例列表'},filtered.map(project=>h('button',{key:project.id,className:'case-row','data-scroll-reveal':true,onClick:()=>open({project,frame:frames.find(f=>f.projectId===project.id)}),'aria-label':'查看 '+project.title},
    h('span',{className:'case-number'},String(project.id).padStart(2,'0')),
    h('div',{className:'case-copy'},h('h3',null,project.title),h('span',{className:'case-en'},project.en),h('p',null,project.description)),
    h('span',{className:'case-category'},project.category,h('small',null,(project.year||'—')+' / EDITORIAL')),
    h('img',{src:asset(project.cover),alt:project.title+'封面',loading:'lazy',draggable:false}),h(Icon,{name:'diagonal',size:18}))),
    h('div',{className:'case-list-end'},h('span',null,'END OF INDEX / '+String(filtered.length).padStart(2,'0')),h('button',{className:'text-button',onClick:()=>window.scrollTo({top:0,behavior:reduced?'instant':'smooth'})},'返回作品目录 ',h(Icon,{name:'down',size:14}))))),
  createPortal(h('div',{className:'panorama-controls flow-panorama-controls'},
   h('div',{className:'lens-view-group'},
    h('div',{className:'panorama-view-switch',role:'group','aria-label':'作品浏览模式'},
     h('button',{className:view==='sphere'?'selected':'','aria-pressed':view==='sphere','aria-label':'沉浸网格模式',title:'沉浸网格',disabled:fallback,onClick:()=>changeView('sphere')},h(ViewIcon)),
     h('button',{className:view==='list'?'selected':'','aria-pressed':view==='list','aria-label':'商业案例列表模式',title:'文字列表',onClick:()=>changeView('list')},h(ViewIcon,{list:true}))),
    view==='sphere'&&h('button',{className:'lens-reset','aria-label':'全景视角归位',title:'视角归位',onClick:()=>engine.current?.reset()},h(Icon,{name:'reset',size:15}))),
   h('div',{className:'panorama-filter'},filterOpen&&h('div',{id:'works-filter-panel',className:'filter-popover','aria-label':'筛选作品类别'},h('header',null,'作品分类',h('span',null,'FILTER')),categories.map(c=>{
    const count=c==='全部作品'?projects.length:projects.filter(p=>p.category===c).length;
    return h('button',{key:c,className:filter===c?'selected':'','aria-pressed':filter===c,onClick:()=>{setFilter(c);setFilterOpen(false);}},h('span',null,c),h('span',null,String(count).padStart(2,'0')),filter===c&&h('i'));
   })),h('button',{id:'filter-toggle',className:'filter-trigger','aria-expanded':filterOpen,'aria-controls':'works-filter-panel',onClick:()=>setFilterOpen(v=>!v)},filter==='全部作品'?'筛选':filter,h('span',null,String(filtered.length).padStart(2,'0'))))),document.body),
  h('span',{className:'sr-only',role:'status','aria-live':'polite'},'当前显示 '+filtered.length+' 个作品。'),
  selection&&h(Preview,{key:selection.project.id+'-'+selection.frame.id,selection,onClose:close,onProject:open,available:filtered,reduced}));
}
exports.default=Panorama;
