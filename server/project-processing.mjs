import {recordTaskStage} from './task-stage-monitor.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createSourceTranslationConsent} from './source-translation-consent.mjs';
import {makeAssetExportPlan} from './ue-asset-naming.mjs';
import {normalizeSemanticRows,translationApplicationIssues} from './semantic-translation.mjs';
import {combinedClassificationPlan} from './combined-project-plan.mjs';
import {applyProjectCollisionChannels} from './project-collision-translation.mjs';
import {decodeIni,encodeIni} from './ue-ini.mjs';
import {removeTemporaryDeliveryPlugin,inspectDeliveryPlugins,installDeliveryBridge} from './project-delivery-cleanup.mjs';
import {runBlueprintLayout} from './blueprint-layout-runner.mjs';
import {checkEditorTranslationResult,assertNoLostComponentAttachments,assertNoInterfaceEventSubstitution} from './editor-translation-result.mjs';
import {createApplicationStage,prepareProjectReplacement,commitProjectReplacement,verifyReplacedProject,assertNoLegacyProjectBackups,removeEmptyContentDirectories} from './project-application-staging.mjs';
const key=p=>path.resolve(p).toLowerCase();
const inside=(a,b)=>{const r=path.relative(a,b);return r===''||!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r);};
async function noLinks(root){for(const e of await fs.readdir(root,{withFileTypes:true})){const file=path.join(root,e.name);if(e.isSymbolicLink())throw Error('工程包含链接，停止处理：'+file);if(e.isDirectory())await noLinks(file);}}
export async function cleanProcessedProject({source,protectedRoots}){
 const root=await fs.realpath(source.projectRoot);if(key(root)!==key(source.projectRoot)||protectedRoots.some(p=>inside(p,root)||inside(root,p)))throw Error('交付目录保护校验失败');
 await noLinks(root);await inspectDeliveryPlugins(root);const keep=new Set(['Config','Content',path.basename(source.descriptorPath)]),remove=[];
 for(const e of await fs.readdir(root,{withFileTypes:true})){if(keep.has(e.name))continue;const target=path.resolve(root,e.name);if(path.dirname(target)!==root)throw Error('清理路径超出所选副本');remove.push({target,directory:e.isDirectory()});}
 // Older recovery copies require their own explicit authorization; never delete them as cache.
 const cache=path.join(root,'.ue-translation-cache');await assertNoLegacyProjectBackups(cache);
 const emptyDirectoriesRemoved=await removeEmptyContentDirectories(path.join(root,'Content'));
 for(const item of remove)await fs.rm(item.target,{recursive:item.directory,force:false});
 return {removed:remove.map(p=>path.basename(p.target)),retained:[...keep],emptyDirectoriesRemoved};
}

