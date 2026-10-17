import {canonicalFabFolder,localizeFabFolder,isDemoFolder} from './fab-layout-language.mjs';
import {compactFabDirectory,existingFabGroupFolder,sourceBlueprintDirectory} from './fab-directory-scheme.mjs';
const lower=s=>s.toLowerCase();
const beneath=(parent,child)=>parent===''||child===parent||child.startsWith(parent+'/');
const categories=['Meshes/Skeletal/Skeletons','Meshes/Skeletal','Meshes/Static','Blueprints/Components','Blueprints/Interfaces','Blueprints','Interfaces','Widgets','Components','Materials','Textures','Animations','Skeletons','Physics','DataAssets','DataTables','Input','Effects','Enums','Structs','Fonts','Maps','Audio','Curves','Meshes'];
const demo=p=>p.split('/').slice(0,-1).some(isDemoFolder);
const primary=a=>['SkeletalMesh','StaticMesh'].includes(a.class?.split('.').pop())||a.class?.split('.').pop().includes('Blueprint');
// Old scans called Skeleton assets Animations. Route by the actual class even when
// the inventory was produced before the scanner's category correction.
export const fabAssetCategory=a=>a.class?.split('.').pop()==='Skeleton'?'Meshes/Skeletal/Skeletons':({Components:'Blueprints/Components',Interfaces:'Blueprints/Interfaces'}[a.category]||a.category);
export function fabDemoFolders(assets,root,language='en'){
 const blocks=[...new Set(assets.filter(a=>demo(a.path)).map(a=>a.path.split('/').slice(0,a.path.split('/').findIndex(isDemoFolder)+1).join('/')))];
 return Object.fromEntries(assets.filter(a=>demo(a.path)).map(a=>{const parts=a.path.split('/'),index=parts.findIndex(isDemoFolder),parents=parts.slice(2,index).filter(s=>s!==root),namespace=blocks.length>1?parents.join('/'):'',tail=parts.slice(index+1,-1).join('/');return [a.path,['/Game',root,localizeFabFolder('Demo',language),namespace,tail].filter(Boolean).join('/')];}));
}
function stripCategory(parts){const value=canonicalFabFolder(parts.join('/'));for(const category of categories){if(value===category||value.startsWith(category+'/'))return parts.slice(category.split('/').length);}if(canonicalFabFolder(parts[0])==='Other'&&parts.length>1)return parts.slice(2);return parts;}
function categoryFor(primaryAssets){const kinds=[...new Set(primaryAssets.map(fabAssetCategory))];if(kinds.length===1)return kinds[0];if(kinds.every(k=>k.startsWith('Meshes')))return 'Meshes';if(kinds.every(k=>k.startsWith('Blueprints')||['Widgets','Animations','DataAssets'].includes(k)))return 'Blueprints';return null;}

// Historical movement records supply directory provenance, never asset bytes or a guessed name.
export function recoverFabOrigins(assets,records){
 const origins=Object.fromEntries(assets.map(a=>[a.path,a.path])),byPath=new Map(assets.map(a=>[a.path,a])),used=[],modules={};
 for(const record of [...records].sort((a,b)=>String(b.finishedAt).localeCompare(String(a.finishedAt)))){
  const oldByNew=new Map((record.moves||[]).map(m=>[m.newPath,m]));let matched=false;
  for(const [current,origin] of Object.entries(origins)){
   if(demo(current))continue;
   const known=record.originMapping?.[origin],move=oldByNew.get(origin),asset=byPath.get(current),expected=known?.class||move?.class;
   if(!expected||expected!==asset.class)continue;
   const original=known?.path||move.oldPath;if(!original?.startsWith('/Game/')||original===origin)continue;
   origins[current]=original;matched=true;
  }
  if(matched){used.push(record.id);for(const [p,name] of Object.entries(record.groupModules||{}))if(!modules[p])modules[p]=name;}
 }
 return {origins,recovered:Object.entries(origins).filter(([p,o])=>p!==o).length,records:used,modules};
}

