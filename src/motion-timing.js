'use strict';
/** Editorial animatic: 26 seconds at 24 fps. Scroll remains user-controlled on the site. */
const FPS=24,DURATION=26,FRAMES=FPS*DURATION;
const KEYS=[[0,.13],[36,.17],[80,.205],[128,.295],[166,.335],[226,.455],[256,.466],[320,.57],[374,.64],[430,.77],[495,.824],[572,.95],[623,.98]];
const ease=t=>t*t*t*(t*(t*6-15)+10);
function frameState(frame){
 let p=KEYS[KEYS.length-1][1];
 for(let i=1;i<KEYS.length;i++)if(frame<=KEYS[i][0]){const a=KEYS[i-1],b=KEYS[i],t=ease(Math.max(0,Math.min(1,(frame-a[0])/(b[0]-a[0]))));p=a[1]+(b[1]-a[1])*t;break;}
 const crop=p>.38&&p<.478?.5+.18*Math.sin((p-.38)/.098*Math.PI):.5;
 return{progress:p,crop,record:0,small:false,film:true};
}
module.exports={FPS,DURATION,FRAMES,KEYS,frameState};
