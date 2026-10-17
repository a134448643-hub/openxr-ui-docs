import fs from 'node:fs/promises';
import path from 'node:path';
import { APP_ROOT, getProject } from './project-store.mjs';

const FIXED_DOCUMENTS = [
  {
    id: 'common:general-rules',
    group: 'common',
    scope: 'common',
    title: '通用开发规则',
    relativePath: 'general-rules.md',
    description: '跨项目复用，并由用户按需指定 AI 读取。',
    recommendedLines: 300,
    template: () => `# 通用开发规则\n\n> 本文件不会自动注入所有新对话。只有用户明确指定时，AI 才读取并遵守。\n\n## 事实与证据\n\n- 当前源码、用户最新确认和可复现证据高于历史记录。\n- 模型身份不代表结论权威；存在分歧时记录证据和未决项。\n\n## 修改边界\n\n- 修改前检查用户已有改动，不覆盖无关内容。\n- 分析、实施和验收是不同状态，不互相替代。\n\n## 记录纪律\n\n- 当前快照只写“现在是什么”，不得追加聊天流水。\n- 决策、异常和变更分别建立独立条目。\n- 一轮交接结束后归档旧交接，再生成新的当前交接。\n`,
  },
  {
    id: 'common:unreal-profile',
    group: 'common',
    scope: 'common',
    title: 'Unreal 插件开发规则',
    relativePath: 'profiles/unreal-plugin.md',
    description: 'UE 插件项目可选读取的通用规则配置。',
    recommendedLines: 300,
    template: () => `# Unreal 插件开发通用规则\n\n## 构建与验证\n\n- 明确区分 Editor 构建、非 Editor 构建、自动化测试和人工实机验收。\n- 自动化通过不能替代 Blueprint 视口、PIE 或 VR 实机现象。\n\n## 资产与源码\n\n- 不覆盖用户正在编辑的 Blueprint、关卡和资源。\n- 修改运行时代码前先确认问题是否属于编辑器可视化、资产配置或运行时状态机。\n\n## 交接要求\n\n- 记录引擎版本、目标、验证命令、结果和仍需人工确认的边界。\n`,
  },
  {
    id: 'project:ai-entry',
    group: 'project',
    scope: 'project',
    title: 'AI 对接入口',
    relativePath: 'AI入口.md',
    description: '自动生成的统一读取入口，不在这里保存完整技术内容。',
    recommendedLines: 160,
    readOnly: true,
  },
  {
    id: 'project:record-index',
    group: 'records',
    scope: 'project',
    title: '记录索引',
    relativePath: 'records/INDEX.md',
    description: '工具自动生成的决策、异常、变更和交接归档索引。',
    recommendedLines: 400,
    readOnly: true,
  },
  {
    id: 'project:rules',
    group: 'project',
    scope: 'project',
    title: '项目规则',
    relativePath: 'rules/project-rules.md',
    description: '只适用于当前项目的边界、存储规则和验证要求。',
    recommendedLines: 300,
    template: ({ name, id }) => `# ${name} 项目规则\n\n- 项目标识：\`${id}\`\n- 本文件只记录当前项目规则，不复制通用规则全文。\n\n## 项目边界\n\n\n## 文件与存储规则\n\n- 公开使用文档：项目 public 目录。\n- 私有项目资料：本文件所在目录。\n- 私有资料不参与 GitHub Pages 发布。\n\n## 验证要求\n\n\n## 禁止事项\n\n`,
  },
  {
    id: 'project:context',
    group: 'project',
    scope: 'project',
    title: '项目背景',
    relativePath: 'context/project-context.md',
    description: '长期稳定的项目身份、目标和核心结构。',
    recommendedLines: 300,
    template: ({ name, id }) => `# ${name} 项目背景\n\n## 项目身份\n\n- 项目标识：\`${id}\`\n\n## 项目目标\n\n\n## 核心结构\n\n\n## 公开文档入口\n\n`,
  },
  {
    id: 'project:current-state',
    group: 'current',
    scope: 'project',
    title: '当前状态',
    relativePath: 'current/current-state.md',
    description: '覆盖式维护的当前事实，不按日期无限追加。',
    recommendedLines: 220,
    template: ({ name }) => `# ${name} 当前状态\n\n> 这是当前快照。状态变化时直接更新对应内容，不在末尾追加聊天过程。\n\n## 当前阶段\n\n- 状态：规划\n- 最近更新：\n\n## 已实现\n\n\n## 正在进行\n\n\n## 已知限制\n\n\n## 验证基线\n\n\n## 下一步\n\n`,
  },
  {
    id: 'project:todo',
    group: 'current',
    scope: 'project',
    title: '待办事项',
    relativePath: 'current/todo.md',
    description: '只保留未完成、待验证和被阻塞事项。',
    recommendedLines: 200,
    template: ({ name }) => `# ${name} 待办事项\n\n## 立即执行\n\n- [ ] \n\n## 待人工验收\n\n- [ ] \n\n## 待确认\n\n- [ ] \n\n## 已阻塞\n\n`,
  },
  {
    id: 'project:handoff',
    group: 'current',
    scope: 'project',
    title: '当前交接',
    relativePath: 'current/handoff.md',
    description: '只保存本轮任务；结束后由工具归档并重置。',
    recommendedLines: 220,
    template: ({ name }) => handoffTemplate(name),
  },
];

