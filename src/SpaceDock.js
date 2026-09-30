'use strict';
const React=__r(1),h=React.createElement;
function SpaceDock({space}){
 return h('div',{className:'space-dock-wrap'},h('div',{className:'space-dock',role:'tablist','aria-label':'关于我或作品','data-selected':space},
 h('i',{className:'space-dock-selection','aria-hidden':true}),
 ...[['about','关于我','ABOUT'],['works','作品','WORK']].map(([id,label,en])=>h('button',{key:id,id:'tab-'+id,role:'tab','aria-controls':id+'-space','aria-selected':space===id,onClick:()=>window.dispatchEvent(new CustomEvent('space-switch',{detail:id}))},label,h('small',null,en)))));
}
exports.SpaceDock=SpaceDock;
