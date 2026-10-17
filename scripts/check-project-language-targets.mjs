import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createProjectLanguageTargets} from '../server/project-language-targets.mjs';
import {createProjectOpenPreferences} from '../server/project-open-language.mjs';
const fixture=path.resolve('.local/checks/project-language-targets-'+Date.now());await fs.mkdir(fixture,{recursive:true});
const readJson=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
const writeJson=async(file,data)=>fs.writeFile(file,JSON.stringify(data,null,2));
async function project(name,version='5.3'){const folder=path.join(fixture,name);for(const d of ['Content','Config'])await fs.mkdir(path.join(folder,d),{recursive:true});const file=path.join(folder,'Demo.uproject');await writeJson(file,{EngineAssociation:version});return file;}
const zh=await project('Original'),en=await project('English'),other=await project('UE55','5.5'),future=await project('Future'),unrelated=await project('Unrelated'),editor=path.join(fixture,'UnrealEditor.exe'),missing=path.join(fixture,'Removed','Demo.uproject');await fs.writeFile(editor,'test launcher stub');
const snapshot=new Map(await Promise.all([zh,en,other,future,unrelated].map(async file=>[file,await fs.readFile(file,'utf8')])));
async function resolveSource(descriptor){const descriptorPath=await fs.realpath(descriptor),data=await readJson(descriptorPath);for(const d of ['Content','Config'])assert.ok((await fs.stat(path.join(path.dirname(descriptorPath),d))).isDirectory());return {descriptorPath,projectRoot:path.dirname(descriptorPath),engineVersion:data.EngineAssociation};}
const file=path.join(fixture,'targets.json'),preferences=createProjectOpenPreferences(fixture),calls=[],rows=[{descriptorPath:future,sourceDescriptor:zh}];
const catalog={list:async()=>rows,lookup:async p=>rows.find(r=>r.descriptorPath===p)};await preferences.set(future,{editorLanguage:'en'});
const service=createProjectLanguageTargets({file,readJson,writeJson,resolveSource,catalog,preferences,engines:async()=>({items:[{version:'5.3',installed:true,editor:editor.replace('UnrealEditor.exe','UnrealEditor-Cmd.exe')}]}),launcher:async(...args)=>{calls.push(args);return {started:true};}});
await service.bind({descriptorPath:zh,language:'zh',targetPath:zh});await service.bind({descriptorPath:zh,language:'en',targetPath:en});
assert.equal((await service.list(en)).items.find(t=>t.language==='zh').descriptorPath,zh);
await service.open({descriptorPath:zh,language:'en'});await service.open({descriptorPath:en,language:'zh'});
assert.deepEqual(calls.map(c=>c[1]),[[en,'-culture=en','-language=en','-locale=en'],[zh,'-culture=zh-Hans','-language=zh-Hans','-locale=zh-Hans']]);
await assert.rejects(service.bind({descriptorPath:zh,language:'en',targetPath:other}),/相同 UE 版本/);
await assert.rejects(service.open({descriptorPath:zh,language:'fr'}),/中文或英文/);
// No fallback to a different output when an explicit binding has gone missing.
await writeJson(file,[{members:[zh,en],targets:{zh,en:missing}}]);const missingList=await service.list(zh);assert.equal(missingList.items.find(t=>t.language==='en').available,false);await assert.rejects(service.open({descriptorPath:zh,language:'en'}),/已移动或删除/);assert.equal(calls.length,2);
await assert.rejects(service.open({descriptorPath:missing,language:'en'}),/已移动或删除/);assert.equal((await service.list(unrelated)).items.every(t=>!t.available&&!t.descriptorPath),true);
await writeJson(file,[{members:[zh,en],targets:{zh,en}}]);await service.remember(await resolveSource(future));assert.equal((await service.list(zh)).items.find(t=>t.language==='en').descriptorPath,future);
await fs.writeFile(file,'[]');assert.equal((await service.list(zh)).items.find(t=>t.language==='en').descriptorPath,future);
for(const [file,bytes]of snapshot)assert.equal(await fs.readFile(file,'utf8'),bytes);
await fs.writeFile(path.join(fixture,'report.json'),JSON.stringify({passed:true,checks:['language targets shared from either project','exact project and explicit UE culture flags','reject different UE version','missing binding does not use another historical output','unrelated projects remain unbound','completed output discovered through recorded lineage and editor language','no project descriptor or configuration writes','no actual UE process launched'],calls},null,2));console.log(JSON.stringify({passed:true,fixture}));
