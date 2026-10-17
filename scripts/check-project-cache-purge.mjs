import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { planProjectCacheCleanup, executeProjectCacheCleanup } from '../server/project-cache-cleanup.mjs';
import { createProjectDelivery } from '../server/ue-project-delivery.mjs';

const root = path.resolve('.local/checks/project-cache-purge-' + Date.now());
const project = path.join(root, 'Source'), descriptor = path.join(project, 'Demo.uproject'), cache = path.join(project, '.ue-translation-cache'), recordRoot = path.join(root, '.local/project-delivery-state/processed');
async function write(file, value) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, typeof value === 'string' ? value : JSON.stringify(value)); }
const owner = { kind: 'ue-project-translation-cache', sourceDescriptor: descriptor, schemaVersion: 1 };
const scope = path.join(cache, 'p/0123456789abcdef');
const derived = path.join(root, 'Delivered/Demo.uproject');
await write(descriptor, { EngineAssociation: '5.3' }); await write(path.join(project, 'Content/protected.uasset'), 'source original'); await fs.mkdir(path.join(project, 'Config'));
await write(path.join(cache, 'owner.json'), owner);
await write(path.join(cache, 'workspaces/old/Content/copy.uasset'), 'disposable old copy');
await write(path.join(cache, 'state/translation-cache-archives/old/results.json'), { translated: 'old' });
await write(path.join(cache, 'state/project-terms/test.json'), { sourceDescriptor: descriptor, terms: [['测试', 'Test']] });
await write(path.join(scope, 'owner.json'), { ...owner, sourceDescriptor: derived, cacheHostDescriptor: descriptor });
await write(path.join(scope, 'workspaces/new/Content/copy.uasset'), 'derived disposable');
await write(derived, { EngineAssociation: '5.3' }); await write(path.join(root, 'Delivered/Content/protected.uasset'), 'delivered original');
const options = { cacheRoot: cache, hostDescriptor: descriptor, recordRoot };
await assert.rejects(planProjectCacheCleanup({ ...options, runningJobs: [{ status: 'running' }] }), /任务/);
let plan = await planProjectCacheCleanup(options);
assert.ok(plan.totalBytes > 0); assert.equal(plan.namespaces.length, 2);
await write(path.join(cache, 'workspaces/old/Content/copy.uasset'), 'changed during preview');
await assert.rejects(executeProjectCacheCleanup(plan), /改变/);
await fs.symlink(path.join(root, 'Delivered'), path.join(cache, 'workspaces/linked'), 'junction');
await assert.rejects(planProjectCacheCleanup(options), /链接/);
await fs.unlink(path.join(cache, 'workspaces/linked'));
plan = await planProjectCacheCleanup(options);
let result = await executeProjectCacheCleanup(plan);
assert.equal(result.removedRoot, true); assert.equal(result.freedBytes, plan.totalBytes);
await assert.rejects(fs.stat(cache), { code: 'ENOENT' });
assert.equal(await fs.readFile(path.join(project, 'Content/protected.uasset'), 'utf8'), 'source original');
assert.equal(await fs.readFile(path.join(root, 'Delivered/Content/protected.uasset'), 'utf8'), 'delivered original');
const savedTerms = (await fs.readdir(recordRoot)).filter(name => /^[a-f0-9]{64}$/.test(name));
assert.equal(savedTerms.length, 2);
let termFound = false;
for (const directory of savedTerms) { try { const value = JSON.parse(await fs.readFile(path.join(recordRoot, directory, 'project-terms/test.json'))); termFound ||= value.terms[0][0] === '测试'; } catch (error) { if (error.code !== 'ENOENT') throw error; } }
assert.equal(termFound, true);

// Recovery backups survive and the root keeps its ownership marker.
await write(path.join(cache, 'owner.json'), owner);
await write(path.join(cache, 'source-backups/keep.txt'), 'recovery only');
await write(path.join(cache, 'workspaces/unused/file.txt'), 'remove');
plan = await planProjectCacheCleanup(options); result = await executeProjectCacheCleanup(plan);
assert.equal(result.removedRoot, false); assert.ok(result.preserved.length);
assert.equal(await fs.readFile(path.join(cache, 'source-backups/keep.txt'), 'utf8'), 'recovery only');
assert.ok(await fs.stat(path.join(cache, 'owner.json')));
await fs.mkdir(path.join(root, '.local/project-delivery-state'), { recursive: true });
await write(path.join(root, '.local/project-delivery-state/config.json'), { sourceDescriptor: descriptor });
let api = createProjectDelivery({ root });
await api.configure(descriptor); await api.status(); await api.cacheRecords();
await assert.rejects(fs.stat(path.join(cache, 'workspaces')), { code: 'ENOENT' });
api = createProjectDelivery({ root }); await api.status(); await api.configure(descriptor);
await assert.rejects(fs.stat(path.join(cache, 'state')), { code: 'ENOENT' });
assert.equal((await api.cacheRecords()).hasCache, false);
// Only explicitly preparing a new operation is allowed to create working cache.
await api.previewCopy({ name: 'Working' });
assert.ok(await fs.stat(path.join(cache, 'workspaces')));
const serviceClear = await api.clearTranslationCache();
assert.equal(serviceClear.cleared, true);
assert.equal((await api.status()).latestCopy, null);
assert.equal((await api.cacheRecords()).hasCache, false);
await assert.rejects(fs.stat(path.join(cache, 'workspaces')), { code: 'ENOENT' });
const report = { passed: true, root, checks: ['real bytes freed; root removed without archiving cache in itself', 'source and delivered assets untouched', 'project terminology retained in platform records', 'all owned generations included', 'running operation rejected', 'changed files and junctions rejected', 'source recovery backup preserved', 'configure/status/cache records and restart do not recreate cleared cache', 'explicit work request recreates cache only when needed'] };
await write(path.join(root, 'report.json'), report); console.log(JSON.stringify(report));
