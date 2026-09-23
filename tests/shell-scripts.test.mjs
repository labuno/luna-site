import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
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

// macOS 自带 bash 3.2 在 UTF-8 locale 下会把 $var 后面紧跟的多字节字符
// 的第一个字节当作变量名的一部分（如 $content_sha）-> unbound variable）。
const UNBRACED_VAR_BEFORE_MULTIBYTE = /\$[A-Za-z_][A-Za-z0-9_]*(?=[^\x00-\x7F])/;

async function assertScripts(scripts, minCount) {
  assert.ok(scripts.length >= minCount, `脚本数量异常: ${scripts.length}`);
  for (const script of scripts) {
    await run('bash', ['-n', script], { cwd: path.dirname(script) });
    const info = await stat(script);
    assert.ok((info.mode & 0o111) !== 0, `${script} 应具有可执行权限`);

    const text = await readFile(script, 'utf8');
    const offending = text.split('\n').find((line) => UNBRACED_VAR_BEFORE_MULTIBYTE.test(line));
    assert.equal(
      offending,
      undefined,
      `${script} 的 $var 紧跟非 ASCII 字符时需写成 \${var}（bash 3.2 兼容）：${offending}`,
    );
  }
}

test('站点 shell 脚本语法合法且可执行', async () => {
  await assertScripts(await shellScripts(SITE_SCRIPTS), 3);
});

testIfContentRepo('内容仓库 shell 脚本语法合法且可执行', async () => {
  await assertScripts(await shellScripts(CONTENT_SCRIPTS), 5);
});
