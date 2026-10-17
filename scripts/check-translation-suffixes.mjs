import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {normalizeSemanticRows,buildSemanticPrompt} from '../server/semantic-translation.mjs';
import {makeAssetExportPlan,normalizeAssetName} from '../server/ue-asset-naming.mjs';
import {normalizeMemberName} from '../server/ue-member-naming.mjs';
import {createProjectDelivery} from '../server/ue-project-delivery.mjs';

const root=path.resolve('.local/checks/suffix-'+Date.now()),source=path.join(root,'Source'),fake=path.join(root,'Engines');
const owner='/Game/P/Textures/球体_s',meta={packageName:owner,assetClass:'Texture2D',typeVerified:true},reason='The meaning of the _s suffix is unclear.';
const row={entryKey:'sphere',owner,group:'assets',kind:'纹理',field:'Name',original:'球体_s',translated:'T_Sphere_S',needsSemanticReview:true,namingReason:reason};
const policy={softAssetLength:32,softMemberLength:24},scan={assets:[meta],entries:[]},normalize=(rows)=>normalizeSemanticRows(rows,scan,policy,'zh-en');
const fixed=normalize([row])[0];assert.equal(fixed.translated,'T_Sphere_s');assert.equal(fixed.needsSemanticReview,false);assert.deepEqual(fixed.namingWarnings,[]);assert.equal(fixed.preservedOriginalSuffix,'_s');
assert.deepEqual(normalize([fixed]),[fixed],'normalization is stable');assert.equal(row.translated,'T_Sphere_S','input cache rows remain unchanged');
assert.equal(makeAssetExportPlan([fixed],[meta],'Unused',{inPlace:true})[0].newPath,'/Game/P/Textures/T_Sphere_s');
for(const ambiguous of ['The sphere meaning is unclear.','The meaning of the _s suffix is unclear. The core name is ambiguous.','Unknown asset usage.',''])assert.equal(normalize([{...row,namingReason:ambiguous}])[0].needsSemanticReview,true);
for(const translated of ['T_Sphere_Small','T_Sphere','T__s'])assert.equal(normalize([{...row,translated}])[0].needsSemanticReview,true);
assert.equal(normalize([{...row,field:'Tooltip'}])[0].needsSemanticReview,true);
assert.equal(normalize([{...row,native:'NativeName'}])[0].needsSemanticReview,true);
assert.equal(normalizeSemanticRows([row],scan,policy,'en-zh')[0].needsSemanticReview,true);
assert.equal(normalize([{...row,namingReason:'_s后缀的含义不明确'}])[0].needsSemanticReview,false);
assert.equal(normalizeAssetName('Mesh_01_V2',{assetClass:'StaticMesh',originalName:'模型_01_v2'}),'SM_Mesh_01_v2');
assert.equal(normalizeMemberName('Sphere_S',{...row,group:'members',valueType:'float'}),'Sphere_s');
assert.equal(normalizeMemberName('IsActive_V2',{...row,original:'是否启用_v2',group:'members',valueType:'bool'}),'bIsActive_v2');
const duplicate={...row,entryKey:'other',owner:'/Game/P/Textures/其他_s',original:'其他_s',translated:'T_Sphere_s',needsSemanticReview:false};
assert.ok(normalize([row,duplicate]).every(r=>r.namingWarnings.includes('同一所属位置有重名')));
assert.ok(buildSemanticPrompt({entries:[row],direction:'zh-en'}).includes('An unknown suffix meaning alone does not require review'));

