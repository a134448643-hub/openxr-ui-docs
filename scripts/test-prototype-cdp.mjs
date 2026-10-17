import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetHtml = path.resolve(__dirname, '../界面原型/ue-project-manager-prototype.html');
const fileUrl = 'file:///' + targetHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9333;

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
    if (data.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', data.params.type, data.params.args?.map(a => a.value || a.description).join(' '));
    }
    if (data.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', JSON.stringify(data.params.exceptionDetails));
    }
    if (data.id && callbacks.has(data.id)) {
      const cb = callbacks.get(data.id);
      callbacks.delete(data.id);
      cb(data);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      callbacks.set(id, (res) => resolve(res.result));
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  // Check current page location
  const loc = await evaluate('window.location.href');
  console.log('Loaded location:', loc);

  // Wait a moment for any scripts
  await new Promise(r => setTimeout(r, 600));

  const docTheme = await evaluate('document.documentElement.dataset.theme');
  console.log('document.documentElement.dataset.theme:', docTheme);
  const docTitle = await evaluate('document.title');
  console.log('document.title:', docTitle);
  const mainHtml = await evaluate('document.getElementById("main-content")?.innerHTML?.length');
  console.log('main-content innerHTML length:', mainHtml);

  console.log('\n--- 1. Testing Theme Switching ---');
  await evaluate('document.querySelector("[data-action=\\"toggle-theme-picker\\"]").click()');
  const isMenuOpen = await evaluate('!!document.querySelector(".theme-menu")');
  console.log('Theme menu opened:', isMenuOpen);

  // Switch to light-clean
  await evaluate('document.querySelector("[data-theme-id=\\"light-clean\\"]").click()');
  const lightTheme = await evaluate('document.documentElement.dataset.theme');
  console.log('Current theme after light-clean click:', lightTheme);

  // Switch to dark-graphite
  await evaluate('document.querySelector("[data-action=\\"toggle-theme-picker\\"]").click()');
  await evaluate('document.querySelector("[data-theme-id=\\"dark-graphite\\"]").click()');
  const graphiteTheme = await evaluate('document.documentElement.dataset.theme');
  console.log('Current theme after dark-graphite click:', graphiteTheme);

  // Switch to cyber-blue
  await evaluate('document.querySelector("[data-action=\\"toggle-theme-picker\\"]").click()');
  await evaluate('document.querySelector("[data-theme-id=\\"cyber-blue\\"]").click()');
  const cyberTheme = await evaluate('document.documentElement.dataset.theme');
  console.log('Current theme after cyber-blue click:', cyberTheme);

  console.log('\n--- 2. Testing Documents Route & Jitter Check ---');
  await evaluate('document.querySelector("[data-nav=\\"documents\\"]").click()');
  await new Promise(r => setTimeout(r, 400));

  const layout = await evaluate(`({
    hasDocLayout: !!document.querySelector('.doc-studio-layout'),
    hasCanvas: !!document.querySelector('.doc-studio-canvas'),
    hasPaper: !!document.querySelector('.doc-paper'),
    scrollWidth: document.querySelector('.doc-studio-canvas')?.scrollWidth,
    clientWidth: document.querySelector('.doc-studio-canvas')?.clientWidth,
    mainPadding: getComputedStyle(document.getElementById('main-content')).padding
  })`);
  console.log('Documents Layout:', layout);

  // Measure bounding client rect stability across 25 samples
  const jitterCheck = await evaluate(`new Promise(resolve => {
    const tops = [];
    let i = 0;
    const t = setInterval(() => {
      const el = document.querySelector('.doc-paper-h1');
      if (el) tops.push(el.getBoundingClientRect().top);
      if (++i >= 25) {
        clearInterval(t);
        let maxD = 0;
        for (let j = 1; j < tops.length; j++) maxD = Math.max(maxD, Math.abs(tops[j] - tops[j-1]));
        resolve({ count: tops.length, maxD });
      }
    }, 40);
  })`);
  console.log('Jitter check (25 samples / 1s):', jitterCheck);

  console.log('\n--- 3. Testing Doc Studio Topbar Theme Picker ---');
  const docTopbarPicker = await evaluate('!!document.querySelector(".doc-topbar-right [data-action=\\"toggle-theme-picker\\"]")');
  console.log('Doc topbar theme picker present:', docTopbarPicker);

  // Switch to light-clean in doc studio
  await evaluate('document.querySelector(".doc-topbar-right [data-action=\\"toggle-theme-picker\\"]").click()');
  await evaluate('document.querySelector("[data-theme-id=\\"light-clean\\"]").click()');
  const docLightTheme = await evaluate('document.documentElement.dataset.theme');
  const docPaperBg = await evaluate('getComputedStyle(document.querySelector(".doc-paper")).backgroundColor');
  console.log('Doc studio theme:', docLightTheme, 'doc-paper bg:', docPaperBg);

  console.log('\n--- 4. Testing Project Manager Navigation & Clean UI ---');
  // Back to projects
  await evaluate('document.querySelector("[data-nav=\\"projects\\"]").click()');
  await new Promise(r => setTimeout(r, 200));

  // Check remote cloud icon without text
  const remoteTag = await evaluate(`({
    hasIcon: !!document.querySelector('.cover-remote-tag svg use[href="#i-cloud"]'),
    hasText: (document.querySelector('.cover-remote-tag')?.textContent || '').trim()
  })`);
  console.log('Remote tag status:', remoteTag);
  if (!remoteTag.hasIcon) throw new Error('Remote cloud icon missing');
  if (remoteTag.hasText.length > 0) throw new Error('Remote tag contains unexpected text: ' + remoteTag.hasText);

  // Check VR headset icon in sidebar toolbox
  const vrToolIcon = await evaluate('!!document.querySelector(".toolbox-tool-item svg use[href=\\"#i-headset\\"]")');
  console.log('VR headset icon in toolbox:', vrToolIcon);
  if (!vrToolIcon) throw new Error('VR headset icon missing in toolbox');

  // Open first project detail
  await evaluate('document.querySelector(".project-card .project-title").click()');
  await new Promise(r => setTimeout(r, 200));

  // Click UE configuration tab
  await evaluate('document.querySelector("[data-action=\\"project-tab\\"][data-id=\\"configuration\\"]").click()');
  await new Promise(r => setTimeout(r, 300));

  const platformOptions = await evaluate('Array.from(document.querySelectorAll("#ue-platform option")).map(o => o.text)');
  console.log('Platform order in UE config:', platformOptions);
  if (platformOptions[0] !== 'PC 桌面' || platformOptions[1] !== 'PCVR 串流' || platformOptions[2] !== '一体机 (Quest / PICO)') {
    throw new Error('Platform order does not match PC -> PCVR -> 一体机: ' + JSON.stringify(platformOptions));
  }
  console.log('✓ Platform order correctly confirmed as PC -> PCVR -> 一体机');

  console.log('\n=== ALL CDP VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  ws.close();
} catch (err) {
  console.error('\nVerification failed:', err);
  process.exitCode = 1;
} finally {
  chromeProc.kill('SIGKILL');
}
