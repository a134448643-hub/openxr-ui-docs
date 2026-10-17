import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {runProcess} from '../server/ue-windows.mjs';
import {decodeIni,encodeIni} from '../server/ue-ini.mjs';
import {applyProjectCollisionChannels} from '../server/project-collision-translation.mjs';
import {checkEditorTranslationResult} from '../server/editor-translation-result.mjs';

// Replay the user's exact failed translation plan using real, untouched assets.
// No model request, fixtures or writes to a user project are involved.
const root=process.cwd(),caseDir=path.join(root,'.local/checks/parameter-scope-0.1.126');
const failedDir=path.join(root,'.local/project-delivery-state/processing/0414ca05-d112-4b4b-93b4-3942ad92cb2f');
const original=JSON.parse(await fs.readFile(path.join(failedDir,'apply-request.json'),'utf8'));
const mode=process.argv.includes('--before')?'before':'after',run=path.join(caseDir,mode+'-'+Date.now()),project=path.join(run,'Project');
const source=path.dirname(original.stagedApplication.selectedDescriptor),resources=path.join(root,'desktop/resources/delivery');
async function hashes(base){const files=[];async function walk(dir,rel=''){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['.ue-translation-cache','Saved','Intermediate','DerivedDataCache'].includes(e.name))continue;const file=path.join(dir,e.name);if(e.isDirectory())await walk(file,rel+e.name+'/');else files.push([rel+e.name,crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')]);}}await walk(base);return files.sort();}
const before=await hashes(source);await fs.mkdir(project,{recursive:true});
for(const [relative] of before){const target=path.join(project,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(source,relative),target);}
const descriptor=path.join(project,'OpenXR_UI.uproject'),data=JSON.parse(await fs.readFile(path.join(source,'OpenXR_UI.uproject'),'utf8'));
data.Plugins=(data.Plugins||[]).filter(p=>!['DeliveryTranslationBridge','PythonScriptPlugin','EditorScriptingUtilities'].includes(p.Name));
for(const Name of ['DeliveryTranslationBridge','PythonScriptPlugin','EditorScriptingUtilities'])data.Plugins.push({Name,Enabled:true});
await fs.writeFile(descriptor,JSON.stringify(data,null,2));
await fs.cp(path.join(resources,'DeliveryTranslationBridge'),path.join(project,'Plugins/DeliveryTranslationBridge'),{recursive:true,filter:p=>!/[\\/](?:Intermediate|Saved)[\\/]|\.(?:pdb|obj|pch|lib|exp|ilk)$/i.test(p)});
for(const file of ['export-translated-project.py','verify-component-hierarchy.py','verify-interface-bindings.py','verify-rename-bindings.py','verify-chinese-residue.py','verify-startup-settings.py','classification-assets.py'])await fs.copyFile(path.join(resources,file),path.join(run,file));
const request={...original,descriptorPath:descriptor,sourceRoot:source,workingRoot:source,protectedRoots:[source,original.sourceRoot],stagedApplication:undefined,inPlace:false,combinedClassification:false,normalizeOnly:false,verifyOnly:false,output:path.join(run,'apply-result.json'),hierarchyBaseline:path.join(run,'hierarchy-before.json'),interfaceBaseline:path.join(run,'interfaces-before.json'),renameBaseline:path.join(run,'renames-before.json'),progressFile:path.join(run,'progress.json')};
await fs.writeFile(path.join(run,'request.json'),JSON.stringify(request,null,2));
const editor='C:/Program Files/Epic Games/UE_5.3/Engine/Binaries/Win64/UnrealEditor-Cmd.exe';
const translation=JSON.parse(await fs.readFile(path.join(path.dirname(path.dirname(original.workingRoot)),'state/translation-result.json'),'utf8'));
const failedJob=JSON.parse(await fs.readFile(path.join(failedDir,'job.json'),'utf8'));
assert.equal(translation.copyJobId,failedJob.copyJobId,'Translation cache does not belong to this failed case');
await applyProjectCollisionChannels({root:project,files:before.map(([relative])=>({relative})),entries:translation.entries});
const result=await runProcess(editor,[descriptor,'-run=pythonscript','-script='+path.join(run,'export-translated-project.py'),'-unattended','-nop4','-NullRHI','-NoSound','-utf8output','-abslog='+path.join(run,'apply.log')],{cwd:project,env:{...process.env,UE_DELIVERY_EXPORT_REQUEST:path.join(run,'request.json')},timeout:1200000});
const applied=JSON.parse(await fs.readFile(request.output,'utf8'));
await fs.writeFile(path.join(caseDir,mode+'-run.json'),JSON.stringify({run,project,request:request.output,resultCode:result.code,success:applied.success,compileErrors:applied.compileErrors,error:applied.error},null,2));
assert.deepEqual(await hashes(source),before,'User-selected project was changed');
if(mode==='before')assert.equal(applied.success,false,'Failed plan should reproduce before the fix');
else {
 assert.equal(applied.success,true,applied.error||JSON.stringify(applied.compileErrors));
 const accepted=await checkEditorTranslationResult({result,report:applied,logFile:path.join(run,'apply.log'),verifyOnly:false,expectedAssets:request.assetMoves.length,requireHierarchy:true,expectedBlueprints:39});
 // Match production post-rename processing before opening a fresh editor.
 const destinations=new Set(request.assetMoves.map(m=>'Content/'+m.newPath.slice(6)+(m.assetClass==='World'?'.umap':'.uasset')));
 for(const relative of destinations)assert.ok((await fs.stat(path.join(project,relative))).isFile());
 for(const move of request.assetMoves){const relative='Content/'+move.oldPath.slice(6)+(move.assetClass==='World'?'.umap':'.uasset');if(destinations.has(relative))continue;const file=path.resolve(project,relative);assert.ok(file.startsWith(project+path.sep));try{assert.ok(!(await fs.lstat(file)).isSymbolicLink());await fs.unlink(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
 const replacements=new Map();for(const move of request.assetMoves){const oldName=path.posix.basename(move.oldPath);for(const [a,b] of [[move.oldPath+'.'+oldName+'_C',move.newPath+'.'+move.newName+'_C'],[move.oldPath+'.'+oldName,move.newPath+'.'+move.newName],[move.oldPath,move.newPath]])if(a!==b)replacements.set(a,b);}
 const escaped=[...replacements.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),pattern=new RegExp('(?:'+escaped.join('|')+')(?![\\p{L}\\p{N}_/.])','gu');
 async function updateIni(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())await updateIni(file);else if(e.name.endsWith('.ini')){const format=decodeIni(await fs.readFile(file));await fs.writeFile(file,encodeIni(format.text.replace(pattern,s=>replacements.get(s)),format));}}}await updateIni(path.join(project,'Config'));
 const fixed=await runProcess(editor,[descriptor,'-run=ResavePackages','-fixupredirects','-projectonly','-unattended','-nop4','-NullRHI','-NoSound','-utf8output','-abslog='+path.join(run,'references.log')],{cwd:project,timeout:1200000});assert.equal(fixed.code,0);
 const verify={...request,verifyOnly:true,output:path.join(run,'verify-result.json')};await fs.writeFile(path.join(run,'verify-request.json'),JSON.stringify(verify,null,2));
 const verified=await runProcess(editor,[descriptor,'-run=pythonscript','-script='+path.join(run,'export-translated-project.py'),'-unattended','-nop4','-NullRHI','-NoSound','-utf8output','-abslog='+path.join(run,'verify.log')],{cwd:project,env:{...process.env,UE_DELIVERY_EXPORT_REQUEST:path.join(run,'verify-request.json')},timeout:1200000});
 const report=JSON.parse(await fs.readFile(verify.output,'utf8'));assert.equal(report.success,true,report.error);assert.equal(verified.code,0);assert.equal(report.chineseAudit.translatable,0);assert.equal(report.chineseAudit.preserved,0);assert.deepEqual(await hashes(source),before);
 await checkEditorTranslationResult({result:verified,report,logFile:path.join(run,'verify.log'),verifyOnly:true,expectedAssets:request.assetMoves.length,requireHierarchy:true,expectedBlueprints:39});
 await fs.writeFile(path.join(caseDir,'actual-result.json'),JSON.stringify({actualExecution:true,exactFailedPlan:true,modelRequests:0,sourceUnchanged:true,run,applicationGateAccepted:true,applyExitCode:result.code,freshVerifyExitCode:verified.code,intermediateCompilerErrors:accepted.intermediateCompilerErrors||false,apply:applied,verify:report},null,2));
}
console.log(JSON.stringify({mode,run,exitCode:result.code,success:applied.success,error:applied.error,compileErrors:applied.compileErrors?.map(e=>({asset:e.asset,errors:e.errors}))}));