const COLLECTIONS = {
  decisions: { title: '决策记录', directory: 'records/decisions', prefix: 'D', description: '一个已确认决定一个文件。' },
  issues: { title: '异常与解决', directory: 'records/issues', prefix: 'I', description: '一个异常一个文件，保留现象、原因、处理和验证。' },
  changes: { title: '变更记录', directory: 'records/changes', prefix: 'C', description: '一个阶段性变更一个文件。' },
};

function handoffTemplate(name) {
  return `# ${name} 当前交接\n\n> 只记录当前一轮。完成或切换主题后，在工具中点击“归档本轮交接”。\n\n## 本轮目标\n\n\n## 当前源码与事实\n\n\n## 已完成\n\n\n## 未决问题\n\n\n## 验证结果\n\n- 构建：未验证\n- 自动化：未验证\n- 人工验收：未验证\n\n## 下一位 AI 的动作\n\n1. \n\n## 禁止误判\n\n- 不得把历史测试结果当作当前结果。\n- 不得把模型结论当作用户确认或源码证据。\n`;
}

function entryTemplate(collectionId, title, timestamp) {
  if (collectionId === 'decisions') {
    return `# ${title}\n\n- 状态：当前有效\n- 日期：${timestamp}\n\n## 背景\n\n\n## 决定\n\n\n## 依据\n\n\n## 影响范围\n\n\n## 替代关系\n\n- 无\n`;
  }
  if (collectionId === 'issues') {
    return `# ${title}\n\n- 状态：待确认\n- 日期：${timestamp}\n\n## 异常现象\n\n\n## 复现条件\n\n\n## 证据\n\n\n## 已确认原因\n\n\n## 最近解决方法\n\n\n## 验证结果\n\n- 自动化：未验证\n- 人工验收：未验证\n`;
  }
  return `# ${title}\n\n- 状态：已实施，待验证\n- 日期：${timestamp}\n\n## 变更内容\n\n\n## 修改范围\n\n\n## 验证结果\n\n\n## 未完成边界\n\n`;
}