// The actual cached retry and application contract use a simulated model and
// editor. All files are isolated in .local/checks; no user project is processed.
for(const dir of ['Content/P/Textures','Config'])await fs.mkdir(path.join(source,dir),{recursive:true});
await fs.writeFile(path.join(source,'P.uproject'),JSON.stringify({EngineAssociation:'5.3'}));await fs.writeFile(path.join(source,'Content/P/Textures/球体_s.uasset'),'mock texture');
await fs.writeFile(path.join(source,'Config/DefaultGame.ini'),'[/Script/EngineSettings.GeneralProjectSettings]\n');
await fs.mkdir(path.join(fake,'UE_5.3/Engine/Build'),{recursive:true});await fs.writeFile(path.join(fake,'UE_5.3/Engine/Build/Build.version'),JSON.stringify({MajorVersion:5,MinorVersion:3,PatchVersion:2}));
let modelCalls=0,editorCalls=0;
const runner=async(_exe,_args,options)=>{editorCalls++;if(options.env?.UE_DELIVERY_EXPORT_REQUEST){const request=JSON.parse(await fs.readFile(options.env.UE_DELIVERY_EXPORT_REQUEST));if(!request.verifyOnly)for(const move of request.assetMoves){assert.equal(move.newName,'T_Sphere_s');assert.equal(request.inPlace,true);await fs.rename(path.join(path.dirname(request.descriptorPath),'Content',move.oldPath.slice(6)+'.uasset'),path.join(path.dirname(request.descriptorPath),'Content',move.newPath.slice(6)+'.uasset'));}await fs.writeFile(request.output,JSON.stringify({...request.verifyOnly?{success:true,blueprintsVerified:0}:{success:true,translationApplied:true,applied:0,assetsProcessed:request.assetMoves.length,assetsRenamed:request.assetMoves.length,assetsUnchanged:0,failures:[],compileErrors:[]},componentHierarchy:{schemaVersion:1,matched:true,blueprints:0,components:0}}));}return {code:0};};
const processingOptions={root,engineRoots:[fake],runner,translationStatus:async()=>({available:true}),translator:async request=>{modelCalls++;return request.entries.map(e=>({id:e.id,text:'T_Sphere_S',reason,reviewRequired:true}));}};let api=createProjectDelivery({root,engineRoots:[]});
async function wait(id){for(let n=0;n<4000;n++){const job=await api.job(id);if(job.status!=='running')return job;await new Promise(r=>setTimeout(r,5));}throw Error('Test task timed out');}
await api.configure(source);const versionPlan=await api.previewVersionProjects({outputRoot:path.join(root,'.local/checks/O'),name:'P_Copy',versions:['5.3']});const version=await wait((await api.createVersionProjects(versionPlan.planId)).jobId),descriptor=version.versions[0].descriptorPath;assert.equal(version.status,'completed',version.error);api=createProjectDelivery(processingOptions);
await api.configure(descriptor);const copy=await wait((await api.refreshCopy()).jobId);assert.equal(copy.status,'completed');
await fs.writeFile(path.join(api.store,'latest-scan.json'),JSON.stringify({id:'ac7b78ba-6e8a-46c3-9a70-dcf948f33687',kind:'editor-scan',status:'completed',copyJobId:copy.id,result:{...scan,coverage:{assetSemantics:3},warnings:[]}}));
const first=await wait((await api.startTranslation({jobId:copy.id})).jobId);assert.equal(first.status,'completed');assert.equal(modelCalls,1);
// Re-create the legacy cached warning without changing the source or policy.
async function seedLegacy(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await seedLegacy(file);else if(entry.name.endsWith('.json')){let value;try{value=JSON.parse(await fs.readFile(file,'utf8'));}catch{continue;}if(value.kind==='translation'&&value.copyJobId===copy.id&&Array.isArray(value.entries)){value.entries=value.entries.map(r=>r.original==='球体_s'?{...r,translated:'T_Sphere_S',needsSemanticReview:true,namingReason:reason}:r);await fs.writeFile(file,JSON.stringify(value));}}}}
await seedLegacy(api.store);
const retried=await wait((await api.startTranslation({jobId:copy.id})).jobId);assert.equal(retried.status,'completed');assert.equal(modelCalls,1,'legacy cached retry does not send another model request');assert.equal(retried.entries.find(r=>r.original==='球体_s').translated,'T_Sphere_s');
const translationFile=path.join(api.store,'translation-result.json'),saved=JSON.parse(await fs.readFile(translationFile,'utf8')),asset=saved.entries.find(r=>r.original==='球体_s');asset.needsSemanticReview=true;asset.namingReason='The core sphere meaning is ambiguous.';await fs.writeFile(translationFile,JSON.stringify(saved));
await assert.rejects(api.applyTranslation({jobId:copy.id}),e=>/球体_s → T_Sphere_s/.test(e.message)&&e.message.includes(asset.namingReason)&&e.message.includes(owner));assert.equal(editorCalls,0,'genuine ambiguity stops before any engine mutation');
asset.namingReason=reason;await fs.writeFile(translationFile,JSON.stringify(saved));const done=await wait((await api.applyTranslation({jobId:copy.id})).jobId);assert.equal(done.status,'completed',done.error);
assert.deepEqual((await fs.readdir(path.dirname(descriptor))).sort(),['Config','Content','P.uproject']);assert.equal(await fs.readFile(path.join(source,'Content/P/Textures/球体_s.uasset'),'utf8'),'mock texture');assert.equal(modelCalls,1);
const report={root,mockModelAndEditor:true,passed:['suffix spelling and case preserved for assets and members','legacy suffix-only review resolved without guessing','genuine ambiguities, invalid names and collisions remain protected','cached retry uses zero additional model requests','precise review reason and asset location before engine mutation','automatic application uses current copy and only cleans after validation','original fixture unchanged']};
await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));await fs.writeFile('.local/last-suffix-check.txt',root);console.log(JSON.stringify(report));
