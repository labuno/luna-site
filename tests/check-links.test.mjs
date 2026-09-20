import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { checkDist } from '../scripts/check-links.mjs';

async function makeDist() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lf-dist-'));
  const write = async (relative, contents = '') => {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, contents, 'utf8');
  };

  await write('index.html', '<h1 id="top">首页</h1><a href="#top">top</a><a href="/luna-site/blog/x/">x</a><a href="https://example.com">e</a>');
  await write('blog/x/index.html', '<a href="/luna-site/">home</a><img src="/luna-site/media/a.svg">');
  await write('media/a.svg', '<svg/>');
  await write('pagefind/pagefind.js', '// pagefind');
  await write('sitemap-index.xml', '<sitemapindex/>');
  await write('rss.xml', '<rss><item><link>https://x/luna-site/blog/x/</link></item></rss>');
  await write('robots.txt', 'User-agent: *');

  return { root, write };
}

const baseOptions = (distDir) => ({ distDir, base: '/luna-site/' });

test('完整产物没有错误', async () => {
  const dist = await makeDist();
  const result = await checkDist(baseOptions(dist.root));
  assert.deepEqual(result.errors, []);
  assert.equal(result.stats.htmlFiles, 2);
  assert.ok(result.stats.linksChecked >= 4);
});

test('断链被报告', async () => {
  const dist = await makeDist();
  await dist.write('broken.html', '<a href="/luna-site/nowhere/">没有这个页面</a>');
  const result = await checkDist(baseOptions(dist.root));
  assert.ok(result.errors.some((error) => error.includes('/nowhere/')), result.errors.join('\n'));
});

test('未加 base 的内部链接被报告（base 转义）', async () => {
  const dist = await makeDist();
  await dist.write('escape.html', '<a href="/blog/x/">忘了 base</a>');
  const result = await checkDist(baseOptions(dist.root));
  assert.ok(result.errors.some((error) => /escapes base path/.test(error)), result.errors.join('\n'));
});

test('草稿路由泄漏被报告', async () => {
  const dist = await makeDist();
  await dist.write('blog/secret-draft/index.html', '<p>draft leaked</p>');
  const result = await checkDist({
    ...baseOptions(dist.root),
    drafts: [{ collection: 'blog', route: '/blog/secret-draft/', file: 'content/blog/2026/draft.md' }],
  });
  assert.ok(result.errors.some((error) => /draft route leaked/.test(error)), result.errors.join('\n'));
});

test('草稿出现在 RSS 中被报告', async () => {
  const dist = await makeDist();
  await dist.write('rss.xml', '<rss><item><link>https://x/luna-site/blog/secret-draft/</link></item></rss>');
  const result = await checkDist({
    ...baseOptions(dist.root),
    drafts: [{ collection: 'blog', route: '/blog/secret-draft/', file: 'content/blog/2026/draft.md' }],
  });
  assert.ok(result.errors.some((error) => /leaked into rss\.xml/.test(error)), result.errors.join('\n'));
});

test('草稿进入 Pagefind 索引被报告', async () => {
  const dist = await makeDist();
  const payload = Buffer.from(JSON.stringify({ url: '/blog/secret-draft/', content: '草稿' }));
  await dist.write('pagefind/fragment/zh-cn_0000000.pf_fragment', gzipSync(payload));
  const result = await checkDist({
    ...baseOptions(dist.root),
    drafts: [{ collection: 'blog', route: '/blog/secret-draft/', file: 'content/blog/2026/draft.md' }],
  });
  assert.ok(result.errors.some((error) => /leaked into the Pagefind index/.test(error)), result.errors.join('\n'));
});

test('缺少 Pagefind 索引被报告', async () => {
  const dist = await makeDist();
  const result = await checkDist({ ...baseOptions(dist.root), requirePagefind: false });
  assert.deepEqual(result.errors, []);
});

test('锚点目标缺失被报告', async () => {
  const dist = await makeDist();
  await dist.write('anchor.html', '<a href="#missing">缺失锚点</a>');
  const result = await checkDist(baseOptions(dist.root));
  assert.ok(result.errors.some((error) => /missing anchor/.test(error)), result.errors.join('\n'));
});

test('Sitemap / RSS / robots 缺失被报告', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lf-dist-empty-'));
  await mkdir(root, { recursive: true });
  const result = await checkDist({ distDir: root, base: '/luna-site/', requirePagefind: false });
  assert.ok(result.errors.some((error) => /sitemap-index\.xml/.test(error)), result.errors.join('\n'));
  assert.ok(result.errors.some((error) => /rss\.xml/.test(error)), result.errors.join('\n'));
  assert.ok(result.errors.some((error) => /robots\.txt/.test(error)), result.errors.join('\n'));
});
