import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {runProcess} from '../server/ue-windows.mjs';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';
const root=path.resolve('.local/checks/s'+String(Date.now()).slice(-6)),source=path.join(root,'.local/checks/S'),descriptor=path.join(source,'P.uproject'),build=(await fs.readFile('.local/delivery-bridge-build-path.txt','utf8')).trim(),editor='C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
async function helper(install){const dest=path.resolve(source,'Plugins/DeliveryVerification');assert.ok(dest.startsWith(root+path.sep));if(install)await fs.cp(path.join(build,'Plugins/DeliveryVerification'),dest,{recursive:true,filter:p=>!/[\\/](Intermediate|Saved)[\\/]|\.(?:pdb|obj|pch|lib|exp|ilk)$/i.test(p)});else{await fs.rm(dest,{recursive:true});await fs.rmdir(path.dirname(dest));}}
async function python(name,code){const file=path.join(root,name+'.py'),log=path.join(root,name+'.log');await fs.writeFile(file,code);const r=await runProcess(editor,[descriptor,'-run=pythonscript','-script='+file,'-unattended','-nop4','-NullRHI','-NoSound','-utf8output','-abslog='+log],{cwd:source,timeout:180000});assert.equal(r.code,0,(await fs.readFile(log,'utf8')).slice(-7000));}
for(const d of ['Content','Config','Notes'])await fs.mkdir(path.join(source,d),{recursive:true});await fs.writeFile(path.join(source,'Notes/keep.txt'),'user file preserved');await helper(true);
await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,EngineAssociation:'5.3',Plugins:[{Name:'DeliveryVerification',Enabled:true},{Name:'PythonScriptPlugin',Enabled:true},{Name:'EditorScriptingUtilities',Enabled:true}]}));
await python('create',`import unreal,json
created=json.loads(unreal.DeliveryVerificationLibrary.create_hierarchy_fixture())
for p in created['assets']:assert unreal.EditorAssetLibrary.save_loaded_asset(unreal.load_asset(p),False)
t=unreal.AssetToolsHelpers.get_asset_tools()
m=t.create_asset('M_按钮','/Game',unreal.Material,unreal.MaterialFactoryNew())
assert m and unreal.EditorAssetLibrary.save_loaded_asset(m,False)
`);await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,EngineAssociation:'5.3'}));await helper(false);
async function originals(folder){const rows=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else rows.push([path.relative(folder,f),crypto.createHash('sha256').update(await fs.readFile(f)).digest('hex')]);}}for(const n of ['Config','Content','P.uproject']){const f=path.join(folder,n);if((await fs.stat(f)).isDirectory())await walk(f);else rows.push([n,crypto.createHash('sha256').update(await fs.readFile(f)).digest('hex')]);}return rows.sort();}
const before=await originals(source),names={'M_按钮':'M_Button','BP_手势父类':'BP_GestureBase','BP_手势角色_移动':'BP_GestureMovement','BP_手势角色_完整移动':'BP_GestureFullMovement','BPA_OpenXR手势R':'OpenXRGestureRight','BPA_OpenXR手势L':'OpenXRGestureLeft','BPC_控件交互组件_射线R':'WidgetInteractionRayRight','BPC_控件交互组件_射线L':'WidgetInteractionRayLeft','射线端点':'RayTip','UI显示组件':'UIDisplay','左手附加组件':'LeftHandExtra','默认':'Default'};
let modelCalls=0;const nativeCalls=[];
const api=createProjectDelivery({root,translationStatus:async()=>({available:true}),translator:async({entries})=>{modelCalls++;return entries.map(e=>{assert.ok(names[e.original],e.original);return {id:e.id,text:names[e.original],reason:'Isolated deterministic test',reviewRequired:false};});},runner:async(exe,args,opts)=>{if(opts.env?.UE_DELIVERY_EXPORT_REQUEST){const q=JSON.parse(await fs.readFile(opts.env.UE_DELIVERY_EXPORT_REQUEST));nativeCalls.push(q.verifyOnly?'verify':'apply');assert.notEqual(q.descriptorPath,descriptor);assert.deepEqual(await originals(source),before);}return runProcess(exe,args,opts);}});
async function wait(id){for(let i=0;i<2400;i++){const j=await api.job(id);if(j.status!=='running'){assert.equal(j.status,'completed',j.error);return j;}await new Promise(r=>setTimeout(r,100));}throw Error('Timed out');}
await api.configure(descriptor);const checked=await api.processingPreflight();assert.equal(checked.confirmationRequired,true);await assert.rejects(api.startTranslation({jobId:'not-created'}),/尚未确认/);assert.equal(modelCalls,0);
const confirmed=await api.processingPreflight({sourceConfirmation:{challenge:checked.challenge,descriptorPath:descriptor}}),token=confirmed.sourceAuthorization;
const copy=await wait((await api.refreshCopy()).jobId);await wait((await api.scanMembers(copy.id)).jobId);await wait((await api.startTranslation({jobId:copy.id,sourceAuthorization:token})).jobId);
const done=await wait((await api.applyTranslation({jobId:copy.id,sourceAuthorization:token})).jobId);assert.equal(done.sourceTranslation,true);assert.equal(done.verification.componentHierarchy.matched,true);assert.equal(done.verification.componentHierarchy.blueprints,3);assert.ok(done.verification.componentHierarchy.components>=7);assert.deepEqual(await originals(done.sourceBackup),before);assert.equal(await fs.readFile(path.join(source,'Notes/keep.txt'),'utf8'),'user file preserved');assert.ok(await fs.stat(path.join(source,'Content/M_Button.uasset')));
await helper(true);const clean=await fs.readFile(descriptor);await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,EngineAssociation:'5.3',Plugins:[{Name:'DeliveryVerification',Enabled:true},{Name:'PythonScriptPlugin',Enabled:true},{Name:'EditorScriptingUtilities',Enabled:true}]}));
await python('runtime',`import unreal,json
r=json.loads(unreal.DeliveryVerificationLibrary.verify_hierarchy_fixture())
assert all(r.values()),r
assert unreal.load_asset('/Game/M_Button')
with open(${JSON.stringify(path.join(root,'runtime.json'))},'w') as f:json.dump(r,f)
`);await fs.writeFile(descriptor,clean);await helper(false);
const restarted=createProjectDelivery({root});assert.equal((await restarted.status()).application.id,done.id);assert.equal((await restarted.processingPreflight()).confirmationRequired,true);assert.deepEqual(await originals(done.sourceBackup),before);
const report={root,nativeUE:'5.3',actualModelRequests:0,mockModelCalls:modelCalls,nativeCalls,sourceBackup:done.sourceBackup,verification:done.verification,runtime:JSON.parse(await fs.readFile(path.join(root,'runtime.json'))),checks:['original project changes only after explicit path confirmation and real UE validation','three inherited blueprints and component attachments survive translation and actual actor spawn','root-level asset renamed without double slash','source unchanged during staged UE application','old Config Content descriptor preserved byte-for-byte','extra user files and backup survive restart','new operation still asks for confirmation']};await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));await fs.writeFile('.local/last-source-translation-real-check.txt',root);console.log(JSON.stringify(report));
