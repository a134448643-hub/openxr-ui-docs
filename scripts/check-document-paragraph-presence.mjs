import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import YAML from 'yaml';
import { DesktopStateStore } from '../desktop/state-store.mjs';
import { documentFromRecords, inlineText } from '../server/document-rich-text.mjs';

const root = process.cwd(), fixture = path.join(root, '.local/checks/document-paragraph-presence-' + Date.now());
await fs.mkdir(path.join(fixture, 'temp'), { recursive: true });
process.env.TEMP = path.join(fixture, 'temp'); process.env.TMP = process.env.TEMP;
process.env.UE_MANAGER_WORKSPACE_ROOT = fixture;
const manifest = YAML.parse(await fs.readFile(path.join(root, 'docs-project/document.yaml'), 'utf8'));
const sourcePage = manifest.pages.find(page => page.title.zh === '更新说明/项目须知');
assert.ok(sourcePage);
// Copy only text and layout metadata. No screenshot/image files are read.
for (const file of [sourcePage.file, sourcePage.layout]) {
  const target = path.join(fixture, 'docs-project', file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(path.join(root, 'docs-project', file), target);
}
await fs.writeFile(path.join(fixture, 'docs-project/document.yaml'), YAML.stringify({ ...manifest, pages: [sourcePage] }));
const { loadDocument, saveDocument } = await import('../server/project-document-store.mjs');
const document = await loadDocument('openxr-ui');
const sourceTexts = document.content[sourcePage.id].blocks.filter(block => block.type === 'text' && !block.isFloating).map(block => ({ ...block, attachments: [] }));
const legacyHidden = sourceTexts.filter(block => !block.data.zh && block.data.en);
assert.ok(legacyHidden.some(block => block.id === 'b1791986912346'));
assert.ok(legacyHidden.some(block => block.id === 'b1769102970651'));
const visible = documentFromRecords(sourceTexts, 'zh');
for (const block of legacyHidden) assert.ok(!visible.content.some(node => node.attrs.recordId === block.id));
const sourceChinese = sourceTexts.filter(block => block.data.zh).map(block => block.data.zh);
assert.deepEqual(visible.content.map(node => inlineText(node.content)).filter(Boolean), sourceChinese, 'Existing Chinese text and manual line breaks stay unchanged');

const text = (id, zh, en = '') => ({ id, type: 'text', data: { zh, en }, style: {}, attachments: [] });
document.pages.push({ id: 'other', title: { zh: '切页验证', en: 'Other' } });
document.content.other = { blocks: [text('other-body', '切页保留正文')] };
document.content[sourcePage.id].blocks = [
  text('first', '第一条验证正文', 'First English'),
  text('remove-me', '删除这条中文段落', 'Keep this English translation'),
  text('last', '第二条验证正文', 'Second English'),
  ...sourceTexts,
];
await saveDocument(document, 'openxr-ui');
const state = new DesktopStateStore(path.join(fixture, '.local/desktop-data')); await state.load();
const project = { id: 'paragraph-project', name: '文档换行验证', path: fixture, ue: '5.3', type: 'UE 工程', imported: true, plugins: [], category: 'uncategorized', status: 'active' };
await state.set('ue-pm-theme', 'epic-launcher');
await state.set('ue-nexus-prototype-v1', JSON.stringify({ theme: 'epic-launcher', catalog: [project], order: [project.id], overrides: {}, docsBindings: { [project.id]: 'openxr-ui' } }));
const require = createRequire(import.meta.url), { _electron } = require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let app, page, frame, surface;
const errors = [], checks = ['actual notice page text has no phantom paragraphs at legacy English-only records'];
async function open() {
  app = await _electron.launch({ executablePath: process.env.UE_DESKTOP_TEST_EXE || path.join(root, 'node_modules/electron/dist/electron.exe'), args: process.env.UE_DESKTOP_TEST_EXE ? [] : [path.join(root, 'desktop/main.mjs')], cwd: root, env: { ...process.env, UE_DESKTOP_WORKSPACE: fixture, UE_DESKTOP_SMOKE: '1' } });
  page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setSize(1440, 1000); });
  await page.locator('[data-project-card="paragraph-project"] [data-action="open-project"]').first().click();
  await page.locator('[data-action="project-tab"][data-id="documents"]').click();
  frame = page.frameLocator('#desktop-doc-editor'); surface = frame.locator('.doc-surface'); await surface.waitFor();
  await language('zh');
}
async function language(value) {
  await frame.locator('nav').getByRole('button', { name: value, exact: true }).click();
  await frame.locator(`.doc-scroll[data-document-language="${value}"]`).waitFor();
}
const paragraph = id => surface.locator(`[data-record-id="${id}"][data-language="zh"]`);
async function flush() { await page.evaluate(() => window.ueDesktopFlush()); return loadDocument('openxr-ui'); }
async function close() { const closed = app.waitForEvent('close', { timeout: 15000 }); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()); await closed; app = null; }
async function checkAbsent() {
  assert.equal(await paragraph('remove-me').count(), 0);
  for (const block of legacyHidden) assert.equal(await paragraph(block.id).count(), 0);
}
try {
  await open();
  for (const block of legacyHidden) assert.equal(await paragraph(block.id).count(), 0);
  const automaticSave = page.waitForResponse(response => response.url().includes('/api/document') && response.request().method() === 'POST' && response.ok());
  await surface.evaluate(el => {
    const editor = el.editor;
    let range;
    editor.state.doc.forEach((node, position) => { if (node.attrs.recordId === 'remove-me') range = { from: position, to: position + node.nodeSize }; });
    if (!range) throw Error('Missing paragraph');
    editor.commands.deleteRange(range);
  });
  await checkAbsent();
  // Wait for automatic persistence, rather than only testing explicit flush.
  await automaticSave;
  await frame.locator('.doc-save-status').waitFor({ state: 'detached' });
  let saved = await flush();
  assert.equal(saved.content[sourcePage.id].blocks.find(block => block.id === 'remove-me').data.en, 'Keep this English translation');
  await checkAbsent();
  checks.push('paragraph deletion and automatic save do not recreate Chinese paragraph; English remains stored');
  await frame.locator('[data-document-page-id="other"]').click();
  await frame.locator(`[data-document-page-id="${sourcePage.id}"]`).click();
  await paragraph('first').waitFor(); await checkAbsent();
  await language('en');
  assert.equal(await surface.locator('[data-record-id="remove-me"][data-language="en"]').innerText(), 'Keep this English translation');
  await language('zh'); await checkAbsent();
  checks.push('page/language switching does not restore deleted or legacy blank paragraphs');
  await surface.evaluate(el => {
    const editor = el.editor;
    let position;
    editor.state.doc.forEach((node, offset) => { if (node.attrs.recordId === 'last') position = offset + 1; });
    editor.chain().setTextSelection(position).splitBlock().run();
  });
  const blankId = await surface.evaluate(el => [...el.children].find(node => node.dataset.language === 'zh' && !node.textContent)?.dataset.recordId);
  assert.ok(blankId);
  saved = await flush();
  assert.ok(saved.content[sourcePage.id].blocks.some(block => block.id === blankId && block.data.zh === ''));
  await frame.locator('[data-document-page-id="other"]').click();
  await frame.locator(`[data-document-page-id="${sourcePage.id}"]`).click();
  await paragraph(blankId).waitFor();
  assert.equal(await paragraph(blankId).textContent(), '');
  await checkAbsent();
  checks.push('an intentional Enter-created empty paragraph remains after saving and page switching');
  await fs.writeFile(path.join(fixture, 'editor-text.txt'), await surface.innerText());
  await close(); await open();
  await checkAbsent(); await paragraph(blankId).waitFor();
  saved = await flush();
  for (const block of sourceTexts) {
    const current = saved.content[sourcePage.id].blocks.find(entry => entry.id === block.id);
    assert.equal(current?.data.zh, block.data.zh); assert.equal(current?.data.en, block.data.en);
  }
  checks.push('normal app close/reopen keeps intentional spacing, deleted paragraphs absent, existing Chinese and English text intact');
  assert.deepEqual(errors, []);
  await close();
  await fs.writeFile(path.join(fixture, 'report.json'), JSON.stringify({ passed: true, checks, errors, userImagesRead: false, sourceDocumentModified: false, executable: process.env.UE_DESKTOP_TEST_EXE || 'development Electron', limitations: ['Only document paragraph editing tested, one theme and one width, hidden window; isolated text fixture only.'] }, null, 2));
  console.log(JSON.stringify({ passed: true, fixture, checks }));
} finally { if (app) await close(); }
