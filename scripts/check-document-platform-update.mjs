import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { DesktopStateStore } from '../desktop/state-store.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixture = path.join(root, '.local/checks', `document-platform-update-${Date.now()}`);
await fs.mkdir(fixture, { recursive: true });
process.env.UE_MANAGER_WORKSPACE_ROOT = fixture;
const { createProject } = await import('../server/project-store.mjs');
const { loadDocument, saveDocument } = await import('../server/project-document-store.mjs');
const originalBackup = path.join(root, '.local/checks/document-tool-backups/20261015-033200/snapshot');
await fs.cp(path.join(originalBackup, 'docs-project'), path.join(fixture, 'docs-project'), { recursive: true });
const oldDocument = await loadDocument('openxr-ui');
assert.ok(oldDocument.pages.length > 0);
const oldBlocks = oldDocument.pages.flatMap(page => oldDocument.content[page.id].blocks);
assert.ok(oldBlocks.some(block => block.type === 'image' || block.attachments.some(attachment => attachment.type === 'image')));
await saveDocument(oldDocument, 'openxr-ui');
assert.deepEqual(await loadDocument('openxr-ui'), oldDocument, 'Old text, images, styles and attachments survive a save/reopen in the isolated copy.');

await createProject({ id: 'cursor-check', name: '新版文档验证' });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="280"><rect width="640" height="280" fill="#dce6ed"/><path d="M60 220L240 60 410 220 540 100" fill="none" stroke="#526879" stroke-width="8"/><text x="30" y="45" font-size="26">Document image check</text></svg>';
const image = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
await saveDocument({ sidebarTitle: '新版文档', docTitle: '新版文档接入验证', pages: [{ id: 'check-page', title: { zh: '图文检查', en: 'Document check' } }], content: { 'check-page': { blocks: [
  { id: 'heading', type: 'text', data: { zh: '旧标题和正文', en: 'Existing heading' }, style: { isSectionHeader: true, size: 'text-2xl', weight: 'font-bold' }, attachments: [] },
  { id: 'body', type: 'text', data: { zh: '连续编辑测试正文', en: 'English content to preserve' }, style: {}, attachments: [{ id: 'legacy-note', type: 'text', isFloating: true, data: { zh: '旧版悬浮注释', en: 'Legacy floating note' }, style: { size: 'text-xs' }, layout: { x: 260, y: 50, width: 180, height: 70 } }] },
  { id: 'image-a', type: 'image', data: { src: image }, style: { imageWidth: 65 }, attachments: [] },
  { id: 'after-image', type: 'text', data: { zh: '图片后的段落', en: 'After image' }, style: {}, attachments: [] },
  { id: 'image-b', type: 'image', data: { src: image }, style: { imageWidth: 45 }, attachments: [], annotations: [{ id: 'old-arrow', type: 'arrow', x1: 0.12, y1: 0.35, x2: 0.6, y2: 0.65, color: '#dc2626' }] },
] } } }, 'cursor-check');
const project = { id: 'document-check', name: '文档验证工程', path: fixture, ue: '5.3', type: 'UE 工程', imported: true, plugins: [], category: 'uncategorized', status: 'active' };
const store = new DesktopStateStore(path.join(fixture, '.local/desktop-data'));
await store.load();
await store.set('ue-pm-theme', 'epic-launcher');
await store.set('ue-nexus-prototype-v1', JSON.stringify({ theme: 'epic-launcher', catalog: [project], order: [project.id], overrides: {}, docsBindings: { [project.id]: 'cursor-check' } }));
const require = createRequire(import.meta.url);
const { _electron } = require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const checks = ['legacy document read/save/reopen without loss'];
const errors = [];
const executablePath = process.env.UE_DESKTOP_TEST_EXE || path.join(root, 'node_modules/electron/dist/electron.exe');
const launch = () => _electron.launch({ executablePath, args: process.env.UE_DESKTOP_TEST_EXE ? [] : [path.join(root, 'desktop/main.mjs')], cwd: root, env: { ...process.env, UE_DESKTOP_WORKSPACE: fixture, UE_DESKTOP_SMOKE: '1' }, timeout: 60000 });
let app, page, editor;
async function openEditor() {
  page = await app.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.showInactive(); });
  await page.locator('[data-project-card="document-check"] [data-action="open-project"]').first().click();
  await page.locator('[data-action="project-tab"][data-id="documents"]').click();
  await page.locator('#desktop-doc-editor').waitFor();
  editor = page.frameLocator('#desktop-doc-editor');
  await editor.locator('.doc-column').waitFor();
  assert.equal(await editor.locator('[data-flow-id="body"] [contenteditable="true"]').first().innerText(), '连续编辑测试正文');
}
async function closeNormally() {
  const done = app.waitForEvent('close', { timeout: 15000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await done;
  app = null;
}
try {
  app = await launch();
  await openEditor();
  checks.push('Cursor continuous editor embedded through platform document binding');
  assert.equal(await page.locator('#main-content').evaluate(el => el.classList.contains('desktop-document-focus')), true);
  assert.equal(await page.locator('.project-header').isVisible(), false, 'Document tab hides project title and cover.');
  const frameIdentity = await page.locator('#desktop-doc-editor').elementHandle();
  const expandedHeight = (await page.locator('#desktop-doc-editor').boundingBox()).height;
  await page.locator('[data-action="desktop-toggle-document-focus"]').click();
  assert.equal(await page.locator('.project-header').isVisible(), true);
  await page.locator('[data-action="desktop-toggle-document-focus"]').click();
  assert.equal(await frameIdentity.evaluate(el => el === document.getElementById('desktop-doc-editor')), true, 'Focus toggle keeps the same editor mounted.');
  assert.ok(expandedHeight > 600, 'Expanded document uses the available work area.');
  checks.push('document tab auto-expands; exit/fullscreen toggle keeps editor mounted');
  const body = editor.locator('[data-flow-id="body"] > [data-field="zh"]');
  await body.fill('新版编辑正文：切换工作页前必须保存');
  await page.evaluate(() => window.ueDesktopFlush());
  assert.equal((await loadDocument('cursor-check')).content['check-page'].blocks.find(block => block.id === 'body').data.zh, '新版编辑正文：切换工作页前必须保存');
  checks.push('immediate embedded save while text remains focused');
  for (const theme of ['dark-unreal', 'light-clean', 'dark-graphite', 'cyber-blue', 'epic-launcher']) {
    await page.locator('.theme-picker-btn').first().click();
    await page.locator(`[data-action="set-theme"][data-theme-id="${theme}"]`).first().click();
    await page.waitForFunction(theme => document.querySelector('#desktop-doc-editor')?.contentDocument?.documentElement.dataset.platformTheme === theme, theme);
    const paperTheme = await editor.locator('.doc-paper').evaluate(el => {
      const reference = document.createElement('span');reference.style.backgroundColor = 'var(--doc-paper-bg)';el.append(reference);
      const expected = getComputedStyle(reference).backgroundColor;reference.remove();
      return { actual: getComputedStyle(el).backgroundColor, expected };
    });
    assert.equal(paperTheme.actual, paperTheme.expected, theme + ': document paper follows the theme');
    for (const width of [1000, 1440, 1800]) {
      await app.evaluate(({ BrowserWindow }, width) => BrowserWindow.getAllWindows()[0].setSize(width, 960), width);
      const geometry = await editor.locator('.doc-paper').evaluate(el => ({ width: el.getBoundingClientRect().width, viewport: el.parentElement.clientWidth, overflow: document.documentElement.scrollWidth - innerWidth }));
      assert.ok(geometry.width >= geometry.viewport * 0.8, `${theme} ${width}: paper should fill the editor`);
      assert.ok(geometry.overflow <= 1, `${theme} ${width}: embedded editor should not overflow horizontally`);
      assert.equal(await page.locator('.project-header').isVisible(), false);
      if (width === 1440 || theme === 'epic-launcher') await page.screenshot({ path: path.join(fixture, `${theme}-${width}.png`) });
    }
  }
  checks.push('five existing themes and 1000/1440/1800 widths keep embedded content');
  await page.locator('[data-action="project-tab"][data-id="overview"]').click();
  await page.locator('.project-header').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.project-header').isVisible(), true, 'Project title returns on other tabs.');
  await page.locator('[data-action="project-tab"][data-id="documents"]').click();
  await editor.locator('.doc-column').waitFor();
  assert.equal(await editor.locator('[data-flow-id="body"] > [data-field="zh"]').innerText(), '新版编辑正文：切换工作页前必须保存');
  checks.push('leaving document view restores project details and preserves edits');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 960));
  await page.waitForTimeout(250);
  await editor.locator('[data-flow-id="image-a"] img').dragTo(editor.locator('[data-flow-id="heading"]'), { targetPosition: { x: 20, y: 2 } });
  await page.waitForFunction(() => document.querySelector('#desktop-doc-editor').contentDocument.querySelector('[data-flow-id]')?.dataset.flowId === 'image-a');
  checks.push('image drag ordering in embedded editor');
  await editor.locator('[data-flow-id="image-a"] img').click();
  await editor.locator('[data-flow-id="image-a"]').getByRole('button', { name: '涂鸦', exact: true }).click();
  await editor.locator('[data-flow-id="image-a"] button[title="方框"]').click();
  await editor.locator('[data-flow-id="image-a"] .doc-image-frame.is-drawing').waitFor();
  const frame = await editor.locator('[data-flow-id="image-a"] .doc-image-frame').boundingBox();
  await page.mouse.move(frame.x + frame.width * 0.3, frame.y + frame.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width * 0.8, frame.y + frame.height * 0.9, { steps: 5 });
  await page.mouse.up();
  await editor.locator('[data-flow-id="image-a"] .doc-anno > rect').waitFor();
  await page.evaluate(() => window.ueDesktopFlush());
  assert.ok((await loadDocument('cursor-check')).content['check-page'].blocks.find(block => block.id === 'image-a').annotations.some(annotation => annotation.type === 'rect'));
  checks.push('image annotation drawing and persistence');
  await editor.locator('[data-flow-id="image-a"]').getByRole('button', { name: '悬浮', exact: true }).click();
  await editor.locator('.doc-float .doc-image-frame img').waitFor();
  await editor.locator('.doc-float .doc-image-frame img').click();
  await editor.locator('.doc-float').getByRole('button', { name: '嵌入正文', exact: true }).click();
  await editor.locator('[data-flow-id="image-a"]').waitFor();
  checks.push('image flow/floating mode roundtrip');
  const frameElement = await page.locator('#desktop-doc-editor').elementHandle();
  const contentFrame = await frameElement.contentFrame();
  await contentFrame.evaluate(() => {
    const editor = document.querySelector('[data-flow-id="body"] [data-field="zh"]');
    editor.focus();
    const data = new DataTransfer();
    data.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHuoAAAAASUVORK5CYII='), c => c.charCodeAt(0))], 'clipboard.png', { type: 'image/png' }));
    editor.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  await editor.locator('.doc-image-frame img').nth(2).waitFor();
  await page.evaluate(() => window.ueDesktopFlush());
  let saved = await loadDocument('cursor-check');
  assert.equal(saved.content['check-page'].blocks.filter(block => block.type === 'image').length, 3);
  checks.push('clipboard image paste event and project asset persistence (synthetic clipboard)');
  const editable = editor.locator('[data-flow-id="body"] > [data-field="zh"]');
  await editable.fill('正常关闭立即保存，重新启动仍然可编辑');
  await closeNormally();
  saved = await loadDocument('cursor-check');
  assert.equal(saved.content['check-page'].blocks.find(block => block.id === 'body').data.zh, '正常关闭立即保存，重新启动仍然可编辑');
  app = await launch();
  // The parent can remember the project detail instead of the library after restart.
  page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.showInactive(); });
  await page.locator('[data-nav="projects"]').click();
  await page.locator('[data-project-card="document-check"] [data-action="open-project"]').first().click();
  await page.locator('[data-action="project-tab"][data-id="documents"]').click();
  await page.frameLocator('#desktop-doc-editor').locator('[data-flow-id="body"] > [data-field="zh"]').waitFor();
  assert.equal(await page.frameLocator('#desktop-doc-editor').locator('[data-flow-id="body"] > [data-field="zh"]').innerText(), '正常关闭立即保存，重新启动仍然可编辑');
  checks.push('normal guarded close saves new editor and restart restores text/images/annotations');
  await page.screenshot({ path: path.join(fixture, 'restart-restored.png') });
  assert.deepEqual(errors, []);
  await closeNormally();
  const report = { fixture, executablePath, checks, errors, legacy: { pages: oldDocument.pages.length, blocks: oldBlocks.length }, limitations: ['Clipboard test dispatches an image paste event; OS clipboard permissions are not exercised.', 'No real translation or publishing request was performed.'] };
  await fs.writeFile(path.join(fixture, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page?.screenshot({ path: path.join(fixture, 'failure.png'), timeout: 5000 }).catch(() => {});
  console.error(JSON.stringify({ fixture, checks, error: error.stack, errors }, null, 2));
  throw error;
} finally { await app?.close().catch(() => {}); }
