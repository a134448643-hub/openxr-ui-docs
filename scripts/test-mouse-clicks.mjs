import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetHtml = path.resolve(__dirname, '../界面原型/ue-project-manager-prototype.html');
const fileUrl = 'file:///' + targetHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9557;

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
    console.log('[BROWSER LOG]', data.params.type, data.params.args?.map(a => a.value || a.description).join(' '));
  }
  if (data.method === 'Runtime.exceptionThrown') {
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
    throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result?.value;
}

async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

await new Promise(r => setTimeout(r, 500));

// Find coordinates of theme button
const themeBtnRect = await evaluate(`(() => {
  const btn = document.querySelector('.theme-picker-btn');
  const r = btn.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
})()`);
console.log('Theme button rect:', themeBtnRect);

console.log('Dispatching mouse click on theme button...');
await clickAt(themeBtnRect.x, themeBtnRect.y);
await new Promise(r => setTimeout(r, 200));

const isMenuOpen = await evaluate('!!document.querySelector(".theme-menu")');
console.log('Theme menu open after mouse click:', isMenuOpen);

if (isMenuOpen) {
  const menuItemRect = await evaluate(`(() => {
    const item = document.querySelector('[data-theme-id="light-clean"]');
    const r = item.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
  })()`);
  console.log('Light-clean menu item rect:', menuItemRect);
  
  console.log('Dispatching mouse click on light-clean item...');
  await clickAt(menuItemRect.x, menuItemRect.y);
  await new Promise(r => setTimeout(r, 200));
  
  console.log('Theme after clicking light-clean item:', await evaluate('document.documentElement.dataset.theme'));
  console.log('Is menu visible (not hidden):', await evaluate('!document.querySelector(".theme-menu")?.hidden'));
}

// Now test clicking a project card
const cardRect = await evaluate(`(() => {
  const c = document.querySelector('.project-card .project-title');
  const r = c.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
})()`);
console.log('Project card rect:', cardRect);

console.log('Dispatching mouse click on project card...');
await clickAt(cardRect.x, cardRect.y);
await new Promise(r => setTimeout(r, 300));
console.log('Breadcrumb after clicking project:', await evaluate('document.getElementById("breadcrumb-current").textContent'));

chromeProc.kill();
ws.close();
process.exit(0);
