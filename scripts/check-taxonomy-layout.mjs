import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DesktopStateStore} from '../desktop/state-store.mjs';
import {createUEProjectTools} from '../server/ue-project-tools.mjs';

const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),fixture=path.join(root,'.local/checks/taxonomy-layout-'+Date.now()),tools=createUEProjectTools({root:fixture,engineRegistry:async()=>[]});
const materialId='main-mv09069z-5wylv9',catalog=[],plugins=[],overrides={},pluginOverrides={};
const image='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="#475c72"/><circle cx="96" cy="96" r="60" fill="#9ebcd4"/></svg>').toString('base64');
for(let i=0;i<2;i++){
  const dir=path.join(fixture,'Project'+i);await fs.mkdir(path.join(dir,'Config'),{recursive:true});await fs.mkdir(path.join(dir,'Content'),{recursive:true});
  const file=path.join(dir,'Project'+i+'.uproject');await fs.writeFile(file,JSON.stringify({EngineAssociation:'5.8',...(i?{Modules:[{Name:'Game'}]}:{})}));if(i)await fs.writeFile(path.join(dir,'Project1.sln'),'fixture solution');
  catalog.push({id:'p'+i,name:'Project '+i,path:dir,nativeInfo:await tools.register(file),category:'old',status:'active',ue:'5.8',type:'UE 工程',plugins:[],imported:true});
  overrides['p'+i]={tags:['交互'],mainCategories:i?[]:[materialId],thumbnail:{cover:image,original:image,custom:true}};
  const folder=path.join(fixture,'Plugin'+i);await fs.mkdir(path.join(folder,'Source'),{recursive:true});const descriptor=path.join(folder,'Plugin'+i+'.uplugin');await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,FriendlyName:'Plugin '+i,EngineVersion:'5.8',Modules:[{Name:'Module'+i,Type:'Runtime'}]}));
  const info=await tools.inspectPlugin(descriptor);plugins.push({...info,nativePluginId:info.id,categoryName:i?'#c53af8':info.category,type:'source',typeLabel:info.category,blueprintNodes:[],tags:['交互'],accentClass:'',size:'未统计'});pluginOverrides[info.id]={thumbnail:{cover:image,original:image,custom:true}};
}
const store=new DesktopStateStore(path.join(fixture,'.local/desktop-data'));await store.load();
await store.set('ue-nexus-prototype-v1',JSON.stringify({catalog,order:catalog.map(p=>p.id),categories:[{id:'old',name:'交互',color:'#38bdf8'}],projectTagCatalog:['交互'],plugins,pluginOrder:plugins.map(p=>p.id),overrides,pluginOverrides,docsBindings:{},extraMainCategories:[{id:materialId,name:'#c53af8',color:'#c53af8'}]}));
const readState=async()=>JSON.parse(JSON.parse(await fs.readFile(store.file,'utf8')).values['ue-nexus-prototype-v1']);
const launch=()=>_electron.launch({executablePath:process.env.UE_DESKTOP_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.UE_DESKTOP_TEST_EXE?[]:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});
let app,page;const errors=[],launchRequests=[];
async function flush(){await page.evaluate(()=>window.ueDesktopFlush());}
async function sharedLayout(selector){
  assert.equal(await page.locator('#main-content [data-action="desktop-capture-cover"],#main-content [data-entry="ide"]').count(),0);
  assert.equal(await page.locator('.system-meta-label,.sidebar-system-info>.status-dot,.app-footer .status-dot,.library-context').count(),0);
  assert.equal(await page.locator('.desktop-library-tags').evaluate(tags=>tags.parentElement.classList.contains('category-toolbar')),true);
  const rowPositions=await page.locator('.xm-unified-category-bar').evaluate(bar=>{const main=bar.querySelector('.category-tabs').getBoundingClientRect(),tags=bar.querySelector('.desktop-library-tags').getBoundingClientRect();return {mainBottom:main.bottom,tagsTop:tags.top,tagsBorder:getComputedStyle(bar.querySelector('.desktop-library-tags')).borderTopWidth};});assert.ok(rowPositions.tagsTop>=rowPositions.mainBottom,'custom tags must be below main categories');assert.equal(rowPositions.tagsBorder,'0px');
  const counts=await page.locator('.category-tabs .category-pill small').evaluateAll(nodes=>nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)));assert.ok(counts.length>0&&counts.every(size=>size>=12));
  const cards=await page.locator(selector).evaluateAll(nodes=>nodes.map(card=>{const rect=card.getBoundingClientRect(),panel=card.querySelector('.card-content');return {width:rect.width,height:rect.height,blur:getComputedStyle(panel).backdropFilter};}));
  for(const card of cards){assert.ok(card.width>card.height,JSON.stringify(card));assert.match(card.blur,/blur\([\d.]+px\)/);}
}
try{
  app=await launch();page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.locator('[data-project-card="p0"]').waitFor();await flush();
  let saved=await readState();assert.equal(saved.extraMainCategories[0].name,'素材库');assert.equal(saved.extraMainCategories[0].color,'#c53af8');assert.deepEqual(saved.overrides.p0.mainCategories,[materialId]);assert.equal(saved.plugins[1].categoryName,'素材库');
  await page.locator('#desktop-gallery-size').selectOption('regular');
  for(const width of [1000,1440,1800]){await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,900),width);await sharedLayout('[data-project-card]');}
  await page.route('**/api/ue/launch',async route=>{const body=route.request().postDataJSON();launchRequests.push(body);await route.fulfill({contentType:'application/json',body:JSON.stringify({kind:body.id===catalog[0].nativeInfo.id?'blueprint':'cpp'})});});
  for(const id of ['p0','p1'])await page.locator(`[data-project-card="${id}"] [data-action="launch"]`).click();
  await page.waitForFunction(()=>document.getElementById('toast').textContent.includes('.sln'));assert.equal(launchRequests.length,2);for(let i=0;i<2;i++){assert.equal(launchRequests[i].id,catalog[i].nativeInfo.id);assert.equal(launchRequests[i].entry,'default');}
  await page.locator('[data-action="desktop-manage-labels"]').click();
  assert.equal(await page.locator('.unified-taxonomy-modal [data-action="desktop-save-coarse-label"],.unified-taxonomy-modal [data-action="desktop-rename-label"],.unified-taxonomy-modal [data-action="xm-taxonomy-rename-main"]').count(),0);
  const cpp=page.locator('[data-coarse-row="C++"] [data-taxonomy-name]');await cpp.evaluate(el=>window.__editingField=el);await cpp.fill('功能源码');
  await page.waitForFunction(()=>document.querySelector('[data-action="desktop-tech-filter"][data-id="C++"]').textContent.includes('功能源码'));
  assert.equal(await cpp.evaluate(el=>el===window.__editingField),true,'typing must not recreate the modal');await page.locator('[data-xm-color-key="C++"]').fill('#e58036');await flush();
  saved=await readState();assert.equal(saved.coarseLabelSettings['C++'].name,'功能源码');assert.equal(saved.coarseLabelSettings['C++'].color,'#e58036');assert.equal(await cpp.inputValue(),'功能源码');
  await page.locator(`[data-main-row="${materialId}"] [data-taxonomy-name]`).fill('公共素材');await flush();saved=await readState();assert.equal(saved.extraMainCategories[0].name,'公共素材');assert.equal(saved.extraMainCategories[0].color,'#c53af8');assert.equal(saved.plugins[1].categoryName,'公共素材');
  await page.locator('[data-label-row="交互"] [data-taxonomy-name]').fill('交互模块');await flush();saved=await readState();assert.deepEqual(saved.projectTagCatalog,['交互模块']);for(const id of ['p0','p1'])assert.ok(saved.overrides[id].tags.includes('交互模块'));for(const p of saved.plugins)assert.ok(saved.pluginOverrides[p.id].tags.includes('交互模块'));
  await page.locator('[data-action="close-modal"]').last().click();await page.locator('[data-nav="plugins"]').click();await page.locator('[data-action="plugin-view"][data-id="grid"]').click();await sharedLayout('[data-plugin-card]');
  await page.locator('[data-action="desktop-manage-labels"]').click();await page.locator('[data-plugin-coarse-row="源码插件"] [data-taxonomy-name]').fill('功能插件');await page.locator('[data-xm-color-key="源码插件"]').fill('#63b7ed');await flush();saved=await readState();assert.equal(saved.pluginCategoryLabels['源码插件'].name,'功能插件');assert.equal(saved.pluginCategoryLabels['源码插件'].color,'#63b7ed');
  await page.locator('[data-action="close-modal"]').last().click();await page.locator('[data-plugin-card]').first().locator('[data-action="plugin-thumbnail"]').click();await page.locator('.image-upload-row [data-action="desktop-capture-cover"]').waitFor();await page.locator('[data-action="close-modal"]').last().click();
  await page.locator('[data-nav="projects"]').click();await page.locator('[data-project-card="p0"] [data-action="thumbnail"]').click();await page.locator('.image-upload-row [data-action="desktop-capture-cover"]').waitFor();
  await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('desktop:capture-cover');ipcMain.handle('desktop:capture-cover',async()=>null);});
  await page.locator('.image-upload-row [data-action="desktop-capture-cover"]').click();assert.equal(await page.locator('#modal-backdrop').evaluate(el=>el.hidden),false);assert.equal((await readState()).overrides.p0.thumbnail.cover,image);
  await app.evaluate(({ipcMain,nativeImage})=>{ipcMain.removeHandler('desktop:capture-cover');const bitmap=nativeImage.createFromBitmap(Buffer.from([180,120,90,255]),{width:1,height:1}).resize({width:128,height:72});ipcMain.handle('desktop:capture-cover',async()=>({dataUrl:'data:image/jpeg;base64,'+bitmap.toJPEG(88).toString('base64'),width:128,height:72}));});
  await page.locator('.image-upload-row [data-action="desktop-capture-cover"]').click();await page.waitForFunction(()=>document.getElementById('modal-backdrop').hidden);await flush();saved=await readState();assert.equal(saved.overrides.p0.thumbnail.width,128);assert.equal(saved.overrides.p0.thumbnail.source,'屏幕截图');assert.match(saved.overrides.p0.thumbnail.cover,/^data:image\/jpeg;base64,/);assert.equal(await page.locator('#main-content [data-action="desktop-capture-cover"]').count(),0);
  await page.locator('[data-action="desktop-manage-labels"]').click();await page.locator('[data-coarse-row="C++"] [data-taxonomy-name]').fill('C++ 功能工程');await app.close();app=await launch();page=await app.firstWindow();await page.locator('[data-project-card="p0"]').waitFor();saved=await readState();assert.equal(saved.coarseLabelSettings['C++'].name,'C++ 功能工程');assert.equal(await page.locator('#desktop-gallery-size').inputValue(),'regular');assert.equal(saved.extraMainCategories[0].name,'公共素材');assert.equal(saved.overrides.p0.thumbnail.source,'屏幕截图');assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:['confirmed category restored preserving identity and color','landscape standard cards at three widths with frost','main category row above custom tags, no inner divider, larger counters','no connection indicators or project count tips','primary launch uses native default for blueprint and C++','name and color auto-save independently','modal input retains caret/identity','custom category rename preserves plugin references','tag rename updates both libraries','capture only in cover customization, cancel preserves and confirm saves','pending names and card size survive restart'],fixture}));
}catch(error){console.error(error.stack+'\nFixture: '+fixture);throw error;}finally{await app?.close().catch(()=>{});}
