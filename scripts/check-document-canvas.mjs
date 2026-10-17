import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { DesktopStateStore } from '../desktop/state-store.mjs';
const root = process.cwd(), fixture = path.join(root, '.local/checks/document-canvas-' + Date.now());
await fs.mkdir(path.join(fixture, 'temp'), { recursive: true });
process.env.TEMP = path.join(fixture, 'temp'); process.env.TMP = process.env.TEMP;
process.env.UE_MANAGER_WORKSPACE_ROOT = fixture;
const { saveDocument, loadDocument } = await import('../server/project-document-store.mjs');
const image = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#cbd5e1"/><text x="10" y="50">Test fixture</text></svg>').toString('base64');
const text = (id, en, extra = {}) => ({ id, type: 'text', data: { zh: '中文正文：' + en, en }, style: {}, attachments: [], ...extra });
const picture = (id, layout, floating = true) => ({ id, type: 'image', isFloating: floating, data: { src: image, shareWithEnglish: true }, style: { imageWidth: 50 }, layout });
const blocks = [
  text('heading', 'Floating document layout', { style: { isSectionHeader: true } }),
  text('long', 'The document and its floating images must retain exactly the same position while the window changes size. '.repeat(3)),
  text('anchor', 'Attached image and note anchor paragraph. '.repeat(2), { attachments: [picture('attached-image', { x: 420, y: 18, width: 120, height: 75 }), text('attached-note', 'Attached note', { isFloating: true, layout: { x: 390, y: 105, width: 150, height: 60 } })] }),
  text('tail', 'Document tail paragraph. '.repeat(5)),
  picture('float-image', { x: 200, y: 95, width: 160, height: 100, rx: 200 / 642, ry: 95 / 642, rw: 160 / 642, rh: 100 / 642 }),
  text('float-note', 'Floating note', { isFloating: true, layout: { x: 40, y: 300, width: 180, height: 60 } }),
  picture('flow-image', undefined, false),
];
const document = { sidebarTitle: 'Canvas verification', docTitle: 'Canvas verification', pages: [{ id: 'canvas', title: { zh: '悬浮排版验证', en: 'Floating layout' } }, { id: 'flow', title: { zh: '普通正文', en: 'Normal text' } }], content: { canvas: { blocks }, flow: { blocks: [text('normal', 'Responsive normal text. '.repeat(30))] } } };
await saveDocument(document, 'openxr-ui');
const state = new DesktopStateStore(path.join(fixture, '.local/desktop-data')); await state.load();
const project = { id: 'canvas-project', name: '悬浮文档验证', path: fixture, ue: '5.3', type: 'UE 工程', imported: true, plugins: [], category: 'uncategorized', status: 'active' };
await state.set('ue-pm-theme', 'epic-launcher');
await state.set('ue-nexus-prototype-v1', JSON.stringify({ theme: 'epic-launcher', catalog: [project], order: [project.id], overrides: {}, docsBindings: { [project.id]: 'openxr-ui' } }));
const publishedRoot = path.join(fixture, 'published');
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'published', '--outDir', publishedRoot], { cwd: root, stdio: 'inherit', windowsHide: true });
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error('Published build failed')));
});
await fs.writeFile(path.join(publishedRoot, 'document-data.json'), JSON.stringify(document));
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = path.resolve(publishedRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(publishedRoot + path.sep)) { response.writeHead(403); response.end(); return; }
  try { response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html'); response.end(await fs.readFile(file)); }
  catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const require = createRequire(import.meta.url), { _electron } = require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const errors = [], measurements = [];
const launch = () => _electron.launch({ executablePath: process.env.UE_DESKTOP_TEST_EXE || path.join(root, 'node_modules/electron/dist/electron.exe'), args: process.env.UE_DESKTOP_TEST_EXE ? [] : [path.join(root, 'desktop/main.mjs')], cwd: root, env: { ...process.env, UE_DESKTOP_WORKSPACE: fixture, UE_DESKTOP_SMOKE: '1' } });
let app;
const close = async () => { if (!app) return; const done = app.waitForEvent('close', { timeout: 15000 }); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.close())); await done; app = null; };
const openEditor = async () => {
  const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.locator('[data-project-card="canvas-project"] [data-action="open-project"]').first().click();
  await page.locator('[data-action="project-tab"][data-id="documents"]').click();
  const frame = page.frameLocator('#desktop-doc-editor');
  await frame.locator('.doc-surface').waitFor();
  await frame.locator('nav').getByRole('button', { name: 'en', exact: true }).click();
  await frame.locator('[data-document-page-id="canvas"]').click();
  await frame.locator('.doc-float[data-block-id="float-image"]').waitFor();
  await page.waitForTimeout(200);
  return { page, frame };
};
const metrics = async context => context.locator('.doc-surface').evaluate(element => {
  const root = element.getBoundingClientRect(), scale = root.width / element.clientWidth;
  const rect = item => { const r = item.getBoundingClientRect(); return { x: (r.left - root.left) / scale, y: (r.top - root.top) / scale, w: r.width / scale, h: r.height / scale }; };
  const scroll = element.closest('.doc-scroll');
  return { scale, width: element.clientWidth, scrollWidth: scroll.scrollWidth, viewport: scroll.clientWidth, paper: element.closest('.doc-paper').getBoundingClientRect().width, text: rect(element.querySelector('[data-record-id="long"]')), anchor: rect(element.querySelector('[data-record-id="anchor"]')), floats: Object.fromEntries([...element.querySelectorAll('.doc-float')].map(item => [item.dataset.blockId, rect(item)])) };
});
const near = (actual, expected, message, tolerance = 0.8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} versus ${expected}`);
const compare = (actual, expected) => {
  assert.equal(actual.width, 642); assert.ok(actual.scale <= 1.001); assert.ok(actual.scrollWidth <= actual.viewport + 1, 'No horizontal scrollbar');
  for (const key of ['text', 'anchor']) for (const part of ['x', 'y', 'w', 'h']) near(actual[key][part], expected[key][part], key + '.' + part);
  for (const id of Object.keys(expected.floats)) for (const part of ['x', 'y', 'w', 'h']) near(actual.floats[id][part], expected.floats[id][part], id + '.' + part);
};
const contentSignature = node => ({ type: node.type, text: node.text, marks: node.marks, ...(node.attrs ? { attrs: Object.fromEntries(Object.entries(node.attrs).filter(([key]) => key !== 'legacyStyle' && key !== 'item')), ...(node.attrs.item ? { item: { id: node.attrs.item.id, data: node.attrs.item.data, layout: node.attrs.item.layout, imageWidth: node.attrs.item.style?.imageWidth } } : {}) } : {}), ...(node.content ? { content: node.content.map(contentSignature) } : {}) });
const resize = async (page, context, width) => {
  // Hidden native windows can defer compositor resize notifications. Set the
  // renderer viewport explicitly and wait for the canvas observer to settle.
  await page.setViewportSize({ width, height: 1000 });
  const window = await app.browserWindow(page);
  await window.evaluate(async window => { await window.webContents.capturePage(); });
  await context.locator('.doc-scroll').evaluate(async scroll => {
    for (let i = 0; i < 60; i++) {
      const expected = Math.min(1, Math.max(0.05, (scroll.clientWidth - 28) / 740));
      const surface = scroll.querySelector('.doc-surface');
      if (scroll.dataset.documentLayout !== 'fixed-canvas' || Math.abs(surface.getBoundingClientRect().width / surface.clientWidth - expected) < 0.001) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw Error('Canvas observer did not settle: ' + JSON.stringify({ viewport: scroll.clientWidth, actual: scroll.querySelector('.doc-surface').getBoundingClientRect().width / 642, style: scroll.getAttribute('style') }));
  });
};
try {
  app = await launch();
  const { page, frame } = await openEditor();
  let baseline;
  for (const width of [1800, 1440, 1000, 1800]) {
    await resize(page, frame, width);
    const value = await metrics(frame); baseline ||= value; compare(value, baseline); measurements.push({ mode: 'editor', windowWidth: width, ...value });
    near(value.floats['attached-image'].y, value.anchor.y + 18, 'Attachment follows its paragraph');
  }
  assert.equal(new Set(measurements.map(item => item.viewport)).size, 3, 'Three different editor widths actually rendered');
  await resize(page, frame, 1000);
  const before = await metrics(frame); assert.ok(before.scale < 0.95, 'Narrow editor shrinks the complete page');
  const gesture = async (id, selector, dx, dy) => frame.locator(`.doc-float[data-block-id="${id}"] ${selector}`).evaluate((handle, { dx, dy }) => {
    const rect = handle.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, buttons: 1, pointerId: 7, clientX: x, clientY: y }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, buttons: 1, pointerId: 7, clientX: x + dx, clientY: y + dy }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, buttons: 0, pointerId: 7, clientX: x + dx, clientY: y + dy }));
  }, { dx, dy });
  await gesture('float-image', '.doc-float-move', 20, 14); await page.waitForTimeout(120);
  const moved = await metrics(frame);
  near(moved.floats['float-image'].x, before.floats['float-image'].x + 20 / before.scale, 'Scaled drag X');
  near(moved.floats['float-image'].y, before.floats['float-image'].y + 14 / before.scale, 'Scaled drag Y');
  await gesture('float-image', '.doc-resize', 12, 10); await page.waitForTimeout(120);
  const resized = await metrics(frame);
  near(resized.floats['float-image'].w, moved.floats['float-image'].w + 12 / moved.scale, 'Scaled resize width');
  near(resized.floats['float-image'].h, moved.floats['float-image'].h + 10 / moved.scale, 'Scaled resize height');
  await frame.locator('.doc-surface').evaluate(element => element.editor.commands.undo()); await page.waitForTimeout(80);
  near((await metrics(frame)).floats['float-image'].w, moved.floats['float-image'].w, 'Undo resize');
  await frame.locator('.doc-surface').evaluate(element => element.editor.commands.redo()); await page.waitForTimeout(80);
  near((await metrics(frame)).floats['float-image'].h, resized.floats['float-image'].h, 'Redo resize');
  await gesture('attached-image', '.doc-float-move', -10, 12); await page.waitForTimeout(120);
  const attached = await metrics(frame);
  near(attached.floats['attached-image'].y, resized.floats['attached-image'].y + 12 / resized.scale, 'Attachment anchor remains in logical coordinates');
  const flowImage = frame.locator('[data-image-id="flow-image"]');
  await flowImage.locator('.doc-image-frame').dispatchEvent('pointerdown', { button: 0, buttons: 1, pointerId: 9 });
  const normalWidth = await flowImage.locator('.doc-image-wrap').evaluate(element => element.getBoundingClientRect().width);
  await flowImage.locator('.doc-resize').evaluate(handle => {
    const rect = handle.getBoundingClientRect(), x = rect.left, y = rect.top;
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1, clientX: x + 15, clientY: y }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x + 15, clientY: y }));
  });
  await page.waitForTimeout(80);
  near(await flowImage.locator('.doc-image-wrap').evaluate(element => element.getBoundingClientRect().width), normalWidth + 15, 'Embedded image resizes at the displayed scale', 3);
  const editedDocument = await frame.locator('.doc-surface').evaluate(element => element.editor.getJSON());
  await page.waitForTimeout(1200);
  const saved = await loadDocument('openxr-ui');
  const savedFloat = saved.content.canvas.blocks.find(item => item.id === 'float-image');
  near(savedFloat.layout.x, resized.floats['float-image'].x, 'Persisted X');
  near(savedFloat.layout.width, resized.floats['float-image'].w, 'Persisted width');
  await frame.locator('[data-document-page-id="flow"]').click(); await frame.locator('.doc-scroll[data-document-layout="flow"]').waitFor();
  const flowNarrow = await frame.locator('.doc-surface').evaluate(element => element.clientWidth);
  await resize(page, frame, 1800);
  assert.ok(await frame.locator('.doc-surface').evaluate(element => element.clientWidth) > flowNarrow, 'Ordinary flow pages stay responsive');
  await frame.locator('[data-document-page-id="canvas"]').click(); await frame.locator('.doc-float').first().waitFor(); await page.waitForTimeout(200);
  const beforeRestart = await metrics(frame);
  const capture = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
  await fs.writeFile(path.join(fixture, 'editor.png'), Buffer.from(capture, 'base64'));
  await close(); app = await launch();
  const restarted = await openEditor();
  await resize(restarted.page, restarted.frame, 1440);
  compare(await metrics(restarted.frame), beforeRestart);
  assert.deepEqual(contentSignature(await restarted.frame.locator('.doc-surface').evaluate(element => element.editor.getJSON())), contentSignature(editedDocument));
  // Share exactly the saved fixture, without reading or publishing user assets.
  const publicDocument = structuredClone(saved);
  for (const block of publicDocument.content.canvas.blocks) { if (block.type === 'image') block.data.src = image; for (const item of block.attachments || []) if (item.type === 'image') item.data.src = image; }
  await fs.writeFile(path.join(publishedRoot, 'document-data.json'), JSON.stringify(publicDocument));
  const newWindow = app.waitForEvent('window');
  await app.evaluate(async ({ BrowserWindow }, url) => { const window = new BrowserWindow({ show: false, width: 1440, height: 1000, webPreferences: { sandbox: true } }); window.webContents.setBackgroundThrottling(false); await window.loadURL(url); }, `http://127.0.0.1:${server.address().port}/`);
  const published = await newWindow; published.on('pageerror', error => errors.push(error.message));
  await published.locator('.doc-float[data-block-id="float-image"]').waitFor();
  for (const width of [1800, 1440, 1000, 650, 420, 1800]) {
    await resize(published, published, width);
    const value = await metrics(published); compare(value, beforeRestart); measurements.push({ mode: 'published', windowWidth: width, ...value });
  }
  await published.locator('nav').getByRole('button', { name: 'zh', exact: true }).click();
  await published.locator('.doc-scroll[data-document-language="zh"]').waitFor();
  const zh = await metrics(published);
  for (const width of [1000, 420, 1440]) {
    await resize(published, published, width); compare(await metrics(published), zh);
  }
  assert.deepEqual(errors, []);
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some(window => window.isVisible())), false);
  await fs.writeFile(path.join(fixture, 'report.json'), JSON.stringify({ passed: true, hidden: true, measurements, errors, checks: ['fixed text wrapping and floats at 1000/1440/1800 widths', 'proportional shrinking on narrow windows without horizontal scrolling', 'platform and published reader have identical logical layout', 'legacy pixel and ratio layouts, standalone/attached images and notes', 'scaled drag/resize and attachment anchors', 'saved layout survives normal close and restart', 'Chinese reader and ordinary responsive pages'], userImagesRead: false, userDocumentChanged: false, publishedOnline: false }, null, 2));
  console.log(JSON.stringify({ passed: true, fixture }));
} finally { await close(); await new Promise(resolve => server.close(resolve)); }
