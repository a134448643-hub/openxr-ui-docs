import fs from 'node:fs/promises';import path from 'node:path';
export async function readProjectDiskUsage(projectRoot){
  const buckets={project:0,cache:0,saved:0,git:0},warnings=[];let files=0,skippedLinks=0;
  const bucketFor=parts=>parts.some(part=>['intermediate','deriveddatacache','.vs'].includes(part.toLowerCase()))?'cache':parts[0]?.toLowerCase()==='saved'?'saved':parts[0]?.toLowerCase()==='.git'?'git':'project';
  async function walk(dir,parts=[]){let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch(error){if(warnings.length<20)warnings.push({path:path.relative(projectRoot,dir),message:error.code});return;}for(const entry of entries){if(entry.isSymbolicLink()){skippedLinks++;continue;}const next=[...parts,entry.name],file=path.join(dir,entry.name);if(entry.isDirectory())await walk(file,next);else if(entry.isFile()){try{const stat=await fs.stat(file);buckets[bucketFor(next)]+=stat.size;files++;}catch(error){if(warnings.length<20)warnings.push({path:path.relative(projectRoot,file),message:error.code});}}}}
  await walk(projectRoot);return {projectRoot,buckets,totalBytes:Object.values(buckets).reduce((a,b)=>a+b,0),files,skippedLinks,warnings,partial:!!warnings.length,measuredAt:new Date().toISOString()};
}
