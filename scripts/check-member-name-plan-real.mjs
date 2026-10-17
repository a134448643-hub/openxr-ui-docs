import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {runProcess} from '../server/ue-windows.mjs';
import {normalizeSemanticRows} from '../server/semantic-translation.mjs';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';

const root=path.resolve('.local/checks/mc'+String(Date.now()).slice(-6)),descriptor=path.join(root,'P.uproject'),build=(await fs.readFile('.local/delivery-bridge-build-path.txt','utf8')).trim();
const editor='C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
await fs.mkdir(path.join(root,'Content'),{recursive:true});await fs.mkdir(path.join(root,'Config'),{recursive:true});
for(const plugin of ['DeliveryTranslationBridge','DeliveryVerification'])await fs.cp(plugin==='DeliveryVerification'?path.join(build,'Plugins',plugin):path.resolve('desktop/resources/delivery',plugin),path.join(root,'Plugins',plugin),{recursive:true,filter:p=>!/[\\/](Intermediate|Saved)[\\/]|\.(?:pdb|obj|pch|lib|exp|ilk)$/i.test(p)});
await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,EngineAssociation:'5.3',Plugins:[{Name:'DeliveryTranslationBridge',Enabled:true},{Name:'DeliveryVerification',Enabled:true},{Name:'PythonScriptPlugin',Enabled:true},{Name:'EditorScriptingUtilities',Enabled:true}]}));
async function python(name,code){const script=path.join(root,name+'.py'),log=path.join(root,name+'.log');await fs.writeFile(script,code);const result=await runProcess(editor,[descriptor,'-run=pythonscript','-script='+script,'-unattended','-nop4','-NullRHI','-NoSound','-utf8output','-abslog='+log],{cwd:root,timeout:180000});assert.equal(result.code,0,(await fs.readFile(log,'utf8')).slice(-6000));}
await python('prepare',`import unreal,json
created=json.loads(unreal.DeliveryVerificationLibrary.create_name_collision_fixture())
for p in created['assets']:
 assert unreal.EditorAssetLibrary.save_loaded_asset(unreal.load_asset(p),False)
def row(key,owner,kind,original,translated):
 return dict(entryKey=key,group='members',owner=owner,kind=kind,field='Name',original=original,elementName=original,translated=translated)
widget='/Game/Checks/WBP_NameCollision'
gesture='/Game/Checks/BP_Gesture'
rows=[row('variable',widget,'变量','按钮名称','ButtonName'),row('widget',widget,'UMG控件','UMG按钮名称','ButtonName'),row('event',gesture,'事件','更换手势模型事件','OnGestureModelChanged'),row('delegate',gesture,'事件分发器','更换手势模型时','OnGestureModelChanged'),row('consumer','/Game/Checks/BP_GestureConsumer','变量','GestureSource','GestureSource')]
rows[1]['widgetName']='UMG按钮名称'
assets=[dict(json.loads(unreal.DeliveryTranslationLibrary.read_asset_semantics(unreal.load_asset(p))),packageName=p) for p in created['assets']]
descriptor=unreal.Paths.convert_relative_path_to_full(unreal.Paths.get_project_file_path())
guard=json.loads(unreal.DeliveryTranslationLibrary.apply_editor_translations(json.dumps(dict(descriptorPath=descriptor,entries=rows),ensure_ascii=False)))
assert not guard['success'] and guard['applied']==0 and guard['phase']=='name-plan-validation',guard
assert len(guard['failures'])>=2,guard
# The rejected plan must leave original members and asset bytes untouched.
bp=unreal.load_asset(widget)
names=json.loads(unreal.DeliveryTranslationLibrary.read_editor_member_types(bp))['entries']
assert any(r['original']=='按钮名称' for r in names)
assert not any(r['original']=='ButtonName' for r in names)
with open(${JSON.stringify(path.join(root,'prepared.json'))},'w',encoding='utf-8') as f:json.dump(dict(rows=rows,assets=assets,guard=guard),f,ensure_ascii=False,indent=2)
`);
const prepared=JSON.parse(await fs.readFile(path.join(root,'prepared.json'))),rows=normalizeSemanticRows(prepared.rows,{entries:prepared.rows,assets:prepared.assets},{softMemberLength:80},'zh-en');
assert.equal(rows.find(r=>r.entryKey==='widget').translated,'ButtonNameWidget');assert.equal(rows.find(r=>r.entryKey==='event').translated,'OnGestureModelChangedEvent');
// Preserve the original fixture for the complete staged workflow below.
const flow=path.join(root,'f'),source=path.join(flow,'S');for(const folder of ['Content','Config'])await fs.cp(path.join(root,folder),path.join(source,folder),{recursive:true});await fs.writeFile(path.join(source,'P.uproject'),JSON.stringify({FileVersion:3,EngineAssociation:'5.3'}));
await fs.writeFile(path.join(root,'normalized.json'),JSON.stringify(rows,null,2));
await python('apply',`import unreal,json
with open(${JSON.stringify(path.join(root,'normalized.json'))},encoding='utf-8') as f:rows=json.load(f)
descriptor=unreal.Paths.convert_relative_path_to_full(unreal.Paths.get_project_file_path())
result=json.loads(unreal.DeliveryTranslationLibrary.apply_editor_translations(json.dumps(dict(descriptorPath=descriptor,entries=rows),ensure_ascii=False)))
with open(${JSON.stringify(path.join(root,'applied.json'))},'w',encoding='utf-8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
assert result['success'] and result['applied']==4,result
references=json.loads(unreal.DeliveryVerificationLibrary.verify_name_collision_fixture())
assert all(references.values()),references
for p in ['/Game/Checks/WBP_NameCollision','/Game/Checks/BP_Gesture','/Game/Checks/BP_GestureConsumer']:assert unreal.EditorAssetLibrary.save_loaded_asset(unreal.load_asset(p),False)
`);
await python('reopen',`import unreal,json
result=json.loads(unreal.DeliveryVerificationLibrary.verify_name_collision_fixture())
with open(${JSON.stringify(path.join(root,'reopened.json'))},'w') as f:json.dump(result,f,indent=2)
assert all(result.values()),result
`);
async function wait(api,id){for(let n=0;n<2400;n++){const job=await api.job(id);if(job.status!=='running'){assert.equal(job.status,'completed',job.error);return job;}await new Promise(r=>setTimeout(r,100));}throw Error('Staged workflow timed out');}
const initial=createProjectDelivery({root:flow,engineRoots:[]});await initial.configure(path.join(source,'P.uproject'));
const version=await wait(initial,(await initial.createVersionProjects((await initial.previewVersionProjects({outputRoot:path.join(flow,'.local/checks/O'),name:'P',versions:['5.3']})).planId)).jobId),selected=version.versions[0];
let mockCalls=0;const targets={'按钮名称':'ButtonName','UMG按钮名称':'ButtonName','更换手势模型事件':'OnGestureModelChanged','更换手势模型时':'OnGestureModelChanged','默认':'Default'};
const api=createProjectDelivery({root:flow,translationStatus:async()=>({available:true}),translator:async({entries})=>{mockCalls++;return entries.map(e=>{assert.ok(targets[e.original],e.original);return {id:e.id,text:targets[e.original],reason:'Preset collision regression fixture',reviewRequired:false};});}});
await api.configure(selected.descriptorPath);const copy=await wait(api,(await api.refreshCopy()).jobId),scan=await wait(api,(await api.scanMembers(copy.id)).jobId);assert.equal(scan.result.assets.length,3);
const translated=await wait(api,(await api.startTranslation({jobId:copy.id})).jobId);
assert.equal(translated.entries.find(r=>r.kind==='UMG控件'&&r.field==='Name'&&r.original==='UMG按钮名称').translated,'ButtonNameWidget');
assert.equal(translated.entries.find(r=>r.kind==='事件'&&r.field==='Name'&&r.original==='更换手势模型事件').translated,'OnGestureModelChangedEvent');
const applied=await wait(api,(await api.applyTranslation({jobId:copy.id})).jobId);
assert.equal(applied.replacementCommitted,true);assert.equal(applied.verification.blueprintsVerified,3);assert.equal(applied.descriptorPath,selected.descriptorPath);assert.deepEqual((await fs.readdir(selected.target)).sort(),['Config','Content','P.uproject']);
const report={success:true,root,nativeUE:'5.3',modelRequests:0,userProjectExecution:false,guard:prepared.guard,applied:JSON.parse(await fs.readFile(path.join(root,'applied.json'))),reopened:JSON.parse(await fs.readFile(path.join(root,'reopened.json'))),stagedWorkflow:{mockTranslator:true,mockCalls,actualModelRequests:0,result:applied.result,verification:applied.verification,replacementCommitted:true}};
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));await fs.writeFile('.local/last-member-name-real-check.txt',root);console.log(JSON.stringify(report));
