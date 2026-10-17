import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createBuildWorkspacePath} from '../server/ue-build-path.mjs';
import {isEngineLiveCodingActive} from '../server/ue-windows.mjs';
import {runAndroidAutomation,canUseInstalledEditor} from '../server/ue-android-packaging.mjs';

const root=path.resolve('.local/checks/android-ubt-path-'+Date.now()),work=path.join(root,'中文工程/work'),engine='C:/Program Files/Epic Games/UE_5.3';
assert.equal(await isEngineLiveCodingActive(engine),false,'Close the test engine normally before running the isolated compile check');
for(const folder of ['Content','Config','Temp'])await fs.mkdir(path.join(work,folder),{recursive:true});
const descriptorData={FileVersion:3,EngineAssociation:'5.3',Plugins:[{Name:'OpenXR',Enabled:true},{Name:'PICOOpenXR',Enabled:true}]};
await fs.writeFile(path.join(work,'NativePathProbe.uproject'),JSON.stringify(descriptorData));
assert.equal(await canUseInstalledEditor({projectRoot:work,descriptor:descriptorData},{root:engine}),true);
const sdk=path.join(process.env.LOCALAPPDATA,'Android/Sdk');await fs.writeFile(path.join(work,'Config/DefaultEngine.ini'),'[/Script/AndroidRuntimeSettings.AndroidRuntimeSettings]\nNDKAPILevelOverride=android-29\nSDKAPILevelOverride=android-33\nbBuildForArm64=True\nbBuildForArmV7=False\n[/Script/AndroidPlatformEditor.AndroidSDKSettings]\nSDKPath=(Path="'+sdk.replaceAll('\\','/')+'")\nNDKPath=(Path="'+path.join(sdk,'ndk/25.1.8937393').replaceAll('\\','/')+'")\n');
const alias=await createBuildWorkspacePath(work),dotnet=path.join(engine,'Engine/Binaries/ThirdParty/DotNet/6.0.302/windows/dotnet.exe');let log='',result;
try{
  const descriptor=path.join(alias.root,'NativePathProbe.uproject');
  const env={...process.env,DOTNET_ROOT:path.dirname(dotnet),ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,NDKROOT:path.join(sdk,'ndk/25.1.8937393'),GRADLE_USER_HOME:path.join(work,'GradleCache'),uebp_LogFolder:path.join(alias.root,'..','uat-logs'),uebp_FinalLogFolder:path.join(alias.root,'..','uat-logs'),TEMP:path.join(alias.root,'Temp'),TMP:path.join(alias.root,'Temp')};
  result=await runAndroidAutomation(dotnet,[path.join(engine,'Engine/Binaries/DotNET/AutomationTool/AutomationTool.dll'),'BuildCookRun','-project='+descriptor,'-nop4','-unattended','-utf8output','-platform=Android','-cookflavor=ASTC','-clientconfig=Development','-nocompileeditor','-ubtargs=-skipdeploy','-build','-skipcook','-skipstage','-skippackage'],{cwd:engine,env,onOutput:text=>{log+=text;}});
  if(result.code===0){
    assert.doesNotMatch(log,/-Target="NativePathProbeEditor Win64/);assert.match(log,/Compiling Native 64-bit code with NDK API 'android-29'/);
    assert.ok((await fs.stat(path.join(work,'Binaries/Android/NativePathProbe-arm64.so'))).size>0);
    const editor=await runAndroidAutomation(path.join(engine,'Engine/Binaries/Win64/UnrealEditor-Cmd.exe'),[descriptor,'-run=ResavePackages','-ProjectOnly','-IgnoreChangelist','-PackageFolder='+path.join(alias.root,'Content'),'-unattended','-NullRHI','-nosound','-stdout','-UTF8Output','-abslog='+path.join(alias.root,'editor-probe.log')],{cwd:engine,env,onOutput:text=>{log+=text;}});assert.equal(editor.code,0,'Installed editor must load the content-only project without rebuilding a Windows module');
  }
}finally{await alias.release();await fs.writeFile(path.join(root,'console.log'),log);}
const report={root,work,exitCode:result.code,realAutomationToolAndroidBuild:result.code===0,installedEditorLoaded:result.code===0,userProjectUsed:false,actualApkPackaging:false};await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(result.code!==0)console.error(log.slice(-11000));assert.equal(result.code,0);
