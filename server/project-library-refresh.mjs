import path from 'node:path';import {spawn} from 'node:child_process';import {performance} from 'node:perf_hooks';
export const projectPathKey=value=>String(value||'').trim().replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase();
export function validProjectPath(value){return typeof value==='string'&&value.length<32768&&path.isAbsolute(value)&&path.extname(value).toLowerCase()==='.uproject';}
export async function probeProjectAvailability(paths,{timeoutMs=4000,concurrency=8,includeNetwork=false,validateProject=false,workerFile=path.join(import.meta.dirname,'project-availability-worker.mjs')}={}){
 const started=performance.now(),unique=[...new Map(paths.filter(validProjectPath).map(p=>[projectPathKey(p),p])).values()];
 if(!unique.length)return {items:[],durationMs:0,checked:0,statCalls:0,timedOut:false};
 return new Promise(resolve=>{
  const child=spawn(process.execPath,[workerFile],{windowsHide:true,stdio:['pipe','pipe','ignore'],env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}}),items=new Map();let buffer='',statCalls=0,timedOut=false,finished=false;
  const consume=line=>{try{const row=JSON.parse(line);if(row.type==='summary')statCalls=row.statCalls;else if(['available','missing','unavailable','invalid'].includes(row.status))items.set(projectPathKey(row.descriptorPath),row);}catch{}};
  child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{buffer+=chunk;let index;while((index=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,index));buffer=buffer.slice(index+1);}});
  const done=()=>{if(finished)return;finished=true;clearTimeout(timer);if(buffer.trim())consume(buffer);resolve({items:unique.map(descriptorPath=>items.get(projectPathKey(descriptorPath))||{descriptorPath,status:'unavailable',reason:timedOut?'位置检查超时，记录已保留':'未能核对位置，记录已保留'}),durationMs:Math.round(performance.now()-started),checked:items.size,statCalls,timedOut});};
  const timer=setTimeout(()=>{timedOut=true;child.kill();done();},timeoutMs);
  child.once('error',done);child.once('close',done);child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({paths:unique,includeNetwork,validateProject,concurrency:Math.max(1,Math.min(16,concurrency))}));
 });
}
