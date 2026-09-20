import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdownFile } from '../src/lib/frontmatter.mjs';

test('解析 frontmatter 与正文', () => {
  const text = ['---', 'title: "标题"', 'tags:', '  - AI', 'draft: true', '---', '', '正文内容'].join('\n');
  const { data, body } = parseMarkdownFile(text);
  assert.equal(data.title, '标题');
  assert.deepEqual(data.tags, ['AI']);
  assert.equal(data.draft, true);
  assert.equal(body.trim(), '正文内容');
});

test('无 frontmatter 时返回空数据与全文', () => {
  const { data, body } = parseMarkdownFile('正文');
  assert.deepEqual(data, {});
  assert.equal(body, '正文');
});

test('frontmatter 非法时抛出可读错误', () => {
  const broken = ['---', 'title: [未闭合', '---', '正文'].join('\n');
  assert.throws(() => parseMarkdownFile(broken), /Invalid frontmatter/);
});
