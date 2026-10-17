import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {runProcess} from '../server/ue-windows.mjs';
const root=path.resolve('.local/checks/if'+String(Date.now()).slice(-6)),project=path.join(root,'P'),descriptor=path.join(project,'P.uproject'),build=(await fs.readFile('.local/delivery-bridge-build-path.txt','utf8')).trim(),resources=path.resolve('desktop/resources/delivery'),editor='C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
for(const d of ['Config','Content'])await fs.mkdir(path.join(project,d),{recursive:true});for(const name of ['DeliveryVerification','DeliveryTranslationBridge'])await fs.cp(name==='DeliveryVerification'?path.join(build,'Plugins',name):path.join(resources,name),path.join(project,'Plugins',name),{recursive:true,filter:p=>!/[\\/](Intermediate|Saved)[\\/]|\.(?:pdb|obj|pch|lib|exp|ilk)$/i.test(p)});
await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,EngineAssociation:'5.3',Plugins:['DeliveryVerification','DeliveryTranslationBridge','PythonScriptPlugin','EditorScriptingUtilities'].map(Name=>({Name,Enabled:true}))}));
async function python(name,code){const file=path.join(root,name+'.py');await fs.writeFile(file,code);const r=await runProcess(editor,[descriptor,'-run=pythonscript','-script='+file,'-unattended','-nop4','-NullRHI','-NoSound','-utf8output','-abslog='+path.join(root,name+'.log')],{cwd:project,timeout:180000});return r;}
const result=await python('apply',`import unreal,json,traceback
r={'success':False}
try:
 created=json.loads(unreal.DeliveryVerificationLibrary.create_interface_fixture())
 interface=unreal.load_asset(created['interface']);receiver=unreal.load_asset(created['receiver'])
 original=json.loads(unreal.DeliveryVerificationLibrary.verify_interface_fixture(receiver,'悬停滚动框','滚动框','当前滚动框','正在悬停','读取悬停状态','已悬停'))
 assert all(original.values()),original
 descriptor=unreal.Paths.convert_relative_path_to_full(unreal.Paths.get_project_file_path())
 rows=[]
 def add(owner,kind,original,translated,graph='',guid=''):
  rows.append(dict(owner=owner,kind=kind,field='Name',original=original,translated=translated,elementName=original,graphName=graph,nodeGuid=guid,entryKey=str(len(rows))))
 add(created['interface'],'函数','悬停滚动框','HoverScrollBox')
 add(created['interface'],'函数','读取悬停状态','IsScrollBoxHovered')
 add(created['interface'],'输入参数','滚动框','ScrollBox','悬停滚动框')
 add(created['interface'],'输出参数','已悬停','IsHovered','读取悬停状态')
 add(created['receiver'],'变量','当前滚动框','ScrollBox')
 add(created['receiver'],'变量','正在悬停','bIsHoveringScrollBox')
 add(created['receiver'],'函数','读取悬停状态','IsScrollBoxHovered')
 blueprints=[created['interface'],created['receiver']]
 before=json.loads(unreal.DeliveryTranslationLibrary.read_interface_bindings(json.dumps(dict(descriptorPath=descriptor,blueprints=blueprints,entries=rows),ensure_ascii=False)))
 applied=json.loads(unreal.DeliveryTranslationLibrary.apply_editor_translations(json.dumps(dict(descriptorPath=descriptor,blueprints=blueprints,entries=rows),ensure_ascii=False)))
 r.update(original=original,applied=applied,before=before,rows=rows)
 assert applied['success'],applied
 after=json.loads(unreal.DeliveryTranslationLibrary.read_interface_bindings(json.dumps(dict(descriptorPath=descriptor,blueprints=blueprints,entries=rows),ensure_ascii=False)))
 r['after']=after
 assert before==after, 'Interface topology changed'
 runtime=json.loads(unreal.DeliveryVerificationLibrary.verify_interface_fixture(receiver,'HoverScrollBox','ScrollBox','ScrollBox','bIsHoveringScrollBox','IsScrollBoxHovered','IsHovered'))
 r['runtime']=runtime
 assert all(runtime.values()),runtime
 for bp in [interface,receiver]:assert unreal.EditorAssetLibrary.save_loaded_asset(bp,False)
 r['success']=True
except Exception as error:r.update(error=str(error),traceback=traceback.format_exc())
with open(${JSON.stringify(path.join(root,'result.json'))},'w',encoding='utf-8') as f:json.dump(r,f,ensure_ascii=False,indent=2)
`);
const report=JSON.parse(await fs.readFile(path.join(root,'result.json'),'utf8'));assert.ok(report.success,JSON.stringify({exit:result.code,error:report.error,applied:report.applied,root}));
const reopened=await python('reopen',`import unreal,json
bp=unreal.load_asset('/Game/Checks/BP_接收者')
runtime=json.loads(unreal.DeliveryVerificationLibrary.verify_interface_fixture(bp,'HoverScrollBox','ScrollBox','ScrollBox','bIsHoveringScrollBox','IsScrollBoxHovered','IsHovered'))
assert all(runtime.values()),runtime
with open(${JSON.stringify(path.join(root,'reopened.json'))},'w') as f:json.dump(runtime,f)
`);assert.equal(reopened.code,0);console.log(JSON.stringify({root,actualModelRequests:0,sourceFixture:'isolated generated Blueprint interface, event implementer, message call and return-value function',runtime:report.runtime,reopened:JSON.parse(await fs.readFile(path.join(root,'reopened.json'),'utf8'))}));await fs.writeFile('.local/last-interface-binding-real.txt',root);
