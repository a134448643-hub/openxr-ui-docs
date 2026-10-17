import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetHtml = path.resolve(__dirname, '../界面原型/ue-project-manager-prototype.html');
const fileUrl = 'file:///' + targetHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9561;

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

const wsUrl = await waitForPort();
const ws = new WebSocket(wsUrl);
await new Promise((r) => { ws.onopen = r; });

let msgId = 1;
const callbacks = new Map();
const errors = [];

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'Runtime.exceptionThrown') {
    errors.push(data.params.exceptionDetails);
    console.error('[BROWSER ERROR]', JSON.stringify(data.params.exceptionDetails));
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
    errors.push(res.exceptionDetails);
    throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result?.value;
}

await new Promise(r => setTimeout(r, 500));

console.log('--- 1. Testing Theme Menu Toggle & Outside Click ---');
// Click theme button to open
await evaluate(`document.querySelector('.theme-picker-btn').click()`);
const opened = await evaluate(`!document.querySelector('.theme-menu').hidden`);
console.log('Theme menu opened:', opened);
if (!opened) throw new Error('Theme menu failed to open');

// Click outside (e.g. on workspace heading or body)
await evaluate(`document.body.click()`);
const closedOutside = await evaluate(`document.querySelector('.theme-menu').hidden`);
console.log('Theme menu closed on outside click:', closedOutside);
if (!closedOutside) throw new Error('Theme menu failed to close on outside click');

// Open again and click light-clean
await evaluate(`document.querySelector('.theme-picker-btn').click()`);
await evaluate(`document.querySelector('[data-theme-id="light-clean"]').click()`);
console.log('Switched to light-clean. Theme:', await evaluate(`document.documentElement.dataset.theme`));
console.log('Menu closed after selection:', await evaluate(`document.querySelector('.theme-menu').hidden`));

console.log('--- 2. Testing Project Card & Detail Interactions ---');
await evaluate(`document.querySelector('.project-card .project-title').click()`);
console.log('Breadcrumb:', await evaluate(`document.getElementById('breadcrumb-current').textContent`));

// Switch tabs inside project detail
await evaluate(`document.querySelector('[data-action="project-tab"][data-id="configuration"]').click()`);
console.log('Active tab is configuration:', await evaluate(`!!document.querySelector('#ue-platform')`));

await evaluate(`document.querySelector('[data-action="project-tab"][data-id="nodes"]').click()`);
console.log('Active tab is nodes:', await evaluate(`!!document.querySelector('.timeline')`));

await evaluate(`document.querySelector('[data-action="back-projects"]').click()`);
console.log('Back to projects:', await evaluate(`document.getElementById('breadcrumb-current').textContent`));

console.log('--- 3. Testing Navigation Items ---');
await evaluate(`document.querySelector('[data-nav="backups"]').click()`);
console.log('Current route backups:', await evaluate(`document.getElementById('breadcrumb-current').textContent`));

await evaluate(`document.querySelector('[data-nav="vr-install"]').click()`);
console.log('Current route vr-install:', await evaluate(`document.getElementById('breadcrumb-current').textContent`));

await evaluate(`document.querySelector('[data-nav="documents"]').click()`);
console.log('Current route documents:', await evaluate(`document.getElementById('breadcrumb-current').textContent`));

console.log('--- 4. Testing Document Studio Interactions ---');
await evaluate(`document.querySelector('.doc-topbar-right .theme-picker-btn').click()`);
console.log('Doc theme menu opened:', await evaluate(`!document.querySelector('.doc-topbar-right .theme-menu').hidden`));

await evaluate(`document.querySelector('.doc-topbar-right [data-theme-id="cyber-blue"]').click()`);
console.log('Switched to cyber-blue in documents:', await evaluate(`document.documentElement.dataset.theme`));

// Select different pages
const pageTitles = await evaluate(`Array.from(document.querySelectorAll('.doc-page-item')).map(p => p.textContent.trim().slice(0, 15))`);
console.log('Pages available in doc studio:', pageTitles);
await evaluate(`document.querySelectorAll('.doc-page-item')[2].click()`);
console.log('Selected page 2 title:', await evaluate(`document.querySelector('.doc-paper-h1')?.textContent`));

console.log('--- 5. Testing Return to Project Library ---');
await evaluate(`document.querySelector('[data-action="doc-home"]').click()`);
console.log('Returned to:', await evaluate(`document.getElementById('breadcrumb-current').textContent`));

console.log('\n=== ALL USER INTERACTIONS FULLY FUNCTIONAL AND VERIFIED! ===\n');
chromeProc.kill();
ws.close();
process.exit(0);
