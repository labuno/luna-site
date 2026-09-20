import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const SCRIPT = fileURLToPath(new URL('../scripts/setup-git-account.sh', import.meta.url));

async function makeHome() {
  const home = await mkdtemp(path.join(os.tmpdir(), 'lf-home-'));
  await mkdir(path.join(home, 'work', 'lunafoundry'), { recursive: true });
  await mkdir(path.join(home, '.ssh'), { recursive: true });
  return home;
}

function runScript(args, home, extraEnv = {}) {
  return run('bash', [SCRIPT, ...args], {
    env: { ...process.env, HOME: home, ACCOUNT_ID: '330791588', ...extraEnv },
  });
}

const baseArgs = (home) => [
  '--account',
  'lunafoundry',
  '--root',
  path.join(home, 'work', 'lunafoundry'),
  '--ssh-alias',
  'github-lunafoundry',
];

test('写入账号级 gitconfig（身份 + URL 重写）', async () => {
  const home = await makeHome();
  await runScript(baseArgs(home), home);

  const accountConfig = await readFile(path.join(home, '.gitconfig-lunafoundry'), 'utf8');
  assert.match(accountConfig, /\[user\]/);
  assert.match(accountConfig, /name = lunafoundry/);
  assert.match(accountConfig, /email = 330791588\+lunafoundry@users\.noreply\.github\.com/);
  assert.match(accountConfig, /insteadOf = https:\/\/github\.com\/lunafoundry\//);
  assert.match(accountConfig, /insteadOf = git@github\.com:lunafoundry\//);

  const globalConfig = await readFile(path.join(home, '.gitconfig'), 'utf8');
  assert.match(globalConfig, /includeIf "gitdir:/);
  assert.match(globalConfig, /\.gitconfig-lunafoundry/);

  const sshConfig = await readFile(path.join(home, '.ssh', 'config'), 'utf8');
  assert.match(sshConfig, /Host github-lunafoundry/);
  assert.match(sshConfig, /HostName github\.com/);
  assert.match(sshConfig, /IdentityFile .*id_ed25519_lunafoundry/);
  assert.match(sshConfig, /IdentitiesOnly yes/);
});

test('重复执行保持幂等（不产生重复配置块）', async () => {
  const home = await makeHome();
  await runScript(baseArgs(home), home);
  await runScript(baseArgs(home), home);

  const globalConfig = await readFile(path.join(home, '.gitconfig'), 'utf8');
  const sshConfig = await readFile(path.join(home, '.ssh', 'config'), 'utf8');
  assert.equal((globalConfig.match(/includeIf/g) ?? []).length, 1);
  assert.equal((sshConfig.match(/Host github-lunafoundry/g) ?? []).length, 1);
});

test('保留已有的全局配置内容', async () => {
  const home = await makeHome();
  await writeFile(path.join(home, '.gitconfig'), '[user]\n\tname = lucas\n\temail = lucas@example.com\n');
  await runScript(baseArgs(home), home);

  const globalConfig = await readFile(path.join(home, '.gitconfig'), 'utf8');
  assert.match(globalConfig, /name = lucas/);
  assert.match(globalConfig, /includeIf/);
});

test('作用目录变化时给出提示而不重复写入', async () => {
  const home = await makeHome();
  await runScript(baseArgs(home), home);
  const other = path.join(home, 'work', 'elsewhere');
  await mkdir(other, { recursive: true });
  const result = await runScript([
    '--account', 'lunafoundry', '--root', other, '--ssh-alias', 'github-lunafoundry',
  ], home);
  assert.match(result.stdout, /作用目录不同/);
  const globalConfig = await readFile(path.join(home, '.gitconfig'), 'utf8');
  assert.equal((globalConfig.match(/includeIf/g) ?? []).length, 1);
});

test('--dry-run 不写入任何文件', async () => {
  const home = await makeHome();
  await runScript([...baseArgs(home), '--dry-run'], home);
  assert.equal(existsSync(path.join(home, '.gitconfig-lunafoundry')), false);
  assert.equal(existsSync(path.join(home, '.gitconfig')), false);
});

test('缺少账号 ID 且无法访问 gh 时报错', async () => {
  const home = await makeHome();
  await assert.rejects(
    () => runScript(baseArgs(home), home, { ACCOUNT_ID: '', PATH: '/usr/bin:/bin' }),
    /无法确定账号/,
  );
});
