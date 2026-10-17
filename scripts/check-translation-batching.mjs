import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';
const root=path.resolve('.local/checks/batching-'+Date.now()),source=path.join(root,'.local/checks/S');
for(const name of ['Content/中文','Config'])await fs.mkdir(path.join(source,name),{recursive:true});
await fs.writeFile(path.join(source,'P.uproject'),JSON.stringify({EngineAssociation:'5.3'}));
await fs.writeFile(path.join(source,'Content/中文/M_按钮.uasset'),'isolated fixture bytes');
let calls=0,release;const gate=new Promise(r=>release=r),requests=[];
const api=createProjectDelivery({root,translationBatchLimits:{maxEntries:3},translationStatus:async()=>({available:true}),translator:async({entries})=>{
 calls++;requests.push(entries);
 const values=entries.map(e=>({id:e.id,text:e.original==='M_按钮'?'M_Button':e.original==='中文'?'Custom':'Value'+e.original.replace('变量',''),reason:'',reviewRequired:false}));
 if(calls===1)await gate;
 if(calls===2){const error=Error('isolated partial model failure');error.validTranslations=values.slice(0,1);throw error;}
 return values;
}});
async function wait(id){for(let n=0;n<2000;n++){const j=await api.job(id);if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,5));}throw Error('timeout');}
await api.configure(source);const version=await wait((await api.createVersionProjects((await api.previewVersionProjects({outputRoot:path.join(root,'.local/checks/O'),versions:['5.3']})).planId)).jobId);
assert.equal(version.status,'completed',version.error);await api.configure(version.descriptorPath);
const copy=await wait((await api.refreshCopy()).jobId);
const scan={id:'e545cb40-8136-4541-b645-bf7187c6821e',kind:'editor-scan',status:'completed',copyJobId:copy.id,result:{assets:[],entries:Array.from({length:7},(_,i)=>({entryKey:'v'+i,group:'members',kind:'变量',field:'Name',owner:'/Game/BP_Check',original:'变量'+i})),warnings:[]}};
await fs.writeFile(path.join(api.store,'latest-scan.json'),JSON.stringify(scan));
const first=(await api.startTranslation({jobId:copy.id})).jobId;while(!calls)await new Promise(r=>setTimeout(r,5));
await api.pauseTranslation(first);release();const paused=await wait(first);assert.equal(paused.status,'paused');assert.equal(paused.completed,3);assert.equal(calls,1);
assert.ok(requests[0].some(e=>e.group==='assets')&&requests[0].some(e=>e.group==='members'));
const second=await wait((await api.resumeTranslation(first)).jobId);assert.equal(second.status,'failed');assert.equal(second.completed,1);
const third=await wait((await api.startTranslation({jobId:copy.id})).jobId);assert.equal(third.status,'completed',third.error);
const accepted=new Set(requests[0].map(e=>e.original).concat(requests[1][0].original));assert.ok(requests.slice(2).flat().every(e=>!accepted.has(e.original)));
const before=calls;await wait((await api.startTranslation({jobId:copy.id})).jobId);assert.equal(calls,before);
assert.equal(await fs.readFile(path.join(source,'Content/中文/M_按钮.uasset'),'utf8'),'isolated fixture bytes');
console.log(JSON.stringify({root,actualModelRequests:0,mockRequests:calls,checks:['assets and members share bounded request','pause saves current mixed batch and sends no next batch','partial valid response saved on failure','resume requests only unresolved entries','completed cache avoids all model requests','original fixture bytes unchanged']}));
