import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),stamp=Date.now(),out=path.join(root,'.local/checks/platform-disk-audit-'+stamp);
const totals=new Map(),largest=[],warnings=[];let files=0,skippedLinks=0;
const queue=[root];
async function scan(dir){let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch(error){warnings.push({path:dir,error:error.code});return;}
 for(let offset=0;offset<entries.length;offset+=32)await Promise.all(entries.slice(offset,offset+32).map(async entry=>{
  const file=path.join(dir,entry.name);if(entry.isSymbolicLink()){skippedLinks++;return;}if(entry.isDirectory()){queue.push(file);return;}if(!entry.isFile())return;
  let stat;try{stat=await fs.stat(file);}catch(error){warnings.push({path:file,error:error.code});return;}files++;
  const relative=path.relative(root,file),parts=relative.split(path.sep);
  totals.set('.',(totals.get('.')||0)+stat.size);
  for(let depth=1;depth<=Math.min(parts.length-1,5);depth++){const key=parts.slice(0,depth).join('/');totals.set(key,(totals.get(key)||0)+stat.size);}
  if(stat.size>=100*1024*1024)largest.push({path:relative,bytes:stat.size,modifiedAt:stat.mtime.toISOString()});
 }));
}
while(queue.length){const batch=queue.splice(0,12);await Promise.all(batch.map(scan));}
const rows=[...totals].map(([path,bytes])=>({path,bytes,gib:Number((bytes/1024**3).toFixed(3))})).sort((a,b)=>b.bytes-a.bytes);
const report={root,measuredAt:new Date().toISOString(),totalBytes:totals.get('.'),files,skippedLinks,warnings,topLevel:rows.filter(row=>row.path!=='.'&&!row.path.includes('/')),local:rows.filter(row=>row.path.startsWith('.local/')&&row.path.split('/').length===2),largestDirectories:rows.slice(0,90),largestFiles:largest.sort((a,b)=>b.bytes-a.bytes).slice(0,60)};
await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,largestDirectories:undefined,largestFiles:report.largestFiles.slice(0,12),report:path.join(out,'report.json')}));
