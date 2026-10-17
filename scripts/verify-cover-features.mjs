import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetHtml = path.resolve(__dirname, '../界面原型/ue-ai-devmanager-updated.html');
const fileUrl = 'file:///' + targetHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9338;

console.log('Target URL:', fileUrl);
console.log('Launching headless Chrome on port', port, '...');
const chromeProc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--disable-extensions',
  '--no-sandbox',
  '--window-size=1440,900',
  fileUrl
], { stdio: 'ignore' });

async function waitForPort(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      if (res.ok) {
        const data = await res.json();
        const pageTab = data.find(t => t.type === 'page');
        if (pageTab) return pageTab.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Chrome CDP failed to become ready');
}

async function run() {
  try {
    const wsUrl = await waitForPort();
    console.log('Connected to CDP at:', wsUrl);

    const ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.id && callbacks.has(parsed.id)) {
        const cb = callbacks.get(parsed.id);
        callbacks.delete(parsed.id);
        if (parsed.error) cb.reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
        else cb.resolve(parsed.result);
      }
    };

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        callbacks.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.exceptionDetails) {
        throw new Error('Eval error: ' + JSON.stringify(res.exceptionDetails));
      }
      return res.result?.value;
    }

    // Wait a brief moment for page render
    await new Promise(r => setTimeout(r, 800));

    // TEST 1: UE Project Library Cover Features
    console.log('\n--- TEST 1: UE Project Library ---');
    const projectCardThumbCount = await evaluate(`document.querySelectorAll('.cover-tools [data-action="thumbnail"]').length`);
    console.log('Project card cover-tools thumbnail buttons count:', projectCardThumbCount);
    if (projectCardThumbCount < 1) throw new Error('No thumbnail buttons found in project card cover-tools');

    // Click project thumbnail button
    await evaluate(`document.querySelector('.cover-tools [data-action="thumbnail"]').click()`);
    await new Promise(r => setTimeout(r, 300));
    const projectModalTitle = await evaluate(`document.getElementById('modal-title')?.textContent`);
    const projectModalHidden = await evaluate(`document.getElementById('modal-backdrop')?.hidden`);
    console.log('Project Modal open:', !projectModalHidden, '| Title:', projectModalTitle);
    if (projectModalHidden || !projectModalTitle.includes('缩略图') && !projectModalTitle.includes('封面')) {
      throw new Error('Project thumbnail modal failed to open properly');
    }

    // Close modal
    await evaluate(`document.querySelector('[data-action="close-modal"]').click()`);
    await new Promise(r => setTimeout(r, 200));

    // Test Project Detail Page
    console.log('\n--- TEST 1b: Project Detail Page ---');
    await evaluate(`document.querySelector('.project-title').click()`);
    await new Promise(r => setTimeout(r, 300));
    const detailAvatarWrap = await evaluate(`Boolean(document.querySelector('.project-avatar-wrap[data-action="thumbnail"]'))`);
    const detailHeaderBtn = await evaluate(`Boolean(document.querySelector('.project-header-actions [data-action="thumbnail"]'))`);
    console.log('Project detail avatar clickable:', detailAvatarWrap, '| Header action button present:', detailHeaderBtn);
    if (!detailAvatarWrap || !detailHeaderBtn) throw new Error('Project detail cover triggers missing');

    // Click detail cover button
    await evaluate(`document.querySelector('.project-header-actions [data-action="thumbnail"]').click()`);
    await new Promise(r => setTimeout(r, 300));
    const pDetailModalOpen = await evaluate(`!document.getElementById('modal-backdrop')?.hidden`);
    console.log('Project detail cover modal opened:', pDetailModalOpen);
    if (!pDetailModalOpen) throw new Error('Project detail cover modal did not open');
    await evaluate(`document.querySelector('[data-action="close-modal"]').click()`);
    await new Promise(r => setTimeout(r, 200));

    // TEST 2: Plugin Library Cover Features & Removal of Boxed Icon
    console.log('\n--- TEST 2: Plugin Library ---');
    await evaluate(`document.querySelector('[data-nav="plugins"]').click()`);
    await new Promise(r => setTimeout(r, 500));

    // Check plugin cards
    const pluginCardCount = await evaluate(`document.querySelectorAll('.plugin-card').length`);
    console.log('Plugin card count:', pluginCardCount);
    if (pluginCardCount === 0) throw new Error('No plugin cards found');

    // Verify boxed icon removal: NO .plugin-icon-wrap
    const boxedIconCount = await evaluate(`document.querySelectorAll('.plugin-icon-wrap').length`);
    console.log('Plugin icon wraps (.plugin-icon-wrap) count:', boxedIconCount);
    if (boxedIconCount !== 0) {
      throw new Error(`Boxed icon (.plugin-icon-wrap) was NOT deleted! Count: ${boxedIconCount}`);
    }
    console.log('✓ VERIFIED: Boxed icon badge is completely removed!');

    // Verify plugin cover images
    const pluginCoverImgCount = await evaluate(`document.querySelectorAll('.plugin-cover-img').length`);
    console.log('Plugin cover images (.plugin-cover-img) count:', pluginCoverImgCount);
    if (pluginCoverImgCount !== pluginCardCount) {
      throw new Error(`Mismatch between plugin cards (${pluginCardCount}) and cover images (${pluginCoverImgCount})`);
    }

    // Verify plugin cover tools
    const pluginThumbBtnCount = await evaluate(`document.querySelectorAll('.plugin-cover-tools [data-action="plugin-thumbnail"]').length`);
    console.log('Plugin cover tools button count:', pluginThumbBtnCount);
    if (pluginThumbBtnCount !== pluginCardCount) {
      throw new Error(`Mismatch in plugin-thumbnail buttons: ${pluginThumbBtnCount} vs ${pluginCardCount}`);
    }

    // Test clicking plugin-thumbnail button
    await evaluate(`document.querySelector('.plugin-cover-tools [data-action="plugin-thumbnail"]').click()`);
    await new Promise(r => setTimeout(r, 300));
    const pluginModalTitle = await evaluate(`document.getElementById('modal-title')?.textContent`);
    const pluginModalHidden = await evaluate(`document.getElementById('modal-backdrop')?.hidden`);
    console.log('Plugin Modal open:', !pluginModalHidden, '| Title:', pluginModalTitle);
    if (pluginModalHidden || !pluginModalTitle.includes('自定义插件封面')) {
      throw new Error('Plugin cover modal failed to open or title is incorrect: ' + pluginModalTitle);
    }
    console.log('✓ VERIFIED: Custom plugin cover modal works perfectly!');

    // Close modal
    await evaluate(`document.querySelector('[data-action="close-modal"]').click()`);
    await new Promise(r => setTimeout(r, 200));

    // TEST 3: Plugin List View
    console.log('\n--- TEST 3: Plugin List View ---');
    await evaluate(`document.querySelector('[data-action="plugin-view"][data-id="list"]').click()`);
    await new Promise(r => setTimeout(r, 300));
    const listRowThumbs = await evaluate(`document.querySelectorAll('.plugin-list-thumb-wrap[data-action="plugin-thumbnail"]').length`);
    const listRowBtns = await evaluate(`document.querySelectorAll('.project-list-row .card-actions [data-action="plugin-thumbnail"]').length`);
    console.log('List row thumb wraps:', listRowThumbs, '| List row action buttons:', listRowBtns);
    if (listRowThumbs === 0 || listRowBtns === 0) {
      throw new Error('Plugin list view is missing cover elements');
    }

    // Switch back to grid
    await evaluate(`document.querySelector('[data-action="plugin-view"][data-id="grid"]').click()`);
    await new Promise(r => setTimeout(r, 300));

    // TEST 4: Plugin Detail Page Cover
    console.log('\n--- TEST 4: Plugin Detail Page ---');
    await evaluate(`document.querySelector('.plugin-card').click()`);
    await new Promise(r => setTimeout(r, 400));

    const pluginDetailAvatar = await evaluate(`Boolean(document.querySelector('.plugin-detail-avatar[data-action="plugin-thumbnail"]'))`);
    const pluginDetailAvatarImg = await evaluate(`Boolean(document.querySelector('.plugin-detail-avatar img'))`);
    const pluginDetailActionBtn = await evaluate(`Boolean(document.querySelector('.plugin-detail-actions [data-action="plugin-thumbnail"]'))`);
    console.log('Plugin detail avatar clickable:', pluginDetailAvatar, '| Has cover image:', pluginDetailAvatarImg, '| Action button:', pluginDetailActionBtn);
    if (!pluginDetailAvatar || !pluginDetailAvatarImg || !pluginDetailActionBtn) {
      throw new Error('Plugin detail page is missing cover triggers');
    }

    // Click plugin detail cover button
    await evaluate(`document.querySelector('.plugin-detail-actions [data-action="plugin-thumbnail"]').click()`);
    await new Promise(r => setTimeout(r, 300));
    const pDetailModalTitle = await evaluate(`document.getElementById('modal-title')?.textContent`);
    console.log('Plugin detail modal title:', pDetailModalTitle);
    if (!pDetailModalTitle.includes('自定义插件封面')) {
      throw new Error('Plugin detail cover modal title mismatch: ' + pDetailModalTitle);
    }
    await evaluate(`document.querySelector('[data-action="close-modal"]').click()`);
    await new Promise(r => setTimeout(r, 200));

    console.log('\n========================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('1. Boxed icon badge completely removed.');
    console.log('2. UE Project Library cover tools & dialog fully restored.');
    console.log('3. Plugin Library cover images, tools & dialog fully active.');
    console.log('========================================\n');

    ws.close();
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    chromeProc.kill();
  }
}

run();
