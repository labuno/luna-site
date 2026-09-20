import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBase, withBase, isExternalUrl } from '../src/lib/paths.mjs';

test('normalizeBase 统一前后斜杠', () => {
  assert.equal(normalizeBase('luna-site'), '/luna-site/');
  assert.equal(normalizeBase('/luna-site'), '/luna-site/');
  assert.equal(normalizeBase('/luna-site/'), '/luna-site/');
  assert.equal(normalizeBase(''), '/');
  assert.equal(normalizeBase(undefined), '/');
  assert.equal(normalizeBase('/'), '/');
});

test('withBase 拼接 base 与路径且不产生双斜杠', () => {
  assert.equal(withBase('/blog/', '/luna-site/'), '/luna-site/blog/');
  assert.equal(withBase('blog/', '/luna-site'), '/luna-site/blog/');
  assert.equal(withBase('/blog/', '/'), '/blog/');
  assert.equal(withBase('/', '/luna-site/'), '/luna-site/');
  assert.equal(withBase('', '/luna-site/'), '/luna-site/');
});

test('withBase 不会重复添加 base 前缀', () => {
  assert.equal(withBase('/luna-site/blog/', '/luna-site/'), '/luna-site/blog/');
});

test('withBase 放行外部、协议相对与锚点 URL', () => {
  assert.equal(withBase('https://example.com/x', '/luna-site/'), 'https://example.com/x');
  assert.equal(withBase('//cdn.example.com/x', '/luna-site/'), '//cdn.example.com/x');
  assert.equal(withBase('#section', '/luna-site/'), '#section');
  assert.equal(withBase('mailto:a@b.c', '/luna-site/'), 'mailto:a@b.c');
});

test('isExternalUrl 判定', () => {
  assert.equal(isExternalUrl('https://a.com'), true);
  assert.equal(isExternalUrl('//a.com'), true);
  assert.equal(isExternalUrl('#x'), true);
  assert.equal(isExternalUrl('/blog/'), false);
  assert.equal(isExternalUrl('blog/'), false);
});
