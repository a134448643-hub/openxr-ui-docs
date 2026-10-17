import fs from 'node:fs/promises';
import path from 'node:path';
const key=p=>path.resolve(p).toLowerCase();
const within=(base,p)=>{const rel=path.relative(base,p);return rel!==''&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);};
const exists=async p=>{try{await fs.lstat(p);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
async function checked(base,p){const root=await fs.realpath(base),actual=await fs.realpath(p);if(!within(root,actual)||key(actual)!==key(p)||(await fs.lstat(p)).isSymbolicLink())throw Error('清理路径经过链接或超出允许范围：'+p);return actual;}
async function noLinks(p){const st=await fs.lstat(p);if(st.isSymbolicLink())throw Error('清理目录包含链接，保留：'+p);if(st.isDirectory())for(const item of await fs.readdir(p))await noLinks(path.join(p,item));}
async function bytes(p){const st=await fs.lstat(p);if(st.isSymbolicLink())return 0;if(!st.isDirectory())return st.size;let n=0;for(const e of await fs.readdir(p))n+=await bytes(path.join(p,e));return n;}
const versionCompare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return 0;};
const recoveryName=name=>/(?:backup|archive|recovery|rollback|config-before|startup-repair)/i.test(name);
async function hasRecoveryMaterials(folder){if(recoveryName(path.basename(folder)))return true;for(const entry of await fs.readdir(folder,{withFileTypes:true})){if(entry.isSymbolicLink())continue;if(entry.isDirectory()&&(recoveryName(entry.name)||await hasRecoveryMaterials(path.join(folder,entry.name))))return true;}return false;}

// Only build releases, timestamped test fixtures and preview copies are eligible.
// User projects, account homes, documents and actual rollback backups aren't candidates.
export async function planGeneratedCleanup({root,currentVersion,activePaths=[],minimumAgeMs=60*60000,now=Date.now(),checks=true,previews=true,allTestFolders=false,packagingWork=false}){
 root=await fs.realpath(root);const local=path.join(root,'.local'),candidates=[],kept=[];
 const active=activePaths.filter(p=>typeof p==='string'&&path.isAbsolute(p)).map(key),busy=p=>active.some(a=>a===key(p)||a.startsWith(key(p)+path.sep)||key(p).startsWith(a+path.sep));
 const add=async(base,p,reason)=>{if(!await exists(p))return;if(busy(p)){kept.push({path:p,reason:'正在使用'});return;}try{await checked(base,p);await noLinks(p);candidates.push({base,path:p,reason,bytes:await bytes(p)});}catch(e){kept.push({path:p,reason:e.message});}};
 const releases=path.join(local,'desktop-build/release'),versions=(await fs.readdir(releases).catch(()=>[])).filter(v=>/^\d+\.\d+\.\d+$/.test(v)).sort(versionCompare),keepVersions=new Set([currentVersion,versions.filter(v=>versionCompare(v,currentVersion)<0).at(-1)].filter(Boolean));
 for(const v of versions){const p=path.join(releases,v);if(keepVersions.has(v))kept.push({path:p,reason:'当前或上一版本'});else await add(releases,p,'旧桌面构建');}
 const checkRoot=path.join(local,'checks'),pinned=new Set();
 for(const name of await fs.readdir(local).catch(()=>[])){if(!/^last.*\.txt$|.*-path\.txt$/.test(name))continue;const text=await fs.readFile(path.join(local,name),'utf8').catch(()=>'');const values=[];try{const value=JSON.parse(text);const walk=v=>{if(typeof v==='string')values.push(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};walk(value);}catch{values.push(text.trim());}for(const p of values){if(!path.isAbsolute(p)||!within(checkRoot,path.resolve(p)))continue;pinned.add(path.relative(checkRoot,path.resolve(p)).split(path.sep)[0]);}}
 if(checks)for(const e of await fs.readdir(checkRoot,{withFileTypes:true}).catch(()=>[])){
  if(!e.isDirectory()||e.isSymbolicLink()||!allTestFolders&&!/^.+-\d{13}$/.test(e.name))continue;const fixture=path.join(checkRoot,e.name);if(busy(fixture)){kept.push({path:fixture,reason:'测试正在运行'});continue;}
  if(now-(await fs.stat(fixture)).mtimeMs<minimumAgeMs){kept.push({path:fixture,reason:'近期测试'});continue;}
  if(pinned.has(e.name)||await hasRecoveryMaterials(fixture)){
   kept.push({path:fixture,reason:'最新验证样本或配置修复备份'});
   async function caches(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isSymbolicLink())continue;if(item.isDirectory()){if(['Intermediate','Saved','DerivedDataCache','desktop-profile'].includes(item.name))await add(checkRoot,p,'保留样本中的生成缓存');else await caches(p);}else if(/\.(?:pdb|pch|obj|ilk)$/i.test(item.name))await add(checkRoot,p,'测试调试与编译中间文件');}}await caches(fixture);
  }else await add(checkRoot,fixture,'已完成的旧测试工程');
 }
 const fab=path.join(local,'fab-classification');if(previews)for(const name of await fs.readdir(fab).catch(()=>[])){if(!/^[a-f0-9-]{36}\.json$/i.test(name))continue;let job;try{job=JSON.parse(await fs.readFile(path.join(fab,name),'utf8'));}catch{continue;}if(job.kind!=='fab-preview'||job.status==='running')continue;await add(fab,path.join(fab,job.id,'PreviewProject'),'已结束的分类预览副本');}
 const packaging=path.join(local,'ue-manager/android-packaging');if(packagingWork)for(const entry of await fs.readdir(packaging,{withFileTypes:true}).catch(()=>[])){
  if(!entry.isDirectory()||entry.isSymbolicLink()||!/^([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i.test(entry.name))continue;
  let task;try{task=JSON.parse(await fs.readFile(path.join(packaging,entry.name,'status.json'),'utf8'));}catch{continue;}
  if(!['complete','failed'].includes(task.status))continue;
  await add(packaging,path.join(packaging,entry.name,'work'),'已结束打包的旧临时副本');
 }
 return {root,currentVersion,candidates,kept,totalBytes:candidates.reduce((n,r)=>n+r.bytes,0),plannedAt:new Date().toISOString()};
}

export async function applyGeneratedCleanup(plan,{activePaths=[]}={}){
 const root=await fs.realpath(plan.root),local=path.join(root,'.local'),allowed=['desktop-build/release','checks','fab-classification','ue-manager/android-packaging'].map(p=>path.join(local,p)),reportRoot=path.join(local,'check-reports'),active=activePaths.filter(p=>path.isAbsolute(p)).map(key),deleted=[],skipped=[];
 async function preserveReports(source,destination){async function walk(dir,rel=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name),r=path.join(rel,e.name);if(e.isSymbolicLink())continue;if(e.isDirectory()){if(['Content','Source','Plugins','Binaries','Intermediate','Saved','DerivedDataCache','desktop-profile','node_modules','.git','config-before'].includes(e.name))continue;await walk(p,r);}else if((/\.(png)$/i.test(e.name)||/(report|result|failure|verification|ready|editor).*\.(json|log|txt|md)$/i.test(e.name))&&!/(auth|credential|token)/i.test(r)){const st=await fs.stat(p);if(st.size>8*1024*1024)continue;const out=path.join(destination,r);await fs.mkdir(path.dirname(out),{recursive:true});if(e.name.endsWith('.log')&&st.size>256*1024){const data=await fs.readFile(p);await fs.writeFile(out,data.subarray(-256*1024));}else await fs.copyFile(p,out);}}}await walk(source);}
 for(const item of plan.candidates){try{
  if(!allowed.some(base=>key(base)===key(item.base))||!within(item.base,item.path))throw Error('不是允许清理的生成目录');
  if(active.some(p=>p===key(item.path)||p.startsWith(key(item.path)+path.sep)||key(item.path).startsWith(p+path.sep)))throw Error('目录正在使用，保留');
  if(!await exists(item.path))continue;const actual=await checked(item.base,item.path);await noLinks(actual);
  if(key(item.base)===key(path.join(local,'ue-manager/android-packaging'))){const relative=path.relative(item.base,item.path).split(path.sep);if(relative.length!==2||!/^([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i.test(relative[0])||relative[1]!=='work')throw Error('不是已登记的临时打包工程');const task=JSON.parse(await fs.readFile(path.join(item.base,relative[0],'status.json'),'utf8'));if(!['complete','failed'].includes(task.status))throw Error('打包任务尚未结束');}
  if(item.reason==='已完成的旧测试工程'){if(await hasRecoveryMaterials(actual))throw Error('发现恢复或备份材料，保留完整目录');await preserveReports(actual,path.join(reportRoot,path.basename(actual)));}
  await fs.rm(actual,{recursive:(await fs.stat(actual)).isDirectory()});deleted.push(item);
 }catch(e){skipped.push({...item,error:e.message});}}
 const report={deleted,skipped,freedBytes:deleted.reduce((n,r)=>n+r.bytes,0),completedAt:new Date().toISOString()};await fs.mkdir(reportRoot,{recursive:true});await fs.writeFile(path.join(reportRoot,'cleanup-'+Date.now()+'.json'),JSON.stringify(report,null,2));return report;
}

export async function removeFabPreview(store,taskId){if(!/^[a-f0-9-]{36}$/i.test(taskId))throw Error('预览任务标识无效');const folder=path.join(store,taskId,'PreviewProject');if(!await exists(folder))return;const actual=await checked(store,folder);await noLinks(actual);await fs.rm(actual,{recursive:true});}
