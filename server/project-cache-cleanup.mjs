import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const key = value => path.resolve(value).toLowerCase();
const inside = (root, target) => { const rel = path.relative(root, target); return rel !== '' && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
const exists = async file => { try { await fs.lstat(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };
const json = async (file, fallback = null) => { try { return JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } };
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const protectedNames = /^(?:source-backups?|recovery(?:-backups?)?|backups?|previous|rollback|transactions?|\.apply-transactions|staging|baseline)$/i;
const stateFolders = new Set(['jobs', 'editor-scans', 'exports', 'translations', 'translation-cache', 'translation-cache-archives', 'external-tasks', 'manifests', 'version-projects', 'project-terms']);
const stateFiles = new Set(['config.json', 'source-report.json', 'latest-copy.json', 'latest-export.json', 'latest-job.json', 'latest-scan.json', 'latest-version-projects.json', 'translation-result.json', 'migration.json', 'fab-checks.json']);

async function checked(root, file) {
  if (!inside(root, file)) throw Error('清理路径超出项目缓存目录');
  const stat = await fs.lstat(file);
  if (stat.isSymbolicLink() || key(await fs.realpath(file)) !== key(file)) throw Error('缓存包含链接，停止清理：' + file);
  return stat;
}

// Build a file-by-file plan. Unknown folders and recovery transactions are never
// swept by a recursive delete, and an independently created file cannot be lost.
export async function planProjectCacheCleanup({ cacheRoot, hostDescriptor, sourceDescriptor = hostDescriptor, recordRoot, runningJobs = [] }) {
  if (!path.isAbsolute(cacheRoot || '') || !path.isAbsolute(recordRoot || '') || !path.isAbsolute(hostDescriptor || '')) throw Error('项目缓存清理路径无效');
  cacheRoot = path.resolve(cacheRoot); recordRoot = path.resolve(recordRoot);
  if (key(cacheRoot) !== key(path.join(path.dirname(hostDescriptor), '.ue-translation-cache')) || inside(cacheRoot, recordRoot) || key(cacheRoot) === key(recordRoot)) throw Error('只允许清理源项目专用缓存目录');
  if (runningJobs.some(job => job.status === 'running')) throw Error('有工程任务正在运行，请结束或暂停后清理缓存');
  if (!await exists(cacheRoot)) return { cacheRoot, hostDescriptor, sourceDescriptor, recordRoot, files: [], directories: [], namespaces: [], preserved: [], totalBytes: 0, absent: true };
  if ((await fs.lstat(cacheRoot)).isSymbolicLink() || key(await fs.realpath(cacheRoot)) !== key(cacheRoot)) throw Error('项目缓存根目录包含链接');
  await checked(cacheRoot, path.join(cacheRoot, 'owner.json'));
  const rootOwner = await json(path.join(cacheRoot, 'owner.json'));
  if (rootOwner?.kind !== 'ue-project-translation-cache' || key(rootOwner.sourceDescriptor) !== key(hostDescriptor)) throw Error('项目缓存归属不匹配');
  const namespaces = [{ directory: cacheRoot, owner: rootOwner }], preserved = [], files = [], directories = [];
  const addFile = async file => { const stat = await checked(cacheRoot, file); if (!stat.isFile()) throw Error('缓存文件类型异常'); files.push({ path: file, bytes: stat.size, mtime: stat.mtimeMs }); };
  async function walk(directory, assetTree = false) {
    await checked(cacheRoot, directory); directories.push(directory);
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('缓存包含链接，停止清理：' + file);
      if (entry.isDirectory()) {
        if (!assetTree && protectedNames.test(entry.name)) { preserved.push({ path: file, reason: '恢复备份或事务现场，保留' }); continue; }
        await walk(file, assetTree || ['Content', 'Config', 'Source'].includes(entry.name));
      } else await addFile(file);
    }
  }
  const derivedRoot = path.join(cacheRoot, 'p');
  if (await exists(derivedRoot)) {
    await checked(cacheRoot, derivedRoot); directories.push(derivedRoot);
    for (const entry of await fs.readdir(derivedRoot, { withFileTypes: true })) {
      const directory = path.join(derivedRoot, entry.name);
      if (!entry.isDirectory() || !/^[a-f0-9]{16}$/.test(entry.name)) { preserved.push({ path: directory, reason: '不属于已识别的项目缓存' }); continue; }
      await checked(cacheRoot, directory);
      await checked(cacheRoot, path.join(directory, 'owner.json'));
      const owner = await json(path.join(directory, 'owner.json'));
      if (owner?.kind !== 'ue-project-translation-cache' || !path.isAbsolute(owner.sourceDescriptor || '') || key(owner.cacheHostDescriptor || '') !== key(hostDescriptor)) { preserved.push({ path: directory, reason: '缓存归属未通过校验' }); continue; }
      if (key(sourceDescriptor) === key(hostDescriptor) || key(owner.sourceDescriptor) === key(sourceDescriptor)) namespaces.push({ directory, owner });
      else preserved.push({ path: directory, reason: '其他衍生项目缓存' });
    }
  }
  for (const scope of namespaces) {
    if (scope.directory === cacheRoot && key(sourceDescriptor) !== key(hostDescriptor)) continue;
    directories.push(scope.directory);
    for (const entry of await fs.readdir(scope.directory, { withFileTypes: true })) {
      const file = path.join(scope.directory, entry.name);
      if (entry.name === 'p') continue;
      if (entry.name === 'owner.json') { await addFile(file); continue; }
      if (entry.isDirectory() && ['workspaces', 'classification'].includes(entry.name)) { await walk(file); continue; }
      if (entry.isDirectory() && entry.name === 'state') {
        await checked(cacheRoot, file); directories.push(file);
        for (const child of await fs.readdir(file, { withFileTypes: true })) {
          const target = path.join(file, child.name);
          if (child.isDirectory() && stateFolders.has(child.name)) await walk(target);
          else if (child.isFile() && stateFiles.has(child.name)) await addFile(target);
          else preserved.push({ path: target, reason: '保留恢复数据或未识别的记录' });
        }
      } else preserved.push({ path: file, reason: '保留恢复数据或未识别的内容' });
    }
  }
  // Keep ownership metadata while any protected content remains in that scope.
  const filtered = files.filter(file => path.basename(file.path) !== 'owner.json' || !namespaces.some(scope => path.dirname(file.path) === scope.directory && preserved.some(item => inside(scope.directory, item.path))));
  return { cacheRoot, hostDescriptor, sourceDescriptor, recordRoot, namespaces, files: filtered, directories: [...new Set(directories)], preserved, totalBytes: filtered.reduce((sum, file) => sum + file.bytes, 0), absent: false };
}

export async function executeProjectCacheCleanup(plan, { beforeDelete = async () => {}, importStore = async () => {} } = {}) {
  if (plan.absent) return { cleared: true, removedRoot: true, freedBytes: 0, preserved: [], cacheRoot: plan.cacheRoot };
  // Revalidate every file before deleting anything. The plan is invalidated if
  // an operation has written new results since the preview.
  for (const file of plan.files) { const stat = await checked(plan.cacheRoot, file.path); if (stat.size !== file.bytes || stat.mtimeMs !== file.mtime) throw Error('缓存内容已改变，请重新清理'); }
  for (const scope of plan.namespaces) {
    if (scope.directory === plan.cacheRoot && key(plan.sourceDescriptor) !== key(plan.hostDescriptor)) continue;
    const store = path.join(scope.directory, 'state'); await importStore(store);
    const recordDirectory = path.join(plan.recordRoot, digest(scope.owner.sourceDescriptor.toLowerCase()));
    await fs.mkdir(recordDirectory, { recursive: true });
    await fs.writeFile(path.join(recordDirectory, 'config.json'), JSON.stringify({ sourceDescriptor: scope.owner.sourceDescriptor }));
    await fs.writeFile(path.join(recordDirectory, 'cache-cleared.json'), JSON.stringify({ clearedAt: new Date().toISOString() }));
    for (const name of ['latest-copy.json', 'latest-scan.json', 'translation-result.json', 'latest-job.json']) await fs.unlink(path.join(recordDirectory, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    const termDirectory = path.join(store, 'project-terms');
    for (const file of plan.files.filter(file => path.dirname(file.path) === termDirectory)) {
      const target = path.join(recordDirectory, 'project-terms', path.basename(file.path)); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(file.path, target);
    }
    const records = [];
    for (const file of plan.files.filter(file => path.dirname(file.path) === path.join(store, 'jobs') && file.path.endsWith('.json'))) {
      const record = await json(file.path); if (!record) continue;
      records.push(Object.fromEntries(['id', 'kind', 'status', 'source', 'target', 'descriptorPath', 'direction', 'startedAt', 'completedAt', 'processingState', 'translationApplied', 'error'].filter(field => field in record).map(field => [field, record[field]])));
    }
    await fs.writeFile(path.join(recordDirectory, 'cleared-history-' + digest(scope.directory).slice(0, 16) + '.json'), JSON.stringify({ owner: scope.owner, records, clearedAt: new Date().toISOString() }));
  }
  await beforeDelete();
  let freedBytes = 0, removedFiles = 0;
  const failures = [];
  const ownerFiles = new Set(plan.namespaces.map(scope => path.join(scope.directory, 'owner.json')));
  for (const file of plan.files) {
    if (ownerFiles.has(file.path)) continue;
    try { const stat = await checked(plan.cacheRoot, file.path); if (stat.size !== file.bytes || stat.mtimeMs !== file.mtime) throw Error('文件在清理期间改变'); await fs.unlink(file.path); freedBytes += file.bytes; removedFiles++; }
    catch (error) { failures.push({ path: file.path, reason: error.message }); }
  }
  for (const directory of plan.directories.sort((a, b) => b.length - a.length)) {
    try { if (directory !== plan.cacheRoot) await checked(plan.cacheRoot, directory); await fs.rmdir(directory); }
    catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) failures.push({ path: directory, reason: error.message }); }
  }
  for (const scope of [...plan.namespaces].sort((a, b) => b.directory.length - a.directory.length)) {
    const ownerFile = plan.files.find(file => file.path === path.join(scope.directory, 'owner.json'));
    if (!ownerFile || !await exists(scope.directory)) continue;
    const entries = await fs.readdir(scope.directory);
    if (entries.length === 1 && entries[0] === 'owner.json') {
      await checked(plan.cacheRoot, ownerFile.path); await fs.unlink(ownerFile.path); freedBytes += ownerFile.bytes; removedFiles++;
      await fs.rmdir(scope.directory);
    }
    const derived = path.join(plan.cacheRoot, 'p');
    if (await exists(derived)) { await checked(plan.cacheRoot, derived); await fs.rmdir(derived).catch(error => { if (error.code !== 'ENOTEMPTY') throw error; }); }
  }
  const removedRoot = !await exists(plan.cacheRoot);
  const result = { cleared: failures.length === 0, removedRoot, freedBytes, removedFiles, preserved: [...plan.preserved, ...failures], cacheRoot: plan.cacheRoot, sourceDescriptor: plan.sourceDescriptor, clearedAt: new Date().toISOString() };
  await fs.mkdir(plan.recordRoot, { recursive: true }); await fs.writeFile(path.join(plan.recordRoot, 'last-cache-cleanup.json'), JSON.stringify(result, null, 2));
  return result;
}
