import { spawn } from 'node:child_process';
import path from 'node:path';
import { getPublicationConfig, APP_ROOT } from './document-store.mjs';

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

export async function publishDocumentation({ push = true } = {}) {
  const buildScript = path.join(APP_ROOT, 'scripts', 'build-site.mjs');
  const build = await run(process.execPath, [buildScript]);
  if (build.code !== 0) {
    throw new Error(build.stderr || build.stdout || 'Static site build failed.');
  }

  const insideRepository = await runGit(['rev-parse', '--is-inside-work-tree']);
  const remote = insideRepository.code === 0
    ? await runGit(['config', '--get', 'remote.origin.url'])
    : { code: 1, stdout: '' };
  const publication = await getPublicationConfig();

  if (!push || insideRepository.code !== 0 || remote.code !== 0 || !remote.stdout) {
    return {
      status: 'local-build-ready',
      pushed: false,
      needsGitHubSetup: true,
      siteUrl: publication.siteUrl || '',
      message: '静态网站已经生成；配置 GitHub 仓库后即可推送发布。',
    };
  }

  const add = await runGit(['add', '--all']);
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
