import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { validateContent } from '../scripts/validate-content.mjs';

const run = promisify(execFile);
const CONTENT_REPO = fileURLToPath(new URL('../../luna-ore', import.meta.url));

async function makeContentRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lf-content-root-'));
  await mkdir(path.join(root, 'content'), { recursive: true });
  await mkdir(path.join(root, 'media'), { recursive: true });
  return root;
}

function runScript(script, args, contentRoot, options = {}) {
  return run('bash', [path.join(CONTENT_REPO, 'scripts', script), ...args], {
    env: { ...process.env, CONTENT_ROOT: contentRoot },
    ...options,
  });
}

test('new-novel.sh 生成符合 schema 的 novel.yaml', async () => {
  const root = await makeContentRoot();
  await runScript('new-novel.sh', ['star-sea', '星海'], root);

  const file = path.join(root, 'content/novels/star-sea/novel.yaml');
  assert.equal(existsSync(file), true);
  const text = await readFile(file, 'utf8');
  assert.match(text, /slug: "star-sea"/);
  assert.match(text, /title: "星海"/);
  assert.equal(existsSync(path.join(root, 'content/novels/star-sea/volume-01')), true);
});

test('new-chapter.sh 生成章节且拒绝重复章号文件', async () => {
  const root = await makeContentRoot();
  await runScript('new-novel.sh', ['star-sea', '星海'], root);
  await runScript('new-chapter.sh', ['star-sea', '1', '第一章 星夜'], root);

  const file = path.join(root, 'content/novels/star-sea/volume-01/001.md');
  const text = await readFile(file, 'utf8');
  assert.match(text, /chapter: 1/);
  assert.match(text, /novel: "star-sea"/);
  assert.match(text, /draft: true/);

  await assert.rejects(() => runScript('new-chapter.sh', ['star-sea', '1', '重复'], root), /拒绝覆盖|Command failed/);
});

test('new-chapter.sh 在小说不存在时报错', async () => {
  const root = await makeContentRoot();
  await assert.rejects(() => runScript('new-chapter.sh', ['ghost', '1', '幽灵'], root), /Command failed/);
});

test('new-blog.sh 生成的草稿可以通过内容校验', async () => {
  const root = await makeContentRoot();
  await runScript('new-blog.sh', ['hello-world', '第一篇文章', 'Meta', 'Notes'], root);

  const year = new Date().getFullYear();
  const file = path.join(root, `content/blog/${year}/hello-world.md`);
  const text = await readFile(file, 'utf8');
  assert.match(text, /section: "Notes"/);
  assert.match(text, /category: "Meta"/);
  assert.match(text, /draft: true/);

  const result = await validateContent({ contentRoot: root, mediaDir: path.join(root, 'media') });
  assert.deepEqual(result.errors, []);
  assert.equal(result.drafts.length, 1);
});

test('非法 slug 会被拒绝', async () => {
  const root = await makeContentRoot();
  await assert.rejects(() => runScript('new-blog.sh', ['Hello World', '标题'], root), /Command failed/);
});

test('publish.sh 在没有改动时不产生提交，有改动时提交', async () => {
  const root = await makeContentRoot();
  await run('git', ['init', '-b', 'main', '--template='], { cwd: root });
  await run('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await run('git', ['config', 'user.name', 'Test'], { cwd: root });
  await writeFile(path.join(root, 'content/.gitkeep'), '');
  await run('git', ['add', '-A'], { cwd: root });
  await run('git', ['commit', '-m', 'init'], { cwd: root });

  const noChange = await runScript('publish.sh', ['noop'], root);
  assert.match(noChange.stdout, /没有需要提交的改动/);

  await writeFile(path.join(root, 'content/post.md'), 'x');
  const published = await runScript('publish.sh', ['Publish test post'], root);
  assert.match(published.stderr, /跳过 push|已推送|未配置 origin/);

  const log = await run('git', ['log', '-1', '--pretty=%s'], { cwd: root });
  assert.equal(log.stdout.trim(), 'Publish test post');
});
