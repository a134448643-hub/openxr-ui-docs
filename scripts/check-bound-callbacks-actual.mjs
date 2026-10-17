import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createUEProjectTools} from '../server/ue-project-tools.mjs';

// Use the real delivered assets and the production backend, without fixtures,
// substituted translators or edits to the user's source/delivery directories.
const root=process.cwd(),report=path.join(root,'.local/checks/bound-callbacks-0.1.107');
const donor=path.resolve('T:/UE/UEXM/cs/OpenXR_UI5.3_2');
const recorded=process.argv.includes('--record-completed')?JSON.parse(await fs.readFile(path.join(report,'active-actual.json'),'utf8')):null;
const isolated=recorded?.isolated||path.join(report,'fresh-'+Date.now()),source=path.join(isolated,'Source'),output=path.join(isolated,'Output');
await fs.mkdir(source,{recursive:true});
async function hashes(base){
 const files=[];
 async function walk(dir,prefix=''){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
   if(['.ue-translation-cache','Saved','Intermediate','DerivedDataCache'].includes(entry.name))continue;
   const file=path.join(dir,entry.name);
   if(entry.isDirectory())await walk(file,prefix+entry.name+'/');
   else files.push([prefix+entry.name,crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')]);
  }
 }
 await walk(base);return files.sort((a,b)=>a[0].localeCompare(b[0]));
}
const donorBefore=await hashes(donor);
if(!recorded){for(const dir of ['Config','Content'])await fs.cp(path.join(donor,dir),path.join(source,dir),{recursive:true});
await fs.copyFile(path.join(donor,'OpenXR_UI.uproject'),path.join(source,'OpenXR_UI.uproject'));}
assert.deepEqual(await hashes(source),donorBefore,'Real asset source copy differs from donor');
const sourceBefore=await hashes(source),tools=createUEProjectTools({root:path.join(isolated,'Platform')});
assert.equal(tools.runningJobs().length,0);
if(!recorded)await tools.delivery.configure(path.join(source,'OpenXR_UI.uproject'));
const start=recorded?{jobId:recorded.workflowId}:await tools.workflow.start({outputRoot:output,versions:['5.3'],direction:'zh-en',language:'auto',layoutMode:'off'});
await fs.writeFile(path.join(report,'active-actual.json'),JSON.stringify({isolated,workflowId:start.jobId},null,2));
let job,last;
for(;;){
 job=await tools.workflow.job(start.jobId);
 const progress={status:job.status,phase:job.phase,translation:job.translation};
 if(JSON.stringify(progress)!==last){last=JSON.stringify(progress);console.log(last);}
 if(job.status!=='running')break;
 await new Promise(resolve=>setTimeout(resolve,1000));
}
await fs.writeFile(path.join(report,'actual-workflow.json'),JSON.stringify(job,null,2));
assert.equal(job.status,'completed',job.error);
assert.deepEqual(await hashes(donor),donorBefore,'Existing user delivery was changed');
assert.deepEqual(await hashes(source),sourceBefore,'Read-only verification source was changed');
const application=await tools.delivery.job(job.versions[0].applicationId);
let translation=await tools.delivery.job(job.translationId);
if(!translation.entries){const cacheDir=path.join(isolated,'Platform/.local/project-caches');for(const folder of await fs.readdir(cacheDir)){const file=path.join(cacheDir,folder,'state/jobs',job.translationId+'.json');try{translation=JSON.parse(await fs.readFile(file,'utf8'));break;}catch(e){if(e.code!=='ENOENT')throw e;}}}
assert.equal(translation.id,job.translationId);
const verification=application.verification;
assert.equal(verification.renameBindings.callbacksRenamed,19);
assert.equal(verification.renameBindings.compiledCallbacksVerified,24);
assert.equal(verification.chineseAudit.translatable,0);
assert.equal(verification.chineseAudit.review,0);
assert.equal(verification.chineseAudit.preserved,0);
assert.equal(verification.chineseAudit.omitted,0);
const callbacks=translation.entries.filter(row=>row.kind==='组件绑定回调');
assert.equal(callbacks.length,19);
assert.ok(callbacks.every(row=>row.translationSkipped==='generated-callback'&&/^BndEvt__Delivery_[A-F0-9]{32}$/.test(row.translated)));
assert.equal(translation.total,0,'Internal names must not be submitted to a model');
const result={actualExecution:true,freshCache:true,simulated:false,isolated,output:job.versions[0].descriptorPath,applicationId:application.id,
 sourceUnchanged:true,existingDeliveryUnchanged:true,modelEntries:translation.total,callbackRows:callbacks.length,
 blueprintsVerified:verification.blueprintsVerified,interfaceBindings:verification.interfaceBindings,
 componentHierarchy:verification.componentHierarchy,renameBindings:verification.renameBindings,
 chineseAudit:Object.fromEntries(['assets','translatable','review','preserved','omitted'].map(key=>[key,verification.chineseAudit[key]]))};
await fs.writeFile(path.join(report,'actual-result.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
