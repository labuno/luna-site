import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL('../scripts/bootstrap-github.sh', import.meta.url));

function dryRun(env = {}) {
  return run('bash', [SCRIPT, '--dry-run'], {
    env: { ...process.env, ...env },
  });
}

test('默认使用 labuno 账号与 SSH 别名远端', async () => {
  const { stdout } = await dryRun();
  assert.match(stdout, /账号:\s+labuno/);
  assert.match(stdout, /git@github-labuno:labuno\/luna-site\.git/);
  assert.match(stdout, /git@github-labuno:labuno\/luna-ore\.git/);
  assert.match(stdout, /CONTENT_REPOSITORY\s*=\s*labuno\/luna-ore/);
  assert.match(stdout, /SITE_URL\s*=\s*https:\/\/labuno\.github\.io/);
  assert.match(stdout, /BASE_PATH\s*=\s*\/luna-site\//);
});

test('GIT_PROTOCOL=https 时使用 https 远端', async () => {
  const { stdout } = await dryRun({ GIT_PROTOCOL: 'https' });
  assert.match(stdout, /https:\/\/github\.com\/labuno\/luna-site\.git/);
});

test('GITHUB_OWNER 可切换账号，URL 与变量同步变化', async () => {
  const { stdout } = await dryRun({ GITHUB_OWNER: 'lucas-zan', SSH_HOST_ALIAS: 'github-lucas-zan' });
  assert.match(stdout, /git@github-lucas-zan:lucas-zan\/luna-site\.git/);
  assert.match(stdout, /CONTENT_REPOSITORY\s*=\s*lucas-zan\/luna-ore/);
  assert.match(stdout, /SITE_URL\s*=\s*https:\/\/lucas-zan\.github\.io/);
  assert.match(stdout, /BASE_PATH\s*=\s*\/luna-site\//);
});

test('dry-run 只输出计划，不执行创建/推送', async () => {
  const { stdout } = await dryRun();
  assert.match(stdout, /\[dry-run\] 不执行任何创建或推送/);
  assert.ok(!stdout.includes('仓库已就绪'));
});
