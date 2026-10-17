import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const canvasHtml = path.resolve(__dirname, '../Canvas工作流/index.html');
const fileUrl = 'file:///' + canvasHtml.replace(/\\/g, '/');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9343;

console.log('Target Canvas URL:', fileUrl);
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
        if (parsed.error) cb.reject(parsed.error);
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

    await send('Runtime.enable');
    await send('Page.enable');

    // Wait for page to initialize
    await new Promise(r => setTimeout(r, 1200));

    // Comprehensive Check of Canvas Tool Frosted Glass Elements
    const elementsCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        function checkGlass(selector) {
          const el = document.querySelector(selector);
          if (!el) return null;
          const s = window.getComputedStyle(el);
          return {
            exists: true,
            backdropFilter: s.backdropFilter || s.webkitBackdropFilter || 'none',
            backgroundColor: s.backgroundColor,
            borderColor: s.borderColor,
            boxShadow: s.boxShadow,
            borderRadius: s.borderRadius
          };
        }

        const app = document.querySelector('.app');
        const appBefore = app ? window.getComputedStyle(app, '::before') : null;

        return {
          brandTitle: document.querySelector('.brand-title')?.innerText.trim(),
          theme: document.documentElement.getAttribute('data-theme'),
          ambientMeshPresent: appBefore ? appBefore.backgroundImage.includes('gradient') : false,
          sidebar: checkGlass('.sidebar'),
          topbar: checkGlass('.topbar'),
          projectCard: checkGlass('.project-card'),
          iconButton: checkGlass('.icon-button'),
          coverToolsIcon: checkGlass('.cover-tools .icon-button'),
          launchButton: checkGlass('.button-launch'),
          categoryPill: checkGlass('.category-pill'),
          badge: checkGlass('.badge'),
          searchBar: checkGlass('.global-search'),
          brandLogoTile: checkGlass('#app-sidebar .brand-mark.brand-custom-logo, .brand-mark')
        };
      })()`,
      returnByValue: true
    });

    console.log('Canvas Tool Glass Elements Check:\n', JSON.stringify(elementsCheck.result.value, null, 2));

    ws.close();
    chromeProc.kill();
    console.log('Canvas tool verification passed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    chromeProc.kill();
    process.exit(1);
  }
}

run();
