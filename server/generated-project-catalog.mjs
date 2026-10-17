import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {probeProjectAvailability,projectPathKey} from './project-library-refresh.mjs';

const key=value=>path.resolve(value).toLowerCase();
const terminal=new Set(['completed','partial','failed','interrupted']);
async function read(file,fallback){try{return JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}

// Only output identities are retained here. Assets and processing caches stay in the project.
export function createGeneratedProjectCatalog({file,write}){
 let queue=Promise.resolve();
 const serial=fn=>{const pending=queue.then(fn,fn);queue=pending.catch(()=>{});return pending;};
 function merge(records,job){
  if(!['version-copy','export'].includes(job?.kind)||!terminal.has(job.status))return records;
  const prior=new Map(records.filter(row=>row.jobId===job.id).map(row=>[key(row.descriptorPath),row]));
  records=records.filter(row=>row.jobId!==job.id);
  if(!['completed','partial'].includes(job.status))return records;
  for(const version of job.versions||[]){
   if(!['completed','unverified'].includes(version.status)||!path.isAbsolute(version.descriptorPath||'')||path.extname(version.descriptorPath).toLowerCase()!=='.uproject')continue;
   records.push({...prior.get(key(version.descriptorPath)),jobId:job.id,kind:job.kind,sourceDescriptor:job.source?.descriptorPath,descriptorPath:version.descriptorPath,version:version.version,status:version.status,...(version.processingState?{processingState:prior.get(key(version.descriptorPath))?.processingState==='completed'?'completed':prior.get(key(version.descriptorPath))?.processingState==='classified'&&version.processingState==='pending'?'classified':version.processingState}:{}),...(version.classification?{classification:version.classification}:{}),...(version.classificationError?{classificationError:version.classificationError}:{}),projectRole:'derived',createdAt:job.completedAt||job.startedAt||''});
  }
  return records;
 }
 async function record(job){if(!['version-copy','export'].includes(job?.kind)||!terminal.has(job.status))return;return serial(async()=>{const before=await read(file,[]),after=merge(before,job);if(JSON.stringify(before)!==JSON.stringify(after))await write(file,after);});}
 async function importStore(store){return serial(async()=>{
  const before=await read(file,[]);let after=before;
  for(const name of await fs.readdir(path.join(store,'jobs')).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
   if(!/^[a-f0-9-]{36}\.json$/i.test(name))continue;
   const job=await read(path.join(store,'jobs',name),null);after=merge(after,job);
  }
  if(JSON.stringify(before)!==JSON.stringify(after))await write(file,after);
 });}
 async function updateProcessing(descriptorPath,value){return serial(async()=>{const rows=await read(file,[]);if(!rows.some(r=>key(r.descriptorPath)===key(descriptorPath)))throw Error('副本不在创建记录中');await write(file,rows.map(r=>key(r.descriptorPath)===key(descriptorPath)?{...r,...value}:r));});}
 let listPending=null;
 async function list(){if(listPending)return listPending;listPending=(async()=>{await queue;const records=await read(file,[]),seen=new Set(),candidates=[];
  for(const row of records.filter(row=>row.kind!=='source-translation').slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))){
   const id=key(row.descriptorPath);if(seen.has(id))continue;
   seen.add(id);candidates.push(row);
  }
  // Validate output descriptors and their two top-level directories inside the
  // same bounded helper; unreachable historical outputs cannot block the server.
  const checked=await probeProjectAvailability(candidates.map(row=>row.descriptorPath),{validateProject:true}),available=new Set(checked.items.filter(row=>row.status==='available').map(row=>projectPathKey(row.descriptorPath)));
  return candidates.filter(row=>available.has(projectPathKey(row.descriptorPath))).map(row=>{const projectRoot=path.dirname(row.descriptorPath);return {...row,processingState:row.processingState||'pending',name:path.basename(projectRoot),projectRoot};});})();try{return await listPending;}finally{listPending=null;}
 }
 async function lookup(descriptorPath){await queue;const rows=await read(file,[]);return rows.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).find(row=>key(row.descriptorPath)===key(descriptorPath))||null;}
 async function registerSource(source){return serial(async()=>{const rows=await read(file,[]),prior=rows.find(r=>key(r.descriptorPath)===key(source.descriptorPath));if(prior)return prior;const row={kind:'source-translation',jobId:crypto.randomUUID(),descriptorPath:source.descriptorPath,version:source.engineVersion,processingState:'pending',createdAt:new Date().toISOString()};await write(file,[...rows,row]);return row;});}
 return {record,importStore,list,lookup,updateProcessing,registerSource};
}
