import {classificationDependencyBaseline,assertClassificationBaseline} from './classification-dependency-baseline.mjs';
import {sourceBlueprintDirectory} from './fab-directory-scheme.mjs';
import {blueprintCompileScope} from './blueprint-compile-scope.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {inspectFabProject} from './fab-project-inspection.mjs';
import {decodeIni,encodeIni} from './ue-ini.mjs';
import {groupFabResources,recoverFabOrigins,fabDemoFolders,fabAssetCategory} from './fab-resource-groups.mjs';
import {fabLayoutLanguage,localizeFabFolder,isDemoFolder,validProjectFolder} from './fab-layout-language.mjs';
import {classificationTaskFolder,removeClassificationData} from './project-classification-cache.mjs';
const inside=(root,file)=>{const rel=path.relative(root,file);return rel===''||!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
const identifier=s=>/^[A-Za-z][A-Za-z0-9_]*$/.test(s);
const key=s=>s.toLowerCase();
const skipped=new Set(['saved','intermediate','deriveddatacache','.git','.ue-translation-cache']);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function snapshot(root){const files=[];async function walk(dir,relative=''){for(const item of await fs.readdir(dir,{withFileTypes:true})){if(skipped.has(key(item.name)))continue;if(item.isSymbolicLink())throw Error('工程含链接目录或文件，已停止，避免写入原项目');const file=path.join(dir,item.name),rel=relative?relative+'/'+item.name:item.name;if(item.isDirectory())await walk(file,rel);else if(item.isFile())files.push({relative:rel,hash:digest(await fs.readFile(file))});}}await walk(root);files.sort((a,b)=>a.relative.localeCompare(b.relative));return {files,digest:digest(JSON.stringify(files))};}
async function copySnapshot(source,target,snap){await fs.mkdir(target);for(const name of ['Content','Config'])await fs.mkdir(path.join(target,name));for(const file of snap.files){const dest=path.join(target,...file.relative.split('/'));await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(source,...file.relative.split('/')),dest,fs.constants.COPYFILE_EXCL);}}

