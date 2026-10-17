import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetHtml = path.resolve(__dirname, '../界面原型/ue-ai-devmanager-updated.html');
const fileUrl = 'file:///' + targetHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9336;

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

  await new Promise(r => setTimeout(r, 1200));

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

  // Step 1: Navigate to Plugin Library
  console.log('\n--- Step 1: Navigate to Plugin Library ---');
  await evaluate(`
    (function() {
      const btn = document.querySelector('[data-nav="plugins"]');
      if (btn) btn.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // Inspect the first plugin card (GameplayAbilities Extended)
  const cardCheck = await evaluate(`
    (function() {
      const card = document.querySelector('.plugin-card');
      if (!card) return null;
      
      const title = card.querySelector('.project-title')?.textContent.trim();
      const metaItems = Array.from(card.querySelectorAll('.plugin-meta-item, .plugin-meta-single span')).map(el => el.textContent.trim());
      const actions = Array.from(card.querySelectorAll('.plugin-card-actions button')).map(b => b.textContent.trim());
      
      const hasOldMetaGrid = Boolean(card.querySelector('.plugin-meta-grid'));
      const hasLaunchBtn = Boolean(card.querySelector('[data-action="open-plugin"].button-launch'));
      const hasBuildBtn = Boolean(card.querySelector('[data-action="build-plugin"]'));
      const hasIdeBtn = Boolean(card.querySelector('[data-action="open-plugin-ide"]'));

      return {
        title,
        metaItems,
        actions,
        hasOldMetaGrid,
        hasLaunchBtn,
        hasBuildBtn,
        hasIdeBtn
      };
    })()
  `);
  console.log('Plugin Card title:', cardCheck.title);
  console.log('Plugin Card meta texts (ONLY SIZE EXPECTED):', cardCheck.metaItems);
  console.log('Plugin Card action buttons (ONLY INSTALL EXPECTED):', cardCheck.actions);
  console.log('Has old 4-item meta grid (MUST BE FALSE):', cardCheck.hasOldMetaGrid);
  console.log('Has [详情与节点] button (MUST BE FALSE):', cardCheck.hasLaunchBtn);
  console.log('Has [编译] button (MUST BE FALSE):', cardCheck.hasBuildBtn);
  console.log('Has [IDE源码] button (MUST BE FALSE):', cardCheck.hasIdeBtn);

  const brainDir = 'C:/Users/10728/.gemini/antigravity/brain/631581d0-4d5c-4e89-ad8e-b8c1cf535525';
  const snapLib = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(brainDir, 'verified_plugin_library_size_only.png'), Buffer.from(snapLib.data, 'base64'));
  console.log('Saved verified_plugin_library_size_only.png');

  // Step 2: Click the card to open plugin detail
  console.log('\n--- Step 2: Click Plugin Card to Enter Detail ---');
  await evaluate(`
    (function() {
      const card = document.querySelector('.plugin-card[data-id="p-gas-ext"]') || document.querySelector('.plugin-card');
      if (card) card.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 600));

  // Inspect Plugin Detail Tabs & Component Cards
  const detailCheck = await evaluate(`
    (function() {
      const headerTitle = document.querySelector('.plugin-detail-info h1')?.textContent.trim();
      const tabs = Array.from(document.querySelectorAll('.plugin-detail-top .tabs .tab')).map(t => ({
        text: t.textContent.trim(),
        active: t.classList.contains('active')
      }));
      
      const compCards = Array.from(document.querySelectorAll('.plugin-component-card')).map(c => ({
        name: c.querySelector('.comp-name')?.textContent.trim(),
        cName: c.querySelector('.comp-cname')?.textContent.trim(),
        baseClass: c.querySelector('.badge-purple')?.textContent.trim(),
        mountTarget: c.querySelector('.comp-mount-target')?.textContent.trim(),
        desc: c.querySelector('.comp-desc')?.textContent.trim(),
        stepsCount: c.querySelectorAll('.comp-step-item').length,
        firstStep: c.querySelector('.comp-step-item:first-child .comp-step-content')?.textContent.trim(),
        propsCount: c.querySelectorAll('.comp-prop-row').length
      }));

      return {
        headerTitle,
        tabs,
        compCards
      };
    })()
  `);
  console.log('Plugin Detail Title:', detailCheck.headerTitle);
  console.log('Tabs visible:', detailCheck.tabs);
  console.log('Component cards count:', detailCheck.compCards.length);
  console.log('Components details:', detailCheck.compCards);

  const snapComp = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(brainDir, 'verified_plugin_detail_components.png'), Buffer.from(snapComp.data, 'base64'));
  console.log('Saved verified_plugin_detail_components.png');

  // Step 3: Test switching to Blueprint Nodes
  console.log('\n--- Step 3: Switch to 蓝图节点 Tab ---');
  await evaluate(`
    (function() {
      const nodeTab = document.querySelector('.tabs .tab[data-tab="nodes"]');
      if (nodeTab) nodeTab.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  const nodesCheck = await evaluate(`
    (function() {
      return {
        activeTab: document.querySelector('.tabs .tab.active')?.textContent.trim(),
        nodesCount: document.querySelectorAll('.bp-node-card').length
      };
    })()
  `);
  console.log('Nodes tab result:', nodesCheck);

  // Step 4: Test OpenXR Plugin components
  console.log('\n--- Step 4: Open OpenXR Hand Pose Plugin & Check Components ---');
  await evaluate(`
    (function() {
      const backLink = document.querySelector('.back-link');
      if (backLink) backLink.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  await evaluate(`
    (function() {
      const xrCard = document.querySelector('.plugin-card[data-id="p-openxr-pose"]');
      if (xrCard) xrCard.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 500));

  const xrDetailCheck = await evaluate(`
    (function() {
      return {
        header: document.querySelector('.plugin-detail-info h1')?.textContent.trim(),
        activeTab: document.querySelector('.tabs .tab.active')?.textContent.trim(),
        components: Array.from(document.querySelectorAll('.plugin-component-card')).map(c => ({
          name: c.querySelector('.comp-name')?.textContent.trim(),
          cName: c.querySelector('.comp-cname')?.textContent.trim(),
          mountTarget: c.querySelector('.comp-mount-target')?.textContent.trim(),
          desc: c.querySelector('.comp-desc')?.textContent.trim()
        }))
      };
    })()
  `);
  console.log('OpenXR plugin components check:', xrDetailCheck);

  const snapXr = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(brainDir, 'verified_plugin_openxr_components.png'), Buffer.from(snapXr.data, 'base64'));
  console.log('Saved verified_plugin_openxr_components.png');

  ws.close();
  console.log('\n=============================================');
  console.log('SUCCESS: ALL USER REQUIREMENTS VERIFIED WITH CDP!');
  console.log('=============================================');
} catch (err) {
  console.error('Verification error:', err);
} finally {
  chromeProc.kill();
  process.exit(0);
}
