import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DesktopStateStore } from '../desktop/state-store.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixture = path.join(root, '.local/checks', `continuous-text-editor-${Date.now()}`);
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
  app = await launch(); await openEditor();
  assert.equal(await surface.getAttribute('contenteditable'), 'true');
  assert.equal(await surface.locator('[contenteditable="true"]').count(), 0, 'No nested paragraph editing hosts');
  assert.equal(await paragraph('p1').evaluate(el => el.isContentEditable), true);
  assert.equal(await paragraph('p1').getAttribute('contenteditable'), null);
  assert.equal(await frame.locator('[data-editor-mode="continuous-text"]').count(), 1);
  checks.push('one real document editing host; paragraphs and floating text inherit editability');
  await language('ZH');
  await dragSelect(paragraph('p1'), 3, paragraph('p2'), 8);
  const across = await selectedText();
  assert.ok(across.includes('开头需要局部加粗的文字。') && across.includes('第二段可以连续选'), across);
  await page.screenshot({ path: path.join(fixture, 'cross-paragraph-mouse-selection.png') });
  const copied = await surface.evaluate(element => {
    const clipboardData = new DataTransfer(); element.dispatchEvent(new ClipboardEvent('copy', { bubbles: true, cancelable: true, clipboardData }));
    return { text: clipboardData.getData('text/plain'), html: clipboardData.getData('text/html') };
  });
  assert.ok(copied.text.includes('第二段')); assert.ok(copied.html.includes('<p'));
  checks.push('actual mouse selection crosses paragraphs and copies text plus HTML');

  await dragSelect(paragraph('p1'), 7, paragraph('p1'), 11);
  assert.equal(await selectedText(), '局部加粗');
  await frame.getByRole('button', { name: '加粗', exact: true }).click();
  await frame.getByLabel('所选文字字号').selectOption('24px');
  await frame.getByRole('button', { name: '文字颜色 #dc2626', exact: true }).click();
  assert.equal(await paragraph('p1').locator('strong').innerText(), '局部加粗');
  assert.equal(await paragraph('p1').locator('strong').evaluate(el => getComputedStyle(el).fontSize), '24px');
  const formatted = await flush();
  const runs = formatted.content.main.blocks.find(item => item.id === 'p1').style.richText.zh;
  assert.ok(runs.some(run => run.text === '局部加粗' && run.marks.some(mark => mark.type === 'bold')));
  assert.ok(runs.some(run => run.text.includes('第一段开头需要') && !run.marks?.some(mark => mark.type === 'bold')));
  checks.push('partial text bold/font-size/color affects only the selected characters and persists');

  await dragSelect(paragraph('p2'), 4, paragraph('p3'), 6);
  assert.ok((await selectedText()).includes('图片之后的第'));
  await page.screenshot({ path: path.join(fixture, 'selection-across-image.png') });
  await page.keyboard.press('Delete');
  await frame.locator('[data-image-id="picture"]').waitFor({ state: 'detached' });
  let saved = await flush();
  assert.ok(!saved.content.main.blocks.some(item => item.id === 'picture'));
  assert.ok(saved.content.main.blocks.some(item => item.data?.zh?.includes('第二段可三段正文。')));
  await page.keyboard.press('Control+z');
  await frame.locator('[data-image-id="picture"]').waitFor();
  assert.equal(await paragraph('p2').innerText(), original.content.main.blocks[1].data.zh);
  checks.push('cross-image range delete joins text and removes image; one undo restores the entire selection');
  await trace('after undo');

  const splitPoint = await pointAt(paragraph('p2'), 2);
  await page.mouse.click(splitPoint.x, splitPoint.y); await page.waitForTimeout(80);
  await trace('before enter');
  await page.keyboard.press('Enter');
  await trace('after enter');
  saved = await flush();
  assert.ok(saved.content.main.blocks.filter(item => item.type === 'text').length > 3);
  await page.keyboard.press('Backspace');
  await trace('after backspace');
  const joinedP2 = surface.locator(':scope > p').filter({ hasText: original.content.main.blocks[1].data.zh }).first();
  assert.equal(await joinedP2.innerText(), original.content.main.blocks[1].data.zh);
  checks.push('Enter splits naturally and Backspace joins paragraphs in the same editing host');

  await joinedP2.click(); await page.keyboard.press('End');
  await surface.evaluate((element, clipboard) => {
    const clipboardData = new DataTransfer(); clipboardData.setData('text/plain', clipboard.text); clipboardData.setData('text/html', clipboard.html);
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
  }, copied);
  saved = await flush();
  assert.ok(saved.content.main.blocks.map(item => item.data?.zh || '').join('\n').includes('开头需要局部加粗的文字。'));
  await page.keyboard.press('Control+z');
  checks.push('rich clipboard paste keeps paragraphs; undo reverses the paste');

  await surface.click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Control+a');
  assert.ok((await selectedText()).includes('第一段') && (await selectedText()).includes('图片之后'));
  await page.keyboard.press('Backspace');
  assert.equal(await frame.locator('[data-image-id]').count(), 0);
  saved = await flush();
  assert.ok(!saved.content.main.blocks.some(item => item.data?.zh));
  assert.ok(saved.content.main.blocks.some(item => item.data?.en?.includes('English')));
  await page.keyboard.press('Control+z');
  await frame.locator('[data-image-id="picture"]').waitFor();
  checks.push('Ctrl+A includes text/images/floating notes; delete and undo work; hidden English survives Chinese-only editing');

  await language('BILINGUAL');
  await paragraph('p1').click(); await page.keyboard.press('Control+a');
  assert.ok((await selectedText()).includes('The first English paragraph'));
  await page.keyboard.type('整页替换后仍然是一个连续正文编辑区。');
  saved = await flush();
  assert.equal(saved.content.main.blocks.filter(item => item.type === 'image').length, 0);
  assert.ok(saved.content.main.blocks.map(item => `${item.data?.zh || ''}${item.data?.en || ''}`).join('').includes('整页替换'));
  await page.keyboard.press('Control+z');
  await frame.locator('[data-image-id="picture"]').waitFor();
  assert.ok((await paragraph('p1').innerText()).includes('第一段'));
  assert.ok((await flush()).content.main.blocks.some(item => item.data?.zh?.includes('第一段')));
  checks.push('bilingual full-document select/replace includes both languages and images; undo restores them together');

  await language('ZH');
  const noteText = frame.locator('[data-note-id="note"] .doc-floating-content [data-language="zh"]');
  await noteText.click(); await page.keyboard.press('End'); await page.keyboard.insertText('（已编辑）');
  assert.ok((await noteText.innerText()).includes('（已编辑）'));
  const noteBox = frame.locator('[data-note-id="note"] .doc-float');
  await noteBox.scrollIntoViewIfNeeded();
  const beforeNote = await noteBox.boundingBox();
  const noteHandle = await noteBox.locator('.doc-float-move').boundingBox();
  await page.mouse.move(noteHandle.x + 10, noteHandle.y + 10); await page.mouse.down();
  await page.mouse.move(noteHandle.x - 20, noteHandle.y + 30, { steps: 8 }); await page.mouse.up();
  const afterNote = await noteBox.boundingBox();
  assert.ok(Math.abs(afterNote.x - beforeNote.x + 30) < 3);
  assert.ok(Math.abs(afterNote.y - beforeNote.y - 20) < 3);
  saved = await flush();
  assert.ok(saved.content.main.blocks.flatMap(item => item.attachments || []).find(item => item.id === 'note').data.zh.includes('（已编辑）'));
  checks.push('floating notes use the same editing host, retain both languages, and still drag and persist');

  await paragraph('p3').click(); await page.keyboard.press('End');
  await surface.evaluate((element, image) => {
    const clipboardData = new DataTransfer();
    const bytes = Uint8Array.from(atob(image.split(',')[1]), char => char.charCodeAt(0));
    clipboardData.items.add(new File([bytes], 'clipboard.svg', { type: 'image/svg+xml' }));
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }));
  }, image);
  await frame.locator('[data-image-id]').nth(1).waitFor();
  saved = await flush(); assert.equal(saved.content.main.blocks.filter(item => item.type === 'image').length, 2);
  const pasted = frame.locator('[data-image-id]').last();
  await pasted.locator('img').click(); await pasted.getByRole('button', { name: '删除图片', exact: true }).click();
  assert.equal(await frame.locator('[data-image-id]').count(), 1);
  await page.keyboard.press('Control+z'); await frame.locator('[data-image-id]').nth(1).waitFor();
  checks.push('clipboard image insertion uses document selection; explicit image delete and undo remain available');

  for (const theme of ['dark-unreal', 'light-clean', 'dark-graphite', 'cyber-blue', 'epic-launcher']) {
    await page.locator('.theme-picker-btn').first().click(); await page.locator(`[data-action="set-theme"][data-theme-id="${theme}"]`).first().click();
    await page.waitForFunction(theme => document.querySelector('#desktop-doc-editor')?.contentDocument?.documentElement.dataset.platformTheme === theme, theme);
    await surface.waitFor();
    for (const width of [1000, 1440, 1800]) {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 1000), width);
      assert.equal(await surface.getAttribute('contenteditable'), 'true');
      assert.ok(await surface.evaluate(el => document.documentElement.scrollWidth <= innerWidth + 1));
      await surface.focus(); await page.keyboard.press('Control+a'); await page.waitForTimeout(80);
      assert.ok((await selectedText()).includes('第一段'));
      if (width === 1440) await page.screenshot({ path: path.join(fixture, `continuous-${theme}.png`) });
    }
  }
  checks.push('five themes at 1000/1440/1800 preserve one editable surface and whole-document selection');
  await paragraph('p1').click(); await page.keyboard.press('End'); await page.keyboard.insertText('正常关闭后保留这句话。');
  await closeNormally();
  app = await launch(); await openEditor();
  assert.ok((await paragraph('p1').innerText()).includes('正常关闭后保留这句话。'));
  assert.equal(await paragraph('p1').locator('strong').innerText(), '局部加粗');
  saved = await loadDocument('continuous-text');
  assert.ok(saved.content.main.blocks.find(item => item.id === 'picture').annotations.length > 0);
  assert.ok(saved.content.main.blocks.some(item => item.attachments?.some(note => note.id === 'note')));
  assert.equal(saved.content.second.blocks[0].data.zh, '第二页保留内容。');
  await page.screenshot({ path: path.join(fixture, 'restart-restored.png') });
  checks.push('normal close/restart restores edited text, partial formatting, original images, annotations, floating notes and untouched page');
  assert.deepEqual(errors, []);
  await closeNormally();
  const report = { fixture, executablePath, checks, errors, limitations: ['Clipboard data uses DOM copy/paste events; no access to the user OS clipboard.', 'No real translation or publishing operation was requested or executed.'] };
  await fs.writeFile(path.join(fixture, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page?.screenshot({ path: path.join(fixture, 'failure.png'), timeout: 5000 }).catch(() => {});
  console.error(JSON.stringify({ fixture, checks, errors, traces, error: error.stack }, null, 2)); throw error;
} finally { await app?.close().catch(() => {}); }
