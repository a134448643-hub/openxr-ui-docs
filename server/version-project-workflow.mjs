import {unusedVersionTarget} from './version-output-names.mjs';
import {copyVersionProject} from './version-project-copy.mjs';
import {migrateProjectLighting} from './ue-lighting-migration.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const versions=['5.3','5.4','5.5','5.6','5.7','5.8'];
export function createVersionProjectWorkflow({ready,source,inventory,destination,plans,jobs,locks,persist,store,onVersionCopied,onVersionCreated,engines,resourceRoot,runner,lightingMigration=migrateProjectLighting}){
 async function preview({outputRoot,name,versions:requested,autoClassify=false}={}){
  await ready;const original=await source();name=path.basename(original.projectRoot);if(typeof autoClassify!=='boolean')throw Error('自动分类选项无效');if(autoClassify&&!onVersionCreated)throw Error('当前运行环境未连接自动分类流程');if(original.codeKind!=='blueprint')throw Error('当前版本工程创建支持纯蓝图项目');
  if(!Array.isArray(requested)||!requested.length||requested.some(v=>!versions.includes(v)||Number(v)<Number(original.engineVersion)))throw Error('请选择当前或更高的目标版本，不能自动降级');
  const targets=[];for(const version of [...new Set(requested)])targets.push({version,target:await unusedVersionTarget({source:original,outputRoot,name,version,destination}),mode:'copy-only'});
  const snap=await inventory(original),id=crypto.randomUUID();plans.set(id,{kind:'version-projects',planId:id,expiresAt:Date.now()+15*60000,source:original,outputRoot,name,snapshot:snap,versionTargets:targets,autoClassify});
  return {planId:id,source:original,versionTargets:targets,autoClassify,translationApplied:false,preserveNames:true,summary:snap.summary};
 }
 async function create(planId){
  const plan=plans.get(planId);if(plan?.kind!=='version-projects'||plan.expiresAt<Date.now())throw Error('版本创建方案已过期，请重新选择');
  if([...jobs.values()].some(j=>j.status==='running'))throw Error('请等待当前项目处理完成');
  for(const t of plan.versionTargets)t.target=await unusedVersionTarget({source:plan.source,outputRoot:plan.outputRoot,name:plan.name,version:t.version,destination});
  if((await inventory(plan.source)).digest!==plan.snapshot.digest)throw Error('原项目已变化，请重新选择');
  const key=plan.source.projectRoot.toLowerCase();if(locks.has(key))throw Error('项目正在处理');locks.add(key);plans.delete(planId);
  const task={id:crypto.randomUUID(),kind:'version-copy',status:'running',phase:'复制版本工程',source:plan.source,translationApplied:false,preserveNames:true,editorLanguage:'zh-Hans',versions:plan.versionTargets.map(t=>({...t,status:'pending'})),startedAt:new Date().toISOString(),copyStrategy:'direct',autoClassify:plan.autoClassify,engineLaunches:plan.autoClassify?undefined:0};jobs.set(task.id,task);await persist(task);
  const state=store();void(async()=>{try{
   for(let i=0;i<task.versions.length;i++){
    const target=task.versions[i];task.phase='复制 UE '+target.version+' 项目 · 保留原命名';await persist(task);
    try{
     target.target=await unusedVersionTarget({source:plan.source,outputRoot:plan.outputRoot,name:plan.name,version:target.version,destination});
     const result=await copyVersionProject({source:plan.source,snapshot:plan.snapshot,target:target.target,version:target.version,taskDir:path.join(state,'version-projects',task.id,target.version)});
     if((await inventory(plan.source)).digest!==plan.snapshot.digest)throw Error('复制期间原项目发生变化，当前副本未通过检查');
     task.versions[i]={...target,...result,processingState:'pending'};if(!task.descriptorPath)task.descriptorPath=result.descriptorPath;
     await onVersionCopied?.(task,task.versions[i]);
     if(plan.autoClassify){task.phase='自动分类 UE '+target.version+' 衍生项目';await persist(task);try{const classification=await onVersionCreated(task.versions[i],{source:plan.source,versionJobId:task.id,onPhase:async phase=>{task.phase=phase;await persist(task);}});task.versions[i].classification=classification;task.versions[i].processingState=classification.status==='completed'?'classified':'pending';if(classification.status==='completed')Object.assign(task.versions[i],{status:'completed',assetSavedVersion:target.version,reason:'自动分类、引用核对与蓝图验证通过；设备运行和打包尚未验证。',checks:{...task.versions[i].checks,engineLoad:true,assetLoad:true,blueprintCompile:true,upgradeSave:target.version!==plan.source.engineVersion,reopened:true}});else task.versions[i].classificationError=classification.error||'自动分类未完成';}catch(e){task.versions[i].classificationError=e.message;}}

     if(target.version!==plan.source.engineVersion&&engines&&resourceRoot){
      const version=task.versions[i],taskDir=path.join(state,'version-projects',task.id,target.version);
      try{
       const installed=(await engines()).items.find(e=>e.version===target.version);
       version.lighting=await lightingMigration({descriptorPath:version.descriptorPath,sourceVersion:plan.source.engineVersion,engine:installed,resourceRoot,runner,taskDir:path.join(taskDir,'lighting'),toolRoot:path.join(state,'lighting-tools'),onPhase:async phase=>{task.phase=phase;await persist(task);}});
       task.engineLaunches=(task.engineLaunches||0)+(version.lighting.engineLaunches||0);
       if(version.lighting.status==='unverified')version.lightingError=[version.lighting.reason,...(version.lighting.maps||[]).filter(m=>m.error).map(m=>m.map+'：'+m.error)].join('；');
       if(['repaired','unchanged'].includes(version.lighting.status))version.checks.lighting=true;
       version.reason+=' '+version.lighting.reason;
      }catch(e){version.lightingError=e.message;version.lighting={status:'unverified',reason:e.message};}
      await fs.writeFile(path.join(taskDir,'VersionReport.json'),JSON.stringify(version,null,2));
     }
    }catch(e){task.versions[i]={...target,status:'failed',partialOutputRetained:true,error:e.message};}await persist(task);
   }
   const ok=task.versions.filter(v=>['completed','unverified'].includes(v.status)).length;task.sourceUnchanged=ok===task.versions.length;
   const autoFailed=task.versions.some(v=>v.classificationError||v.lightingError);task.status=ok===task.versions.length&&!autoFailed?'completed':ok?'partial':'failed';const repaired=task.versions.some(v=>v.lighting?.status==='repaired');task.phase=task.status==='completed'?(repaired?'衍生项目已创建 · 光照关联已修复':task.autoClassify?'衍生项目已创建并完成分类':'衍生项目已创建，待处理'):task.status==='partial'?'衍生项目已创建，部分处理未完成':'版本工程创建失败';
   if(task.status!=='completed')task.error=task.versions.map(v=>v.error||v.classificationError||v.lightingError).filter(Boolean).join('；');
  }catch(e){task.status='failed';task.phase='版本工程创建失败';task.error=e.message;}finally{locks.delete(key);task.completedAt=new Date().toISOString();await persist(task);}})();return {jobId:task.id};
 }
 return {preview,create};
}
