import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DesktopStateStore} from '../desktop/state-store.mjs';
import {createUEProjectTools} from '../server/ue-project-tools.mjs';

const root=path.resolve('.'),fixture=path.join(root,'.local/checks/packaging-scroll-'+Date.now());
await fs.mkdir(path.join(fixture,'Project/Config'),{recursive:true});await fs.mkdir(path.join(fixture,'tmp'),{recursive:true});
await fs.mkdir(path.join(fixture,'Project/Content'),{recursive:true});
const descriptor=path.join(fixture,'Project/Scroll.uproject');await fs.writeFile(descriptor,JSON.stringify({EngineAssociation:'5.3',FileVersion:3}));
const nativeInfo=await createUEProjectTools({root:fixture,engineRegistry:async()=>[]}).register(descriptor);
const catalog=[{id:'scroll',name:'滚动位置测试',path:path.dirname(descriptor),nativeInfo,ue:'5.3',type:'UE 工程',plugins:[],imported:true}];
const store=new DesktopStateStore(path.join(fixture,'.local/desktop-data'));await store.load();await store.set('ue-pm-theme','epic-launcher');
await store.set('ue-nexus-prototype-v1',JSON.stringify({theme:'epic-launcher',catalog,order:['scroll'],projectId:'scroll'}));
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let app,page,polls=0,phase='running';const errors=[],checks=[];
const longLog=Array.from({length:240},(_,index)=>'构建记录 '+index+'：检查滚动位置与展开状态').join('\n');
const response=()=>({id:'scroll-job',target:'universal',status:phase,progress:{stage:'cook',label:'处理项目资源',percent:Math.min(65,30+polls)},message:'进度 '+polls+' '+phase,log:longLog+'\n'+Array.from({length:polls},(_,i)=>'新增日志 '+i).join('\n')});
async function waitPoll(){const before=polls;await page.waitForFunction(before=>Number(document.querySelector('[data-package-message]')?.textContent?.match(/进度 (\d+)/)?.[1])>before,before);}
async function record(){return page.evaluate(()=>{
  const pre=document.querySelector('.ue-package-job pre');pre.scrollTop=410;
  const ancestors=[];for(let node=pre.parentElement;node;node=node.parentElement){if(node.scrollHeight>node.clientHeight+30&&/(auto|scroll)/.test(getComputedStyle(node).overflowY)){node.scrollTop=Math.min(180,node.scrollHeight-node.clientHeight-10);ancestors.push(node);}}
  window.scrollCheck={panel:document.querySelector('.ue-smart-packaging'),pre,ancestors,positions:ancestors.map(n=>n.scrollTop),logTop:pre.scrollTop};
  document.querySelector('.ue-package-job summary').focus({preventScroll:true});
  return {positions:window.scrollCheck.positions,logTop:pre.scrollTop};
});}
async function unchanged(){return page.evaluate(()=>{const s=window.scrollCheck;return {panel:s.panel===document.querySelector('.ue-smart-packaging'),pre:s.pre===document.querySelector('.ue-package-job pre'),positions:s.ancestors.map(n=>n.scrollTop),logTop:s.pre.scrollTop,advanced:document.querySelector('.ue-package-advanced').open,sdk:document.querySelector('.ue-package-sdk').open,logs:document.querySelector('.ue-package-job details').open,focus:document.activeElement===document.querySelector('.ue-package-job summary')};});}
try{
  app=await _electron.launch({executablePath:process.env.UE_DESKTOP_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.UE_DESKTOP_TEST_EXE?[]:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,TEMP:path.join(fixture,'tmp'),TMP:path.join(fixture,'tmp'),UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.route('**/api/ue/android/**',route=>{if(route.request().url().includes('/job?'))polls++;return route.fulfill({json:response()});});
  await page.locator('[data-nav="configuration"]').click();await page.locator('[data-action="ue-package-start"]:enabled').waitFor();
  assert.equal(await page.locator('[data-package-title]').innerText(),'尚未开始打包');assert.equal(await page.locator('[data-package-progress]').getAttribute('aria-valuenow'),'0');
  await page.locator('.ue-package-advanced summary').click();await page.locator('.ue-package-sdk summary').click();
  await page.locator('#ue-SDKPath').fill('草稿路径保留');await page.locator('[data-action="ue-package-start"]').click();await page.locator('.ue-package-job details summary').click();
  assert.equal(await page.locator('[data-action="ue-package-output"]').isDisabled(),true);
  for(const width of [1000,1440,1800]){
    await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,820),width);
    const before=await record();assert.ok(before.positions.length>0,'An actual outer scroll container is exercised');assert.ok(before.positions.some(n=>n>0));
    await waitPoll();await waitPoll();const after=await unchanged();
    assert.ok(Number(await page.locator('[data-package-progress]').getAttribute('aria-valuenow'))>=30);assert.equal(await page.locator('[data-package-title]').innerText(),'处理项目资源');
    assert.equal(after.panel,true);assert.equal(after.pre,true);assert.deepEqual(after.positions,before.positions);assert.equal(after.logTop,before.logTop);assert.ok(after.advanced&&after.sdk&&after.logs&&after.focus);
    assert.equal(await page.locator('#ue-SDKPath').inputValue(),'草稿路径保留');checks.push({width,before,after});
  }
  const beforeFailure=await record();phase='failed';await page.locator('[data-package-message][role="alert"]').waitFor();assert.deepEqual((await unchanged()).positions,beforeFailure.positions);assert.equal((await unchanged()).logTop,beforeFailure.logTop);assert.equal(await page.locator('[data-action="ue-package-start"]').isEnabled(),true);
  phase='running';await page.locator('[data-action="ue-package-start"]').click();await page.locator('[data-action="ue-package-start"]:disabled').waitFor();assert.equal(await page.locator('[data-action="ue-package-output"]').isDisabled(),true);
  await page.locator('.ue-package-job details pre').waitFor({state:'attached'});if(!await page.locator('.ue-package-job details').evaluate(node=>node.open))await page.locator('.ue-package-job details summary').click();
  const beforeComplete=await record();phase='complete';await page.locator('[data-action="ue-package-open"]').waitFor();assert.deepEqual((await unchanged()).positions,beforeComplete.positions);assert.equal((await unchanged()).logTop,beforeComplete.logTop);assert.equal(await page.locator('[data-action="ue-package-output"]').isEnabled(),true);
  assert.equal(await page.locator('[data-package-progress]').getAttribute('aria-valuenow'),'100');assert.equal(await page.locator('[data-package-title]').innerText(),'打包完成');
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);assert.deepEqual(errors,[]);
  const screenshot=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await fs.writeFile(path.join(fixture,'scroll-preserved.png'),Buffer.from(screenshot,'base64'));
  const closed=app.waitForEvent('close',{timeout:20000});await page.locator('[data-window-action="close"]').click().catch(error=>{if(!/closed|destroyed/.test(error.message))throw error;});await closed;app=null;
  const report={fixture,checks,polls,errors,simulatedPackaging:true,actualPackaging:false,statesVerified:['running','failed','retry','complete'],wholePanelReplaced:false};await fs.writeFile(path.join(fixture,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){console.error(fixture);await page?.screenshot({path:path.join(fixture,'failure.png'),timeout:5000}).catch(()=>{});throw error;}finally{if(app)await app.close().catch(()=>{});}
