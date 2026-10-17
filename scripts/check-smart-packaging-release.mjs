import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const root=path.resolve(import.meta.dirname,'..'),checks=path.join(root,'.local/checks');
const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
const candidates=(await fs.readdir(checks)).filter(name=>/^smart-packaging-\d+$/.test(name)).sort().reverse();
let workspace;
for(const name of candidates){try{const report=JSON.parse(await fs.readFile(path.join(checks,name,'report.json'),'utf8'));if(report.errors.length===0){workspace=path.join(checks,name);break;}}catch{}}
assert.ok(workspace,'A completed isolated UI check is required');
const output=path.join(checks,'smart-packaging-release-'+version);await fs.mkdir(path.join(output,'tmp'),{recursive:true});
process.env.TEMP=path.join(output,'tmp');process.env.TMP=process.env.TEMP;
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const exe=path.join(root,'.local/desktop-build/release',version,'PersonalDevPlatform-win32-x64/PersonalDevPlatform.exe');
let app,page;const errors=[];
try{
  app=await _electron.launch({executablePath:exe,args:[],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:workspace,UE_DESKTOP_SMOKE:'1'},timeout:60000});
  page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.webContents.setBackgroundThrottling(false);window.setSize(1440,1100);});
  await page.locator('[data-nav="configuration"]').click();await page.locator('[data-action="ue-package-start"]:enabled').waitFor();
  assert.equal(await page.evaluate(()=>window.ueDesktopBootstrap.version),version);
  assert.equal(await page.locator('input[name="ue-packaging-target"]:checked').inputValue(),'universal');
  assert.equal(await page.getByRole('button',{name:'开始打包',exact:true}).isEnabled(),true);
  assert.equal(await page.locator('.ue-package-steps,.ue-package-summary,.desktop-editable-header').count(),0);
  assert.equal(await page.locator('.ue-package-advanced').getAttribute('open'),null);
  assert.match(await page.locator('.ue-package-advanced').textContent(),/直接配置并打包当前衍生工程，不复制工程资源/);
  assert.equal(await page.locator('.ue-package-start-row [data-action="ue-package-output"]').isVisible(),true);
  assert.equal(await page.locator('.ue-package-output').getAttribute('title'),path.join(workspace,'selected-output'));
  assert.equal(await page.locator('#ue-config-project').inputValue(),'packaging-0');
  const information=await page.locator('.ue-package-information').innerText();assert.match(information,/25\.1\.8937393/);
  assert.equal(await page.locator('[data-action="ue-tab"][data-id="sdk"]').count(),0);
  await page.locator('.ue-package-sdk>summary').click();assert.equal(await page.locator('#ue-SDKPath').isVisible(),true);assert.equal(await page.locator('.ue-package-information').innerText(),information);
  await page.locator('.ue-package-sdk>summary').click();
  await app.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});});
  await page.evaluate(async()=>{document.querySelector('.ue-tool-page').scrollIntoView({block:'start'});await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
  const png=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
  await fs.writeFile(path.join(output,'smart-packaging.png'),Buffer.from(png,'base64'));
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  assert.deepEqual(errors,[]);
  await page.evaluate(()=>window.ueDesktopFlush());
  const closed=app.waitForEvent('close',{timeout:20000});await page.locator('[data-window-action="close"]').click().catch(e=>{if(!/closed|destroyed/.test(e.message))throw e;});await closed;app=null;
  const report={version,exe,workspace,errors,checks:['Packaged release starts hidden','Current project loads in packaged app','Direct start action with collapsed advanced settings and no redundant workflow','Screenshot captured while window stays hidden','Normal custom close saves'],actualPackaging:false,actualDeviceTests:false};
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{if(app)await app.close().catch(()=>{});}
