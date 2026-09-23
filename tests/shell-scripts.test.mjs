import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';
import { contentRepoDir, testIfContentRepo } from './helpers/content-repo.mjs';

const run = promisify(execFile);
const SITE_SCRIPTS = fileURLToPath(new URL('../scripts', import.meta.url));
const CONTENT_SCRIPTS = path.join(contentRepoDir, 'scripts');

async function shellScripts(dir) {
  return (await readdir(dir)).filter((name) => name.endsWith('.sh')).map((name) => path.join(dir, name));
}

async function assertScripts(scripts, minCount) {
  assert.ok(scripts.length >= minCount, `脚本数量异常: ${scripts.length}`);
  for (const script of scripts) {
    await run('bash', ['-n', script], { cwd: path.dirname(script) });
    const info = await stat(script);
    assert.ok((info.mode & 0o111) !== 0, `${script} 应具有可执行权限`);
  }
}

test('站点 shell 脚本语法合法且可执行', async () => {
  await assertScripts(await shellScripts(SITE_SCRIPTS), 3);
});

testIfContentRepo('内容仓库 shell 脚本语法合法且可执行', async () => {
  await assertScripts(await shellScripts(CONTENT_SCRIPTS), 5);
});
