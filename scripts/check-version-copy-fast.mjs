import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';
const root=path.resolve('.local/checks/fast-copy-'+Date.now()),source=path.join(root,'S'),out=path.join(root,'Output'),engines=path.join(root,'Engines');
for(const folder of ['Content/中文','Config','Saved','Intermediate','DerivedDataCache','Binaries'])await fs.mkdir(path.join(source,folder),{recursive:true});
const descriptor=path.join(source,'P.uproject'),bytes=Buffer.from('\uFEFF'+JSON.stringify({EngineAssociation:'5.3',Plugins:[{Name:'OpenXR',Enabled:true}]}));await fs.writeFile(descriptor,bytes);
for(let i=0;i<300;i++)await fs.writeFile(path.join(source,'Content/中文/M_'+i+'.uasset'),Buffer.alloc(65536,i%255));
for(const folder of ['Saved','Intermediate','DerivedDataCache','Binaries'])await fs.writeFile(path.join(source,folder,'excluded.bin'),'exclude');
for(const version of ['5.3','5.4']){const f=path.join(engines,'UE_'+version,'Engine/Build/Build.version');await fs.mkdir(path.dirname(f),{recursive:true});await fs.writeFile(f,JSON.stringify({MajorVersion:5,MinorVersion:Number(version.slice(2)),PatchVersion:2}));}
let calls=0;const api=createProjectDelivery({root,engineRoots:[engines],runner:async()=>{calls++;throw Error('Version copying must never launch UE');}});await api.configure(source);
async function wait(id){for(let i=0;i<2000;i++){const j=await api.job(id);if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out');}
const started=performance.now(),plan=await api.previewVersionProjects({outputRoot:out,name:'P_Copy',versions:['5.3','5.4']});
const job=await wait((await api.createVersionProjects(plan.planId)).jobId);assert.equal(job.status,'completed',job.error);assert.equal(calls,0);assert.equal(job.copyStrategy,'direct');
assert.equal(job.versions[0].status,'completed');assert.equal(job.versions[1].status,'unverified');
assert.deepEqual(await fs.readFile(job.versions[0].descriptorPath),bytes);assert.equal(JSON.parse(await fs.readFile(job.versions[1].descriptorPath)).EngineAssociation,'5.4');
for(const v of job.versions){assert.equal(v.checks.copyIntegrity,true);assert.equal(v.checks.engineLoad,false);for(const folder of ['Saved','Intermediate','DerivedDataCache','Binaries','.ue-translation-cache'])await assert.rejects(fs.access(path.join(v.target,folder)));for(let i=0;i<300;i++){const f='Content/中文/M_'+i+'.uasset';assert.deepEqual(await fs.readFile(path.join(v.target,f)),await fs.readFile(path.join(source,f)));}}
assert.equal(path.basename(job.versions[0].target),'S_UE5.3');assert.equal(path.basename(job.versions[1].target),'S_UE5.4');
const elapsedMs=Math.round(performance.now()-started),p2=await api.previewVersionProjects({outputRoot:out,name:'P_Copy',versions:['5.3']});assert.match(p2.versionTargets[0].target,/_2$/);const occupied=p2.versionTargets[0].target;await fs.mkdir(occupied);await fs.writeFile(path.join(occupied,'keep.txt'),'existing');const second=await wait((await api.createVersionProjects(p2.planId)).jobId);assert.equal(second.status,'completed',second.error);assert.match(second.versions[0].target,/_3$/);assert.equal(await fs.readFile(path.join(occupied,'keep.txt'),'utf8'),'existing');
const p3=await api.previewVersionProjects({outputRoot:out,name:'P_Copy',versions:['5.3']});await fs.writeFile(path.join(source,'Content/中文/M_0.uasset'),'changed');await assert.rejects(api.createVersionProjects(p3.planId),/已变化/);
const workspaces=path.join(source,'.ue-translation-cache/workspaces');assert.deepEqual(await fs.readdir(workspaces).catch(error=>{if(error.code==='ENOENT')return [];throw error;}),[]);
const report={root,elapsedMs,bytesPerTarget:300*65536,targets:2,engineLaunches:calls,byteComparison:true,checks:['same-version descriptor preserved byte for byte including BOM','all copied asset bytes unchanged','installed engines do not trigger validation','higher target changes association only and remains unverified','no baseline copy or copied cache','preview race auto increments without overwrite','source change cancels creation']};await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
