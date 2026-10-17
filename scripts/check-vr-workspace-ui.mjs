import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DesktopStateStore} from '../desktop/state-store.mjs';
const root=path.resolve(import.meta.dirname,'..'),fixture=path.join(root,'.local/checks/vr-workspace-'+Date.now());
await fs.mkdir(path.join(fixture,'tmp'),{recursive:true});
const apk=path.join(fixture,'Drag-test.apk');await fs.writeFile(apk,'fixture; not an application');
const store=new DesktopStateStore(path.join(fixture,'.local/desktop-data'));await store.load();await store.set('ue-pm-theme','epic-launcher');await store.set('ue-nexus-prototype-v1',JSON.stringify({theme:'epic-launcher',catalog:[],order:[]}));
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const errors=[],requests=[],checks=[],tabs=['apps','files','performance','cast','logs'];let app,page,deviceMode='ready',jobStatus='running';
const launch=()=>_electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1',TEMP:path.join(fixture,'tmp'),TMP:path.join(fixture,'tmp')},timeout:60000});
async function attach(){
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/api/ue/'))requests.push(new URL(request.url()).pathname);});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.route('**/api/ue/devices',route=>deviceMode==='error'?route.fulfill({status:400,json:{error:'隔离检测失败'}}):route.fulfill({json:{items:deviceMode==='empty'?[]:deviceMode==='two'?[{serial:'fixture-pico',model:'PICO_4',status:'device'},{serial:'fixture-quest',model:'Quest_3',status:'device'}]:[{serial:'fixture-pico',model:'PICO_4',status:deviceMode==='unauthorized'?'unauthorized':'device'}]}}));
  await page.route('**/api/ue/install-apk',route=>route.fulfill({json:{jobId:'simulated-install'}}));
  await page.route('**/api/ue/job?*',route=>route.fulfill({json:{status:jobStatus,message:jobStatus==='failed'?'模拟签名不一致':'模拟安装状态',result:{output:'Success'}}}));
  await page.locator('[data-nav="vr-install"]').click();await page.locator('[data-action="vr-refresh-devices"]:enabled').waitFor();
}
async function tab(id){await page.locator('[data-action="vr-tool-tab"][data-id="'+id+'"]').click();await page.locator('#vr-tool-tab-'+id+'[aria-selected="true"]').waitFor();}
async function capture(name){await app.evaluate(async({BrowserWindow})=>{await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));await fs.writeFile(path.join(fixture,name+'.png'),Buffer.from(data,'base64'));}
async function close(){const closed=app.waitForEvent('close',{timeout:20000});await page.locator('[data-window-action="close"]').click();await closed;app=null;}
async function bounds(label){const value=await page.locator('.vr-tools-page').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,window:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(value.scroll<=value.width+1&&value.document<=value.window,label+' overflow '+JSON.stringify(value));}
try{
  app=await launch();await attach();assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  assert.deepEqual(await page.locator('.vr-tool-tabs [role="tab"]').allTextContents(),['应用','文件与空间','性能','投屏','日志与闪退']);assert.equal(await page.locator('.vr-device-bar').count(),1);
  await page.locator('.vr-device-bar[data-device-serial="fixture-pico"]').waitFor();assert.equal(await page.locator('#vr-device-select').count(),0);assert.equal(await page.locator('.vr-device-summary').innerText(),'PICO 4');
  await page.locator('#vr-pref-appQuery').evaluate(el=>el.dataset.unchanged='yes');await page.waitForTimeout(3300);assert.equal(await page.locator('#vr-pref-appQuery').getAttribute('data-unchanged'),'yes');
  deviceMode='two';await page.locator('#vr-device-select').waitFor();await page.locator('#vr-device-select').selectOption('fixture-quest');await page.locator('.vr-device-bar[data-device-serial="fixture-quest"]').waitFor();deviceMode='ready';await page.waitForFunction(()=>!document.querySelector('#vr-device-select')&&document.querySelector('.vr-device-bar')?.dataset.deviceSerial==='fixture-pico');
  deviceMode='unauthorized';await page.locator('.vr-device-bar[data-device-status="unauthorized"]').waitFor();assert.equal(await page.locator('[data-action="vr-start-install"]').isDisabled(),true);deviceMode='ready';await page.locator('.vr-device-bar[data-device-status="device"]').waitFor();
  assert.equal(await page.locator('[data-action="vr-start-install"]').isDisabled(),true);
  await page.evaluate(()=>{const file=document.createElement('input');file.type='file';file.id='fixture-file';file.hidden=true;document.body.append(file);});await page.locator('#fixture-file').setInputFiles(apk);
  await page.evaluate(()=>{const data=new DataTransfer();data.items.add(document.querySelector('#fixture-file').files[0]);document.querySelector('#vr-dropzone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));});
  await page.locator('.vr-apk-path').waitFor();await page.locator('[data-action="vr-start-install"]').click();await page.locator('[data-action="vr-start-install"]:disabled').waitFor();
  await tab('logs');await tab('apps');assert.equal(await page.locator('#vr-dropzone').isDisabled(),true);jobStatus='complete';await page.locator('.vr-install-result.is-success').waitFor();
  await page.locator('#vr-pref-appQuery').fill('保存搜索');await page.locator('#vr-pref-appScope').selectOption('all');
  await tab('performance');assert.deepEqual(await page.locator('.vr-metric strong').allTextContents(),Array(6).fill('—'));assert.equal(await page.locator('.vr-performance-chart polyline,.vr-performance-chart path').count(),0);
  await page.locator('#vr-pref-targetFps').selectOption('90');await page.locator('#vr-pref-duration').selectOption('900');
  await tab('logs');await page.locator('[data-action="vr-log-filter"][data-id="crash"]').click();await page.locator('#vr-pref-logLevel').selectOption('error');await page.locator('#vr-pref-logQuery').fill('Fatal');
  assert.match(await page.locator('.vr-diagnosis-panel').innerText(),/安装与环境/);assert.match(await page.locator('.vr-diagnosis-panel').innerText(),/项目与资源/);assert.equal(await page.locator('.vr-diagnosis-categories span').filter({hasText:'待采集'}).count(),3);
  await tab('cast');await page.locator('[data-action="vr-cast-eye"][data-id="both"]').click();await page.locator('#vr-pref-castQuality').selectOption('720');await page.locator('[data-vr-pref="castAudio"]').uncheck();assert.equal(await page.locator('.vr-cast-viewport').getAttribute('data-eye'),'both');
  await tab('files');await page.locator('[data-action="vr-file-location"][data-id="downloads"]').click();assert.equal(await page.locator('#vr-pref-filePath').inputValue(),'/sdcard/Download');await page.locator('[data-action="vr-file-parent"]').click();assert.equal(await page.locator('#vr-pref-filePath').inputValue(),'/sdcard');await page.locator('#vr-pref-filePath').fill('/sdcard/Personal');await page.locator('#vr-pref-fileQuery').fill('文件搜索');await page.locator('[data-action="vr-file-category"][data-id="apk"]').click();assert.equal(await page.locator('[data-action="vr-file-category"][data-id="apk"]').getAttribute('aria-pressed'),'true');
  await tab('apps');assert.equal(await page.locator('#vr-pref-appQuery').inputValue(),'保存搜索');assert.equal(await page.locator('.vr-apk-path').innerText(),apk);
  await page.locator('#vr-tool-tab-apps').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#vr-tool-tab-files').getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await page.locator('#vr-tool-tab-logs').getAttribute('aria-selected'),'true');await tab('performance');assert.equal(await page.locator('#vr-pref-targetFps').inputValue(),'90');
  for(const width of [1000,1440,1800]){
    await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,940),width);
    for(const id of tabs){await tab(id);await bounds(id+' '+width);await capture('epic-'+id+'-'+width);}
  }
  await page.locator('#global-theme-picker [data-action="toggle-theme-picker"]').click();await page.locator('#global-theme-picker [data-theme-id="light-clean"]').click();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,940));
  for(const id of tabs){await tab(id);await bounds('light '+id);await capture('light-'+id+'-1440');}
  await page.locator('#global-theme-picker [data-action="toggle-theme-picker"]').click();await page.locator('#global-theme-picker [data-theme-id="epic-launcher"]').click();
  deviceMode='error';await page.locator('[data-action="vr-refresh-devices"]').click();await page.locator('.vr-install-error').waitFor();deviceMode='empty';await page.locator('[data-action="vr-refresh-devices"]').click();await page.waitForFunction(()=>document.querySelector('.vr-device-summary')?.textContent==='未连接设备');await capture('no-device');
  await tab('cast');await page.evaluate(()=>window.ueDesktopFlush());await close();app=await launch();deviceMode='ready';await attach();
  assert.equal(await page.locator('#vr-tool-tab-cast').getAttribute('aria-selected'),'true');assert.equal(await page.locator('.vr-cast-viewport').getAttribute('data-eye'),'both');assert.equal(await page.locator('#vr-pref-castQuality').inputValue(),'720');assert.equal(await page.locator('[data-vr-pref="castAudio"]').isChecked(),false);
  await tab('files');assert.equal(await page.locator('#vr-pref-filePath').inputValue(),'/sdcard/Personal');assert.equal(await page.locator('#vr-pref-fileQuery').inputValue(),'文件搜索');assert.equal(await page.locator('[data-action="vr-file-category"][data-id="apk"]').getAttribute('aria-pressed'),'true');
  await tab('logs');assert.equal(await page.locator('#vr-pref-logQuery').inputValue(),'Fatal');assert.equal(await page.locator('[data-action="vr-log-filter"][data-id="crash"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[]);assert.deepEqual([...new Set(requests)].filter(url=>!['/api/ue/devices','/api/ue/apk-info','/api/ue/install-apk'].includes(url)),[]);
  checks.push('Five VR tabs in requested order; auto-detected single device, hotplug, unauthorized and multiple-device fallback; unchanged polls keep DOM stable; APK file category remembered; APK drag and simulated installation continue across tab changes; no new unimplemented device mutations');
  checks.push('No fabricated metrics, charts, apps or crash diagnoses; pending operations disabled; diagnostic evidence layout; keyboard navigation; local settings and searches survive tab/theme/restart');
  checks.push('Hidden Electron: all changed VR tabs at 1000/1440/1800 in Epic; light token regression at 1440; device error/empty; normal guarded close and restart');
  await close();const report={fixture,version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,checks,errors,requests,simulatedAdb:true,actualDeviceOperations:false,newFeatures:'interface only; install remains connected'};await fs.writeFile(path.join(fixture,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await capture('failure').catch(()=>{});console.error(fixture,error);throw error;}finally{if(app){await page?.evaluate(()=>{window.ueDesktopFlush=async()=>{};}).catch(()=>{});await app.close().catch(()=>{});}}