export function groupFabResources({assets,root,mode='group',modules={},origins={},language='en'}){
 const inferred={};for(const asset of assets){const origin=origins[asset.path]||asset.path,parts=origin.slice(6).split('/');if(parts[0]===root)parts.shift();const first=parts[0];if(parts.length>2&&first&&!categories.includes(canonicalFabFolder(first))&&!['Assets','Demo','Other'].includes(canonicalFabFolder(first)))inferred[first]=first;}
 const canonical=Object.fromEntries(Object.entries(modules).map(([p,name])=>[p.startsWith(root+'/')?p.slice(root.length+1):p,name]));
 const moduleList=Object.entries({...inferred,...canonical}).sort((a,b)=>b[0].length-a[0].length);
 const rows=[...assets].sort((a,b)=>a.path.localeCompare(b.path)).map(asset=>{
  const origin=origins[asset.path]||asset.path,relative=origin.startsWith('/Game/'+root+'/')?origin.slice(root.length+7):origin.slice(6),module=moduleList.find(([p])=>relative.startsWith(p+'/'));
  let parts=relative.split('/').slice(0,-1);
  let namespace='';
  // A user-defined functional root remains a namespace; existing type roots don't repeat.
  if(module){let originalParts=module[0].split('/');if(originalParts[0]===root)originalParts.shift();const actual=canonicalFabFolder(originalParts.join('/'));if(actual&&!categories.includes(actual)&&actual!=='Assets'&&actual!=='Demo'&&!actual.startsWith('Other/')){parts=relative.slice(module[0].length+1).split('/').slice(0,-1);namespace=String(module[1]||originalParts.at(-1));}}
  parts=stripCategory(parts).filter(s=>canonicalFabFolder(s)!=='Assets');
  const dir=parts.join('/'),logical=[namespace,dir].filter(Boolean).join('/');return {asset,origin,namespace,dir,logical,preserved:demo(asset.path)};
 });
 // A single functional shell contributes no distinction between resource groups.
 // Keep namespaces when there are several independent modules.
 const namespaces=new Set(rows.filter(r=>!r.preserved&&r.namespace).map(r=>r.namespace));
 if(namespaces.size===1){const shell=[...namespaces][0];for(const row of rows){row.namespace='';if(row.dir===shell)row.dir='';else if(row.dir.startsWith(shell+'/'))row.dir=row.dir.slice(shell.length+1);row.logical=row.dir;}}
 // UI/UIButtons adds a click without describing a distinct group. Collapse only
 // redundant parent names: UIButtons already expresses UI, even if UI also has
 // other children or direct assets. Those siblings keep their own paths.
 for(const row of rows){if(row.preserved)continue;const parts=row.dir.split('/').filter(Boolean),kept=[];for(let i=0;i<parts.length;i++){if(i<parts.length-1&&lower(parts[i+1]).startsWith(lower(parts[i]))&&!categories.includes(parts[i]))continue;kept.push(parts[i]);}row.compactDir=kept.join('/');}
 for(const row of rows){if(row.compactDir!==undefined)row.dir=row.compactDir;row.logical=[row.namespace,row.dir].filter(Boolean).join('/');}
 const anchors=new Map();for(const row of rows.filter(r=>!r.preserved&&primary(r.asset)&&(r.dir||r.asset.category==='Meshes/Static'))){
  let dir=row.dir;const parts=dir.split('/');
  // A model's internal Meshes/Blueprints folder is a type subfolder, not a new resource group.
  const suffixes=row.asset.category.startsWith('Meshes')?['Meshes/Skeletal','Meshes/Static','Meshes']:['Blueprints/Components','Blueprints/Interfaces','Blueprints','Components','Interfaces','Widgets'];
  for(const suffix of suffixes)if(canonicalFabFolder(dir).endsWith('/'+suffix)&&parts.length>suffix.split('/').length){dir=parts.slice(0,-suffix.split('/').length).join('/');break;}
  const id=[row.namespace,dir].filter(Boolean).join('/'),existing=anchors.get(id)||{id,namespace:row.namespace,dir,assets:[]};existing.assets.push(row.asset);anchors.set(id,existing);
 }
 const bundles=[...anchors.values()].map(g=>({...g,category:categoryFor(g.assets)})).filter(g=>g.category).sort((a,b)=>b.id.length-a.id.length);
 const folders={},assignments={},groups=new Map(),notes=[];
 for(const row of rows){if(row.preserved)continue;const owner=mode==='group'?bundles.find(g=>g.namespace===row.namespace&&beneath(g.dir,row.dir)&&(g.dir!==''||g.assets.includes(row.asset)||['Materials','Textures'].includes(row.asset.category))):null;
  const category=fabAssetCategory(row.asset);let logical=row.logical;
  if(owner&&category!==owner.category){const tail=row.dir.slice(owner.dir.length).replace(/^\//,''),subtype=localizeFabFolder(category==='Meshes/Skeletal/Skeletons'?'Skeletons':owner.category==='Blueprints'&&category.startsWith('Blueprints/')?category.slice('Blueprints/'.length):category,language);
   // Keep a model together, with explicit Materials/Textures/Skeletons subfolders.
   // Do not repeat a type folder that already exists inside the resource group.
   logical=[owner.id,...(lower(tail)===lower(subtype)||lower(tail).startsWith(lower(subtype)+'/')?[tail]:[subtype,tail])].filter(Boolean).join('/');
  }
  const legacyShell=namespaces.size===1&&row.asset.path.slice(6).split('/').slice(1,-1).includes([...namespaces][0]);
  const existing=mode==='group'&&row.origin===row.asset.path&&!legacyShell?existingFabGroupFolder(row.asset,root):null;
  const blueprintFolder=sourceBlueprintDirectory(row.asset,root,row.origin);
  const folder=blueprintFolder||compactFabDirectory(existing||'/Game/'+root+'/'+localizeFabFolder(owner?owner.category:category,language)+'/'+logical,{root,language,preserveBlueprint:false});
  folders[row.asset.path]=folder.replace(/\/$/,'');const groupId=owner?.id||row.logical||'Root';assignments[row.asset.path]=groupId;
  const id=blueprintFolder||((owner?.category||category)+'/'+groupId),g=groups.get(id)||{id,label:blueprintFolder?blueprintFolder.slice(('/Game/'+root+'/').length):groupId,category:blueprintFolder?'Blueprints':owner?.category||category,target:blueprintFolder||(owner?compactFabDirectory('/Game/'+root+'/'+localizeFabFolder(owner.category,language)+'/'+owner.id,{root,language,preserveBlueprint:false}):folders[row.asset.path]),assets:[],bundled:!!blueprintFolder||Boolean(owner),sourceHierarchyPreserved:!!blueprintFolder};g.assets.push(row.asset.path);groups.set(id,g);
 }
 // Count independent owning groups, not the number of actors/references in a single group.
 const referencedBy=new Map();for(const row of rows){if(row.preserved)continue;for(const dep of row.asset.dependencies||[]){if(!referencedBy.has(dep))referencedBy.set(dep,new Set());referencedBy.get(dep).add(assignments[row.asset.path]||row.logical||'Root');}}
 const shared=[];for(const [assetPath,owners] of referencedBy){if(owners.size<2||!folders[assetPath])continue;const row=rows.find(r=>r.asset.path===assetPath);shared.push({path:assetPath,target:folders[assetPath]+'/'+row.asset.name,groups:[...owners].sort(),placement:'保留原目录归属，单份资源'});}
 // SourceArt / HLOD are not silently inferred into a bundle. Mixed primary groups stay separate.
 for(const anchor of anchors.values())if(!categoryFor(anchor.assets)&&!bundles.some(g=>g.namespace===anchor.namespace&&beneath(g.dir,anchor.dir)))notes.push({group:anchor.id,reason:'包含多种主体资源，保留小分类并分别进入对应大类'});
 return {folders,groups:[...groups.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(g=>({...g,count:g.assets.length})),shared,notes,origins};
}
