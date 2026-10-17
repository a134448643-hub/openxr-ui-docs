import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const root=path.resolve('.local/checks/android-config-real-'+Date.now()),project=path.join(root,'Project');
const engine='C:/Program Files/Epic Games/UE_5.3',dotnet=path.join(engine,'Engine/Binaries/ThirdParty/DotNet/6.0.302/windows/dotnet.exe');
await fs.mkdir(path.join(project,'Config/Android'),{recursive:true});
await fs.writeFile(path.join(root,'global.json'),JSON.stringify({sdk:{version:'6.0.302',rollForward:'disable'}}));
await fs.writeFile(path.join(project,'Config/DefaultEngine.ini'),'[/Script/AndroidPlatformEditor.AndroidSDKSettings]\nNDKAPILevel=android-29\nSDKAPILevel=android-33\n');
await fs.writeFile(path.join(project,'Config/Android/AndroidEngine.ini'),'[/Script/AndroidRuntimeSettings.AndroidRuntimeSettings]\nNDKAPILevelOverride=android-29\nSDKAPILevelOverride=android-33\n');
// Reproduce a higher-priority user preference inside the isolated fixture only.
await fs.writeFile(path.join(project,'Config/UserEngine.ini'),'[/Script/AndroidPlatformEditor.AndroidSDKSettings]\nNDKAPILevel=android-32\nSDKAPILevel=latest\n');
await fs.writeFile(path.join(root,'Probe.csproj'),'<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net6.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings></PropertyGroup></Project>');
await fs.writeFile(path.join(root,'NuGet.Config'),'<configuration><packageSources><clear /></packageSources></configuration>');
await fs.writeFile(path.join(root,'Program.cs'),String.raw`
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
var binaries = Path.Combine(args[0], "Engine", "Binaries", "DotNET", "UnrealBuildTool");
AssemblyLoadContext.Default.Resolving += (context, name) => { var file = Path.Combine(binaries, name.Name + ".dll"); return File.Exists(file) ? context.LoadFromAssemblyPath(file) : null; };
var core = AssemblyLoadContext.Default.LoadFromAssemblyPath(Path.Combine(binaries,"EpicGames.Core.dll"));
var ubt = AssemblyLoadContext.Default.LoadFromAssemblyPath(Path.Combine(binaries,"UnrealBuildTool.dll"));
var directoryType = core.GetType("EpicGames.Core.DirectoryReference", true);
var project = Activator.CreateInstance(directoryType, new object[]{args[1]});
var cache = ubt.GetType("UnrealBuildTool.ConfigCache",true);
var read = cache.GetMethods().Single(method => method.Name == "ReadHierarchy" && method.GetParameters().Length == 5 && method.GetParameters()[4].ParameterType == typeof(string[]));
var androidPlatform = ubt.GetType("UnrealBuildTool.UnrealTargetPlatform",true).GetField("Android").GetValue(null);
var hierarchy = read.Invoke(null,new object[]{Enum.Parse(ubt.GetType("UnrealBuildTool.ConfigHierarchyType",true),"Engine"),project,androidPlatform,"",null});
var get = hierarchy.GetType().GetMethod("GetString");
string Read(string section,string key){var values = new object[]{section,key,null}; get.Invoke(hierarchy,values);return (string)values[2];}
var sdk = "/Script/AndroidPlatformEditor.AndroidSDKSettings";
var android = "/Script/AndroidRuntimeSettings.AndroidRuntimeSettings";
Console.WriteLine(JsonSerializer.Serialize(new {globalNdk=Read(sdk,"NDKAPILevel"),globalSdk=Read(sdk,"SDKAPILevel"),effectiveNdk=Read(android,"NDKAPILevelOverride"),effectiveSdk=Read(android,"SDKAPILevelOverride")}));
`);
const env={...process.env,DOTNET_ROOT:path.dirname(dotnet),DOTNET_MULTILEVEL_LOOKUP:'0',DOTNET_CLI_HOME:path.join(root,'dotnet-home'),DOTNET_SKIP_FIRST_TIME_EXPERIENCE:'1',DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_NOLOGO:'1'};
async function run(args){return new Promise((resolve,reject)=>{const child=spawn(dotnet,args,{cwd:root,env,windowsHide:true,shell:false});let out='';child.stdout.on('data',buffer=>out+=buffer);child.stderr.on('data',buffer=>out+=buffer);child.once('error',reject);child.once('close',code=>code===0?resolve(out):reject(Error(out)));});}
await run(['build',path.join(root,'Probe.csproj'),'--configfile',path.join(root,'NuGet.Config'),'-nologo','-v:q']);
const output=await run([path.join(root,'bin/Debug/net6.0/Probe.dll'),engine,project,'-rootdirectory='+engine]);
const result=JSON.parse(output.trim().split(/\r?\n/).findLast(line=>line.startsWith('{')));
assert.equal(result.effectiveNdk,'android-29');assert.equal(result.effectiveSdk,'android-33');
assert.equal(result.globalNdk,'android-32');assert.equal(result.globalSdk,'latest');
const report={root,engine,result,realUbtConfigRead:true,actualPackaging:false,userProjectRead:false,userSettingsModified:false};
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
