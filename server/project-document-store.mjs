import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { APP_ROOT, getProjectDocsRoot } from './project-store.mjs';
import { normalizeTypography } from './document-typography.mjs';

export { APP_ROOT };

const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

async function projectPaths(projectId) {
  const docsRoot = await getProjectDocsRoot(projectId);
  return {
    docsRoot,
    manifestPath: path.join(docsRoot, 'document.yaml'),
    manualDir: path.join(docsRoot, 'manual'),
    layoutDir: path.join(docsRoot, 'layouts'),
    assetDir: path.join(docsRoot, 'assets'),
  };
}

async function ensureProjectDirectories(paths) {
  await Promise.all([
    fs.mkdir(paths.manualDir, { recursive: true }),
    fs.mkdir(paths.layoutDir, { recursive: true }),
    fs.mkdir(paths.assetDir, { recursive: true }),
  ]);
}

async function readYaml(filePath, fallback = null) {
  try {
    return YAML.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function writeAtomic(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, contents, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

function safeRelativePath(relativePath) {
  const normalized = path.posix.normalize(String(relativePath).replaceAll('\\', '/'));
  if (normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(normalized)) {
    throw new Error(`Unsafe document path: ${relativePath}`);
  }
  return normalized;
}

function slugify(value, fallback) {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || fallback;
}

function quoteMarkerValue(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function unquoteMarkerValue(value) {
  return String(value).replaceAll('&quot;', '"').replaceAll('&amp;', '&');
}

function normalizeText(value) {
  return String(value ?? '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
}

async function storeDataUrl(dataUrl, assetDir) {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(dataUrl);
  if (!match) return dataUrl;
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  const extension = MIME_EXTENSIONS[mimeType] || 'bin';
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 20);
  const fileName = `${hash}.${extension}`;
  const assetPath = path.join(assetDir, fileName);
  try {
    await fs.access(assetPath);
  } catch {
    await fs.writeFile(assetPath, buffer);
  }
  return `assets/${fileName}`;
}

function assetReferenceForStorage(source) {
  if (!source) return '';
  if (source.startsWith('/docs-assets/')) {
    return `assets/${decodeURIComponent(source.slice('/docs-assets/'.length).split('?')[0])}`;
  }
  return source;
}

function assetReferenceForApp(source, projectId) {
  if (!source) return '';
  if (source.startsWith('assets/')) {
    return `/docs-assets/${encodeURIComponent(source.slice('assets/'.length))}${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`;
  }
  return source;
}

async function normalizeDocumentAssets(document, assetDir) {
  const normalized = structuredClone(document);
  for (const page of normalized.pages || []) {
    const blocks = normalized.content?.[page.id]?.blocks || [];
    for (const block of blocks) {
      if (block.type === 'image') for (const field of ['src', 'srcEn']) if (block.data?.[field]) {
        block.data[field] = block.data[field].startsWith('data:')
          ? await storeDataUrl(block.data[field], assetDir)
          : assetReferenceForStorage(block.data[field]);
      }
      for (const attachment of block.attachments || []) {
        if (attachment.type === 'image') for (const field of ['src', 'srcEn']) if (attachment.data?.[field]) {
          attachment.data[field] = attachment.data[field].startsWith('data:')
            ? await storeDataUrl(attachment.data[field], assetDir)
            : assetReferenceForStorage(attachment.data[field]);
        }
      }
    }
  }
  return normalized;
}

function documentAssetsForApp(document, projectId) {
  const normalized = structuredClone(document);
  for (const page of normalized.pages || []) {
    const blocks = normalized.content?.[page.id]?.blocks || [];
    for (const block of blocks) {
      if (block.type === 'image') for (const field of ['src', 'srcEn']) if (block.data?.[field]) block.data[field] = assetReferenceForApp(block.data[field], projectId);
      for (const attachment of block.attachments || []) {
        if (attachment.type === 'image') for (const field of ['src', 'srcEn']) if (attachment.data?.[field]) attachment.data[field] = assetReferenceForApp(attachment.data[field], projectId);
      }
    }
  }
  return normalized;
}

function serializePageMarkdown(page, blocks) {
  const frontmatter = YAML.stringify({
    id: page.id,
    title: { zh: page.title?.zh || '', en: page.title?.en || '' },
  }).trimEnd();

  const body = blocks.map((block) => {
    const marker = `<!-- DOCBLOCK id="${quoteMarkerValue(block.id)}" type="${quoteMarkerValue(block.type)}" -->`;
    if (block.type === 'image') {
      const source = block.data?.src || '';
      const markdownSource = source.startsWith('assets/') ? `../${source}` : source;
      return `${marker}\n![${block.id}](${markdownSource})\n<!-- /DOCBLOCK -->`;
    }
    return `${marker}\n<!-- ZH -->\n${normalizeText(block.data?.zh)}\n<!-- EN -->\n${normalizeText(block.data?.en)}\n<!-- /DOCBLOCK -->`;
  }).join('\n\n');

  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

function serializeLayout(blocks) {
  const layout = { version: 1, blockOrder: blocks.map((block) => block.id), blocks: {} };
  for (const block of blocks) {
    layout.blocks[block.id] = {
      type: block.type,
      isFloating: Boolean(block.isFloating),
      style: block.style || {},
      ...(block.layout ? { layout: block.layout } : {}),
      ...(Array.isArray(block.annotations) ? { annotations: block.annotations } : {}),
      ...(block.type === 'image' && ['srcEn', 'shareWithEnglish', 'enAnnotations'].some(key => key in (block.data || {}))
        ? { imageTranslation: Object.fromEntries(['srcEn', 'shareWithEnglish', 'enAnnotations'].filter(key => key in block.data).map(key => [key, block.data[key]])) } : {}),
      attachments: block.attachments || [],
    };
  }
  return YAML.stringify(layout);
}

function parsePageMarkdown(markdown) {
  markdown = String(markdown || '').replaceAll('\r\n', '\n');
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n?/.exec(markdown);
  const metadata = frontmatterMatch ? YAML.parse(frontmatterMatch[1]) : {};
  const body = frontmatterMatch ? markdown.slice(frontmatterMatch[0].length) : markdown;
  const blocks = new Map();
  const pattern = /<!-- DOCBLOCK id="([^"]+)" type="([^"]+)" -->\n([\s\S]*?)\n<!-- \/DOCBLOCK -->/g;
  for (const match of body.matchAll(pattern)) {
    const id = unquoteMarkerValue(match[1]);
    const type = unquoteMarkerValue(match[2]);
    const inner = match[3];
    if (type === 'image') {
      const imageMatch = /!\[[^\]]*\]\(([^)]+)\)/.exec(inner);
      let source = imageMatch?.[1] || '';
      if (source.startsWith('../assets/')) source = source.slice(3);
      blocks.set(id, { id, type, data: { src: source } });
    } else {
      const textMatch = /<!-- ZH -->\n([\s\S]*?)\n<!-- EN -->\n([\s\S]*)/.exec(inner);
      blocks.set(id, {
        id,
        type,
        data: { zh: textMatch?.[1] || '', en: textMatch?.[2] || '' },
      });
    }
  }
  return { metadata, blocks };
}

const documentWrites = new Map();
export async function saveDocument(document, projectId) {
  const key = projectId || '__default__';
  const snapshot = structuredClone(document);
  const pending = (documentWrites.get(key) || Promise.resolve()).catch(() => {}).then(() => saveDocumentSnapshot(snapshot, projectId));
  documentWrites.set(key, pending);
  try { return await pending; }
  finally { if (documentWrites.get(key) === pending) documentWrites.delete(key); }
}

async function saveDocumentSnapshot(document, projectId) {
  const paths = await projectPaths(projectId);
  await ensureProjectDirectories(paths);
  const normalized = await normalizeDocumentAssets(document, paths.assetDir);
  const previousManifest = await readYaml(paths.manifestPath, { pages: [] });
  const previousPages = new Map((previousManifest?.pages || []).map((page) => [page.id, page]));
  const manifestPages = [];

  for (let index = 0; index < normalized.pages.length; index += 1) {
    const page = normalized.pages[index];
    const previous = previousPages.get(page.id);
    const fileName = previous?.file
      ? path.posix.basename(previous.file)
      : `${String(index + 1).padStart(2, '0')}-${slugify(page.title?.en || page.title?.zh, page.id)}.md`;
    const pageReference = safeRelativePath(`manual/${fileName}`);
    const layoutReference = safeRelativePath(previous?.layout || `layouts/${page.id}.yaml`);
    const blocks = normalized.content?.[page.id]?.blocks || [];

    await writeAtomic(path.join(paths.docsRoot, pageReference), serializePageMarkdown(page, blocks));
    await writeAtomic(path.join(paths.docsRoot, layoutReference), serializeLayout(blocks));
    manifestPages.push({
      id: page.id,
      file: pageReference,
      layout: layoutReference,
      title: { zh: page.title?.zh || '', en: page.title?.en || '' },
    });
  }

  const manifest = {
    schemaVersion: 1,
    sidebarTitle: normalized.sidebarTitle || '',
    docTitle: normalized.docTitle || '',
    ...(normalizeTypography(normalized.typography) ? { typography: normalizeTypography(normalized.typography) } : {}),
    pages: manifestPages,
    publication: previousManifest?.publication || {
      provider: 'github-pages', account: '', repository: '', siteUrl: '',
    },
  };
  await writeAtomic(paths.manifestPath, YAML.stringify(manifest));
  return documentAssetsForApp(normalized, projectId);
}

export async function loadDocument(projectId) {
  const paths = await projectPaths(projectId);
  const manifest = await readYaml(paths.manifestPath, null);
  if (!manifest) return null;
  const document = { sidebarTitle: manifest.sidebarTitle || '', docTitle: manifest.docTitle || '', pages: [], content: {} };
  if (normalizeTypography(manifest.typography)) document.typography = normalizeTypography(manifest.typography);

  for (const manifestPage of manifest.pages || []) {
    const markdownPath = path.join(paths.docsRoot, safeRelativePath(manifestPage.file));
    const layoutPath = path.join(paths.docsRoot, safeRelativePath(manifestPage.layout));
    const markdown = await fs.readFile(markdownPath, 'utf8');
    const parsed = parsePageMarkdown(markdown);
    const layout = await readYaml(layoutPath, { blockOrder: [], blocks: {} });
    const title = manifestPage.title || parsed.metadata?.title || { zh: '', en: '' };
    const page = { id: manifestPage.id, title };
    const blocks = [];

    for (const blockId of layout.blockOrder || []) {
      const contentBlock = parsed.blocks.get(blockId) || { id: blockId, type: layout.blocks?.[blockId]?.type || 'text', data: {} };
      const metadata = layout.blocks?.[blockId] || {};
      const attachments = structuredClone(metadata.attachments || []);
      for (const attachment of attachments) {
        if (attachment.type === 'image') for (const field of ['src', 'srcEn']) if (attachment.data?.[field]) attachment.data[field] = assetReferenceForApp(attachment.data[field], projectId);
      }
      blocks.push({
        id: blockId,
        type: contentBlock.type,
        isFloating: Boolean(metadata.isFloating),
        style: metadata.style || {},
        ...(metadata.layout ? { layout: metadata.layout } : {}),
        ...(Array.isArray(metadata.annotations) ? { annotations: metadata.annotations } : {}),
        data: contentBlock.type === 'image'
          ? { src: assetReferenceForApp(contentBlock.data?.src || '', projectId), ...(metadata.imageTranslation || {}), ...(metadata.imageTranslation?.srcEn ? { srcEn: assetReferenceForApp(metadata.imageTranslation.srcEn, projectId) } : {}) }
          : contentBlock.data,
        attachments,
      });
    }

    document.pages.push(page);
    document.content[page.id] = { blocks };
  }
  return document;
}

export async function migrateLegacyDocument(legacyPath) {
  const raw = await fs.readFile(legacyPath, 'utf8');
  const legacyDocument = JSON.parse(raw);
  const migrated = await saveDocument(legacyDocument);
  const paths = await projectPaths();
  return {
    document: migrated,
    pages: migrated.pages.length,
    assets: (await fs.readdir(paths.assetDir)).length,
    source: legacyPath,
  };
}

export async function resolveAssetPath(encodedFileName, projectId) {
  const fileName = decodeURIComponent(encodedFileName);
  if (fileName !== path.basename(fileName)) throw new Error('Invalid asset path');
  const paths = await projectPaths(projectId);
  return path.join(paths.assetDir, fileName);
}

export async function getPublicationConfig(projectId) {
  const paths = await projectPaths(projectId);
  const manifest = await readYaml(paths.manifestPath, {});
  return manifest?.publication || {};
}

export async function getDocumentRoot(projectId) {
  return getProjectDocsRoot(projectId);
}
