import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetHtml = path.resolve(__dirname, '../界面原型/ue-ai-devmanager-updated.html');
const fileUrl = 'file:///' + targetHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9339;

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

    await new Promise(r => setTimeout(r, 800));

    const brandInfo = await evaluate(`(() => {
      const brand = document.querySelector('.brand');
      const logo = document.querySelector('.brand-mark');
      const logoImg = document.querySelector('.brand-logo-img');
      const title = document.querySelector('.brand-title');
      const version = document.querySelector('.app-version-label');
      const bRect = brand.getBoundingClientRect();
      const lRect = logo.getBoundingClientRect();
      const tRect = title.getBoundingClientRect();
      const bStyle = window.getComputedStyle(brand);
      return {
        brandText: title?.textContent,
        versionText: version?.textContent,
        flexDirection: bStyle.flexDirection,
        outerBorderWidth: bStyle.borderWidth,
        outerBg: bStyle.backgroundColor,
        logoLeft: lRect.left,
        logoRight: lRect.right,
        logoWidth: lRect.width,
        logoHeight: lRect.height,
        titleLeft: tRect.left,
        titleWidth: tRect.width,
        isHorizontal: lRect.right <= tRect.left && bStyle.flexDirection === 'row'
      };
    })()`);

    console.log('Brand Info:', JSON.stringify(brandInfo, null, 2));

    if (brandInfo.brandText !== '晓梦个人开发平台') {
      throw new Error('Brand text mismatch: ' + brandInfo.brandText);
    }
    if (brandInfo.flexDirection !== 'row') {
      throw new Error('Brand is not row layout: ' + brandInfo.flexDirection);
    }
    if (!brandInfo.isHorizontal) {
      throw new Error('Logo and text are not horizontally aligned: logoRight=' + brandInfo.logoRight + ', titleLeft=' + brandInfo.titleLeft);
    }
    if (brandInfo.logoWidth < 65 || brandInfo.logoHeight < 38) {
      throw new Error('Logo mark is not enlarged: ' + brandInfo.logoWidth + 'x' + brandInfo.logoHeight);
    }
    if (brandInfo.outerBorderWidth !== '0px') {
      throw new Error('Outer brand container still has border: ' + brandInfo.outerBorderWidth);
    }

    console.log('✓ All brand checks passed! Returned to horizontal layout, logo is enlarged (70x40), no outer border.');
    ws.close();
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    chromeProc.kill();
  }
}

run();
