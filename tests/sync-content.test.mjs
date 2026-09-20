import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncContent, countFiles, mustBeDirectory } from '../scripts/sync-content.mjs';

async function makeTemp() {
  return mkdtemp(path.join(os.tmpdir(), 'lf-sync-'));
}

test('syncContent 复制 content/ 与 media/，并清除陈旧文件', async () => {
  const tmp = await makeTemp();
  const source = path.join(tmp, 'content-repo');
  const target = path.join(tmp, 'site');

  await mkdir(path.join(source, 'content', 'blog'), { recursive: true });
  await mkdir(path.join(source, 'media', 'blog'), { recursive: true });
  await mkdir(path.join(target, 'content', 'blog'), { recursive: true });
  await mkdir(path.join(target, 'public', 'media'), { recursive: true });
  await writeFile(path.join(source, 'content', 'blog', 'a.md'), '# a');
  await writeFile(path.join(source, 'media', 'blog', 'a.png'), 'png');
  await writeFile(path.join(target, 'content', 'blog', 'stale.md'), 'stale');
  await writeFile(path.join(target, 'public', 'media', 'stale.png'), 'stale');

  const result = await syncContent({ sourceRoot: source, targetRoot: target, log: () => {} });

  assert.equal(result.contentFiles, 1);
  assert.equal(result.mediaFiles, 1);
  assert.equal(existsSync(path.join(target, 'content', 'blog', 'stale.md')), false);
  assert.equal(existsSync(path.join(target, 'public', 'media', 'stale.png')), false);
  assert.equal(await readFile(path.join(target, 'content', 'blog', 'a.md'), 'utf8'), '# a');
  assert.equal(await readFile(path.join(target, 'public', 'media', 'blog', 'a.png'), 'utf8'), 'png');
});

test('syncContent 在内容目录缺失时报错', async () => {
  const tmp = await makeTemp();
  await assert.rejects(
    () => syncContent({ sourceRoot: tmp, targetRoot: tmp, log: () => {} }),
    /Content directory not found/,
  );
});

test('syncContent 在媒体目录缺失时报错', async () => {
  const tmp = await makeTemp();
  await mkdir(path.join(tmp, 'content'), { recursive: true });
  await assert.rejects(
    () => syncContent({ sourceRoot: tmp, targetRoot: tmp, log: () => {} }),
    /Media directory not found/,
  );
});

test('countFiles 递归统计文件数', async () => {
  const tmp = await makeTemp();
  await mkdir(path.join(tmp, 'a', 'b'), { recursive: true });
  await writeFile(path.join(tmp, 'a', 'one.md'), '1');
  await writeFile(path.join(tmp, 'a', 'b', 'two.md'), '2');
  assert.equal(await countFiles(tmp), 2);
});

test('mustBeDirectory 拒绝文件路径', async () => {
  const tmp = await makeTemp();
  const file = path.join(tmp, 'x.md');
  await writeFile(file, 'x');
  await assert.rejects(() => mustBeDirectory(file, 'Content directory'), /not a directory/);
});

test('syncContent 重建 .gitkeep 占位，保持仓库状态干净', async () => {
  const tmp = await makeTemp();
  const source = path.join(tmp, 'content-repo');
  const target = path.join(tmp, 'site');
  await mkdir(path.join(source, 'content'), { recursive: true });
  await mkdir(path.join(source, 'media'), { recursive: true });
  await mkdir(path.join(target, 'content'), { recursive: true });
  await mkdir(path.join(target, 'public', 'media'), { recursive: true });

  await syncContent({ sourceRoot: source, targetRoot: target, log: () => {} });

  assert.equal(existsSync(path.join(target, 'content', '.gitkeep')), true);
  assert.equal(existsSync(path.join(target, 'public', 'media', '.gitkeep')), true);
});
