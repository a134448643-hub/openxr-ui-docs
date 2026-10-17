import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';import {createOneClickWorkflow} from '../server/project-one-click-workflow.mjs';import {runProcess} from '../server/ue-windows.mjs';
const root=path.resolve('.local/checks/dv'+String(Date.now()).slice(-6)),source=path.join(root,'.local/checks/S'),descriptor=path.join(source,'P.uproject'),build=(await fs.readFile('.local/delivery-bridge-build-path.txt','utf8')).trim(),resources=path.resolve('desktop/resources/delivery'),editor='C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
for(const name of ['Config','Content'])await fs.mkdir(path.join(source,name),{recursive:true});
async function helpers(project){for(const name of ['DeliveryVerification','DeliveryTranslationBridge'])await fs.cp(name==='DeliveryVerification'?path.join(build,'Plugins',name):path.join(resources,name),path.join(project,'Plugins',name),{recursive:true,filter:p=>!/[\\/](Intermediate|Saved)[\\/]|\.(?:pdb|obj|pch|lib|exp|ilk)$/i.test(p)});}
async function python(project,name,code){const file=path.join(root,name+'.py'),log=path.join(root,name+'.log');await fs.writeFile(file,code);const r=await runProcess(editor,[project,'-run=pythonscript','-script='+file,'-unattended','-nop4','-NullRHI','-NoSound','-utf8output','-abslog='+log],{cwd:path.dirname(project),timeout:180000});assert.equal(r.code,0,(await fs.readFile(log,'utf8')).slice(-7000));}
async function removeHelpers(project){const target=path.resolve(project,'Plugins');assert.ok(target.startsWith(root+path.sep));await fs.rm(target,{recursive:true});}
await helpers(source);await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,EngineAssociation:'5.3',Plugins:[{Name:'DeliveryVerification',Enabled:true},{Name:'DeliveryTranslationBridge',Enabled:true},{Name:'PythonScriptPlugin',Enabled:true},{Name:'EditorScriptingUtilities',Enabled:true}]}));
await python(descriptor,'seed',`import unreal,json,copy
bp=unreal.DeliveryVerificationLibrary.create_print_text_fixture()
assert bp
assert unreal.EditorAssetLibrary.save_loaded_asset(bp,False)
before=json.loads(unreal.DeliveryVerificationLibrary.read_print_text_fixture(bp))
rows=json.loads(unreal.DeliveryTranslationLibrary.read_editor_text_content(bp))['entries']
printed=[r for r in rows if r['kind']=='节点打印文本']
assert len(printed)==7,printed
assert len({r['nodeGuid'] for r in printed})==6
descriptor=unreal.Paths.convert_relative_path_to_full(unreal.Paths.get_project_file_path())
stale=copy.deepcopy(printed[0]);stale.update(owner='/Game/Checks/BP_PrintFixture',original='stale original',translated='Do not write')
rejected=json.loads(unreal.DeliveryTranslationLibrary.apply_editor_translations(json.dumps({'descriptorPath':descriptor,'entries':[stale]},ensure_ascii=False)))
assert not rejected['success'] and any('changed' in f['reason'] for f in rejected['failures']),rejected
connected=next(n for n in before['nodes'] if n['function']=='PrintString' and any(p['name']=='InString' and p['links'] for p in n['pins']))
pin=next(p for p in connected['pins'] if p['name']=='InString')
forged=dict(printed[0],owner='/Game/Checks/BP_PrintFixture',nodeGuid=connected['guid'],graphName=connected['graph'],pinName='InString',original=pin['value'],translated='Do not disconnect')
blocked=json.loads(unreal.DeliveryTranslationLibrary.apply_editor_translations(json.dumps({'descriptorPath':descriptor,'entries':[forged]},ensure_ascii=False)))
assert not blocked['success'] and any('connected' in f['reason'] for f in blocked['failures']),blocked
display=next(r for r in rows if r['kind']=='组件显示文本')
for bad in [dict(display,original='stale component value'),dict(display,componentGuid='0'*32)]:
    bad.update(owner='/Game/Checks/BP_PrintFixture',translated='Do not write')
    rejected=json.loads(unreal.DeliveryTranslationLibrary.apply_editor_translations(json.dumps({'descriptorPath':descriptor,'entries':[bad]},ensure_ascii=False)))
    assert not rejected['success'],rejected
assert json.loads(unreal.DeliveryTranslationLibrary.read_editor_text_content(bp))['entries']==rows
assert json.loads(unreal.DeliveryVerificationLibrary.read_print_text_fixture(bp))==before
assert unreal.EditorAssetLibrary.save_loaded_asset(bp,False)
with open(${JSON.stringify(path.join(root,'before.json'))},'w',encoding='utf-8') as f:json.dump({'graph':before,'rows':printed,'staleRejected':True,'connectedRejected':True},f,ensure_ascii=False,indent=2)
`);
await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,EngineAssociation:'5.3'}));await removeHelpers(source);
async function hashes(project){const rows=[];async function walk(dir,rel=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['.ue-translation-cache','Saved','Intermediate','DerivedDataCache'].includes(e.name))continue;const file=path.join(dir,e.name);if(e.isDirectory())await walk(file,rel+e.name+'/');else rows.push([rel+e.name,crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')]);}}await walk(project);return rows.sort();}
const original=await hashes(source),dictionary={'Default button label':'默认按钮名称','Gesture button':'手势按钮','Palm button':'手掌按钮','Literal print message':'固定打印内容','Status: ':'状态：','Ready':'就绪','Runtime assigned message':'运行时赋值文字'};let modelCalls=0;const sent=[],native=[];
const api=createProjectDelivery({root,translationStatus:async()=>({available:true}),translator:async({entries})=>{modelCalls++;return entries.map(e=>{sent.push(e.original);return {id:e.id,text:e.field==='Name'?e.original:dictionary[e.original]||e.original,reason:'isolated deterministic translator',reviewRequired:false};});},runner:async(exe,args,opts)=>{native.push(args.find(a=>a.startsWith('-run=')));return runProcess(exe,args,opts);}});
await api.configure(descriptor);const workflow=createOneClickWorkflow({root,delivery:api});const id=(await workflow.start({outputRoot:path.join(root,'.local/checks/O'),versions:['5.3'],direction:'en-zh'})).jobId;let done,last;
for(let n=0;n<3000;n++){done=await workflow.job(id);if(last!==done.phase){last=done.phase;console.log(last);}if(done.status!=='running')break;await new Promise(r=>setTimeout(r,100));}
assert.equal(done.status,'completed',done.error);assert.equal(native.length,5);assert.equal(modelCalls,1);assert.deepEqual(await hashes(source),original);
const status=await api.status(),application=status.application,scan=JSON.parse(await fs.readFile(path.join(api.store,'latest-scan.json'),'utf8')),printRows=scan.result.entries.filter(r=>r.kind==='节点打印文本');assert.equal(printRows.length,7);assert.ok(printRows.every(r=>r.group==='text'&&r.field==='Text'&&r.pinName&&r.functionPath));assert.equal(scan.result.coverage.graphPrintText,1);assert.ok(!sent.includes('控制台命令不是显示文本'));assert.ok(!sent.includes('连接引脚的默认值不应翻译'));assert.ok(sent.includes('Default button label'));assert.ok(sent.includes('Gesture button'));assert.ok(sent.includes('Palm button'));assert.ok(!sent.includes('骨骼查询键'));
const target=path.dirname(done.versions[0].descriptorPath),clean=await fs.readFile(done.versions[0].descriptorPath),request=JSON.parse(await fs.readFile(path.join(root,'.local/project-delivery-state/processing',application.id,'apply-request.json'),'utf8')),translatedPath=request.assetMoves.find(m=>m.oldPath==='/Game/Checks/BP_PrintFixture').newPath;
await helpers(target);await fs.writeFile(done.versions[0].descriptorPath,JSON.stringify({FileVersion:3,EngineAssociation:'5.3',Plugins:[{Name:'DeliveryVerification',Enabled:true},{Name:'DeliveryTranslationBridge',Enabled:true},{Name:'PythonScriptPlugin',Enabled:true},{Name:'EditorScriptingUtilities',Enabled:true}]}));
await python(done.versions[0].descriptorPath,'reopen',`import unreal,json
bp=unreal.load_asset(${JSON.stringify(translatedPath)})
graph=json.loads(unreal.DeliveryVerificationLibrary.read_print_text_fixture(bp))
display={}
for before,owner in ${JSON.stringify(Object.fromEntries(request.assetMoves.map(m=>[m.oldPath,m.newPath])))}.items():
    details=json.loads(unreal.DeliveryTranslationLibrary.read_editor_text_content(unreal.load_asset(owner)))
    display[before]=[r for r in details['entries'] if r['kind'] in ['组件显示文本','显示变量默认值']]
with open(${JSON.stringify(path.join(root,'display-after.json'))},'w',encoding='utf-8') as f:json.dump(display,f,ensure_ascii=False,indent=2)
rows=json.loads(unreal.DeliveryTranslationLibrary.read_editor_text_content(bp))['entries']
with open(${JSON.stringify(path.join(root,'after.json'))},'w',encoding='utf-8') as f:json.dump({'graph':graph,'rows':rows},f,ensure_ascii=False,indent=2)
`);
const before=JSON.parse(await fs.readFile(path.join(root,'before.json'),'utf8')),after=JSON.parse(await fs.readFile(path.join(root,'after.json'),'utf8')),translated=new Map(after.rows.filter(r=>r.kind==='节点打印文本').map(r=>[r.nodeGuid,r.original]));
assert.equal(before.graph.maps.length,1);assert.equal(before.graph.maps[0].name,'PAD手势配置');assert.match(before.graph.maps[0].value,/hand_l/);assert.match(before.graph.maps[0].value,/手势_右手骨骼/);assert.deepEqual(after.graph.maps,before.graph.maps);assert.ok(sent.includes('PAD手势配置'));assert.ok(!sent.includes('手势_右手骨骼'));assert.ok(request.memberEntries.some(r=>r.original==='PAD手势配置'&&r.field==='Name'));
for(const r of before.rows){const value=after.rows.find(n=>n.kind==='节点打印文本'&&n.nodeGuid===r.nodeGuid&&n.pinName===r.pinName)?.original;assert.equal(value,dictionary[r.original]||r.original);}
const afterByGuid=new Map(after.graph.nodes.map(n=>[n.guid,n]));for(const node of before.graph.nodes){const current=afterByGuid.get(node.guid);assert.equal(current.function,node.function);assert.equal(current.graph,node.graph);for(const pin of node.pins){const next=current.pins.find(p=>p.name===pin.name);assert.deepEqual(next.links,pin.links);const row=before.rows.find(r=>r.nodeGuid===node.guid&&r.pinName===pin.name);if(row){if(row.valueType==='string')assert.equal(next.value,dictionary[row.original]||row.original);else{assert.equal(next.text,dictionary[row.original]||row.original);assert.equal(next.key,pin.key);assert.equal(next.namespace,pin.namespace);}}else{assert.equal(next.value,pin.value);assert.equal(next.text,pin.text);}}}
const displayAfter=JSON.parse(await fs.readFile(path.join(root,'display-after.json'),'utf8'));assert.ok(displayAfter['/Game/Checks/AC_GenericUIButton'].some(r=>r.original==='默认按钮名称'));assert.ok(displayAfter['/Game/Checks/BP_PrintFixture'].some(r=>r.kind==='组件显示文本'&&r.original==='手势按钮'));assert.ok(displayAfter['/Game/Checks/BP_PalmButton_Gesture'].some(r=>r.kind==='组件显示文本'&&r.original==='手掌按钮'));assert.ok(after.rows.some(r=>r.original==='运行时赋值文字'));assert.equal(after.graph.strings.SharedLookupKey,'骨骼查询键');
await fs.writeFile(done.versions[0].descriptorPath,clean);await removeHelpers(target);
const report={root,nativeUE:'5.3',actualModelRequests:0,mockModelRequests:modelCalls,printRows:printRows.length,nativeCalls:native,verification:application.verification,checks:['English component class default, SCS instance and inherited override localized in real UE and reopened','linked literal, concatenation and setter message localized; shared functional String preserved','Map identity unchanged in this name-preserving fixture; bone data excluded from model','PrintString literal and PrintText literal extracted, translated, applied and retained after fresh UE reopen','function graph print node included','multiline text and placeholders retained','node GUIDs, functions, graph names and all pin connections unchanged','linked print pin, console command and diagnostic Key untouched','FText namespace and key preserved','stale literal and connected-pin write requests rejected','one-click still uses five UE launches; source bytes unchanged']};await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));await fs.writeFile('.local/last-display-values-real.txt',root);console.log(JSON.stringify(report));
