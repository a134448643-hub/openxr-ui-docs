import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';
import {createOneClickWorkflow} from '../server/project-one-click-workflow.mjs';
import {runProcess} from '../server/ue-windows.mjs';
const root=path.resolve('.local/checks/ci'+String(Date.now()).slice(-6)),source=path.join(root,'.local/checks/S'),seed=(await fs.readFile('.local/last-component-hierarchy-check.txt','utf8')).trim();
assert.ok(seed.startsWith(path.resolve('.local/checks')+path.sep));
for(const name of ['Config','Content','P.uproject'])await fs.cp(path.join(seed,'S',name),path.join(source,name),{recursive:true});
const names={'BP_手势父类':'BP_GestureBase','BP_手势角色_移动':'BP_GestureMovement','BP_手势角色_完整移动':'BP_GestureFullMovement','BPA_OpenXR手势R':'OpenXRGestureRight','BPA_OpenXR手势L':'OpenXRGestureLeft','BPC_控件交互组件_射线R':'WidgetInteractionRayRight','BPC_控件交互组件_射线L':'WidgetInteractionRayLeft','射线端点':'RayTip','UI显示组件':'UIDisplay','左手附加组件':'LeftHandExtra','默认':'Default'};
let corrupt='dependency',models=0;const native=[];
const api=createProjectDelivery({root,translationStatus:async()=>({available:true}),translator:async({entries})=>{models++;return entries.map(e=>{assert.ok(names[e.original],e.original);return {id:e.id,text:names[e.original],reason:'isolated deterministic translator',reviewRequired:false};});},runner:async(exe,args,options)=>{
 native.push(args.find(a=>a.startsWith('-run=')));
 if(options.env?.UE_DELIVERY_EXPORT_REQUEST){const q=JSON.parse(await fs.readFile(options.env.UE_DELIVERY_EXPORT_REQUEST));if(q.verifyOnly&&corrupt){
  if(corrupt==='dependency'){const before=JSON.parse(await fs.readFile(q.dependencyBaseline));before.assets[0].dependencies.push('/Game/RequiredReferenceLost');await fs.writeFile(q.dependencyBaseline,JSON.stringify(before));}
  else{const before=JSON.parse(await fs.readFile(q.hierarchyBaseline));const bp=before.blueprints.find(b=>b.nodes.length);bp.nodes[0].parent='injected-wrong-parent';await fs.writeFile(q.hierarchyBaseline,JSON.stringify(before));}
  corrupt=null;
 }}return runProcess(exe,args,options);
}});
await api.configure(path.join(source,'P.uproject'));
const workflow=createOneClickWorkflow({root,delivery:api,classifyExisting:async()=>{throw Error('unexpected separate classification');}});
async function wait(id){let phase;for(let n=0;n<3000;n++){const j=await workflow.job(id);if(phase!==j.phase){phase=j.phase;console.log(phase);}if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,100));}throw Error('timeout');}
async function digest(folder){const rows=[];for(const name of ['Content','Config','P.uproject']){async function walk(file,rel){const stat=await fs.stat(file);if(stat.isDirectory())for(const child of await fs.readdir(file))await walk(path.join(file,child),rel+'/'+child);else rows.push([rel,crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')]);}await walk(path.join(folder,name),name);}return rows.sort();}
const original=await digest(source),id=(await workflow.start({outputRoot:path.join(root,'.local/checks/O'),versions:['5.3'],direction:'zh-en'})).jobId;
let done=await wait(id);assert.equal(done.status,'failed');assert.match(done.error,/Asset references changed/);
const target=path.dirname(done.versions[0].descriptorPath);assert.deepEqual(await digest(target),original);assert.equal(models,1);
corrupt='hierarchy';await workflow.resume(id);done=await wait(id);assert.equal(done.status,'failed');assert.match(done.error,/组件层级验证失败/);assert.deepEqual(await digest(target),original);assert.equal(models,1);
await workflow.resume(id);done=await wait(id);assert.equal(done.status,'completed',done.error);assert.equal(models,1);assert.equal((await fs.readdir(path.join(root,'.local/checks/O'))).length,1);assert.deepEqual(await digest(source),original);
const application=(await api.status()).application;assert.equal(application.verification.componentHierarchy.blueprints,3);assert.ok(application.verification.componentHierarchy.components>=7);assert.equal(application.verification.dependencyVerification.matched,true);
const report={root,nativeUE:'5.3',actualModelRequests:0,mockRequests:models,nativeCalls:native.length,application:application.verification,checks:['combined classification and translation preserve three inheritance levels and nested components','injected missing dependency rejects before replacement','injected changed hierarchy rejects before replacement','each failure leaves selected copy byte-identical','resume reuses translations and only one output directory','source fixture bytes unchanged']};await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));await fs.writeFile('.local/last-combined-integrity-real.txt',root);console.log(JSON.stringify(report));
