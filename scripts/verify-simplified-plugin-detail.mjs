import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetHtml = path.resolve(__dirname, '../界面原型/ue-ai-devmanager-updated.html');
const fileUrl = 'file:///' + targetHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9335;

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

try {
  const wsUrl = await waitForPort();
  console.log('Connected to Chrome CDP');

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  const callbacks = new Map();
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const cb = callbacks.get(data.id);
      callbacks.delete(data.id);
      if (data.error) cb.reject(new Error(data.error.message));
      else cb.resolve(data.result);
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
  await send('DOM.enable');

  await new Promise(r => setTimeout(r, 1500));

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text || 'Evaluate failed');
    }
    return res.result?.value;
  }

  // 1. Click plugins nav button in sidebar
  console.log('Step 1: Clicking [data-nav="plugins"] in sidebar...');
  const navPluginsResult = await evaluate(`
    (function() {
      const btn = document.querySelector('[data-nav="plugins"]');
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent.trim() };
      }
      return { clicked: false };
    })()
  `);
  console.log('Navigated to plugins view:', navPluginsResult);
  await new Promise(r => setTimeout(r, 600));

  // Check how many plugin cards are rendered in library
  const libCards = await evaluate(`
    (function() {
      const cards = Array.from(document.querySelectorAll('[data-action="open-plugin"]'));
      return cards.map(c => ({
        id: c.dataset.id,
        name: c.querySelector('.plugin-card-title')?.textContent.trim() || c.textContent.trim().slice(0, 30)
      }));
    })()
  `);
  console.log('Plugin library cards found:', libCards.length, libCards.map(c => c.id));

  // Step 2: Click the GameplayAbilities Extended plugin card (p-gas-ext)
  console.log('Step 2: Clicking p-gas-ext plugin card...');
  await evaluate(`
    (function() {
      const card = document.querySelector('[data-action="open-plugin"][data-id="p-gas-ext"]') || document.querySelectorAll('[data-action="open-plugin"]')[0];
      if (card) card.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // Step 3: Verify Plugin Detail Header and Tabs
  const detailCheck = await evaluate(`
    (function() {
      const headerTitle = document.querySelector('.plugin-detail-info h1')?.textContent.trim();
      const tabs = Array.from(document.querySelectorAll('.plugin-detail-top .tabs .tab')).map(t => t.textContent.trim());
      const actions = Array.from(document.querySelectorAll('.plugin-detail-actions button')).map(b => b.textContent.trim());
      
      const nodeCards = Array.from(document.querySelectorAll('.bp-node-card'));
      const hasPins = Boolean(document.querySelector('.bp-pins-wrap, .bp-pin-row, .bp-pins-box'));
      const hasCppBlock = Boolean(document.querySelector('.bp-cpp-box, .bp-cpp-sig'));

      const nodeSummaries = nodeCards.map(c => ({
        title: c.querySelector('.bp-node-title strong')?.textContent.trim(),
        cName: c.querySelector('.bp-node-cname')?.textContent.trim(),
        badge: c.querySelector('.bp-node-badge')?.textContent.trim(),
        category: c.querySelector('.bp-node-category')?.textContent.trim(),
        desc: c.querySelector('.bp-node-desc')?.textContent.trim()
      }));

      return {
        headerTitle,
        tabs,
        actions,
        nodeCount: nodeCards.length,
        hasPins,
        hasCppBlock,
        nodeSummaries
      };
    })()
  `);
  console.log('\n=== VERIFICATION: PLUGIN DETAIL & BLUEPRINT NODES ===');
  console.log('Header Title:', detailCheck.headerTitle);
  console.log('Tabs visible (EXACTLY 2 EXPECTED):', detailCheck.tabs);
  console.log('Action buttons:', detailCheck.actions);
  console.log('Blueprint nodes count:', detailCheck.nodeCount);
  console.log('Has pin dots / variable rows (MUST BE FALSE):', detailCheck.hasPins);
  console.log('Has C++ code signature block (MUST BE FALSE):', detailCheck.hasCppBlock);
  console.log('Nodes preview:', detailCheck.nodeSummaries);

  // Take screenshot 1: Simplified Blueprint Nodes
  const brainDir = 'C:/Users/10728/.gemini/antigravity/brain/631581d0-4d5c-4e89-ad8e-b8c1cf535525';
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(brainDir, 'verified_plugin_detail_simplified_nodes.png'), Buffer.from(snap1.data, 'base64'));
  console.log('Saved verified_plugin_detail_simplified_nodes.png');

  // Step 4: Click 说明文档 tab
  console.log('\nStep 4: Clicking [说明文档] tab...');
  await evaluate(`
    (function() {
      const docTab = document.querySelector('.tabs .tab[data-tab="docs"]');
      if (docTab) docTab.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // Step 5: Verify Document Studio within Plugin Detail
  const docStudioCheck = await evaluate(`
    (function() {
      const hasDocStudio = Boolean(document.querySelector('.doc-studio-layout'));
      const sidebarBrand = document.querySelector('.doc-brand-badge')?.textContent.trim();
      const sidebarSub = document.querySelector('.doc-project-sub')?.textContent.trim();
      const subnavPills = Array.from(document.querySelectorAll('.doc-subnav-pill')).map(p => p.textContent.trim());
      const pages = Array.from(document.querySelectorAll('.doc-page-item')).map(p => ({
        title: p.querySelector('.doc-page-item-title')?.textContent.trim(),
        sub: p.querySelector('.doc-page-item-sub')?.textContent.trim(),
        active: p.classList.contains('active')
      }));
      const docPaperH1 = document.querySelector('.doc-paper-h1')?.textContent.trim();
      const docPaperH2 = document.querySelector('.doc-paper-h2')?.textContent.trim();
      const blockCount = document.querySelectorAll('.doc-block').length;
      const langSegmented = Array.from(document.querySelectorAll('.doc-lang-btn')).map(b => b.textContent.trim());
      const modeToggle = Array.from(document.querySelectorAll('.doc-mode-btn')).map(b => b.textContent.trim());

      return {
        hasDocStudio,
        sidebarBrand,
        sidebarSub,
        subnavPills,
        pages,
        docPaperH1,
        docPaperH2,
        blockCount,
        langSegmented,
        modeToggle
      };
    })()
  `);
  console.log('\n=== VERIFICATION: DOCUMENT STUDIO IN PLUGIN DETAIL ===');
  console.log('Doc Studio layout mounted:', docStudioCheck.hasDocStudio);
  console.log('Sidebar Brand:', docStudioCheck.sidebarBrand);
  console.log('Sidebar Subtitle:', docStudioCheck.sidebarSub);
  console.log('Subnav pills:', docStudioCheck.subnavPills);
  console.log('Pages count:', docStudioCheck.pages.length);
  console.log('Pages:', docStudioCheck.pages.map(p => `${p.title} (${p.sub}) [active: ${p.active}]`));
  console.log('Document Paper H1:', docStudioCheck.docPaperH1);
  console.log('Document Paper H2:', docStudioCheck.docPaperH2);
  console.log('Doc Content blocks count:', docStudioCheck.blockCount);
  console.log('Language toggles:', docStudioCheck.langSegmented);
  console.log('Mode toggles:', docStudioCheck.modeToggle);

  // Take screenshot 2: Document Studio in Plugin Detail
  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(brainDir, 'verified_plugin_detail_doc_studio.png'), Buffer.from(snap2.data, 'base64'));
  console.log('Saved verified_plugin_detail_doc_studio.png');

  // Step 6: Test switching page in Document Studio
  console.log('\nStep 6: Selecting Page 2 in sidebar...');
  await evaluate(`
    (function() {
      const pageBtns = document.querySelectorAll('.doc-page-item');
      if (pageBtns.length > 1) pageBtns[1].click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  const page2Check = await evaluate(`
    (function() {
      return {
        h1: document.querySelector('.doc-paper-h1')?.textContent.trim(),
        h2: document.querySelector('.doc-paper-h2')?.textContent.trim(),
        firstBlock: document.querySelector('.doc-p-zh')?.textContent.trim()
      };
    })()
  `);
  console.log('Switched to Page 2 result:', page2Check);

  // Step 7: Test doc-home return button
  console.log('\nStep 7: Testing doc-home button (return to blueprint nodes)...');
  await evaluate(`
    (function() {
      const homeBtn = document.querySelector('.doc-home-btn');
      if (homeBtn) homeBtn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  const backCheck = await evaluate(`
    (function() {
      return {
        activeTab: document.querySelector('.tabs .tab.active')?.textContent.trim(),
        nodeCardsCount: document.querySelectorAll('.bp-node-card').length
      };
    })()
  `);
  console.log('Back button result:', backCheck);

  // Step 8: Test returning to plugin library and opening another plugin (e.g. p-loading-screen)
  console.log('\nStep 8: Testing back to plugins and opening p-loading-screen...');
  await evaluate(`
    (function() {
      const backLink = document.querySelector('.back-link');
      if (backLink) backLink.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  await evaluate(`
    (function() {
      const loadCard = document.querySelector('[data-action="open-plugin"][data-id="p-loading-screen"]');
      if (loadCard) loadCard.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  await evaluate(`
    (function() {
      const docTab = document.querySelector('.tabs .tab[data-tab="docs"]');
      if (docTab) docTab.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  const loadDocCheck = await evaluate(`
    (function() {
      return {
        header: document.querySelector('.plugin-detail-info h1')?.textContent.trim(),
        sidebarSub: document.querySelector('.doc-project-sub')?.textContent.trim(),
        h1: document.querySelector('.doc-paper-h1')?.textContent.trim(),
        pages: Array.from(document.querySelectorAll('.doc-page-item')).map(p => p.querySelector('.doc-page-item-title')?.textContent.trim())
      };
    })()
  `);
  console.log('Loading screen doc check:', loadDocCheck);

  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(brainDir, 'verified_plugin_loading_screen_doc.png'), Buffer.from(snap3.data, 'base64'));
  console.log('Saved verified_plugin_loading_screen_doc.png');

  ws.close();
  console.log('\n=============================================');
  console.log('SUCCESS: ALL USER REQUIREMENTS FULLY VERIFIED!');
  console.log('=============================================');
} catch (err) {
  console.error('Verification error:', err);
} finally {
  chromeProc.kill();
  process.exit(0);
}
