import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';
import {createGeneratedProjectCatalog} from '../server/generated-project-catalog.mjs';

const fixture=path.resolve('.local/checks/generated-projects-'+Date.now()),source=path.join(fixture,'Source'),out=path.join(fixture,'Output');
async function project(folder){for(const name of ['Content','Config'])await fs.mkdir(path.join(folder,name),{recursive:true});const descriptor=path.join(folder,'Tiny.uproject');await fs.writeFile(descriptor,JSON.stringify({EngineAssociation:'5.4'}));return descriptor;}
const descriptor=await project(source);await fs.writeFile(path.join(source,'Config/DefaultGame.ini'),'[Test]');await fs.writeFile(path.join(source,'Content/Test.uasset'),'isolated fixture');const service=createProjectDelivery({root:fixture,engineRoots:[]});await service.configure(descriptor);
async function wait(id){for(;;){const job=await service.job(id);if(job.status!=='running'){await new Promise(r=>setTimeout(r,30));return job;}await new Promise(r=>setTimeout(r,10));}}
for(let i=0;i<2;i++){const plan=await service.previewVersionProjects({outputRoot:out,name:'Tiny_Copy',versions:['5.4']});assert.equal((await wait((await service.createVersionProjects(plan.planId)).jobId)).status,'completed');}
let rows=await service.generatedProjects();assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.name).sort(),['Source','Source_2']);assert.ok(rows.every(r=>r.status==='completed'));
const state=service.store,catalog=path.join(fixture,'.local/project-delivery-state/generated-projects.json');
// Reproduce the old masking condition: an unrelated latest export remains in the same cache.
await fs.writeFile(path.join(state,'latest-export.json'),JSON.stringify({kind:'export',status:'failed',copyJobId:'old-copy'}));
assert.equal((await service.status()).generatedProjects.length,2);
// Migration from historical jobs, without relying on the single latest result.
await fs.unlink(catalog);const restarted=createProjectDelivery({root:fixture,engineRoots:[]});assert.equal((await restarted.status()).generatedProjects.length,2);
// Failed outputs must not become candidates, even when a descriptor exists.
const bad=await project(path.join(out,'Failed')),file=path.join(fixture,'failed-catalog.json'),registry=createGeneratedProjectCatalog({file,write:async(f,v)=>fs.writeFile(f,JSON.stringify(v))});
await registry.record({id:'failed',kind:'export',status:'failed',versions:[{version:'5.4',status:'completed',descriptorPath:bad}]});assert.equal((await registry.list()).length,0);
// Switching source and clearing its processing history does not discard delivered project identities.
const alternate=await project(path.join(fixture,'Alternate'));await restarted.configure(alternate);assert.equal((await restarted.generatedProjects()).length,2);
await fs.unlink(path.join(out,'Source','Tiny.uproject'));rows=await restarted.generatedProjects();assert.equal(rows.length,1);assert.equal(rows[0].name,'Source_2');
const fresh=createProjectDelivery({root:fixture,engineRoots:[]});assert.equal((await fresh.status()).generatedProjects.length,1);
assert.ok((await fs.stat(catalog)).size<4096);assert.equal(JSON.parse(await fs.readFile(descriptor)).EngineAssociation,'5.4');
const report={fixture,passed:['both repeated outputs listed with distinct folder names','unrelated latest export cannot mask version copies','historical jobs backfilled on restart','catalog survives source switching and restart','deleted and failed outputs excluded','only lightweight output identities retained; source untouched']};await fs.writeFile(path.join(fixture,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
