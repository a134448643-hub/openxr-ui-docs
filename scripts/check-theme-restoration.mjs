import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DesktopStateStore} from '../desktop/state-store.mjs';
const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),fixture=path.join(root,'.local/checks/theme-restoration-'+Date.now()),store=new DesktopStateStore(path.join(fixture,'.local/desktop-data'));
const project={id:'theme-sample',name:'保留的工程',path:'T:\\StyleFixture\\Sample',ue:'5.8',type:'UE 工程',category:'original',status:'active',plugins:[],imported:true};
const override={tags:['原标签'],classification:{valid:true,coarseTags:['纯蓝图']},description:'保留的项目简介'};
await store.load();await store.set('ue-pm-theme','apple-dark-glass');await store.set('ue-nexus-prototype-v1',JSON.stringify({theme:'apple-dark-glass',catalog:[project],order:[project.id],categories:[{id:'original',name:'原标签',color:'#38bdf8'}],projectTagCatalog:['原标签'],overrides:{[project.id]:override},plugins:[],docsBindings:{[project.id]:'original-document'},gallerySize:'regular'}));
const read=async()=>JSON.parse(await fs.readFile(store.file,'utf8'));
const launch=()=>_electron.launch({executablePath:process.env.UE_DESKTOP_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.UE_DESKTOP_TEST_EXE?[]:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});
let app,page;const errors=[];
try{
  app=await launch();page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.locator('[data-project-card]').waitFor();await page.evaluate(()=>window.ueDesktopFlush());
  const appearance=await page.evaluate(()=>({theme:document.documentElement.dataset.theme,bg:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),text:getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),body:getComputedStyle(document.body).backgroundColor,ambient:getComputedStyle(document.body,'::before').backgroundImage}));
  assert.equal(appearance.theme,'dark-unreal');assert.equal(appearance.bg,'#080d16');assert.equal(appearance.text,'#e6f0fc');assert.equal(appearance.body,'rgb(8, 13, 22)');assert.equal(appearance.ambient,'none');
  let raw=await read(),state=JSON.parse(raw.values['ue-nexus-prototype-v1']);assert.equal(raw.values['ue-pm-theme'],'dark-unreal');assert.equal(state.theme,'dark-unreal');assert.deepEqual(state.catalog,[project]);assert.deepEqual(state.overrides[project.id],override);assert.equal(state.docsBindings[project.id],'original-document');
  await page.locator('[data-action="toggle-theme-picker"]').click();assert.deepEqual(await page.locator('[data-action="set-theme"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.themeId)),['dark-unreal','light-clean','dark-graphite','cyber-blue','epic-launcher']);
  await page.locator('[data-action="set-theme"][data-theme-id="dark-graphite"]').click();assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()),'#111317');
  await page.locator('[data-action="toggle-theme-picker"]').click();await page.locator('[data-action="set-theme"][data-theme-id="dark-unreal"]').click();await page.evaluate(()=>window.ueDesktopFlush());
  await app.close();app=await launch();page=await app.firstWindow();await page.locator('[data-project-card]').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark-unreal');raw=await read();state=JSON.parse(raw.values['ue-nexus-prototype-v1']);assert.deepEqual(state.catalog,[project]);assert.deepEqual(state.overrides[project.id],override);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:['old dark-unreal background and text palette','no colorful ambient mesh','removed Apple preference migrated and saved','four original themes and new Epic option available','project records, labels and document binding preserved','classic theme survives restart'],fixture}));
}finally{await app?.close().catch(()=>{});}
