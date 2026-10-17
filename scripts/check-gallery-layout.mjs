import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DesktopStateStore} from '../desktop/state-store.mjs';
import {createUEProjectTools} from '../server/ue-project-tools.mjs';

const require=createRequire(import.meta.url);
const {_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),fixture=path.join(root,'.local/checks/gallery-layout-'+Date.now());
const tools=createUEProjectTools({root:fixture,engineRegistry:async()=>[]}),catalog=[],plugins=[],overrides={},pluginOverrides={};
const image='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="#3e576a"/><circle cx="96" cy="96" r="54" fill="#7fa2bd"/></svg>').toString('base64');
for(let i=0;i<4;i++){
  const dir=path.join(fixture,'Project'+i);await fs.mkdir(path.join(dir,'Config'),{recursive:true});await fs.mkdir(path.join(dir,'Content'),{recursive:true});
  const file=path.join(dir,'Project'+i+'.uproject');await fs.writeFile(file,JSON.stringify({EngineAssociation:'5.8',...(i===1?{Modules:[{Name:'Game'}]}:{})}));
  const nativeInfo=await tools.register(file);
  catalog.push({id:'p'+i,name:'Project '+i+' · 可以水平显示的长标题',description:'简介只保留在资料页',ue:'5.8',type:'UE 工程',path:dir,nativeInfo,status:'active',category:'legacy',plugins:[],imported:true,activity:'刚刚导入'});
  overrides['p'+i]={tags:['示例标签'],...(i===3?{}:{thumbnail:{cover:image,custom:true,width:192,height:192}})};
  const folder=path.join(fixture,'Plugin'+i);await fs.mkdir(path.join(folder,'Source'),{recursive:true});
  const descriptor=path.join(folder,'Plugin'+i+'.uplugin');await fs.writeFile(descriptor,JSON.stringify({FileVersion:3,FriendlyName:'Plugin '+i+' · 水平插件标题',EngineVersion:'5.8',Modules:[{Name:'Module'+i,Type:i===1?'Editor':'Runtime'}]}));
  const info=await tools.inspectPlugin(descriptor);plugins.push({...info,nativePluginId:info.id,categoryName:info.category,type:'source',typeLabel:info.category,blueprintNodes:[],tags:['示例标签'],accentClass:'',size:'未统计'});
  pluginOverrides[info.id]=i===3?{}:{thumbnail:{cover:image,custom:true,width:192,height:192}};
}
const store=new DesktopStateStore(path.join(fixture,'.local/desktop-data'));await store.load();
await store.set('ue-nexus-prototype-v1',JSON.stringify({catalog,order:catalog.map(p=>p.id),categories:[{id:'legacy',name:'示例标签',color:'#fbbf24'}],projectTagCatalog:['示例标签'],plugins,pluginOrder:plugins.map(p=>p.id),overrides,pluginOverrides,docsBindings:{}}));
const launch=()=>_electron.launch({executablePath:process.env.UE_DESKTOP_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.UE_DESKTOP_TEST_EXE?[]:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});
let app,page;const errors=[];
async function checkGrid(selector){
  await page.waitForFunction(selector=>[...document.querySelectorAll(selector+' .cover>img')].every(img=>img.complete&&img.naturalWidth),selector);
  const metrics=await page.locator(selector).evaluateAll(cards=>cards.map(card=>{
    const rect=card.getBoundingClientRect(),cover=card.querySelector('.cover').getBoundingClientRect(),image=card.querySelector('.cover>img').getBoundingClientRect(),engine=card.querySelector('.xm-card-engine').getBoundingClientRect(),tools=card.querySelector('.xm-card-tools').getBoundingClientRect(),stripe=card.querySelector('.card-category-stripe');
    const panel=card.querySelector('.card-content'),panelRect=panel.getBoundingClientRect();return {blur:getComputedStyle(panel).backdropFilter,panelBackground:getComputedStyle(panel).backgroundColor,imageUnderPanel:image.bottom>=panelRect.bottom-1&&image.top<panelRect.top,titleSize:parseFloat(getComputedStyle(card.querySelector('.project-title')).fontSize),gripCount:card.querySelectorAll('.desktop-project-drag-handle,.card-title .drag-handle').length,imageFit:getComputedStyle(card.querySelector('.cover>img')).objectFit,coverWidth:cover.width,cardWidth:rect.width,imageWidth:image.width,imageHeight:image.height,coverHeight:cover.height,toolbarInside:tools.top>=cover.top&&tools.bottom<=cover.bottom,coverLeft:cover.left-rect.left,decoration:getComputedStyle(card,'::before').backgroundImage,height:rect.height,aligned:Math.abs((engine.top+engine.height/2)-(tools.top+tools.height/2)),overlap:engine.right>tools.left+1,stripeHeight:stripe.getBoundingClientRect().height,stripeColor:getComputedStyle(stripe).backgroundColor,border:getComputedStyle(card).borderColor,tint:getComputedStyle(card.querySelector('.cover')).backgroundColor,overflow:[...card.querySelectorAll('.xm-card-tools>button')].some(button=>{const r=button.getBoundingClientRect();return r.left<rect.left+3||r.right>rect.right-3||r.top<rect.top+3;})};
  }));
  for(const m of metrics){assert.match(m.blur,/blur\([\d.]+px\)/);assert.equal(m.imageUnderPanel,true);assert.match(m.panelBackground,/rgba/);assert.ok(m.titleSize>=17);assert.equal(m.gripCount,0);assert.doesNotMatch(m.decoration,/url\(/);assert.ok(m.height<350,JSON.stringify(m));assert.ok(m.cardWidth>m.height,'cards should be landscape');assert.ok(m.aligned<=2,JSON.stringify(m));assert.equal(m.overlap,false);assert.equal(m.stripeHeight,3);assert.notEqual(m.border,m.stripeColor);assert.equal(m.overflow,false);assert.equal(m.imageFit,'cover');assert.ok(Math.abs(m.imageWidth-m.coverWidth)<1);assert.ok(Math.abs(m.imageHeight-m.coverHeight)<1);assert.ok(m.coverLeft<=1.1);assert.ok(m.cardWidth-m.coverWidth<=2.1);assert.equal(m.toolbarInside,true);assert.equal(m.decoration,'none');}
  assert.equal(await page.locator(selector+' .card-description,'+selector+' .cover-bottom').count(),0);
}
async function checkList(selector){
  const metrics=await page.locator(selector).evaluateAll(rows=>rows.map(row=>{const r=row.getBoundingClientRect(),title=row.querySelector('.project-title').getBoundingClientRect(),image=row.querySelector('.project-list-thumb-wrap').getBoundingClientRect();return {height:r.height,titleWidth:title.width,titleHeight:title.height,imageRight:image.right,titleLeft:title.left,contentOverflow:row.scrollWidth>row.clientWidth+1,buttonsOutside:[...row.querySelectorAll('.card-actions button')].some(button=>{const b=button.getBoundingClientRect();return b.width&&(b.left<r.left||b.right>r.right);})};}));
  for(const m of metrics){assert.ok(m.height<=100,JSON.stringify(m));assert.ok(m.titleWidth>100,JSON.stringify(m));assert.ok(m.titleHeight<=24);assert.ok(m.titleLeft>m.imageRight);assert.equal(m.contentOverflow,false);assert.equal(m.buttonsOutside,false);}
  assert.equal(await page.locator(selector+' .card-category-stripe').count(),0);assert.equal(await page.locator(selector+' .desktop-project-drag-handle').count(),0);
}
try{
  app=await launch();page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));await page.locator('[data-project-card="p0"]').waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-project-card="p0"]').dataset.nativeWidth==='192');
  await page.mouse.move(850,0);
  const brand=await page.locator('.brand strong').evaluate(el=>({color:getComputedStyle(el).color,shadow:getComputedStyle(el).textShadow,normal:getComputedStyle(el).getPropertyValue('--text')}));assert.equal(brand.shadow,'none');
  assert.match(await page.locator('.brand-logo-img').evaluate(el=>getComputedStyle(el).filter),/drop-shadow/);
  await page.locator('.brand').hover();await page.waitForTimeout(250);const hovered=await page.locator('.brand strong').evaluate(el=>({color:getComputedStyle(el).color,shadow:getComputedStyle(el).textShadow}));assert.notEqual(hovered.color,brand.color);assert.notEqual(hovered.shadow,'none');await page.mouse.move(850,0);
  for(const width of [1000,1440,1800]){
    await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,900),width);
    await page.locator('[data-nav="projects"]').click();await page.locator('[data-action="view"][data-id="grid"]').click();await checkGrid('[data-project-card]');
    await page.locator('[data-action="view"][data-id="list"]').click();await checkList('[data-project-card]');
    await page.locator('[data-nav="plugins"]').click();await page.locator('[data-action="plugin-view"][data-id="grid"]').click();await checkGrid('[data-plugin-card]');
    await page.locator('[data-action="plugin-view"][data-id="list"]').click();await checkList('[data-plugin-card]');
  }
  // Selection and group tag assignment also work in the actual list structure.
  await page.locator('[data-nav="projects"]').click();await page.locator('[data-action="view"][data-id="grid"]').click();
  await page.locator('[data-project-card="p0"] .card-title').dragTo(page.locator('[data-project-card="p2"] .card-title'));await page.evaluate(()=>window.ueDesktopFlush());
  const reordered=JSON.parse(JSON.parse(await fs.readFile(store.file,'utf8')).values['ue-nexus-prototype-v1']);assert.ok(reordered.order.indexOf('p0')>0,'whole-card sorting must work without a grip icon');
  await page.locator('[data-action="view"][data-id="list"]').click();await page.locator('[data-action="desktop-bulk-toggle"]').click();
  for(const id of ['p0','p1'])await page.locator(`[data-project-card="${id}"] [data-action="desktop-bulk-item"]`).click();
  await page.locator('[data-project-card="p0"] .project-list-name').dragTo(page.locator('[data-desktop-drop-vr]'));await page.evaluate(()=>window.ueDesktopFlush());
  const saved=JSON.parse(JSON.parse(await fs.readFile(store.file,'utf8')).values['ue-nexus-prototype-v1']);for(const id of ['p0','p1'])assert.equal(saved.overrides[id].vrOverride,true);assert.equal(saved.overrides.p2.vrOverride,undefined);
  await page.locator('.desktop-bulk-toolbar [data-action="desktop-bulk-toggle"]').click();
  await page.locator('[data-action="desktop-manage-labels"]').click();await page.locator('[data-xm-color-key="纯蓝图"]').fill('#fb7185');await page.locator('[data-action="close-modal"]').last().click();
  await page.locator('[data-action="view"][data-id="grid"]').click();const color=await page.locator('[data-project-card="p0"]').evaluate(card=>({border:getComputedStyle(card).borderColor,stripe:getComputedStyle(card.querySelector('.card-category-stripe')).backgroundColor,tint:getComputedStyle(card.querySelector('.cover')).backgroundColor}));assert.equal(color.stripe,'rgb(251, 113, 133)');const placeholder=await page.locator('[data-project-card="p3"] .cover>img').getAttribute('src');assert.match(decodeURIComponent(placeholder),/#fb7185/);assert.doesNotMatch(decodeURIComponent(placeholder),/#fbbf24/);assert.notEqual(color.border,color.stripe);assert.equal(color.tint,await page.locator('[data-project-card="p1"] .cover').evaluate(el=>getComputedStyle(el).backgroundColor),'category changes must not tint the image background');assert.equal(await page.locator('[data-project-card="p0"] .cover>img').getAttribute('src'),image,'color changes must preserve the real thumbnail');
  await page.locator('[data-action="view"][data-id="list"]').click();await page.locator('[data-nav="plugins"]').click();await page.evaluate(()=>window.ueDesktopFlush());
  await app.close();app=await launch();page=await app.firstWindow();await page.locator('[data-project-card="p0"]').waitFor();assert.equal(await page.locator('.xm-library-row').count(),4);await page.locator('[data-nav="plugins"]').click();assert.equal(await page.locator('.xm-library-row[data-plugin-card]').count(),4);await checkList('[data-plugin-card]');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:['neutral perimeter with category color only on 3px top stripe','logo glyph glow and hover-only brand glow','same-line engine badge and toolbar over the cover','single full-bleed cover behind genuine frosted panel, 17px titles and no drag icons','project and plugin grid/list at 1000/1440/1800px','list title stays horizontal','whole-card sorting and bulk list drag work without grip icons','grid/list preference survives restart'],fixture}));
}catch(error){console.error(error.stack+'\nFixture: '+fixture);throw error;}finally{await app?.close().catch(()=>{});}
