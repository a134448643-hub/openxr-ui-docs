import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { APP_ROOT, DOCS_ROOT, loadDocument } from '../server/document-store.mjs';

const SITE_DIR = path.join(APP_ROOT, 'site-dist');

function runViteBuild() {
  return new Promise((resolve, reject) => {
    const viteEntry = path.join(APP_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn(process.execPath, [viteEntry, 'build', '--mode', 'published', '--outDir', 'site-dist'], {
      cwd: APP_ROOT,
      stdio: 'inherit',
      windowsHide: true,
      shell: false,
    });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Vite build exited with code ${code}.`)));
  });
}

function assetsForPublishedSite(document) {
  const published = structuredClone(document);
  for (const page of published.pages || []) {
    for (const block of published.content?.[page.id]?.blocks || []) {
      if (block.type === 'image' && block.data?.src?.startsWith('/docs-assets/')) {
        block.data.src = `./docs-assets/${block.data.src.slice('/docs-assets/'.length)}`;
      }
      for (const attachment of block.attachments || []) {
        if (attachment.type === 'image' && attachment.data?.src?.startsWith('/docs-assets/')) {
          attachment.data.src = `./docs-assets/${attachment.data.src.slice('/docs-assets/'.length)}`;
        }
      }
    }
  }
  return published;
}

const document = await loadDocument();
if (!document) throw new Error('Document project is not initialized.');
await runViteBuild();
await fs.writeFile(
  path.join(SITE_DIR, 'document-data.json'),
  JSON.stringify(assetsForPublishedSite(document)),
  'utf8',
);
await fs.cp(path.join(DOCS_ROOT, 'assets'), path.join(SITE_DIR, 'docs-assets'), { recursive: true });
console.log(`Static documentation site generated at ${SITE_DIR}`);
