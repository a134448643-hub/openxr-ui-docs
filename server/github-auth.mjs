import { spawn } from 'node:child_process';
import { APP_ROOT, getPublicationConfig } from './project-document-store.mjs';

let loginProcess = null;

function runGitCredentialManager(args) {
  return new Promise((resolve) => {
    const child = spawn('git', ['credential-manager', 'github', ...args], {
      cwd: APP_ROOT,
      windowsHide: true,
      shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: -1, stdout: '', stderr: error.message }));
    child.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

export async function getGitHubAuthStatus() {
  const result = await runGitCredentialManager(['list']);
  if (result.code !== 0) {
    return {
      available: false,
      authenticated: false,
      accounts: [],
      error: result.stderr || 'Git Credential Manager is unavailable.',
    };
  }

  const accounts = result.stdout
    .split(/\r?\n/)
    .map((account) => account.trim())
    .filter(Boolean);
  const publication = await getPublicationConfig();
  const selectedAccount = publication.account || '';
  const projectAccounts = selectedAccount && accounts.includes(selectedAccount)
    ? [selectedAccount]
    : accounts;

  return {
    available: true,
    authenticated: projectAccounts.length > 0,
    accounts: projectAccounts,
    selectedAccount,
  };
}

export function startGitHubLogin() {
  if (loginProcess && loginProcess.exitCode === null) {
    return { started: false, running: true };
  }

  loginProcess = spawn(
    'git',
    ['credential-manager', 'github', 'login', '--browser', '--force'],
    {
      cwd: APP_ROOT,
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
      shell: false,
    },
  );
  loginProcess.unref();
  return { started: true, running: true };
}
