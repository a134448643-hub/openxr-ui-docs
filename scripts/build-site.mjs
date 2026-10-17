import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { APP_ROOT, getDocumentRoot, loadDocument } from '../server/project-document-store.mjs';

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
      if (block.type === 'image') for (const field of ['src', 'srcEn']) if (block.data?.[field]?.startsWith('/docs-assets/')) block.data[field] = `./docs-assets/${block.data[field].slice('/docs-assets/'.length).split('?')[0]}`;
      for (const attachment of block.attachments || []) {
        if (attachment.type === 'image') for (const field of ['src', 'srcEn']) if (attachment.data?.[field]?.startsWith('/docs-assets/')) attachment.data[field] = `./docs-assets/${attachment.data[field].slice('/docs-assets/'.length).split('?')[0]}`;
      }
    }
  }
  return published;
}

const projectId = process.env.DOC_STUDIO_PROJECT_ID || undefined;
const document = await loadDocument(projectId);
if (!document) throw new Error('Document project is not initialized.');
const docsRoot = await getDocumentRoot(projectId);
await runViteBuild();
await fs.writeFile(
  path.join(SITE_DIR, 'document-data.json'),
  JSON.stringify(assetsForPublishedSite(document)),
  'utf8',
);
await fs.cp(path.join(docsRoot, 'assets'), path.join(SITE_DIR, 'docs-assets'), { recursive: true });
console.log(`Static documentation site generated at ${SITE_DIR}`);
