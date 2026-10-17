import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),fixture=path.join(root,'.local/checks/packaged-versions-'+Date.now());await fs.mkdir(fixture,{recursive:true});
const originalStore=path.join(root,'.local/checks/packaged-real-export-1791814510084/.local/project-delivery-state'),task=JSON.parse(await fs.readFile(path.join(originalStore,'jobs/17ec7586-e951-4be4-8b03-2f97cd8b1a72.json'),'utf8'));
let app;
try{
  app=await _electron.launch({executablePath:path.join(root,'.local/desktop-build/release/0.1.24/PersonalDevPlatform-win32-x64/PersonalDevPlatform.exe'),args:[],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});await (await app.firstWindow()).locator('[data-nav=project-translation]').waitFor();
  for(const version of ['5.5','5.6']){const target=path.join(fixture,'outputs','UE'+version.replace('.','_'));await fs.mkdir(path.dirname(target),{recursive:true});console.log(JSON.stringify({phase:'verify-version',version,target}));const params={baseline:task.target,target,version,editor:'C:/Program Files/Epic Games/UE_'+version+'/Engine/Binaries/Win64/UnrealEditor-Cmd.exe',taskDir:path.join(fixture,'versions',version),protectedRoots:[task.source.projectRoot,'T:/UE/UE/UE_Antigravity/文档工具/.local/project-delivery/OpenXR_UI_EN',task.target],expectedBlueprints:42,expectedAssets:274};
    const result=await app.evaluate(async({app},params)=>{const {createRequire}=process.getBuiltinModule('module'),path=process.getBuiltinModule('path'),load=createRequire(path.join(app.getAppPath(),'package.json'));const {convertVersion}=load('./server/ue-version-export.mjs'),{runProcess}=load('./server/ue-windows.mjs');return convertVersion({...params,resourceRoot:path.join(process.resourcesPath,'delivery'),runner:runProcess});},params);
    assert.equal(result.status,'completed');assert.equal(result.report.compiler.errors,0);assert.equal(result.report.compiler.compiledCount,42);task.versions[task.versions.findIndex(v=>v.version===version)]=result;console.log(JSON.stringify({version,status:result.status,compiler:result.report.compiler}));
  }
  await fs.writeFile(path.join(fixture,'TestResult.json'),JSON.stringify(task,null,2));console.log('Real packaged version checks passed; unsupported versions retain actual failures.');
}finally{if(app)await app.close();}
