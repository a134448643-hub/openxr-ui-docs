import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {DesktopStateStore} from '../desktop/state-store.mjs';
import {createUEProjectTools} from '../server/ue-project-tools.mjs';

const require=createRequire(import.meta.url),{_electron}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),fixture=path.join(root,'.local/checks/epic-theme-'+Date.now());
const tools=createUEProjectTools({root:fixture,engineRegistry:async()=>[]}),catalog=[],overrides={};
const cover='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#657e93"/><stop offset="1" stop-color="#d3c6a6"/></linearGradient></defs><path fill="url(#sky)" d="M0 0h640v360H0z"/><path fill="#6c7772" d="M0 240l160-120 140 130 90-140 250 180v70H0z"/><path fill="#394e55" d="M0 300l180-110 200 170H0z"/></svg>').toString('base64');
for(let i=0;i<3;i++){
  const projectRoot=path.join(fixture,'Sample'+i);await fs.mkdir(path.join(projectRoot,'Config'),{recursive:true});await fs.mkdir(path.join(projectRoot,'Content'),{recursive:true});
  const descriptor=path.join(projectRoot,'Sample'+i+'.uproject');await fs.writeFile(descriptor,JSON.stringify({EngineAssociation:'5.3'}));
  const nativeInfo=await tools.register(descriptor),id='epic-sample-'+i;
  catalog.push({id,name:['OpenXR 交互示例','环境与材质研究','蓝图工具集'][i],path:projectRoot,nativeInfo,ue:'5.3',type:'UE 工程',status:'active',category:'original',plugins:[],imported:true});
  overrides[id]={tags:['保留的自定义标签'],description:'切换主题应保留项目资料',thumbnail:{cover,custom:true,width:640,height:360}};
}
const pluginDir=path.join(fixture,'SamplePlugin');await fs.mkdir(path.join(pluginDir,'Source'),{recursive:true});
const pluginDescriptor=path.join(pluginDir,'SamplePlugin.uplugin');await fs.writeFile(pluginDescriptor,JSON.stringify({FileVersion:3,FriendlyName:'XR 工具插件',EngineVersion:'5.3',Modules:[{Name:'XRTools',Type:'Runtime'}]}));
const pluginInfo=await tools.inspectPlugin(pluginDescriptor),plugin={...pluginInfo,nativePluginId:pluginInfo.id,categoryName:pluginInfo.category,type:'source',typeLabel:pluginInfo.category,blueprintNodes:[],tags:['自定义插件标签'],size:'未统计'};
const store=new DesktopStateStore(path.join(fixture,'.local/desktop-data'));await store.load();await store.set('ue-pm-theme','dark-unreal');
await store.set('ue-nexus-prototype-v1',JSON.stringify({theme:'dark-unreal',catalog,order:catalog.map(p=>p.id),overrides,categories:[{id:'original',name:'保留的自定义标签',color:'#fbbf24'}],projectTagCatalog:['保留的自定义标签'],plugins:[plugin],pluginOrder:[plugin.id],pluginOverrides:{[plugin.id]:{thumbnail:{cover,custom:true,width:640,height:360}}},docsBindings:{[catalog[0].id]:'keep-document'},gallerySize:'regular'}));
const launch=()=>_electron.launch({executablePath:process.env.UE_DESKTOP_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.UE_DESKTOP_TEST_EXE?[]:[path.join(root,'desktop/main.mjs')],cwd:root,env:{...process.env,UE_DESKTOP_WORKSPACE:fixture,UE_DESKTOP_SMOKE:'1'},timeout:60000});
let app,page;const errors=[];
async function theme(id){await page.locator('#global-theme-picker [data-action="toggle-theme-picker"]').click();await page.locator('#global-theme-picker [data-theme-id="'+id+'"]').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),id);}
async function checkCards(selector){
  await page.locator(selector).first().waitFor();
  const metrics=await page.locator(selector).evaluateAll(cards=>cards.map(card=>{
    const r=card.getBoundingClientRect(),image=card.querySelector('.cover').getBoundingClientRect(),panel=card.querySelector('.card-content'),p=panel.getBoundingClientRect();
    return {inset:image.left-r.left,gap:p.top-image.bottom,inside:image.bottom<r.bottom,blur:getComputedStyle(panel).backdropFilter,radius:getComputedStyle(card).borderRadius,overflow:card.scrollWidth>card.clientWidth+1,buttonsOutside:[...card.querySelectorAll('button')].some(button=>{const b=button.getBoundingClientRect();return b.width&&(b.left<r.left-1||b.right>r.right+1||b.bottom>r.bottom+1);})};
  }));
  for(const m of metrics){assert.ok(m.inset>=10,JSON.stringify(m));assert.ok(m.gap>=10,JSON.stringify(m));assert.equal(m.inside,true);assert.equal(m.blur,'none');assert.equal(m.radius,'22px');assert.equal(m.overflow,false);assert.equal(m.buttonsOutside,false);}
}
try{
  app=await launch();page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('[data-project-card]').first().waitFor();
  for(const id of ['light-clean','dark-graphite','cyber-blue','dark-unreal','epic-launcher'])await theme(id);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(16, 16, 20)');
  for(const width of [1000,1440,1800]){
    await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,900),width);
    await page.locator('[data-nav="projects"]').click();await page.locator('[data-action="view"][data-id="grid"]').click();await checkCards('.project-card[data-project-card]');
    await page.screenshot({path:path.join(fixture,'projects-'+width+'.png')});
    await page.locator('[data-action="view"][data-id="list"]').click();
    assert.equal(await page.locator('.xm-library-row').evaluateAll(rows=>rows.some(r=>r.scrollWidth>r.clientWidth+1)),false);
    await page.locator('[data-nav="plugins"]').click();await page.locator('[data-action="plugin-view"][data-id="grid"]').click();await checkCards('.project-card[data-plugin-card]');
    await page.locator('[data-action="plugin-view"][data-id="list"]').click();assert.equal(await page.locator('.xm-library-row').count(),1);
    console.log('Project and plugin grid/list passed at '+width+'px');
  }
  await page.locator('[data-nav="project-translation"]').click();await page.screenshot({path:path.join(fixture,'translation.png')});
  assert.equal(await page.evaluate(()=>document.querySelector('#main-content').scrollWidth>document.querySelector('#main-content').clientWidth+1),false);
  await page.locator('[data-nav="projects"]').click();await page.locator('[data-action="view"][data-id="grid"]').click();
  await page.locator('[data-action="desktop-manage-labels"]').click();await page.screenshot({path:path.join(fixture,'labels.png')});await page.locator('[data-action="close-modal"]').last().click();
  await page.evaluate(()=>window.ueDesktopFlush());await app.close();app=await launch();page=await app.firstWindow();await page.locator('[data-project-card]').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'epic-launcher');
  const saved=JSON.parse(JSON.parse(await fs.readFile(store.file,'utf8')).values['ue-nexus-prototype-v1']);
  assert.deepEqual(saved.catalog.map(({projectAvailability,...project})=>project),catalog);assert.deepEqual(saved.overrides,overrides);assert.equal(saved.docsBindings[catalog[0].id],'keep-document');assert.equal(saved.plugins.length,1);assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(fixture,'report.json'),JSON.stringify({passed:['five theme choices','inset project and plugin covers at 1000/1440/1800px','grid/list controls remain in bounds','translation and label dialogs render','Epic theme survives restart','project metadata, covers, labels and document binding preserved'],fixture},null,2));
  console.log(await fs.readFile(path.join(fixture,'report.json'),'utf8'));
}catch(error){console.error('Fixture: '+fixture+'\n'+error.stack);throw error;}finally{await app?.close().catch(()=>{});}