export function createProjectProcessing({root,ready,catalog,resolveSource,inventory,engines,readJson,writeJson,getStore,jobs,locks,workingSource,glossary,runner,resourceRoot,openPreferences,editorLanguage,onCompleted,isEditorOpen=async()=>false,getInitializationError=()=>null}){
 const state=path.join(root,'.local/project-delivery-state/processing');
 async function resumeCandidate(source,registered){
  const id=registered.applicationId;if(!/^[a-f0-9-]{36}$/i.test(id||''))return null;
  const dir=path.join(state,id),previous=await readJson(path.join(dir,'job.json'),null);
  if(previous?.workingCopyConsumed||previous?.kind!=='project-apply'||previous.applicationMode!=='staged'||previous.versionJobId!==registered.jobId||previous.status!=='failed'||previous.replacementCommitted||previous.partialChangesPossible||key(previous.descriptorPath||'.')!==key(source.descriptorPath))return null;
  const request=await readJson(path.join(dir,'apply-request.json'),null);
  if(!request?.stagedApplication||request.stagedApplication.taskId!==id)return null;
  return {applicationId:id,jobId:previous.copyJobId,previous};
 }
 const consent=createSourceTranslationConsent();
 async function selection(){await ready;if(getInitializationError())throw getInitializationError();const config=await readJson(path.join(getStore(),'config.json'),{}),source=await resolveSource(config.sourceDescriptor),registered=await catalog.lookup(source.descriptorPath);return {source,registered,isSource:!registered||registered.kind!=='version-copy'||!registered.sourceDescriptor};}
 async function assertTranslationAuthorization(input={}){const selected=await selection();if(selected.isSource)consent.assert(selected.source,input.sourceAuthorization);return selected;}
 async function preflight(input={}){
  let {source,registered,isSource}=await selection();let sourceAuthorization=input.sourceAuthorization;
  if(isSource){if(input.sourceConfirmation)sourceAuthorization=consent.confirm(source,input.sourceConfirmation);else if(!sourceAuthorization)return consent.inspect(source);consent.assert(source,sourceAuthorization);}
  const all=await catalog.list();
  if(registered?.processingState==='completed'&&/^[a-f0-9-]{36}$/i.test(registered.applicationId||'')){
   const previous=await readJson(path.join(state,registered.applicationId,'job.json'),null);
   if(previous?.status==='completed'&&previous.versionJobId===registered.jobId&&previous.verification?.componentHierarchy?.matched!==true)throw Error('此副本由旧版应用完成，缺少组件层级一致性验证，不能作为新的翻译基线。请从原工程重新新建版本副本；未修改当前工程');
   if(previous?.status==='completed'&&previous.versionJobId===registered.jobId&&previous.verification?.interfaceBindings?.matched!==true){const savedScan=await readJson(path.join(getStore(),'latest-scan.json'),null);if(!savedScan||savedScan.result?.assets?.some(a=>a.assetRole==='blueprintInterface'))throw Error('此旧版副本缺少接口绑定一致性验证，可能已经丢失接口事件身份。请从原工程重新新建版本副本；未修改当前工程');}
  }
  if(/^[a-f0-9-]{36}$/i.test(registered?.applicationId||'')){const pending=await readJson(path.join(state,registered.applicationId,'replacement.json'),null);if(['replacing','installed','committed'].includes(pending?.state))throw Error('上次替换尚未完成，请正常退出并重新打开平台以恢复；未重新处理工程');}
  const protectedRoots=[];let ancestor=isSource?null:registered;const seen=new Set();while(ancestor?.sourceDescriptor){const original=await resolveSource(ancestor.sourceDescriptor);if(seen.has(key(original.descriptorPath)))throw Error('副本来源记录循环');seen.add(key(original.descriptorPath));protectedRoots.push(original.projectRoot);ancestor=all.find(p=>key(p.descriptorPath)===key(original.descriptorPath));}
  if(protectedRoots.some(p=>inside(p,source.projectRoot)||inside(source.projectRoot,p)))throw Error('所选副本与原工程路径重叠，停止处理');
  if(inside(source.projectRoot,root)||inside(root,source.projectRoot)&&!inside(path.join(root,'.local/checks'),source.projectRoot))throw Error('不能处理平台自身文件');
  if(key(await fs.realpath(source.projectRoot))!==key(source.projectRoot))throw Error('工程路径包含链接');await noLinks(source.projectRoot);
  if(source.codeKind!=='blueprint')throw Error('当前自动应用支持纯蓝图副本；不能删除 C++ 工程源码');
  const deliveryPlugins=await inspectDeliveryPlugins(source.projectRoot,{resourceRoot});
  const installed=(await engines()).items.find(e=>e.version===source.engineVersion&&e.installed);if(!installed)throw Error('未安装副本对应引擎，无法自动应用译文');if(source.engineVersion!=='5.3')throw Error('当前译文写入桥接仅支持 UE 5.3，其他版本尚未实装；未请求模型或写入工程');
  if(await isEditorOpen(source.descriptorPath))throw Error('请先关闭此副本的 UE 编辑器，再开始翻译');
  if(isSource)registered=await catalog.registerSource(source);
  return {source,registered,isSource,sourceAuthorization,protectedRoots,installed,deliveryPlugins,resume:await resumeCandidate(source,registered)};
 }
 async function apply({jobId,direction,layoutMode='off',language='auto',resumeApplicationId,sourceAuthorization,reuseWorkingCopy=false,classification}={}){
  const prepared=await preflight({sourceAuthorization});if(prepared.confirmationRequired)throw Error('尚未确认翻译源项目，未应用译文');if(!['off','conservative'].includes(layoutMode))throw Error('节点布局选项无效');const {source,protectedRoots,installed}=prepared,{current,source:working}=await workingSource(jobId),store=getStore();
  if(key(current.source.descriptorPath)!==key(source.descriptorPath))throw Error('译文对应的项目与当前副本不一致');
  const translated=await readJson(path.join(store,'translation-result.json'),null),scan=await readJson(path.join(store,'latest-scan.json'),null);
  if(translated?.copyJobId!==jobId||translated.status!=='completed'||direction&&direction!==translated.direction)throw Error('请完成当前副本的全部译文后应用');
  if(scan?.copyJobId!==jobId||scan.status!=='completed'||scan.result?.coverage?.assetSemantics!==3)throw Error('当前副本缺少可靠的资产类型提取');
  if(scan.result.coverage?.umgText===1&&scan.result.coverage.boundCallbacks!==1)throw Error('提取缓存尚未包含内部回调自动规范化，请重新提取后继续');if(scan.result.coverage?.umgText===1&&scan.result.coverage.renameReferences!==1)throw Error('提取缓存缺少折叠图及改名关联能力，请重新提取后继续');if(scan.result.coverage?.umgText===1&&scan.result.coverage.graphPrintText!==1)throw Error('提取缓存尚未包含打印字符串文本，请重新提取并补齐译文后应用');
  if(scan.result.coverage?.umgText===1&&scan.result.coverage.interfaceBindings!==1)throw Error('提取缓存缺少接口绑定关系，请重新提取并补齐译文后应用');if(scan.result.coverage?.umgText===1&&(scan.result.coverage.widgetAnimations!==1||scan.result.coverage.translationCoverage!==2))throw Error('提取缓存尚未包含控件动画及中文检测补齐，请重新提取后继续');if(scan.result.coverage?.umgText===1&&scan.result.coverage.mapEditorNames!==1)throw Error('提取缓存仍保留旧映射表名称规则，请重新提取后继续');if(scan.result.coverage?.umgText===1&&scan.result.coverage.nodeComments!==1)throw Error('提取缓存尚未包含全部节点备注，请重新提取后继续');if(scan.result.coverage?.umgText===1&&scan.result.coverage.displayValues!==1)throw Error('提取缓存尚未包含组件文字和打印来源，请重新提取后继续');
  const rows=normalizeSemanticRows(translated.entries,scan.result,(await glossary()).naming,translated.direction);
  for(const row of rows){const reasons=translationApplicationIssues(row);if(reasons.length)throw Error('译文需要处理后才能应用：'+row.original+(row.translated?' → '+row.translated:'')+'；'+reasons.join('；')+(row.owner?'；位置：'+row.owner:''));}
  classification??=Boolean(scan.classificationPlan);if(typeof classification!=='boolean'||classification&&!scan.classificationPlan||scan.classificationPlan&&!classification)throw Error('分类与翻译方案不一致，请继续原一键任务');
  const combined=classification?combinedClassificationPlan(scan.result,source.name):undefined;
  if(combined&&JSON.stringify(combined)!==JSON.stringify(scan.classificationPlan))throw Error('联合分类方案已变化，请重新提取');
  const moves=makeAssetExportPlan(rows,scan.result.assets,'Unused',{direction:translated.direction,policy:(await glossary()).naming,inPlace:true,classification:combined});
  const resume=prepared.resume?.jobId===jobId?prepared.resume:null;
  if(resumeApplicationId&&resume?.applicationId!==resumeApplicationId)throw Error('上次应用不满足安全续接条件，未改写工程');
  const snapshot=await inventory(source,{hashes:true});
  if(reuseWorkingCopy&&(await inventory(working,{hashes:true})).digest!==snapshot.digest)throw Error('提取工作副本与当前项目内容不一致，未复用或替换');
  if(snapshot.digest!==current.sourceDigest)throw Error('副本内容已改变，请重新提取并翻译后应用');
  await assertNoLegacyProjectBackups(path.join(source.projectRoot,'.ue-translation-cache'));
  const lock=key(source.projectRoot);if(locks.has(lock))throw Error('所选副本正在处理');locks.add(lock);
  const task={id:crypto.randomUUID(),kind:'project-apply',applicationMode:'staged',sourceTranslation:prepared.isSource,versionJobId:prepared.registered.jobId,direction:translated.direction,editorLanguage:editorLanguage(language,translated.direction),status:'running',phase:'准备临时应用工程',source,descriptorPath:source.descriptorPath,target:source.projectRoot,copyJobId:jobId,translationApplied:false,processingState:prepared.registered.processingState,resumedFrom:resume?.applicationId,protectedRoots,startedAt:new Date().toISOString()},dir=path.join(state,task.id);await fs.mkdir(dir,{recursive:true});
  const save=async(now)=>{recordTaskStage(task,now);jobs.set(task.id,structuredClone(task));await writeJson(path.join(dir,'job.json'),task);};await save();await catalog.updateProcessing(source.descriptorPath,{applicationId:task.id});if(prepared.isSource)consent.consume(sourceAuthorization);
  void(async()=>{let applicationSource;try{
   if(await isEditorOpen(source.descriptorPath))throw Error('所选副本的编辑器已打开，停止应用');
   const originals=await Promise.all(protectedRoots.map(async p=>({source:await resolveSource(p),data:await inventory(await resolveSource(p),{hashes:true})})));
   applicationSource=await createApplicationStage({source,snapshot,taskId:task.id,workingCopy:reuseWorkingCopy?{...working,cacheRoot:current.cacheRoot}:undefined});task.workingCopyReused=!!applicationSource.workingCopyReused;task.workingCopyConsumed=task.workingCopyReused;task.applicationDescriptor=applicationSource.descriptorPath;await save();
   const data=JSON.parse((await fs.readFile(applicationSource.descriptorPath,'utf8')).replace(/^\uFEFF/,''));data.Plugins=(data.Plugins||[]).filter(p=>!['BlueprintOperations','BlueprintTranslator','DeliveryTranslationBridge','PythonScriptPlugin','EditorScriptingUtilities'].includes(p.Name));const clean=structuredClone(data);
   const bridgeInstall=await installDeliveryBridge(applicationSource.projectRoot,{resourceRoot});task.temporaryPluginUpgraded=Boolean(bridgeInstall.upgraded);for(const Name of ['DeliveryTranslationBridge','PythonScriptPlugin','EditorScriptingUtilities'])data.Plugins.push({Name,Enabled:true});await fs.writeFile(applicationSource.descriptorPath,JSON.stringify(data,null,2));
   const script=path.join(dir,'apply.py');await fs.copyFile(path.join(resourceRoot,'export-translated-project.py'),script);for(const file of ['verify-startup-settings.py','verify-component-hierarchy.py','verify-interface-bindings.py','verify-rename-bindings.py','verify-chinese-residue.py','classification-assets.py'])await fs.copyFile(path.join(resourceRoot,file),path.join(dir,file));
   const run=async(verifyOnly,normalizeOnly=false)=>{const mode=normalizeOnly?'normalize':verifyOnly?'verify':'apply',request=path.join(dir,mode+'-request.json'),output=path.join(dir,mode+'-result.json');await writeJson(request,{descriptorPath:applicationSource.descriptorPath,sourceRoot:protectedRoots[0]||source.projectRoot,workingRoot:working.projectRoot,protectedRoots:[...protectedRoots,working.projectRoot,source.projectRoot],inPlace:true,allowedDescriptor:applicationSource.descriptorPath,stagedApplication:{taskId:task.id,selectedDescriptor:source.descriptorPath},direction:translated.direction,memberEntries:rows.filter(r=>r.group!=='assets'&&!r.settingsKind&&!r.preserveFunctionalMap),assetMoves:moves,combinedClassification:classification,normalizeOnly,normalizationFile:path.join(dir,'normalize-result.json'),dependencyBaseline:path.join(dir,'classification-baseline.json'),hierarchyBaseline:path.join(dir,'component-hierarchy-before.json'),interfaceBaseline:path.join(dir,'interface-bindings-before.json'),renameBaseline:path.join(dir,'rename-bindings-before.json'),progressFile:path.join(dir,'current-stage.json'),verifyOnly,output});const progressFile=path.join(dir,'current-stage.json');await fs.rm(progressFile,{force:true});let progressPending=Promise.resolve(),progressReading=false,progressIndex=0;const readProgress=async()=>{const progress=await readJson(progressFile,null);const events=progress?.history||[];for(const event of events.slice(progressIndex)){progressIndex++;if(event.phase&&task.phase!==event.phase){task.phase=event.phase;await save(Date.parse(event.updatedAt)||Date.now());}}};const poll=setInterval(()=>{if(progressReading)return;progressReading=true;progressPending=(async()=>{await readProgress();})().catch(()=>{}).finally(()=>{progressReading=false;});},500);let result;try{result=await runner(installed.editor,[applicationSource.descriptorPath,'-run=pythonscript','-script='+script,'-unattended','-nop4','-NoSound','-NullRHI','-utf8output','-abslog='+path.join(dir,mode+'.log')],{cwd:applicationSource.projectRoot,env:{...process.env,UE_DELIVERY_EXPORT_REQUEST:request,UE_DELIVERY_PROGRESS_FILE:progressFile},timeout:20*60000});}finally{clearInterval(poll);await progressPending;await readProgress().catch(()=>{});}const report=await readJson(output,null);if(report?.chineseAudit)task.chineseAudit=report.chineseAudit;if(normalizeOnly){assertNoInterfaceEventSubstitution(await fs.readFile(path.join(dir,'normalize.log'),'utf8').catch(()=>''),path.join(dir,'normalize.log'));assertNoLostComponentAttachments(await fs.readFile(path.join(dir,'normalize.log'),'utf8').catch(()=>''),path.join(dir,'normalize.log'));if(result.code!==0||!report?.success||!report.normalization?.completed||report.componentHierarchy?.matched!==true)throw Error(report?.error||'联合分类引用基线保存失败；日志：'+path.join(dir,'normalize.log'));return report;}return checkEditorTranslationResult({result,report,logFile:path.join(dir,mode+'.log'),verifyOnly,expectedAssets:moves.length,requireHierarchy:true,expectedBlueprints:scan.result.assets.filter(a=>a.assetClass.includes('Blueprint')).length});};
   if(classification){task.phase='保存临时工程，准备分类引用基线';await save();task.normalization=await run(false,true);task.classification={combined:true,assets:combined.assets,plannedMoves:combined.moves.length};await save();}
   task.phase=classification?'集中应用分类路径与译文':'在临时工程应用译文与重命名';await save();task.collision=await applyProjectCollisionChannels({root:applicationSource.projectRoot,files:snapshot.files,entries:rows});task.result=await run(false);await save();
   // The native bridge saves each renamed UObject at its new path, but can leave
   // its pre-rename package file on disk. Remove only tracked old files after all
   // destination files have been confirmed; never infer a stale file by its name.
   const newFiles=new Set(moves.map(m=>'Content/'+m.newPath.slice(6)+(m.assetClass==='World'?'.umap':'.uasset')));
   for(const file of newFiles)if(!(await fs.stat(path.join(applicationSource.projectRoot,file))).isFile())throw Error('重命名后资源未保存：'+file);
   for(const move of moves){const old='Content/'+move.oldPath.slice(6)+(move.assetClass==='World'?'.umap':'.uasset');if(newFiles.has(old))continue;const file=path.resolve(applicationSource.projectRoot,old);if(!inside(applicationSource.projectRoot,file))throw Error('旧资产路径超出临时工程');try{if((await fs.lstat(file)).isSymbolicLink())throw Error('旧资产文件包含链接');await fs.unlink(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
   const replacements=new Map();for(const move of moves){const oldName=path.posix.basename(move.oldPath);for(const [a,b] of [[move.oldPath+'.'+oldName+'_C',move.newPath+'.'+move.newName+'_C'],[move.oldPath+'.'+oldName,move.newPath+'.'+move.newName],[move.oldPath,move.newPath]])if(a!==b)replacements.set(a,b);}const escaped=[...replacements.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),pattern=escaped.length?new RegExp('(?:'+escaped.join('|')+')(?![\\p{L}\\p{N}_/.])','gu'):null;
   for(const file of snapshot.files.filter(f=>f.relative.startsWith('Config/')&&f.relative.endsWith('.ini'))){const target=path.join(applicationSource.projectRoot,file.relative),format=decodeIni(await fs.readFile(target));if(pattern)await fs.writeFile(target,encodeIni(format.text.replace(pattern,s=>replacements.get(s)),format));}
   task.phase='在临时工程修复引用并保存资源';await save();const fixed=await runner(installed.editor,[applicationSource.descriptorPath,'-run=ResavePackages','-fixupredirects','-projectonly','-unattended','-nop4','-NullRHI','-NoSound','-utf8output','-abslog='+path.join(dir,'references.log')],{cwd:applicationSource.projectRoot,timeout:20*60000});if(fixed.code!==0)throw Error('引用修复未通过（退出码 '+fixed.code+'）；日志：'+path.join(dir,'references.log'));
   assertNoInterfaceEventSubstitution(await fs.readFile(path.join(dir,'references.log'),'utf8').catch(()=>''),path.join(dir,'references.log'));
   assertNoLostComponentAttachments(await fs.readFile(path.join(dir,'references.log'),'utf8').catch(()=>''),path.join(dir,'references.log'));
   if(layoutMode==='conservative'){task.phase='整理节点布局';await save();task.layout=await runBlueprintLayout({descriptorPath:applicationSource.descriptorPath,protectedRoots:[...protectedRoots,working.projectRoot],editor:installed.editor,resourceRoot,taskDir:path.join(dir,'layout'),runner,editorLanguage:editorLanguage(language,translated.direction)});}
   task.phase='重新加载并核对引用、组件层级与蓝图';await save();task.verification=await run(true);const expectedBlueprints=scan.result.assets.filter(a=>a.assetClass.includes('Blueprint')).length;if(task.verification.blueprintsVerified!==expectedBlueprints)throw Error('重新加载的蓝图数量不一致：预期 '+expectedBlueprints+'，实际 '+task.verification.blueprintsVerified);if(scan.result.coverage?.displayValues===1&&!task.verification.chineseAudit)throw Error('缺少中文残留检查报告，未替换副本');if(task.verification.renameBindings?.matched!==true)throw Error('缺少改名关联一致性报告，未替换副本');if(task.verification.interfaceBindings?.matched!==true)throw Error('缺少接口绑定一致性报告，未替换副本');if(classification&&task.verification.dependencyVerification?.matched!==true)throw Error('缺少联合分类引用一致性报告，未替换副本');
   await fs.writeFile(applicationSource.descriptorPath,JSON.stringify(clean,null,2));await removeTemporaryDeliveryPlugin(applicationSource.projectRoot,{installed:true});
   // Verify the freshly saved asset inventory before any delivery cleanup.
   const actual=(await inventory(applicationSource)).files.filter(f=>/^Content\//.test(f.relative)&&/\.(uasset|umap)$/i.test(f.relative)).map(f=>f.relative).sort(),expected=moves.map(m=>'Content/'+m.newPath.slice(6)+(m.assetClass==='World'?'.umap':'.uasset')).sort();if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('应用后资源目录与译文方案不一致，未替换副本');
   for(const original of originals)if((await inventory(original.source,{hashes:true})).digest!==original.data.digest)throw Error('原工程校验变化，未清理副本');
   task.phase='清理临时交付工程';await save();task.stagedCleanup=await cleanProcessedProject({source:applicationSource,protectedRoots:[...protectedRoots,working.projectRoot]});
   if((await inventory(source,{hashes:true})).digest!==snapshot.digest)throw Error('所选副本在处理期间发生变化，未替换');
   if(await isEditorOpen(source.descriptorPath))throw Error('所选副本的编辑器已打开，未替换');
   const journalFile=path.join(dir,'replacement.json'),tx=await prepareProjectReplacement({source,candidate:applicationSource,taskId:task.id,versionJobId:prepared.registered.jobId,preserveSource:prepared.isSource,journalFile,writeJson});
   task.phase='替换当前版本副本';await save();task.replacement=await commitProjectReplacement(tx,{journalFile,writeJson});task.replacementCommitted=true;task.translationApplied=true;await save();await verifyReplacedProject(tx);
   await openPreferences.set(source.descriptorPath,{engineVersion:source.engineVersion,editorLanguage:editorLanguage(language,translated.direction),jobId:task.id});
   task.phase='清理交付目录';await save();task.cleanup=prepared.isSource?{preservedSourceFiles:true,backupDirectory:tx.previous}:await cleanProcessedProject({source,protectedRoots});if(prepared.isSource)task.sourceBackup=tx.previous;task.processingState='completed';task.phase='处理完成 · 译文已应用到当前项目';task.completedAt=new Date().toISOString();await catalog.updateProcessing(source.descriptorPath,{processingState:'completed',applicationId:task.id,completedAt:task.completedAt});await onCompleted?.(source);task.status='completed';tx.state='finalized';await writeJson(journalFile,tx);
  }catch(e){const tx=await readJson(path.join(dir,'replacement.json'),null),incomplete=['replacing','installed'].includes(tx?.state);task.status='failed';task.processingState=prepared.registered.processingState;task.failureStage=task.phase;task.phase=incomplete?'替换未完成，保留现场待恢复':task.replacementCommitted?'副本已替换，交付清理未完成':'临时应用未完成，当前副本保持不变';task.error=e.message;task.partialChangesPossible=Boolean(task.replacementCommitted||incomplete);await catalog.updateProcessing(source.descriptorPath,{processingState:prepared.registered.processingState,applicationId:task.id});}
  finally{locks.delete(lock);await save();}
  })();return {jobId:task.id};
 }
 async function result(id){return readJson(path.join(state,id,'job.json'),null);}
 return {preflight,apply,result,assertTranslationAuthorization,clearAuthorization:consent.clear};
}
