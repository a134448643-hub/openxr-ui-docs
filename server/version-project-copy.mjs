import fs from 'node:fs/promises';
import path from 'node:path';
const inside=(a,b)=>{const r=path.relative(a,b);return r===''||r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
export async function copyVersionProject({source,snapshot,target,version,taskDir}){
 const destination=path.resolve(target),sourceRoot=await fs.realpath(source.projectRoot);
 if(inside(sourceRoot,destination)||inside(destination,sourceRoot))throw Error('版本副本与原工程路径重叠');
 await fs.mkdir(path.dirname(destination),{recursive:true});const parent=await fs.realpath(path.dirname(destination));
 if(parent.toLowerCase()!==path.dirname(destination).toLowerCase()||inside(sourceRoot,parent))throw Error('输出目录包含链接或位于原工程内');
 await fs.mkdir(destination);
 for(const relative of snapshot.directories||['Config','Content']){
  if(path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>['..','.ue-translation-cache'].includes(p)))throw Error('目录复制清单路径无效');
  const input=path.join(sourceRoot,relative),stat=await fs.lstat(input);
  if(!stat.isDirectory()||stat.isSymbolicLink()||(await fs.realpath(input)).toLowerCase()!==input.toLowerCase())throw Error('原目录已变化：'+relative);
  await fs.mkdir(path.join(destination,relative),{recursive:true});
 }
 let next=0,stopped=false;
 const results=await Promise.allSettled(Array.from({length:Math.min(8,snapshot.files.length)},async()=>{
  try{while(!stopped&&next<snapshot.files.length){
   const file=snapshot.files[next++],relative=file.relative;
   if(path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>['..','.ue-translation-cache'].includes(p)))throw Error('复制清单路径无效');
   const input=path.join(sourceRoot,relative),output=path.join(destination,relative),before=await fs.lstat(input);
   if(!before.isFile()||before.isSymbolicLink()||(await fs.realpath(input)).toLowerCase()!==input.toLowerCase()||before.size!==file.bytes||before.mtimeMs!==file.modifiedAt)throw Error('原文件已变化：'+relative);
   await fs.mkdir(path.dirname(output),{recursive:true});await fs.copyFile(input,output,fs.constants.COPYFILE_EXCL);
   const [after,copied]=await Promise.all([fs.lstat(input),fs.lstat(output)]);
   if(after.size!==before.size||after.mtimeMs!==before.mtimeMs||copied.size!==file.bytes)throw Error('复制完整性检查失败：'+relative);
  }}catch(e){stopped=true;throw e;}
 }));const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason;
 const descriptorPath=path.join(destination,path.basename(source.descriptorPath)),sameVersion=version===source.engineVersion;
 if(!sameVersion){const descriptor=JSON.parse((await fs.readFile(descriptorPath,'utf8')).replace(/^\uFEFF/,''));if(Number(version)<Number(source.engineVersion))throw Error('不能自动降级资源');descriptor.EngineAssociation=version;await fs.writeFile(descriptorPath,JSON.stringify(descriptor,null,2));}
 const result={version,target:destination,descriptorPath,status:sameVersion?'completed':'unverified',mode:'copy-only',assetSavedVersion:source.engineVersion,reason:sameVersion?'同版本副本已复制，未重写资源；未执行引擎兼容性验证。':'副本已复制并设置目标版本关联；资源尚未升级保存，目标版本兼容性待验证。',checks:{copyIntegrity:true,engineLoad:false,assetLoad:false,blueprintCompile:false,upgradeSave:false,reopened:false,vrRuntime:false,packaging:false}};
 await fs.mkdir(taskDir,{recursive:true});await fs.writeFile(path.join(taskDir,'VersionReport.json'),JSON.stringify(result,null,2));return result;
}
