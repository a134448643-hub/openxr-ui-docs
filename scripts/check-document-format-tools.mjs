import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DesktopStateStore } from '../desktop/state-store.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixture = path.join(root, '.local/checks', `document-format-tools-${Date.now()}`);
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
  await surface.evaluate(async () => { await document.fonts.ready; });
  // Raw mouse coordinates need the opening header/font transitions to settle.
  await page.waitForTimeout(300);
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

async function targetMarks() {
  return paragraph('p2').evaluate(el => {
    const runs = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node, position = 0;
    while ((node = walker.nextNode())) {
      const end = position + node.textContent.length;
      if (position < 7 && end > 3) {
        const marks = [];
        for (let parent = node.parentElement; parent && parent !== el; parent = parent.parentElement) {
          if (parent.matches('strong,b')) marks.push({ type: 'bold' });
          if (parent.matches('em,i')) marks.push({ type: 'italic' });
          if (parent.style.color || parent.style.fontSize) marks.push({ type: 'textStyle', attrs: { color: parent.style.color, fontSize: parent.style.fontSize } });
        }
        runs.push({ text: node.textContent, position, marks });
      }
      position = end;
    }
    return runs;
  });
}
async function assertTargetPainted() {
  const strong = paragraph('p2').locator('strong');
  assert.equal(await strong.innerText(), '可以连续');
  assert.equal(await strong.evaluate(el => getComputedStyle(el).color), 'rgb(220, 38, 38)');
  assert.equal(await strong.evaluate(el => getComputedStyle(el).fontSize), '24px');
  assert.equal(await paragraph('p2').innerText(), original.content.main.blocks[1].data.zh);
}
try {
  app = await launch(); await openEditor(); await language('ZH');
  const brush = frame.getByRole('button', { name: '格式刷', exact: true });
  await dragSelect(paragraph('p1'), 7, paragraph('p1'), 11);
  assert.equal(await selectedText(), '局部加粗');
  await frame.getByRole('button', { name: '加粗', exact: true }).click();
  await frame.getByLabel('所选文字字号', { exact: true }).selectOption('24px');
  await frame.getByRole('button', { name: '文字颜色 #dc2626', exact: true }).click();
  await brush.click(); assert.equal(await brush.getAttribute('aria-pressed'), 'true');
  await dragSelect(paragraph('p2'), 3, paragraph('p2'), 7);
  await assertTargetPainted();
  assert.equal(await brush.getAttribute('aria-pressed'), 'false');
  checks.push('mouse format painter copies bold, size and color onto only the selected target phrase and exits automatically');
  await frame.getByRole('button', { name: '撤销', exact: true }).click();
  assert.equal(await paragraph('p2').locator('strong').count(), 0);
  await frame.getByRole('button', { name: '重做', exact: true }).click();
  await assertTargetPainted();
  checks.push('format painting is one undoable action with redo');

  await brush.click(); await page.keyboard.press('Escape');
  assert.equal(await brush.getAttribute('aria-pressed'), 'false');
  await dragSelect(paragraph('p1'), 0, paragraph('p1'), 3);
  await brush.click();
  await dragSelect(paragraph('p2'), 3, paragraph('p2'), 7);
  assert.equal(await paragraph('p2').locator('strong').count(), 0);
  assert.ok((await targetMarks()).every(run => run.marks.length === 0));
  checks.push('Escape cancels format painter; plain source clears target character formatting');
  await frame.getByRole('button', { name: '撤销', exact: true }).click();
  await assertTargetPainted();

  await dragSelect(paragraph('p2'), 3, paragraph('p2'), 7);
  await frame.getByRole('button', { name: '默认文字颜色', exact: true }).click();
  assert.ok((await targetMarks()).every(run => !run.marks.some(m => m.type === 'textStyle' && m.attrs.color)));
  assert.equal(await paragraph('p2').locator('strong').innerText(), '可以连续');
  assert.equal(await paragraph('p2').locator('strong').evaluate(el => getComputedStyle(el).fontSize), '24px');
  checks.push('default color removes explicit ink while retaining size and bold');

  const row = frame.locator('[data-document-page-id="main"]');
  await row.hover(); await frame.getByRole('button', { name: '编辑页面标题', exact: true }).click();
  assert.equal(await row.getAttribute('draggable'), 'false');
  assert.equal(await frame.locator('[data-document-page-id="second"]').getAttribute('draggable'), 'false');
  const input = frame.getByRole('textbox', { name: '页面中文标题', exact: true });
  await input.fill('标题文本框选验证');
  const box = await input.boundingBox();
  await page.mouse.click(box.x + 9, box.y + box.height / 2);
  await page.mouse.move(box.x + 9, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + 65, box.y + box.height / 2, { steps: 15 }); await page.mouse.up();
  const range = await input.evaluate(el => [el.selectionStart, el.selectionEnd]);
  assert.ok(range[1] - range[0] >= 2, `title input must select text: ${range}`);
  assert.ok(await input.evaluate(el => !el.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true }))));
  await page.screenshot({ path: path.join(fixture, 'sidebar-title-selection.png') });
  const englishInput = frame.getByRole('textbox', { name: '页面英文标题', exact: true });
  await englishInput.fill('Editable page title'); await englishInput.press('Control+A');
  assert.deepEqual(await englishInput.evaluate(el => [el.selectionStart, el.selectionEnd]), [0, 19]);
  await frame.getByRole('button', { name: '保存页面标题', exact: true }).click();
  assert.equal(await row.getAttribute('draggable'), 'true');
  checks.push('Chinese title supports real mouse text selection; both title inputs edit normally with page sorting suspended and restored on save');

  for (const theme of ['dark-unreal', 'light-clean', 'dark-graphite', 'cyber-blue', 'epic-launcher']) {
    await page.locator('.theme-picker-btn').first().click();
    await page.locator(`[data-action="set-theme"][data-theme-id="${theme}"]`).first().click();
    await page.waitForFunction(theme => document.querySelector('#desktop-doc-editor')?.contentDocument?.documentElement.dataset.platformTheme === theme, theme);
    for (const width of [1000, 1440, 1800]) {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 1000), width);
      assert.ok(await surface.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const reset = frame.getByRole('button', { name: '默认文字颜色', exact: true });
      const resetBox = await reset.boundingBox(); assert.ok(resetBox.width > 0 && resetBox.x >= 0);
      const colors = await paragraph('p2').locator('strong').evaluate(el => {
        const sample = document.createElement('span'); sample.style.color = 'var(--doc-paper-text)'; document.body.append(sample);
        const expected = getComputedStyle(sample).color; sample.remove(); return { actual: getComputedStyle(el).color, expected };
      });
      assert.equal(colors.actual, colors.expected);
      if (width === 1440) await page.screenshot({ path: path.join(fixture, `format-tools-${theme}.png`) });
    }
  }
  checks.push('default text color follows all five themes; toolbar stays within window at 1000/1440/1800');
  let saved = await flush();
  assert.deepEqual(saved.pages.map(p => p.id), ['main', 'second']);
  assert.equal(saved.pages[0].title.zh, '标题文本框选验证');
  assert.equal(saved.pages[0].title.en, 'Editable page title');
  await closeNormally(); app = await launch(); await openEditor(); await language('ZH');
  assert.equal(await paragraph('p2').locator('strong').innerText(), '可以连续');
  assert.ok((await targetMarks()).every(run => !run.marks.some(m => m.type === 'textStyle' && m.attrs.color)));
  saved = await loadDocument('continuous-text');
  assert.equal(saved.content.second.blocks[0].data.zh, '第二页保留内容。');
  assert.equal(saved.content.main.blocks.find(p => p.id === 'p1').data.en, original.content.main.blocks[0].data.en);
  assert.ok(saved.content.main.blocks.find(p => p.id === 'picture').annotations.length);
  assert.equal(await frame.getByRole('button', { name: '格式刷', exact: true }).getAttribute('aria-pressed'), 'false');
  await page.screenshot({ path: path.join(fixture, 'restart-restored.png') });
  checks.push('normal close/restart preserves formatting, inherited color and bilingual titles; English, annotations and other page remain intact');
  assert.deepEqual(errors, []); await closeNormally();
  const report = { fixture, executablePath, checks, errors, limitations: ['No translation, publishing or real UE project writes executed.'] };
  await fs.writeFile(path.join(fixture, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await trace('failure').catch(() => {});
  await page?.screenshot({ path: path.join(fixture, 'failure.png'), timeout: 5000 }).catch(() => {});
  console.error(JSON.stringify({ fixture, checks, errors, traces, error: error.stack }, null, 2)); throw error;
} finally { await app?.close().catch(() => {}); }

