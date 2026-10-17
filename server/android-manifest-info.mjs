// aapt xmltree indentation preserves element scope; an application-level VR tag
// must not be mistaken for the tag on UE's GameActivity.
export function inspectAndroidManifest(xml){
 const roots=[],stack=[];
 for(const line of String(xml).split(/\r?\n/)){
  const element=line.match(/^(\s*)E: ([\w-]+)/);
  if(element){const depth=element[1].length;while(stack.length&&stack.at(-1).depth>=depth)stack.pop();const node={tag:element[2],depth,attributes:{},children:[]};(stack.at(-1)?.children||roots).push(node);stack.push(node);continue;}
  const attr=line.match(/^\s*A: android:([\w]+)(?:\([^)]*\))?=(.*)$/);if(attr&&stack.length){const raw=attr[2];stack.at(-1).attributes[attr[1]]=raw.match(/^"([^"]*)"/)?.[1]??raw.match(/^@(0x[\da-f]+)/i)?.[1]??raw;}
 }
 const all=[];function walk(nodes){for(const node of nodes){all.push(node);walk(node.children);}}walk(roots);
 const activity=all.filter(n=>n.tag==='activity'||n.tag==='activity-alias'),vr=n=>n.children.some(c=>c.tag==='meta-data'&&['pvr.app.type','com.picovr.type'].includes(c.attributes.name)&&c.attributes.value==='vr');
 const game=activity.filter(n=>/\.(?:GameActivity|UE4GameActivity)$/.test(n.attributes.name||''));
 const launchers=activity.filter(n=>n.children.some(f=>f.tag==='intent-filter'&&f.children.some(c=>c.tag==='action'&&c.attributes.name==='android.intent.action.MAIN')&&f.children.some(c=>c.tag==='category'&&c.attributes.name==='android.intent.category.LAUNCHER')));
 const manifest=roots.find(n=>n.tag==='manifest'),questHandPermission=!!manifest?.children.some(n=>n.tag==='uses-permission'&&n.attributes.name==='com.oculus.permission.HAND_TRACKING'),questHandFeature=!!manifest?.children.some(n=>n.tag==='uses-feature'&&n.attributes.name==='oculus.software.handtracking');
 return {questHandPermission,questHandFeature,picoActivityVr:game.some(vr),picoApplicationVr:all.filter(n=>n.tag==='application').some(vr),launcherActivities:launchers.map(n=>n.attributes.name),gameActivities:game.map(n=>n.attributes.name)};
}
