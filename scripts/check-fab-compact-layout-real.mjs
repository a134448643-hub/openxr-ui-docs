import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createFabClassification} from '../server/fab-classification.mjs';import {runProcess} from '../server/ue-windows.mjs';
const root=process.cwd(),fixture=path.join(root,'.local/checks/fab-compact-'+Date.now()),source=path.join(fixture,'.local/checks/Project'),base=JSON.parse(await fs.readFile('.local/last-fab-groups-check.txt')),descriptor=path.join(source,'GroupCheck.uproject'),editor='C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
await fs.mkdir(source,{recursive:true});
// Reuse small real assets, copy only the test helper's runtime DLL; no PDB/PCH/cache.
await fs.cp(base.initialBackup,source,{recursive:true,filter:p=>!p.split(path.sep).some(s=>['Intermediate','Saved','DerivedDataCache','Source'].includes(s))&&!/\.(?:pdb|pch|obj|lib|exp)$/i.test(p)});
await fs.writeFile(path.join(source,'Config/DefaultEngine.ini'),'');
const script=path.join(fixture,'prepare.py'),output=path.join(fixture,'prepared.json');await fs.writeFile(script,`import unreal,json,traceback
r={'success':False}
try:
 t=unreal.AssetToolsHelpers.get_asset_tools()
 changes=[('/Game/VRUI/Blueprints/GestureUI/BP_Interaction','/Game/VRUI/UI/UIButtons','BP_Interaction'),('/Game/VRUI/Blueprints/GestureUI/Materials/M_UI','/Game/VRUI/UI/UIButtons/Materials','M_UI'),('/Game/VRUI/Blueprints/GestureUI/Textures/T_UI','/Game/VRUI/UI/UIButtons/Textures','T_UI'),('/Game/VRUI/Assets/Hands/CartoonHand/Materials/M_Hand','/Game/VRUI/Assets/Hands/CartoonHand','M_Hand'),('/Game/GroupCheck/Demo/DemoMap','/Game/VRUI/Demo/VRTemplate','DemoMap')]
 assert t.rename_assets([unreal.AssetRenameData(unreal.load_asset(old),folder,name) for old,folder,name in changes])
 interface=t.create_asset('BPI_Input','/Game/VRUI/Interfaces/Input',unreal.Blueprint,unreal.BlueprintInterfaceFactory())
 assert interface
 built=unreal.DeliveryVerificationLibrary.create_map_build_data_fixture('/Game/VRUI/Demo/VRTemplate/BuiltDemo')
 assert built=='/Game/VRUI/Demo/VRTemplate/BuiltDemo_BuiltData'
 assert unreal.EditorAssetLibrary.save_directory('/Game',False,True)
 r['success']=True
except Exception as e:r.update(error=str(e),traceback=traceback.format_exc())
with open(${JSON.stringify(output)},'w') as f:json.dump(r,f)
`);
const created=await runProcess(editor,[descriptor,'-run=pythonscript','-script='+script,'-unattended','-nop4','-NullRHI','-NoSound','-abslog='+path.join(fixture,'prepare.log')],{cwd:source,timeout:120000});assert.equal(created.code,0,created.stderr);const ready=JSON.parse(await fs.readFile(output));assert.equal(ready.success,true,ready.traceback);
const fixed=await runProcess(editor,[descriptor,'-run=ResavePackages','-fixupredirects','-projectonly','-unattended','-nop4','-NullRHI','-NoSound','-abslog='+path.join(fixture,'prepare-fixup.log')],{cwd:source,timeout:120000});assert.equal(fixed.code,0);
await fs.writeFile(path.join(source,'Config/DefaultEngine.ini'),'[/Script/EngineSettings.GameMapsSettings]\nEditorStartupMap=/Game/VRUI/Demo/VRTemplate/BuiltDemo.BuiltDemo\nGameDefaultMap=/Game/VRUI/Demo/VRTemplate/BuiltDemo\n');
const service=createFabClassification({root:fixture,runner:runProcess,engines:async()=>({items:[{version:'5.3',installed:true,editor}]}),resourceRoot:path.join(root,'desktop/resources/delivery'),launcher:async()=>({})});
async function wait(id){let phase='';for(;;){const j=service.job(id);if(j.phase!==phase){phase=j.phase;console.log(phase);}if(j.status!=='running')return j;await new Promise(r=>setTimeout(r,300));}}
const preview=await wait((await service.beginPreview({path:descriptor,mode:'group',modules:{VRUI:'VRUI'}})).jobId);assert.equal(preview.status,'completed',preview.error);assert.equal(preview.plan.collisions,0);assert.equal(preview.plan.preserved.length,3);assert.ok(preview.plan.moves.every(m=>!m.newPath.includes('/VRUI/')));assert.ok(preview.plan.moves.some(m=>m.newPath==='/Game/GroupCheck/Blueprints/Components/UIButtons/BP_Interaction'));assert.ok(preview.plan.moves.some(m=>m.newPath==='/Game/GroupCheck/Meshes/Skeletal/Hands/CartoonHand/Materials/M_Hand'));
const done=await wait((await service.apply({planId:preview.plan.planId,inPlace:true})).jobId);assert.equal(done.status,'completed',done.error);assert.equal(done.compiler.errors,0);assert.equal(done.verification.assets.length,14);
const interfaceAsset=done.verification.assets.find(a=>a.name==='BPI_Input');assert.equal(interfaceAsset.path,'/Game/GroupCheck/Blueprints/Interfaces/Input/BPI_Input');assert.equal(interfaceAsset.category,'Blueprints/Interfaces');assert.equal(done.verification.assets.find(a=>a.name==='BP_Interaction').category,'Blueprints/Components');
const map='/Game/GroupCheck/Demo/VRTemplate/BuiltDemo',world=done.verification.assets.find(a=>a.path===map);assert.ok(world.dependencies.includes(map+'_BuiltData'));assert.ok(done.verification.startupSettings);const config=await fs.readFile(path.join(source,'Config/DefaultEngine.ini'),'utf8');assert.ok(config.includes(map));assert.ok(!config.includes('/Game/VRUI/'));
const skeleton=done.verification.assets.find(a=>a.class.endsWith('.Skeleton'));assert.equal(skeleton.category,'Meshes/Skeletal/Skeletons');assert.ok(skeleton.path.includes('/Meshes/Skeletal/Skeletons/'));for(const mesh of done.verification.assets.filter(a=>a.class.endsWith('.SkeletalMesh')))assert.ok(mesh.dependencies.includes(skeleton.path));assert.equal(done.verification.assets.filter(a=>a.class.endsWith('.Skeleton')).length,1);
const again=await wait((await service.beginPreview({path:descriptor,mode:'group'})).jobId);assert.equal(again.status,'completed',again.error);assert.equal(again.plan.moves.length,0);
await fs.writeFile('.local/last-fab-compact-check.txt',JSON.stringify({fixture,descriptor,backupPath:done.backupPath}));console.log(JSON.stringify({passed:['no repeated VRUI shell','UIButtons direct resource group','loose material moves to Materials inside model','Skeleton routed separately and shared once','Demo block and real map/build data relocated together','startup config, dependencies, compilation, idempotence'],fixture,assets:14,moved:done.moved}));
