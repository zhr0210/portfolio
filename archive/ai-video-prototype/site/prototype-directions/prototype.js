import { VideoReel } from './video-reel.js?rev=10';
/* PROTOTYPE — design comparison only. No media claims or external submissions. */
'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t);return t*t*(3-2*t)};
const range=(a,b,p)=>ease((p-a)/(b-a));
const lerp=(a,b,t)=>a+(b-a)*t;
const run=$('#scroll-run'),stage=$('.stage'),frame=$('#shared-frame');
const mainArt=$('.frame-art'),filmArt=$('.film-art');
const scenes={work:$('.scene-work'),film:$('.scene-film'),ai:$('.scene-ai'),aiFilm:$('.scene-ai-film'),process:$('.scene-process'),contact:$('.scene-contact')};
const aiVideoNodes=new VideoReel(document.getElementById('ai-node-embedded'), { returnUrl: 'http://127.0.0.1:4173/' });
const stops={work:.10,film:.37,ai:.56,aiFilm:.70,process:.83,contact:1};
const titles=['盛启预告','启幕盛典','启幕大促','全运会接待回顾','岁末家宴','春季大促','春馔'];
const originals=['1.盛启预告 Grand Opening Preview.jpg','2.启幕盛典 Opening Ceremony.jpg','3.启幕大促 Launch Specials.jpg','4.全运会接待回顾 National Games Reception Review.jpg',"5.岁末家宴 New Year's Eve Dinner.jpg",'6.春季大促 Spring Sale.jpg','7.春馔 Spring Dishes.jpg'];
const variants={a:{title:'A / 连续镜场',en:'CONTINUOUS FRAME',intro:'以一张持续在场的画面，连接作品、电影与 AI 创作。最接近你希望的无缝观看方式。',motion:'作品散布在有景深的全景中；画廊收束时，中心画面保持在场并展开为电影画幅。随后画幅向左收起，露出 AI 图片，再进入镜头与制作过程。',trade:'空间感最强，需要仔细控制全景拖拽与纵向滚动；正式版优先推荐这个方向。'},b:{title:'B / 编辑长卷',en:'EDITORIAL SEQUENCE',intro:'以排版秩序建立高级感。标题与信息留在左侧，右侧承载作品与影像。',motion:'平面作品形成横向长卷；主画面向右上对齐并变为视频窗口。AI 成果像杂志跨页依次展开，流程与结果并排阅读。',trade:'浏览效率最高，适合作品内容较多或招聘场景。动效更克制，移动端最容易保持清晰。'},c:{title:'C / 光学档案',en:'OPTICAL ARCHIVE',intro:'借用摄影接触印样与取景器语言，让图像、镜头和创作过程共享一套视觉规则。',motion:'全景成为接触印样墙，选中的画幅从网格中放大，四角取景标记持续在场。视频退场时，画幅拆成 AI 关键帧与制作步骤。',trade:'更突出摄影与实验性，AI 区更有个人辨识度；线框、刻度需要克制，避免界面压过作品。'}};
let variant='a',p=0,raf=0,selectedFilm=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const tiles=Array.from({length:6},(_,i)=>{const b=document.createElement('button');b.className='tile';b.setAttribute('aria-label','阅读'+titles[i+1]);b.innerHTML=`<img src="../images/panorama/0${i+2}-01.webp" alt="${titles[i+1]}作品封面"><span>${String(i+2).padStart(2,'0')} / ${titles[i+1]}</span>`;b.onclick=()=>openWork(i+1);$('.gallery').append(b);return b});
const dialog=$('#details'),content=$('#detail-content');
function show(html){content.innerHTML=html;dialog.showModal();document.body.style.overflow='hidden'}
dialog.addEventListener('close',()=>document.body.style.overflow='');
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
function openWork(i){show(`<span class="meta">原作 / 公众号长图设计</span><h2>${titles[i]}</h2><p>可在此阅读完整长图。关闭后回到原来的观看位置。</p><img src="../images/公众号推文 WeChat Official Account article/${originals[i]}" alt="${titles[i]}完整作品">`)}
$('#open-main-work').onclick=()=>openWork(0);
$('#about-design').onclick=()=>{const v=variants[variant];show(`<span class="meta">${v.en} · 初版方向 ${variant.toUpperCase()}</span><h2>${v.title.slice(4)}</h2><p>${v.intro}</p><p>${v.motion}</p><p>${v.trade}</p><ul><li>观看顺序：Hero → 作品全景 → 视频 → AI 图片 → AI 视频 → AI 辅助长图文 → 联系。</li><li>这里从 Hero 之后开始。Hero 原设计未改动。</li><li>平面作品使用现有 7 件原作，点击可读。全景布局是方向原型，尚未接入原站的无限曲面引擎。</li><li>视频、AI 画面是布局示意；真实视频、AI 案例与联系方式仍待提供。</li><li>顶部方案切换与本说明仅用于设计比较。</li></ul><p><a href="../">返回现有作品集 ↗</a></p>`)};
const info={film:['视频作品的观看方式','正式版：主视频静音预览；点击打开播放器，用户主动选择声音。底部项目切换会同时更换影片、片名和创作职责。此处尚未接入片源，画面仅模拟构图。'],image:['先看成果，再了解创作','正式版：点击图片打开大图，同时展示主题、人工决策与 AI 参与环节。示意造型由网页绘制，用于比较版式，不是你的 AI 作品。'],'ai-film':['把生成变成镜头设计','正式版：并列展示起始帧、镜头运动和成片；点击播放。这里演示画面连续性，尚未接入真实 AI 视频。']};
$$('[data-info]').forEach(b=>b.onclick=()=>{const t=info[b.dataset.info];show(`<span class="meta">设计预览 / 待接入真实内容</span><h2>${t[0]}</h2><p>${t[1]}</p>`)});
$('#contact-button').onclick=()=>show('<span class="meta">CONTACT / 联系方式布局预留</span><h2>让合作从对话开始。</h2><p>这里将直接展示你的邮箱、社交链接或微信。当前资料中的邮箱为空，暂不设置虚构联系方式或发送表单。</p>');
$$('[data-film]').forEach(b=>b.onclick=()=>{selectedFilm=Number(b.dataset.film);$$('[data-film]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filmArt.style.filter=`hue-rotate(${selectedFilm*16}deg)`;$('.film-word').textContent=['STILL / MOVING','LIGHT / TIME','FORM / MOTION'][selectedFilm]});
const stepText=['先确定主题、观看对象和文章主线。','借助 AI 展开提纲与视觉方向，再筛选可用内容。','由设计师完成素材取舍、版式和修图。','人工核验文案、图像细节与最终输出。'];
$$('[data-step]').forEach(b=>b.onclick=()=>{$$('[data-step]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const i=Number(b.dataset.step);$('#process-detail').textContent=stepText[i];$('.sheet-photo').style.filter=`brightness(${1+i*.08})`;$('.sheet-lines').style.width=(65+i*8)+'%'});
function jump(key){const span=run.offsetHeight-stage.offsetHeight-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--review-h'));window.scrollTo({top:stops[key]*span,behavior:'instant'});draw()}
$$('[data-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.jump));
function setVariant(v,update=true){variant=variants[v]?v:'a';document.body.dataset.variant=variant;$$('.variants [data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.variant===variant)));$('#direction-label').textContent=variants[variant].title;if(update){const u=new URL(location);u.searchParams.set('v',variant);history.replaceState(null,'',u)}draw();}
$$('.variants [data-variant]').forEach(b=>b.onclick=()=>setVariant(b.dataset.variant));
function box(el,g){el.style.left=g[0]+'%';el.style.top=g[1]+'%';el.style.width=g[2]+'%';el.style.height=g[3]+'%';el.style.transform=`rotate(${g[4]||0}deg)`}
const layouts={a:[[46,34,24,42,0],[25,58,17,25,-5],[76,55,17,25,4],[38,19,12,22,-4],[79,23,14,25,5],[6,57,13,22,-5],[58,18,15,18,4]],b:[[5,48,12,31,0],[18,48,12,31,0],[31,48,12,31,0],[44,48,12,31,0],[57,48,12,31,0],[70,48,12,31,0],[83,48,12,31,0]],c:[[55,26,18,49,0],[35,26,18,23,0],[75,26,18,23,0],[35,52,18,23,0],[75,52,18,23,0],[35,78,18,12,0],[75,78,18,12,0]]};
function blend(a,b,t){return a.map((v,i)=>lerp(v,b[i]||0,t))}
function activate(el,opacity,y=0){el.style.opacity=opacity;el.style.visibility=opacity>.002?'visible':'hidden';el.style.pointerEvents=opacity>.8?'auto':'none';el.inert=opacity<.8;el.style.transform=`translateY(${y}px)`}
function draw(){
 const mobile=stage.clientWidth<760;const vh=stage.clientHeight;
 const span=Math.max(1,run.offsetHeight-vh-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--review-h')));
 p=clamp(window.scrollY/span);const t=range(.17,.31,p),out=range(.43,.51,p);
 let layout=layouts[variant].map(x=>[...x]);
 if(mobile){layout=variant==='b'?[[6,42,26,25,0],[37,42,26,25,0],[68,42,26,25,0],[6,70,19,15,0],[29,70,19,15,0],[52,70,19,15,0],[75,70,19,15,0]]:variant==='c'?[[35,43,30,33,0],[5,43,26,16,0],[69,43,26,16,0],[5,63,26,16,0],[69,63,26,16,0],[35,81,30,16,0],[35,24,30,16,0]]:[[35,42,36,35,0],[3,59,26,22,-7],[75,60,28,22,6],[4,39,23,17,-5],[77,35,22,21,6],[39,82,27,20,3],[69,12,27,19,7]];}
 const initial=layout[0];let target=mobile?[6,33,88,30,0]:variant==='b'?[42,25,52,47,0]:variant==='c'?[35,24,56,47,0]:[30,22,64,49,0];
 const bridge=range(.20,.255,p);const mid=mobile?[6,25,88,49,0]:variant==='a'?[3,13,94,73,0]:target;
 let shared=p<.255?blend(initial,mid,range(.17,.255,p)):blend(mid,target,range(.255,.32,p));
 if(reduced.matches)shared=p<.24?initial:target;
 box(frame,shared);frame.style.opacity=1-out;frame.style.visibility=out>.999?'hidden':'visible';frame.inert=p>.22;mainArt.style.opacity=1-bridge;filmArt.style.opacity=bridge;
 for(let i=0;i<tiles.length;i++){const original=layout[i+1],pos=[...original];const travel=range(0,.17,p);if(variant==='a'){pos[1]-=travel*(i%2?3:5);pos[4]*=1-travel*.2}else if(variant==='b'){pos[1]-=travel*2}else{pos[1]+=travel*(i%2?-2:2)}const end=[50+(pos[0]-50)*1.7,50+(pos[1]-50)*1.7,pos[2]*.8,pos[3]*.8,pos[4]*.3];box(tiles[i],blend(pos,end,reduced.matches?0:t));activate(tiles[i],1-range(.17,.245,p));tiles[i].style.transform=`rotate(${pos[4]||0}deg)`}
 activate(scenes.work,1-range(.165,.235,p));
 activate(scenes.film,range(.29,.33,p)*(1-range(.435,.495,p)),reduced.matches?0:(1-range(.29,.33,p))*22);
 activate(scenes.ai,range(.49,.535,p)*(1-range(.615,.66,p)),reduced.matches?0:(1-range(.49,.535,p))*35);
 activate(scenes.aiFilm,range(.65,.68,p)*(1-range(.75,.795,p)),reduced.matches?0:(1-range(.65,.68,p))*35);
 activate(scenes.process,range(.79,.815,p)*(1-range(.895,.94,p)),reduced.matches?0:(1-range(.79,.815,p))*35);
 activate(scenes.contact,range(.93,.98,p),reduced.matches?0:(1-range(.93,.98,p))*30);
 aiVideoNodes.setActive(p>=.68&&p<=.75);
 let current=p<.275?'work':p<.48?'film':p<.65?'ai':p<.79?'aiFilm':p<.925?'process':'contact';
 $$('[data-jump]').forEach(b=>{if(b.dataset.jump===current)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current')});
 $('.progress-track i').style.transform=`scaleX(${p})`;
 $('#scroll-hint').textContent=current==='contact'?'END / THANK YOU':'SCROLL TO EXPLORE ↓';stage.dataset.progress=p.toFixed(4);stage.dataset.chapter=current;
}
function schedule(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;draw()})}
window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);reduced.addEventListener('change',schedule);
setVariant(new URL(location).searchParams.get('v')||'a',false);

if(location.hash==='#ai-video')jump('aiFilm');
