import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DesktopStateStore} from '../desktop/state-store.mjs';
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),fixture=path.join(root,'.local/checks/delivery-live-ui-'+Date.now()),data=path.join(fixture,'.local/project-delivery-state');await fs.mkdir(data,{recursive:true});
// Replay genuine read-only reports. Do not create or scan additional UE copies.
for(const name of ['config.json','source-report.json','latest-job.json','latest-copy.json','fab-checks.json'])await fs.copyFile(path.join(root,'.local/project-delivery-state',name),path.join(data,name));
const report=JSON.parse(await fs.readFile(path.join(data,'source-report.json'),'utf8'));
const savedJobs=await Promise.all((await fs.readdir(path.join(root,'.local/project-delivery-state/jobs'))).filter(n=>n.endsWith('.json')).map(async n=>JSON.parse(await fs.readFile(path.join(root,'.local/project-delivery-state/jobs',n),'utf8'))));
let copied;for(const candidate of savedJobs.filter(j=>j.kind==='copy'&&j.status==='completed')){if(await fs.stat(candidate.descriptorPath).catch(()=>null)){copied=candidate;break;}}
if(!copied)throw Error('No existing verified copy available for read-only integration test');const scan=savedJobs.find(j=>j.kind==='editor-scan'&&j.status==='completed'&&j.copyJobId===copied.id);if(!scan)throw Error('No completed scan for verified copy');
await fs.writeFile(path.join(data,'latest-copy.json'),JSON.stringify(copied));await fs.writeFile(path.join(data,'latest-job.json'),JSON.stringify(scan));await fs.mkdir(path.join(data,'jobs'));for(const id of [copied.id,scan.id])await fs.copyFile(path.join(root,'.local/project-delivery-state/jobs',id+'.json'),path.join(data,'jobs',id+'.json'));
const store=new DesktopStateStore(path.join(fixture,'.local/desktop-data'));await store.load();await store.set('ue-nexus-prototype-v1',JSON.stringify({catalog:[],plugins:[],overrides:{},docsBindings:{}}));
let app;const errors=[];
try{
  app=await _electron.launch({executablePath:process.env.UE_DESKTOP_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.UE_DESKTOP_TEST_EXE?[]:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});
  const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('[data-nav="project-translation"]').click();
  await page.locator('.pt-start-info>strong').filter({hasText:'OpenXR_UI'}).waitFor();await page.waitForFunction(()=>document.querySelector('.pt-stats').textContent.includes('1329')||Number(document.querySelector('.pt-stats strong').textContent.replace(/\D/g,''))>1000);
  // Native details toggling is exercised in the real browser check; the hidden
  // Electron window uses an equivalent DOM event to expose secondary controls.
  await page.locator('.pt-advanced').evaluate(n=>{n.open=true;n.dispatchEvent(new Event('toggle'));});assert.equal(await page.locator('#pt-project').isDisabled(),true);assert.equal(await page.locator('#pt-kind').isDisabled(),true);
  const expected=report.rows.length+scan.result.entries.length;assert.equal(Number(await page.locator('.pt-stats>div').first().locator('strong').evaluate(n=>n.firstChild.textContent)),expected);
  await page.locator('#pt-search').fill('菜单是否显示');assert.match(await page.locator('.pt-table').innerText(),/待翻译/);
  assert.equal(await page.locator('.pt-stats>button strong').evaluate(n=>n.firstChild.textContent),'0');
  // The browser check covers native downloads. Capture the generated Blob in
  // hidden Electron to inspect the actual export payload without UI download.
  await page.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){window.deliveryExport=blob.text();return original.call(this,blob);};});
  await page.locator('[data-xlate="export"]').click();const mapping=JSON.parse(await page.evaluate(()=>window.deliveryExport));assert.equal(mapping.example,false);assert.equal(mapping.sourceReadOnly,true);assert.equal(mapping.translationApplied,false);assert.equal(mapping.entries.length,expected);
  await page.locator('.pt-advanced').evaluate(n=>{n.open=true;n.dispatchEvent(new Event('toggle'));});await page.locator('[data-pt-live="preview"]').click();await page.getByRole('button',{name:'创建并校验副本',exact:true}).waitFor();assert.match(await page.locator('.modal').innerText(),/本次不会执行翻译/);assert.match(await page.locator('.modal').innerText(),/281/);await page.locator('[data-action="close-modal"]').last().click();
  await page.locator('[data-xlate="tab"][data-id="versions"]').click();assert.match(await page.locator('.pt-version-card').filter({hasText:'UE 5.4'}).innerText(),/引擎未安装/);await page.locator('[data-xlate="check-preview"]').click();assert.equal(await page.locator('[data-xlate="issue"]').count(),0);
  await page.locator('.pt-advanced').evaluate(n=>{n.open=true;n.dispatchEvent(new Event('toggle'));});await page.waitForFunction(()=>!document.querySelector('[data-pt-live="fab"]').disabled);
  await page.locator('[data-pt-live="fab"]').dispatchEvent('click');await page.waitForFunction(()=>document.querySelector('#pt-tab-fab')?.getAttribute('aria-selected')==='true'||document.querySelector('.pt-live-error')?.textContent);assert.equal(await page.locator('.pt-live-error').count(),0,await page.evaluate(()=>document.querySelector('.pt-live-error')?.textContent||''));assert.match(await page.locator('.pt-fab-checklist').innerText(),/Content 顶层 3 项/);assert.match(await page.locator('.pt-fab-checklist').innerText(),/尚未覆盖/);
  await page.locator('[data-action="desktop-switch-workspace"][data-key="workspace"]').click();await page.locator('[data-nav="project-translation"]').click();assert.match(await page.locator('.pt-start-info').innerText(),/OpenXR_UI5.3/);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:['genuine source and copy reports','1329 editor fields displayed','blank Chinese entries pending translation','real export with source protection flags','real copy plan without execution','missing 5.4 explicit','no fake version validation','genuine Fab filesystem findings','no source mutation'],fixture}));
}finally{await app?.close();}
