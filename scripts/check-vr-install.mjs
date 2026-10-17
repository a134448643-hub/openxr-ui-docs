import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createUEProjectTools} from '../server/ue-project-tools.mjs';
import {DesktopStateStore} from '../desktop/state-store.mjs';

const root=path.resolve(import.meta.dirname,'..');
const fixture=path.join(root,'.local/checks/vr-install-'+Date.now());
await fs.mkdir(path.join(fixture,'sdk/platform-tools'),{recursive:true});
await fs.mkdir(path.join(fixture,'tmp'),{recursive:true});
const apk=path.join(fixture,'测试 安装包.apk');await fs.writeFile(apk,'fixture APK; not a real application');
await fs.writeFile(path.join(fixture,'sdk/platform-tools/adb.exe'),'fixture');
process.env.ANDROID_HOME=path.join(fixture,'sdk');process.env.TEMP=path.join(fixture,'tmp');process.env.TMP=process.env.TEMP;
const checks=[],calls=[],errors=[];
let deviceOutput='* daemon started successfully *\nList of devices attached\nusb-one device product:pico model:PICO_4\nusb-two unauthorized model:Quest_3\nusb-three offline\n';
let installResult={code:0,stdout:'Performing Streamed Install\nSuccess\n',stderr:''},releaseInstall;
const tools=createUEProjectTools({root:fixture,engineRegistry:async()=>[],runner:async(file,args)=>{
  calls.push({file,args});if(args[0]==='devices')return {code:0,stdout:deviceOutput,stderr:''};
  if(args.includes('install')){if(releaseInstall)await releaseInstall.promise;return installResult;}
  throw Error('Unexpected process');
}});
assert.equal((await tools.devices()).length,3);assert.equal((await tools.apkInfo(apk)).name,'测试 安装包.apk');
await assert.rejects(tools.apkInfo(path.join(fixture,'missing.apk')),/不存在/);
await assert.rejects(tools.apkInfo(fixture),/APK/);
await assert.rejects(tools.installApk(undefined,{file:apk,device:'usb-two'}),/断开或未授权/);
await assert.rejects(tools.installApk(undefined,{file:apk,device:'-x'}),/请选择/);
releaseInstall={};releaseInstall.promise=new Promise(resolve=>releaseInstall.resolve=resolve);
const installed=await tools.installApk(undefined,{file:apk,device:'usb-one'});
await assert.rejects(tools.installApk(undefined,{file:apk,device:'usb-one'}),/正在安装/);
releaseInstall.resolve();releaseInstall=null;
async function waitJob(job){while(tools.job(job.jobId).status==='running')await new Promise(resolve=>setTimeout(resolve,10));return tools.job(job.jobId);}
assert.equal((await waitJob(installed)).status,'complete');
assert.deepEqual(calls.find(c=>c.args.includes('install')).args,['-s','usb-one','install','-r',apk]);
for(const output of ['Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]','Failure [INSTALL_FAILED_VERSION_DOWNGRADE]','Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]','Failure [INSTALL_FAILED_NO_MATCHING_ABIS]','Failure [INSTALL_FAILED_OLDER_SDK]','Not Success']){
  installResult={code:1,stdout:output,stderr:''};const job=await tools.installApk(undefined,{file:apk,device:'usb-one'});assert.equal((await waitJob(job)).status,'failed');assert.ok(tools.job(job.jobId).message.includes(output));
}
assert.ok(!calls.some(c=>c.args.includes('uninstall')));
checks.push('Backend: project-independent APK metadata and devices; unauthorized/offline rejected; exact serial and Unicode path; keep-data install; duplicate lock; real success/failure and common failure explanations; no uninstall');

