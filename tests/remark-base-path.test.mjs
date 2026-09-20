import test from 'node:test';
import assert from 'node:assert/strict';
import remarkBasePath, { rewriteUrl } from '../src/lib/remark-base-path.mjs';

test('rewriteUrl 只重写根绝对路径', () => {
  assert.equal(rewriteUrl('/media/a.png', '/luna-site/'), '/luna-site/media/a.png');
  assert.equal(rewriteUrl('/luna-site/media/a.png', '/luna-site/'), '/luna-site/media/a.png');
  assert.equal(rewriteUrl('/media/a.png', '/'), '/media/a.png');
  assert.equal(rewriteUrl('https://x.com/a.png', '/luna-site/'), 'https://x.com/a.png');
  assert.equal(rewriteUrl('//cdn.com/a.png', '/luna-site/'), '//cdn.com/a.png');
  assert.equal(rewriteUrl('relative/a.png', '/luna-site/'), 'relative/a.png');
});

test('remark 插件重写 markdown 图片与链接', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'image', url: '/media/blog/cover.webp', alt: 'cover' },
      { type: 'link', url: '/blog/hello/', children: [] },
      { type: 'link', url: 'https://example.com', children: [] },
      { type: 'definition', url: '/media/novels/star.webp' },
    ],
  };
  remarkBasePath({ base: '/luna-site/' })(tree);
  assert.equal(tree.children[0].url, '/luna-site/media/blog/cover.webp');
  assert.equal(tree.children[1].url, '/luna-site/blog/hello/');
  assert.equal(tree.children[2].url, 'https://example.com');
  assert.equal(tree.children[3].url, '/luna-site/media/novels/star.webp');
});

test('remark 插件重写内联 HTML 的属性', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'html', value: '<img src="/media/blog/a.png" alt="a">' },
      { type: 'html', value: '<a href="/projects/">项目</a>' },
    ],
  };
  remarkBasePath({ base: '/luna-site/' })(tree);
  assert.equal(tree.children[0].value, '<img src="/luna-site/media/blog/a.png" alt="a">');
  assert.equal(tree.children[1].value, '<a href="/luna-site/projects/">项目</a>');
});

test('remark 插件在 base=/ 时不改动内容', () => {
  const tree = { type: 'root', children: [{ type: 'image', url: '/media/a.png' }] };
  remarkBasePath({ base: '/' })(tree);
  assert.equal(tree.children[0].url, '/media/a.png');
});
