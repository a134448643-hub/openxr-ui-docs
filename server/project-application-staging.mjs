import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createReadStream} from 'node:fs';

const key=p=>path.resolve(p).toLowerCase();
const exists=async p=>{try{await fs.lstat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const same=(a,b)=>key(a)===key(b);
const contains=(a,b)=>{const rel=path.relative(a,b);return rel===''||!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export async function assertNoProjectLinks(root){
 if(!same(await fs.realpath(root),root)||(await fs.lstat(root)).isSymbolicLink())throw Error('工程路径包含链接：'+root);
 for(const item of await fs.readdir(root,{withFileTypes:true})){const p=path.join(root,item.name);if(item.isSymbolicLink())throw Error('工程包含链接：'+p);if(item.isDirectory())await assertNoProjectLinks(p);}
}
export async function assertNoLegacyProjectBackups(root){
 for(const item of await fs.readdir(root,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;}))if(item.isDirectory()){
  if(['BackupProject','FailedProject'].includes(item.name))throw Error('缓存含旧恢复备份，未清理；需单独处理旧备份');
  await assertNoLegacyProjectBackups(path.join(root,item.name));
 }
}
export async function removeEmptyContentDirectories(root){
 let removed=0;for(const item of await fs.readdir(root,{withFileTypes:true})){const p=path.join(root,item.name);if(item.isSymbolicLink())throw Error('内容目录包含链接');if(item.isDirectory()){removed+=await removeEmptyContentDirectories(p);if(!(await fs.readdir(p)).length){await fs.rmdir(p);removed++;}}}return removed;
}
async function entryDigest(root){
 const rows=[];async function walk(p,relative){const stat=await fs.lstat(p);if(stat.isSymbolicLink())throw Error('替换目录包含链接');if(stat.isDirectory()){rows.push([relative,'directory']);for(const item of (await fs.readdir(p)).sort())await walk(path.join(p,item),relative+'/'+item);}else if(stat.isFile())rows.push([relative,await hashFile(p)]);else throw Error('替换目录包含异常文件');}
 await walk(root,'');return crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
async function moveAbsent(from,to,rename=fs.rename){if(await exists(to))throw Error('替换目标已存在，未覆盖：'+to);await rename(from,to);}
function stagePaths(projectRoot,taskId){if(!/^[a-f0-9-]{36}$/i.test(taskId))throw Error('临时应用任务标识无效');const base=path.join(projectRoot,'.ue-translation-cache','a',taskId.slice(0,8));return {base,candidate:path.join(base,'n'),previous:path.join(base,'o')};}
async function validateTransaction(tx,{allowMissingCache=false}={}){
 const expected=stagePaths(tx.projectRoot,tx.taskId);
 if(tx.schemaVersion!==1||!/^[a-f0-9-]{36}$/i.test(tx.versionJobId||'')||!same(tx.base,expected.base)||!same(tx.candidate,expected.candidate)||!same(tx.previous,expected.previous)||path.dirname(tx.descriptorPath)!==tx.projectRoot||!Array.isArray(tx.entries)||tx.entries.length!==3||JSON.stringify([...tx.entries].sort())!==JSON.stringify(['Config','Content',path.basename(tx.descriptorPath)].sort()))throw Error('替换事务记录校验失败');
 await assertNoProjectLinks(tx.projectRoot);
 const ownerFile=path.join(tx.projectRoot,'.ue-translation-cache','owner.json');
 if(await exists(ownerFile)){const owner=JSON.parse(await fs.readFile(ownerFile,'utf8'));if(owner.kind!=='ue-project-translation-cache'||!same(owner.sourceDescriptor,tx.descriptorPath))throw Error('替换缓存归属校验失败');}
 else if(!allowMissingCache)throw Error('替换缓存归属记录缺失');
 if(!Array.isArray(tx.originalEntries)||tx.originalEntries.some(name=>typeof name!=='string'||path.basename(name)!==name||name==='.ue-translation-cache')||tx.entries.some(name=>!/^[a-f0-9]{64}$/.test(tx.digests?.[name]||'')))throw Error('替换事务原目录记录无效');
 if(tx.preserveSource&&JSON.stringify([...tx.originalEntries].sort())!==JSON.stringify([...tx.entries].sort()))throw Error('源项目事务只能替换 Config、Content 和工程描述');
}
export async function createApplicationStage({source,snapshot,taskId,workingCopy}){
 const paths=stagePaths(source.projectRoot,taskId),cache=path.join(source.projectRoot,'.ue-translation-cache');
 // Persistent caches may live in the source project; this local directory is
 // only the disposable transaction workspace, removed after successful delivery.
 try{await fs.mkdir(cache);await fs.writeFile(path.join(cache,'owner.json'),JSON.stringify({kind:'ue-project-translation-cache',sourceDescriptor:source.descriptorPath,schemaVersion:1,roles:['application']}),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 const owner=JSON.parse(await fs.readFile(path.join(cache,'owner.json'),'utf8'));
 if(owner.kind!=='ue-project-translation-cache'||!same(owner.sourceDescriptor,source.descriptorPath))throw Error('临时应用工程缓存归属不符');
 await assertNoProjectLinks(cache);await assertNoLegacyProjectBackups(cache);
 await fs.mkdir(path.dirname(paths.base),{recursive:true});await fs.mkdir(paths.base);
 if(workingCopy){
  const work=workingCopy.projectRoot,workCache=workingCopy.cacheRoot;
  if(!workCache||!same(path.dirname(work),path.join(workCache,'workspaces'))||!same(workingCopy.descriptorPath,path.join(work,path.basename(source.descriptorPath))))throw Error('提取工作副本不属于当前缓存');
  const workOwner=JSON.parse(await fs.readFile(path.join(workCache,'owner.json'),'utf8'));if(workOwner.kind!=='ue-project-translation-cache'||!same(workOwner.sourceDescriptor,source.descriptorPath))throw Error('提取工作副本缓存归属不符');await assertNoProjectLinks(work);
  // Revalidate every selected-project byte before consuming a scan copy. Only
  // platform-generated excluded directories may differ after extraction.
  for(const file of snapshot.files)if(await hashFile(path.join(work,file.relative))!==file.sha256)throw Error('提取副本内容变化，未复用');
  try{await fs.rename(work,paths.candidate);return {...source,projectRoot:paths.candidate,descriptorPath:path.join(paths.candidate,path.basename(source.descriptorPath)),stageBase:paths.base,workingCopyReused:true};}catch(e){if(e.code!=='EXDEV')throw e;}
 }
 await fs.mkdir(paths.candidate);
 for(const name of ['Config','Content'])await fs.mkdir(path.join(paths.candidate,name));
 for(const file of snapshot.files){const relative=file.relative;if(path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..')||relative.split(/[\\/]/).some(s=>s==='.ue-translation-cache'))throw Error('临时应用复制路径无效');const input=path.join(source.projectRoot,relative),output=path.join(paths.candidate,relative);await fs.mkdir(path.dirname(output),{recursive:true});await fs.copyFile(input,output,fs.constants.COPYFILE_EXCL);if(await hashFile(output)!==file.sha256)throw Error('临时应用工程复制校验失败：'+relative);}
 return {...source,projectRoot:paths.candidate,descriptorPath:path.join(paths.candidate,path.basename(source.descriptorPath)),stageBase:paths.base};
}
export async function prepareProjectReplacement({source,candidate,taskId,versionJobId=taskId,preserveSource=false,journalFile,writeJson}){
 const paths=stagePaths(source.projectRoot,taskId),entries=['Config','Content',path.basename(source.descriptorPath)];
 if(!same(candidate.projectRoot,paths.candidate))throw Error('临时应用工程路径不符');
 if(JSON.stringify((await fs.readdir(paths.candidate)).sort())!==JSON.stringify([...entries].sort()))throw Error('临时工程尚未完成交付清理');
 const tx={schemaVersion:1,taskId,versionJobId,preserveSource,projectRoot:source.projectRoot,descriptorPath:source.descriptorPath,...paths,entries,originalEntries:preserveSource?[...entries]:(await fs.readdir(source.projectRoot)).filter(n=>n!=='.ue-translation-cache'),digests:{},state:'ready'};
 for(const name of entries)tx.digests[name]=await entryDigest(path.join(paths.candidate,name));await validateTransaction(tx);await writeJson(journalFile,tx);return tx;
}
export async function verifyReplacedProject(tx){
 for(const name of tx.entries)if(!await exists(path.join(tx.projectRoot,name))||await entryDigest(path.join(tx.projectRoot,name))!==tx.digests[name])throw Error('替换后文件校验不一致：'+name);
}
export async function rollbackProjectReplacement(tx,{journalFile,writeJson,rename=fs.rename}){
 await validateTransaction(tx);if(!['replacing','installed'].includes(tx.state))throw Error('当前替换状态不能回退');
 // Presence of a staged entry tells us whether its rename completed, including
 // a crash between the filesystem operation and the next journal write.
 const installed=[];for(const name of tx.entries){const staged=path.join(tx.candidate,name),current=path.join(tx.projectRoot,name);if(!await exists(staged)&&await exists(current)){if(await entryDigest(current)!==tx.digests[name])throw Error('替换中断后文件又有修改，保留现场：'+current);installed.push({current,staged});}}
 for(const {current,staged} of installed)await moveAbsent(current,staged,rename);
 for(const name of tx.originalEntries){const old=path.join(tx.previous,name);if(await exists(old))await moveAbsent(old,path.join(tx.projectRoot,name),rename);}
 tx.state='rolled-back';await writeJson(journalFile,tx);
}
export async function commitProjectReplacement(tx,{journalFile,writeJson,rename=fs.rename}){
 await validateTransaction(tx);if(tx.state!=='ready')throw Error('替换事务状态无效');
 // Recheck the validated candidate before moving any selected-project data.
 for(const name of tx.entries)if(await entryDigest(path.join(tx.candidate,name))!==tx.digests[name])throw Error('临时工程验证后又有修改，未替换');
 const currentEntries=(await fs.readdir(tx.projectRoot)).filter(n=>tx.preserveSource?tx.entries.includes(n):n!=='.ue-translation-cache');
 if(JSON.stringify(currentEntries.sort())!==JSON.stringify([...tx.originalEntries].sort()))throw Error('所选项目目录已改变，未替换');
 await fs.mkdir(tx.previous);tx.state='replacing';await writeJson(journalFile,tx);
 try{
  for(const name of tx.originalEntries)await moveAbsent(path.join(tx.projectRoot,name),path.join(tx.previous,name),rename);
  for(const name of tx.entries)await moveAbsent(path.join(tx.candidate,name),path.join(tx.projectRoot,name),rename);
  tx.state='installed';await writeJson(journalFile,tx);await verifyReplacedProject(tx);await writeJson(journalFile,{...tx,state:'committed'});tx.state='committed';
 }catch(e){try{await rollbackProjectReplacement(tx,{journalFile,writeJson});}catch(recovery){throw Error(e.message+'；恢复替换前副本未完成，已保留现场：'+recovery.message);}throw e;}
 return {committed:true,retainedPath:tx.projectRoot};
}
export async function recoverProjectReplacements({descriptorPath,stateRoot,registered,readJson,writeJson}){
 const record=registered.slice().reverse().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||''))).find(r=>['version-copy','source-translation'].includes(r.kind)&&same(r.descriptorPath,descriptorPath));if(!record)return [];
 const sourceTranslation=record.kind==='source-translation';
 if(!sourceTranslation&&!path.isAbsolute(record.sourceDescriptor||''))throw Error('替换恢复缺少原工程保护记录');
 const selectedRoot=path.dirname(descriptorPath),originalRoot=sourceTranslation?null:path.dirname(record.sourceDescriptor),platformRoot=path.resolve(stateRoot,'../../..');
 if(originalRoot&&(contains(selectedRoot,originalRoot)||contains(originalRoot,selectedRoot))||contains(selectedRoot,platformRoot)||contains(platformRoot,selectedRoot)&&!contains(path.join(platformRoot,'.local/checks'),selectedRoot))throw Error('替换恢复目标路径保护校验失败');
 const recovered=[];
 for(const id of await fs.readdir(stateRoot).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
  if(!/^[a-f0-9-]{36}$/i.test(id))continue;const journalFile=path.join(stateRoot,id,'replacement.json'),tx=await readJson(journalFile,null);
  if(!tx||!same(tx.descriptorPath,descriptorPath)||tx.versionJobId!==record.jobId||!['replacing','installed','committed'].includes(tx.state))continue;
  if(tx.taskId!==id)throw Error('替换任务归属不符');
  if(Boolean(tx.preserveSource)!==sourceTranslation)throw Error('源项目替换恢复类型不符');
  if(tx.state==='committed'){await validateTransaction(tx,{allowMissingCache:!sourceTranslation});await verifyReplacedProject(tx);if(!sourceTranslation&&(await fs.readdir(tx.projectRoot)).some(name=>![...tx.entries,'.ue-translation-cache'].includes(name)))throw Error('替换完成后目录又有改动，未自动清理');recovered.push({id,committed:true,tx,journalFile});}
  else{await rollbackProjectReplacement(tx,{journalFile,writeJson});recovered.push({id,committed:false,tx,journalFile});}
 }
 return recovered;
}
