import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DesktopStateStore } from '../desktop/state-store.mjs';
const root = path.resolve(import.meta.dirname, '..'), fixture = path.join(root, '.local/checks/image-drag-' + Date.now());
await fs.mkdir(path.join(fixture, 'temp'), { recursive: true });
process.env.TEMP = path.join(fixture, 'temp'); process.env.TMP = process.env.TEMP;
process.env.UE_MANAGER_WORKSPACE_ROOT = fixture;
const { createProject } = await import('../server/project-store.mjs');
const { saveDocument, loadDocument } = await import('../server/project-document-store.mjs');
await createProject({ id: 'drag', name: '图片排序与首图输入' });
const svg = color => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="100"><rect width="600" height="100" fill="${color}"/></svg>`).toString('base64');
const picture = (id, color) => ({ id, type: 'image', isFloating: false, data: { src: svg(color), srcEn: svg('silver'), shareWithEnglish: false }, style: { imageWidth: 68 }, annotations: [{ id: id + '-mark', type: 'rect', x: .1, y: .1, w: .2, h: .2, color: '#dc2626' }], attachments: [] });
const text = id => ({ id, type: 'text', isFloating: false, data: { zh: '', en: '' }, style: {}, attachments: [] });
await saveDocument({ sidebarTitle: '图片排序', docTitle: '图片排序与首图输入', pages: [{ id: 'main', title: { zh: '首图开始的页面', en: 'Images first' } }, { id: 'top', title: { zh: '页首无文本', en: 'No leading text' } }], content: { main: { blocks: [picture('first', 'gray'), text('between'), picture('second', 'dimgray'), text('end')] }, top: { blocks: [picture('top-first', 'gray'), picture('top-second', 'dimgray')] } } }, 'drag');
const original = await loadDocument('drag');
const store = new DesktopStateStore(path.join(fixture, '.local/desktop-data')); await store.load();
const project = { id: 'drag-project', name: '图片排序测试', path: fixture, ue: '5.3', type: 'UE 工程', imported: true, plugins: [], category: 'uncategorized', status: 'active' };
await store.set('ue-pm-theme', 'epic-launcher');
await store.set('ue-nexus-prototype-v1', JSON.stringify({ theme: 'epic-launcher', catalog: [project], order: [project.id], overrides: {}, docsBindings: { [project.id]: 'drag' } }));
const require = createRequire(import.meta.url), { _electron } = require('C:/Users/10728/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
let app, page, frame, surface;
const errors = [], checks = [];
const launch = () => _electron.launch({ executablePath: process.env.UE_DESKTOP_TEST_EXE || path.join(root, 'node_modules/electron/dist/electron.exe'), args: process.env.UE_DESKTOP_TEST_EXE ? [] : [path.join(root, 'desktop/main.mjs')], cwd: root, env: { ...process.env, UE_DESKTOP_WORKSPACE: fixture, UE_DESKTOP_SMOKE: '1' } });
async function open() {
  page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.showInactive(); win.setSize(1440, 1000); });
  await page.locator('[data-project-card="drag-project"] [data-action="open-project"]').first().click();
  await page.locator('[data-action="project-tab"][data-id="documents"]').click();
  frame = page.frameLocator('#desktop-doc-editor'); surface = frame.locator('.doc-surface'); await surface.waitFor();
  await frame.locator('nav').getByRole('button', { name: 'zh', exact: true }).click();
  await frame.locator('.doc-scroll[data-document-language="zh"]').waitFor();
}
async function close() { const done = app.waitForEvent('close', { timeout: 15000 }); await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()); await done; app = null; }
async function flush() { await page.evaluate(() => window.ueDesktopFlush()); return loadDocument('drag'); }
async function drag(source, target, edge) {
  const targetImage = surface.locator(`[data-image-id="${target}"] [data-image-language="zh"] img`);
  const size = await targetImage.boundingBox();
  await surface.locator(`[data-image-id="${source}"] [data-image-language="zh"] img`).dragTo(targetImage, { targetPosition: { x: size.width / 2, y: edge === 'before' ? 3 : size.height - 3 } });
}
try {
  app = await launch(); await open();
  await drag('first', 'second', 'after');
  let saved = await flush();
  assert.deepEqual(saved.content.main.blocks.filter(b => b.type === 'image').map(b => b.id), ['second', 'first'], 'Move the existing image instead of importing a copy');
  for (const id of ['first', 'second']) {
    const old = original.content.main.blocks.find(b => b.id === id), current = saved.content.main.blocks.find(b => b.id === id);
    assert.deepEqual(current.data, old.data); assert.deepEqual(current.annotations, old.annotations); assert.equal(current.style.imageWidth, old.style.imageWidth);
  }
  checks.push('native image drag down moves identity, localized sources, size and annotations without duplication');
  await drag('first', 'second', 'before');
  saved = await flush(); assert.deepEqual(saved.content.main.blocks.filter(b => b.type === 'image').map(b => b.id), ['first', 'second']);
  await frame.getByRole('button', { name: '撤销', exact: true }).first().click();
  saved = await flush(); assert.deepEqual(saved.content.main.blocks.filter(b => b.type === 'image').map(b => b.id), ['second', 'first']);
  await frame.getByRole('button', { name: '重做', exact: true }).first().click();
  saved = await flush(); assert.deepEqual(saved.content.main.blocks.filter(b => b.type === 'image').map(b => b.id), ['first', 'second']);
  checks.push('move upward, undo and redo retain exactly two images');
  await surface.locator('[data-image-id="first"] [data-image-boundary="before"]').click();
  await page.keyboard.insertText('图片上方的中文说明');
  saved = await flush(); assert.equal(saved.content.main.blocks[0].data.zh, '图片上方的中文说明'); assert.equal(saved.content.main.blocks[1].id, 'first');
  checks.push('click first-image upper edge and type an ordinary paragraph before the image');
  await surface.locator('[data-image-id="second"] [data-image-boundary="before"]').click();
  await page.keyboard.insertText('第二张图之前');
  saved = await flush(); assert.ok(saved.content.main.blocks.some((b, i, all) => b.data?.zh === '第二张图之前' && all[i + 1]?.id === 'second'));
  checks.push('insert text between images');
  await frame.getByText('页首无文本', { exact: true }).click();
  const paper = frame.locator('.doc-paper');
  const width = (await paper.boundingBox()).width;
  await paper.click({ position: { x: width / 2, y: 10 } });
  await page.keyboard.insertText('点击页首留白插入');
  saved = await flush(); assert.equal(saved.content.top.blocks[0].data.zh, '点击页首留白插入');
  for (let i = 0; i < 3 && saved.content.top.blocks[0].id !== 'top-first'; i++) { await frame.getByRole('button', { name: '撤销', exact: true }).first().click(); saved = await flush(); }
  assert.equal(saved.content.top.blocks[0].id, 'top-first');
  await surface.locator('[data-image-id="top-first"] [data-image-boundary="before"]').click();
  await page.keyboard.insertText('首张图片上沿插入');
  saved = await flush(); assert.equal(saved.content.top.blocks[0].data.zh, '首张图片上沿插入');
  for (let i = 0; i < 3 && saved.content.top.blocks[0].id !== 'top-first'; i++) { await frame.getByRole('button', { name: '撤销', exact: true }).first().click(); saved = await flush(); }
  assert.equal(saved.content.top.blocks[0].id, 'top-first');
  await surface.locator('[data-image-id="top-first"] [data-image-language="zh"] img').click();
  await page.keyboard.press('ArrowUp'); await page.keyboard.insertText('键盘插入首图说明');
  saved = await flush(); assert.equal(saved.content.top.blocks[0].data.zh, '键盘插入首图说明');
  assert.equal(saved.content.top.blocks[1].id, 'top-first');
  await page.screenshot({ path: path.join(fixture, 'first-image-top-text.png') });
  checks.push('page containing only images: top paper whitespace, image upper edge and ArrowUp all create leading text');
  await frame.getByText('首图开始的页面', { exact: true }).click();
  const snapshot = saved;
  await close(); app = await launch(); await open(); assert.deepEqual(await loadDocument('drag'), snapshot);
  checks.push('normal save/restart retains order and inserted text');
  for (const theme of ['dark-unreal', 'light-clean', 'dark-graphite', 'cyber-blue', 'epic-launcher']) {
    await page.locator('.theme-picker-btn').first().click(); await page.locator(`[data-action="set-theme"][data-theme-id="${theme}"]`).first().click();
    await page.waitForFunction(t => document.querySelector('#desktop-doc-editor')?.contentDocument?.documentElement.dataset.platformTheme === t, theme);
    await frame.locator('nav').getByRole('button', { name: 'zh', exact: true }).click();
    await frame.locator('.doc-scroll[data-document-language="zh"]').waitFor();
    for (const width of [1000, 1440, 1800]) {
      await app.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setSize(w, 1000), width);
      await page.waitForFunction(w => innerWidth === w, width);
      await drag('second', 'first', 'before'); await drag('second', 'first', 'after');
      saved = await flush(); assert.deepEqual(saved.content.main.blocks.filter(b => b.type === 'image').map(b => b.id), ['first', 'second']);
      await surface.locator('[data-image-id="first"] [data-image-boundary="before"]').click();
      assert.equal(await surface.evaluate(el => el.editor.state.selection.$from.parent.type.name), 'paragraph');
      await page.screenshot({ path: path.join(fixture, `${theme}-${width}.png`) });
    }
  }
  checks.push('five themes at 1000/1440/1800: image reorder and upper text boundary');
  assert.deepEqual(errors, []); await close();
  await fs.writeFile(path.join(fixture, 'report.json'), JSON.stringify({ passed: true, fixture, checks, errors, executable: process.env.UE_DESKTOP_TEST_EXE || 'development electron', userImagesRead: false }, null, 2));
  console.log(JSON.stringify({ passed: true, checks, fixture }));
} catch (error) {
  await fs.writeFile(path.join(fixture, 'failure.json'), JSON.stringify({ checks, error: error.stack }, null, 2)); throw error;
} finally { if (app) await close(); }
