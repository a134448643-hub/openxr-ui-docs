import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DesktopStateStore } from '../desktop/state-store.mjs';
const root = process.cwd(), fixture = path.join(root, '.local/checks/language-open-panel-' + Date.now());
await fs.mkdir(path.join(fixture, 'temp'), { recursive: true }); process.env.TEMP = path.join(fixture, 'temp'); process.env.TMP = process.env.TEMP;
const projectRoot = path.join(fixture, 'Project'), descriptor = path.join(projectRoot, 'Demo.uproject');
for (const folder of ['Config', 'Content']) await fs.mkdir(path.join(projectRoot, folder), { recursive: true });
await fs.writeFile(descriptor, JSON.stringify({ EngineAssociation: '5.3' }));
const source = { name: 'Demo', descriptorPath: descriptor, projectRoot, engineVersion: '5.3', codeKind: 'blueprint', plugins: [] };
const project = { id: 'focus', name: 'Demo', type: 'UE 工程', ue: '5.3', path: projectRoot, status: 'active', imported: true, plugins: [], nativeInfo: source };
const state = new DesktopStateStore(path.join(fixture, '.local/desktop-data')); await state.load();
await state.set('ue-pm-theme', 'epic-launcher');
await state.set('ue-nexus-prototype-v1', JSON.stringify({ theme: 'epic-launcher', catalog: [project], order: [project.id], overrides: {} }));
await state.set('ue-project-workflow-v1', JSON.stringify({ path: descriptor, stage: 'translation', autoClassify: true }));
const report = { source, summary: { assets: 1, files: 1, bytes: 1, maps: 0 }, rows: [{ id: 0, entryKey: 'test', group: 'assets', kind: '资源名称', field: 'Name', original: 'BP_测试', translated: '', owner: '/Game/BP_测试', relative: 'Content/BP_测试.uasset' }], excluded: [], coverage: { assetNames: true } };
const translation = { id: 'translation', kind: 'translation', status: 'completed', copyJobId: 'copy', direction: 'zh-en', completed: 1, total: 1, entries: [report.rows[0], { id: 1, entryKey: 'fixed', group: 'assets', kind: '目录', original: '蓝图', owner: '/Game/蓝图', relative: 'Content/蓝图', field: 'Name', translated: 'Blueprints', fixedFabFolderName: 'Blueprints' }, { id: 2, entryKey: 'native', group: 'members', kind: '变量', field: 'Name', owner: '/Game/BP_测试', original: 'NativeName', translated: 'NativeName', preserveOriginalEnglish: true }].map((row,i)=>i===0?{...row,translated:'BP_Test'}:row) };
let missingEnglish=false;const english=path.join(fixture,'English','Demo.uproject'),chinese=descriptor;
const scan=JSON.parse(await fs.readFile('.local/checks/event-parameter-repair-20261017/regression-scan.json','utf8'));let stale=true;const calls = [], errors = [], buttonStyles = []; let cleared = false, runningPipeline = false;
const require = createRequire(import.meta.url), { _electron } = require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const app = await _electron.launch({ executablePath: path.join(root,'.local/desktop-build/release/0.1.142/PersonalDevPlatform-win32-x64/PersonalDevPlatform.exe'), args: [], cwd: root, env: { ...process.env, UE_DESKTOP_WORKSPACE: fixture, UE_DESKTOP_SMOKE: '1' } });
let page;
try {
  page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/Render error|ReferenceError|TypeError/.test(message.text()))errors.push(message.text());});
  await app.evaluate(({ BrowserWindow }) => {const window=BrowserWindow.getAllWindows()[0];window.webContents.setBackgroundThrottling(false);window.setBounds({width:1440,height:1000});});
  await page.route('**/api/ue/**', async route => {
    const request = route.request(), url = new URL(request.url()), action = url.pathname.split('/api/ue/')[1];
    const body = request.method() === 'POST' ? request.postDataJSON() : undefined;
    calls.push({ action, body });
    let value = {};
    if (action === 'delivery/status') {const chineseAudit=structuredClone(scan.chineseAudit);if(stale)delete chineseAudit.eventParameters;value = { report, configured: true, sourceDescriptor: descriptor, latestCopy: { id: 'copy', status: 'completed', target: projectRoot }, latestScan: {id:'audit',kind:'editor-scan',auditOnly:true,phase:'中文残留检查完成',completedAt:new Date().toISOString(),status:'completed',copyJobId:'copy',result:{...scan,chineseAudit}}, translation, generatedProjects: [], defaultOutput:path.join(fixture,'Output') };}
    else if(action==='delivery/project-open-targets') value={sourceDescriptor:descriptor,selectedLanguage:'en',items:[{language:'zh',available:true,descriptorPath:chinese,projectRoot:projectRoot},{language:'en',available:true,descriptorPath:english,projectRoot:path.dirname(english)}]};
    else if(action==='delivery/open-language-project'){if(missingEnglish&&body.language==='en')return route.fulfill({status:400,json:{error:'项目文件已移动或删除，请重新关联中英文项目'}});value={started:true,descriptorPath:body.language==='en'?english:chinese,editorLanguage:body.language==='en'?'en':'zh-Hans'};}
    else if(action==='delivery/bind-language-project')value={sourceDescriptor:descriptor,selectedLanguage:body.language,items:[{language:'zh',available:true,descriptorPath:chinese,projectRoot:projectRoot},{language:'en',available:true,descriptorPath:english,projectRoot:path.dirname(english)}]};
    else if (action === 'delivery/job') value = translation;
    else if (action === 'delivery/one-click-status') value = runningPipeline ? {id:'pipeline',status:'running',source:{descriptorPath:descriptor},phase:'等待处理中',progress:10} : null;
    else if (action === 'delivery/one-click-job') value = {id:'pipeline',status:'running',source:{descriptorPath:descriptor},phase:'等待处理中',progress:10};
    else if (action === 'delivery/engines') value = { items: [{ version: '5.3', installed: true }] };
    else if (action === 'delivery/translation-status') value = { available: true, model: 'gpt-6-luna', provider: 'codex' };
    else if (action === 'delivery/glossary') value = { terms: [], commonTerms: [], projectTerms: [] };
    else if (action === 'delivery/cache-records') value = { hasCache: !cleared, cacheRoot: cleared ? null : path.join(projectRoot, '.ue-translation-cache'), bytes: cleared ? 0 : 1234567890, history: [], preserved: [] };
    else if (action === 'delivery/clear-translation-cache') { cleared = true; value = { cleared: true, removedRoot: true, freedBytes: 1234567890, preserved: [] }; }
    else if (action === 'pick') value = { path: english };
    else if (['delivery/processing-preflight', 'delivery/preview-version-projects', 'fab/preview'].includes(action)) return route.fulfill({ status: 400, json: { error: '仅验证当前操作入口，不执行 UE 或模型任务' } });
    else if (action === 'refresh-projects') value = { items: [], removed: 0, missing: [] };
    else if (action === 'delivery/generated-projects') value = [];
    return route.fulfill({ json: value });
  });
  const targetUrl=new URL(page.url());targetUrl.searchParams.set('tool','project-translation');await page.goto(targetUrl.href);
  await page.waitForFunction(() => typeof window.ueDesktopFlush === 'function');
  for (let i = 0; i < 100 && !calls.some(call => call.action === 'delivery/glossary'); i++) await new Promise(resolve => setTimeout(resolve, 20));


  await page.locator('.pt-chinese-audit').waitFor();assert.match(await page.locator('.pt-chinese-audit').innerText(),/未覆盖完整参数签名.*结果已过期/);assert.ok(!(await page.locator('.pt-chinese-audit').innerText()).includes('没有检测到中文'));
  stale=false;await page.reload();await page.locator('.pt-chinese-audit [data-pt-audit-details]').waitFor();assert.match(await page.locator('.pt-chinese-audit').innerText(),/可翻译中文 5 项/);
  await page.locator('[data-pt-audit-details]>summary').click();const text=await page.locator('.pt-audit-entries').innerText();assert.match(text,/是否开始按压？/);assert.match(text,/按键输入源/);assert.match(text,/BP_EventParameters/);assert.match(text,/BP_EventCaller/);assert.equal(await page.locator('.pt-audit-entries li').count(),5);assert.deepEqual(errors,[]);
  const screenshot=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));await fs.writeFile(path.join(fixture,'event-parameter-audit.png'),Buffer.from(screenshot,'base64'));await fs.writeFile(path.join(fixture,'event-audit-report.json'),JSON.stringify({passed:true,hidden:true,staleResultsRejected:true,actualNativeFixtureReportDisplayed:true,entries:5,checks:['old audit results marked expired instead of reporting no Chinese','custom event parameter names and caller locations visible','no UE/model requests from this UI test'],errors},null,2));console.log(JSON.stringify({passed:true,fixture}));
}finally{const done=app.waitForEvent('close',{timeout:15000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.close()));await done;}
