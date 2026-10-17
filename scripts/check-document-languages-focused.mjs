import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { initialDocumentLanguage, rememberDocumentLanguage } from '../src/document-language.mjs';
import { DesktopStateStore } from '../desktop/state-store.mjs';
const root = process.cwd(), fixture = path.join(root, '.local/checks/document-languages-' + Date.now());
await fs.mkdir(path.join(fixture, 'temp'), { recursive: true });
process.env.TEMP = path.join(fixture, 'temp'); process.env.TMP = process.env.TEMP;
const memory = new Map([['doc-studio-language', 'bilingual']]);
const storage = { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) };
assert.equal(initialDocumentLanguage(false, storage), 'zh');
memory.set('doc-studio-language', 'zh'); assert.equal(initialDocumentLanguage(true, storage), 'en');
assert.equal(rememberDocumentLanguage('bilingual', false, storage), false);
assert.equal(rememberDocumentLanguage('zh', true, storage), true);
assert.equal(initialDocumentLanguage(true, storage), 'zh');
assert.equal(initialDocumentLanguage(true, { getItem() { throw Error('Unavailable'); } }), 'en');
const publishedRoot = path.join(root, '.local/checks/doc-review-20261017/published');
await fs.writeFile(path.join(publishedRoot, 'document-data.json'), JSON.stringify({ sidebarTitle: 'Existing docs', docTitle: 'Existing documentation', pages: [{ id: 'main', title: { zh: '中文页', en: 'Existing page' } }], content: { main: { blocks: [{ id: 'body', type: 'text', data: { zh: '中文保留正文', en: 'Existing English content' }, style: {}, attachments: [] }] } } }));
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/seed') { response.setHeader('Content-Type', 'text/html'); response.end('<script>sessionStorage.setItem("doc-studio-language","zh");location.replace("/")</script>'); return; }
  const file = path.resolve(publishedRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(publishedRoot + path.sep)) { response.writeHead(403); response.end(); return; }
  try { const bytes = await fs.readFile(file); response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html'); response.end(bytes); }
  catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
await fs.cp(path.join(root, '.local/projects/openxr-ui-review-20261017/public'), path.join(fixture, 'docs-project'), { recursive: true });
const state = new DesktopStateStore(path.join(fixture, '.local/desktop-data')); await state.load();
const project = { id: 'review-project', name: '中文审阅验证', path: fixture, ue: '5.3', type: 'UE 工程', imported: true, plugins: [], category: 'uncategorized', status: 'active' };
await state.set('ue-pm-theme', 'epic-launcher');
await state.set('ue-nexus-prototype-v1', JSON.stringify({ theme: 'epic-launcher', catalog: [project], order: [project.id], overrides: {}, docsBindings: { [project.id]: 'openxr-ui' } }));
const require = createRequire(import.meta.url), { _electron } = require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let app;
const errors = [];
try {
  app = await _electron.launch({ executablePath: process.env.UE_DESKTOP_TEST_EXE || path.join(root, 'node_modules/electron/dist/electron.exe'), args: process.env.UE_DESKTOP_TEST_EXE ? [] : [path.join(root, 'desktop/main.mjs')], cwd: root, env: { ...process.env, UE_DESKTOP_WORKSPACE: fixture, UE_DESKTOP_SMOKE: '1' } });
  const page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
  await page.evaluate(() => sessionStorage.setItem('doc-studio-language', 'bilingual'));
  await page.locator('[data-project-card="review-project"] [data-action="open-project"]').first().click();
  await page.locator('[data-action="project-tab"][data-id="documents"]').click();
  const frame = page.frameLocator('#desktop-doc-editor');
  await frame.locator('.doc-scroll[data-document-language="zh"] .doc-surface').waitFor();
  assert.equal(await frame.locator('nav').getByRole('button', { name: 'bilingual', exact: true }).count(), 0);
  for (const language of ['zh', 'en']) assert.equal(await frame.locator('nav').getByRole('button', { name: language, exact: true }).count(), 1);
  await frame.locator('[data-document-page-id="review-page-5"]').click();
  await frame.locator('.doc-surface h2').first().waitFor();
  const typography = await frame.locator('.doc-surface').evaluate(element => ({ body: getComputedStyle(element.querySelector('p')).fontSize, heading: getComputedStyle(element.querySelector('h2')).fontSize, bold: getComputedStyle(element.querySelector('strong')).fontWeight }));
  assert.equal(typography.body, '16px'); assert.equal(typography.heading, '24px'); assert.equal(typography.bold, '700');
  assert.equal(await frame.locator('[data-document-page-id]').count(), 12);
  await fs.writeFile(path.join(fixture, 'review-page-text.txt'), await frame.locator('.doc-surface').innerText());
  const newWindow = app.waitForEvent('window');
  await app.evaluate(async ({ BrowserWindow }, url) => { const window = new BrowserWindow({ show: false, width: 1200, height: 900, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } }); window.webContents.setBackgroundThrottling(false); await window.loadURL(url); }, `http://127.0.0.1:${server.address().port}/seed`);
  const published = await newWindow; published.on('pageerror', error => errors.push(error.message));
  await published.locator('.doc-scroll[data-document-language="en"]').waitFor();
  assert.equal(await published.locator('html').getAttribute('lang'), 'en');
  assert.equal(await published.getByText('Interface Language', { exact: true }).count(), 1);
  assert.equal(await published.locator('nav').getByRole('button', { name: 'bilingual', exact: true }).count(), 0);
  assert.equal(await published.locator('.doc-surface').innerText(), 'Existing English content');
  await published.locator('nav').getByRole('button', { name: 'zh', exact: true }).click();
  await published.locator('.doc-scroll[data-document-language="zh"]').waitFor();
  await published.reload(); await published.locator('.doc-scroll[data-document-language="zh"]').waitFor();
  assert.equal(await published.locator('.doc-surface').innerText(), '中文保留正文');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(fixture, 'report.json'), JSON.stringify({ passed: true, typography, checks: ['bilingual removed and stale preference migrates to Chinese editor', 'review document has twelve Chinese pages with consistent font sizes and emphasis', 'published page defaults to English independently of editor preference', 'share reader can switch language and retain their choice'], errors, onlyChangedDocumentUIChecked: true, userImagesRead: false, publishedOnline: false }, null, 2));
  console.log(JSON.stringify({ passed: true, fixture }));
} finally {
  if (app) { const closed = app.waitForEvent('close', { timeout: 15000 }); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(window => window.close())); await closed; }
  await new Promise(resolve => server.close(resolve));
}