const store=new DesktopStateStore(path.join(fixture,'.local/desktop-data'));await store.load();await store.set('ue-pm-theme','epic-launcher');
await store.set('ue-nexus-prototype-v1',JSON.stringify({theme:'epic-launcher',catalog:[],order:[]}));
const require=createRequire(import.meta.url);
const {_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const executable=process.env.UE_DESKTOP_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe');
const launch=()=>_electron.launch({executablePath:executable,args:process.env.UE_DESKTOP_TEST_EXE?[]:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});
let app,page,deviceMode='one',jobMode='running',installRequests=[];
async function attach(){
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.route('**/api/ue/devices',route=>{
    assert.equal(route.request().method(),'POST');
    if(deviceMode==='error')return route.fulfill({status:400,json:{error:'隔离测试：ADB 不可用'}});
    const items=deviceMode==='empty'?[]:[{serial:'usb-one',model:'PICO_4',status:'device'},{serial:'usb-two',model:'Quest_3',status:deviceMode==='two'?'device':'unauthorized'}];
    return route.fulfill({json:{items}});
  });
  await page.route('**/api/ue/install-apk',route=>{installRequests.push(route.request().postDataJSON());return route.fulfill({json:{jobId:'test-install'}});});
  await page.route('**/api/ue/job?*',route=>route.fulfill({json:{status:jobMode,message:jobMode==='failed'?'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]':'执行中',result:{output:'Success'}}}));
  await page.route('**/api/ue/pick',route=>route.fulfill({json:{path:apk}}));
  await page.locator('[data-nav="vr-install"]').click();await page.locator('.vr-device-bar[data-device-count="2"]').waitFor();
}
async function capture(name){
  const data=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64'));
  await fs.writeFile(path.join(fixture,name),Buffer.from(data,'base64'));
}
async function close(){const closed=app.waitForEvent('close',{timeout:20000});await page.locator('[data-window-action="close"]').click();await closed;app=null;}
async function drop(files){
  await page.evaluate(()=>{document.getElementById('fixture-drop-input')?.remove();const input=document.createElement('input');input.type='file';input.multiple=true;input.id='fixture-drop-input';input.hidden=true;document.body.append(input);});
  await page.locator('#fixture-drop-input').setInputFiles(files);
  await page.evaluate(()=>{const transfer=new DataTransfer();for(const file of document.getElementById('fixture-drop-input').files)transfer.items.add(file);document.getElementById('vr-dropzone').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));});
}
try{
  app=await launch();await attach();
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  assert.equal(await page.locator('[data-action="vr-start-install"]').isDisabled(),true);
  assert.equal(await page.locator('#vr-device-select').inputValue(),'usb-one');
  assert.equal(await page.locator('#vr-device-select option[value="usb-two"]').isDisabled(),true);
  assert.doesNotMatch(await page.locator('.vr-install-page').innerText(),/连接指引|Wi-Fi 无线调试|更换 APK|模拟闪退|崩溃诊断|86%/);
  await drop([apk]);await page.locator('.vr-apk-path').waitFor();
  assert.equal(await page.locator('.vr-apk-path').innerText(),apk);
  assert.equal(await page.locator('[data-action="vr-start-install"]').isEnabled(),true);
  const notApk=path.join(fixture,'invalid.txt');await fs.writeFile(notApk,'invalid');await drop([notApk]);
  assert.equal(await page.locator('.vr-apk-path').innerText(),apk);await drop([apk,notApk]);assert.equal(await page.locator('.vr-apk-path').innerText(),apk);
  await page.locator('[data-action="vr-start-install"]').click();
  await page.locator('[data-action="vr-start-install"]:disabled').waitFor();
  assert.equal(await page.locator('#vr-dropzone').isDisabled(),true);assert.equal(await page.locator('#vr-device-select').isDisabled(),true);
  await page.waitForTimeout(1200);assert.equal(await page.locator('.vr-install-result').count(),0);assert.equal(installRequests.length,1);
  jobMode='complete';await page.locator('.vr-install-result.is-success').waitFor();assert.equal(installRequests[0].file,apk);assert.equal(installRequests[0].device,'usb-one');
  jobMode='failed';await page.locator('[data-action="vr-start-install"]').click();await page.locator('.vr-install-result.is-error').waitFor();assert.match(await page.locator('.vr-install-result pre').innerText(),/UPDATE_INCOMPATIBLE/);
  deviceMode='two';await page.locator('[data-action="vr-refresh-devices"]').click();await page.locator('#vr-device-select option[value="usb-two"]:enabled').waitFor({state:'attached'});await page.locator('#vr-device-select').selectOption('usb-two');
  assert.equal(await page.locator('#vr-device-select').inputValue(),'usb-two');
  deviceMode='error';await page.locator('[data-action="vr-refresh-devices"]').click();await page.locator('.vr-install-error').waitFor();assert.equal(await page.locator('.vr-device-bar').getAttribute('data-device-count'),'0');assert.equal(await page.locator('[data-action="vr-start-install"]').isDisabled(),true);
  deviceMode='empty';await page.locator('[data-action="vr-refresh-devices"]').click();await page.waitForFunction(()=>document.querySelector('.vr-device-summary')?.textContent==='未连接设备');
  deviceMode='one';await page.locator('[data-action="vr-refresh-devices"]').click();await page.locator('.vr-device-bar[data-device-count="2"]').waitFor();
  await page.locator('[data-nav="projects"]').click();await page.locator('[data-nav="vr-install"]').click();assert.equal(await page.locator('.vr-apk-path').innerText(),apk);
  for(const theme of process.env.UE_VR_FOCUSED==='1'?['epic-launcher']:['dark-unreal','light-clean','dark-graphite','cyber-blue','epic-launcher']){
    await page.locator('#global-theme-picker [data-action="toggle-theme-picker"]').click();await page.locator('#global-theme-picker [data-theme-id="'+theme+'"]').click();
    for(const width of [1000,1440,1800]){
      await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,940),width);await page.waitForTimeout(90);
      const bounds=await page.locator('.vr-install-page').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth,window:innerWidth,document:document.documentElement.scrollWidth}));
      assert.ok(bounds.scroll<=bounds.width+1&&bounds.document<=bounds.window,'Overflow '+theme+' '+width+' '+JSON.stringify(bounds));
      await capture(theme+'-'+width+'.png');
    }
  }
  assert.equal(await page.locator('#vr-dropzone').getAttribute('type'),'button');
  await page.evaluate(()=>window.ueDesktopFlush());await close();app=await launch();await attach();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'epic-launcher');
  await page.locator('#vr-dropzone').click();await page.locator('.vr-apk-path').waitFor();assert.equal(await page.locator('.vr-apk-path').innerText(),apk);
  assert.deepEqual(errors,[]);checks.push('Hidden Electron: real file-path drag bridge + metadata endpoint; bad/multiple drops; selection and missing/error/unauthorized devices; install request and non-fabricated running/success/failure states; busy guards; theme and width matrix; normal close/restart; native picker fallback');
  await close();
  const report={fixture,version:JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version,checks,errors,installRequests,simulatedAdb:true,actualDeviceInstallation:false};
  await fs.writeFile(path.join(fixture,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(e){await capture('failure.png').catch(()=>{});console.error(fixture);throw e;}finally{if(app)await app.close().catch(()=>{});}
