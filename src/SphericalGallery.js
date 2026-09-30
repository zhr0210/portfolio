'use strict';
/**
 * Lens-space panorama, independently implemented from the supplied reference recording.
 * The viewer is INSIDE a continuous tiled field. There is deliberately no globe,
 * spherical silhouette, pole or external orbit camera. One invertible pincushion
 * lens maps both rendering and hit testing. The field wraps on BOTH axes.
 * WebGL and Canvas 2D share this lens, the same atlases and pointer state machine.
 */
const {asset}=__r(11);
const COLS=16,ROWS=12,TILE=768,AC=8,AR=4;
// Near-rectilinear centre, smoothly increasing curvature at the periphery.
// Keep the same function and its derivative in both CPU and GPU code.
const LENS_CORE=.26;
// An elliptical lens metric reduces horizontal curvature without changing the
// vertical centreline, card scale, press/drag behaviour or the sharp central core.
// Keep CPU rendering, inverse hit testing and the GLSL inverse exactly in sync.
const LENS_HORIZONTAL=.87;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mod=(v,n)=>((v%n)+n)%n;
const ease=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const VERTEX=`attribute vec2 a_position;varying vec2 v_uv;
void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
const FRAGMENT=`precision highp float;
varying vec2 v_uv;
uniform sampler2D u_atlas,u_hoverAtlas,u_map;
uniform vec2 u_resolution,u_pan,u_tilt;
uniform float u_norm,u_tile,u_lens,u_press,u_grid,u_boot,u_stars,u_time,u_filter,u_ready,u_reduced,u_pixelRatio;
const vec2 CELLS=vec2(16.,12.);
vec2 lens(vec2 xy){
 vec2 q=xy/u_norm;
 // A very small lens tilt; fixed controls never enter this transform.
 q/=1.+dot(q,u_tilt)*.025;
 float r=length(q*vec2(${LENS_HORIZONTAL.toFixed(4)},1.)),s=r;
 for(int i=0;i<8;i++){
  float d=max(s-${LENS_CORE.toFixed(4)},0.),d2=d*d,d3=d2*d;
  s-=(s*(1.+u_lens*d3)-r)/(1.+u_lens*d3+3.*u_lens*s*d2);
 }
 return q*(s/max(r,.00001))*u_norm/u_tile+u_pan;
}
vec3 field(vec2 g,vec2 pixel){
 vec2 c=floor(g),f=fract(g),mc=mod(c,CELLS);
 vec4 meta=texture2D(u_map,(mc+.5)/CELLS);
 float id=floor(meta.r*255.+.5),hover=meta.b;
 vec2 tile=vec2(mod(id,8.),floor(id/8.));
 vec2 at=(tile+clamp(f,vec2(.002),vec2(.998)))/vec2(8.,4.);
 vec3 normal=texture2D(u_atlas,at).rgb;
 if(hover>.001)normal=mix(normal,texture2D(u_hoverAtlas,at).rgb,hover);
 float seed=meta.g;
 float boot=u_reduced>.5?1.:clamp((u_boot-seed)/.345,0.,1.);
 float sy=u_reduced>.5?1.:smoothstep(.025,.70,boot);
 float sx=u_reduced>.5?1.:smoothstep(0.,.16,boot);
 float reveal=(1.-smoothstep(sy*.5,sy*.5+.008,abs(f.y-.5)))*(1.-smoothstep(sx*.5,sx*.5+.008,abs(f.x-.5)));
 float gain=smoothstep(.015,.65,boot)*u_ready*u_filter;
 float crt=smoothstep(.025,.14,boot)*(1.-smoothstep(.32,.84,boot))*(1.-u_reduced);
 if(crt>.001){
  // Brief, bounded analogue acquisition; no repeating full-screen flashes.
  float split=.0062*crt;
  vec2 redAt=(tile+clamp(f+vec2(split,0.),vec2(.002),vec2(.998)))/vec2(8.,4.);
  vec2 blueAt=(tile+clamp(f-vec2(split,0.),vec2(.002),vec2(.998)))/vec2(8.,4.);
  normal.r=mix(normal.r,texture2D(u_atlas,redAt).r,crt*.56);
  normal.b=mix(normal.b,texture2D(u_atlas,blueAt).b,crt*.56);
  vec2 grain=floor(f*vec2(152.,118.));
  float snow=fract(sin(dot(grain,vec2(12.98,78.23))+floor(u_time*12.)+seed*39.)*43758.54);
  float snow2=fract(sin(dot(grain,vec2(48.11,18.71))+floor(u_time*10.)+seed*57.)*12511.31);
  float snow3=fract(sin(dot(grain,vec2(7.17,92.37))+floor(u_time*14.)+seed*13.)*28711.73);
  vec3 chroma=vec3(snow*.92,snow2*.84,snow3*.96);
  normal=mix(normal,vec3((snow+snow2+snow3)/3.*.58),crt*.10);
  normal=mix(normal,chroma,crt*.085);
  float band=exp(-pow((f.y-mix(-.10,1.10,smoothstep(.04,.88,boot)))*12.,2.))*crt*.12;
  vec3 phosphor=.5+.5*cos(vec3(0.,2.094,4.188)+f.x*6.28+seed*21.);
  normal+=phosphor*band;
  float tintBand=exp(-pow((f.y-mix(.12,.88,smoothstep(.12,.82,boot)))*8.8,2.))*crt*.09;
  normal+=vec3(.08,.01,.16)*tintBand;
  normal*=1.-crt*.052*(.5+.5*sin(f.y*590.));
 }
 vec3 col=normal*gain*reveal;
 // Grid widths are measured in physical pixels AFTER the nonlinear lens.
 // A fullscreen quad's MSAA alone cannot anti-alias these procedural boundaries.
 vec2 edge=min(f,1.-f)/max(pixel,vec2(.00001));
 float line=1.-smoothstep(.10,1.10,min(edge.x,edge.y));
 col+=vec3(.16)*line*u_grid;
 // A single filament expands, then settles into the finished artwork.
 float beam=exp(-abs(f.y-.5)*310.)*smoothstep(.0,.06,boot)*(1.-smoothstep(.13,.35,boot));
 col+=vec3(.20,.215,.24)*beam*u_ready*(1.-u_reduced)*(1.-smoothstep(sx*.5,sx*.5+.01,abs(f.x-.5)));
 vec2 nearest=min(f,1.-f);
 float dotstar=exp(-dot(nearest,nearest)*22000.);
 float lit=.55+.45*sin(dot(c,vec2(3.7,7.1))+u_time*.9);
 col+=vec3(.7)*dotstar*u_stars*lit;
 if(u_stars>.001){
  vec2 sub=g*3.,sid=floor(sub);
  vec2 jitter=vec2(fract(sin(dot(sid,vec2(12.98,78.23)))*43758.54),fract(sin(dot(sid,vec2(37.17,61.93)))*19642.31));
  vec2 sd=fract(sub)-mix(vec2(.22),vec2(.78),jitter);
  col+=vec3(.38)*exp(-dot(sd,sd)*3500.)*u_stars*(.5+.5*jitter.x);
 }
 return col;
}
void main(){
 vec2 pos=vec2((v_uv.x-.5)*u_resolution.x,(.5-v_uv.y)*u_resolution.y);
 vec2 g=lens(pos);
 #ifdef HAS_DERIVATIVES
 vec2 footprint=max(fwidth(g),vec2(.00001));
 #else
 vec2 footprint=max(abs(lens(pos+vec2(1./u_pixelRatio,0.))-g)+abs(lens(pos+vec2(0.,1./u_pixelRatio))-g),vec2(.00001));
 #endif
 vec3 col=field(g,footprint);
 vec2 edge=min(fract(g),1.-fract(g))/footprint;
 // Four subpixel lens samples resolve the COLOUR change at a hovered-cell edge.
 // This is distinct from smoothing the thin grid line above that edge.
 if(min(edge.x,edge.y)<1.7){
  vec2 d=vec2(.34/u_pixelRatio);
  col=(field(lens(pos+d),footprint)+field(lens(pos-d),footprint)+field(lens(pos+vec2(d.x,-d.y)),footprint)+field(lens(pos+vec2(-d.x,d.y)),footprint))*.25;
 }
 // Optical blur/vignette are composited in SCREEN space, above the completed
 // field, never pre-blurred separately per tile. The central framebuffer stays sharp.
 gl_FragColor=vec4(col,1.);
}`;

class SphericalGallery{
 constructor(canvas,{frames,projects,onHover,onOpen,onReady,onError}){
  Object.assign(this,{canvas,frames,projects,onHover,onOpen,onReady,onError});
  this.pan={x:6.15,y:4.48};this.target={...this.pan};this.velocity={x:0,y:0};
  this.look={x:0,y:0};this.lookTarget={x:0,y:0};this.press=0;this.pressTarget=0;
  this.drag=null;this.touch=null;this.hover=-1;this.lastPointer=null;this.interactAfter=0;
  this.bootGroups=new Uint8Array(COLS*ROWS);this.hoverValues=new Float32Array(COLS*ROWS);this.mapData=new Uint8Array(COLS*ROWS*4);this.cells=[];
  this.enabled=false;this.locked=false;this.disposed=false;this.textureReady=0;this.dirty=true;
  this.state={grid:0,boot:0,stars:0,position:0,visible:false,interactive:false,reduced:false};
  this.cleanup=[];this.lastTime=0;this.lastDraw=0;this.filterStart=0;this.frameRequest=0;
  this.stats={draws:0,errors:0};
  try{
   this.gl=(window.__FORCE_CANVAS__||new URLSearchParams(location.search).has('software'))?null:canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false});
   this.software=!this.gl;
   if(this.software){this.ctx=canvas.getContext('2d',{alpha:false});if(!this.ctx)throw new Error('Canvas unavailable');}
   else{this.initGL();const dbg=this.gl.getExtension('WEBGL_debug_renderer_info');this.softwareGPU=!!dbg&&/SwiftShader|llvmpipe|software/i.test(this.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));}
   canvas.dataset.renderer=this.software?'canvas-lens':'webgl-lens';canvas.dataset.projection='immersed-soft-core-lens';
   this.host=canvas.closest('.panorama-scene');window.__GALLERY__=this;
   this.starCanvas=document.createElement('canvas');this.starCanvas.className='lens-constellation';this.starCanvas.setAttribute('aria-hidden','true');this.starCanvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';canvas.parentElement.insertBefore(this.starCanvas,canvas.nextSibling);this.starCtx=this.starCanvas.getContext('2d');
   this.resize();this.setFilter(frames.map(f=>f.id),false);this.bind();this.loadAtlases().catch(e=>this.onError?.(e));
   this.tick=this.tick.bind(this);this.frameRequest=requestAnimationFrame(this.tick);
  }catch(e){this.onError?.(e);this.destroy();}
 }
 shader(type,source){const gl=this.gl,s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(log);}return s;}
 initGL(){
  const gl=this.gl;this.program=gl.createProgram();const vs=this.shader(gl.VERTEX_SHADER,VERTEX),fs=this.shader(gl.FRAGMENT_SHADER,(gl.getExtension('OES_standard_derivatives')?'#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIVATIVES\n':'')+FRAGMENT);
  gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(this.program));
  gl.useProgram(this.program);this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(this.program,'a_position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  this.uniforms={};for(const n of ['atlas','hoverAtlas','map','resolution','pan','tilt','norm','tile','lens','press','grid','boot','stars','time','filter','ready','reduced','pixelRatio'])this.uniforms[n]=gl.getUniformLocation(this.program,'u_'+n);
  this.atlas=this.texture(0,gl.LINEAR);this.hoverAtlas=this.texture(1,gl.LINEAR);this.mapping=this.texture(2,gl.NEAREST);
  gl.uniform1i(this.uniforms.atlas,0);gl.uniform1i(this.uniforms.hoverAtlas,1);gl.uniform1i(this.uniforms.map,2);
 }
 texture(unit,filter){const gl=this.gl,t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));return t;}
 async loadAtlases(){
  // Canvas uses individual high-resolution tiles; it does not allocate two large
  // unused atlases. GL uploads the atlas and releases its CPU copies afterwards.
  const nextTiles=[],nextHoverTiles=[];
  let atlas=null,hover=null,a=null,b=null,atlasTile=0;
  if(this.gl){
   atlasTile=Math.min(TILE,Math.floor(this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)/AC));
   atlas=document.createElement('canvas');hover=document.createElement('canvas');
   atlas.width=hover.width=AC*atlasTile;atlas.height=hover.height=AR*atlasTile;
   a=atlas.getContext('2d');b=hover.getContext('2d');
   a.fillStyle=b.fillStyle='#000';a.fillRect(0,0,atlas.width,atlas.height);b.fillRect(0,0,hover.width,hover.height);
  }
  await document.fonts.ready;
  await Promise.all(this.frames.map(async f=>{
   const im=new Image();im.decoding='async';await new Promise(resolve=>{im.onload=resolve;im.onerror=resolve;im.src=asset(f.src);});if(this.disposed)return;
   const p=this.projects.find(p=>p.id===f.projectId),base=this.makeTile(im,p,f,false),focus=this.makeTile(im,p,f,true);
   if(this.software){nextTiles[f.id]=base;nextHoverTiles[f.id]=focus;}
   if(a){const x=f.id%AC*atlasTile,y=Math.floor(f.id/AC)*atlasTile;a.drawImage(base,x,y,atlasTile,atlasTile);b.drawImage(focus,x,y,atlasTile,atlasTile);}
  }));
  if(this.disposed)return;
  this.tiles=nextTiles;this.hoverTiles=nextHoverTiles;
  if(this.gl){const gl=this.gl;for(const [unit,t,source] of [[0,this.atlas,atlas],[1,this.hoverAtlas,hover]]){
   gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
   // WebGL 1 cannot generate mipmaps for non-power-of-two atlases.
   if((source.width&(source.width-1))===0&&(source.height&(source.height-1))===0){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);}
   else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  }}
  this.textureReady=1;this.dirty=true;this.onReady?.();
 }
 makeTile(im,p,f,hover){
  const c=document.createElement('canvas');c.width=c.height=TILE;const ctx=c.getContext('2d');ctx.setTransform(TILE/512,0,0,TILE/512,0,0);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.fillStyle='#000';ctx.fillRect(0,0,512,512);
  if(hover&&im.naturalWidth){ctx.save();ctx.filter='blur(32px)';const s=Math.max((512+170)/im.naturalWidth,(512+170)/im.naturalHeight);ctx.drawImage(im,(512-im.naturalWidth*s)/2,(512-im.naturalHeight*s)/2,im.naturalWidth*s,im.naturalHeight*s);ctx.restore();ctx.fillStyle='rgba(4,6,9,.43)';ctx.fillRect(0,0,512,512);}
  // The artwork is contained, not cropped. Its natural colours are the only accents.
  if(im.naturalWidth){const scale=Math.min(376/im.naturalWidth,358/im.naturalHeight)*(hover?1.008:1),dw=im.naturalWidth*scale,dh=im.naturalHeight*scale;ctx.drawImage(im,(512-dw)/2,74+(358-dh)/2,dw,dh);}
  else{ctx.fillStyle='#aaa';ctx.font='16px sans-serif';ctx.fillText('图片暂不可用',195,246);}
  const small=this.width<768;
  ctx.textBaseline='top';ctx.fillStyle='#c6c6c6';ctx.font=`500 ${small?26:17}px Arial,"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif`;ctx.textAlign='left';ctx.fillText(p.category,22,24);
  ctx.textAlign='right';ctx.fillStyle='#c0c0c0';ctx.font=`500 ${small?25:16}px Arial,"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif`;ctx.fillText(p.title,490,24);
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.font=`${small?18:12}px ui-monospace,monospace`;
  let tx=21;for(const text of p.tags||['EDITORIAL','LONGFORM']){const tw=ctx.measureText(text).width+17;ctx.fillStyle='#191919';ctx.beginPath();ctx.roundRect(tx,462,tw,22,11);ctx.fill();ctx.fillStyle='#a4a4a4';ctx.fillText(text,tx+8.5,473);tx+=tw+5;}
  ctx.textAlign='right';ctx.fillStyle='#a5a5a5';ctx.font=`${small?22:14}px ui-monospace,monospace`;ctx.fillText(p.year?String(p.year):'—',490,473);
  return c;
 }
 setFilter(ids,animate=true){
  if(this.disposed)return;if(!ids.length)ids=this.frames.map(f=>f.id);this.visibleIds=ids;
  this.hover=-1;this.hoverValues.fill(0);
  for(let row=0;row<ROWS;row++)for(let col=0;col<COLS;col++){
   const cell=row*COLS+col,id=ids[mod(col*4+row*9+Math.floor(col/7),ids.length)];
   // Four neighbour-safe phases (including diagonals), split into two batches.
   // Opposite edges also retain this property because the torus dimensions are even.
   const phase=(col%2)+2*(row%2),sub=mod(Math.floor(col/2)*7+Math.floor(row/2)*11,2);
   const group=[0,5,2,7,4,1,6,3][phase*2+sub];this.bootGroups[cell]=group;
   const delay=group*.091+mod(col*17+row*31,11)/10*.014;
   this.cells[cell]=id;this.mapData[cell*4]=id;this.mapData[cell*4+1]=Math.round(delay*255);this.mapData[cell*4+2]=0;this.mapData[cell*4+3]=255;
  }
  if(this.gl){const gl=this.gl;gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.mapping);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,COLS,ROWS,0,gl.RGBA,gl.UNSIGNED_BYTE,this.mapData);}
  this.filterStart=animate?performance.now():0;this.interactAfter=performance.now()+300;this.dirty=true;
 }
 resize(){
  if(this.disposed)return;this.width=this.canvas.clientWidth||innerWidth;this.height=this.canvas.clientHeight||innerHeight;
  this.norm=this.width<768?Math.max(this.width,this.height*.72):Math.min(this.width,this.height);
  this.baseTile=this.width<768?this.width/2.23:Math.max(this.width/5.65,this.height/3.28);
  // Resolve curved cell edges above CSS resolution. Bound memory on very large panels.
  const ratio=Math.min(2.5,Math.max(2,devicePixelRatio||1),Math.max(1,Math.sqrt(8500000/(this.width*this.height))));
  this.pixelRatio=ratio;this.canvas.width=Math.round(this.width*ratio);this.canvas.height=Math.round(this.height*ratio);
  if(this.starCanvas){this.starCanvas.width=Math.round(this.width*ratio);this.starCanvas.height=Math.round(this.height*ratio);}
  if(this.gl)this.gl.viewport(0,0,this.canvas.width,this.canvas.height);this.dirty=true;this.updateLens();
  const small=this.width<768;if(this.atlasSmall!==undefined&&small!==this.atlasSmall&&this.textureReady)this.loadAtlases().catch(e=>this.onError?.(e));this.atlasSmall=small;
 }
 updateLens(){
  const p=this.state.reduced?0:this.press;
  // Widen first, then subtly strengthen the edge perspective. No global card scaling UI.
  this.tile=this.baseTile*(1-.105*p)*(1+.02*(1-this.state.boot));
  this.curve=2.55+1.65*p;this.tilt={x:this.state.reduced?0:this.look.x*1.28,y:this.state.reduced?0:this.look.y*1.28};
  this.actualPan={x:this.pan.x+this.tilt.x*.026,y:this.pan.y+this.tilt.y*.02};
 }
 screenToField(x,y){
  let qx=(x-this.width*.5)/this.norm,qy=(y-this.height*.5)/this.norm;
  const perspective=1+(qx*this.tilt.x+qy*this.tilt.y)*.025;qx/=perspective;qy/=perspective;
  const r=Math.hypot(qx*LENS_HORIZONTAL,qy);let s=r;
  for(let i=0;i<8;i++){const d=Math.max(s-LENS_CORE,0),d2=d*d,d3=d2*d;s-=(s*(1+this.curve*d3)-r)/(1+this.curve*d3+3*this.curve*s*d2);}
  const k=r?s/r:1;
  return{x:qx*k*this.norm/this.tile+this.actualPan.x,y:qy*k*this.norm/this.tile+this.actualPan.y};
 }
 fieldToScreen(gx,gy){
  let px=(gx-this.actualPan.x)*this.tile/this.norm,py=(gy-this.actualPan.y)*this.tile/this.norm;
  const d=Math.max(Math.hypot(px*LENS_HORIZONTAL,py)-LENS_CORE,0),radial=1+this.curve*d*d*d;px*=radial;py*=radial;
  const perspective=1-(px*this.tilt.x+py*this.tilt.y)*.025;
  return{x:this.width*.5+px/perspective*this.norm,y:this.height*.5+py/perspective*this.norm};
 }
 local(e){const r=this.canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
 listen(t,event,fn,opts){t.addEventListener(event,fn,opts);this.cleanup.push(()=>t.removeEventListener(event,fn,opts));}
 bind(){
  const c=this.canvas;
  this.listen(window,'resize',()=>this.resize());
  this.listen(window,'panorama-timeline',e=>{this.state=e.detail;this.dirty=true;});
  this.listen(c,'webglcontextlost',e=>{e.preventDefault();this.onError?.(new Error('图形上下文已丢失，切换到列表。'));});
  this.listen(c,'pointerdown',e=>{
   if(e.pointerType==='touch'||e.button!==0||!this.canInteract())return;
   const p=this.local(e);this.drag={sx:p.x,sy:p.y,x:p.x,y:p.y,time:performance.now(),last:performance.now(),moved:false,pointer:e.pointerId};
   this.pressTarget=1;this.velocity={x:0,y:0};this.clearHover();this.lookTarget={x:0,y:0};c.setPointerCapture(e.pointerId);this.dirty=true;
  });
  this.listen(c,'pointermove',e=>{
   if(e.pointerType==='touch'||!this.canInteract())return;const p=this.local(e);this.lastPointer=p;
   if(this.drag){const d=this.drag;if(Math.hypot(p.x-d.sx,p.y-d.sy)>6)d.moved=true;if(d.moved)this.dragTo(p,d);d.x=p.x;d.y=p.y;this.clearHover();c.dataset.dragging=String(d.moved);return;}
   this.lookTarget={x:clamp((p.x/this.width-.5)*2,-1,1),y:clamp((p.y/this.height-.5)*2,-1,1)};
   this.hoverAt(p.x,p.y);this.dirty=true;
  });
  this.listen(c,'pointerup',e=>{
   if(e.pointerType==='touch'||!this.drag)return;const d=this.drag,p=this.local(e),elapsed=performance.now()-d.time;
   this.drag=null;this.release();if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
   if(!d.moved&&elapsed<290&&this.canInteract()){const hit=this.hit(p.x,p.y);if(hit)this.onOpen?.(hit);}
  });
  this.listen(c,'pointercancel',()=>{this.drag=null;this.release();this.velocity={x:0,y:0};});
  this.listen(c,'lostpointercapture',()=>{if(this.drag){this.drag=null;this.release();}});
  this.listen(c,'pointerleave',()=>{if(!this.drag){this.lookTarget={x:0,y:0};this.lastPointer=null;this.clearHover();this.dirty=true;}});
  this.listen(window,'blur',()=>{this.drag=null;this.touch=null;this.release();this.velocity={x:0,y:0};});
  // Touch arbitrates scrolling versus exploration. A vertical swipe still navigates
  // the portfolio. Horizontal drag or a quiet 240ms hold enables two-axis exploration.
  this.listen(c,'touchstart',e=>{
   if(e.touches.length!==1||!this.canInteract())return;
   const p=this.local(e.touches[0]);this.touch={sx:p.x,sy:p.y,x:p.x,y:p.y,time:performance.now(),last:performance.now(),moved:false,pan:false,scroll:false};
   this.velocity={x:0,y:0};this.clearHover();
  },{passive:true});
  this.listen(c,'touchmove',e=>{
   const d=this.touch;if(!d||e.touches.length!==1||!this.canInteract())return;
   const p=this.local(e.touches[0]),ax=p.x-d.sx,ay=p.y-d.sy;
   if(!d.pan&&!d.scroll){if(Math.abs(ax)>9&&Math.abs(ax)>Math.abs(ay)*1.25){d.pan=true;this.pressTarget=1;}else if(Math.abs(ay)>12){d.scroll=true;this.pressTarget=0;}}
   if(Math.hypot(ax,ay)>8)d.moved=true;
   if(d.pan){e.preventDefault();this.dragTo(p,d);c.dataset.dragging='true';}d.x=p.x;d.y=p.y;
  },{passive:false});
  this.listen(c,'touchend',()=>{
   const d=this.touch;this.touch=null;this.release();if(d&&!d.moved&&!d.pan&&performance.now()-d.time<290&&this.canInteract()){const hit=this.hit(d.x,d.y);if(hit)this.onOpen?.(hit);}
  },{passive:true});
  this.listen(c,'touchcancel',()=>{this.touch=null;this.release();this.velocity={x:0,y:0};},{passive:true});
  this.listen(c,'contextmenu',e=>{if(this.state.interactive)e.preventDefault();});
  this.listen(c,'keydown',e=>{
   if(!this.canInteract())return;const delta={ArrowLeft:[-.38,0],ArrowRight:[.38,0],ArrowUp:[0,-.38],ArrowDown:[0,.38]}[e.key];
   if(delta){e.preventDefault();this.target.x+=delta[0];this.target.y+=delta[1];this.velocity={x:0,y:0};this.clearHover();this.dirty=true;}
   if(e.key==='Enter'||e.key===' '){e.preventDefault();const hit=this.hit(this.width*.5,this.height*.5);if(hit)this.onOpen?.(hit);}
  });
 }
 release(){this.pressTarget=0;this.canvas.dataset.dragging='false';this.interactAfter=performance.now()+430;this.dirty=true;}
 clearHover(){if(this.hover!==-1){this.hover=-1;this.onHover?.(null);this.dirty=true;}}
 canInteract(){return this.enabled&&!this.locked&&this.state.interactive&&this.textureReady&&!document.body.dataset.overlayOpen;}
 setEnabled(v){this.enabled=v;this.dirty=true;if(this.starCanvas)this.starCanvas.style.display=v?'block':'none';if(!v){this.drag=null;this.touch=null;this.release();this.velocity={x:0,y:0};this.clearHover();}}
 setLocked(v){this.locked=v;if(v){this.drag=null;this.touch=null;this.velocity={x:0,y:0};this.release();this.clearHover();}else this.interactAfter=performance.now()+450;this.dirty=true;}
 reset(){this.target={x:6.15,y:4.48};this.velocity={x:0,y:0};this.lookTarget={x:0,y:0};this.pressTarget=0;this.clearHover();this.dirty=true;}
 dragTo(p,d){
  const a=this.screenToField(d.x,d.y),b=this.screenToField(p.x,p.y),dx=a.x-b.x,dy=a.y-b.y,now=performance.now(),dt=clamp((now-d.last)/1000,.008,.06);d.last=now;
  this.target.x+=dx;this.target.y+=dy;this.velocity.x=this.velocity.x*.45+clamp(dx/dt,-8,8)*.55;this.velocity.y=this.velocity.y*.45+clamp(dy/dt,-8,8)*.55;this.dirty=true;
 }
 hit(x,y){
  const g=this.screenToField(x,y),cx=Math.floor(g.x),cy=Math.floor(g.y),cell=mod(cy,ROWS)*COLS+mod(cx,COLS),frame=this.frames[this.cells[cell]];if(!frame)return null;
  return{cell,frame,project:this.projects.find(p=>p.id===frame.projectId),x,y,gridX:cx,gridY:cy};
 }
 hoverAt(x,y){
  if(this.drag||this.touch?.pan||performance.now()<this.interactAfter||this.press>.07)return;
  const hit=this.hit(x,y),id=hit?.cell??-1;if(id!==this.hover){this.hover=id;this.onHover?.(hit);this.dirty=true;}
 }
 tick(now){
  if(this.disposed)return;this.frameRequest=requestAnimationFrame(this.tick);
  const dt=clamp((now-this.lastTime)/1000||.016,0,.15);this.lastTime=now;
  if(!this.enabled||!this.state.visible||document.hidden)return;
  const reduced=this.state.reduced;
  if(this.touch&&!this.touch.scroll&&!this.touch.moved&&!this.touch.pan&&now-this.touch.time>240){this.touch.pan=true;this.pressTarget=1;this.dirty=true;}
  if(!this.drag&&!this.touch?.pan&&!this.locked){const decay=Math.exp(-dt*7.5);this.target.x+=this.velocity.x*(1-decay)/7.5;this.target.y+=this.velocity.y*(1-decay)/7.5;this.velocity.x*=decay;this.velocity.y*=decay;}
  const k=reduced?1:1-Math.exp(-dt*(this.drag||this.touch?.pan?26:14));
  const gap=Math.abs(this.target.x-this.pan.x)+Math.abs(this.target.y-this.pan.y);
  this.pan.x+=(this.target.x-this.pan.x)*k;this.pan.y+=(this.target.y-this.pan.y)*k;
  const pk=reduced?1:1-Math.exp(-dt*(this.pressTarget?11:7.3)),pressGap=Math.abs(this.pressTarget-this.press);
  this.press+=(this.pressTarget-this.press)*pk;
  const lk=reduced?1:1-Math.exp(-dt*5.5),lookGap=Math.abs(this.lookTarget.x-this.look.x)+Math.abs(this.lookTarget.y-this.look.y);
  this.look.x+=(this.lookTarget.x-this.look.x)*lk;this.look.y+=(this.lookTarget.y-this.look.y)*lk;
  this.updateLens();
  if(this.lastPointer&&this.canInteract()&&!this.drag&&!this.touch?.pan&&gap<.005)this.hoverAt(this.lastPointer.x,this.lastPointer.y);
  let hoverDirty=false;
  for(let i=0;i<this.hoverValues.length;i++){
   const desired=i===this.hover?1:0,v=this.hoverValues[i],next=v+(desired-v)*(reduced?1:1-Math.exp(-dt*(desired?7.6:5.8)));
   this.hoverValues[i]=next;
   const byte=Math.round(next*255);if(byte!==this.mapData[i*4+2]){this.mapData[i*4+2]=byte;hoverDirty=true;}
  }
  const filter=this.filterStart?ease(0,520,now-this.filterStart):1;
  const moving=gap>.00003||pressGap>.0005||lookGap>.0005||hoverDirty||filter<1||this.state.stars>.01;
  if(!this.dirty&&!moving)return;
  // Canvas compatibility keeps drag work bounded; the accelerated shader draws at RAF.
  if(this.software&&now-this.lastDraw<(this.width*this.height>2100000?28:16))return;
  this.lastDraw=now;this.dirty=false;
  const start=performance.now();
  if(this.gl){
   const gl=this.gl,u=this.uniforms;gl.useProgram(this.program);
   if(hoverDirty){gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.mapping);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,COLS,ROWS,gl.RGBA,gl.UNSIGNED_BYTE,this.mapData);}
   gl.uniform2f(u.resolution,this.width,this.height);gl.uniform2f(u.pan,this.actualPan.x,this.actualPan.y);gl.uniform2f(u.tilt,this.tilt.x,this.tilt.y);
   gl.uniform1f(u.norm,this.norm);gl.uniform1f(u.tile,this.tile);gl.uniform1f(u.lens,this.curve);gl.uniform1f(u.press,reduced?0:this.press);gl.uniform1f(u.grid,this.state.grid);gl.uniform1f(u.boot,this.state.boot);gl.uniform1f(u.stars,this.state.stars||0);gl.uniform1f(u.time,now/1000);gl.uniform1f(u.filter,filter);gl.uniform1f(u.ready,this.textureReady);gl.uniform1f(u.reduced,reduced?1:0);gl.uniform1f(u.pixelRatio,this.pixelRatio);
   gl.drawArrays(gl.TRIANGLES,0,6);
  }else this.renderCanvas(filter,now/1000);
  this.drawStarChains(now/1000);
  this.canvas.dataset.press=this.press.toFixed(3);this.canvas.dataset.tile=this.tile.toFixed(2);this.canvas.dataset.panX=this.pan.x.toFixed(4);this.canvas.dataset.panY=this.pan.y.toFixed(4);this.canvas.dataset.ready=String(this.textureReady===1);this.canvas.dataset.hover=String(this.hover);this.canvas.dataset.frameMs=(performance.now()-start).toFixed(2);
  this.host.dataset.pressing=String(this.press>.25);this.host.style.setProperty('--lens-press',this.press.toFixed(3));this.stats.draws++;
 }
 drawStarChains(time){
  const ctx=this.starCtx,w=this.width,h=this.height;if(!ctx)return;ctx.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);ctx.clearRect(0,0,w,h);
  const gain=this.state.stars||0;if(gain<.002||this.state.reduced)return;
  const pts=[this.screenToField(0,h/2),this.screenToField(w,h/2),this.screenToField(w/2,0),this.screenToField(w/2,h)];
  const xmin=Math.floor(Math.min(...pts.map(p=>p.x)))-1,xmax=Math.ceil(Math.max(...pts.map(p=>p.x)))+1,ymin=Math.floor(Math.min(...pts.map(p=>p.y)))-1,ymax=Math.ceil(Math.max(...pts.map(p=>p.y)))+1;
  const random=(x,y,i)=>mod(Math.sin(x*127.1+y*311.7+i*74.7)*43758.5453,1);
  for(let x=xmin;x<xmax;x++)for(let y=ymin;y<ymax;y++){
   const nodes=Array.from({length:5},(_,i)=>this.fieldToScreen(x+.12+random(x,y,i)*.76,y+.12+random(x+3,y-9,i)*.76));
   ctx.strokeStyle='#bfbfbf';ctx.lineWidth=.55;ctx.globalAlpha=gain*.13;
   ctx.beginPath();const origin=this.fieldToScreen(x,y);ctx.moveTo(origin.x,origin.y);ctx.lineTo(nodes[0].x,nodes[0].y);ctx.lineTo(nodes[1].x,nodes[1].y);ctx.stroke();
   ctx.beginPath();ctx.moveTo(nodes[2].x,nodes[2].y);ctx.lineTo(nodes[3].x,nodes[3].y);ctx.stroke();
   for(let i=0;i<nodes.length;i++){
    const p=nodes[i];if(p.x<-10||p.x>w+10||p.y<-10||p.y>h+10)continue;
    ctx.globalAlpha=gain*(.4+.4*random(x,y,i))*(.72+.28*Math.sin(time*.8+i+x));
    ctx.fillStyle='#ddd';ctx.shadowColor='#fff';ctx.shadowBlur=i===0?7:0;
    ctx.beginPath();ctx.arc(p.x,p.y,i===0?1.28:.68,0,Math.PI*2);ctx.fill();
   }
  }
  ctx.shadowBlur=0;ctx.globalAlpha=1;
 }
 renderCanvas(filter,time){
  const ctx=this.ctx,w=this.width,h=this.height,dpr=this.pixelRatio;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  const ext=[this.screenToField(-10,h/2),this.screenToField(w+10,h/2),this.screenToField(w/2,-10),this.screenToField(w/2,h+10)];
  const x0=Math.floor(Math.min(...ext.map(p=>p.x)))-1,x1=Math.ceil(Math.max(...ext.map(p=>p.x)))+1,y0=Math.floor(Math.min(...ext.map(p=>p.y)))-1,y1=Math.ceil(Math.max(...ext.map(p=>p.y)))+1;
  const path=(points)=>{ctx.beginPath();for(let i=0;i<points.length;i++)i?ctx.lineTo(points[i].x,points[i].y):ctx.moveTo(points[i].x,points[i].y);};
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
   const cell=mod(y,ROWS)*COLS+mod(x,COLS),id=this.cells[cell],seed=this.mapData[cell*4+1]/255,boot=this.state.reduced?1:clamp((this.state.boot-seed)/.345),sy=this.state.reduced?1:ease(.025,.70,boot),gain=ease(.015,.65,boot)*filter;
   const p=this.fieldToScreen(x+.5,y+.5);if(p.x<-this.tile*2||p.x>w+this.tile*2||p.y<-this.tile*2||p.y>h+this.tile*2)continue;
   if(this.textureReady&&gain>.001&&sy>.001){
    let source=this.tiles[id];const hv=this.hoverValues[cell];
    if(hv>.005){
     if(!this.mixTile){this.mixTile=document.createElement('canvas');this.mixTile.width=this.mixTile.height=TILE;this.mixCtx=this.mixTile.getContext('2d');}
     const m=this.mixCtx;m.globalAlpha=1;m.drawImage(source,0,0);m.globalAlpha=hv;m.drawImage(this.hoverTiles[id],0,0);m.globalAlpha=1;source=this.mixTile;
    }
    if(!this.state.reduced&&boot>.015&&boot<.84)source=this.crtTile(source,boot,cell,time);
    // Clip the full tessellated texture ONCE to an analytic curved perimeter.
    // Triangle seam padding may overlap internally, but can no longer leak into a
    // neighbouring cell and make the hover-colour edge look like a staircase.
    ctx.save();this.cellPath(ctx,x,y,.5-sy/2,.5+sy/2);ctx.clip();
    ctx.globalAlpha=gain;
    // Subdivide most where curvature grows. Reuse vertices; do not recompute each
    // shared mesh corner four times. Flat-centre cells need fewer triangles.
    const radial=Math.hypot((p.x-w*.5)/this.norm,(p.y-h*.5)/this.norm);
    const n=radial>.50?12:radial>.25?9:6,mesh=[],sourceMesh=[];
    for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
     const u=i/n,v=.5-sy/2+j/n*sy;
     mesh.push(this.fieldToScreen(x+u,y+v));sourceMesh.push({x:u*TILE,y:v*TILE});
    }
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
     const tl=j*(n+1)+i,tr=tl+1,bl=tl+n+1,br=bl+1;
     this.triangle(ctx,source,[sourceMesh[tl],sourceMesh[tr],sourceMesh[bl]],[mesh[tl],mesh[tr],mesh[bl]]);
     this.triangle(ctx,source,[sourceMesh[tr],sourceMesh[br],sourceMesh[bl]],[mesh[tr],mesh[br],mesh[bl]]);
    }
    ctx.restore();
   }
   const beam=ease(0,.06,boot)*(1-ease(.13,.35,boot)),sx=ease(0,.16,boot);if(beam>.005&&!this.state.reduced){ctx.globalAlpha=beam*.32;ctx.strokeStyle='#d7e0eb';ctx.lineWidth=.9;path(Array.from({length:13},(_,i)=>this.fieldToScreen(x+.5-sx*.5+i/12*sx,y+.5)));ctx.stroke();}
  }
  ctx.globalAlpha=this.state.grid*.29;ctx.strokeStyle='#9b9b9b';ctx.lineWidth=.62;ctx.lineJoin='round';ctx.lineCap='round';
  for(let x=x0;x<=x1;x++){ctx.beginPath();for(let y=y0;y<y1;y++)this.curvedEdge(ctx,x,y,x,y+1,y===y0);ctx.stroke();}
  for(let y=y0;y<=y1;y++){ctx.beginPath();for(let x=x0;x<x1;x++)this.curvedEdge(ctx,x,y,x+1,y,x===x0);ctx.stroke();}
  const stars=this.state.stars||0;if(stars>.001)for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
   const p=this.fieldToScreen(x,y);ctx.globalAlpha=stars*(.55+.45*Math.sin(x*3.7+y*7.1+time*.9));ctx.fillStyle='#ddd';ctx.beginPath();ctx.arc(p.x,p.y,1.15,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;
  // A masked screen-space Gaussian layer above this canvas softens the completed
  // scene (artwork + labels + mesh + hovered background) with one continuous focus field.

 }
 // Only the transient colour canvas is changed; settled tiles are untouched.
 crtTile(source,boot,cell,time){
  if(!this.crtCanvas){
   this.crtCanvas=document.createElement('canvas');this.crtCanvas.width=this.crtCanvas.height=TILE;this.crtCtx=this.crtCanvas.getContext('2d');
   this.noiseFrames=Array.from({length:7},(_,f)=>{const c=document.createElement('canvas');c.width=152;c.height=118;const x=c.getContext('2d'),data=x.createImageData(c.width,c.height);let seed=834721+f*173;
    for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const value=(seed>>>24)*.65;data.data[i]=data.data[i+1]=data.data[i+2]=value;data.data[i+3]=255;}x.putImageData(data,0,0);return c;});
   this.colorNoiseFrames=Array.from({length:5},(_,f)=>{const c=document.createElement('canvas');c.width=120;c.height=94;const x=c.getContext('2d'),data=x.createImageData(c.width,c.height);let seed=281771+f*251;
    for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;data.data[i]=80+(seed>>>24)*.72;seed=(seed*1664525+1013904223)>>>0;data.data[i+1]=40+(seed>>>24)*.56;seed=(seed*1664525+1013904223)>>>0;data.data[i+2]=96+(seed>>>24)*.78;data.data[i+3]=255;}x.putImageData(data,0,0);return c;});
  }
  const c=this.crtCtx,k=ease(.025,.14,boot)*(1-ease(.32,.84,boot));c.globalAlpha=1;c.globalCompositeOperation='source-over';c.drawImage(source,0,0);
  c.globalAlpha=k*.19;c.imageSmoothingEnabled=false;c.drawImage(this.noiseFrames[mod(Math.floor(time*12)+cell,7)],0,0,TILE,TILE);
  c.globalAlpha=k*.12;c.drawImage(this.colorNoiseFrames[mod(Math.floor(time*10)+cell,5)],0,0,TILE,TILE);c.imageSmoothingEnabled=true;
  c.globalAlpha=1;const bandY=(-.10+1.20*ease(.04,.88,boot))*TILE,band=c.createLinearGradient(0,0,TILE,0);
  band.addColorStop(0,`rgba(178,84,140,${k*.14})`);band.addColorStop(.5,`rgba(124,160,128,${k*.13})`);band.addColorStop(1,`rgba(76,139,186,${k*.14})`);c.fillStyle=band;c.fillRect(0,bandY-10,TILE,20);
  const bloom=c.createLinearGradient(0,0,0,TILE);bloom.addColorStop(0,`rgba(120,34,140,${k*.03})`);bloom.addColorStop(.4,'rgba(0,0,0,0)');bloom.addColorStop(.7,'rgba(0,0,0,0)');bloom.addColorStop(1,`rgba(38,77,145,${k*.025})`);c.fillStyle=bloom;c.fillRect(0,0,TILE,TILE);
  // A single low-opacity registration echo vanishes with acquisition.
  c.globalAlpha=k*.062;c.drawImage(source,(cell%2?1:-1)*4,0);c.globalAlpha=1;
  c.fillStyle=`rgba(0,0,0,${k*.058})`;for(let y=0;y<TILE;y+=6)c.fillRect(0,y,TILE,1);
  return this.crtCanvas;
 }
 // Subdivided Hermite boundaries follow the soft-core lens without a polygonal outline.
 // CPU hit testing, geometry and clipping all use the same nonlinear projection.
 curvedEdge(ctx,x0,y0,x1,y1,move=false){
  const dx=x1-x0,dy=y1-y0,eps=.0001;
  const at=t=>this.fieldToScreen(x0+dx*t,y0+dy*t);
  if(move){const p=at(0);ctx.moveTo(p.x,p.y);}
  for(let j=0;j<4;j++){
   const a=j*.25,b=(j+1)*.25,p=at(a),q=at(b),pa=at(a+eps),ma=at(a-eps),pb=at(b+eps),mb=at(b-eps),k=(b-a)/(6*eps);
   ctx.bezierCurveTo(p.x+(pa.x-ma.x)*k,p.y+(pa.y-ma.y)*k,q.x-(pb.x-mb.x)*k,q.y-(pb.y-mb.y)*k,q.x,q.y);
  }
 }
 cellPath(ctx,x,y,top=0,bottom=1){
  ctx.beginPath();this.curvedEdge(ctx,x,y+top,x+1,y+top,true);this.curvedEdge(ctx,x+1,y+top,x+1,y+bottom);
  this.curvedEdge(ctx,x+1,y+bottom,x,y+bottom);this.curvedEdge(ctx,x,y+bottom,x,y+top);ctx.closePath();
 }
 triangle(ctx,source,s,d){
  if(d.every(p=>p.x<-2)||d.every(p=>p.x>this.width+2)||d.every(p=>p.y<-2)||d.every(p=>p.y>this.height+2))return;
  const [s0,s1,s2]=s,[d0,d1,d2]=d,den=(s1.x-s0.x)*(s2.y-s0.y)-(s2.x-s0.x)*(s1.y-s0.y);if(Math.abs(den)<.001)return;
  const a=((d1.x-d0.x)*(s2.y-s0.y)-(d2.x-d0.x)*(s1.y-s0.y))/den,b=((d1.y-d0.y)*(s2.y-s0.y)-(d2.y-d0.y)*(s1.y-s0.y))/den;
  const c=((d2.x-d0.x)*(s1.x-s0.x)-(d1.x-d0.x)*(s2.x-s0.x))/den,e=((d2.y-d0.y)*(s1.x-s0.x)-(d1.y-d0.y)*(s2.x-s0.x))/den;
  const mx=(d0.x+d1.x+d2.x)/3,my=(d0.y+d1.y+d2.y)/3;
  ctx.save();ctx.beginPath();for(let i=0;i<3;i++){const p=d[i],r=Math.hypot(p.x-mx,p.y-my),k=r?(r+2.0)/r:1;const x=mx+(p.x-mx)*k,y=my+(p.y-my)*k;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.clip();ctx.transform(a,b,c,e,d0.x-a*s0.x-c*s0.y,d0.y-b*s0.x-e*s0.y);ctx.drawImage(source,0,0);ctx.restore();
 }
 destroy(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frameRequest);this.cleanup.forEach(f=>f());this.starCanvas?.remove();if(window.__GALLERY__===this)delete window.__GALLERY__;if(this.gl){const g=this.gl;[this.atlas,this.hoverAtlas,this.mapping].forEach(t=>g.deleteTexture(t));g.deleteBuffer(this.buffer);g.deleteProgram(this.program);}}
}
module.exports={SphericalGallery};
