import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DesktopStateStore } from '../desktop/state-store.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixture = path.join(root, '.local/checks', `heading-selection-${Date.now()}`);
await fs.mkdir(fixture, { recursive: true });
process.env.UE_MANAGER_WORKSPACE_ROOT = fixture;
const { createProject } = await import('../server/project-store.mjs');
const { saveDocument, loadDocument } = await import('../server/project-document-store.mjs');
await createProject({ id: 'continuous-text', name: '连续正文编辑验证' });
const image = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200"><rect width="640" height="200" fill="#cbd5e1"/><text x="30" y="100" font-size="28">Continuous document image</text></svg>').toString('base64');
const text = (id, zh, en) => ({ id, type: 'text', data: { zh, en }, style: {}, attachments: [] });
const original = { sidebarTitle: '文档编辑', docTitle: '连续正文与选区验证', pages: [{ id: 'main', title: { zh: '正文选区', en: 'Selection' } }, { id: 'second', title: { zh: '第二页', en: 'Second' } }], content: {
  main: { blocks: [
    text('p1', '第一段开头需要局部加粗的文字。', 'The first English paragraph.'),
    text('p2', '第二段可以连续选择并删除。', 'The second English paragraph.'),
    { id: 'picture', type: 'image', data: { src: image }, style: { imageWidth: 65 }, annotations: [{ id: 'arrow', type: 'arrow', x1: .1, y1: .5, x2: .8, y2: .8, color: '#dc2626', strokeWidth: 4 }], attachments: [] },
    { ...text('p3', '图片之后的第三段正文。', 'The third paragraph after the image.'), attachments: [{ id: 'note', type: 'text', isFloating: true, data: { zh: '保留的悬浮注释', en: 'Existing floating note' }, style: { size: 'text-sm' }, layout: { rx: .55, ry: .15, rw: .35, rh: .12 } }] },
  ] }, second: { blocks: [text('page2', '第二页保留内容。', 'Keep the second page.')] },
} };
await saveDocument(original, 'continuous-text');
const project = { id: 'continuous-project', name: '连续正文验证工程', path: fixture, ue: '5.3', type: 'UE 工程', imported: true, plugins: [], category: 'uncategorized', status: 'active' };
const store = new DesktopStateStore(path.join(fixture, '.local/desktop-data')); await store.load();
await store.set('ue-pm-theme', 'epic-launcher');
await store.set('ue-nexus-prototype-v1', JSON.stringify({ theme: 'epic-launcher', catalog: [project], order: [project.id], overrides: {}, docsBindings: { [project.id]: 'continuous-text' } }));
const require = createRequire(import.meta.url);
const { _electron } = require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const executablePath = process.env.UE_DESKTOP_TEST_EXE || path.join(root, 'node_modules/electron/dist/electron.exe');
const launch = () => _electron.launch({ executablePath, args: process.env.UE_DESKTOP_TEST_EXE ? [] : [path.join(root, 'desktop/main.mjs')], cwd: root, env: { ...process.env, UE_DESKTOP_WORKSPACE: fixture, UE_DESKTOP_SMOKE: '1' }, timeout: 60000 });
let app, page, frame, surface;
const checks = [], errors = [];
const traces = [];
const paragraph = (id, lang = 'zh') => frame.locator(`[data-record-id="${id}"][data-language="${lang}"]`).first();
async function openEditor() {
  page = await app.firstWindow(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.showInactive(); win.setSize(1440, 1000); });
  await page.locator('[data-nav="projects"]').click();
  await page.locator('[data-project-card="continuous-project"] [data-action="open-project"]').first().click();
  await page.locator('[data-action="project-tab"][data-id="documents"]').click();
  frame = page.frameLocator('#desktop-doc-editor'); surface = frame.locator('.doc-surface');
  await surface.waitFor();
}
async function language(name) {
  const value = name.toLowerCase();
  await frame.locator('nav').getByRole('button', { name: value, exact: true }).click();
  await frame.locator(`.doc-scroll[data-document-language="${value}"] .doc-surface`).waitFor();
  if (value === 'zh') await surface.locator(':scope > [data-language="en"]').first().waitFor({ state: 'detached' });
  if (value === 'bilingual') await paragraph('p1', 'en').waitFor();
}
async function flush() { await page.evaluate(() => window.ueDesktopFlush()); return loadDocument('continuous-text'); }
async function pointAt(locator, offset) {
  const point = await locator.evaluate((element, offset) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode(), left = offset;
    while (node && left > node.textContent.length) { left -= node.textContent.length; node = walker.nextNode(); }
    if (!node) throw Error('Text offset is outside the paragraph');
    const range = document.createRange(); range.setStart(node, left); range.collapse(true);
    const rect = range.getBoundingClientRect(); return { x: rect.left, y: rect.top + rect.height / 2 };
  }, offset);
  const bounds = await page.locator('#desktop-doc-editor').boundingBox();
  return { x: bounds.x + point.x, y: bounds.y + point.y };
}
async function dragSelect(start, from, end, to) {
  await start.scrollIntoViewIfNeeded();
  const a = await pointAt(start, from), b = await pointAt(end, to);
  await page.mouse.click(a.x, a.y);
  await page.keyboard.press('ArrowLeft');
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 15 }); await page.mouse.up();
  await page.waitForTimeout(80);
}
async function selectedText() { return surface.evaluate(() => window.getSelection().toString()); }
async function trace(label) { traces.push({ label, ...(await surface.evaluate(el => ({ text: el.innerText, native: window.getSelection().toString(), pm: el.pmViewDesc?.view ? { from: el.pmViewDesc.view.state.selection.from, to: el.pmViewDesc.view.state.selection.to } : null }))) }); }
async function closeNormally() { const done = app.waitForEvent('close', { timeout: 15000 }); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()); await done; app = null; }

