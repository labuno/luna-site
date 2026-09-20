import test from 'node:test';
import assert from 'node:assert/strict';
import { slugify, taxonomySlug } from '../src/lib/slug.mjs';

test('slugify 处理英文、空格与大小写', () => {
  assert.equal(slugify('Agent Runtime'), 'agent-runtime');
  assert.equal(slugify('  MCP/Tool  Use '), 'mcp-tool-use');
  assert.equal(slugify('C++ 与 Rust'), 'c-与-rust');
});

test('slugify 保留中文并去掉首尾连字符', () => {
  assert.equal(slugify('人工智能'), '人工智能');
  assert.equal(slugify('--AI--'), 'ai');
  assert.equal(slugify(''), 'untagged');
  assert.equal(slugify(undefined), 'untagged');
});

test('taxonomySlug 支持展示名到稳定 slug 的映射', () => {
  const overrides = { 'agent-notes': 'Agent 笔记' };
  assert.equal(taxonomySlug('Agent 笔记', overrides), 'agent-notes');
  assert.equal(taxonomySlug('Agent', overrides), 'agent');
  assert.equal(taxonomySlug('人工智能', {}), '人工智能');
});