export function planFabMoves({assets,root,mode='group',modules={},origins={},language='auto'}){
 if(!validProjectFolder(root))throw Error('产品根目录须使用中英文字母、数字和下划线');
 language=fabLayoutLanguage(assets,root,language);
 if(!['group','hierarchy','feature','type'].includes(mode))throw Error('未知分类方式');
 if(['group','hierarchy'].includes(mode))modules=Object.fromEntries(Object.entries(modules).map(([p,name])=>[p.startsWith(root+'/')?p.slice(root.length+1):p,name]));
 const names=Object.values(modules).map(s=>String(s).trim());if(['group','hierarchy','feature'].includes(mode)&&(names.some(s=>!validProjectFolder(s))||new Set(names.map(key)).size!==names.length))throw Error('功能目录名称不能为空、重复或含特殊字符');
 const grouped=['group','hierarchy'].includes(mode),layout=grouped?groupFabResources({assets,root,mode,modules,origins,language}):null;
 const groups=Object.entries(modules).sort((a,b)=>b[0].length-a[0].length),used=new Set(),moves=[],mapping={},paired=new Map(),preserved=[];
 const assetByPath=new Map(assets.map(a=>[a.path,a]));
 const isBuildData=a=>a?.class?.split('.').pop()==='MapBuildDataRegistry';
 // Demo stays a coherent resource block, but belongs inside the single Pack root.
 const preserveDemo=a=>a.path.slice(6).split('/').slice(0,-1).some(isDemoFolder);
 const demoFolders=fabDemoFolders(assets,root,language);
 for(const asset of assets){if(!asset.path.startsWith('/Game/')||!asset.category.split('/').every(identifier))throw Error('引擎返回的资源类型目录无效');if(preserveDemo(asset)){preserved.push(asset.path);if(demoFolders[asset.path]+'/'+asset.name===asset.path){mapping[asset.path]=asset.path;used.add(key(asset.path));}}}
 for(const world of assets.filter(a=>a.class?.split('.').pop()==='World')){
  const candidates=(world.dependencies||[]).filter(p=>isBuildData(assetByPath.get(p)));
  if(candidates.length>1)throw Error('地图引用多个构建数据，不能安全自动分类：'+world.path);
  if(candidates.length){const build=candidates[0];if(preserveDemo(world)!==preserveDemo(assetByPath.get(build)))throw Error('地图与构建数据跨越 Demo 保留目录，请在引擎中将它们放在一起：'+world.path);if(paired.has(build)&&paired.get(build)!==world.path)throw Error('多张地图共享构建数据，请先在引擎确认地图归属：'+build);paired.set(build,world.path);}
 }
 function targetFolder(asset){if(demoFolders[asset.path])return demoFolders[asset.path];const preserved=sourceBlueprintDirectory(asset,root,origins[asset.path]||asset.path);if(preserved)return preserved;if(layout)return layout.folders[asset.path];const relative=asset.path.slice(6),group=groups.find(([g])=>relative.startsWith(g+'/')),module=mode==='feature'?(group?group[1].trim():localizeFabFolder('Shared',language)):'';return '/Game/'+root+'/'+(module?module+'/':'')+localizeFabFolder(fabAssetCategory(asset),language);}
 function record(asset,newPath,extra={}){mapping[asset.path]=newPath;used.add(key(newPath));const name=newPath.split('/').pop();if(newPath!==asset.path)moves.push({oldPath:asset.path,newPath,newName:name,category:extra.category||asset.category,class:asset.class,collisionResolved:name!==asset.name,...extra});}
 // UWorld::Rename moves its external build-data package to <new map>_BuiltData.
 // Reserve both paths as one group; never give the companion an independent folder/name.
 for(const world of [...assets].filter(a=>[...paired.values()].includes(a.path)).sort((a,b)=>a.path.localeCompare(b.path))){
  if(mapping[world.path])continue;
  const build=assetByPath.get([...paired].find(([,owner])=>owner===world.path)[0]),folder=targetFolder(world);let name=world.name,newPath=folder+'/'+name;
  if(used.has(key(newPath))||used.has(key(newPath+'_BuiltData'))){name+='_'+digest(world.path).slice(0,8);newPath=folder+'/'+name;}
  if(used.has(key(newPath))||used.has(key(newPath+'_BuiltData')))throw Error('地图及构建数据存在无法安全处理的目标冲突');
  record(world,newPath);record(build,newPath+'_BuiltData',{category:'Maps',pairedMap:world.path});
 }
 for(const asset of [...assets].sort((a,b)=>a.path.localeCompare(b.path))){
  if(!asset.path.startsWith('/Game/')||!asset.category.split('/').every(identifier))throw Error('引擎返回的资源类型目录无效');
  if(mapping[asset.path])continue;
  const folder=targetFolder(asset);
  let name=asset.name,newPath=folder+'/'+name;
  if(used.has(key(newPath))){name+='_'+digest(asset.path).slice(0,8);newPath=folder+'/'+name;}
  if(used.has(key(newPath)))throw Error('同名资源无法安全分配目标路径');record(asset,newPath);
 }
 return {moves,mapping,language,assets:assets.length,collisions:moves.filter(m=>m.collisionResolved).length,preserved:preserved.sort(),demoTargets:Object.fromEntries(preserved.map(p=>[p,mapping[p]])),groups:layout?.groups||[],shared:(layout?.shared||[]).map(s=>({...s,target:mapping[s.path]})),notes:layout?.notes||[],origins};
}

