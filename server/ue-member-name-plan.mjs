import {originalNameSuffix} from './translation-name-qualifiers.mjs';

const classKinds=new Set(['变量','组件','UMG控件','UMG动画','组件绑定回调','函数','宏','折叠图','事件','自定义事件','事件分发器','时间轴']);
const localKinds=new Set(['局部变量','输入参数','输出参数']);
const roles={'变量':'Variable','组件':'Component','UMG控件':'Widget','UMG动画':'Animation','函数':'Function','宏':'Macro','折叠图':'Graph','事件':'Event','自定义事件':'Event','事件分发器':'Dispatcher','时间轴':'Timeline','局部变量':'Local','输入参数':'Input','输出参数':'Output'};
const priorities={'变量':0,'事件分发器':1,'函数':2,'组件':3,'UMG控件':4,'UMG动画':4,'事件':5,'自定义事件':5};
const fold=value=>String(value||'').toLowerCase();
export function memberNameScope(row){
 if(row.group==='assets'||row.field!=='Name'||!row.owner)return null;
 if(classKinds.has(row.kind))return row.owner+'|class';
 if(localKinds.has(row.kind)){
  const graph=row.graphName||row.elementName?.split('/').slice(0,-2).join('/');
  // Legacy scans may omit this. The native preflight resolves it by GUID from
  // the actual graph before validating any names or modifying any fields.
  return graph?row.owner+'|graph|'+fold(graph):null;
 }
 return null;
}
const identity=row=>fold(row.original);
function qualifiedName(base,row,index=0){
 const suffix=originalNameSuffix(row.original),hasSuffix=suffix&&base.endsWith(suffix);
 const stem=hasSuffix?base.slice(0,-suffix.length):base;
 return stem+(roles[row.kind]||'Member')+(index>1?index:'')+(hasSuffix?suffix:'');
}

