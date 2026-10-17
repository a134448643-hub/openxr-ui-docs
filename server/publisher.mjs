import { spawn } from 'node:child_process';
import path from 'node:path';
import { getPublicationConfig, APP_ROOT } from './project-document-store.mjs';

const PUBLICATION_PATHS = [
  '.github/workflows/pages.yml',
  '.gitignore',
  'README.md',
  'docs-project',
  'index.html',
  'package-lock.json',
  'package.json',
  'postcss.config.js',
  'scripts',
  'server',
  'src',
  'tailwind.config.js',
  'vite.config.js',
];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: APP_ROOT,
      windowsHide: true,
      shell: false,
      ...options,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

async function runGit(args) {
  return run('git', args);
}

function githubRepositorySlug(value) {
  const normalized = String(value || '').replace(/\/+$/, '').replace(/\.git$/i, '');
  const match = /github\.com[/:]([^/]+\/[^/]+)$/i.exec(normalized);
  return match?.[1]?.toLowerCase() || '';
}

export async function publishDocumentation({ push = true, projectId } = {}) {
  const buildScript = path.join(APP_ROOT, 'scripts', 'build-site.mjs');
  const build = await run(process.execPath, [buildScript], {
    env: { ...process.env, ...(process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}), DOC_STUDIO_PROJECT_ID: projectId || '' },
  });
  if (build.code !== 0) {
    throw new Error(build.stderr || build.stdout || 'Static site build failed.');
  }

  const insideRepository = await runGit(['rev-parse', '--is-inside-work-tree']);
  const remote = insideRepository.code === 0
    ? await runGit(['config', '--get', 'remote.origin.url'])
    : { code: 1, stdout: '' };
  const publication = await getPublicationConfig(projectId);

  const expectedRepository = githubRepositorySlug(publication.repository);
  const configuredRepository = githubRepositorySlug(remote.stdout);
  const canPushCurrentProject = expectedRepository && expectedRepository === configuredRepository;
  if (!push || insideRepository.code !== 0 || remote.code !== 0 || !remote.stdout || !canPushCurrentProject) {
    return {
      status: 'local-build-ready',
      pushed: false,
      needsGitHubSetup: true,
      siteUrl: publication.siteUrl || '',
      message: '静态网站已经生成；配置 GitHub 仓库后即可推送发布。',
    };
  }

  const add = await runGit(['add', '--', ...PUBLICATION_PATHS]);
  if (add.code !== 0) throw new Error(add.stderr || 'Unable to stage documentation changes.');

  const stagedDiff = await runGit(['diff', '--cached', '--quiet']);
  if (stagedDiff.code !== 0) {
    const stamp = new Date().toISOString().slice(0, 10);
    const commit = await runGit(['commit', '-m', `docs: publish ${stamp}`]);
    if (commit.code !== 0) throw new Error(commit.stderr || commit.stdout || 'Unable to create Git commit.');
  }

  const pushResult = await runGit(['push', 'origin', 'HEAD']);
  if (pushResult.code !== 0) throw new Error(pushResult.stderr || pushResult.stdout || 'Git push failed.');

  return {
    status: 'pushed',
    pushed: true,
    needsGitHubSetup: false,
    siteUrl: publication.siteUrl || '',
    message: '文档已经推送到 GitHub，Pages 正在部署。',
  };
}
