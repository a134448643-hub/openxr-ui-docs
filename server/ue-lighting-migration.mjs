import fs from 'node:fs/promises';
import path from 'node:path';
import {createBuildWorkspacePath} from './ue-build-path.mjs';
import {powershell,runProcess} from './ue-windows.mjs';
import {lightingHash,planLightingGuidMigration,verifyLightingMigration} from './lighting-guid-migration.mjs';
const exists=async p=>{try{await fs.access(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const json=async(p,v)=>fs.writeFile(p,JSON.stringify(v,null,2));
let busy=false;
async function safeFile(root,file){const rel=path.relative(root,file);if(!rel||rel.startsWith('..')||path.isAbsolute(rel)||(await fs.realpath(file)).toLowerCase()!==file.toLowerCase())throw Error('光照文件路径不安全');return file;}
async function removeOwned(base,folder){const a=path.resolve(base),b=path.resolve(folder),rel=path.relative(a,b);if(!rel||rel.startsWith('..')||path.isAbsolute(rel)||(await fs.realpath(b)).toLowerCase()!==b.toLowerCase())throw Error('拒绝清理隔离目录以外的文件');await fs.rm(b,{recursive:true,force:true});}
async function mapsIn(dir){const result=[];if(!await exists(dir))return result;for(const e of await fs.readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('光照扫描目录含链接，已停止');if(e.name==='.ue-translation-cache')continue;const p=path.join(dir,e.name);if(e.isDirectory())result.push(...await mapsIn(p));else if(e.isFile()&&e.name.endsWith('.umap')&&await exists(p.replace(/\.umap$/,'_BuiltData.uasset')))result.push(p);}return result;}
async function assertClosed(descriptor,runner){
 const result=await powershell(`$ueEditors = @(Get-CimInstance Win32_Process -Filter "Name='UnrealEditor.exe' OR Name='UnrealEditor-Cmd.exe'"); foreach ($ueEditor in $ueEditors) { if (-not $ueEditor.CommandLine) { throw '无法确认 UE 编辑器关联工程' }; if ($ueEditor.CommandLine.IndexOf($env:UE_LIGHT_PROJECT,[StringComparison]::OrdinalIgnoreCase) -ge 0 -or $ueEditor.CommandLine.IndexOf($env:UE_LIGHT_PROJECT_ROOT,[StringComparison]::OrdinalIgnoreCase) -ge 0) { [Console]::Write('open'); break } }`,{UE_LIGHT_PROJECT:descriptor,UE_LIGHT_PROJECT_ROOT:path.dirname(descriptor)},runner);
 if(result==='open')throw Error('请保存并正常关闭当前工程的 UE 编辑器后修复光照；工程已保留');
}

export async function migrateProjectLighting({descriptorPath,sourceVersion,engine,resourceRoot,taskDir,toolRoot,runner=runProcess,onPhase=async()=>{}}){
 const descriptor=path.resolve(descriptorPath),root=path.dirname(descriptor),content=path.join(root,'Content');
 const result={status:'skipped',rebaked:false,sourceVersion,targetVersion:engine?.version,maps:[],engineLaunches:0};
 if(sourceVersion&&sourceVersion===engine?.version){result.reason='同版本复制，无需跨版本关联迁移';return result;}
 const maps=await mapsIn(content);if(!maps.length){result.reason='没有带独立烘焙数据的关卡';return result;}
 if(!engine?.installed||Number(engine.version)<5.5){result.status='unverified';result.reason='目标引擎未安装或尚不支持自动光照关联验证';return result;}
 if(busy)throw Error('另一个光照迁移任务正在运行');busy=true;
 let alias;
 try{
  await fs.mkdir(taskDir,{recursive:true});await assertClosed(descriptor,runner);
  const info=JSON.parse((await fs.readFile(descriptor,'utf8')).replace(/^\uFEFF/,''));
  if(info.EngineAssociation!==engine.version||info.Modules?.length)throw Error('光照迁移仅处理版本一致的纯蓝图工程');
  const resources=path.join(resourceRoot,'lighting'),sourceFiles=['Source/HostProject/HostProject.cpp','Source/HostProject/HostProject.Build.cs','Source/HostProjectEditor.Target.cs'];
  const sourceHash=lightingHash(Buffer.concat(await Promise.all(sourceFiles.map(p=>fs.readFile(path.join(resources,p))))));
  const engineBuildId=JSON.parse(await fs.readFile(path.join(engine.root,'Engine/Binaries/Win64/UnrealEditor.modules'),'utf8')).BuildId;
  const fingerprint=lightingHash(Buffer.from(sourceHash+'|'+engine.root+'|'+engine.actualVersion+'|'+engineBuildId)).slice(0,16);
  const host=path.join(toolRoot,'probe-'+engine.version+'-'+fingerprint);await fs.mkdir(host,{recursive:true});
  await fs.cp(path.join(resources,'Source'),path.join(host,'Source'),{recursive:true});
  let target=await fs.readFile(path.join(host,'Source/HostProjectEditor.Target.cs'),'utf8');target=target.replace('Unreal5_5','Unreal'+engine.version.replace('.','_'));await fs.writeFile(path.join(host,'Source/HostProjectEditor.Target.cs'),target);
  const plugins=(info.Plugins||[]).map(p=>({...p}));for(const name of ['PythonScriptPlugin','EditorScriptingUtilities']){const p=plugins.find(p=>p.Name===name);if(p)p.Enabled=true;else plugins.push({Name:name,Enabled:true});}
  await json(path.join(host,'HostProject.uproject'),{FileVersion:3,EngineAssociation:engine.version,Modules:[{Name:'HostProject',Type:'Editor',LoadingPhase:'Default'}],Plugins:plugins});
  // Config is copied only into this isolated, tiny probe host. Original assets
  // are mounted read-only by the native reader and are never saved by the probe.
  const hostConfig=path.join(host,'Config');if(await exists(hostConfig))await removeOwned(host,hostConfig);if(await exists(path.join(root,'Config')))await fs.cp(path.join(root,'Config'),hostConfig,{recursive:true});
  await fs.copyFile(path.join(resources,'probe-editor.py'),path.join(host,'probe-editor.py'));
  alias=await createBuildWorkspacePath(host);const nativeHost=alias.root,project=path.join(nativeHost,'HostProject.uproject');
  const binary=path.join(host,'Binaries/Win64/UnrealEditor-HostProject.dll'),prebuilt=path.join(resources,'Prebuilt',engine.actualVersion||engine.version);
  if(!await exists(binary)&&await exists(path.join(prebuilt,'manifest.json'))){
   const manifest=JSON.parse(await fs.readFile(path.join(prebuilt,'manifest.json'),'utf8'));
   const modules=JSON.parse(await fs.readFile(path.join(engine.root,'Engine/Binaries/Win64/UnrealEditor.modules'),'utf8'));
   const dll=await fs.readFile(path.join(prebuilt,'UnrealEditor-HostProject.dll'));
   if(manifest.sourceHash===sourceHash&&manifest.buildId===modules.BuildId&&manifest.dllSha256===lightingHash(dll)){
    await fs.mkdir(path.dirname(binary),{recursive:true});await fs.writeFile(binary,dll);
    await fs.copyFile(path.join(prebuilt,'UnrealEditor.modules'),path.join(host,'Binaries/Win64/UnrealEditor.modules'));
   }
  }
  if(!await exists(binary)){
   await onPhase('准备目标版本光照验证工具（首次运行）');
   const args=[path.join(engine.root,'Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.dll'),'HostProjectEditor','Win64','Development','-Project='+project,'-NoHotReload','-Log='+path.join(nativeHost,'build.log')];
   if(engine.version==='5.5'&&await exists('C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Tools/MSVC/14.38.33130/bin/Hostx64/x64/cl.exe')&&await exists('C:/Program Files (x86)/Windows Kits/10/Include/10.0.22621.0'))args.push('-CompilerVersion=14.38.33145','-WindowsSdkVersion=10.0.22621.0');
   const built=await runner('dotnet',args,{timeout:900000,maxOutput:6000});if(built.code!==0)throw Error('光照验证工具编译失败：'+built.stdout+ built.stderr);
   // Never retain gigabytes of probe PCH/object files after a successful build.
   if(await exists(path.join(host,'Intermediate')))await removeOwned(host,path.join(host,'Intermediate'));
  }
  async function probe(map,phase,candidate){
   const name=String(result.engineLaunches++).padStart(2,'0')+'-'+phase,reportFile=path.join(taskDir,name+'.json'),logFile=path.join(taskDir,name+'.log');
   const mapPackage='/Game/'+path.relative(content,map).replaceAll('\\','/').replace(/\.umap$/,'');
   await onPhase('核对光照 · '+path.basename(map,'.umap')+' · '+phase);
   const run=await runner(path.join(engine.root,'Engine/Binaries/Win64/UnrealEditor.exe'),[project,'-ExecutePythonScript='+path.join(nativeHost,'probe-editor.py'),'-RenderOffscreen','-unattended','-nosplash','-nosound','-nohmd','-nop4','-NoLiveCoding','-windowed','-ResX=1000','-ResY=700','-abslog='+logFile],{env:{...process.env,UE_LIGHT_CONTENT:content,UE_LIGHT_MAP:mapPackage,UE_LIGHT_REPORT:reportFile,UE_LIGHT_CANDIDATE:candidate||'',UE_LIGHT_OVERRIDE_ROOT:path.posix.dirname(mapPackage)+'/'},timeout:900000,maxOutput:4000});
   await json(path.join(taskDir,name+'-process.json'),run);
   if(!await exists(reportFile))throw Error('目标引擎未完成光照验证（退出码 '+run.code+'），原文件已保留：'+run.stderr);
   const report=JSON.parse(await fs.readFile(reportFile,'utf8')),log=await fs.readFile(logFile,'utf8');
   if(report.world!==mapPackage+'.'+path.basename(map,'.umap')||report.commandlet!==false||!log.includes('DumpUnbuiltLightInteractions')||/LogPython: Error:|Fatal error[:!]|Assertion failed:|=== Critical error:/.test(log))throw Error('关卡加载或真实编辑器光照检查失败');
   // Some UE 5.5 installations fast-fail only after normal editor shutdown and
   // the final log closure. Preserve this separately; never accept an in-engine
   // crash, incomplete dump, null RHI, or a missing/failing native result.
   if(run.code!==0){
    if(run.code!==3221226505||!log.includes('LogExit: Editor shut down')||!log.includes('LogExit: Exiting.')||!log.includes('Log file closed,'))throw Error('光照验证进程未正常完成（退出码 '+run.code+'）');
    (result.validationProcessWarnings??=[]).push({phase,map:mapPackage,exitCode:run.code,afterEditorShutdown:true});
   }
   return report;
  }
  for(const map of maps){
   const item={map:path.relative(root,map),status:'unverified'};result.maps.push(item);
   try{
    await safeFile(root,map);const before=await probe(map,'before');item.before=before.unbuiltInteractions;
    if(before.unbuiltInteractions===0){item.status='unchanged';item.after=0;continue;}
    const registryFile=map.replace(/\.umap$/,'_BuiltData.uasset');await safeFile(root,registryFile);
    const registry='/Game/'+path.relative(content,registryFile).replaceAll('\\','/').replace(/\.uasset$/,'');
    const registryPath=registry+'.'+path.basename(registryFile,'.uasset');
    if(before.registryExports.length!==1||before.registryExports[0].path!==registryPath)throw Error('含共享或分层光照数据，保留资源并提示人工检查');
    const original=await fs.readFile(registryFile),mapBytes=await fs.readFile(map),descriptorBytes=await fs.readFile(descriptor);
    const {output,plan}=planLightingGuidMigration(before,registryPath,original);if(!plan.changes.length)throw Error('未确认旧标识失配原因，不能自动修复');
    const mapDir=path.join(taskDir,'candidate-'+result.maps.length);await fs.mkdir(mapDir,{recursive:true});let candidateBytes=0;
    for(const e of await fs.readdir(path.dirname(map),{withFileTypes:true})){if(e.isSymbolicLink())throw Error('关卡目录含链接');if(e.isFile()){const p=path.join(path.dirname(map),e.name);candidateBytes+=(await fs.stat(p)).size;if(candidateBytes>512*1024*1024)throw Error('候选关卡目录过大，保留原资源');await fs.copyFile(p,path.join(mapDir,e.name));}}
    await fs.writeFile(path.join(mapDir,path.basename(registryFile)),output);await json(path.join(mapDir,'plan.json'),plan);
    const candidate=await probe(map,'candidate',mapDir);verifyLightingMigration(candidate,plan);
    await assertClosed(descriptor,runner);
    if(lightingHash(await fs.readFile(registryFile))!==plan.oldSha256||!mapBytes.equals(await fs.readFile(map))||!descriptorBytes.equals(await fs.readFile(descriptor)))throw Error('验证期间工程发生变化，未替换文件');
    const backupDir=path.join(taskDir,'backup',String(result.maps.length));await fs.mkdir(backupDir,{recursive:true});const backup=path.join(backupDir,path.basename(registryFile));
    await fs.copyFile(registryFile,backup,fs.constants.COPYFILE_EXCL);
    const stage=registryFile+'.lighting-'+path.basename(taskDir)+'.tmp';
    try{
     await fs.writeFile(stage,output,{flag:'wx'});
     await powershell(`[System.IO.File]::Replace($env:UE_LIGHT_STAGE,$env:UE_LIGHT_DEST,$env:UE_LIGHT_BACKUP,$false)`,{UE_LIGHT_STAGE:stage,UE_LIGHT_DEST:registryFile,UE_LIGHT_BACKUP:backup+'.atomic-original'},runner);
     const delivered=await probe(map,'delivered');verifyLightingMigration(delivered,plan);
     if(lightingHash(await fs.readFile(registryFile))!==plan.newSha256||!mapBytes.equals(await fs.readFile(map))||!descriptorBytes.equals(await fs.readFile(descriptor)))throw Error('交付字节复核失败');
     Object.assign(item,{status:'repaired',after:delivered.unbuiltInteractions,backup,plan,textureExportsByteIdentical:true});
    }catch(e){
     // Roll back only our own exact patched bytes. Never overwrite a concurrent
     // user save or try restoring while the user's editor has opened the map.
     await assertClosed(descriptor,runner);
     if(lightingHash(await fs.readFile(registryFile))===plan.newSha256){const rollback=registryFile+'.lighting-rollback.tmp';await fs.copyFile(backup,rollback,fs.constants.COPYFILE_EXCL);await powershell(`[System.IO.File]::Replace($env:UE_LIGHT_STAGE,$env:UE_LIGHT_DEST,$env:UE_LIGHT_BACKUP,$false)`,{UE_LIGHT_STAGE:rollback,UE_LIGHT_DEST:registryFile,UE_LIGHT_BACKUP:backup+'.rejected-patch'},runner);item.rolledBack=true;}
     else if(lightingHash(await fs.readFile(registryFile))!==plan.oldSha256)throw Error('工程被外部修改，未覆盖；原文件备份：'+backup+'；'+e.message);
     throw e;
    }finally{if(await exists(stage))await fs.unlink(stage);}
    await removeOwned(taskDir,mapDir);
   }catch(e){item.error=e.message;}
   await json(path.join(taskDir,'LightingReport.json'),result);
  }
  result.status=result.maps.some(m=>m.status==='unverified')?'unverified':result.maps.some(m=>m.status==='repaired')?'repaired':'unchanged';
  result.reason=result.status==='repaired'?'旧烘焙光照关联已迁移，候选及交付关卡均经目标编辑器验证，无需重新烘焙':result.status==='unchanged'?'目标编辑器未发现光照重建问题':'部分关卡未能安全自动修复，已保留资源并记录原因';
 }finally{try{if(alias)await alias.release();}finally{busy=false;}}
 await json(path.join(taskDir,'LightingReport.json'),result);return result;
}
