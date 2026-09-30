'use strict';
const React=__r(1),h=React.createElement,{createPortal}=__r(4);
const {useScrollLock,useDialogFocus}=__r(8),Icon=__r(9).default,{asset}=__r(11),{frames}=__r(14),{GradientField}=__r(22),{AutoReader}=__r(27);
/** Real media dimensions, not viewport aspect ratio, choose the detail composition. */
function describeMedia(project,dimensions){
 const ratio=dimensions?.width&&dimensions?.height?dimensions.width/dimensions.height:project.width&&project.height?project.width/project.height:9/16;
 const video=project.type==='video'||project.mediaType==='video'||!!project.video;
 return{ratio,video,portrait:ratio<=1.04,long:!video&&ratio<.45,source:asset(project.video||project.image||project.src||project.cover)};
}
function WorkPreview({selection,onClose,onProject,available,reduced=false}){
 const {project}=selection,frame=selection.frame||{offset:0,label:'完整作品'};
 const [dimensions,setDimensions]=React.useState(null),[failed,setFailed]=React.useState(false),[loaded,setLoaded]=React.useState(false),[leaving,setLeaving]=React.useState(false),[canScrollDown,setCanScrollDown]=React.useState(false),[autoPaused,setAutoPaused]=React.useState(false);
 const m=describeMedia(project,dimensions),image=React.useRef(null),reader=React.useRef(null),mediaPane=React.useRef(null),gradient=React.useRef(null),placed=React.useRef(false),timer=React.useRef(0),raf=React.useRef(0),autoReader=React.useRef(null),returnCover=React.useRef(null),closing=React.useRef(false);
 const titleId=React.useId();
 const close=React.useCallback(()=>{
  if(closing.current)return;closing.current=true;autoReader.current?.setPaused(true);
  if(reduced){onClose();return;}setLeaving(true);timer.current=setTimeout(onClose,250);
 },[onClose,reduced]);
 const panel=useDialogFocus(close);useScrollLock();
 React.useEffect(()=>()=>{clearTimeout(timer.current);cancelAnimationFrame(raf.current);autoReader.current?.destroy();},[]);
 React.useEffect(()=>{
  // Keep the actual panorama behind the glass; never replace it with a stretched cover.
  document.body.dataset.artworkOpen='true';const app=document.querySelector('.portfolio-app'),old=app?.inert;
  if(app)app.inert=true;
  return()=>{delete document.body.dataset.artworkOpen;if(app)app.inert=old;};
 },[]);
 React.useEffect(()=>{
  if(!gradient.current||!panel.current)return;
  const effect=new GradientField(gradient.current,panel.current,asset(frame.src||project.cover||project.image),{reduced});
  return()=>effect.destroy();
 },[project.id,frame.src,reduced]);
 const load=e=>{
  const el=e.currentTarget;setDimensions({width:el.videoWidth||el.naturalWidth,height:el.videoHeight||el.naturalHeight});setLoaded(true);
 };
 React.useLayoutEffect(()=>{
  if(!loaded||!reader.current||!image.current||placed.current)return;
  raf.current=requestAnimationFrame(()=>{
   if(!reader.current||!image.current)return;
   // A short portrait fits in full. Only genuinely long art scrolls to the clicked segment.
   if(m.long)reader.current.scrollTop=(frame.offset||0)*image.current.clientHeight;
   placed.current=true;checkScroll();
  });
 },[loaded,m.long,frame.offset]);
 const index=available.findIndex(p=>p.id===project.id);
 const browse=dir=>{
  if(available.length<2||leaving)return;const next=available[(Math.max(0,index)+dir+available.length)%available.length];
  onProject({project:next,frame:frames.find(f=>f.projectId===next.id)||{offset:0,label:'完整作品'}});
 };
 const checkScroll=React.useCallback(()=>{const r=reader.current;setCanScrollDown(!!(r&&r.scrollHeight-r.clientHeight-r.scrollTop>18));},[]);

 React.useEffect(()=>{
  if(!loaded||failed||!m.long||reduced||!reader.current||!returnCover.current)return;
  const controller=new AutoReader(reader.current,returnCover.current,mediaPane.current,{onScroll:checkScroll});
  autoReader.current=controller;controller.setPaused(autoPaused);
  return()=>{controller.destroy();if(autoReader.current===controller)autoReader.current=null;};
 },[loaded,failed,m.long,reduced,project.id,checkScroll]);
 const toggleAuto=()=>{setAutoPaused(v=>{const next=!v;autoReader.current?.setPaused(next);return next;});};
 React.useEffect(()=>{if(!loaded||!m.long||!reader.current)return;const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(checkScroll):null;ro?.observe(reader.current);const t=setTimeout(checkScroll,80);return()=>{clearTimeout(t);ro?.disconnect();};},[loaded,m.long,checkScroll]);
 const reset=()=>{if(autoReader.current)autoReader.current.reset();else reader.current?.scrollTo({top:0,behavior:reduced?'auto':'smooth'});};
 // 16:9, 3:2, 4:3 and square media all determine their own height; the copy flows below.
 const classes='artwork-card '+(m.portrait?'layout-portrait':'layout-landscape')+(m.long?' is-long':'')+(reduced?' reduced':'');
 const media=m.video?h('video',{ref:image,className:'artwork-file',src:m.source,poster:project.poster?asset(project.poster):undefined,controls:true,playsInline:true,preload:'metadata',onLoadedMetadata:load,onError:()=>setFailed(true),'aria-label':project.title+' — 视频作品'}):
  h('img',{ref:image,className:'artwork-file',src:m.source,alt:project.title+' — 完整作品',decoding:'async',draggable:false,onLoad:load,onError:()=>setFailed(true)});
 const date=project.date||project.year||'—';
 const information=h('aside',{className:'artwork-information'},
  h('div',{className:'artwork-info-top'},h('span',{className:'artwork-category'},project.category),h('span',{className:'artwork-record'},String(Math.max(0,index)+1).padStart(2,'0')+' / '+String(available.length).padStart(2,'0'))),
  h('div',{className:'artwork-copy'},
   h('h2',{id:titleId},project.title),project.en&&h('p',{className:'artwork-en'},project.en),
   h('div',{className:'artwork-hairline','aria-hidden':true},h('i'),h('span'),h('i')),
   h('p',{className:'artwork-description'},project.description),
   h('div',{className:'artwork-tags'},(project.tags||[]).map(tag=>h('span',{key:tag},tag)))),
  h('div',{className:'artwork-info-bottom'},
   h('div',{className:'artwork-meta'},h('span',null,project.format||(m.video?'影像作品':'视觉设计')),h('time',{dateTime:date==='—'?undefined:String(date),title:date==='—'?'尚未填写创作日期':undefined},date)),
   h('div',{className:'artwork-actions'},
    h('button',{'aria-label':'上一个作品',onClick:()=>browse(-1),disabled:available.length<2},h(Icon,{name:'arrow',size:14}),h('span',null,'上一件')),
    m.long?h('div',{className:'artwork-reading-controls'},
     !reduced&&h('button',{className:'artwork-auto-toggle',onClick:toggleAuto,title:autoPaused?'继续自动滚动':'暂停自动滚动','aria-label':autoPaused?'继续自动滚动':'暂停自动滚动','aria-pressed':autoPaused},
      h('svg',{width:13,height:13,viewBox:'0 0 16 16',fill:'none','aria-hidden':true},autoPaused?h('path',{d:'M5 3.3L12 8l-7 4.7Z',fill:'currentColor'}):h('path',{d:'M5.1 3.5v9M10.9 3.5v9',stroke:'currentColor',strokeWidth:1.5}))),
     h('button',{className:'artwork-back-to-cover',onClick:reset,title:'回到封面','aria-label':'回到封面'},h(Icon,{name:'reset',size:12}))):h('span',{className:'artwork-action-line','aria-hidden':true}),
    h('button',{'aria-label':'下一个作品',onClick:()=>browse(1),disabled:available.length<2},h('span',null,'下一件'),h(Icon,{name:'arrow',size:14})))));
 return createPortal(h('div',{className:'artwork-layer'+(leaving?' is-leaving':'')+(reduced?' reduced':''),onWheel:e=>e.stopPropagation()},
  h('div',{className:'artwork-shade','aria-hidden':true,onClick:close}),
  h('div',{className:'artwork-edge-blur','aria-hidden':true}),
  h('article',{ref:panel,className:classes,role:'dialog','aria-modal':'true','aria-labelledby':titleId,tabIndex:-1,style:{'--media-ratio':String(m.ratio)}},
   h('canvas',{ref:gradient,className:'artwork-glass-gradient','aria-hidden':true}),
   h('div',{className:'artwork-glass-grain','aria-hidden':true}),
   h('button',{className:'artwork-close','aria-label':'关闭作品详情',onClick:close},h(Icon,{name:'close',size:16})),
   h('div',{ref:mediaPane,className:'artwork-media-pane'},
    h('div',{ref:reader,className:'artwork-reader',tabIndex:m.long?0:-1,onScroll:checkScroll,'aria-label':m.long?'完整作品长图，可上下滚动':project.title+'作品画面'},
     failed?h('div',{className:'artwork-error',role:'status'},'这幅作品暂时无法加载。',h('button',{onClick:()=>{setFailed(false);setLoaded(false);placed.current=false;}},'重试')):media),
    m.long&&loaded&&!failed&&h('div',{ref:returnCover,className:'artwork-return-cover','aria-hidden':true},h('img',{src:m.source,alt:'',draggable:false,decoding:'async'})),
    m.long&&loaded&&canScrollDown&&h('span',{className:'artwork-scroll-cue','aria-hidden':true},h('svg',{width:18,height:28,viewBox:'0 0 18 28',fill:'none'},h('path',{d:'M9 2v8',stroke:'currentColor',strokeWidth:1.1,strokeLinecap:'round'}),h('path',{d:'M5 10l4 4 4-4M5 16l4 4 4-4M5 22l4 4 4-4',stroke:'currentColor',strokeWidth:1.1,strokeLinecap:'round',strokeLinejoin:'round'}))),
    !loaded&&!failed&&h('span',{className:'artwork-loading',role:'status'},'正在载入…')),
   information)),document.body);
}
exports.default=WorkPreview;
exports.describeMedia=describeMedia;
