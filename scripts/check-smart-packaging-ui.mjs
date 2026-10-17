import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DesktopStateStore} from '../desktop/state-store.mjs';
import {createUEProjectTools} from '../server/ue-project-tools.mjs';

const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,'..');
const fixture=path.join(root,'.local/checks/smart-packaging-'+Date.now());
await fs.mkdir(fixture,{recursive:true});
const temporary=path.join(fixture,'tmp');await fs.mkdir(temporary,{recursive:true});
process.env.TEMP=temporary;process.env.TMP=temporary;
const {_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const tools=createUEProjectTools({root:fixture,engineRegistry:async()=>[]});
const catalog=[],originals=new Map(),checks=[],errors=[],mutations=[];
for(const [index,version] of ['5.3','5.5','5.8'].entries()){
  const folder=path.join(fixture,'projects','Sample'+index);
  await fs.mkdir(path.join(folder,'Config'),{recursive:true});
  await fs.mkdir(path.join(folder,'Content'),{recursive:true});
  const descriptor=path.join(folder,'Sample.uproject');
  const ini=path.join(folder,'Config/DefaultEngine.ini');
  const contents=JSON.stringify({FileVersion:3,EngineAssociation:version,Plugins:[{Name:'OpenXR',Enabled:true}]});
  const config='[/Script/AndroidRuntimeSettings.AndroidRuntimeSettings]\r\nPackageName=com.example.sample'+index+'\r\nApplicationDisplayName=真实应用'+index+'\r\nStoreVersion=7\r\nMinSDKVersion='+(index===0?26:29)+'\r\nTargetSDKVersion='+[32,34,35][index]+'\r\n';
  await fs.writeFile(descriptor,contents);await fs.writeFile(ini,config);
  originals.set(descriptor,contents);originals.set(ini,config);
  const nativeInfo=await tools.register(descriptor);
  catalog.push({id:'packaging-'+index,name:'测试工程 '+version,path:folder,nativeInfo,ue:version,type:'UE 工程',plugins:[],category:'uncategorized',imported:true});
}
const store=new DesktopStateStore(path.join(fixture,'.local/desktop-data'));
await store.load();await store.set('ue-pm-theme','epic-launcher');
await store.set('ue-nexus-prototype-v1',JSON.stringify({theme:'epic-launcher',catalog,order:catalog.map(p=>p.id),projectId:catalog[0].id,configs:{[catalog[0].id]:{local:true,path:'preserved-backup-path'}}}));
const launch=()=>_electron.launch({executablePath:process.env.UE_DESKTOP_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.UE_DESKTOP_TEST_EXE?[]:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});
let app,page;let failStart=false;const startRequests=[];let latestRequest=null;
const selectedOutput=path.join(fixture,'selected-output'),pickerResponses=['',selectedOutput];
async function capture(name){
  await app.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});});
  await page.evaluate(()=>{document.querySelectorAll('*').forEach(el=>{if(el.scrollTop)el.scrollTop=0;});});
  const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
  await fs.writeFile(path.join(fixture,name),Buffer.from(data,'base64'));
}
async function attach(){
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/ue/'))mutations.push(new URL(r.url()).pathname);});
  await page.route('**/api/ue/pick',route=>route.fulfill({json:{path:pickerResponses.shift()||''}}));
  await page.route('**/api/ue/android/**',route=>{
    const action=new URL(route.request().url()).pathname.split('/').at(-1);
    if(action==='start'){latestRequest=route.request().postDataJSON();startRequests.push(latestRequest);if(failStart)return route.fulfill({status:400,json:{error:'缺少 PICO OpenXR 插件（模拟检查）'}});return route.fulfill({json:{id:'fixture-packaging-job',target:latestRequest.target,status:'running',message:'正在模拟后台任务…'}});}
    if(action==='job')return route.fulfill({json:{id:'fixture-packaging-job',target:latestRequest.target,status:'complete',message:'模拟打包完成，未运行 UE',log:'模拟日志，未生成实际 APK'}});
    return route.fulfill({json:{opened:true}});
  });
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-nav="configuration"]').click();await page.locator('[data-action="ue-package-start"]:enabled').waitFor();
}
async function switchProject(index){await page.locator('#ue-config-project').selectOption(catalog[index].id);await page.locator('[data-action="ue-package-start"]:enabled').waitFor();}
async function sdkDetails(open=true){if((await page.locator('.ue-package-sdk').getAttribute('open')!==null)!==open)await page.locator('.ue-package-sdk>summary').click();}
async function close(){const closing=app,closed=closing.waitForEvent('close',{timeout:20000});await page.locator('[data-window-action="close"]').click().catch(e=>{if(!/closed|destroyed/.test(e.message))throw e;});await closed;app=null;}
async function noOverflow(label){const bounds=await page.locator('.ue-tool-page').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,window:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(bounds.scroll<=bounds.width+1,label+' page overflow '+JSON.stringify(bounds));assert.ok(bounds.document<=bounds.window,label+' window overflow');}
try{
  app=await launch();await attach();
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  assert.equal(await page.locator('input[name="ue-packaging-target"]:checked').inputValue(),'universal');
  assert.equal(await page.locator('.ue-package-advanced').getAttribute('open'),null);
  assert.equal(await page.locator('.ue-package-steps,.ue-package-project,.ue-package-summary,.desktop-editable-header').count(),0);
  assert.equal(await page.locator('.ue-smart-packaging button:visible').count(),4);
  assert.equal(await page.locator('.ue-package-start-row [data-action="ue-package-output"]').isVisible(),true);
  assert.equal(await page.locator('.ue-package-advanced [data-action="ue-package-output"]').count(),0);
  const defaultOutput=path.join(fixture,'.local/android-packages');
  assert.equal(await page.locator('.ue-package-output').getAttribute('title'),defaultOutput);
  await page.locator('[data-action="ue-package-output"]').click();
  assert.equal(await page.locator('.ue-package-output').getAttribute('title'),defaultOutput);
  await page.locator('[data-action="ue-package-output"]').click();
  await page.locator('.ue-package-output[title="'+selectedOutput.replaceAll('\\','\\\\')+'"]').waitFor();
  assert.equal(await page.locator('input[value="phone"]').count(),0);
  assert.match(await page.locator('.ue-package-information').innerText(),/25\.1\.8937393/);
  assert.match(await page.locator('.ue-package-information').innerText(),/android-33/);
  assert.match(await page.locator('.ue-package-information').innerText(),/API 26/);
  assert.match(await page.locator('.ue-package-information').innerText(),/API 32/);
  const sharedInfo=await page.locator('.ue-package-information').innerText();
  assert.equal(await page.locator('[data-action="ue-tab"][data-id="sdk"]').count(),0);
  assert.equal(await page.locator('.ue-vnav-item').count(),3);
  assert.equal(await page.locator('.ue-package-information').count(),1);
  await sdkDetails();
  assert.equal(await page.locator('.ue-package-information').innerText(),sharedInfo);
  assert.equal(await page.locator('#ue-SDKPath').isVisible(),true);
  const sdkDraft=path.join(fixture,'tmp');await page.locator('#ue-SDKPath').fill(sdkDraft);
  await page.locator('[data-action="ue-preview-sdk"]').click();await page.locator('.ue-diff').first().waitFor();await page.locator('[data-action="close-modal"]').last().click();
  await switchProject(1);assert.match(await page.locator('.ue-package-information').innerText(),/android-34/);
  await switchProject(0);assert.equal(await page.locator('.ue-package-information').innerText(),sharedInfo);
  assert.equal(await page.locator('#ue-SDKPath').inputValue(),sdkDraft);await sdkDetails(false);
  await page.locator('[data-action="ue-package-start"]').click();
  assert.equal(await page.locator('[data-action="ue-package-output"]').isDisabled(),true);
  await page.getByText('模拟打包完成，未运行 UE',{exact:true}).waitFor();assert.equal(startRequests.length,1);assert.equal(startRequests[0].target,'universal');
  assert.equal(startRequests[0].outputRoot,selectedOutput);
  assert.equal(await page.locator('[data-action="ue-package-output"]').isEnabled(),true);
  assert.equal(startRequests[0].id,catalog[0].nativeInfo.id);assert.equal(await page.locator('[data-action="ue-package-start"]').isEnabled(),true);
  assert.equal(await page.locator('.modal:visible').count(),0);
  await page.locator('input[value="pico"]').check();failStart=true;await page.locator('[data-action="ue-package-start"]').click();
  await page.getByText('缺少 PICO OpenXR 插件（模拟检查）',{exact:true}).waitFor();assert.equal(startRequests.length,2);
  assert.equal(await page.locator('[data-action="ue-package-start"]').isEnabled(),true);failStart=false;
  await page.locator('input[value="quest"]').check();assert.equal(await page.locator('.ue-package-job').count(),0);
  await page.locator('.ue-package-advanced summary').click();
  await page.locator('#ue-package-api-policy').selectOption('api29');assert.equal(await page.locator('.ue-package-advanced').getAttribute('open'),'');
  const api29Info=await page.locator('.ue-package-information').innerText();assert.doesNotMatch(api29Info,/API 26|API 32/);
  await sdkDetails();assert.equal(await page.locator('.ue-package-information').innerText(),api29Info);assert.equal(await page.locator('#ue-SDKPath').inputValue(),sdkDraft);await sdkDetails(false);
  await page.locator('#ue-package-configuration').selectOption('Shipping');assert.equal(await page.locator('.ue-package-advanced').getAttribute('open'),'');
  await page.locator('input[value="pico"]').check();await switchProject(1);
  assert.equal(await page.locator('.ue-package-output').getAttribute('title'),defaultOutput);
  assert.equal(await page.locator('input[name="ue-packaging-target"]:checked').inputValue(),'universal');
  await page.locator('.ue-package-advanced summary').click();assert.equal(await page.locator('#ue-package-configuration').inputValue(),'Development');
  await page.locator('input[value="quest"]').check();await switchProject(2);assert.match(await page.locator('.ue-package-information').innerText(),/r27c.*27\.2\.12479018/s);assert.match(await page.locator('.ue-package-information').innerText(),/android-35/);
  await switchProject(0);assert.equal(await page.locator('input[name="ue-packaging-target"]:checked').inputValue(),'pico');
  assert.equal(await page.locator('.ue-package-output').getAttribute('title'),selectedOutput);
  await page.locator('.ue-package-advanced summary').click();assert.equal(await page.locator('#ue-package-configuration').inputValue(),'Shipping');
  await page.locator('.ue-package-advanced summary').click();
  checks.push('Start and output folder are adjacent and visible with advanced settings closed; cancel preserves destination, folder choice reaches start and survives project switches; folder change is disabled while building');
  checks.push('One primary action; no workflow steps, preview/apply dialog, duplicate project hero or phone entry; one click calls start; error retry and per-project advanced choices work');
  for(const theme of process.env.UE_SMART_ALL_THEMES==='1'?['dark-unreal','light-clean','dark-graphite','cyber-blue','epic-launcher']:['epic-launcher']){
    await page.locator('#global-theme-picker [data-action="toggle-theme-picker"]').click();await page.locator('#global-theme-picker [data-theme-id="'+theme+'"]').click();
    for(const width of [1000,1440,1800]){
      await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,940),width);await noOverflow(theme+' '+width);
      const action=await page.locator('[data-action="ue-package-start"]').boundingBox();assert.ok(action.y>=0&&action.y+action.height<940,'Start fits without scrolling at '+theme+' '+width);
      const destination=await page.locator('.ue-package-destination').boundingBox();assert.ok(destination.y>=0&&destination.y+destination.height<940,'Output fits at '+theme+' '+width);
      if(width>=1440)assert.ok(Math.abs(destination.y+destination.height/2-action.y-action.height/2)<2,'Output stays beside start at '+theme+' '+width);
      if(width===1440||theme==='epic-launcher')await capture(theme+'-'+width+'.png');
      const information=await page.locator('.ue-package-information').innerText();await sdkDetails();
      assert.equal(await page.locator('.ue-package-information').innerText(),information);await noOverflow(theme+' SDK '+width);
      assert.equal(await page.locator('#ue-SDKPath').inputValue(),sdkDraft);
      if(theme==='epic-launcher'&&width===1440)await capture('sdk-settings-expanded-1440.png');
      await sdkDetails(false);
    }
  }
  checks.push('Compact main action fits 1000/1440/1800 in checked themes without scrolling or horizontal overflow');
  checks.push('Single merged page and one execution information panel; SDK fold replaces separate navigation; project/API policy changes stay synchronized; SDK path drafts survive theme and project switches; SDK preview still works');
  await page.locator('[data-action="ue-tab"][data-id="doctor"]').click();await page.locator('#ue-platform').selectOption('android');await page.getByText('r.MobileHDR',{exact:true}).waitFor();
  await page.locator('[data-action="ue-preview-platform"]').click();await page.locator('.ue-diff').first().waitFor();assert.match(await page.locator('.modal').innerText(),/r.MobileHDR/);await page.locator('[data-action="close-modal"]').last().click();
  for(const tab of ['presets']){await page.locator('[data-action="ue-tab"][data-id="'+tab+'"]').click();await page.locator('.ue-config-panel h2').waitFor();}
  await page.locator('[data-action="ue-tab"][data-id="packaging"]').click();
  await page.route('**/api/ue/settings?**',route=>route.fulfill({status:500,json:{error:'隔离测试：配置读取失败'}}));
  await page.locator('#ue-config-project').selectOption(catalog[2].id);await page.locator('.error-message[role="alert"]').waitFor();assert.equal(await page.locator('[data-action="ue-package-start"]').isDisabled(),true);
  await page.unroute('**/api/ue/settings?**');await page.locator('[data-action="ue-reload-config"]').click();await page.locator('[data-action="ue-package-start"]:enabled').waitFor();await switchProject(0);
  await page.locator('input[value="universal"]').check();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('input[name="ue-packaging-target"]:checked').inputValue(),'quest');await page.locator('input[value="universal"]').check();
  await page.evaluate(()=>window.ueDesktopFlush());await close();app=await launch();await attach();
  assert.equal(await page.locator('input[name="ue-packaging-target"]:checked').inputValue(),'universal');
  assert.equal(await page.locator('.ue-package-output').getAttribute('title'),selectedOutput);
  assert.equal(await page.locator('.ue-package-advanced').getAttribute('open'),null);await page.locator('.ue-package-advanced summary').click();assert.equal(await page.locator('#ue-package-configuration').inputValue(),'Shipping');
  const persisted=JSON.parse(JSON.parse(await fs.readFile(store.file,'utf8')).values['ue-nexus-prototype-v1']);assert.equal(persisted.configs[catalog[0].id].path,'preserved-backup-path');
  for(const [file,contents] of originals)assert.equal(await fs.readFile(file,'utf8'),contents);
  assert.deepEqual(mutations.filter(url=>!['/api/ue/preview','/api/ue/refresh-projects','/api/ue/android/start','/api/ue/pick'].includes(url)),[]);assert.deepEqual(errors,[]);
  checks.push('Original MR doctor/diff and other UE tabs remain; read failure blocks start and recovers; keyboard, normal close/restart and backup preferences preserved; no source writes');
  const report={fixture,checks,errors,mutations,startRequests,simulatedPackagingApi:true,actualPackaging:false,actualDeviceTests:false};await fs.writeFile(path.join(fixture,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await close();
}catch(e){console.error(fixture);await page?.screenshot({path:path.join(fixture,'failure.png'),timeout:5000}).catch(()=>{});throw e;}finally{if(app)await app.close().catch(()=>{});}