// UE properties, widgets, functions and delegates share the class namespace.
// Function parameters and locals share a separate namespace for each graph.
// Reserve original names as well: the editor applies rows sequentially, so a
// final name must not temporarily overwrite a different member's old name.
export function planMemberNames(rows,scan={}){
 const output=rows.map(row=>({...row})),scopes=new Map(),byOwner=new Map();
 const scopeFor=key=>{if(!scopes.has(key))scopes.set(key,{originals:new Map(),used:new Map(),groups:new Map(),inheritedPlans:new Map()});return scopes.get(key);};
 for(const row of [...(scan.entries||[]),...output]){
  const key=memberNameScope(row);if(!key||!row.original)continue;
  scopeFor(key).originals.set(fold(row.original),identity(row));
 }
 for(const asset of scan.assets||[]){
  const scope=scopeFor(asset.packageName+'|class');
  for(const name of asset.reservedMemberNames||[])scope.originals.set(fold(name),'@reserved:'+fold(name));
  byOwner.set(asset.packageName,asset);
 }
 for(const row of output){
  const key=memberNameScope(row);if(!key||!row.translated)continue;
  const scope=scopeFor(key),id=identity(row);
  if(!scope.groups.has(id))scope.groups.set(id,[]);
  scope.groups.get(id).push(row);
 }
 // Interface declarations own a single contract shared by every implementer.
 // Reserve implementers' existing names before choosing the declaration name.
 for(const asset of scan.assets||[])for(const link of asset.interfaceMemberBindings||[]){
  if(!byOwner.has(link.interfaceOwner))continue;
  const declaration=scopeFor(link.interfaceOwner+'|class'),implementation=scopeFor(asset.packageName+'|class');
  for(const [name,id] of implementation.originals)if(name!==fold(link.functionName)&&!declaration.originals.has(name))declaration.originals.set(name,'@implementation:'+id);
 }
 const visited=new Set(),visiting=new Set();
 function process(key){
  if(visited.has(key)||visiting.has(key))return;
  visiting.add(key);const scope=scopeFor(key),owner=key.split('|')[0];
  if(key.endsWith('|class')){
   const asset=byOwner.get(owner),parent=asset?.parentBlueprint||asset?.parentClass?.replace(/\.[^/.]+_C$/,'');
   if(parent&&parent!==owner&&byOwner.has(parent)){
    const parentKey=parent+'|class';process(parentKey);
    const parentScope=scopeFor(parentKey);
    for(const name of parentScope.originals.keys())if(!scope.originals.has(name))scope.originals.set(name,'@inherited:'+name);
    for(const [name,id] of parentScope.used)scope.originals.set(name,id);
    scope.inheritedPlans=new Map(parentScope.inheritedPlans);
    for(const [id,group] of parentScope.groups)scope.inheritedPlans.set(id,group[0].translated);
   }
  }
  for(const link of byOwner.get(owner)?.interfaceMemberBindings||[]){
   if(!byOwner.has(link.interfaceOwner))continue;
   const target=key.endsWith('|class')?link.interfaceOwner+'|class':key===owner+'|graph|'+fold(link.functionName)?link.interfaceOwner+'|graph|'+fold(link.functionName):null;
   if(!target)continue;process(target);const declaration=scopeFor(target);
   for(const [id,group] of scope.groups){
    const source=key.endsWith('|class')?(id===fold(link.functionName)||group.some(r=>link.nodeGuid&&r.nodeGuid===link.nodeGuid||link.graphGuid&&r.nodeGuid===link.graphGuid)?declaration.groups.get(fold(link.functionName)):null):declaration.groups.get(id);
    if(!source?.[0]?.translated)continue;const name=source[0].translated;scope.inheritedPlans.set(id,name);scope.originals.set(fold(name),id);
   }
  }
  const groups=[...scope.groups.values()].sort((a,b)=>{
   const fixed=g=>g.some(r=>r.native||r.preserveGeneratedCallback||r.preserveOriginalEnglish||r.translated===r.original);
   return Number(fixed(b))-Number(fixed(a))||Math.min(...a.map(r=>priorities[r.kind]??10))-Math.min(...b.map(r=>priorities[r.kind]??10))||identity(a[0]).localeCompare(identity(b[0]),'en');
  });
  // Reserve every requested final name before allocating qualified alternatives.
  const requested=new Set(groups.flatMap(g=>g.map(r=>fold(r.translated))));
  for(const group of groups){
   const representative=[...group].sort((a,b)=>(priorities[a.kind]??10)-(priorities[b.kind]??10))[0],id=identity(representative);
   const fixed=group.find(r=>r.native||r.preserveGeneratedCallback||r.preserveOriginalEnglish||r.translated===r.original);
   // An override and its parent declaration must keep the same final name.
   const base=(fixed?.preserveGeneratedCallback?fixed.translated:fixed?.original)||scope.inheritedPlans.get(id)||representative.translated;
   const occupied=name=>(scope.used.has(fold(name))&&scope.used.get(fold(name))!==id)||(scope.originals.has(fold(name))&&scope.originals.get(fold(name))!==id);
   let name=base;
   if(!fixed&&occupied(name)){
    let index=0;do{name=qualifiedName(base,representative,++index);}while(occupied(name)||requested.has(fold(name)));
   }
   scope.used.set(fold(name),id);
   for(const row of group){
    if(name!==row.translated)row.nameCollisionResolution={requested:row.translated,resolved:name,reason:'UE 共用命名范围内消除冲突'};
    else if(row.nameCollisionResolution?.resolved!==name)delete row.nameCollisionResolution;
    row.translated=name;
   }
  }
  visiting.delete(key);visited.add(key);
 }
 for(const key of scopes.keys())process(key);
 return output;
}

export function memberNameCollisions(rows){
 const used=new Map(),collisions=new Set();
 for(const row of rows){
  const scope=memberNameScope(row);if(!scope||!row.translated)continue;
  const key=scope+'|'+fold(row.translated),previous=used.get(key);
  if(previous&&identity(previous)!==identity(row)){collisions.add(previous.entryKey);collisions.add(row.entryKey);}else used.set(key,row);
 }
 return collisions;
}
