import fs from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';
import {createLocalApiHandler} from '../server/local-api-handler.mjs';import {createUEProjectTools} from '../server/ue-project-tools.mjs';
const root=path.resolve('.local/checks/vr-task-isolation-'+Date.now());await fs.mkdir(path.join(root,'sdk/platform-tools'),{recursive:true});await fs.writeFile(path.join(root,'sdk/platform-tools/adb.exe'),'fixture');const apk=path.join(root,'test.apk');await fs.writeFile(apk,'fixture');process.env.ANDROID_HOME=path.join(root,'sdk');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};const installGate=deferred(),stopGate=deferred();const checks=[];
const tools=createUEProjectTools({root,engineRegistry:async()=>[],runner:async(file,args)=>{
 if(args[0]==='devices')return {code:0,stdout:'List of devices attached\nfixture device model:PICO_4\n',stderr:''};
 if(args.includes('install')){await installGate.promise;return {code:0,stdout:'Success\n',stderr:''};}
 const cmd=args[3]||'';if(cmd.includes('getprop'))return {code:0,stdout:'Pico\nA8110\nPICO 4 Pro\n10\n',stderr:''};
 if(cmd.includes("'pm' 'list'"))return {code:0,stdout:'package:com.example.game\n',stderr:''};
 if(cmd.includes("'am' 'force-stop'")){await stopGate.promise;return {code:0,stdout:'',stderr:''};}
 throw Error('Unexpected fixture command');
}});
const install=await tools.installApk(null,{file:apk,device:'fixture'}),stop=await tools.vr.handle('stop',null,{device:'fixture',package:'com.example.game'});
assert.equal(tools.job(install.jobId).scope,'device');assert.equal(tools.job(stop.jobId).scope,'device');assert.equal(tools.runningJobs().length,2);assert.equal(tools.projectRunningJobs().length,0);
assert.equal((await tools.refreshProjects({projects:[]})).skipped,undefined);
await assert.rejects(tools.installApk(null,{file:apk,device:'fixture'}),/正在安装/);
let startError;try{await tools.workflow.start({});}catch(e){startError=e.message;}assert.ok(startError);assert.doesNotMatch(startError,/请等待当前工程任务完成/);checks.push('Device install and VR jobs do not occupy the project lock; duplicate install and close protection remain');
let active=true;const dispatched=[];const services={workflow:{runningJobs:()=>active?[{status:'running'}]:[],pause:async()=>({paused:true})},devices:async()=>[{serial:'fixture',status:'device'}],apkInfo:async()=>({name:'test.apk'}),pick:async()=>root,installApk:async()=>({jobId:'install'}),vr:{handle:async(action,id,body)=>{dispatched.push(action);return {action,device:body.device};}},apply:async()=>({applied:true}),projectRunningJobs:()=>[],runningJobs:()=>[{scope:'device',status:'running'}],delivery:{clearTranslationCache:async()=>({cleared:true}),pauseTranslation:async()=>({paused:true})}};
const server=http.createServer(createLocalApiHandler({tools:services}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
async function post(action,body={},origin){const r=await fetch(base+'/api/ue/'+action,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});return {status:r.status,value:await r.json()};}
try{
 for(const action of ['devices','apk-info','install-apk','pick'])assert.equal((await post(action)).status,200,action);
 const deviceActions=['apps','app-info','memory','storage','files','thumbnail','logs','launch','stop','uninstall','export-apk','pull','push','delete','screenshot','export-logs','cleanup-scan','cleanup-apply'];
 for(const action of deviceActions){const r=await post('vr/'+action,{device:'fixture'});assert.equal(r.status,200,action);assert.equal(r.value.action,action);}
 for(const action of ['apply','generate-keystore','android/start','fab/apply','delivery/configure','delivery/one-click','delivery/clear-translation-cache']){const r=await post(action);assert.equal(r.status,500,action);assert.match(r.value.error,/一键处理正在运行/);}
 assert.equal((await post('delivery/one-click-pause')).status,200);assert.equal((await post('delivery/pause-translation')).status,200);
 assert.equal((await post('vr/apps',{},'http://untrusted.invalid')).status,403);checks.push('Active one-click task allows all VR routes, device detection, APK metadata/install and picker; project writes still blocked; pause and origin checks preserved');
 active=false;assert.equal((await post('apply')).status,200);assert.equal((await post('delivery/clear-translation-cache')).status,200);checks.push('Project cache cleanup ignores device-only jobs once translation stops');
}finally{await new Promise(r=>server.close(r));installGate.resolve();stopGate.resolve();}
for(const id of [install.jobId,stop.jobId]){for(let i=0;i<100&&tools.job(id).status==='running';i++)await new Promise(r=>setTimeout(r,5));assert.equal(tools.job(id).status,'complete');}assert.equal(tools.runningJobs().length,0);
await fs.writeFile(path.join(root,'report.json'),JSON.stringify({checks,simulatedWorkflow:true,simulatedDevice:true,actualUEExecutions:false,actualDeviceWrites:false},null,2));console.log(JSON.stringify({passed:true,root,checks,deviceRoutes:dispatched.length}));
