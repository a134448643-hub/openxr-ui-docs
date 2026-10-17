import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetHtml = path.resolve(__dirname, '../界面原型/ue-project-manager-prototype.html');
const fileUrl = 'file:///' + targetHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9556;

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
const exceptions = [];
const consoleLogs = [];

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'Runtime.consoleAPICalled') {
    const msg = data.params.type + ': ' + data.params.args?.map(a => a.value || a.description).join(' ');
    consoleLogs.push(msg);
    console.log('[BROWSER LOG]', msg);
  }
  if (data.method === 'Runtime.exceptionThrown') {
    exceptions.push(data.params.exceptionDetails);
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
    exceptions.push(res.exceptionDetails);
    throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result?.value;
}

await new Promise(r => setTimeout(r, 500));

console.log('\n=== STEP 1: Test Theme Switching in Main Window ===');
await evaluate(`document.querySelector('[data-action="toggle-theme-picker"]').click()`);
console.log('Opened theme picker. Menu visible:', await evaluate('!!document.querySelector(".theme-menu")'));
await evaluate(`document.querySelector('[data-theme-id="light-clean"]').click()`);
console.log('Clicked light-clean. Dataset theme:', await evaluate('document.documentElement.dataset.theme'));
console.log('Is theme menu still in DOM:', await evaluate('!!document.querySelector(".theme-menu")'));

console.log('\n=== STEP 2: Navigate to Documents ===');
await evaluate(`document.querySelector('[data-nav="documents"]').click()`);
console.log('Navigated to documents. Title:', await evaluate('document.querySelector(".doc-paper-h1")?.textContent'));

console.log('\n=== STEP 3: Test Document Studio Interactions ===');
// Test subtab switching
console.log('Testing subtab development...');
await evaluate(`document.querySelector('[data-action="doc-subtab"][data-id="development"]').click()`);
console.log('Subtab development active:', await evaluate('document.querySelector("[data-action=\\"doc-subtab\\"][data-id=\\"development\\"]").classList.contains("active")'));

console.log('Testing subtab rules...');
await evaluate(`document.querySelector('[data-action="doc-subtab"][data-id="rules"]').click()`);
console.log('Subtab rules active:', await evaluate('document.querySelector("[data-action=\\"doc-subtab\\"][data-id=\\"rules\\"]").classList.contains("active")'));

console.log('Testing subtab docs...');
await evaluate(`document.querySelector('[data-action="doc-subtab"][data-id="docs"]').click()`);
console.log('Subtab docs active:', await evaluate('document.querySelector("[data-action=\\"doc-subtab\\"][data-id=\\"docs\\"]").classList.contains("active")'));

// Test page selection
console.log('Testing page selection...');
const pages = await evaluate(`Array.from(document.querySelectorAll('.doc-page-item')).map(el => el.textContent.trim().slice(0, 20))`);
console.log('Pages found:', pages);
await evaluate(`document.querySelectorAll('.doc-page-item')[1]?.click()`);
console.log('Selected page header:', await evaluate('document.querySelector(".doc-paper-h1")?.textContent'));

// Test language toggle
console.log('Testing language toggle EN...');
await evaluate(`document.querySelector('[data-action="doc-lang"][data-id="en"]').click()`);
console.log('EN button active:', await evaluate('document.querySelector("[data-action=\\"doc-lang\\"][data-id=\\"en\\"]").classList.contains("active")'));

console.log('Testing language toggle BILINGUAL...');
await evaluate(`document.querySelector('[data-action="doc-lang"][data-id="bilingual"]').click()`);
console.log('Bilingual button active:', await evaluate('document.querySelector("[data-action=\\"doc-lang\\"][data-id=\\"bilingual\\"]").classList.contains("active")'));

// Test mode toggle
console.log('Testing mode toggle EDIT...');
await evaluate(`document.querySelector('[data-action="doc-mode"][data-id="edit"]').click()`);
console.log('Edit mode button active:', await evaluate('document.querySelector("[data-action=\\"doc-mode\\"][data-id=\\"edit\\"]").classList.contains("active")'));

// Test floating toolbox toggle
console.log('Testing floating toolbox toggle...');
await evaluate(`document.querySelector('[data-action="doc-toggle-float"]').click()`);
console.log('Floating toolbox display:', await evaluate('document.querySelector(".doc-floating-toolbox")?.style.display'));

// Test doc theme picker
console.log('Testing doc studio theme picker...');
await evaluate(`document.querySelector('.doc-topbar-right [data-action="toggle-theme-picker"]').click()`);
console.log('Doc theme picker open:', await evaluate('!!document.querySelector(".theme-menu")'));
await evaluate(`document.querySelector('[data-theme-id="dark-unreal"]').click()`);
console.log('Theme switched to dark-unreal. Dataset theme:', await evaluate('document.documentElement.dataset.theme'));

// Test return home
console.log('Testing doc return home button...');
await evaluate(`document.querySelector('[data-action="doc-home"]').click()`);
console.log('Breadcrumb after doc-home:', await evaluate('document.getElementById("breadcrumb-current")?.textContent'));

console.log('\n=== EXCEPTIONS RECORDED ===');
console.log('Exception count:', exceptions.length);
if (exceptions.length > 0) {
  console.log(JSON.stringify(exceptions, null, 2));
}

chromeProc.kill();
ws.close();
process.exit(0);
