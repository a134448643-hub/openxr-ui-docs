import fs from 'node:fs/promises';
import path from 'node:path';
import { loadDocument, resolveAssetPath, saveDocument } from './document-store.mjs';
import { getGitHubAuthStatus, startGitHubLogin } from './github-auth.mjs';
import { publishDocumentation } from './publisher.mjs';

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function readRequestBody(request, limit = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Request body is too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

export function localDocsPlugin() {
  return {
    name: 'local-docs-api',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestUrl = new URL(request.url, 'http://127.0.0.1');
        try {
          if (requestUrl.pathname === '/api/document' && request.method === 'GET') {
            const document = await loadDocument();
            if (!document) return sendJson(response, 404, { error: 'Document project is not initialized.' });
            return sendJson(response, 200, document);
          }

          if (requestUrl.pathname === '/api/document' && request.method === 'POST') {
            const body = await readRequestBody(request);
            const saved = await saveDocument(JSON.parse(body));
            return sendJson(response, 200, { document: saved, savedAt: new Date().toISOString() });
          }

          if (requestUrl.pathname === '/api/publish' && request.method === 'POST') {
            const result = await publishDocumentation({ push: true });
            return sendJson(response, 200, result);
          }

          if (requestUrl.pathname === '/api/github/status' && request.method === 'GET') {
            const status = await getGitHubAuthStatus();
            return sendJson(response, 200, status);
          }

          if (requestUrl.pathname === '/api/github/login' && request.method === 'POST') {
            const result = startGitHubLogin();
            return sendJson(response, 202, result);
          }

          if (requestUrl.pathname.startsWith('/docs-assets/') && request.method === 'GET') {
            const fileName = requestUrl.pathname.slice('/docs-assets/'.length);
            const assetPath = resolveAssetPath(fileName);
            const contents = await fs.readFile(assetPath);
            response.statusCode = 200;
            response.setHeader('Content-Type', CONTENT_TYPES[path.extname(assetPath).toLowerCase()] || 'application/octet-stream');
            response.setHeader('Cache-Control', 'no-cache');
            response.end(contents);
            return;
          }
        } catch (error) {
          return sendJson(response, 500, { error: error.message || String(error) });
        }
        next();
      });
    },
  };
}
