import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const idPattern=/^[a-f0-9-]{36}$/i;
const key=value=>typeof value==='string'?path.resolve(value).toLowerCase():'';
const read=async file=>{try{return JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const exists=async file=>{try{await fs.lstat(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const within=(root,target)=>{const rel=path.relative(root,target);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
export async function archiveProjectTranslationCache({store,sourceDescriptor,copyId,runningJobs=[]}){
 if(!idPattern.test(copyId||'')||!path.isAbsolute(sourceDescriptor||''))throw Error('当前项目缓存标识无效');
 const projectKey=key(sourceDescriptor),root=await fs.realpath(store);if(key(root)!==key(store))throw Error('缓存目录经过链接，停止清理');
 const sameSource=record=>key(record?.source?.descriptorPath||record?.prepared?.current?.source?.descriptorPath)===projectKey;
 const records=[];for(const name of await fs.readdir(path.join(root,'jobs')).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){if(!/^[a-f0-9-]{36}\.json$/i.test(name))continue;const record=await read(path.join(root,'jobs',name));records.push({name,record});}
 const copies=new Set([copyId]);for(const {record} of records)if(record?.kind==='copy'&&sameSource(record)&&idPattern.test(record.id))copies.add(record.id);
 const matches=record=>record&&(sameSource(record)||copies.has(record.copyJobId));
 if(runningJobs.some(record=>matches(record)&&record.status==='running'))throw Error('当前项目有任务运行，请暂停翻译或等待处理结束后再清缓存');
 const translationIds=new Set(records.filter(({record})=>record?.kind==='translation'&&matches(record)).map(({record})=>record.id).filter(id=>idPattern.test(id))),selected=new Set();
 for(const id of copies){const relative='translation-cache/'+id;if(await exists(path.join(root,relative)))selected.add(relative);}
 for(const {name,record} of records)if(record?.kind==='translation'&&matches(record))selected.add('jobs/'+name);
 for(const filename of ['translation-result.json','latest-job.json']){const record=await read(path.join(root,filename));if(record?.kind==='translation'&&matches(record)){selected.add(filename);if(idPattern.test(record.id))translationIds.add(record.id);}}
 for(const id of translationIds)if(await exists(path.join(root,'translations',id)))selected.add('translations/'+id);
 for(const name of await fs.readdir(path.join(root,'external-tasks')).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){if(!/^[a-f0-9-]{36}\.json$/i.test(name))continue;const request=await read(path.join(root,'external-tasks',name));if(matches(request))selected.add('external-tasks/'+name);}
 const archiveId=crypto.randomUUID(),backup=path.join(root,'translation-cache-archives',archiveId),paths=[...selected];
 async function check(file){const st=await fs.lstat(file),actual=await fs.realpath(file);if(st.isSymbolicLink()||!within(root,actual)||key(actual)!==key(file))throw Error('缓存路径异常，停止清理：'+file);if(st.isDirectory())for(const name of await fs.readdir(file))await check(path.join(file,name));}
 for(const relative of paths)await check(path.join(root,relative));
 const moved=[];try{await fs.mkdir(backup,{recursive:true});if(!within(root,await fs.realpath(backup)))throw Error('备份目录超出缓存范围');for(const relative of paths){const target=path.join(backup,relative);await fs.mkdir(path.dirname(target),{recursive:true});await check(path.dirname(target));await fs.rename(path.join(root,relative),target);moved.push(relative);}
 const result={cleared:true,sourceDescriptor,copyIds:[...copies],translationIds:[...translationIds],archivedPaths:paths,backupDirectory:backup,clearedAt:new Date().toISOString(),preserved:['source-project','working-copy','scan','project-glossary','accounts','exported-projects']};await fs.writeFile(path.join(backup,'manifest.json'),JSON.stringify(result,null,2));return result;
 }catch(error){for(const relative of moved.reverse()){await fs.mkdir(path.dirname(path.join(root,relative)),{recursive:true});await fs.rename(path.join(backup,relative),path.join(root,relative));}throw error;}
}
