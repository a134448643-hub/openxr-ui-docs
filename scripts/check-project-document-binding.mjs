import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..');
const fixture=path.join(root,'.local','checks','document-binding-'+Date.now());
await fs.mkdir(path.join(fixture,'server'),{recursive:true});
for(const file of await fs.readdir(path.join(root,'server'))){if(file.endsWith('.mjs'))await fs.copyFile(path.join(root,'server',file),path.join(fixture,'server',file));}
const projectStore=await import(pathToFileURL(path.join(fixture,'server','project-store.mjs')));
const documentStore=await import(pathToFileURL(path.join(fixture,'server','project-document-store.mjs')));
const {localDocsPlugin}=await import(pathToFileURL(path.join(fixture,'server','vite-local-docs-plugin.mjs')));
await projectStore.listProjects();
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHuoAAAAASUVORK5CYII=';
const makeDocument=name=>({sidebarTitle:name,docTitle:name+' docs',pages:[{id:'page1',title:{zh:'概述',en:'Overview'}}],content:{page1:{blocks:[{id:'text1',type:'text',data:{zh:name+' 原有文档',en:name},style:{},attachments:[{id:'attachment1',type:'image',data:{src:image},layout:{x:0,y:0,width:100,height:100},style:{}}]},{id:'image1',type:'image',data:{src:image},style:{}}]}}});
await documentStore.saveDocument(makeDocument('Alpha'),'openxr-ui');
await projectStore.createProject({id:'beta',name:'Beta'});
await documentStore.saveDocument(makeDocument('Beta'),'beta');
for(const id of ['openxr-ui','beta']){const docsRoot=await projectStore.getProjectDocsRoot(id);await fs.writeFile(path.join(docsRoot,'assets','shared.png'),id);}
let server,browser;
const base='http://127.0.0.1:5175';
// Read JSON once; error bodies are only consumed on failure.
const jsonGet=async endpoint=>{const r=await fetch(base+endpoint);if(!r.ok)throw Error(await r.text());return r.json();};
try{
 server=await createServer({configFile:false,root,plugins:[react(),localDocsPlugin()],optimizeDeps:{entries:['index.html']},server:{host:'127.0.0.1',port:5175,strictPort:true,cors:false}});await server.listen();
 const a=await jsonGet('/api/document?project=openxr-ui');assert.equal(a.docTitle,'Alpha docs');assert.match(a.content.page1.blocks[1].data.src,/\?project=openxr-ui$/);assert.match(a.content.page1.blocks[0].attachments[0].data.src,/\?project=openxr-ui$/);
 const save=await fetch(base+'/api/document?project=openxr-ui',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(a)});assert.equal(save.status,200);const docsRoot=await projectStore.getProjectDocsRoot('openxr-ui');const manifest=await fs.readFile(path.join(docsRoot,'document.yaml'),'utf8');assert.ok(!manifest.includes('?project='));const markdowns=await fs.readdir(path.join(docsRoot,'manual'));const markdown=await fs.readFile(path.join(docsRoot,'manual',markdowns[0]),'utf8');assert.ok(!markdown.includes('?project='));
 assert.equal(await (await fetch(base+'/docs-assets/shared.png?project=openxr-ui')).text(),'openxr-ui');assert.equal(await (await fetch(base+'/docs-assets/shared.png?project=beta')).text(),'beta');
 const cors=await fetch(base+'/api/workspace',{headers:{Origin:'http://127.0.0.1:8771'}});assert.equal(cors.headers.get('access-control-allow-origin'),'http://127.0.0.1:8771');const privateCors=await fetch(base+'/api/knowledge?project=openxr-ui',{headers:{Origin:'http://127.0.0.1:8771'}});assert.equal(privateCors.headers.get('access-control-allow-origin'),null);
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:1536,height:1000}});const errors=[];
 const pageA=await context.newPage();pageA.on('pageerror',e=>errors.push(e.message));await pageA.goto(base+'/?project=openxr-ui&section=development&record=project%3Ahandoff');await pageA.waitForSelector('textarea');assert.match(await pageA.locator('nav').innerText(),/所属项目：OpenXR UI/);assert.match(await pageA.locator('h2').innerText(),/当前交接/);
 const pageB=await context.newPage();pageB.on('pageerror',e=>errors.push(e.message));await pageB.goto(base+'/?project=beta&section=docs');await pageB.waitForSelector('input[value="Beta docs"]');assert.match(await pageB.locator('nav').innerText(),/所属项目：Beta/);
 await pageA.locator('textarea').fill('# Alpha 交接\n\n只属于 Alpha 的保存验证。');await pageA.waitForResponse(r=>r.url().includes('/api/knowledge/item?project=openxr-ui')&&r.request().method()==='POST');
 const alphaKnowledge=await jsonGet('/api/knowledge?project=openxr-ui');const betaKnowledge=await jsonGet('/api/knowledge?project=beta');assert.match(alphaKnowledge.items.find(i=>i.id==='project:handoff').content,/只属于 Alpha/);assert.ok(!betaKnowledge.items.find(i=>i.id==='project:handoff').content.includes('只属于 Alpha'));
 await pageB.locator('input[value="Beta docs"]').fill('Beta 修改后的文档');await pageB.waitForResponse(r=>r.url().includes('/api/document?project=beta')&&r.request().method()==='POST');assert.equal((await jsonGet('/api/document?project=openxr-ui')).docTitle,'Alpha docs');assert.equal((await jsonGet('/api/document?project=beta')).docTitle,'Beta 修改后的文档');
 // Unknown bindings must show an error, rather than load/save the global default.
 const invalid=await context.newPage();const invalidSaves=[];invalid.on('request',r=>{if(r.method()==='POST')invalidSaves.push(r.url());});await invalid.goto(base+'/?project=missing-project');await invalid.getByRole('alert').waitFor();assert.match(await invalid.getByRole('alert').innerText(),/未找到绑定的文档项目/);assert.deepEqual(invalidSaves,[]);
 // Manager integration is exercised by check-desktop.mjs against the current Antigravity layout.
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:["two-tab isolated document and handoff saving","project-scoped images","portable asset references","unknown binding refuses fallback","limited manager CORS"],fixture}));
}finally{await browser?.close();await server?.close();}
