import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { validateContent } from '../scripts/validate-content.mjs';
import { makeWorkspace, markdown, blogFrontmatter, chapterFrontmatter, novelYaml } from './helpers/fixtures.mjs';

async function validWorkspace() {
  const ws = await makeWorkspace();
  await ws.file('content/blog/2026/sample.md', markdown(blogFrontmatter()));
  await ws.file('content/novels/star-sea/novel.yaml', novelYaml());
  await ws.file('content/novels/star-sea/volume-01/001.md', markdown(chapterFrontmatter()));
  await ws.file('content/projects/site.yaml', 'title: "站点"\ndescription: "描述"\nstatus: "active"\n');
  await ws.touch('media/blog/cover.webp');
  return ws;
}

test('合法内容没有错误', async () => {
  const ws = await validWorkspace();
  const result = await validateContent({ contentRoot: ws.root });
  assert.deepEqual(result.errors, []);
  assert.equal(result.stats.blogs, 1);
  assert.equal(result.stats.chapters, 1);
  assert.equal(result.stats.novels, 1);
});

test('重复 blog slug 报错', async () => {
  const ws = await validWorkspace();
  await ws.file('content/blog/2026/dup.md', markdown(blogFrontmatter({ title: '另一篇' })));
  const result = await validateContent({ contentRoot: ws.root });
  assert.ok(result.errors.some((error) => /duplicate blog slug "sample-post"/.test(error)), result.errors.join('\n'));
});

test('同一小说内重复章节号报错', async () => {
  const ws = await validWorkspace();
  await ws.file('content/novels/star-sea/volume-01/002.md', markdown(chapterFrontmatter({ title: '第二节', slug: '002' })));
  const result = await validateContent({ contentRoot: ws.root });
  assert.ok(result.errors.some((error) => /duplicate chapter number 1/.test(error)), result.errors.join('\n'));
});

test('章节引用不存在的小说报错', async () => {
  const ws = await validWorkspace();
  await ws.file('content/novels/ghost/volume-01/001.md', markdown(chapterFrontmatter({ novel: 'missing-novel' })));
  const result = await validateContent({ contentRoot: ws.root });
  assert.ok(result.errors.some((error) => /unknown novel "missing-novel"/.test(error)), result.errors.join('\n'));
});

test('缺失封面媒体报错', async () => {
  const ws = await validWorkspace();
  await ws.file('content/blog/2026/with-cover.md', markdown(blogFrontmatter({ slug: 'with-cover', cover: '/media/blog/missing.webp' })));
  const result = await validateContent({ contentRoot: ws.root });
  assert.ok(
    result.errors.some((error) => /missing media file/.test(error) && /missing\.webp/.test(error)),
    result.errors.join('\n'),
  );
});

test('分类 slug 冲突报错', async () => {
  const ws = await validWorkspace();
  await ws.file('content/blog/2026/other.md', markdown(blogFrontmatter({ slug: 'other', category: 'agent' })));
  const result = await validateContent({ contentRoot: ws.root });
  assert.ok(result.errors.some((error) => /category/i.test(error) && /slug/i.test(error)), result.errors.join('\n'));
});

test('草稿清单包含可路由信息', async () => {
  const ws = await validWorkspace();
  await ws.file('content/blog/2026/draft.md', markdown(blogFrontmatter({ slug: 'secret-draft', title: '草稿', draft: true })));
  await ws.file(
    'content/novels/star-sea/volume-01/099.md',
    markdown(chapterFrontmatter({ slug: '099', title: '未发布', chapter: 99, draft: true })),
  );
  const result = await validateContent({ contentRoot: ws.root });
  assert.deepEqual(result.drafts, [
    { collection: 'blog', route: '/blog/secret-draft/', file: 'content/blog/2026/draft.md' },
    { collection: 'chapters', route: '/novel/star-sea/099/', file: 'content/novels/star-sea/volume-01/099.md' },
  ]);
});

test('媒体路径以 media 目录为基准解析', async () => {
  const ws = await validWorkspace();
  await ws.file('content/blog/2026/cover.md', markdown(blogFrontmatter({ slug: 'cover', cover: '/media/blog/cover.webp' })));
  const result = await validateContent({ contentRoot: ws.root });
  assert.deepEqual(result.errors, []);
  assert.ok(path.isAbsolute(result.mediaDir));
});
