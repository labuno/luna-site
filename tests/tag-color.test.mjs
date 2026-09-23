import test from 'node:test';
import assert from 'node:assert/strict';
import { tagHue } from '../src/lib/tag-color.mjs';

const ALLOWED = (hue) => (hue >= 170 && hue < 360) || (hue >= 0 && hue < 60);

test('tagHue 稳定、落在可用色相区间', () => {
  for (const slug of ['github', 'github-pages', 'ci-cd', '静态站点', '部署', 'engineering', 'astro']) {
    const hue = tagHue(slug);
    assert.equal(typeof hue, 'number');
    assert.ok(ALLOWED(hue), `${slug}: ${hue} 落在排除区间`);
    assert.equal(tagHue(slug), hue, '相同 slug 必须得到相同色相');
  }
});

test('当前标签集的色相互不相同', () => {
  const hues = ['github', 'github-pages', 'ci-cd', '静态站点', '部署'].map(tagHue);
  assert.equal(new Set(hues).size, hues.length, `色相重复: ${hues.join(',')}`);
});