function slugify(value, fallback = 'record') {
  const slug = String(value || '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

function countLines(content) {
  return String(content || '').split(/\r?\n/).length;
}

function healthFor(content, recommendedLines) {
  const lines = countLines(content);
  const ratio = recommendedLines ? lines / recommendedLines : 0;
  return {
    lines,
    bytes: Buffer.byteLength(String(content || ''), 'utf8'),
    recommendedLines: recommendedLines || null,
    status: ratio > 1 ? 'over' : ratio >= 0.8 ? 'warning' : 'good',
  };
}

async function writeAtomic(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, contents, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

async function readOrCreate(filePath, createContent) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const content = createContent();
    await writeAtomic(filePath, content);
    return content;
  }
}

async function pathsForProject(projectId) {
  const project = await getProject(projectId);
  const projectRoot = path.resolve(APP_ROOT, project.privatePath);
  const commonRoot = path.resolve(APP_ROOT, '.local/common');
  return { project, projectRoot, commonRoot };
}

function resolveDocumentPath(paths, definition) {
  const root = definition.scope === 'common' ? paths.commonRoot : paths.projectRoot;
  return path.join(root, definition.relativePath);
}

function assertInside(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe knowledge record path.');
  return target;
}

async function ensureLegacyArchive(paths) {
  const legacyPath = path.join(paths.projectRoot, 'development.md');
  const archivePath = path.join(paths.projectRoot, 'archive/legacy/development-before-structured-records.md');
  try {
    const legacy = await fs.readFile(legacyPath, 'utf8');
    try {
      await fs.access(archivePath);
    } catch {
      await writeAtomic(archivePath, legacy);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function listMarkdown(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md')).map((entry) => entry.name).sort().reverse();
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function firstHeading(content, fallback) {
  return String(content).match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

async function buildAiEntry(paths, collectionCounts) {
  const fixed = Object.fromEntries(FIXED_DOCUMENTS.map((definition) => [definition.id, resolveDocumentPath(paths, definition)]));
  const content = `# ${paths.project.name} AI 对接入口

> 本文件由文档工具自动生成。它不会要求所有新对话自动读取；只有用户明确指定时才作为对接入口。

## 建议读取顺序

1. 通用规则（仅当用户本次指定）：\`${fixed['common:general-rules']}\`
2. 项目规则：\`${fixed['project:rules']}\`
3. 项目背景：\`${fixed['project:context']}\`
4. 当前状态：\`${fixed['project:current-state']}\`
5. 待办事项：\`${fixed['project:todo']}\`
6. 当前交接：\`${fixed['project:handoff']}\`
7. 记录索引：\`${fixed['project:record-index']}\`，再按当前任务读取相关独立记录。

## 信息优先级

1. 用户在当前对话中的最新确认和当前源码/资产事实。
2. 当前状态、当前交接及本轮验证证据。
3. 仍然有效的项目决策。
4. 历史归档。

模型名称不构成权威等级。Codex、DeepSeek、Antigravity 的结论都必须由源码、测试、日志或用户复测支撑。

## 写入协议

- 当前状态：覆盖式更新，只写现在，不追加聊天流水。
- 当前交接：只写本轮；换主题或完成后归档。
- 决策：在 \`${path.join(paths.projectRoot, COLLECTIONS.decisions.directory)}\` 新建独立文件。
- 异常：在 \`${path.join(paths.projectRoot, COLLECTIONS.issues.directory)}\` 新建独立文件。
- 变更：在 \`${path.join(paths.projectRoot, COLLECTIONS.changes.directory)}\` 新建独立文件。
- \`records/INDEX.md\` 由工具生成，不手工修改。
- 历史结论不能自动继承为当前有效状态。

## 当前记录数量

- 决策：${collectionCounts.decisions || 0}
- 异常：${collectionCounts.issues || 0}
- 变更：${collectionCounts.changes || 0}
- 已归档交接：${collectionCounts.handoffs || 0}
`;
  await writeAtomic(fixed['project:ai-entry'], content);
  return content;
}

async function buildRecordIndex(paths, collectionItems, archiveItems) {
  const escapeCell = (value) => String(value || '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  const rows = [];
  for (const [collectionId, config] of Object.entries(COLLECTIONS)) {
    rows.push(`## ${config.title}`, '');
    const items = collectionItems[collectionId] || [];
    if (items.length === 0) rows.push('- 暂无记录');
    else {
      rows.push('| 标题 | 更新时间 | 文件 |', '|---|---|---|');
      for (const item of items) rows.push(`| ${escapeCell(item.title)} | ${item.updatedAt.slice(0, 10)} | \`${item.path}\` |`);
    }
    rows.push('');
  }
  rows.push('## 已归档交接', '');
  const handoffs = archiveItems.filter((item) => item.collection === 'handoffs');
  if (handoffs.length === 0) rows.push('- 暂无归档交接');
  else {
    rows.push('| 标题 | 更新时间 | 文件 |', '|---|---|---|');
    for (const item of handoffs) rows.push(`| ${escapeCell(item.title)} | ${item.updatedAt.slice(0, 10)} | \`${item.path}\` |`);
  }
  const indexPath = path.join(paths.projectRoot, 'records/INDEX.md');
  await writeAtomic(indexPath, `# ${paths.project.name} 记录索引\n\n> 本文件由文档工具自动生成。AI 应先看索引，再按当前任务读取具体记录；不要一次加载全部历史。\n\n${rows.join('\n')}\n`);
}

async function loadEntryItems(paths, collectionId) {
  const config = COLLECTIONS[collectionId];
  const directory = path.join(paths.projectRoot, config.directory);
  const files = await listMarkdown(directory);
  return Promise.all(files.map(async (fileName) => {
    const filePath = path.join(directory, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    const stat = await fs.stat(filePath);
    return {
      id: `entry:${collectionId}:${fileName}`,
      group: 'records',
      collection: collectionId,
      scope: 'project',
      title: firstHeading(content, fileName.replace(/\.md$/, '')),
      description: config.description,
      content,
      path: filePath,
      readOnly: false,
      updatedAt: stat.mtime.toISOString(),
      health: healthFor(content, 240),
    };
  }));
}

async function loadArchiveItems(paths) {
  const directories = [
    { name: 'handoffs', path: path.join(paths.projectRoot, 'archive/handoffs') },
    { name: 'legacy', path: path.join(paths.projectRoot, 'archive/legacy') },
  ];
  const items = [];
  for (const directory of directories) {
    for (const fileName of await listMarkdown(directory.path)) {
      const filePath = path.join(directory.path, fileName);
      const content = await fs.readFile(filePath, 'utf8');
      const stat = await fs.stat(filePath);
      items.push({
        id: `archive:${directory.name}:${fileName}`,
        group: 'archive',
        collection: directory.name,
        scope: 'project',
        title: firstHeading(content, fileName.replace(/\.md$/, '')),
        description: directory.name === 'legacy' ? '结构化资料库启用前的旧开发记录。' : '已完成轮次的交接原文。',
        content,
        path: filePath,
        readOnly: true,
        updatedAt: stat.mtime.toISOString(),
        health: healthFor(content, null),
      });
    }
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getKnowledgeWorkspace(projectId) {
  const paths = await pathsForProject(projectId);
  await ensureLegacyArchive(paths);
  await Promise.all(FIXED_DOCUMENTS.filter((definition) => !definition.readOnly).map((definition) => {
    const filePath = resolveDocumentPath(paths, definition);
    return readOrCreate(filePath, () => definition.template(paths.project));
  }));

  const collectionItems = {};
  for (const collectionId of Object.keys(COLLECTIONS)) {
    collectionItems[collectionId] = await loadEntryItems(paths, collectionId);
  }
  const archiveItems = await loadArchiveItems(paths);
  const collectionCounts = {
    decisions: collectionItems.decisions.length,
    issues: collectionItems.issues.length,
    changes: collectionItems.changes.length,
    handoffs: archiveItems.filter((item) => item.collection === 'handoffs').length,
  };
  await buildRecordIndex(paths, collectionItems, archiveItems);
  await buildAiEntry(paths, collectionCounts);

  const fixedItems = await Promise.all(FIXED_DOCUMENTS.map(async (definition) => {
    const filePath = resolveDocumentPath(paths, definition);
    const content = await fs.readFile(filePath, 'utf8');
    const stat = await fs.stat(filePath);
    return {
      ...definition,
      content,
      path: filePath,
      readOnly: Boolean(definition.readOnly),
      updatedAt: stat.mtime.toISOString(),
      health: healthFor(content, definition.recommendedLines),
    };
  }));
  const items = [...fixedItems, ...Object.values(collectionItems).flat(), ...archiveItems];
  const aiEntry = fixedItems.find((item) => item.id === 'project:ai-entry');
  const commonRules = fixedItems.find((item) => item.id === 'common:general-rules');
  const instruction = `请先读取项目 AI 对接入口 ${aiEntry.path}，再根据其中的读取顺序了解 ${paths.project.name} 当前状态。本次不自动加载通用规则；历史归档只在当前任务需要追溯时读取。`;
  const instructionWithCommon = `请先读取通用规则 ${commonRules.path}，然后读取项目 AI 对接入口 ${aiEntry.path}，再根据其中的读取顺序了解 ${paths.project.name} 当前状态。历史归档只在当前任务需要追溯时读取。`;
  return {
    project: { id: paths.project.id, name: paths.project.name },
    roots: { common: paths.commonRoot, project: paths.projectRoot },
    groups: [
      { id: 'common', title: '通用规则', description: '跨项目复用，按需读取。' },
      { id: 'project', title: '项目基础', description: '入口、项目规则和稳定背景。' },
      { id: 'current', title: '当前快照', description: '覆盖更新，不保留聊天流水。' },
      { id: 'records', title: '独立记录', description: '每个决策、异常和变更一个文件。' },
      { id: 'archive', title: '历史归档', description: '仅在追溯时读取。' },
    ],
    collections: Object.entries(COLLECTIONS).map(([id, config]) => ({ id, ...config, count: collectionCounts[id] || 0 })),
    items,
    aiInstruction: instruction,
    aiInstructionWithCommon: instructionWithCommon,
  };
}

function fixedDefinition(itemId) {
  return FIXED_DOCUMENTS.find((definition) => definition.id === itemId);
}

async function resolveEditableItem(paths, itemId) {
  const definition = fixedDefinition(itemId);
  if (definition) {
    if (definition.readOnly) throw new Error('该文件由工具自动生成，不能直接编辑。');
    return { path: resolveDocumentPath(paths, definition), recommendedLines: definition.recommendedLines };
  }
  const match = /^entry:(decisions|issues|changes):([^/\\]+\.md)$/.exec(itemId);
  if (!match) throw new Error('未知或只读的记录。');
  const config = COLLECTIONS[match[1]];
  const filePath = assertInside(path.join(paths.projectRoot, config.directory), path.join(paths.projectRoot, config.directory, match[2]));
  return { path: filePath, recommendedLines: 240 };
}

export async function saveKnowledgeItem({ id, content }, projectId) {
  const paths = await pathsForProject(projectId);
  const target = await resolveEditableItem(paths, String(id || ''));
  const normalized = String(content ?? '').replaceAll('\r\n', '\n');
  await writeAtomic(target.path, normalized);
  return { id, content: normalized, path: target.path, health: healthFor(normalized, target.recommendedLines), savedAt: new Date().toISOString() };
}

export async function createKnowledgeEntry({ collection, title }, projectId) {
  const config = COLLECTIONS[collection];
  if (!config) throw new Error('未知记录类型。');
  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) throw new Error('请输入记录标题。');
  const paths = await pathsForProject(projectId);
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const fileName = `${config.prefix}-${stamp}-${slugify(normalizedTitle)}.md`;
  const directory = path.join(paths.projectRoot, config.directory);
  const filePath = assertInside(directory, path.join(directory, fileName));
  const content = entryTemplate(collection, normalizedTitle, now.toISOString());
  await writeAtomic(filePath, content);
  return { itemId: `entry:${collection}:${fileName}`, workspace: await getKnowledgeWorkspace(projectId) };
}

export async function archiveCurrentHandoff(projectId) {
  const paths = await pathsForProject(projectId);
  const definition = fixedDefinition('project:handoff');
  const currentPath = resolveDocumentPath(paths, definition);
  const content = await readOrCreate(currentPath, () => definition.template(paths.project));
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const archivePath = path.join(paths.projectRoot, 'archive/handoffs', `HANDOFF-${stamp}.md`);
  await writeAtomic(archivePath, content);
  await writeAtomic(currentPath, handoffTemplate(paths.project.name));
  return { archivedPath: archivePath, workspace: await getKnowledgeWorkspace(projectId) };
}
