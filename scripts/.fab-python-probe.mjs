import fs from 'node:fs/promises';import path from 'node:path';import {runProcess} from '../server/ue-windows.mjs';const dir=path.resolve('.local/checks/fab-python-probe-'+Date.now());await fs.mkdir(path.join(dir,'Content'),{recursive:true});await fs.mkdir(path.join(dir,'Config'));const descriptor=path.join(dir,'Probe.uproject');await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,EngineAssociation:'5.3',Plugins:[{Name:'PythonScriptPlugin',Enabled:true},{Name:'EditorScriptingUtilities',Enabled:true}]}));const script=path.join(dir,'probe.py');await fs.writeFile(script,`import unreal,json,traceback
r={"success":False}
try:
 t=unreal.AssetToolsHelpers.get_asset_tools()
 a=t.create_asset("M_Check","/Game/Feature",unreal.Material,unreal.MaterialFactoryNew())
 assert a
 unreal.EditorAssetLibrary.save_loaded_asset(a,False)
 assert t.rename_assets([unreal.AssetRenameData(a,"/Game/Probe/Feature/Materials","M_Check")])
 assert unreal.EditorAssetLibrary.save_loaded_asset(a,False)
 r["success"]=True
except Exception as e:r.update(error=str(e),traceback=traceback.format_exc())
with open(${JSON.stringify(path.join(dir,'result.json'))},"w") as f:json.dump(r,f)
`);const r=await runProcess('C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/UnrealEditor-Cmd.exe',[descriptor,'-run=pythonscript','-script='+script,'-unattended','-nop4','-NullRHI','-NoSound','-abslog='+path.join(dir,'editor.log')],{cwd:dir,timeout:120000});console.log(JSON.stringify({dir,code:r.code,result:await fs.readFile(path.join(dir,'result.json'),'utf8').catch(()=>r.stdout.slice(-1000))}));