export function createFabClassification({root,runner,engines,resourceRoot,launcher,readOnlyRoots=async()=>[],isEditorOpen=async()=>false,cacheForSource}){
 const jobs=new Map(),plans=new Map(),locks=new Set(),store=path.join(root,'.local/fab-classification');
 const save=async j=>{await fs.mkdir(store,{recursive:true});await fs.writeFile(path.join(store,j.id+'.json'),JSON.stringify(j,null,2));};
 async function protectedRoots(source){const roots=await readOnlyRoots();try{const owner=JSON.parse(await fs.readFile(path.join(source.projectRoot,'.ue-translation-cache/owner.json'),'utf8'));if(owner.kind==='ue-project-translation-cache'&&(!owner.roles||owner.roles.includes('translation'))&&(!source.cacheHostDescriptor||key(source.cacheHostDescriptor)===key(source.descriptorPath)))roots.push(source.projectRoot);}catch(e){if(e.code!=='ENOENT')throw e;}return Promise.all(roots.map(async p=>{try{return await fs.realpath(p);}catch(e){if(e.code==='ENOENT')return path.resolve(p);throw e;}}));}
 async function inspect(input){const report=await inspectFabProject(input);if(cacheForSource){const location=await cacheForSource(report.source);report.source.classificationCacheRoot=location.cacheRoot;report.source.cacheHostDescriptor=location.cacheHostDescriptor;}const roots=await protectedRoots(report.source);report.inPlaceAllowed=!roots.some(r=>inside(r,report.source.projectRoot)||inside(report.source.projectRoot,r));report.inPlaceReason=report.inPlaceAllowed?'':'源工程保持只读，请先新建版本副本，再对副本分类';return report;}
 async function resolve(input){const report=await inspect(input);if(report.source.codeKind==='cpp')throw Error('当前分类执行支持纯蓝图工程；C++ 工程路径引用需要另行验证');const engine=(await engines()).items.find(e=>e.version===report.source.engineVersion&&e.installed);if(!engine)throw Error('未安装对应 UE '+report.source.engineVersion+'，无法读取真实类型或安全移动资产');return {report,source:report.source,editor:engine.editor};}
 async function stage(job,phase,progress){job.phase=phase;job.progress=progress;await save(job);}
 async function enablePython(descriptor){const original=await fs.readFile(descriptor),data=JSON.parse(decodeIni(original).text);for(const name of ['PythonScriptPlugin','EditorScriptingUtilities']){data.Plugins=(data.Plugins||[]).filter(p=>p.Name!==name);data.Plugins.push({Name:name,Enabled:true});}await fs.writeFile(descriptor,JSON.stringify(data,null,2));return original;}
 async function runPython(plan,descriptor,dir,mode,extra={}){
  const output=path.join(dir,mode+'-result.json'),request=path.join(dir,mode+'-request.json');await fs.writeFile(request,JSON.stringify({mode,descriptorPath:descriptor,protectedRoots:plan.executionProtectedRoots||[plan.source.projectRoot],allowedCacheProjectRoot:['scan','baseline'].includes(mode)?path.dirname(descriptor):undefined,output,...extra}));
  const result=await runner(plan.editor,[descriptor,'-run=pythonscript','-script='+path.join(resourceRoot,'fab-classify.py'),'-unattended','-nop4','-NoSound','-NullRHI','-utf8output','-abslog='+path.join(dir,mode+'.log')],{cwd:path.dirname(descriptor),env:{...process.env,UE_FAB_REQUEST:request},timeout:20*60000});
  let report;try{report=JSON.parse(await fs.readFile(output,'utf8'));}catch{throw Error('UE 未返回分类结果，请查看平台处理记录');}if(result.code!==0||!report.success)throw Error(report.error||'UE 分类处理失败');return report;
 }
 const job=id=>jobs.get(id)||{status:'missing',error:'分类任务不存在'};
 async function provenance(source,assets){const records=[];for(const filename of await fs.readdir(store).catch(()=>[])){if(!/^[a-f0-9-]{36}\.json$/i.test(filename))continue;let record;try{record=JSON.parse(await fs.readFile(path.join(store,filename),'utf8'));}catch{continue;}if(record.kind!=='fab-apply'||record.status!=='completed'||key(record.target||'')!==key(source.projectRoot))continue;let moves=[];try{moves=JSON.parse(await fs.readFile(path.join(store,record.id,'apply-request.json'),'utf8')).moves||[];}catch{}records.push({...record,moves});}return recoverFabOrigins(assets,records);}
 async function beginPreview(input,fresh){
  const resolved=await resolve(input.path),lock=key(resolved.source.descriptorPath);if(locks.has(lock))throw Error('该工程已有分类任务运行');locks.add(lock);
  const task={id:crypto.randomUUID(),kind:'fab-preview',status:'running',phase:'准备读取真实资源类型',progress:0,source:resolved.source,report:resolved.report,startedAt:new Date().toISOString()};jobs.set(task.id,task);await save(task);
  void(async()=>{try{
   const dir=path.join(store,task.id);await fs.mkdir(dir);const cache=await classificationTaskFolder(resolved.source,task.id);task.cacheDirectory=cache.dir;task.cacheBase=cache.base;
   if(fresh){if(!resolved.report.inPlaceAllowed||!resolved.source.cacheHostDescriptor||key(resolved.source.cacheHostDescriptor)===key(resolved.source.descriptorPath))throw Error('自动分类仅用于本次新建的衍生项目');if(await isEditorOpen(resolved.source.descriptorPath))throw Error('请先关闭新建工程的编辑器');const ownerFile=path.join(cache.dir,'owner.json'),owner=JSON.parse(await fs.readFile(ownerFile,'utf8'));await fs.writeFile(ownerFile,JSON.stringify({...owner,freshTarget:true,versionJobId:fresh.versionJobId}));resolved.executionProtectedRoots=await protectedRoots(resolved.source);}
   await stage(task,fresh?'直接读取刚创建的衍生项目':'创建临时检查副本',10);let snap=await snapshot(resolved.source.projectRoot);if(snap.files.some(f=>/__External(?:Actors|Objects)__/.test(f.relative)))throw Error('当前暂不支持分区地图的外部 Actor 目录，请保留地图目录结构');const work=fresh?resolved.source.projectRoot:path.join(task.cacheDirectory,'PreviewProject');if(!fresh)await copySnapshot(resolved.source.projectRoot,work,snap);const descriptor=path.join(work,path.basename(resolved.source.descriptorPath)),original=await enablePython(descriptor);
   let scan;try{await stage(task,'保存资源，校准引用基线',35);const classificationPreview={taskId:task.id,sourceDescriptor:resolved.source.descriptorPath,cacheRoot:resolved.source.classificationCacheRoot,freshTarget:!!fresh,versionJobId:fresh?.versionJobId},prepared=await runPython(resolved,descriptor,dir,'scan',{normalizeForClassification:true,classificationPreview});
   await stage(task,'重新加载工程，读取可靠依赖',60);const reopened=await runPython(resolved,descriptor,dir,'baseline',{classificationPreview});scan=classificationDependencyBaseline(prepared,reopened);task.dependencyBaseline=scan.dependencyBaseline;await fs.writeFile(path.join(dir,'dependency-baseline.json'),JSON.stringify(scan,null,2));}finally{if(fresh)await fs.writeFile(descriptor,original);}
   if(fresh){snap=await snapshot(resolved.source.projectRoot);task.reusedCreatedProject=true;}else if((await snapshot(resolved.source.projectRoot)).digest!==snap.digest)throw Error('读取期间源工程已变化，请重新生成分类清单');
   const history=await provenance(resolved.source,scan.assets),mode=input.mode||'group',modules={...history.modules,...input.modules},planned=planFabMoves({assets:scan.assets,root:resolved.source.name,mode,modules,origins:history.origins,language:input.language||'auto'}),plan={...resolved,...planned,snap,scan,mode,modules,id:task.id,expiresAt:Date.now()+30*60000};plans.set(plan.id,plan);
   task.plan={planId:plan.id,language:plan.language,root:plan.source.name,assets:plan.assets,moves:plan.moves,collisions:plan.collisions,preserved:plan.preserved,demoTargets:plan.demoTargets,groups:plan.groups,shared:plan.shared,notes:plan.notes,history:{recovered:history.recovered,records:history.records.length},mode:plan.mode};task.phase='分类清单已生成';task.progress=100;
  }catch(e){task.error=e.message;task.phase='分类清单生成失败';}finally{try{if(task.cacheBase)await removeClassificationData(task.cacheBase,task.id,'PreviewProject');task.previewCopyRemoved=true;}catch(e){task.cleanupWarning='临时预览副本未清理：'+e.message;}task.status=task.error?'failed':'completed';locks.delete(lock);task.finishedAt=new Date().toISOString();await save(task);}})();return {jobId:task.id};
 }
 async function apply({planId,inPlace=true}){
  const plan=plans.get(planId);if(!plan||plan.expiresAt<Date.now())throw Error('分类清单已过期，请重新预览');
  assertClassificationBaseline(plan.scan);
  let target=plan.source.projectRoot;
  if(inPlace){const roots=await protectedRoots(plan.source);if(roots.some(r=>inside(r,target)||inside(target,r)))throw Error('源工程保持只读，请先新建版本副本再分类');if(inside(target,root)||inside(root,target)&&!inside(path.join(root,'.local/checks'),target))throw Error('不能整理平台自身文件');if(await isEditorOpen(plan.source.descriptorPath))throw Error('请先关闭此工程的 UE 编辑器，再应用分类');plan.executionProtectedRoots=roots;
  }else throw Error('分类直接整理所选工程；请先使用新建版本项目创建副本');
  if((await snapshot(plan.source.projectRoot)).digest!==plan.snap.digest)throw Error('源工程已变化，请重新预览分类清单');
  const lock=key(plan.source.descriptorPath);if(locks.has(lock))throw Error('该工程已有任务运行');locks.add(lock);plans.delete(planId);
  const task={id:crypto.randomUUID(),kind:'fab-apply',status:'running',phase:'准备整理所选工程',progress:0,source:plan.source,target,inPlace,verificationOnly:plan.moves.length===0,backupCreated:false,startedAt:new Date().toISOString()};jobs.set(task.id,task);await save(task);
  void(async()=>{let descriptor,original,allowList,mutationStarted=false;const dir=path.join(store,task.id);try{
   await fs.mkdir(dir);if((await snapshot(target)).digest!==plan.snap.digest)throw Error('处理前所选工程发生变化，请重新读取并预览');if(await isEditorOpen(plan.source.descriptorPath))throw Error('编辑器已打开此工程，未执行分类');await stage(task,'检查完成，直接整理所选工程',10);
   descriptor=path.join(target,path.basename(plan.source.descriptorPath));mutationStarted=true;original=await enablePython(descriptor);
   await stage(task,'更新新工程配置中的资源路径',15);
   // Configuration paths are outside UObject reference repair. Replace complete UE paths only.
   const substitutions=[];for(const [oldPath,newPath] of Object.entries(plan.mapping)){if(oldPath===newPath)continue;const oldName=oldPath.split('/').pop(),newName=newPath.split('/').pop();substitutions.push([oldPath+'.'+oldName+'_C',newPath+'.'+newName+'_C'],[oldPath+'.'+oldName,newPath+'.'+newName],[oldPath,newPath]);}
   const replacements=new Map(substitutions),escaped=[...replacements.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),pattern=escaped.length?new RegExp('(?:'+escaped.join('|')+')(?![\\p{L}\\p{N}_/\\.])','gu'):null;
   for(const f of plan.snap.files.filter(f=>f.relative.startsWith('Config/')&&f.relative.toLowerCase().endsWith('.ini'))){const file=path.join(target,...f.relative.split('/')),format=decodeIni(await fs.readFile(file)),text=pattern?format.text.replace(pattern,match=>replacements.get(match)):format.text;if(text!==format.text)await fs.writeFile(file,encodeIni(text,format));}
   if(plan.moves.length){await stage(task,'UE 移动资产并更新引用',20);const applied=await runPython(plan,descriptor,dir,'apply',{moves:plan.moves});task.moved=applied.moved;}else{task.moved=0;await stage(task,'目录无需移动，核对当前工程的引用和蓝图',20);}
   await stage(task,'修复重定向器并保存引用',55);const fixed=await runner(plan.editor,[descriptor,'-run=ResavePackages','-fixupredirects','-projectonly','-unattended','-nop4','-NoSound','-NullRHI','-utf8output','-abslog='+path.join(dir,'references.log')],{cwd:target,timeout:20*60000});if(fixed.code!==0)throw Error('重定向器修复失败');
   await stage(task,'重新加载并核对资源与依赖',75);task.verification=await runPython(plan,descriptor,dir,'verify',{mapping:plan.mapping,before:plan.scan.assets,oldRedirectors:plan.scan.redirectors,dependencyBaseline:plan.scan.dependencyBaseline});
   const listName='FabBlueprintAllowList-'+task.id+'.txt',list=path.join(target,listName);allowList=list;await fs.writeFile(list,task.verification.blueprints.join('\n'),{flag:'wx'});if(task.verification.blueprints.length){const logFile=path.join(dir,'compile.log'),compiled=await runner(plan.editor,[descriptor,'-run=CompileAllBlueprints',...blueprintCompileScope(task.verification,listName),'-SimpleAssetList','-unattended','-nop4','-NullRHI','-NoSound','-abslog='+logFile],{cwd:target,timeout:20*60000}),log=await fs.readFile(logFile,'utf8'),summary=log.match(/Compiling Completed with (\d+) errors and (\d+) warnings and (\d+) blueprints that failed to load/);if(compiled.code!==0||!summary||Number(summary[1])||Number(summary[3])||(log.match(/Loading and Compiling:/g)||[]).length!==task.verification.blueprints.length)throw Error('分类后蓝图编译未通过');task.compiler={errors:Number(summary[1]),warnings:Number(summary[2]),compiled:task.verification.blueprints.length};}
   // Remove only genuinely empty directories; retain every other file and asset.
   async function prune(folder){for(const e of await fs.readdir(folder,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('新工程含链接，停止目录清理');if(e.isDirectory()){const child=path.join(folder,e.name);await prune(child);if(!(await fs.readdir(child)).length)await fs.rmdir(child);}}}await prune(path.join(target,'Content'));
   task.originMapping=Object.fromEntries(plan.scan.assets.map(a=>[plan.mapping[a.path],{path:plan.origins[a.path]||a.path,class:a.class}]));
   task.groupModules=plan.modules;
   task.progress=95;task.phase='清理临时设置';task.descriptorPath=descriptor;
  }catch(e){task.failureDetected=true;task.phase='分类未完成';task.error=e.message;}finally{
   if(allowList)await fs.unlink(allowList).catch(e=>{if(e.code!=='ENOENT'){task.failureDetected=true;task.error='清理编译临时文件失败：'+e.message;}});
   if(original&&descriptor)try{await fs.writeFile(descriptor,original);}catch(e){task.failureDetected=true;task.error='恢复工程配置失败：'+e.message;}
   if(task.failureDetected){task.partialChangesPossible=mutationStarted;task.phase=mutationStarted?'分类未完成，所选副本保留当前状态':'分类未开始';}
   if(task.failureDetected)task.status='failed';else {task.status='completed';task.progress=100;task.phase='所选工程分类完成';}
   locks.delete(lock);task.finishedAt=new Date().toISOString();await save(task);
  }})();return {jobId:task.id};
 }
 async function classifyCreatedVersion(version,{versionJobId,onPhase}={}){
  if(!/^[a-f0-9-]{36}$/i.test(versionJobId||''))throw Error('缺少本次版本创建任务');
  async function finish(id){let phase;for(;;){const task=job(id);if(task.phase!==phase){phase=task.phase;await onPhase?.(phase);}if(task.status!=='running')return task;await new Promise(r=>setTimeout(r,150));}}
  const preview=await finish((await beginPreview({path:version.descriptorPath,language:'en',mode:'group'},{versionJobId})).jobId);if(preview.status!=='completed')return preview;
  const result=await finish((await apply({planId:preview.plan.planId})).jobId);return {id:result.id,status:result.status,phase:result.phase,error:result.error,descriptorPath:result.descriptorPath,compiler:result.compiler,reusedCreatedProject:true,previewId:preview.id};
 }
 return {inspect,beginPreview,apply,classifyCreatedVersion,job,runningJobs:()=>[...jobs.values()].filter(j=>j.status==='running'),open:async id=>{const task=job(id);if(task.kind!=='fab-apply'||task.status!=='completed')throw Error('没有完成的分类工程');return launcher(task.descriptorPath);}};
}
