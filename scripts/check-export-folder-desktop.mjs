import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),fixture=path.join(root,'.local/checks/export-folder-'+Date.now()),store=path.join(fixture,'.local/project-delivery-state');
await fs.mkdir(path.join(store,'jobs'),{recursive:true});
for(const name of ['config.json','source-report.json','latest-copy.json','latest-scan.json','translation-result.json'])await fs.copyFile(path.join(root,'.local/project-delivery-state',name),path.join(store,name));
for(const name of ['latest-copy.json','latest-scan.json']){const job=JSON.parse(await fs.readFile(path.join(store,name),'utf8'));await fs.writeFile(path.join(store,'jobs',job.id+'.json'),JSON.stringify(job));}
const chosen=path.join(fixture,'用户自选 导出目录');await fs.mkdir(chosen);
let app;
try{
  app=await _electron.launch({executablePath:process.env.UE_DESKTOP_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.UE_DESKTOP_TEST_EXE?[]:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});
  const page=await app.firstWindow();await page.locator('[data-nav=project-translation]').click();await page.waitForFunction(()=>!document.querySelector('.pt-export-button')?.disabled);
  // Exercise the real local API and Electron dialog bridge with controlled replies.
  // No export is confirmed and the genuine UE projects are only read for preview.
  await app.evaluate(({dialog})=>{global.exportPickerCalls=[];dialog.showOpenDialog=async(parent,options)=>{global.exportPickerCalls.push({owner:parent.id,properties:options.properties});return {canceled:true,filePaths:[]};};});
  await page.locator('.pt-export-button').click();await page.waitForFunction(()=>!document.querySelector('.pt-export-button').disabled);
  assert.equal(await page.locator('[data-pt-live=export-confirm]').count(),0);assert.equal((await app.evaluate(()=>global.exportPickerCalls)).length,1);
  await app.evaluate(({dialog},chosen)=>{dialog.showOpenDialog=async(parent,options)=>{global.exportPickerCalls.push({owner:parent.id,properties:options.properties});return {canceled:false,filePaths:[chosen]};};},chosen);
  await page.locator('.pt-export-button').click();await page.locator('[data-pt-live=export-confirm]').waitFor({timeout:60000});
  const copyName=await page.locator('#pt-copy-name').inputValue();const target=path.join(chosen,copyName+'_Export');assert.ok((await page.locator('.pt-output-path').innerText()).includes(target));
  const calls=await app.evaluate(()=>global.exportPickerCalls);assert.equal(calls.length,2);assert.ok(calls.every(c=>c.owner>0&&c.properties.includes('openDirectory')));
  assert.equal(await fs.stat(target).catch(()=>null),null,'preview never writes the export project');
  assert.equal(await fs.stat(path.join(fixture,'.local/project-delivery')).catch(()=>null),null,'no default export directory created');
  console.log(JSON.stringify({passed:['real desktop folder picker bridge','cancel stops export','custom folder reaches backend preview','no export or source writes'],fixture}));
}finally{if(app)await app.close();}
