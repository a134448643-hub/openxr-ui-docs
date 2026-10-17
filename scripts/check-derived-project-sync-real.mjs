import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const workspace=process.cwd(),version=JSON.parse(await fs.readFile('package.json')).version;
const root=path.resolve('.local/checks/derived-project-sync-'+version),isolated=path.join(root,'workspace');
const stateFile=path.join(workspace,'.local/desktop-data/renderer-state.json'),historyFile=path.join(workspace,'.local/project-delivery-state/generated-projects.json');
const history=JSON.parse(await fs.readFile(historyFile,'utf8')),original=JSON.parse(await fs.readFile(stateFile,'utf8')),renderer=JSON.parse(original.values['ue-nexus-prototype-v1']);
const latest=history.filter(p=>p.processingState==='completed').sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];
assert.ok(latest?.descriptorPath);await fs.access(latest.descriptorPath);
const source=renderer.catalog.find(p=>p.nativeInfo?.descriptorPath?.toLowerCase()===latest.sourceDescriptor.toLowerCase());assert.ok(source);
const key=value=>String(value||'').replaceAll('\\','/').toLowerCase();
async function fingerprint(descriptor){const folder=path.dirname(descriptor),hash=crypto.createHash('sha256');let count=0;async function walk(dir){for(const item of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else if(item.isFile()){hash.update(path.relative(folder,file));hash.update(await fs.readFile(file));count++;}else throw Error('Unexpected linked project entry');}}for(const dir of ['Content','Config'])await walk(path.join(folder,dir));hash.update(await fs.readFile(descriptor));return {files:count+1,sha256:hash.digest('hex')};}
const before={source:await fingerprint(latest.sourceDescriptor),derived:await fingerprint(latest.descriptorPath)};
await fs.mkdir(path.join(isolated,'.local/desktop-data'),{recursive:true});await fs.mkdir(path.join(isolated,'.local/project-delivery-state'),{recursive:true});
// Use the user's real source metadata and real completed outputs. No test UE
// project, asset, model response, or delivery configuration is created/copied.
await fs.writeFile(path.join(isolated,'.local/desktop-data/renderer-state.json'),JSON.stringify({version:1,values:{'ue-pm-theme':original.values['ue-pm-theme'],'ue-nexus-prototype-v1':JSON.stringify({...renderer,catalog:[source],order:[source.id],projectId:source.id}),'ue-project-workflow-v1':JSON.stringify({path:'',stage:'translation'})}}));
await fs.writeFile(path.join(isolated,'.local/project-delivery-state/generated-projects.json'),JSON.stringify(history));
await fs.mkdir(path.join(isolated,'.local/ue-manager'),{recursive:true});await fs.writeFile(path.join(isolated,'.local/ue-manager/projects.json'),JSON.stringify({projects:[{id:source.nativeInfo.id,descriptorPath:latest.sourceDescriptor}]}));
const errors=[],requests=[];let app,page;
async function launch(){const env={...process.env,UE_DESKTOP_WORKSPACE:isolated,UE_DESKTOP_SMOKE:'1'};delete env.ELECTRON_RUN_AS_NODE;app=await _electron.launch({executablePath:path.join(workspace,'.local/desktop-build/release',version,'PersonalDevPlatform-win32-x64/PersonalDevPlatform.exe'),args:[],env,timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const u=new URL(r.url());if(u.pathname.startsWith('/api/ue/'))requests.push({method:r.method(),path:u.pathname,query:u.search});});await page.waitForFunction(()=>window.ueProjectAvailability?.size>0&&!window.ueProjectRefreshPending);}
async function saved(){await page.evaluate(()=>window.ueDesktopFlush());return JSON.parse(JSON.parse(await fs.readFile(path.join(isolated,'.local/desktop-data/renderer-state.json'),'utf8')).values['ue-nexus-prototype-v1']);}
async function close(){await saved();const closed=app.waitForEvent('close');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;app=null;}
const navigate=route=>page.evaluate(route=>document.querySelector(`[data-nav="${route}"]`).click(),route);
async function capture(name){const png=await app.evaluate(async({BrowserWindow})=>{const contents=BrowserWindow.getAllWindows()[0].webContents;contents.setBackgroundThrottling(false);await contents.capturePage(undefined,{stayHidden:true,stayAwake:true});contents.invalidate();await new Promise(resolve=>setTimeout(resolve,150));return (await contents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64');});await fs.writeFile(path.join(root,name),Buffer.from(png,'base64'));}
try{
 await launch();assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
 let data=await saved(),child=data.catalog.find(p=>key(p.nativeInfo?.descriptorPath)===key(latest.descriptorPath));assert.ok(child,'Completed output must recover automatically at startup');
 assert.equal(child.parentProjectId,source.id);assert.equal(child.projectRole,'derived');assert.equal(child.processingState,'completed');assert.equal(child.name,source.name+'_衍生');
 assert.match(await page.locator(`[data-project-card="${child.id}"]`).innerText(),/处理完成/);
 const actualGenerated=await page.evaluate(async()=>fetch('/api/ue/delivery/generated-projects').then(r=>r.json()));
 const valid=new Set(actualGenerated.map(p=>key(p.descriptorPath)));assert.ok(data.catalog.filter(p=>p.projectRole==='derived').every(p=>valid.has(key(p.nativeInfo.descriptorPath))),'Deleted historical outputs must stay absent');
 await capture('project-library.png');
 // Reproduce a stale missing flag, then invoke the real completed-output sync
 // through the existing Fab entry. This never uses the computer's mouse.
 await page.evaluate(descriptor=>window.ueProjectAvailability.set(descriptor.replaceAll('\\','/').toLowerCase(),{descriptorPath:descriptor,status:'missing'}),latest.descriptorPath);
 await navigate('project-translation');await page.evaluate(()=>document.querySelector('#pt-tab-fab').click());
 await page.waitForFunction(descriptor=>window.ueProjectAvailability.get(descriptor.replaceAll('\\','/').toLowerCase())?.status==='available',latest.descriptorPath);
 await page.evaluate(()=>window.ueRefreshProjectLibrary());data=await saved();assert.equal(data.catalog.filter(p=>key(p.nativeInfo?.descriptorPath)===key(latest.descriptorPath)).length,1);
 await navigate('configuration');await page.locator('#ue-config-project').selectOption(child.id);
 await page.waitForFunction(id=>document.querySelector('#ue-config-project')?.value===id,child.id);data=await saved();assert.equal(data.projectId,child.id);
 assert.ok(requests.some(r=>r.path==='/api/ue/settings'&&r.query.includes(encodeURIComponent(child.nativeInfo.id))),'Packaging configuration must load the derived project');
 await capture('packaging-target.png');
 await close();await launch();await navigate('configuration');assert.equal(await page.locator('#ue-config-project').inputValue(),child.id);
 data=await saved();assert.equal(data.catalog.filter(p=>key(p.nativeInfo?.descriptorPath)===key(latest.descriptorPath)).length,1);
 assert.deepEqual(errors,[]);await close();
 const after={source:await fingerprint(latest.sourceDescriptor),derived:await fingerprint(latest.descriptorPath)};assert.deepEqual(after,before);
 assert.deepEqual(JSON.parse(await fs.readFile(historyFile,'utf8')),history);
 const mutations=requests.filter(r=>r.method==='POST');assert.ok(mutations.every(r=>['/api/ue/register','/api/ue/refresh-projects'].includes(r.path)),JSON.stringify(mutations));
 const report={success:true,version,source:latest.sourceDescriptor,derived:latest.descriptorPath,childId:child.id,checks:['real completed output restored from source-only library','stale missing flag cleared by fresh validated generated output','manual refresh deduplicates same path','deleted historical outputs remain excluded','derived project selectable in packaging and correct native config loaded','normal restart retains project and packaging selection','real source and derived Content/Config/uproject hashes unchanged','hidden windows; no UE, copy, translation or packaging operations'],before,after,errors};
 await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){await fs.writeFile(path.join(root,'failure.json'),JSON.stringify({error:error.stack,errors,requests},null,2));throw error;}finally{if(app){const closed=app.waitForEvent('close',{timeout:10000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;}}
