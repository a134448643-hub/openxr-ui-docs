import fs from 'node:fs/promises';
import path from 'node:path';
import {planGeneratedCleanup,applyGeneratedCleanup} from '../server/platform-generated-cleanup.mjs';
import {powershell} from '../server/ue-windows.mjs';
const root=path.resolve(import.meta.dirname,'..'),version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
export async function activeGeneratedPaths(workspace=root){
 const text=await powershell(`$uePaths=@();$ueLocal=(Join-Path $env:UE_CLEAN_WORKSPACE '.local');foreach($ueProcess in (Get-CimInstance Win32_Process | Where-Object {$_.Name -in @('UnrealEditor.exe','UnrealEditor-Cmd.exe','PersonalDevPlatform.exe','node.exe','dotnet.exe')})){if($ueProcess.ExecutablePath -and $ueProcess.ExecutablePath.StartsWith($ueLocal,[StringComparison]::OrdinalIgnoreCase)){$uePaths+=$ueProcess.ExecutablePath};$ueCommand=$ueProcess.CommandLine;if(!$ueCommand){continue};$ueCommand=$ueCommand.Replace([char]47,[char]92);$ueCheckRoot=Join-Path $ueLocal 'checks';$ueStart=$ueCommand.IndexOf($ueCheckRoot,[StringComparison]::OrdinalIgnoreCase);if($ueStart -ge 0){$ueRest=$ueCommand.Substring($ueStart+$ueCheckRoot.Length).TrimStart([char]92);$ueName=($ueRest -split '[\\\\" ]')[0];if($ueName){$uePaths+=(Join-Path $ueCheckRoot $ueName)}};if($ueCommand -match 'UnrealBuildTool|build-delivery-bridge|scripts\\\\check-'){$uePaths+=$ueCheckRoot}};ConvertTo-Json -InputObject @($uePaths | Select-Object -Unique) -Compress`,{UE_CLEAN_WORKSPACE:workspace});return JSON.parse(text||'[]');
}
if(path.resolve(process.argv[1]||'')===path.resolve(import.meta.filename)){
 const activePaths=await activeGeneratedPaths(),manual=process.argv.includes('--all-finished-tests'),apply=process.argv.includes('--apply'),plan=await planGeneratedCleanup({root,currentVersion:version,activePaths,minimumAgeMs:manual?0:60*60000});
 const planFile=path.join(root,'.local/generated-cleanup-plan.json');await fs.writeFile(planFile,JSON.stringify(plan,null,2));
 console.log(JSON.stringify({plannedBytes:plan.totalBytes,candidates:plan.candidates.length,kept:plan.kept.length,planFile}));
 if(apply){const result=await applyGeneratedCleanup(plan,{activePaths:await activeGeneratedPaths()});console.log(JSON.stringify({freedBytes:result.freedBytes,deleted:result.deleted.length,skipped:result.skipped.map(x=>({path:x.path,error:x.error}))}));}
}
