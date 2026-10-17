import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=process.cwd(),version=JSON.parse(await fs.readFile('package.json')).version,fixture=path.join(root,'.local/checks/hidden-relaunch-'+Date.now());
await fs.mkdir(fixture,{recursive:true});
const exe=path.join(root,'.local/desktop-build/release',version,'PersonalDevPlatform-win32-x64/PersonalDevPlatform.exe');
const env={...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'};delete env.ELECTRON_RUN_AS_NODE;
let app;
try{
 app=await _electron.launch({executablePath:exe,args:[],cwd:root,env});
 const page=await app.firstWindow();await page.waitForFunction(()=>window.ueDesktopBootstrap?.desktop);
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
 const second=spawn(exe,[],{cwd:root,env,windowsHide:true,stdio:'ignore'});
 const exited=new Promise((resolve,reject)=>{second.on('error',reject);second.on('close',code=>code===0?resolve():reject(Error('Second launch failed: '+code)));});
 for(let i=0;i<100;i++){if(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()))break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
 await exited;
 const state=await app.evaluate(({BrowserWindow})=>{const windows=BrowserWindow.getAllWindows();return {count:windows.length,visible:windows[0].isVisible(),title:windows[0].getTitle()};});assert.equal(state.count,1);
 const report={version,fixture,passed:['real packaged app loads while initially hidden','actual second executable launch exits through the single-instance lock','existing hidden main window becomes visible','one existing platform window retained'],state};
 await fs.writeFile(path.join(fixture,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await app?.close().catch(()=>{});}
