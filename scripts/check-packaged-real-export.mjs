import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),fixture=path.join(root,'.local/checks/packaged-real-export-'+Date.now()),store=path.join(fixture,'.local/project-delivery-state');await fs.mkdir(path.join(store,'jobs'),{recursive:true});
for(const name of ['config.json','source-report.json','latest-copy.json','latest-scan.json','translation-result.json'])await fs.copyFile(path.join(root,'.local/project-delivery-state',name),path.join(store,name));
for(const name of ['latest-copy.json','latest-scan.json']){const job=JSON.parse(await fs.readFile(path.join(store,name),'utf8'));await fs.writeFile(path.join(store,'jobs',job.id+'.json'),JSON.stringify(job));}
const exe=path.join(root,'.local/desktop-build/release/0.1.24/PersonalDevPlatform-win32-x64/PersonalDevPlatform.exe'),output=path.join(fixture,'outputs'),project='OpenXR_UI_EN_Test';
if(process.argv[2])throw Error('真实导出测试只允许写入平台内部隔离目录，不能指定用户项目目录');
await fs.mkdir(output,{recursive:true});
let app;
try{
  app=await _electron.launch({executablePath:exe,args:[],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});const page=await app.firstWindow();
  await page.locator('[data-nav=project-translation]').click();await page.waitForFunction(()=>!document.querySelector('.pt-export-button')?.disabled);
  assert.equal(await page.locator('.pt-table tbody tr').count(),1668);assert.equal(await page.locator('[data-xlate=next]').count(),0);assert.equal(await page.locator('#pt-range').inputValue(),'project');
  await page.locator('[data-xlate=tab][data-id=rules]').click();await page.locator('.pt-terms').waitFor();assert.ok(await page.locator('.pt-terms').innerHTML().then(s=>s.includes('Actor Component')));await page.locator('[data-xlate=tab][data-id=translation]').click();
  await page.locator('.pt-advanced').evaluate(n=>{n.open=true;n.dispatchEvent(new Event('toggle'));});await page.locator('#pt-copy-name').fill(project);await page.locator('#pt-copy-name').blur();
  for(const v of ['5.5','5.6','5.7','5.8'])await page.locator(`[data-pt-target="${v}"]`).check();
  await app.evaluate(({dialog},output)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[output]});},output);
  await page.locator('.pt-export-button').click();await page.locator('[data-pt-live=export-confirm]').waitFor({timeout:60000});assert.ok((await page.locator('.pt-output-path').innerText()).startsWith(output));await page.locator('[data-pt-live=export-confirm]').click();
  let last='';for(;;){let task;try{task=JSON.parse(await fs.readFile(path.join(store,'latest-job.json'),'utf8'));}catch{}if(task?.kind==='export'){if(task.phase!==last){last=task.phase;console.log(JSON.stringify({jobId:task.id,phase:last,status:task.status,fixture}));}if(task.status!=='running'){
    console.log(JSON.stringify({status:task.status,error:task.error,target:task.target,versions:task.versions?.map(v=>({version:v.version,status:v.status,error:v.error})),result:task.result,verification:task.verification}));
    for(const v of task.versions.filter(v=>v.status==='completed')){const files=[];async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(/\.(uasset|umap)$/.test(e.name))files.push(path.relative(path.join(v.target,'Content'),p));}}await walk(path.join(v.target,'Content'));assert.equal(files.length,274);assert.equal(files.filter(f=>/[\u3400-\u9fff]/.test(f)).length,0);assert.ok(files.filter(f=>path.basename(f).startsWith('T_')).length>=56);assert.ok(files.filter(f=>path.basename(f).startsWith('SM_')).length>=11);console.log(JSON.stringify({version:v.version,assets:files.length,chinesePaths:0}));}
    assert.ok(['completed','partial'].includes(task.status));assert.equal(task.versions.find(v=>v.version==='5.5').status,'completed');assert.equal(task.versions.find(v=>v.version==='5.6').status,'completed');for(const v of task.versions.filter(v=>v.status==='failed'))assert.ok(v.error.includes('UE '),'failed engine version has actual diagnostics');assert.equal(task.sourceUnchanged,true);assert.equal(task.workingCopyUnchanged,true);
    await fs.writeFile(path.join(fixture,'TestResult.json'),JSON.stringify(task,null,2));
    console.log('Packaged application real translation, supported versions and explicit failed-version reporting verified.');break;
  }}await new Promise(r=>setTimeout(r,1000));}
}finally{if(app)await app.close();}
