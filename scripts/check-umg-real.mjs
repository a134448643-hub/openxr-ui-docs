import {readProjectCollisionChannels,applyProjectCollisionChannels} from '../server/project-collision-translation.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';
const root=process.cwd(),fixture=path.join(root,'.local/checks/umg-real-'+Date.now()),descriptor=path.join(fixture,'UmgCheck.uproject');for(const folder of ['Content','Config','Plugins'])await fs.mkdir(path.join(fixture,folder),{recursive:true});await fs.cp(path.join(root,'desktop/resources/delivery/DeliveryTranslationBridge'),path.join(fixture,'Plugins/DeliveryTranslationBridge'),{recursive:true});const build=(await fs.readFile('.local/delivery-bridge-build-path.txt','utf8')).trim();await fs.cp(path.join(build,'Plugins/DeliveryVerification'),path.join(fixture,'Plugins/DeliveryVerification'),{recursive:true});await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,EngineAssociation:'5.3',Plugins:[{Name:'DeliveryVerification',Enabled:true},{Name:'DeliveryTranslationBridge',Enabled:true},{Name:'PythonScriptPlugin',Enabled:true},{Name:'EditorScriptingUtilities',Enabled:true},{Name:'BlueprintOperations',Enabled:true}]}));
await fs.writeFile(path.join(fixture,'Config/DefaultEngine.ini'),'[/Script/Engine.CollisionProfile]\n+DefaultChannelResponses=(Channel=ECC_GameTraceChannel1,DefaultResponse=ECR_Ignore,bTraceType=True,bStaticObject=False,Name="手指UI检测通道")\n+DefaultChannelResponses=(Channel=ECC_GameTraceChannel2,DefaultResponse=ECR_Block,bTraceType=False,bStaticObject=True,Name="手指命中UI通道")\n+Profiles=(Name="DeliveryCheck",CollisionEnabled=QueryAndPhysics,bCanModify=True,ObjectTypeName="手指命中UI通道",CustomResponses=((Channel="手指UI检测通道",Response=ECR_Overlap)))\n');const configFiles=[{relative:'Config/DefaultEngine.ini'}],channels=await readProjectCollisionChannels(fixture,configFiles);await applyProjectCollisionChannels({root:fixture,files:configFiles,entries:channels.map((row,i)=>({...row,translated:i?'FingerUIHit':'FingerUITrace'}))});
const script=path.join(fixture,'verify-umg.py'),result=path.join(fixture,'result.json');await fs.writeFile(script,`import unreal,json,traceback,os
out=${JSON.stringify(result)}
report={"success":False,"stage":"create"}
try:
    bp=unreal.DeliveryVerificationLibrary.create_widget_fixture()
    assert bp
    rows=json.loads(unreal.DeliveryTranslationLibrary.read_editor_text_content(bp))["entries"]
    report["before"]=rows
    assert any(r["kind"]=="UMG控件" and r["original"]=="状态文字" for r in rows)
    assert any(r["field"]=="Text" and r["original"]=="准备开始" for r in rows)
    assert any(r["field"]=="DefaultText" and r["original"]=="等待启动" for r in rows)
    targets={"主容器":"MainPanel","状态文字":"StatusLabel","准备开始":"Ready to Start","等待启动":"Waiting to Start","开始按钮":"StartButton"}
    apply=[]
    for index,row in enumerate(rows):
        if row["original"] not in targets: continue
        row.update(owner="/Game/Checks/WBP_Check",entryKey=str(index),translated=targets[row["original"]])
        apply.append(row)
    apply.append({"owner":"/Game/Checks/WBP_Check","entryKey":"var-name","kind":"变量","field":"Name","original":"状态标题","elementName":"状态标题","translated":"StatusTitle","nodeGuid":next(r["nodeGuid"] for r in rows if r["field"]=="DefaultText")})
    report["stage"]="apply"
    descriptor=unreal.Paths.convert_relative_path_to_full(unreal.Paths.get_project_file_path())
    applied=json.loads(unreal.DeliveryTranslationLibrary.apply_editor_translations(json.dumps({"descriptorPath":descriptor,"entries":apply},ensure_ascii=False)))
    report["applied"]=applied
    assert applied["success"],applied
    assert unreal.EditorAssetLibrary.save_loaded_asset(bp,False)
    after=json.loads(unreal.DeliveryTranslationLibrary.read_editor_text_content(bp))["entries"]
    report["after"]=after
    assert any(r["kind"]=="UMG控件" and r["original"]=="StatusLabel" for r in after)
    assert any(r["field"]=="Text" and r["original"]=="Ready to Start" for r in after)
    assert any(r["field"]=="DefaultText" and r["original"]=="Waiting to Start" and r["elementName"]=="StatusTitle" for r in after)
    references=json.loads(unreal.DeliveryVerificationLibrary.verify_widget_fixture(bp))
    report["references"]=references
    assert all(references.values()),references
    collision=json.loads(unreal.DeliveryVerificationLibrary.verify_collision_channels())
    report["collision"]=collision
    assert all(collision.values()),collision
    report["success"]=True
except Exception as error:
    report["error"]=str(error);report["traceback"]=traceback.format_exc()
finally:
    with open(out,"w",encoding="utf-8") as stream:json.dump(report,stream,ensure_ascii=False,indent=2)
`);const editor='C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/UnrealEditor-Cmd.exe',log=await fs.open(path.join(fixture,'stdout.log'),'w'),child=spawn(editor,[descriptor,'-run=pythonscript','-script='+script,'-unattended','-nop4','-NoSound','-NullRHI','-utf8output','-abslog='+path.join(fixture,'editor.log')],{cwd:fixture,shell:false,windowsHide:true,stdio:['ignore',log.fd,log.fd]});const exit=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});await log.close();const report=JSON.parse(await fs.readFile(result));console.log(JSON.stringify({exit,success:report.success,stage:report.stage,error:report.error,fixture}));assert.ok(report.success,report.traceback);const reopen=path.join(fixture,'reopen.py'),reopened=path.join(fixture,'reopened.json');await fs.writeFile(reopen,`import unreal,json
bp=unreal.load_asset("/Game/Checks/WBP_Check")
references=json.loads(unreal.DeliveryVerificationLibrary.verify_widget_fixture(bp))
collision=json.loads(unreal.DeliveryVerificationLibrary.verify_collision_channels())
rows=json.loads(unreal.DeliveryTranslationLibrary.read_editor_text_content(bp))["entries"]
assert all(references.values()),references
assert all(collision.values()),collision
assert any(r["field"]=="DefaultText" and r["original"]=="Waiting to Start" for r in rows)
with open(${JSON.stringify(reopened)},"w",encoding="utf-8") as stream:json.dump({"references":references,"collision":collision,"success":True},stream)
`);const reopenLog=await fs.open(path.join(fixture,'reopen-stdout.log'),'w'),reopenProcess=spawn(editor,[descriptor,'-run=pythonscript','-script='+reopen,'-unattended','-nop4','-NoSound','-NullRHI','-utf8output','-abslog='+path.join(fixture,'reopen-editor.log')],{cwd:fixture,shell:false,windowsHide:true,stdio:['ignore',reopenLog.fd,reopenLog.fd]});await new Promise((resolve,reject)=>{reopenProcess.once('error',reject);reopenProcess.once('exit',resolve)});await reopenLog.close();assert.equal(JSON.parse(await fs.readFile(reopened)).success,true);console.log('UMG bindings, navigation, focus, animation, default text and collision configuration survive fresh editor reopen.');await fs.writeFile(path.join(root,'.local/last-umg-check.txt'),fixture);
