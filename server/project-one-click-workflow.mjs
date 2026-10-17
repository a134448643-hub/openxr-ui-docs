import {recordTaskStage} from './task-stage-monitor.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {probeProjectAvailability} from './project-library-refresh.mjs';

// Own the whole operation on the backend so navigation or renderer reloads do
// not create a second output or stop between classification and application.
export function createOneClickWorkflow({root,delivery,classifyExisting,isBusy=()=>false}){
 const folder=path.join(root,'.local/project-delivery-state/workflows'),tasks=new Map();let starting=false,latestId;
 const writes=new Map();const write=(task,{makeLatest=true,observedAt}={})=>{recordTaskStage(task,observedAt);const snapshot=structuredClone(task),previous=writes.get(task.id)||Promise.resolve(),pending=previous.catch(()=>{}).then(async()=>{await fs.mkdir(folder,{recursive:true});const file=path.join(folder,task.id+'.json'),temporary=file+'.tmp';await fs.writeFile(temporary,JSON.stringify(snapshot,null,2));for(let attempt=0;;attempt++){try{await fs.rename(temporary,file);break;}catch(e){if(!['EPERM','EBUSY'].includes(e.code)||attempt>=4)throw e;await new Promise(r=>setTimeout(r,30*(attempt+1)));}}if(makeLatest)latestId=task.id;});writes.set(task.id,pending);return pending;};
 const ready=(async()=>{for(const name of await fs.readdir(folder).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){if(!/^[a-f0-9-]{36}\.json$/i.test(name))continue;const task=JSON.parse(await fs.readFile(path.join(folder,name),'utf8'));if(task.status==='running'){task.status='interrupted';recordTaskStage(task,Date.parse(task.monitor?.updatedAt)||Date.now());task.phase='上次一键处理已中断，可继续已有副本';task.error='平台上次未记录完成；继续时重新核对已有副本和缓存，不重复新建项目';}tasks.set(task.id,task);if(!latestId||String(task.startedAt)>String(tasks.get(latestId)?.startedAt))latestId=task.id;}})();
 const active=()=>[...tasks.values()].find(t=>t.status==='running');
 async function reconcile(task){
  if(!task||task.status==='running'||!['failed','paused','interrupted','completed'].includes(task.status))return task;
  const descriptors=[task.source?.descriptorPath,task.descriptorPath,...(task.versions||[]).map(v=>v.descriptorPath)].filter(Boolean);
  if(!task.versions?.length&&task.versionJobId){const child=await delivery.job(task.versionJobId);for(const version of child?.versions||[])if(version.descriptorPath)descriptors.push(version.descriptorPath);}
  const result=await probeProjectAvailability(descriptors),missing=result.items.filter(p=>p.status==='missing');
  if(missing.length){task.previousStatus=task.status;task.status='obsolete';task.phase='关联项目已删除，旧任务已结束';task.error='请重新选择源项目并开始一键处理';task.missingProjects=missing.map(p=>p.descriptorPath);task.retiredAt=new Date().toISOString();await write(task,{makeLatest:false});}
  return task;
 }
 async function job(id){await ready;if(!/^[a-f0-9-]{36}$/i.test(id||''))throw Error('一键任务标识无效');const task=tasks.get(id);if(task&&task.status!=='running'){await writes.get(id);await reconcile(task);}return task||{status:'missing',error:'一键任务不存在'};}
 async function latest(){await ready;const task=await reconcile(active()||tasks.get(latestId));return task?.status==='obsolete'?null:task||null;}
 async function validate(options,profileId){
  if(!['zh-en','en-zh'].includes(options.direction)||!['off','conservative'].includes(options.layoutMode)||!['auto','en','zh-Hans'].includes(options.language))throw Error('一键处理选项无效');
  if(!Array.isArray(options.versions)||!options.versions.length||options.versions.length!==1||options.versions.some(v=>v!=='5.3'))throw Error('一键分类与翻译当前支持 UE 5.3；其他版本可单独新建，尚不支持译文应用');
  if(!(await delivery.engines()).items.some(e=>e.version==='5.3'&&e.installed))throw Error('未安装 UE 5.3，未新建或改写工程');
  const settings=await delivery.settings(),profile=settings.profiles.find(p=>p.id===settings.activeProfile);
  if(profile.provider!=='codex')throw Error('当前使用其他 AI 文件交接，需要导出并导入结果；一键自动处理请选择已登录的 Codex 配置');
  if(profileId&&profile.id!==profileId)throw Error('当前账号配置与此任务不同，请选回原配置再继续；未自动切换账号');
  const status=await delivery.translationStatus();if(!status.available)throw Error(status.message||'当前翻译账号不可用');return {id:profile.id,model:profile.model};
 }
 async function stage(task,phase,progress){task.phase=phase;task.progress=progress;await write(task);}
 async function follow(task,id,base,span){task.childJobId=id;await write(task);let signature,childStageIndex=0;for(;;){const child=await delivery.job(id);for(const entry of (child.monitor?.stages||[]).slice(childStageIndex)){childStageIndex++;if(entry.phase!==task.phase){task.phase=entry.phase;await write(task,{observedAt:Date.parse(entry.startedAt)||Date.now()});}}const next=JSON.stringify([child.phase,child.completed,child.total,child.status]);if(next!==signature){signature=next;task.childKind=child.kind;task.translation=child.kind==='translation'?{completed:child.completed,total:child.total,batchIndex:child.batchIndex,batchCount:child.batchCount}:null;await stage(task,child.phase,Math.min(99,base+(child.total?span*Math.min(1,child.completed/child.total):0)));}if(child.status!=='running'){if(child.chineseAudit||child.verification?.chineseAudit)task.chineseAudit=child.chineseAudit||child.verification.chineseAudit;if(child.status==='paused'){const e=Error('一键处理已暂停，译文已保存');e.paused=true;throw e;}if(!['completed','partial'].includes(child.status)){task.failureStage=child.failureStage||[...(child.monitor?.stages||[])].reverse().find(s=>s.status==='running')?.phase||child.phase;throw Error(child.error||child.phase||'子任务未完成');}return child;}await new Promise(r=>setTimeout(r,300));}}
 async function run(task){try{
  if(!task.versions?.length){
   await delivery.configure(task.source.descriptorPath);
   let copied;if(task.versionJobId){copied=await delivery.job(task.versionJobId);if(copied.status==='interrupted')throw Error('版本创建上次已中断，请先从项目库选择已保留的副本核对；未重复创建项目');}
   else{if(task.creationStarted)throw Error('复制启动记录不完整，请先核对已有副本；未重复创建项目');task.pipelineVersion=2;const plan=await delivery.previewVersionProjects({outputRoot:task.options.outputRoot,versions:task.options.versions,autoClassify:false});task.creationStarted=true;await write(task);task.versionJobId=(await delivery.createVersionProjects(plan.planId)).jobId;await write(task);}
   copied=await follow(task,task.versionJobId,0,20);task.versions=(copied.versions||[]).filter(v=>v.descriptorPath&&['completed','unverified'].includes(v.status)).map(v=>({...v}));await write(task);if(task.versions.length!==task.options.versions.length)throw Error(copied.error||'版本创建未完成，已保留已有副本');if(task.versions.some(v=>v.classificationError))throw Error(copied.error||task.versions.find(v=>v.classificationError).classificationError);
  }
  for(let i=0;i<task.versions.length;i++){
   const version=task.versions[i];task.versionIndex=i;task.descriptorPath=version.descriptorPath;if(version.processingState==='completed')continue;
   await delivery.configure(version.descriptorPath);if(!version.glossaryInherited){await delivery.glossary({terms:task.glossary.terms,naming:task.glossary.naming});version.glossaryInherited=true;await write(task);}
   if(task.pipelineVersion!==2&&version.processingState!=='classified'){
    // After a failed initial classification, retry only the existing output.
    version.classification=await classifyExisting(version.descriptorPath,phase=>stage(task,phase,20));if(version.classification.status!=='completed')throw Error(version.classification.error||'分类未完成');version.processingState='classified';await write(task);
   }
   const checked=await delivery.processingPreflight();if(checked.confirmationRequired)throw Error('目标不是本任务创建的衍生副本，未翻译源项目');
   const current=await delivery.status();if(current.application?.status==='completed'){version.applicationId=current.application.id;version.processingState='completed';await write(task);continue;}
   const copy=await follow(task,(await delivery.refreshCopy()).jobId,25,5);task.copyJobId=copy.id;
   const saved=await delivery.status();if(saved.latestScan?.copyJobId!==copy.id||saved.latestScan.status!=='completed'||saved.latestScan.result?.coverage?.eventParameters!==1||saved.latestScan.result?.coverage?.boundCallbacks!==1||saved.latestScan.result?.coverage?.renameReferences!==1||saved.latestScan.result?.coverage?.graphPrintText!==1||saved.latestScan.result?.coverage?.interfaceBindings!==1||saved.latestScan.result?.coverage?.mapEditorNames!==1||saved.latestScan.result?.coverage?.widgetAnimations!==1||saved.latestScan.result?.coverage?.translationCoverage!==2||saved.latestScan.result?.coverage?.nodeComments!==1||saved.latestScan.result?.coverage?.displayValues!==1||task.pipelineVersion===2&&!saved.latestScan.classificationPlan)await follow(task,(await delivery.scanMembers(copy.id,{classification:task.pipelineVersion===2})).jobId,30,10);
   if(task.pauseRequested){const e=Error('一键处理已暂停，当前副本与提取已保留');e.paused=true;throw e;}
   const translated=await follow(task,(await delivery.startTranslation({jobId:copy.id,direction:task.options.direction})).jobId,40,35);task.translationId=translated.id;
   if(task.pauseRequested){const e=Error('一键处理已暂停，译文已保存，尚未应用');e.paused=true;throw e;}
   const applied=await follow(task,(await delivery.applyTranslation({jobId:copy.id,direction:task.options.direction,language:task.options.language,layoutMode:task.options.layoutMode,reuseWorkingCopy:true,classification:task.pipelineVersion===2})).jobId,75,24);
   version.processingState='completed';version.applicationId=applied.id;version.workingCopyReused=!!applied.workingCopyReused;version.translationApplied=true;await write(task);
  }
  task.status='completed';task.progress=100;task.phase='一键处理完成 · 分类、翻译与应用验证通过';task.finishedAt=new Date().toISOString();delete task.error;
 }catch(e){task.status=e.paused?'paused':'failed';task.error=e.message;task.phase=e.paused?'一键处理已暂停':'一键处理未完成 · 已保留当前副本与缓存';task.finishedAt=new Date().toISOString();}finally{task.childKind=null;await write(task);}}
 async function start(input={}){await ready;if(starting||active()||isBusy())throw Error('请等待当前工程任务完成');starting=true;try{
  const options={outputRoot:input.outputRoot,versions:input.versions,direction:input.direction||'zh-en',language:input.language||'auto',layoutMode:input.layoutMode||'off'},profile=await validate(options),status=await delivery.status();if(!status.report?.source)throw Error('请先选择源项目');
  // Resolve destination and copy eligibility before returning a running task.
  await delivery.previewVersionProjects({...options,autoClassify:false});
  const task={id:crypto.randomUUID(),kind:'one-click',status:'running',phase:'准备新建副本、分类与翻译',progress:0,source:status.report.source,options,profileId:profile.id,model:profile.model,glossary:await delivery.glossary(),startedAt:new Date().toISOString(),versions:[],pauseRequested:false};tasks.set(task.id,task);await write(task);void run(task).catch(e=>{task.status='failed';task.phase='一键任务记录保存失败';task.error=e.message;});return {jobId:task.id};
 }finally{starting=false;}}
 async function resume(id){await ready;const task=await job(id);if(task.status==='obsolete')throw Error('关联项目已删除，不能继续旧任务；请重新选择源项目并开始一键处理');if(!['failed','paused','interrupted'].includes(task.status))throw Error('此一键任务不能继续');if(starting||active()||isBusy())throw Error('请等待当前工程任务完成');starting=true;try{await validate(task.options,task.profileId);task.status='running';task.pauseRequested=false;delete task.failureStage;delete task.error;await write(task);void run(task).catch(e=>{task.status='failed';task.phase='一键任务记录保存失败';task.error=e.message;});return {jobId:task.id};}finally{starting=false;}}
 async function pause(id){const task=await job(id);if(task.status!=='running')return task;task.pauseRequested=true;await write(task);if(task.childKind==='translation'&&task.childJobId)await delivery.pauseTranslation(task.childJobId);return {pauseRequested:true,status:task.status};}
 return {start,resume,pause,job,latest,runningJobs:()=>[...tasks.values()].filter(t=>t.status==='running')};
}
