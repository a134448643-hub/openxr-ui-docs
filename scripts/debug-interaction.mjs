import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetHtml = path.resolve(__dirname, '../界面原型/ue-project-manager-prototype.html');
const fileUrl = 'file:///' + targetHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9555;

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
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'Runtime.consoleAPICalled') {
    console.log('[CONSOLE]', data.params.type, data.params.args?.map(a => a.value || a.description).join(' '));
  }
  if (data.method === 'Runtime.exceptionThrown') {
    console.error('[EXCEPTION]', JSON.stringify(data.params.exceptionDetails));
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
    console.error('Eval error detail:', res.exceptionDetails);
    throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result?.value;
}

await new Promise(r => setTimeout(r, 600));

console.log('--- Checking for modal backdrop / overlays ---');
const overlayCheck = await evaluate(`({
  modalBackdropHidden: document.getElementById('modal-backdrop')?.hidden,
  modalBackdropDisplay: getComputedStyle(document.getElementById('modal-backdrop')).display,
  bodyOverflow: document.body.style.overflow,
  activeElement: document.activeElement?.tagName,
  mainChildCount: document.getElementById('main-content')?.childElementCount,
  pointerEventsBody: getComputedStyle(document.body).pointerEvents,
  pointerEventsApp: getComputedStyle(document.querySelector('.app')).pointerEvents,
  pointerEventsMain: getComputedStyle(document.getElementById('main-content')).pointerEvents
})`);
console.log('Overlay check:', overlayCheck);

console.log('\n--- Testing button clicks ---');
// 1. Try clicking a project title
const beforeProject = await evaluate('document.getElementById("breadcrumb-current").textContent');
console.log('Breadcrumb before clicking project:', beforeProject);

const clickProjectResult = await evaluate(`(() => {
  const btn = document.querySelector('.project-title');
  if (!btn) return 'no project title button';
  btn.click();
  return 'clicked ' + btn.textContent;
})()`);
console.log('Project click result:', clickProjectResult);

await new Promise(r => setTimeout(r, 300));
const afterProject = await evaluate('document.getElementById("breadcrumb-current").textContent');
console.log('Breadcrumb after clicking project:', afterProject);

// 2. Try clicking back-projects
const backResult = await evaluate(`(() => {
  const back = document.querySelector('[data-action="back-projects"]');
  if (!back) return 'no back button';
  back.click();
  return 'clicked back';
})()`);
console.log('Back click result:', backResult);

await new Promise(r => setTimeout(r, 300));
const afterBack = await evaluate('document.getElementById("breadcrumb-current").textContent');
console.log('Breadcrumb after back:', afterBack);

// 3. Try clicking theme picker
console.log('\n--- Testing Theme Picker click ---');
const themePickerBefore = await evaluate('!!document.querySelector(".theme-menu")');
console.log('Theme menu before click:', themePickerBefore);

const themeClickRes = await evaluate(`(() => {
  const btn = document.querySelector('[data-action="toggle-theme-picker"]');
  if (!btn) return 'no theme picker btn';
  btn.click();
  return 'clicked theme picker';
})()`);
console.log('Theme picker click result:', themeClickRes);

const themePickerAfter = await evaluate('!!document.querySelector(".theme-menu")');
console.log('Theme menu after click:', themePickerAfter);

// What happens if user clicks anywhere else to close?
const clickOutsideRes = await evaluate(`(() => {
  document.body.click();
  return 'clicked body';
})()`);
console.log('Body click result:', clickOutsideRes);

const themePickerAfterOutside = await evaluate('!!document.querySelector(".theme-menu")');
console.log('Theme menu after body click:', themePickerAfterOutside);

chromeProc.kill();
ws.close();
process.exit(0);
