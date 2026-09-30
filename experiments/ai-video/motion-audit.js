/* Opt-in local motion sampling. No network or persistence. */
if(new URL(location).searchParams.has('audit')){
 const root=document.querySelector('.avn');let run=null,frame=0;
 function sample(now){
  if(!run)return;
  const p=Number(root.dataset.position),delta=Math.abs(p-run.lastPosition);
  if(delta>1e-7){run.changes++;run.maxStep=Math.max(run.maxStep,delta);run.lastChange=now;}
  if(run.lastFrame)run.intervals.push(now-run.lastFrame);
  run.frames++;run.lastFrame=now;run.lastPosition=p;
  if(now-run.inputTime>1000&&now-run.lastChange>200){
   const sorted=run.intervals.slice().sort((a,b)=>a-b);
   root.dataset.audit=JSON.stringify({frames:run.frames,changedFrames:run.changes,maxPositionStep:run.maxStep,finalPosition:p,medianFrameMs:sorted[Math.floor(sorted.length/2)]||0,p95FrameMs:sorted[Math.floor(sorted.length*.95)]||0});run=null;frame=0;
  }else frame=requestAnimationFrame(sample);
 }
 function begin(){const now=performance.now();if(!run){run={inputTime:now,lastChange:now,lastFrame:0,lastPosition:Number(root.dataset.position),frames:0,changes:0,maxStep:0,intervals:[]};delete root.dataset.audit;frame=requestAnimationFrame(sample)}else run.inputTime=now;}
 root.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft')begin()},{capture:true});root.addEventListener('wheel',begin,{capture:true,passive:true});
}
