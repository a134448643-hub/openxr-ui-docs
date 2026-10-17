import { spawn } from 'node:child_process';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9560;

const chromeProc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--disable-extensions',
  '--no-sandbox',
  '--window-size=1440,900',
  'http://127.0.0.1:5173/'
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

await new Promise(r => setTimeout(r, 1500));

// Click open project
await evaluate(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('打开项目'));
  btn?.click();
})()`);

await new Promise(r => setTimeout(r, 800));

// Check pointer-events on the blocks now
const pointerEventsStatus = await evaluate(`(() => {
  const blocks = Array.from(document.querySelectorAll('.content-block, .group'));
  return blocks.map(b => ({
    tag: b.tagName,
    pointerEvents: getComputedStyle(b).pointerEvents,
    parentPointerEvents: getComputedStyle(b.parentElement).pointerEvents
  })).slice(0, 5);
})()`);
console.log('Blocks pointer-events on 5173:', pointerEventsStatus);

// Test clicking on a block in edit mode
const editModeBtn = await evaluate(`(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('编辑模式'));
  if (btn) { btn.click(); return 'clicked edit mode'; }
  return 'no edit mode btn';
})()`);
console.log('Edit mode toggle:', editModeBtn);
await new Promise(r => setTimeout(r, 500));

// Click on the first text block
const clickBlock = await evaluate(`(() => {
  const block = document.querySelector('.group');
  if (!block) return 'no block found';
  block.click();
  return 'clicked block';
})()`);
console.log('Click first block result:', clickBlock);

chromeProc.kill();
ws.close();
process.exit(0);