try {
  app = await launch(); await openEditor(); await language('ZH');
  await dragSelect(paragraph('p1'),7,paragraph('p1'),11);
  assert.equal(await selectedText(),'局部加粗');
  await frame.getByLabel('段落样式',{exact:true}).selectOption('1');
  const title=surface.locator('h1').filter({hasText:'局部加粗'});
  await title.waitFor();
  assert.equal(await title.innerText(),'局部加粗');
  const texts=await surface.locator(':scope > p, :scope > h1').allTextContents();
  assert.deepEqual(texts.slice(0,3),['第一段开头需要','局部加粗','的文字。']);
  assert.equal(await selectedText(),'局部加粗');
  let saved=await flush();
  assert.equal(saved.content.main.blocks.filter(item=>item.style?.isSectionHeader).length,1);
  assert.equal(saved.content.main.blocks.find(item=>item.style?.isSectionHeader).data.zh,'局部加粗');
  await page.screenshot({path:path.join(fixture,'selected-text-heading.png')});
  checks.push('mouse-select a phrase then choose heading: only selected text becomes standalone heading, surrounding text remains body');
  await frame.getByRole('button',{name:'撤销',exact:true}).click();
  assert.equal(await surface.locator('h1').count(),0);
  assert.equal(await paragraph('p1').innerText(),original.content.main.blocks[0].data.zh);
  await frame.getByRole('button',{name:'重做',exact:true}).click();
  await title.waitFor();
  checks.push('one undo restores the original paragraph; redo restores the isolated heading');
  await language('BILINGUAL');
  assert.equal(await paragraph('p1','en').evaluate(el=>el.tagName),'P');
  assert.equal(await surface.locator('h1').innerText(),'局部加粗');
  checks.push('Chinese heading does not turn paired English body into a heading');

  await language('ZH');
  const point=await pointAt(paragraph('p2'),3);
  await page.mouse.click(point.x,point.y); await page.waitForTimeout(80);
  await frame.getByLabel('段落样式',{exact:true}).selectOption('2');
  await surface.locator('h2').waitFor();
  assert.equal((await surface.locator('h2').innerText()).trim(),'');
  await page.keyboard.insertText('新输入的二级标题');
  assert.equal(await surface.locator('h2').innerText(),'新输入的二级标题');
  const words=await surface.locator(':scope > p, :scope > h2').allTextContents();
  assert.ok(words.includes('第二段'));assert.ok(words.includes('可以连续选择并删除。'));
  await page.keyboard.press('Enter'); await page.keyboard.insertText('标题后继续输入正文');
  assert.ok((await surface.locator(':scope > p').allTextContents()).includes('标题后继续输入正文'));
  checks.push('no selection creates empty heading at caret; typed text enters heading and Enter continues as body');

  const p3point=await pointAt(paragraph('p3'),0);
  await page.mouse.click(p3point.x,p3point.y); await page.waitForTimeout(80);
  await frame.getByRole('button',{name:'新建标题',exact:true}).click();
  await page.keyboard.insertText('直接新建的一级标题');
  assert.ok((await surface.locator('h1').allTextContents()).includes('直接新建的一级标题'));
  checks.push('explicit new-heading button inserts empty heading and focuses it for typing');
  await flush();

  for(const theme of ['dark-unreal','light-clean','dark-graphite','cyber-blue','epic-launcher']) {
    await page.locator('.theme-picker-btn').first().click();
    await page.locator(`[data-action="set-theme"][data-theme-id="${theme}"]`).first().click();
    await page.waitForFunction(theme=>document.querySelector('#desktop-doc-editor')?.contentDocument?.documentElement.dataset.platformTheme===theme,theme);
    for(const width of [1000,1440,1800]) {
      await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,1000),width);
      await frame.getByRole('button',{name:'新建标题',exact:true}).waitFor();
      assert.ok(await surface.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      assert.ok((await surface.locator('h1').allTextContents()).includes('局部加粗'));
      if(width===1440) await page.screenshot({path:path.join(fixture,`heading-${theme}.png`)});
    }
  }
  checks.push('heading controls and saved styles work in five themes at 1000/1440/1800');
  await closeNormally(); app=await launch(); await openEditor();
  assert.ok((await surface.locator('h1').allTextContents()).includes('局部加粗'));
  assert.ok((await surface.locator('h1').allTextContents()).includes('直接新建的一级标题'));
  assert.equal(await surface.locator('h2').innerText(),'新输入的二级标题');
  await language('BILINGUAL');
  assert.equal(await paragraph('p1','en').evaluate(el=>el.tagName),'P');
  saved=await loadDocument('continuous-text');
  assert.equal(saved.content.second.blocks[0].data.zh,'第二页保留内容。');
  assert.ok(saved.content.main.blocks.find(item=>item.id==='picture').annotations.length);
  await page.screenshot({path:path.join(fixture,'restart-restored.png')});
  checks.push('normal close/restart restores selected and newly typed headings without changing English, images or other page');
  assert.deepEqual(errors,[]);await closeNormally();
  const report={fixture,executablePath,checks,errors,limitations:['No real translation, publishing or OS clipboard operation executed.']};
  await fs.writeFile(path.join(fixture,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){
  await page?.screenshot({path:path.join(fixture,'failure.png'),timeout:5000}).catch(()=>{});
  console.error(JSON.stringify({fixture,checks,errors,error:error.stack},null,2));throw error;
}finally{await app?.close().catch(()=>{});}
