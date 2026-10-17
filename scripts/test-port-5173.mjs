import { spawn } from 'node:child_process';

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9558;

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
const consoleLogs = [];
const errors = [];

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.method === 'Runtime.consoleAPICalled') {
    const text = data.params.type + ': ' + data.params.args?.map(a => a.value || a.description).join(' ');
    consoleLogs.push(text);
    console.log('[BROWSER]', text);
  }
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

await new Promise(r => setTimeout(r, 1500));

const title = await evaluate('document.title');
console.log('Page title on 5173:', title);
const bodyHtmlLen = await evaluate('document.body.innerHTML.length');
console.log('Body HTML length:', bodyHtmlLen);
const rootText = await evaluate('document.getElementById("root")?.innerText?.slice(0, 300)');
console.log('Root text preview:', rootText);

console.log('Console logs count:', consoleLogs.length);
console.log('Errors count:', errors.length);

chromeProc.kill();
ws.close();
process.exit(0);
