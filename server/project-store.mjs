import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(SERVER_DIR, '..');
export const LOCAL_ROOT = path.join(APP_ROOT, '.local');
const REGISTRY_PATH = path.join(LOCAL_ROOT, 'projects.yaml');

const DEFAULT_PROJECT = {
  id: 'openxr-ui',
  name: 'OpenXR UI',
  docsPath: 'docs-project',
  privatePath: '.local/projects/openxr-ui/development',
};

function slugify(value, fallback = 'project') {
  const slug = String(value || '')
    .normalize('NFKD')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || fallback;
}

function assertProjectId(value) {
  const id = slugify(value);
  if (id !== value || !/^[\p{Letter}\p{Number}][\p{Letter}\p{Number}-]*$/u.test(id)) {
    throw new Error('项目标识只能包含字母、数字和连字符。');
  }
  return id;
}

function resolveInsideApp(relativePath) {
  const resolved = path.resolve(APP_ROOT, relativePath);
  const relative = path.relative(APP_ROOT, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe project path: ${relativePath}`);
  }
  return resolved;
}

async function writeAtomic(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, contents, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

async function readRegistry() {
  try {
    const parsed = YAML.parse(await fs.readFile(REGISTRY_PATH, 'utf8')) || {};
    const projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    if (!projects.some((project) => project.id === DEFAULT_PROJECT.id)) {
      projects.unshift(DEFAULT_PROJECT);
    }
    return {
      version: 1,
      activeProjectId: projects.some((project) => project.id === parsed.activeProjectId)
        ? parsed.activeProjectId
        : DEFAULT_PROJECT.id,
      projects,
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const initial = { version: 1, activeProjectId: DEFAULT_PROJECT.id, projects: [DEFAULT_PROJECT] };
    await writeAtomic(REGISTRY_PATH, YAML.stringify(initial));
    return initial;
  }
}

async function writeRegistry(registry) {
  await writeAtomic(REGISTRY_PATH, YAML.stringify(registry));
}

async function readManifestSummary(project) {
  try {
    const manifestPath = path.join(resolveInsideApp(project.docsPath), 'document.yaml');
    const manifest = YAML.parse(await fs.readFile(manifestPath, 'utf8')) || {};
    return {
      docTitle: manifest.docTitle || project.name,
      pageCount: Array.isArray(manifest.pages) ? manifest.pages.length : 0,
      publication: manifest.publication || {},
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { docTitle: project.name, pageCount: 0, publication: {} };
    throw error;
  }
}

export async function listProjects() {
  const registry = await readRegistry();
  const projects = await Promise.all(registry.projects.map(async (project) => ({
    ...project,
    ...(await readManifestSummary(project)),
    isActive: project.id === registry.activeProjectId,
  })));
  return { activeProjectId: registry.activeProjectId, projects };
}

export async function getProject(projectId) {
  const registry = await readRegistry();
  const id = projectId || registry.activeProjectId;
  const project = registry.projects.find((entry) => entry.id === id);
  if (!project) throw new Error(`未找到项目：${id}`);
  return project;
}

export async function getActiveProject() {
  return getProject();
}

export async function getProjectDocsRoot(projectId) {
  const project = await getProject(projectId);
  return resolveInsideApp(project.docsPath);
}

export async function openProject(projectId) {
  const registry = await readRegistry();
  const id = assertProjectId(projectId);
  if (!registry.projects.some((project) => project.id === id)) {
    throw new Error(`未找到项目：${id}`);
  }
  registry.activeProjectId = id;
  await writeRegistry(registry);
  return listProjects();
}

function blankManifest(name) {
  const pageId = `p${Date.now()}`;
  return {
    manifest: {
      schemaVersion: 1,
      sidebarTitle: name,
      docTitle: `${name} Documentation`,
      pages: [{
        id: pageId,
        file: 'manual/01-overview.md',
        layout: `layouts/${pageId}.yaml`,
        title: { zh: '概述', en: 'Overview' },
      }],
      publication: { provider: 'github-pages', account: 'a134448643-hub', repository: '', siteUrl: '' },
    },
    pageId,
  };
}

export async function createProject({ name, id: requestedId }) {
  const projectName = String(name || '').trim();
  if (!projectName) throw new Error('请输入项目名称。');
  const id = assertProjectId(slugify(requestedId || projectName));
  const registry = await readRegistry();
  if (registry.projects.some((project) => project.id === id)) {
    throw new Error(`项目标识已存在：${id}`);
  }

  const project = {
    id,
    name: projectName,
    docsPath: `.local/projects/${id}/public`,
    privatePath: `.local/projects/${id}/development`,
  };
  const docsRoot = resolveInsideApp(project.docsPath);
  const privateRoot = resolveInsideApp(project.privatePath);
  const { manifest, pageId } = blankManifest(projectName);
  await Promise.all([
    fs.mkdir(path.join(docsRoot, 'manual'), { recursive: true }),
    fs.mkdir(path.join(docsRoot, 'layouts'), { recursive: true }),
    fs.mkdir(path.join(docsRoot, 'assets'), { recursive: true }),
    fs.mkdir(privateRoot, { recursive: true }),
  ]);
  await writeAtomic(path.join(docsRoot, 'document.yaml'), YAML.stringify(manifest));
  await writeAtomic(path.join(docsRoot, 'manual', '01-overview.md'), `---\nid: ${pageId}\ntitle:\n  zh: 概述\n  en: Overview\n---\n\n<!-- DOCBLOCK id="b1" type="text" -->\n<!-- ZH -->\n在这里介绍插件的用途和功能。\n<!-- EN -->\nDescribe the plugin and its purpose here.\n<!-- /DOCBLOCK -->\n`);
  await writeAtomic(path.join(docsRoot, 'layouts', `${pageId}.yaml`), YAML.stringify({
    version: 1,
    blockOrder: ['b1'],
    blocks: { b1: { type: 'text', isFloating: false, style: {}, attachments: [] } },
  }));
  await writeAtomic(path.join(privateRoot, 'development.md'), developmentTemplate(projectName, id));

  registry.projects.push(project);
  registry.activeProjectId = id;
  await writeRegistry(registry);
  return listProjects();
}

function developmentTemplate(name, id) {
  return `# ${name} 开发记录\n\n> 本文件只保存在本机，不参与 Git 提交和 GitHub Pages 发布。\n\n## 当前状态\n\n- 项目标识：\`${id}\`\n- 当前阶段：规划\n- 下一步：\n\n## 开发进度\n\n\n## 异常现象\n\n### 现象\n\n### 原因\n\n### 最近解决方法\n\n\n## 项目存储规则\n\n- 公开使用文档：项目的 public 目录\n- 私有开发记录：本文件所在 development 目录\n- AI 可以直接读取和编辑本文件\n\n## AI 交接说明\n\n`;
}

export async function readDevelopmentRecord(projectId) {
  const project = await getProject(projectId);
  const privateRoot = resolveInsideApp(project.privatePath);
  const recordPath = path.join(privateRoot, 'development.md');
  try {
    return { content: await fs.readFile(recordPath, 'utf8'), path: recordPath };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const content = developmentTemplate(project.name, project.id);
    await writeAtomic(recordPath, content);
    return { content, path: recordPath };
  }
}

export async function writeDevelopmentRecord(content, projectId) {
  const project = await getProject(projectId);
  const recordPath = path.join(resolveInsideApp(project.privatePath), 'development.md');
  await writeAtomic(recordPath, String(content ?? ''));
  return { content: String(content ?? ''), path: recordPath, savedAt: new Date().toISOString() };
}
