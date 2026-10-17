import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createAndroidPackageIdentity} from '../server/android-package-identity.mjs';
import {picoLauncherSettings,androidPackagingFailure} from '../server/ue-android-packaging.mjs';
import {mergeIni,androidSection} from '../server/ue-ini.mjs';
import {runProcess} from '../server/ue-windows.mjs';

const root=path.resolve('.local/checks/package-config-real-'+Date.now()),projectRoot=path.join(root,'Derived');
await fs.mkdir(path.join(projectRoot,'Config'),{recursive:true});
const descriptorPath=path.join(projectRoot,'Sample.uproject'),config=path.join(projectRoot,'Config/DefaultEngine.ini');
await fs.writeFile(descriptorPath,'{"EngineAssociation":"5.3"}');
await fs.writeFile(config,'[/Script/AndroidPlatformEditor.AndroidSDKSettings]\nJavaPath=(Path="C:/Program Files/Android/Android Studio/jbr")\n');
const api=createAndroidPackageIdentity({root,project:async()=>({id:'fixture',projectRoot,descriptorPath}),isDerivedProject:async()=>true,runner:runProcess});
const name='测试 "名称" \\ Preview',password='Fixture-\\"secret-42';
await api.save('fixture',{name});await api.generate('fixture',{alias:'fixture',password,owner:'Fixture Developer'});
const original=await fs.readFile(config,'utf8'),custom='<meta-data android:name="keep" android:value="yes" />';
const fixed=picoLauncherSettings('['+androidSection+']\nExtraActivitySettings='+custom+'\n');
const legacy=mergeIni(original,[{...fixed,value:JSON.stringify(fixed.value)}]);
const repaired=mergeIni(legacy,[picoLauncherSettings(legacy)]);
const preserved=mergeIni(repaired,[picoLauncherSettings(repaired,'preserve')]);
assert.equal(repaired,mergeIni(repaired,[picoLauncherSettings(repaired)]));
const cases=[{label:'legacy',ini:legacy,validXml:false,launcher:false},{label:'repaired',ini:repaired,validXml:true,launcher:false},{label:'preserved',ini:preserved,validXml:true,launcher:false}];
for(const test of cases)await fs.writeFile(path.join(root,test.label+'.ini'),test.ini);
await fs.writeFile(path.join(root,'cases.json'),JSON.stringify({section:androidSection,name,password,cases}));
await fs.writeFile(path.join(root,'global.json'),JSON.stringify({sdk:{version:'10.0.401',rollForward:'disable'}}));
await fs.writeFile(path.join(root,'Probe.csproj'),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings></PropertyGroup></Project>');
await fs.writeFile(path.join(root,'NuGet.Config'),'<configuration><packageSources><clear /></packageSources></configuration>');
await fs.writeFile(path.join(root,'Program.cs'),String.raw`
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
var binaries = Path.Combine(args[0],"Engine","Binaries","DotNET","UnrealBuildTool");
AssemblyLoadContext.Default.Resolving += (context,name) => {var file=Path.Combine(binaries,name.Name+".dll");return File.Exists(file)?context.LoadFromAssemblyPath(file):null;};
var ubt=AssemblyLoadContext.Default.LoadFromAssemblyPath(Path.Combine(binaries,"UnrealBuildTool.dll"));
var core=AssemblyLoadContext.Default.LoadFromAssemblyPath(Path.Combine(binaries,"EpicGames.Core.dll"));
var referenceType=core.GetType("EpicGames.Core.FileReference",true);
var fileType=ubt.GetType("UnrealBuildTool.ConfigFile",true);
var action=Enum.Parse(ubt.GetType("UnrealBuildTool.ConfigLineAction",true),"Set");
var hierarchyType=ubt.GetType("UnrealBuildTool.ConfigHierarchy",true);
using var input=JsonDocument.Parse(File.ReadAllText(args[1]));
var settings=input.RootElement;var count=0;
foreach(var test in settings.GetProperty("cases").EnumerateArray()){
 var file=Path.Combine(Path.GetDirectoryName(args[1]),test.GetProperty("label").GetString()+".ini");
 var reference=Activator.CreateInstance(referenceType,new object[]{file});
 var config=Activator.CreateInstance(fileType,new object[]{reference,action});
 var files=Array.CreateInstance(fileType,1);files.SetValue(config,0);
 var constructor=hierarchyType.GetConstructors().OrderBy(c=>c.GetParameters().Length).First();
 var references=Array.CreateInstance(referenceType,1);references.SetValue(reference,0);
 var arguments=constructor.GetParameters().Length==1?new object[]{files}:new object[]{files,references};
 var hierarchy=constructor.Invoke(arguments);
 string Read(string key){var values=new object[]{settings.GetProperty("section").GetString(),key,null};hierarchyType.GetMethod("GetString").Invoke(hierarchy,values);return (string)values[2];}
 if(Read("ApplicationDisplayName")!=settings.GetProperty("name").GetString())throw new Exception("Display name did not round-trip through UE config parser");
 if(Read("KeyStorePassword")!=settings.GetProperty("password").GetString()||Read("KeyPassword")!=settings.GetProperty("password").GetString())throw new Exception("Signing credentials did not round-trip through UE config parser");
 var extra=Read("ExtraActivitySettings").Replace("\\n","\n");var valid=true;XDocument document=null;
 try{document=XDocument.Parse("<activity xmlns:android=\"http://schemas.android.com/apk/res/android\">"+extra+"</activity>");}catch(XmlException){valid=false;}
 if(valid!=test.GetProperty("validXml").GetBoolean())throw new Exception("Unexpected manifest XML validity: "+test.GetProperty("label").GetString());
 if(valid){XNamespace android="http://schemas.android.com/apk/res/android";var launcher=document.Descendants("category").Any(e=>(string)e.Attribute(android+"name")=="android.intent.category.LAUNCHER");if(launcher!=test.GetProperty("launcher").GetBoolean())throw new Exception("Unexpected launcher state");if(!document.Descendants("meta-data").Any(e=>(string)e.Attribute(android+"name")=="keep"))throw new Exception("Custom metadata lost");}
 count++;
}
Console.WriteLine(JsonSerializer.Serialize(new{engine=Path.GetFileName(args[0]),cases=count,actualUbtParser=true,nameRoundTrip=true,credentialRoundTrip=true,legacyXmlFailureReproduced=true,repairedXmlValid=true}));
`);
const dotnet='C:/Program Files/dotnet/dotnet.exe',env={...process.env,DOTNET_CLI_HOME:path.join(root,'dotnet-home'),NUGET_PACKAGES:path.join(root,'nuget'),DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_NOLOGO:'1',DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1'};
async function run(args){const result=await runProcess(dotnet,args,{cwd:root,env,timeout:60000,maxOutput:20000});assert.equal(result.code,0,result.stderr||result.stdout);return result.stdout;}
await run(['build','Probe.csproj','--configfile','NuGet.Config','-nologo','-v:q']);
const results=[];for(const version of ['5.3','5.5','5.8']){const engine='C:/Program Files/Epic Games/UE_'+version;const output=await run([path.join(root,'bin/Debug/net10.0/Probe.dll'),engine,path.join(root,'cases.json')]);results.push(JSON.parse(output.trim().split(/\r?\n/).findLast(line=>line.startsWith('{'))));}
assert.match(androidPackagingFailure('AndroidManifest.xml is invalid System.Xml.XmlException: unexpected token <!-- PersonalDevPlatform:PICO -->',1),/入口配置格式错误/);
const report={root,results,actualKeytool:true,actualUEPackaging:false,userProjectsModified:false};await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,...report}));
